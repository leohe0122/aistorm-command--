import { TRPCError } from "@trpc/server";
import type { User } from "../drizzle/schema";
import {
  AD_ONLY_PATHS,
  ENTITY_ID_RULES,
  HIDE_NULL_CLIENT_PATHS,
  collectEntityIds,
  collectInputClientIds,
  collectInputOpportunityIds,
  computeClientScope,
  emailUserIdFromOpenId,
  filterByScope,
  hasFullAccess,
  recomputeDashboardAggregates,
  scopeAllows,
  type ClientScope,
  type PodRole,
  type ScopeSubject,
} from "../shared/accessScope";
import { getDb } from "./db";

// 同一请求内（含 httpBatchLink 批量请求）只计算一次可见范围。
const scopeCache = new WeakMap<object, Promise<ClientScope>>();

async function resolveSubject(user: User): Promise<ScopeSubject> {
  const emailUserId = emailUserIdFromOpenId(user.openId);
  const fallback: ScopeSubject = { role: user.role, podRole: (user.podRole as PodRole) ?? null, emailUserId };
  // users.role 在每次认证时已与 email_users 同步，管理员无需再查库。
  if (emailUserId === null || user.role === "admin") return fallback;
  const db = await getDb();
  if (!db) return fallback;
  const { emailUsers } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  // 以 email_users 为准，避免 users 表上的角色字段滞后。
  const rows = await db.select({ role: emailUsers.role, podRole: emailUsers.podRole }).from(emailUsers).where(eq(emailUsers.id, emailUserId)).limit(1);
  if (rows.length === 0) return { role: "user", podRole: null, emailUserId };
  return { role: rows[0].role, podRole: rows[0].podRole, emailUserId };
}

async function computeScopeFor(user: User): Promise<ClientScope> {
  const subject = await resolveSubject(user);
  if (hasFullAccess(subject)) return { all: true };
  const db = await getDb();
  if (!db) return { all: false, clientIds: new Set() };
  const { clients, opportunities } = await import("../drizzle/schema");
  const [clientRows, opportunityRows] = await Promise.all([
    db.select({ id: clients.id, assignedSamId: clients.assignedSamId, assignedRsmId: clients.assignedRsmId }).from(clients),
    db.select({ clientId: opportunities.clientId, assignedSaId: opportunities.assignedSaId }).from(opportunities),
  ]);
  return computeClientScope(subject, clientRows, opportunityRows);
}

export function getClientScope(user: User, cacheKey: object): Promise<ClientScope> {
  let pending = scopeCache.get(cacheKey);
  if (!pending) {
    pending = computeScopeFor(user);
    scopeCache.set(cacheKey, pending);
  }
  return pending;
}

async function lookupClientIds(table: string, ids: number[]): Promise<Array<number | null>> {
  if (ids.length === 0) return [];
  if (table === "clients") return ids;
  const db = await getDb();
  if (!db) return ids.map(() => null);
  const schema: Record<string, any> = await import("../drizzle/schema");
  const target = schema[table];
  if (!target?.id || !target?.clientId) throw new Error(`[accessGuard] 未知或缺少 clientId 的表：${table}`);
  const { inArray } = await import("drizzle-orm");
  const rows = await db.select({ id: target.id, clientId: target.clientId }).from(target).where(inArray(target.id, ids));
  // 查不到的记录交给业务逻辑处理（通常是“不存在”）；只校验真实存在的记录归属。
  return rows.map((row: { clientId: number | null }) => row.clientId);
}

function forbid(): never {
  throw new TRPCError({ code: "FORBIDDEN", message: "无权访问该客户的数据" });
}

/**
 * tRPC 中间件主体：调用前校验输入涉及的客户，调用后过滤返回结果。
 * 管理员与 AD 直接放行。
 */
export async function enforceClientScope<T>(opts: {
  user: User;
  cacheKey: object;
  path: string;
  getRawInput: () => Promise<unknown>;
  next: () => Promise<T>;
}): Promise<T> {
  const scope = await getClientScope(opts.user, opts.cacheKey);
  if (scope.all) return opts.next();

  if (AD_ONLY_PATHS.has(opts.path)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "该操作仅限 AD 或管理员" });
  }

  const raw = await opts.getRawInput();
  for (const clientId of collectInputClientIds(raw)) if (!scopeAllows(scope, clientId)) forbid();

  const opportunityIds = collectInputOpportunityIds(raw);
  if (opportunityIds.length > 0) {
    for (const clientId of await lookupClientIds("opportunities", opportunityIds)) if (!scopeAllows(scope, clientId)) forbid();
  }

  const rule = ENTITY_ID_RULES[opts.path];
  if (rule) {
    const ids = collectEntityIds(rule, raw);
    for (const clientId of await lookupClientIds(rule.table, ids)) if (!scopeAllows(scope, clientId, rule.allowNull)) forbid();
  }

  const result: any = await opts.next();
  if (result && result.ok && "data" in result) {
    const filtered = filterByScope(result.data, scope, HIDE_NULL_CLIENT_PATHS.has(opts.path));
    return { ...result, data: opts.path === "dashboard.summary" ? recomputeDashboardAggregates(filtered) : filtered };
  }
  return result;
}
