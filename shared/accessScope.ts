// 客户数据可见范围（2026-10-11 与业务确认的规则）
//   AD 与系统管理员：全部客户
//   SAM：分配给自己的客户（clients.assignedSamId）
//   RSM：分配给自己的客户（clients.assignedRsmId）
//   SA：自己被分配的商机（opportunities.assignedSaId）所属的客户
// 分配字段存的是 email_users.id，而登录会话里的用户行来自 users 表，
// 两者通过 users.openId = "email_<email_users.id>" 关联。

export type PodRole = "AD" | "SAM" | "SA" | "RSM";

export type ClientScope = { all: true } | { all: false; clientIds: Set<number> };

export type ScopeSubject = {
  role: "admin" | "user";
  podRole: PodRole | null;
  emailUserId: number | null;
};

export type ScopeClientRow = { id: number; assignedSamId: number | null; assignedRsmId: number | null };
export type ScopeOpportunityRow = { clientId: number; assignedSaId: number | null };

export function emailUserIdFromOpenId(openId: string | null | undefined): number | null {
  const match = /^email_(\d+)$/.exec(openId ?? "");
  return match ? Number(match[1]) : null;
}

export function hasFullAccess(subject: Pick<ScopeSubject, "role" | "podRole">): boolean {
  return subject.role === "admin" || subject.podRole === "AD";
}

export function computeClientScope(
  subject: ScopeSubject,
  clients: ScopeClientRow[],
  opportunities: ScopeOpportunityRow[],
): ClientScope {
  if (hasFullAccess(subject)) return { all: true };
  const me = subject.emailUserId;
  const clientIds = new Set<number>();
  if (me === null) return { all: false, clientIds };
  if (subject.podRole === "SAM") {
    for (const client of clients) if (client.assignedSamId === me) clientIds.add(client.id);
  } else if (subject.podRole === "RSM") {
    for (const client of clients) if (client.assignedRsmId === me) clientIds.add(client.id);
  } else if (subject.podRole === "SA") {
    for (const opportunity of opportunities) if (opportunity.assignedSaId === me) clientIds.add(opportunity.clientId);
  }
  return { all: false, clientIds };
}

export function scopeAllows(scope: ClientScope, clientId: number | null | undefined, allowNull = false): boolean {
  if (scope.all) return true;
  if (clientId === null || clientId === undefined) return allowNull;
  return scope.clientIds.has(clientId);
}

/** 仅 AD/管理员可调用：跨客户汇总、批量改动与分配类操作。 */
export const AD_ONLY_PATHS = new Set<string>([
  "clients.delete",
  "clients.importBatch",
  "clients.assignSam",
  "clients.assignRsm",
  "opportunities.assignSa",
  "pod.clearCompleted",
  "pod.clearByRole",
  "pod.weeklyReport",
  "adCommand.refresh",
  "adCommand.samCoachReview",
  "insights.globalReview",
  "insights.samCoachReview",
  "insights.createCoachingActions",
  "insights.dataGapReport",
  "insights.triggerDailyBriefing",
]);

/** 输入里直接携带的客户维度字段。 */
const CLIENT_ID_KEYS = ["clientId", "sourceClientId"] as const;

export function collectInputClientIds(rawInput: unknown): number[] {
  if (!rawInput || typeof rawInput !== "object") return [];
  const input = rawInput as Record<string, unknown>;
  return CLIENT_ID_KEYS.map(key => input[key]).filter((value): value is number => typeof value === "number");
}

export function collectInputOpportunityIds(rawInput: unknown): number[] {
  if (!rawInput || typeof rawInput !== "object") return [];
  const value = (rawInput as Record<string, unknown>).opportunityId;
  return typeof value === "number" ? [value] : [];
}

/**
 * 以记录 id 操作的接口：先查出记录所属客户再判断。
 * table 为 drizzle/schema 中的导出名；"clients" 表示 id 本身即客户 id；
 * allowNull 表示不属于任何客户的记录（如竞品库、通用报价）对已登录用户开放。
 */
