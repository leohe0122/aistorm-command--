import { AXIOS_TIMEOUT_MS, COOKIE_NAME, EMAIL_SESSION_COOKIE } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import axios, { type AxiosInstance } from "axios";
import { parse as parseCookieHeader } from "cookie";
import { and, eq, gt } from "drizzle-orm";
import type { Request } from "express";
import { jwtVerify } from "jose";
import { emailSessions, emailUsers, type User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";
import type {
  GetUserInfoWithJwtRequest,
  GetUserInfoWithJwtResponse,
} from "./types/manusTypes";

// 登录只认邮箱会话（email_session，由 emailAuth.login 写入 email_sessions 表）。
// 旧的 Manus OAuth JWT 会话已不再被接受为用户身份。

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

/** Result of `sdk.authenticateRequest`. 定时任务回调会带上 isCron。 */
export type AuthenticatedUser = User & {
  taskUid?: string;
  isCron?: boolean;
};

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

// ── Manus 定时任务回调身份（过渡期保留，PR 4 改为 CRON_SECRET 后删除）──────────
const CRON_OPEN_ID_PREFIX = "cron_";
const GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;

async function verifyCronJwt(token: string): Promise<string | null> {
  if (!ENV.cookieSecret) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(ENV.cookieSecret), { algorithms: ["HS256"] });
    const openId = (payload as Record<string, unknown>).openId;
    return isNonEmptyString(openId) && openId.startsWith(CRON_OPEN_ID_PREFIX) ? openId : null;
  } catch {
    return null;
  }
}

async function cronUserFromManus(client: AxiosInstance, jwtToken: string): Promise<AuthenticatedUser> {
  const payload: GetUserInfoWithJwtRequest = { jwtToken, projectId: ENV.appId };
  const { data } = await client.post<GetUserInfoWithJwtResponse>(GET_USER_INFO_WITH_JWT_PATH, payload);
  if (!data.taskUid) throw ForbiddenError("Cron session missing task_uid");
  const now = new Date();
  return {
    id: -1,
    openId: data.openId,
    name: data.name || "Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: data.taskUid,
    isCron: true,
  } as AuthenticatedUser;
}

class SDKServer {
  private client: AxiosInstance | null = null;

  private manusClient(): AxiosInstance {
    this.client ??= axios.create({ baseURL: ENV.oAuthServerUrl, timeout: AXIOS_TIMEOUT_MS });
    return this.client;
  }

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

    const cronToken = cookies.get(COOKIE_NAME);
    if (cronToken && (await verifyCronJwt(cronToken))) {
      return cronUserFromManus(this.manusClient(), cronToken);
    }

    throw ForbiddenError("Invalid session cookie");
  }
}

export const sdk = new SDKServer();
