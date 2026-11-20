// 只读：找出密码仍是旧默认初始密码的账号。
// 旧代码在“新增成员”未填密码时使用固定默认密码，而该值曾出现在公开的代码仓库中。
// 本脚本逐个比对 email_users 的密码哈希，只输出命中账号的邮箱与姓名（不输出哈希、不改任何数据）。
// 命中的账号请由管理员在“团队管理”中点“重置密码”。
//
// 用法：pnpm tsx scripts/check-default-passwords.ts   （需要 DATABASE_URL）

import bcrypt from "bcryptjs";
import { emailUsers } from "../drizzle/schema";
import { getDb } from "../server/db";

const LEGACY_DEFAULT_PASSWORDS = ["Aistorm2024!"];

async function main() {
  const db = await getDb();
  if (!db) throw new Error("无法连接数据库：请设置 DATABASE_URL");
  const rows = await db.select({ email: emailUsers.email, name: emailUsers.name, isActive: emailUsers.isActive, passwordHash: emailUsers.passwordHash }).from(emailUsers);
  const hits: { email: string; name: string | null; isActive: boolean | null }[] = [];
  for (const row of rows) {
    for (const candidate of LEGACY_DEFAULT_PASSWORDS) {
      if (row.passwordHash && (await bcrypt.compare(candidate, row.passwordHash))) {
        hits.push({ email: row.email, name: row.name, isActive: row.isActive });
        break;
      }
    }
  }
  console.log(`共检查 ${rows.length} 个账号，仍使用旧默认密码的有 ${hits.length} 个：`);
  for (const hit of hits) console.log(`  - ${hit.email}（${hit.name ?? "未命名"}，${hit.isActive ? "启用" : "停用"}）`);
  if (hits.length) console.log("\n请管理员在“团队管理”中逐个“重置密码”，并把新密码单独告知本人。");
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