export type EntityRule = { table: string; keys: string[]; allowNull: boolean };

export const ENTITY_ID_RULES: Record<string, EntityRule> = {
  "clients.get": { table: "clients", keys: ["id"], allowNull: false },
  "clients.update": { table: "clients", keys: ["id"], allowNull: false },
  "purchaseSignals.delete": { table: "customerPurchaseSignals", keys: ["id"], allowNull: false },
  "intelligence.delete": { table: "intelligenceSignals", keys: ["id"], allowNull: false },
  "intelligence.deleteBatch": { table: "intelligenceSignals", keys: ["ids"], allowNull: false },
  "intelligence.autoMatch": { table: "intelligenceSignals", keys: ["signalId"], allowNull: false },
  "actions.complete": { table: "actionItems", keys: ["id"], allowNull: false },
  "actions.deleteOne": { table: "actionItems", keys: ["id"], allowNull: false },
  "actions.adoptOne": { table: "actionItems", keys: ["actionId"], allowNull: false },
  "actions.adoptAll": { table: "actionItems", keys: ["actionIds"], allowNull: false },
  "insights.getByIds": { table: "aiReviews", keys: ["ids"], allowNull: false },
  "insights.completeCoachingAction": { table: "coachingActions", keys: ["id"], allowNull: false },
  "insights.submitCoachingFeedback": { table: "coachingActions", keys: ["id"], allowNull: false },
  "insights.deleteCoachingAction": { table: "coachingActions", keys: ["id"], allowNull: false },
  "meetings.delete": { table: "meetingMinutes", keys: ["id"], allowNull: false },
  "meetings.deleteBatch": { table: "meetingMinutes", keys: ["ids"], allowNull: false },
  "meetings.update": { table: "meetingMinutes", keys: ["id"], allowNull: false },
  "meetings.getExtractionStatus": { table: "meetingMinutes", keys: ["meetingId"], allowNull: false },
  "meetings.confirmFullSignals": { table: "meetingMinutes", keys: ["meetingId"], allowNull: false },
  "pod.complete": { table: "podTasks", keys: ["id"], allowNull: false },
  "pod.deleteOne": { table: "podTasks", keys: ["id"], allowNull: false },
  "pod.updateTaskStatus": { table: "podTasks", keys: ["id"], allowNull: false },
  "contacts.update": { table: "keyContacts", keys: ["id"], allowNull: false },
  "contacts.delete": { table: "keyContacts", keys: ["id"], allowNull: false },
  "contacts.deleteBatch": { table: "keyContacts", keys: ["ids"], allowNull: false },
  "opportunities.update": { table: "opportunities", keys: ["id"], allowNull: false },
  "opportunities.delete": { table: "opportunities", keys: ["id"], allowNull: false },
  "opportunities.updateBlueSheet": { table: "opportunities", keys: ["id"], allowNull: false },
  "killSheets.update": { table: "killSheets", keys: ["id"], allowNull: true },
  "killSheets.delete": { table: "killSheets", keys: ["id"], allowNull: true },
  "killSheets.generateTalk": { table: "killSheets", keys: ["id"], allowNull: true },
  "arsenalAI.updateOutcome": { table: "arsenalGenerated", keys: ["id"], allowNull: true },
  "arsenalAI.delete": { table: "arsenalGenerated", keys: ["id"], allowNull: true },
  "adCommand.confirm": { table: "adCommandRecommendations", keys: ["id"], allowNull: false },
  "adCommand.skip": { table: "adCommandRecommendations", keys: ["id"], allowNull: false },
  "command2.saveCoverage": { table: "relationshipCoverage", keys: ["id"], allowNull: false },
  "command2.deleteCoverage": { table: "relationshipCoverage", keys: ["id"], allowNull: false },
  "command2.savePainMetric": { table: "painMetrics", keys: ["id"], allowNull: false },
  "command2.deletePainMetric": { table: "painMetrics", keys: ["id"], allowNull: false },
  "command2.saveCompetition": { table: "competitionMap", keys: ["id"], allowNull: false },
  "command2.deleteCompetition": { table: "competitionMap", keys: ["id"], allowNull: false },
  "quotes.getById": { table: "quotes", keys: ["id"], allowNull: true },
  "quotes.update": { table: "quotes", keys: ["id"], allowNull: true },
  "quotes.delete": { table: "quotes", keys: ["id"], allowNull: true },
  "quotes.addItem": { table: "quotes", keys: ["quoteId"], allowNull: true },
  "quotes.updateItem": { table: "quotes", keys: ["quoteId"], allowNull: true },
  "quotes.deleteItem": { table: "quotes", keys: ["quoteId"], allowNull: true },
  "ledger.ingestion": { table: "ingestions", keys: ["ingestionId"], allowNull: false },
  "ledger.review": { table: "evidence", keys: ["confirmIds", "rejectIds"], allowNull: false },
};

