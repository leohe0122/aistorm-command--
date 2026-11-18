// 把旧环境导出的“产品方案资料”导入新环境（资料包由 scripts/export-product-materials.ts 生成）。
//
// 导入前先核对资料包中每个文件的大小与 SHA-256，任何不符都会停止且不写入。
// 编号重新分配：文档的子文件夹、附件与报价所属的武器都按新编号关联。
// 文件写入当前 STORAGE_DRIVER 配置的存储，键为 migrated/<表>/<原编号>/file.<扩展名>。
// 可重复执行：已导入的记录记在资料包目录的 import-state.json 中，重跑时跳过。
// 结束后逐个读回文件核对 SHA-256，并输出对账报告。
//
// 用法（在新服务器上，已配置 DATABASE_URL 与 STORAGE_DRIVER）：
//   pnpm tsx scripts/import-product-materials.ts --dir ./materials            # 只检查，打印计划
//   pnpm tsx scripts/import-product-materials.ts --dir ./materials --apply    # 导入
//   可选：--skip-demo   不导入标记为演示数据的武器（及其附件、报价）

import { eq, sql } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  arsenalAttachments,
  arsenalPricing,
  arsenalWeapons,
  caseStudies,
  killSheets,
  listpriceItems,
  productDocFolders,
  productDocs,
  products,
} from "../drizzle/schema";
import { getDb } from "../server/db";
import {
  databaseFingerprint,
  loadBundle,
  loadState,
  migratedKey,
  rowForInsert,
  saveState,
  sha256,
  skippedRecords,
  TABLE_ORDER,
  verifyBundleFiles,
  type MaterialTable,
} from "../server/migration/productMaterials";
import { fileUrlForKey, storageDriver, storageGetBuffer, storagePutAtKey } from "../server/storage";

