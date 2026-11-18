import { EMAIL_SESSION_COOKIE } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import { and, eq, gt } from "drizzle-orm";
import type { Request } from "express";
import { emailSessions, emailUsers, type User } from "../../drizzle/schema";
import * as db from "../db";

// 登录只认邮箱会话（email_session，由 emailAuth.login 写入 email_sessions 表）。
// 旧的 Manus OAuth JWT 会话已不再被接受为用户身份；定时任务改用 CRON_SECRET（server/_core/cron.ts）。

export type AuthenticatedUser = User;

function parseCookies(cookieHeader: string | undefined) {
  if (!cookieHeader) return new Map<string, string>();
  return new Map(Object.entries(parseCookieHeader(cookieHeader)));
}

/** 按 email_session 令牌找到在职用户，并以 email_users 为准同步 users 表的系统角色与 POD 角色。 */
export async function userFromEmailSession(token: string): Promise<User | null> {
  const dbInstance = await db.getDb();
  if (!dbInstance) return null;
  const [session] = await dbInstance
    .select({ userId: emailSessions.userId })
    .from(emailSessions)
    .where(and(eq(emailSessions.token, token), gt(emailSessions.expiresAt, new Date())))
    .limit(1);
  if (!session) return null;
  const [emailUser] = await dbInstance.select().from(emailUsers).where(eq(emailUsers.id, session.userId)).limit(1);
  // 已停用账号的既有会话立即失效。
  if (!emailUser || !emailUser.isActive) return null;
  const openId = `email_${emailUser.id}`;
  await db.upsertUser({
    openId,
    name: emailUser.name,
    email: emailUser.email,
    loginMethod: "email",
    role: emailUser.role as "admin" | "user",
    podRole: emailUser.podRole,
    lastSignedIn: new Date(),
  });
  return (await db.getUserByOpenId(openId)) ?? null;
}

class SDKServer {
  async authenticateRequest(req: Request): Promise<AuthenticatedUser> {
    const cookies = parseCookies(req.headers.cookie);

    const emailToken = cookies.get(EMAIL_SESSION_COOKIE);
    if (emailToken) {
      try {
        const user = await userFromEmailSession(emailToken);
        if (user) return user;
      } catch (error) {
        console.warn("[Auth] email session lookup failed:", error);
      }
    }

    throw ForbiddenError("Invalid session cookie");
  }
}

export const sdk = new SDKServer();