export function collectEntityIds(rule: EntityRule, rawInput: unknown): number[] {
  if (!rawInput || typeof rawInput !== "object") return [];
  const input = rawInput as Record<string, unknown>;
  const ids: number[] = [];
  for (const key of rule.keys) {
    const value = input[key];
    if (typeof value === "number") ids.push(value);
    else if (Array.isArray(value)) for (const item of value) if (typeof item === "number") ids.push(item);
  }
  return ids;
}

/** 这些接口返回的不挂客户的条目（如全局战场研判）含全部客户信息，非 AD 不可见。 */
export const HIDE_NULL_CLIENT_PATHS = new Set<string>(["adCommand.list"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** 客户表行（含展开后的派生对象）都带 assignedSamId 字段，以此识别并按 id 过滤。 */
function isClientRow(value: Record<string, unknown>): boolean {
  return typeof value.id === "number" && "assignedSamId" in value && !("clientId" in value);
}

/**
 * 兜底过滤：递归移除响应中不在可见范围内的客户维度条目。
 * 对返回数组的接口逐条过滤；单条记录的读取由输入校验负责。
 */
export function filterByScope<T>(data: T, scope: ClientScope, hideNullClient = false): T {
  if (scope.all) return data;
  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      const kept: unknown[] = [];
      for (const item of value) {
        if (isPlainObject(item)) {
          if ("clientId" in item) {
            const clientId = item.clientId;
            if (typeof clientId === "number" && !scope.clientIds.has(clientId)) continue;
            if ((clientId === null || clientId === undefined) && hideNullClient) continue;
          } else if (isClientRow(item) && !scope.clientIds.has(item.id as number)) {
            continue;
          }
        }
        kept.push(visit(item));
      }
      return kept;
    }
    if (isPlainObject(value)) {
      const out: Record<string, unknown> = {};
      for (const [key, inner] of Object.entries(value)) out[key] = visit(inner);
      return out;
    }
    return value;
  };
  return visit(data) as T;
}

/**
 * dashboard.summary 的汇总数字在服务端按全量客户计算；
 * 非 AD 用户过滤掉客户后，按其可见客户重算，避免泄露团队整体规模与分布。
 */
export function recomputeDashboardAggregates<T>(data: T): T {
  if (!isPlainObject(data) || !Array.isArray(data.clients)) return data;
  const clients = data.clients as Array<Record<string, unknown>>;
  const stageDistribution: Record<string, number> = {};
  for (const client of clients) {
    const stage = typeof client.stage === "string" ? client.stage : "未知";
    stageDistribution[stage] = (stageDistribution[stage] ?? 0) + 1;
  }
  return {
    ...data,
    clientCount: clients.length,
    stageDistribution,
    visitedThisWeekCount: clients.filter(client => client.visitedThisWeek === true).length,
  } as T;
}