const TABLES = {
  products,
  product_doc_folders: productDocFolders,
  product_docs: productDocs,
  arsenal_weapons: arsenalWeapons,
  arsenal_attachments: arsenalAttachments,
  arsenal_pricing: arsenalPricing,
  listprice_items: listpriceItems,
  case_studies: caseStudies,
  kill_sheets: killSheets,
} as const;

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const dir = argValue("dir");
  const apply = process.argv.includes("--apply");
  const skipDemo = process.argv.includes("--skip-demo");
  if (!dir) throw new Error("请用 --dir 指定资料包目录（解压后的目录，包含 manifest.json）");

  const bundle = loadBundle(dir);
  const problems = verifyBundleFiles(dir, bundle);
  if (problems.length) {
    console.error("资料包校验未通过，未写入任何数据：");
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  const skipped = skippedRecords(bundle);
  if (skipDemo) {
    for (const weapon of bundle.tables.arsenal_weapons) if (weapon.isDemo) skipped.add(`arsenal_weapons#${weapon.id}`);
  }
  // 父记录被跳过时，子记录一并跳过
  for (const table of ["arsenal_attachments", "arsenal_pricing"] as const) {
    for (const row of bundle.tables[table]) if (skipped.has(`arsenal_weapons#${row.weaponId}`)) skipped.add(`${table}#${row.id}`);
  }

  const db = await getDb();
  if (!db) throw new Error("无法连接数据库：请设置 DATABASE_URL");
  const target = databaseFingerprint(process.env.DATABASE_URL ?? "");
  const state = loadState(dir, target);
  const fileByRecord = new Map(bundle.files.map(file => [`${file.table}#${file.id}`, file]));

  console.log(`资料包：导出于 ${bundle.exportedAt}；目标库 ${target}；存储 ${storageDriver()}`);
  console.log("\n| 表 | 资料包 | 跳过 | 已导入 | 待导入 | 目标库现有 |\n|---|---|---|---|---|---|");
  for (const table of TABLE_ORDER) {
    const rows = bundle.tables[table];
    const skip = rows.filter(row => skipped.has(`${table}#${row.id}`)).length;
    const done = Object.keys(state.maps[table]).length;
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(TABLES[table]);
    console.log(`| ${table} | ${rows.length} | ${skip} | ${done} | ${rows.length - skip - done} | ${count} |`);
  }
  if (bundle.failures.length) {
    console.log("\n导出时下载失败、不会导入的文件：");
    for (const failure of bundle.failures) console.log(`  - ${failure.table}#${failure.id} ${failure.fileKey}：${failure.error}`);
  }
  if (!apply) {
    console.log("\n[只检查] 未写入任何数据。确认后加 --apply 重新运行。");
    return;
  }

  const newId = (table: MaterialTable, oldId: unknown) => state.maps[table][String(oldId)];
  for (const table of TABLE_ORDER) {
    for (const row of bundle.tables[table]) {
      const recordKey = `${table}#${row.id}`;
      if (skipped.has(recordKey) || newId(table, row.id) !== undefined) continue;
      const values = rowForInsert(row);

      if (table === "product_docs" && row.folderId != null) {
        const folder = newId("product_doc_folders", row.folderId);
        values.folderId = folder ?? null;
        if (folder === undefined) console.warn(`  ! ${recordKey} 的子文件夹 #${row.folderId} 不在资料包中，放到产品线根目录`);
      }
      if (table === "arsenal_attachments" || table === "arsenal_pricing") {
        const weapon = newId("arsenal_weapons", row.weaponId);
        if (weapon === undefined) { console.warn(`  ! ${recordKey} 所属武器 #${row.weaponId} 未导入，跳过`); continue; }
        values.weaponId = weapon;
      }
      const file = fileByRecord.get(recordKey);
      if (file) {
        const data = readFileSync(resolve(dir, file.path));
        const stored = await storagePutAtKey(migratedKey(table, Number(row.id), String(row.filename ?? "")), data, String(row.mimeType ?? "application/octet-stream"));
        values.fileKey = stored.key;
        values.fileUrl = stored.url;
      }

      const [result] = await db.insert(TABLES[table]).values(values as any);
      state.maps[table][String(row.id)] = Number((result as any).insertId);
      saveState(dir, state);
    }
    console.log(`  ✓ ${table}：已导入 ${Object.keys(state.maps[table]).length} 条`);
  }

  // 对账：逐个读回文件核对 SHA-256，并核对记录指向的文件地址
  let filesChecked = 0;
  const mismatches: string[] = [];
  for (const file of bundle.files) {
    const id = newId(file.table, file.id);
    if (id === undefined) continue;
    const table = TABLES[file.table as "product_docs" | "arsenal_attachments"];
    const [record] = await db.select({ fileKey: table.fileKey, fileUrl: table.fileUrl }).from(table).where(eq(table.id, id)).limit(1);
    if (!record) { mismatches.push(`${file.table}#${file.id}：新记录 #${id} 不存在`); continue; }
    const stored = await storageGetBuffer(record.fileKey).catch(() => null);
    if (!stored || sha256(stored) !== file.sha256) mismatches.push(`${file.table}#${file.id}：存储中的文件与资料包不一致`);
    else if (record.fileUrl !== fileUrlForKey(record.fileKey)) mismatches.push(`${file.table}#${file.id}：fileUrl 与 fileKey 不对应`);
    else filesChecked++;
  }

  console.log("\n## 对账\n\n| 表 | 资料包 | 跳过 | 已导入 |\n|---|---|---|---|");
  for (const table of TABLE_ORDER) {
    const rows = bundle.tables[table];
    console.log(`| ${table} | ${rows.length} | ${rows.filter(row => skipped.has(`${table}#${row.id}`)).length} | ${Object.keys(state.maps[table]).length} |`);
  }
  console.log(`\n文件读回核对：${filesChecked} 个一致，${mismatches.length} 个有问题`);
  for (const mismatch of mismatches) console.log(`  - ${mismatch}`);
  if (mismatches.length) process.exitCode = 2;
}

main().then(() => process.exit(process.exitCode ?? 0)).catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
