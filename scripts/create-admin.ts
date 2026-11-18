// 在空库上创建第一个系统管理员（或把已有账号设为管理员并重置密码）。
//
// 新环境从空库重建时，email_users 里没有任何管理员；而“新增成员”只允许管理员操作、
// 自助注册的账号默认停用，所以必须用本脚本在服务器上建出第一个管理员。
//
// 密码由脚本用密码学安全随机数生成，只打印到运行脚本的终端，不写日志、不落库明文。
// 管理员首次登录后请在“修改密码”中改掉。
//
// 用法（在服务器上、已设置 DATABASE_URL 的环境里执行）：
//   pnpm tsx scripts/create-admin.ts --email admin@example.com --name "管理员"
//   pnpm tsx scripts/create-admin.ts --email admin@example.com --name "管理员" --pod-role AD
//   pnpm tsx scripts/create-admin.ts --email someone@example.com --force   # 已存在：设为管理员、启用并重置密码

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { emailUsers } from "../drizzle/schema";
import { generateTempPassword } from "../server/_core/password";
import { getDb } from "../server/db";

const POD_ROLES = ["AD", "SAM", "SA", "RSM"] as const;
type PodRole = (typeof POD_ROLES)[number];

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const email = argValue("email")?.trim().toLowerCase();
  const name = argValue("name")?.trim();
  const podRole = (argValue("pod-role")?.trim().toUpperCase() || "AD") as PodRole;
  const force = process.argv.includes("--force");

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("请用 --email 指定有效邮箱");
  if (!POD_ROLES.includes(podRole)) throw new Error(`--pod-role 只能是 ${POD_ROLES.join(" / ")}`);

  const db = await getDb();
  if (!db) throw new Error("无法连接数据库：请设置 DATABASE_URL");

  const password = generateTempPassword();
  const passwordHash = await bcrypt.hash(password, 10);
  const [existing] = await db.select({ id: emailUsers.id, role: emailUsers.role }).from(emailUsers).where(eq(emailUsers.email, email)).limit(1);

  if (existing) {
    if (!force) throw new Error(`邮箱 ${email} 已存在（id=${existing.id}，角色 ${existing.role}）。如需设为管理员并重置密码，加 --force 重新运行。`);
    await db.update(emailUsers).set({ role: "admin", isActive: true, passwordHash, ...(name ? { name } : {}) }).where(eq(emailUsers.id, existing.id));
    console.log(`已把 ${email} 设为管理员并启用（id=${existing.id}）。`);
  } else {
    if (!name) throw new Error("新建管理员时请用 --name 指定姓名");
    const [result] = await db.insert(emailUsers).values({ email, name, passwordHash, role: "admin", podRole, isActive: true });
    console.log(`已创建管理员 ${name} <${email}>（id=${Number((result as any).insertId)}，POD 角色 ${podRole}）。`);
  }

  // 只输出到操作者终端；不要把这段输出复制到工单、聊天或日志系统。
  console.log("");
  console.log(`一次性登录密码：${password}`);
  console.log("请立即登录并在“修改密码”中改掉。该密码不会再次显示。");
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
