// 只读：把“产品方案资料”从当前环境导出为资料包，供迁出 Manus 后在新环境导入
//（导入脚本：scripts/import-product-materials.ts，随自托管改造一起提供）。
//
// 导出范围（客户、商机等业务数据不在范围内）：
//   products                产品覆盖度配置
//   product_doc_folders     武器库文档子文件夹
//   product_docs            武器库产品文档（含原文件、已提取文字）
//   arsenal_weapons         作战武器
//   arsenal_attachments     武器附件（含原文件）
//   arsenal_pricing         武器报价
//   listprice_items         产品价目表
//   case_studies            成功案例
//   kill_sheets             竞品阻击卡（导入时解除与旧客户的关联）
//
// 不写数据库、不改存储：只执行 SELECT，并通过存储的下载接口把原文件保存到本地目录。
// 资料包结构：
//   <out>/manifest.json             各表记录 + 每个文件的路径、大小、SHA-256
//   <out>/files/<table>/<id>-<文件名>
//
// 用法（在仍运行旧版本、能访问旧存储的环境里执行）：
//   pnpm tsx scripts/export-product-materials.ts                    # 只统计，不下载
//   pnpm tsx scripts/export-product-materials.ts --out ./materials  # 导出到 ./materials
// 完成后打包：tar czf materials.tar.gz -C ./materials .
//
// 需要 DATABASE_URL；下载文件需要旧存储的 BUILT_IN_FORGE_API_URL 与 BUILT_IN_FORGE_API_KEY。

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
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

const BUNDLE_FORMAT = "command-product-materials/v2";
const FILE_TABLES = ["product_docs", "arsenal_attachments"] as const;

type FileEntry = {
  table: (typeof FILE_TABLES)[number];
  id: number;
  fileKey: string;
  path: string;
  size: number;
  sha256: string;
};

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

/** 本地文件名只保留安全字符，避免中文、空格与路径符号造成问题；原文件名保存在记录里。 */
function safeLocalName(id: number, filename: string): string {
  const dot = filename.lastIndexOf(".");
  const ext = dot > 0 ? filename.slice(dot + 1).replace(/[^A-Za-z0-9]/g, "").slice(0, 10) : "";
  return ext ? `${id}.${ext.toLowerCase()}` : String(id);
}

function forgeConfig() {
  const url = process.env.BUILT_IN_FORGE_API_URL?.trim();
  const key = process.env.BUILT_IN_FORGE_API_KEY?.trim();
  if (!url || !key) throw new Error("下载文件需要 BUILT_IN_FORGE_API_URL 与 BUILT_IN_FORGE_API_KEY（旧存储）");
  return { url: url.replace(/\/+$/, ""), key };
}

async function downloadFromOldStorage(fileKey: string): Promise<Buffer> {
  const { url, key } = forgeConfig();
  const presign = new URL("v1/storage/presign/get", `${url}/`);
  presign.searchParams.set("path", fileKey.replace(/^\/+/, ""));
  const signed = await fetch(presign, { headers: { Authorization: `Bearer ${key}` } });
  if (!signed.ok) throw new Error(`获取下载地址失败（${signed.status}）：${fileKey}`);
  const { url: downloadUrl } = (await signed.json()) as { url?: string };
  if (!downloadUrl) throw new Error(`下载地址为空：${fileKey}`);
  const response = await fetch(downloadUrl);
  if (!response.ok) throw new Error(`下载失败（${response.status}）：${fileKey}`);
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  const out = argValue("out");
  const db = await getDb();
  if (!db) throw new Error("无法连接数据库：请设置 DATABASE_URL");

  const [productRows, folderRows, docRows, weaponRows, attachmentRows, pricingRows, listpriceRows, caseRows, killSheetRows] = await Promise.all([
    db.select().from(products),
    db.select().from(productDocFolders),
    db.select().from(productDocs),
    db.select().from(arsenalWeapons),
    db.select().from(arsenalAttachments),
    db.select().from(arsenalPricing),
    db.select().from(listpriceItems),
    db.select().from(caseStudies),
    db.select().from(killSheets),
  ]);
  const tables = {
    products: productRows,
    product_doc_folders: folderRows,
    product_docs: docRows,
    arsenal_weapons: weaponRows,
    arsenal_attachments: attachmentRows,
    arsenal_pricing: pricingRows,
    listprice_items: listpriceRows,
    case_studies: caseRows,
    kill_sheets: killSheetRows,
  };

  console.log("导出范围：");
  for (const [name, rows] of Object.entries(tables)) console.log(`  ${name.padEnd(22)} ${rows.length} 条`);
  console.log(`  其中 arsenal_weapons 标记为演示数据：${weaponRows.filter(row => row.isDemo).length} 条`);
  const totalBytes = [...docRows, ...attachmentRows].reduce((sum, row) => sum + (row.fileSize ?? 0), 0);
  console.log(`  需要下载的文件：${docRows.length + attachmentRows.length} 个，约 ${(totalBytes / 1024 / 1024).toFixed(1)} MB（按记录中的大小估算）`);

  if (!out) {
    console.log("\n[只统计] 未下载任何文件。加 --out <目录> 执行导出。");
    return;
  }

  const root = resolve(out);
  if (existsSync(root) && readdirSync(root).length > 0) throw new Error(`输出目录不为空：${root}`);
  mkdirSync(root, { recursive: true });

  const files: FileEntry[] = [];
  const failures: { table: string; id: number; fileKey: string; error: string }[] = [];
  const fileRows: { table: FileEntry["table"]; id: number; fileKey: string; filename: string }[] = [
    ...docRows.map(row => ({ table: "product_docs" as const, id: row.id, fileKey: row.fileKey, filename: row.filename })),
    ...attachmentRows.map(row => ({ table: "arsenal_attachments" as const, id: row.id, fileKey: row.fileKey, filename: row.filename })),
  ];

  for (let index = 0; index < fileRows.length; index++) {
    const row = fileRows[index];
    const relative = join("files", row.table, safeLocalName(row.id, row.filename));
    try {
      const data = await downloadFromOldStorage(row.fileKey);
      mkdirSync(join(root, "files", row.table), { recursive: true });
      writeFileSync(join(root, relative), data);
      files.push({ table: row.table, id: row.id, fileKey: row.fileKey, path: relative, size: data.length, sha256: createHash("sha256").update(data).digest("hex") });
      console.log(`  [${index + 1}/${fileRows.length}] ✓ ${row.table}#${row.id} ${row.filename}（${data.length} 字节）`);
    } catch (error: any) {
      failures.push({ table: row.table, id: row.id, fileKey: row.fileKey, error: error?.message ?? String(error) });
      console.log(`  [${index + 1}/${fileRows.length}] ✗ ${row.table}#${row.id} ${row.filename}：${error?.message ?? error}`);
    }
  }

  const manifest = {
    format: BUNDLE_FORMAT,
    exportedAt: new Date().toISOString(),
    counts: Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, rows.length])),
    tables,
    files,
    failures,
  };
  writeFileSync(join(root, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(`\n已导出到 ${root}`);
  console.log(`文件：成功 ${files.length} 个，失败 ${failures.length} 个`);
  if (failures.length) {
    console.log("有文件下载失败（见 manifest.json 的 failures），导入时这些记录会被单独列出。请回报失败清单。");
    process.exitCode = 2;
  }
}

main().then(() => process.exit(process.exitCode ?? 0)).catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
