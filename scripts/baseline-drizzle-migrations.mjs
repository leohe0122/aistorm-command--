// 一次性迁移基线：生产库过去用 scripts/apply-migrations.mjs 手工建表，
// 没有 drizzle 的迁移记录表（__drizzle_migrations），所以 `drizzle-kit migrate` 会从 0000 开始重建已存在的表而失败。
//
// 本脚本先核对数据库结构是否已与指定基线迁移一致（表与字段都存在），
// 一致时才把 0000 到基线的迁移登记为“已执行”，之后的新迁移即可交给 `drizzle-kit migrate` 正常执行。
//
// 用法：
//   node scripts/baseline-drizzle-migrations.mjs --baseline 0044_fast_shinko_yamashiro           # 只检查，不写入
//   node scripts/baseline-drizzle-migrations.mjs --baseline 0044_fast_shinko_yamashiro --apply   # 检查通过后写入登记
//   pnpm drizzle-kit migrate                                                                     # 执行基线之后的新迁移

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createConnection } from "mysql2/promise";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const drizzleDir = join(root, "drizzle");
const MIGRATIONS_TABLE = "__drizzle_migrations";

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
const apply = process.argv.includes("--apply");
const baselineTag = arg("baseline");
if (!baselineTag) {
  console.error("必须用 --baseline 指定生产库当前已到达的迁移，例如 --baseline 0044_fast_shinko_yamashiro");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("缺少 DATABASE_URL");
  process.exit(1);
}

const journal = JSON.parse(readFileSync(join(drizzleDir, "meta", "_journal.json"), "utf8"));
const baselineIndex = journal.entries.findIndex(entry => entry.tag === baselineTag);
if (baselineIndex < 0) {
  console.error(`在 drizzle/meta/_journal.json 中找不到迁移 ${baselineTag}`);
  process.exit(1);
}
const baselineEntries = journal.entries.slice(0, baselineIndex + 1);
const pending = journal.entries.slice(baselineIndex + 1).map(entry => entry.tag);
const snapshotFile = join(drizzleDir, "meta", `${String(journal.entries[baselineIndex].idx).padStart(4, "0")}_snapshot.json`);
const snapshot = JSON.parse(readFileSync(snapshotFile, "utf8"));

const conn = await createConnection(process.env.DATABASE_URL);
try {
  const [[{ db }]] = await conn.query("SELECT DATABASE() AS db");

  // 1. 核对结构：基线快照中的每张表、每个字段都必须已存在
  const [rows] = await conn.query(
    "SELECT TABLE_NAME AS t, COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ?",
    [db],
  );
  const existing = new Map();
  for (const row of rows) {
    if (!existing.has(row.t)) existing.set(row.t, new Set());
    existing.get(row.t).add(row.c);
  }
  const missing = [];
  for (const table of Object.values(snapshot.tables)) {
    const columns = existing.get(table.name);
    if (!columns) {
      missing.push(`缺少表 ${table.name}`);
      continue;
    }
    for (const column of Object.keys(table.columns)) {
      if (!columns.has(column)) missing.push(`缺少字段 ${table.name}.${column}`);
    }
  }
  console.log(`数据库：${db}`);
  console.log(`基线：${baselineTag}（${baselineEntries.length} 个迁移，快照含 ${Object.keys(snapshot.tables).length} 张表）`);
  if (missing.length > 0) {
    console.error(`结构与基线不一致，已停止：\n  ${missing.join("\n  ")}`);
    process.exit(2);
  }
  console.log("结构核对通过：基线中的表与字段均已存在。");

  // 2. 迁移登记表不能已有记录，避免覆盖既有历史
  const [tables] = await conn.query(
    "SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?",
    [db, MIGRATIONS_TABLE],
  );
  if (tables[0].n > 0) {
    const [[{ n }]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${MIGRATIONS_TABLE}\``);
    if (n > 0) {
      console.error(`${MIGRATIONS_TABLE} 已有 ${n} 条记录，不再重复登记。请直接运行 pnpm drizzle-kit migrate。`);
      process.exit(3);
    }
  }

  const records = baselineEntries.map(entry => {
    const sql = readFileSync(join(drizzleDir, `${entry.tag}.sql`), "utf8");
    return { tag: entry.tag, hash: createHash("sha256").update(sql).digest("hex"), createdAt: entry.when };
  });

  if (!apply) {
    console.log(`\n[只检查] 将登记 ${records.length} 个已执行迁移（${records[0].tag} … ${records.at(-1).tag}）。`);
    console.log(`之后 drizzle-kit migrate 将执行：${pending.length ? pending.join("、") : "无"}`);
    console.log("确认无误后加上 --apply 重新运行。");
    process.exit(0);
  }

  // 3. 与 drizzle-orm MySQL 迁移器相同的登记表结构
  await conn.query(`CREATE TABLE IF NOT EXISTS \`${MIGRATIONS_TABLE}\` (id SERIAL PRIMARY KEY, hash TEXT NOT NULL, created_at BIGINT)`);
  await conn.beginTransaction();
  for (const record of records) {
    await conn.query(`INSERT INTO \`${MIGRATIONS_TABLE}\` (hash, created_at) VALUES (?, ?)`, [record.hash, record.createdAt]);
  }
  await conn.commit();
  console.log(`已登记 ${records.length} 个迁移为已执行。`);
  console.log(`下一步运行 pnpm drizzle-kit migrate，将执行：${pending.length ? pending.join("、") : "无"}`);
} finally {
  await conn.end();
}
