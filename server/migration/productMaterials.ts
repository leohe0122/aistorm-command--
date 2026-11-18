// 产品方案资料迁移：读取 scripts/export-product-materials.ts 生成的资料包，导入新环境。
// 范围：产品配置、武器库文档与文件夹、作战武器及附件与报价、产品价目表、成功案例、竞品阻击卡。
// 客户、商机等业务数据不在范围内；资料上指向旧客户的字段导入时置空。导入可重复执行：编号映射记录在资料包目录的状态文件中，
// 文件写入固定的键（migrated/<表>/<原编号>/<文件名>），重跑时跳过已导入的记录。

import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const BUNDLE_FORMAT = "command-product-materials/v2";
export const TABLE_ORDER = [
  "products",
  "product_doc_folders",
  "product_docs",
  "arsenal_weapons",
  "arsenal_attachments",
  "arsenal_pricing",
  "listprice_items",
  "case_studies",
  "kill_sheets",
] as const;
export type MaterialTable = (typeof TABLE_ORDER)[number];
export const FILE_TABLES: MaterialTable[] = ["product_docs", "arsenal_attachments"];

export type BundleFile = { table: MaterialTable; id: number; fileKey: string; path: string; size: number; sha256: string };
export type BundleFailure = { table: MaterialTable; id: number; fileKey: string; error: string };
export type Bundle = {
  format: string;
  exportedAt: string;
  counts: Record<MaterialTable, number>;
  tables: Record<MaterialTable, Record<string, unknown>[]>;
  files: BundleFile[];
  failures: BundleFailure[];
};

export type ImportState = { target: string; maps: Record<MaterialTable, Record<string, number>> };

export function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export function loadBundle(dir: string): Bundle {
  const manifestPath = join(resolve(dir), "manifest.json");
  if (!existsSync(manifestPath)) throw new Error(`找不到 ${manifestPath}`);
  const bundle = JSON.parse(readFileSync(manifestPath, "utf8")) as Bundle;
  if (bundle.format !== BUNDLE_FORMAT) throw new Error(`资料包格式不符：${bundle.format}（需要 ${BUNDLE_FORMAT}）`);
  for (const table of TABLE_ORDER) {
    if (!Array.isArray(bundle.tables?.[table])) throw new Error(`资料包缺少表 ${table}`);
    if (bundle.counts?.[table] !== bundle.tables[table].length) throw new Error(`表 ${table} 的记录数与清单不一致`);
  }
  return bundle;
}

/** 写入任何数据前，先核对每个文件的存在性、大小与 SHA-256。返回问题清单（为空表示通过）。 */
export function verifyBundleFiles(dir: string, bundle: Bundle): string[] {
  const problems: string[] = [];
  const root = resolve(dir);
  for (const file of bundle.files) {
    const full = resolve(root, file.path);
    if (!full.startsWith(root)) { problems.push(`${file.table}#${file.id}：非法路径 ${file.path}`); continue; }
    if (!existsSync(full)) { problems.push(`${file.table}#${file.id}：文件不存在 ${file.path}`); continue; }
    if (statSync(full).size !== file.size) { problems.push(`${file.table}#${file.id}：大小不符`); continue; }
    if (sha256(readFileSync(full)) !== file.sha256) problems.push(`${file.table}#${file.id}：SHA-256 不符`);
  }
  return problems;
}

/** 迁移后的存储键：固定、纯 ASCII，重跑时覆盖同一对象而不会产生重复文件。 */
export function migratedKey(table: MaterialTable, id: number, filename: string): string {
  const dot = filename.lastIndexOf(".");
  const ext = dot > 0 ? filename.slice(dot + 1).replace(/[^A-Za-z0-9]/g, "").slice(0, 10).toLowerCase() : "";
  return `migrated/${table.replace(/_/g, "-")}/${id}/file${ext ? `.${ext}` : ""}`;
}

const TIMESTAMP_COLUMNS = new Set(["createdAt", "updatedAt", "outcomeUpdatedAt"]);

// 指向旧环境客户的字段：新环境不迁移客户，导入时置空（资料本身保留）。
const CLIENT_LINK_COLUMNS = new Set(["clientId", "sourceClientId", "opportunityId"]);

/** 去掉原编号与旧客户关联、把时间字符串还原成 Date，其余字段原样保留。 */
export function rowForInsert(row: Record<string, unknown>): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === "id") continue;
    if (CLIENT_LINK_COLUMNS.has(key)) { values[key] = null; continue; }
    values[key] = TIMESTAMP_COLUMNS.has(key) && typeof value === "string" ? new Date(value) : value;
  }
  return values;
}

export function emptyState(target: string): ImportState {
  return { target, maps: Object.fromEntries(TABLE_ORDER.map(table => [table, {}])) as ImportState["maps"] };
}

export function statePath(dir: string): string {
  return join(resolve(dir), "import-state.json");
}

export function loadState(dir: string, target: string): ImportState {
  const path = statePath(dir);
  if (!existsSync(path)) return emptyState(target);
  const state = JSON.parse(readFileSync(path, "utf8")) as ImportState;
  if (state.target !== target) {
    throw new Error(`资料包已导入过另一个数据库（${state.target}）。如需导入到 ${target}，请使用资料包的新副本。`);
  }
  for (const table of TABLE_ORDER) state.maps[table] ??= {};
  return state;
}

export function saveState(dir: string, state: ImportState): void {
  writeFileSync(statePath(dir), JSON.stringify(state, null, 2));
}

/** 不含密码的数据库标识，用于防止把同一份状态用到另一个库。 */
export function databaseFingerprint(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl);
    return `${url.hostname}:${url.port || "3306"}${url.pathname}`;
  } catch {
    return "unknown";
  }
}

/** 需要跳过的记录：导出时文件下载失败的文档 / 附件，以及父记录被跳过的子记录。 */
export function skippedRecords(bundle: Bundle): Set<string> {
  const skipped = new Set(bundle.failures.map(failure => `${failure.table}#${failure.id}`));
  const fileIds = new Set(bundle.files.map(file => `${file.table}#${file.id}`));
  for (const table of FILE_TABLES) {
    for (const row of bundle.tables[table]) {
      if (!fileIds.has(`${table}#${row.id}`)) skipped.add(`${table}#${row.id}`);
    }
  }
  return skipped;
}
