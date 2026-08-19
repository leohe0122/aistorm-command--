import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { COOKIE_NAME } from "@shared/const";
import { getProductLinePrompt, PRODUCT_LINE_VALUES } from "@shared/productLines";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getLLMTextContent, invokeLLM } from "./_core/llm";
import { buildDailyBriefingPrompt, getComplianceRssDigest } from "./dailyBriefingRss";
import { SALES_METHODOLOGY_SYSTEM_PROMPT, buildAccountMapDiagnosticLayer, buildDealMapDiagnosticLayer } from "./salesMethodology";
import { calculateDealHealth, calculateGoNoGo, GO_NO_GO_GATE_KEYS } from "../shared/command2";
import { evaluateCustomerReadiness, type CustomerStage } from "../shared/customerReadiness";
import { classifyExecutiveMeetings } from "../shared/executiveMeetingEvidence";
import { getAccountDiagnosticContext, getArsenalOpportunityContext, getDealDiagnosticContext } from "./diagnosticContext";
import { AI_NATIVE_GUIDANCE_VERSION, FULL_MEETING_SIGNALS_RESPONSE_SCHEMA, MEDDPICC_FIELD_MAP, STAGE_REQUIREMENTS, normalizeFullMeetingSignals } from "./aiNativeGuidance";
// Admin-only procedure: requires login + admin role
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN', message: '需要管理员权限' });
  return next({ ctx });
});

// Helper: extract JSON from model output that may be wrapped in ```json ... ``` markdown blocks
function extractJSON(raw: string): string {
  const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  return match ? match[1].trim() : raw.trim();
}

import { getAllClients, getAllClientsWithVisitStats, getClientById, updateClient, invalidateClientsCache,
  getEffectivenessBaseline, upsertEffectivenessBaseline,
  getMeddpiccByClientId, upsertMeddpicc,
  insertClient, deleteClientCascade,
  getSignalsByClientId, getAllRecentSignals, insertSignal, updateSignal,
  deleteSignal, deleteSignalBatch,
  getActionsByClientId, getActionsByRole, insertActions, completeAction, deleteActionById, clearPendingActionsByClient,
  getOnePagersByClientId, insertOnePager,
  getAmmoByClientId, insertAmmo,
  getMeetingsByClientId, insertMeeting, updateMeeting,
  deleteMeeting, deleteMeetingBatch,
  getPodTasksByRole, insertPodTask, completePodTask, deletePodTask, clearCompletedPodTasks, clearPodTasksByRole,
  getLatestScoreByClientId, insertScore,
  getDealReviews, insertDealReview,
  getContactsByClientId, insertContact, updateContact, deleteContact,
  deleteContactBatch,
  getWeeklyReportData,
  saveMeddpiccSnapshot, getMeddpiccHistory,
  getSystemConfig, setSystemConfig, getAllSystemConfigs,
  getDb,
} from "./db";
import { saveAiReview, getLatestReviewsByClient, getLatestReviewByType } from "./db";
import { getClientMetrics, upsertClientMetrics } from "./db";
import { getAllCaseStudies, getCaseStudiesByIndustry, insertCaseStudy, updateCaseStudy, deleteCaseStudy } from "./db";
import { eq } from "drizzle-orm";

async function loadCustomerReadiness(clientId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库暂不可用" });
  const { clients, keyContacts, meetingMinutes, customerPurchaseSignals } = await import("../drizzle/schema.js");
  const { eq } = await import("drizzle-orm");
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "未找到客户" });
  const [contacts, meetings, signals] = await Promise.all([
    db.select().from(keyContacts).where(eq(keyContacts.clientId, clientId)),
    db.select().from(meetingMinutes).where(eq(meetingMinutes.clientId, clientId)),
    db.select().from(customerPurchaseSignals).where(eq(customerPurchaseSignals.clientId, clientId)),
  ]);
  const readiness = evaluateCustomerReadiness({
    stage: client.stage as CustomerStage,
    contacts,
    signals,
  });
  return { client, contacts, meetings, signals, readiness };
}

/** 高层直入仅允许由邮箱会话中的 AD 或系统管理员确认。 */
async function getEmailSessionActor(ctx: any) {
  const token = (() => {
    const cookie = ctx.req.headers?.cookie as string | undefined;
    return cookie?.match(/(?:^|;\s*)email_session=([^;]+)/)?.[1];
  })();
  if (!token) return null;
  const db = await getDb();
  if (!db) return null;
  const { emailUsers, emailSessions } = await import("../drizzle/schema.js");
  const { and, eq, gt } = await import("drizzle-orm");
  const [session] = await db.select().from(emailSessions).where(
    and(eq(emailSessions.token, token), gt(emailSessions.expiresAt, new Date()))
  ).limit(1);
  if (!session) return null;
  const [user] = await db.select().from(emailUsers).where(eq(emailUsers.id, session.userId)).limit(1);
  return user?.isActive ? user : null;
}

const customerStageOrder: CustomerStage[] = ["建图", "进门", "定痛", "找人", "进入商机"];

async function advanceCustomerStageByEvidence(clientId: number, requestedStage: CustomerStage) {
  const { client, readiness } = await loadCustomerReadiness(clientId);
  if (requestedStage === "进入商机") {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "进入商机必须通过“申请开商机”完成，系统会同时保存 0→1 证据快照。" });
  }
  const currentIndex = customerStageOrder.indexOf(client.stage as CustomerStage);
  const expectedStage = customerStageOrder[currentIndex + 1];
  if (requestedStage !== expectedStage) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: `当前阶段为“${client.stage}”，只能申请推进至下一阶段“${expectedStage || "无"}”。` });
  }
  await updateClient(clientId, { stage: requestedStage } as any);
  invalidateClientsCache();
  return { stage: requestedStage, evidence: readiness.standardActions };
}

const AI_GUIDANCE_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    dataSufficiency: { type: "string", enum: ["sufficient", "partial", "insufficient"] },
    factSummary: { type: "string" },
    primaryQuestion: { type: "string" },
    whyThisQuestion: { type: "string" },
    answerFocus: { type: "string", enum: ["purchase_signal", "decision_chain", "trigger_event", "meddpicc", "three_why", "competition"] },
    doNotAssume: { type: "array", items: { type: "string" }, maxItems: 2 },
  },
  required: ["dataSufficiency", "factSummary", "primaryQuestion", "whyThisQuestion", "answerFocus", "doNotAssume"],
  additionalProperties: false,
} as const;

const AI_ANSWER_INTERPRETATION_SCHEMA = {
  type: "object",
  properties: {
    message: { type: "string" },
    nextQuestion: { type: "string" },
    candidateTarget: { type: "string", enum: ["purchase_signal", "meddpicc", "none"] },
    signalType: { type: "string", enum: ["intent_subject", "decision_chain", "trigger_event", ""] },
    meddpiccDim: { type: "string", enum: ["M", "E", "D1", "D2", "P", "I", "C1", "C2", ""] },
    subjectName: { type: "string" },
    evidence: { type: "string" },
    suggestedScore: { type: "number", enum: [0, 25, 50, 75, 100] },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
  },
  required: ["message", "nextQuestion", "candidateTarget", "signalType", "meddpiccDim", "subjectName", "evidence", "suggestedScore", "confidence"],
  additionalProperties: false,
} as const;

const GUIDANCE_MEDDPICC_SCORE_FIELDS = [
  "metricsScore",
  "economicBuyerScore",
  "decisionCriteriaScore",
  "decisionProcessScore",
  "paperProcessScore",
  "implicatePainScore",
  "championScore",
  "competitionScore",
] as const;

/**
 * 主动引导只需足以选择下一问的事实，而不是整个 CRM 资料包。这个边界避免
 * 长备注拖慢模型，也避免把未验证的历史描述误当成当前证据。
 */
function compactGuidanceText(value: unknown, limit: number): string {
  const raw = typeof value === "string" ? value : value == null ? "" : JSON.stringify(value);
  const normalized = raw.replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, Math.max(0, limit - 1))}…` : normalized;
}

function summarizeGuidanceMeddpiccScores(meddpicc: unknown): Record<string, number> {
  const record = (meddpicc && typeof meddpicc === "object" ? meddpicc : {}) as Record<string, unknown>;
  return Object.fromEntries(
    GUIDANCE_MEDDPICC_SCORE_FIELDS
      .filter(field => typeof record[field] === "number")
      .map(field => [field, record[field] as number])
  );
}

function buildCustomerGuidanceSnapshot({
  client,
  contacts,
  meetings,
  signals,
  readiness,
  meddpicc,
}: {
  client: any;
  contacts: any[];
  meetings: any[];
  signals: any[];
  readiness: any;
  meddpicc: unknown;
}) {
  const stakeholders = contacts.slice(0, 8).map(item => ({
    name: item.name,
    title: item.title,
    buyingRole: item.buyingRole,
    relationship: item.relationship,
  }));
  const recentMeetings = meetings.slice(0, 2).map(item => ({
    date: item.meetingDate,
    attendees: compactGuidanceText(item.attendees, 160),
    keyPoints: compactGuidanceText(item.keyPoints, 360),
  }));
  const recentSignals = signals.slice(0, 3).map(item => ({
    type: item.signalType,
    subject: item.subjectName,
    date: item.occurredAt,
    source: item.sourceType,
    statement: compactGuidanceText(item.statement ?? item.sourceReference, 200),
  }));
  const blockers = (readiness?.blockers || []).slice(0, 4).map((item: unknown) => compactGuidanceText(item, 180));

  return `【客户作战台已入库事实（精炼版）】\n客户：${client.name}\n当前阶段：${client.stage}\n当前缺口：${JSON.stringify(blockers)}\n关键人：${JSON.stringify(stakeholders)}\n最近两次客户对话：${JSON.stringify(recentMeetings)}\n最近三条购买信号：${JSON.stringify(recentSignals)}\n客户级证据评分：${JSON.stringify(summarizeGuidanceMeddpiccScores(meddpicc))}`;
}

const AI_GUIDANCE_PRIMARY_TIMEOUT_MS = 8_500;
const AI_GUIDANCE_TOTAL_TIMEOUT_MS = 15_000;
// 当前内置 Forge 模型目录没有 gpt-4o；主动引导保留目录中可用的高推理 gpt-5。
// 此路径不传 reasoning，避免兼容提供商对该可选参数的差异影响交互可用性。
const AI_ACTIVE_GUIDANCE_SYSTEM_PROMPT = `你是 AIStorm Command 的主动式销售引导。你的唯一任务是帮助 SAM 把自己已经知道、但尚未录入系统的客户事实存入系统。
只把客户原话、客户动作、已发生的会议/邮件、明确时间节点或可靠外部事件视为事实；不得将销售计划、主观判断或历史关系直接当作客户意图。
你不是在指导 SAM 做销售动作，也不是要求 SAM 再去问客户、转发材料或补填方法论字段。你是在问 SAM：你已经知道什么、见过什么、对方说过什么。
一次只问一个自然语言问题。不要在问题中使用销售方法论术语，不杜撰、不补全未知信息；信息不足时明确“数据不足，暂不判断”。
输出必须满足传入的 JSON Schema，且不输出 JSON 以外文字。`;

async function runGuidanceModel(model: "gpt-5" | "gpt-5-mini", scope: "customer" | "opportunity", prompt: string, signal?: AbortSignal) {
  return invokeLLM({
    model,
    useBuiltin: true,
    maxCompletionTokens: model === "gpt-5" ? 800 : 600,
    signal,
    maxRetries: 0,
    messages: [{ role: "system", content: AI_ACTIVE_GUIDANCE_SYSTEM_PROMPT }, { role: "user", content: prompt }],
    response_format: { type: "json_schema", json_schema: { name: `${scope}_active_guidance`, strict: true, schema: AI_GUIDANCE_RESPONSE_SCHEMA } },
  });
}

function buildBaselineGuidance(scope: "customer" | "opportunity") {
  const target = scope === "customer" ? "最能影响这家客户走向的高层" : "最能影响这笔商机走向的关键人";
  return {
    dataSufficiency: "insufficient" as const,
    factSummary: "数据不足，暂不判断。",
    primaryQuestion: `请回想你与${target}最近一次沟通：他/她对当前方案、推进方向或关键分歧的真实反应是什么？请描述原话或明确动作。`,
    whyThisQuestion: "关键高层的实际立场还没有形成可回溯事实；先补齐你已知的原话或反应，才能判断这项关系是否支持推进。",
    answerFocus: "decision_chain" as const,
    doNotAssume: ["不能假定谁拥有最终决定权", "不能假定客户高层已经支持当前方向"],
  };
}

function buildNoWriteAnswerInterpretation(question: string) {
  return {
    message: "数据不足，暂不判断。本次回答未形成可确认、可写入的客户事实。",
    nextQuestion: question,
    candidateTarget: "none" as const,
    signalType: "" as const,
    meddpiccDim: "" as const,
    subjectName: "",
    evidence: "",
    suggestedScore: 0 as const,
    confidence: "low" as const,
  };
}

async function generateAIGuidance(scope: "customer" | "opportunity", snapshot: string) {
  const prompt = `你是 AIStorm Command 的主动式销售引导 AI。
你的唯一任务是：读取 SAM 已知但尚未录入系统的信息，一次问一个问题，帮助 SAM 把脑子里的事实存入系统。

你不是在指导 SAM 去做什么销售动作。你不是在要求 SAM 去问客户要什么东西。你是在问 SAM：“你已经知道什么？你见过什么？对方说过什么？”

${snapshot}

判断优先级（严格按顺序）：
1. 先判断 Pain、Power、Champion、Value、Control 中哪一类最接近零或证据最薄弱。评分映射为：Pain=implicatePainScore；Power=economicBuyerScore、decisionProcessScore；Champion=championScore；Value=metricsScore；Control=paperProcessScore、competitionScore。
2. 再判断这个薄弱处具体缺什么证据：例如 Power 薄弱时，是最终决策人未接触，还是已知高层之间的分歧尚未厘清。选其中最影响赢单、且 SAM 最可能已知的信息。
3. 把缺口翻译成 SAM 能直接回答的问题。优先问“[人名]上次说了什么？原话是什么？”“你和[人名]上次见面，他对[话题]的反应是什么？”或“[人名]和[人名]的分歧，你理解的核心矛盾是什么？”。
4. 严禁把销售动作伪装成问题：不要要求 SAM 去问客户、转发原话、补充记录或填写字段；不要出现 MEDDPICC、3 Why、Win Formula 等术语。

输出约束：primaryQuestion 必须允许 SAM 用一段描述性文字直接回答，且答案能够被提取为对应事实候选。factSummary 只能复述支撑本题的 1-2 条已有事实，总计不超过 90 个中文字符，不能添加推断。数据不足时明确写“数据不足，暂不判断”。doNotAssume 最多列 2 项不得假定的客户意图或事实。严格按 JSON Schema 输出，不输出 JSON 外文字。`;
  const primaryController = new AbortController();
  const totalController = new AbortController();
  const primaryTimer = setTimeout(() => primaryController.abort(), AI_GUIDANCE_PRIMARY_TIMEOUT_MS);
  const totalTimer = setTimeout(() => {
    primaryController.abort();
    totalController.abort();
  }, AI_GUIDANCE_TOTAL_TIMEOUT_MS);
  let result;
  try {
    result = await runGuidanceModel("gpt-5", scope, prompt, primaryController.signal);
  } catch {
    try {
      // 交互层必须在有限窗口内给 SAM 下一问。仅在主模型未及时返回或不可用时
      // 使用同一事实契约与 Schema 的快速模型，不改变事实约束或确认写入边界。
      result = await runGuidanceModel("gpt-5-mini", scope, prompt, totalController.signal);
    } catch {
      return buildBaselineGuidance(scope);
    }
  } finally {
    clearTimeout(primaryTimer);
    clearTimeout(totalTimer);
  }
  const raw = getLLMTextContent(result.choices[0]?.message.content);
  if (!raw) return buildBaselineGuidance(scope);
  try { return JSON.parse(extractJSON(raw)); } catch { return buildBaselineGuidance(scope); }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  aiGuidance: router({
    health: protectedProcedure.query(({ ctx }) => ({
      status: "ok" as const,
      authenticated: Boolean(ctx.user?.id),
      route: "ai-guidance-v1" as const,
    })),
    customerGuide: protectedProcedure.input(z.object({ clientId: z.number() })).mutation(async ({ input }) => {
      const { client, contacts, meetings, signals, readiness } = await loadCustomerReadiness(input.clientId);
      const meddpicc = await getMeddpiccByClientId(input.clientId);
      const snapshot = buildCustomerGuidanceSnapshot({ client, contacts, meetings, signals, readiness, meddpicc });
      return generateAIGuidance("customer", snapshot);
    }),
    opportunityGuide: protectedProcedure.input(z.object({ clientId: z.number(), opportunityId: z.number() })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库暂不可用" });
      const { opportunities, opportunityMeddpicc, threeWhy, painMetrics, competitionMap } = await import("../drizzle/schema");
      const [opportunity] = await db.select().from(opportunities).where(eq(opportunities.id, input.opportunityId)).limit(1);
      if (!opportunity || opportunity.clientId !== input.clientId) throw new TRPCError({ code: "NOT_FOUND", message: "未找到商机" });
      const [meddpicc, why] = await Promise.all([
        db.select().from(opportunityMeddpicc).where(eq(opportunityMeddpicc.opportunityId, input.opportunityId)).limit(1),
        db.select().from(threeWhy).where(eq(threeWhy.opportunityId, input.opportunityId)).limit(1),
      ]);
      const [pains, competitions, dealContext] = await Promise.all([
        db.select().from(painMetrics).where(eq(painMetrics.opportunityId, input.opportunityId)),
        db.select().from(competitionMap).where(eq(competitionMap.opportunityId, input.opportunityId)),
        getDealDiagnosticContext(input.clientId, input.opportunityId),
      ]);
      const snapshot = `【商机作战室原始事实】\n商机：${opportunity.name}\n阶段：${opportunity.stage}\n金额：${opportunity.estimatedValue || "数据不足"}\n商机 MEDDPICC：${JSON.stringify(meddpicc[0] || {})}\n客户改变原因：${JSON.stringify(why[0] || {})}\n痛点与量化：${JSON.stringify(pains)}\n竞争事实：${JSON.stringify(competitions)}\n\n${dealContext}`;
      return generateAIGuidance("opportunity", snapshot);
    }),
    interpretAnswer: protectedProcedure.input(z.object({
      scope: z.enum(["customer", "opportunity"]), clientId: z.number(), opportunityId: z.number().optional(), question: z.string().min(3), answer: z.string().min(3).max(6000),
    })).mutation(async ({ input }) => {
      if (input.scope === "opportunity" && !input.opportunityId) throw new TRPCError({ code: "BAD_REQUEST", message: "商机引导需要关联商机。" });
      const prompt = `你正在帮助 SAM 回答一个 AI 主动提出的问题。请只从 SAM 的回答中提取明确、可回溯的客户事实；不能把 SAM 的观点、愿望或推测当作客户事实。\n\n当前场景：${input.scope === "customer" ? "客户经营与购买信号" : "商机赢单与客户证据"}\nAI 问题：${input.question}\nSAM 回答：${input.answer}\n\n判断规则：\n- 若回答包含明确客户侧人物、原话、决策接触、触发事件或商机证据，可返回一个待确认候选。\n- 客户经营场景只能候选 purchase_signal；商机场景只能候选 meddpicc。\n- 如果回答只是主观判断、计划或信息不充分，candidateTarget 必须为 none，message 明确写“数据不足，暂不判断”，evidence 留空。\n- evidence 必须以 SAM 回答里的事实为依据；不得添加未提及的信息。\n- nextQuestion 继续只问一个最关键的自然语言问题；不要出现 MEDDPICC、3 Why、Win Formula 等术语。\n- 请严格按 JSON Schema 返回，JSON 外不得输出文字。`;
      let result: Awaited<ReturnType<typeof invokeLLM>> | undefined;
      try {
        result = await invokeLLM({
          model: "gpt-5", useBuiltin: true, maxCompletionTokens: 1100, maxRetries: 0,
          messages: [{ role: "system", content: AI_ACTIVE_GUIDANCE_SYSTEM_PROMPT }, { role: "user", content: prompt }],
          response_format: { type: "json_schema", json_schema: { name: "ai_guidance_answer_interpretation", strict: true, schema: AI_ANSWER_INTERPRETATION_SCHEMA } },
        });
      } catch {
        return buildNoWriteAnswerInterpretation(input.question);
      }
      const raw = getLLMTextContent(result?.choices?.[0]?.message?.content);
      if (!raw) return buildNoWriteAnswerInterpretation(input.question);
      try { return JSON.parse(extractJSON(raw)); } catch { return buildNoWriteAnswerInterpretation(input.question); }
    }),
  }),

  // ── Clients ──────────────────────────────────────────────────────────────
  clients: router({
    list: publicProcedure.query(async ({ ctx }) => {
      // Resolve current email session user for role-based filtering
      const token = (() => { const h = ctx.req.headers?.cookie as string | undefined; if (!h) return undefined; const m = h.match(/(?:^|;\s*)email_session=([^;]+)/); return m?.[1]; })();
      const allClients = await getAllClientsWithVisitStats();
      if (!token) return allClients; // unauthenticated: return all (fallback)
      try {
        const db = await getDb();
        if (!db) return allClients;
        const { emailUsers, emailSessions } = await import('../drizzle/schema');
        const { eq, and, gt } = await import('drizzle-orm');
        const sessions = await db.select().from(emailSessions).where(
          and(eq(emailSessions.token, token), gt(emailSessions.expiresAt, new Date()))
        ).limit(1);
        if (sessions.length === 0) return allClients;
        const userRows = await db.select().from(emailUsers).where(eq(emailUsers.id, sessions[0].userId)).limit(1);
        if (userRows.length === 0) return allClients;
        const u = userRows[0];
        // AD and SA see all clients
        if (u.podRole === 'AD' || u.podRole === 'SA') return allClients;
        // SAM and RSM see only clients where they are assigned as SAM or RSM
        return allClients.filter(c =>
          (c as any).assignedSamId === u.id || (c as any).assignedRsmId === u.id
        );
      } catch {
        return allClients;
      }
    }),
    get: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const result = await getClientById(input.id);
      return result ?? null;
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      name: z.string().optional(),
      nameEn: z.string().optional(),
      industry: z.string().optional(),
      stage: z.string().optional(),
      notes: z.string().optional(),
      hookTopic: z.string().optional(),
      securityAngle: z.string().optional(),
      monitorKeywords: z.array(z.string()).optional(),
      priority: z.enum(["P0", "P1", "P2"]).optional(),
      plannedFirstVisitDate: z.number().nullable().optional(),
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      if (data.stage !== undefined) {
        await advanceCustomerStageByEvidence(id, data.stage as CustomerStage);
        const { stage: _stage, ...remaining } = data;
        if (Object.keys(remaining).length === 0) return { ok: true };
        invalidateClientsCache();
        return updateClient(id, remaining as any);
      }
      invalidateClientsCache();
      return updateClient(id, data as any);
    }),
    advanceStage: protectedProcedure.input(z.object({
      clientId: z.number(),
      stage: z.enum(["进门", "定痛", "找人"]),
    })).mutation(({ input }) => advanceCustomerStageByEvidence(input.clientId, input.stage)),
    create: protectedProcedure.input(z.object({
      name: z.string().min(1),
      nameEn: z.string().optional(),
      industry: z.string().optional(),
      priority: z.enum(["P0", "P1", "P2"]).default("P1"),
      stage: z.enum(["建图", "进门", "定痛", "找人"]).default("建图"),
      notes: z.string().optional(),
      hookTopic: z.string().optional(),
      securityAngle: z.string().optional(),
      monitorKeywords: z.array(z.string()).optional(),
    })).mutation(async ({ input }) => {
      const newId = await insertClient(input);
      invalidateClientsCache();
      return { id: newId };
    }),
    delete: publicProcedure.input(z.object({
      id: z.number(),
    })).mutation(async ({ input }) => {
      await deleteClientCascade(input.id);
      invalidateClientsCache();
      return { ok: true };
    }),
    importBatch: publicProcedure.input(z.object({
      clients: z.array(z.object({
        name: z.string().min(1),
        nameEn: z.string().optional(),
        industry: z.string().optional(),
        priority: z.enum(["P0", "P1", "P2"]).default("P1"),
        stage: z.enum(["建图", "进门", "定痛", "找人", "进入商机"]).default("建图"),
        hookTopic: z.string().optional(),
        securityAngle: z.string().optional(),
        monitorKeywords: z.array(z.string()).optional(),
      })),
    })).mutation(async ({ input }) => {
      const results: { name: string; id: number; ok: boolean; error?: string }[] = [];
      for (const c of input.clients) {
        try {
          const id = await insertClient(c);
          results.push({ name: c.name, id, ok: true });
        } catch (e: any) {
          results.push({ name: c.name, id: 0, ok: false, error: e?.message ?? 'Unknown error' });
        }
      }
      return { results, total: input.clients.length, succeeded: results.filter(r => r.ok).length };
    }),
    suggestHookAndAngle: publicProcedure.input(z.object({
      clientId: z.number(),
      clientName: z.string(),
      industry: z.string().optional(),
    })).mutation(async ({ input }) => {
      const [signals, meddpicc, productDocsList, clientData, recentMeetings] = await Promise.all([
        getSignalsByClientId(input.clientId),
        getMeddpiccByClientId(input.clientId),
        (async () => {
          const { getDb } = await import('./db.js');
          const db = await getDb();
          if (!db) return [] as { title: string; productLine: string | null; description: string | null }[];
          const { productDocs } = await import('../drizzle/schema');
          return db.select({ title: productDocs.title, productLine: productDocs.productLine, description: productDocs.description }).from(productDocs).limit(10);
        })(),
        getClientById(input.clientId),
        getMeetingsByClientId(input.clientId),
      ]);
      const meddpiccContext = meddpicc ? (() => {
        const dims = [
          { name: 'M(可量化价值)', score: meddpicc.metricsScore },
          { name: 'E(预算决策人)', score: meddpicc.economicBuyerScore },
          { name: 'D1(决策标准)', score: meddpicc.decisionCriteriaScore },
          { name: 'D2(决策流程)', score: meddpicc.decisionProcessScore },
          { name: 'P(合同流程)', score: meddpicc.paperProcessScore },
          { name: 'I（痛点识别）', score: meddpicc.implicatePainScore },
          { name: 'C1(Champion)', score: meddpicc.championScore },
          { name: 'C2(竞争态势)', score: meddpicc.competitionScore },
        ].sort((a, b) => a.score - b.score);
        return dims.slice(0, 3).map(d => d.name + ': ' + d.score + '分').join('、');
      })() : '暂无数据';
      // 功能8修正：只取最近7天内的情报信号（保证时效性）
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const recentSignals7d = signals.filter((s: any) => {
        const ts = s.createdAt ? new Date(s.createdAt).getTime() : 0;
        return ts > sevenDaysAgo;
      });
      // 同行业兜底：如果该客户7天内信号不足3条，用同行业其他客户近期信号补足
      let signalsContext = '';
      if (recentSignals7d.length >= 3) {
        signalsContext = recentSignals7d.slice(0, 3).map((s: any) =>
          '[' + s.signalType + '] ' + (s.rawSignal || s.aiInterpretation || '')
        ).join('\n');
      } else {
        const ownSignalLines = recentSignals7d.map((s: any) =>
          '[' + s.signalType + '] ' + (s.rawSignal || s.aiInterpretation || '')
        );
        const industrySignals: string[] = [];
        if (input.industry) {
          try {
            const allClients = await getAllClients();
            const sameIndustryClientIds = allClients
              .filter((c: any) => c.industry === input.industry && c.id !== input.clientId)
              .map((c: any) => c.id);
            if (sameIndustryClientIds.length > 0) {
              const allRecentSignals = await getAllRecentSignals();
              const industryRecentSignals = allRecentSignals.filter((s: any) => {
                const ts = s.createdAt ? new Date(s.createdAt).getTime() : 0;
                return sameIndustryClientIds.includes(s.clientId) && ts > sevenDaysAgo;
              });
              industryRecentSignals.slice(0, 3 - ownSignalLines.length).forEach((s: any) => {
                industrySignals.push('[同行业参考·' + s.signalType + '] ' + (s.rawSignal || s.aiInterpretation || ''));
              });
            }
          } catch { /* 兜底失败不影响主流程 */ }
        }
        const combined = [...ownSignalLines, ...industrySignals];
        signalsContext = combined.length > 0
          ? combined.join('\n')
          : '最近7天暂无情报信号（含同行业），建议手动添加行业动态';
      }
      // 同行业成功案例注入
      let caseContext = '暂无匹配案例（可在武器库→成功案例库中添加）';
      let hasUnverifiedCases = false;
      if (input.industry) {
        try {
          const cases = await getCaseStudiesByIndustry(input.industry);
          if (cases.length > 0) {
            const topCases = cases.slice(0, 2);
            hasUnverifiedCases = topCases.some((c: any) =>
              (c.quantifiedResult && c.quantifiedResult.includes('[行业基准估算')) ||
              (c.roiHighlight && c.roiHighlight.includes('[行业基准估算'))
            );
            caseContext = topCases.map((c: any) => {
              const isUnverified = (c.quantifiedResult && c.quantifiedResult.includes('[行业基准估算')) || (c.roiHighlight && c.roiHighlight.includes('[行业基准估算'));
              return `【${c.clientAlias || (c.isConfidential ? '保密客户' : c.title)}·${c.industry}${isUnverified ? '·⚠️数据待核实' : ''}】\n痛点：${c.painPoint}\n方案：${c.solution}\n量化结果：${c.quantifiedResult || '未填写'}${c.roiHighlight ? '\nROI：' + c.roiHighlight : ''}`;
            }).join('\n---\n');
          }
        } catch { /* 不影响主流程 */ }
      }
      const docsContext = productDocsList.length > 0
        ? productDocsList.map((d: any) => '[' + d.productLine + '] ' + d.title + (d.description ? ': ' + d.description.slice(0, 80) : '')).join('\n')
        : '暂无上传产品文档（可在武器库中上传）';
      // 最近一次拜访摘要
      const sortedVisits = recentMeetings ? [...recentMeetings].sort((a: any, b: any) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime()) : [];
      const lastVisit = sortedVisits[0];
      const lastVisitCtx = lastVisit
        ? `最近拜访（${new Date((lastVisit as any).meetingDate).toLocaleDateString('zh-CN')}）：${((lastVisit as any).aiMinutes || (lastVisit as any).keyPoints || '').slice(0, 200)}`
        : '暂无拜访记录';
      const clientStage = (clientData as any)?.stage || '未知阶段';
      const prompt = `请根据以下信息，为销售团队建议最佳的「敲门砖话题」和「安全切入点」，用于拜访 ${input.clientName}（${input.industry || '企业'}）的高层。

【客户当前阶段】
${clientStage}

【最近一次拜访摘要】
${lastVisitCtx}

【最新情报信号（近7天，共${recentSignals7d.length}条）】
${signalsContext}

【MEDDPICC薄弱维度（分数最低3项）】
${meddpiccContext}

【武器库产品文档（已有方案）】
${docsContext}

【同行业成功案例参考（优先引用具体量化数字）】
${caseContext}

${hasUnverifiedCases ? '⚠️ 注意：部分案例数据标注了「⚠️数据待核实」，表示该数字来自行业基准估算，尚未经客户确认。如果在建议中引用了这类数据，必须在 reasoning 字段中明确注明"（数据来源：行业基准估算，建议使用前向产线核实）"。' : ''}

请输出JSON格式（不要有其他内容）：
{
  "hookTopic": "具体的敲门砖话题（1-2句，要有具体事件/数据/趋势作为切入，不超过50字）",
  "securityAngle": "具体的安全切入点（1-2句，结合客户痛点和我们的产品能力，不超过50字）",
  "reasoning": "建议理由（2-3句，说明为什么选这个敲门砖和切入点，引用了哪些情报或产品能力；如引用了待核实数据，必须注明来源）"
}`;
      // Inject Account Map diagnostic context if available
      const accountDiag = await getAccountDiagnosticContext(input.clientId);
      const enrichedPrompt = prompt + accountDiag;
      const result = await invokeLLM({
        model: 'gpt-4o-mini',
        messages: [{ role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT }, { role: "user", content: enrichedPrompt }],
      });
      const textContent = result.choices[0]?.message?.content;
      const text = typeof textContent === 'string' ? textContent : JSON.stringify(textContent);
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
        return { hookTopic: parsed.hookTopic || '', securityAngle: parsed.securityAngle || '', reasoning: parsed.reasoning || '' };
      } catch {
        return { hookTopic: '', securityAngle: '', reasoning: text };
      }
    }),

    // 分配负责 SAM（客户归属）
    assignSam: publicProcedure.input(z.object({
      clientId: z.number(),
      samId: z.number().nullable(),
      samName: z.string().nullable(),
    })).mutation(async ({ input }) => {
      invalidateClientsCache();
      await updateClient(input.clientId, {
        assignedSamId: input.samId ?? undefined,
        assignedSamName: input.samName ?? undefined,
      } as any);
      return { ok: true };
    }),

    // 获取所有活跃用户列表（用于 SAM 分配下拉）
    listSamUsers: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const { emailUsers } = await import('../drizzle/schema');
      const { eq: eqFn } = await import('drizzle-orm');
      return db.select({
        id: emailUsers.id,
        name: emailUsers.name,
        email: emailUsers.email,
        podRole: emailUsers.podRole,
      }).from(emailUsers).where(eqFn(emailUsers.isActive, true));
    }),

    // 分配负责 RSM（属地销售）
    assignRsm: publicProcedure.input(z.object({
      clientId: z.number(),
      rsmId: z.number().nullable(),
      rsmName: z.string().nullable(),
    })).mutation(async ({ input }) => {
      invalidateClientsCache();
      await updateClient(input.clientId, {
        assignedRsmId: input.rsmId ?? undefined,
        assignedRsmName: input.rsmName ?? undefined,
      } as any);
      return { ok: true };
    }),
  }),

  // ── MEDDPICC ─────────────────────────────────────────────────────────────
  meddpicc: router({
    get: publicProcedure.input(z.object({ clientId: z.number() })).query(async ({ input }) => {
      const result = await getMeddpiccByClientId(input.clientId);
      return result ?? null;
    }),
    update: protectedProcedure.input(z.object({
      clientId: z.number(),
      metricsScore: z.number().min(0).max(100).optional(),
      metricsNotes: z.string().optional(),
      economicBuyerScore: z.number().min(0).max(100).optional(),
      economicBuyerName: z.string().optional(),
      economicBuyerNotes: z.string().optional(),
      decisionCriteriaScore: z.number().min(0).max(100).optional(),
      decisionCriteriaNotes: z.string().optional(),
      decisionProcessScore: z.number().min(0).max(100).optional(),
      decisionProcessNotes: z.string().optional(),
      paperProcessScore: z.number().min(0).max(100).optional(),
      paperProcessNotes: z.string().optional(),
      implicatePainScore: z.number().min(0).max(100).optional(),
      implicatePainNotes: z.string().optional(),
      championScore: z.number().min(0).max(100).optional(),
      championName: z.string().optional(),
      championNotes: z.string().optional(),
      competitionScore: z.number().min(0).max(100).optional(),
      competitionNotes: z.string().optional(),
    })).mutation(async ({ input }) => {
      const { clientId, ...data } = input;
      await upsertMeddpicc(clientId, data as any);
      // Save snapshot for trend chart (log errors but don't fail the update)
      const updated = await getMeddpiccByClientId(clientId);
      if (updated) {
        await saveMeddpiccSnapshot(clientId, updated).catch((err) => {
          console.error("[MEDDPICC] Failed to save snapshot:", err);
        });
      }
      // AI Evidence Challenge: when Champion or EB ≥75, verify with LLM
      let aiChallenge: string | null = null;
      const champScore = Number(data.championScore ?? 0);
      const ebScore = Number(data.economicBuyerScore ?? 0);
      if (champScore >= 75 || ebScore >= 75) {
        try {
          const meetings = await getMeetingsByClientId(clientId);
          const recentSummary = meetings.slice(0, 3).map((m: any) => (m.aiMinutes || m.keyPoints || "").slice(0, 200)).join("\n") || "暂无拜访记录";
          const dimension = champScore >= 75 ? "Champion" : "Economic Buyer";
          const score = champScore >= 75 ? champScore : ebScore;
          const evidence = champScore >= 75 ? (data.championNotes || "未填写") : (data.economicBuyerNotes || "未填写");
          const challengeRes = await invokeLLM({
            model: "gpt-5-mini",
            messages: [
              { role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT },
              { role: "user", content: `${dimension}评分被录入为${score}/100。\nChampion的三个验证条件：(1)影响力（能推动EB）(2)个人动机（为什么他要帮我们）(3)实际行动（做了什么具体推动行为）。\n最近3次拜访摘要：${recentSummary}\n已录入的评分依据：${evidence}\n\n请在20字内判断：这个评分有足够的事实支撑吗？如果没有，指出哪个条件缺失。只输出判断结论，不解释框架。` }
            ],
            maxCompletionTokens: 100,
          });
          aiChallenge = String(challengeRes.choices?.[0]?.message?.content || "").trim() || null;
        } catch (e) {
          console.warn("[Command2] AI evidence challenge failed:", e);
        }
      }
      // Event-driven: non-blocking refresh after MEDDPICC score change
      setImmediate(() => triggerSingleClientRefresh(clientId));
      return { aiChallenge };
    }),
    history: publicProcedure.input(z.object({ clientId: z.number(), weeks: z.number().default(4) })).query(async ({ input }) => {
      return getMeddpiccHistory(input.clientId, input.weeks);
    }),
    getAll: publicProcedure.query(async () => {
      const allClients = await getAllClients();
      const results = await Promise.all(allClients.map(async (c) => {
        const m = await getMeddpiccByClientId(c.id);
        return { clientId: c.id, clientName: c.name, clientStage: c.stage, meddpicc: m ?? null };
      }));
      return results;
    }),
    // Append a log entry for a dimension (score + note + authorRole)
    addLog: publicProcedure.input(z.object({
      clientId: z.number(),
      dimension: z.string(),
      score: z.number().min(0).max(100),
      note: z.string().min(1),
      authorRole: z.enum(["AD", "SAM", "SA", "RSM"]).default("SAM"),
    })).mutation(async ({ input }) => {
      const { getDb } = await import('./db.js');
      const { meddpiccLogs } = await import('../drizzle/schema.js');
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      await db.insert(meddpiccLogs).values({
        clientId: input.clientId,
        dimension: input.dimension,
        score: input.score,
        note: input.note,
        authorRole: input.authorRole,
      });
      return { ok: true };
    }),
    // Get all logs for a client (optionally filtered by dimension)
    getLogs: publicProcedure.input(z.object({
      clientId: z.number(),
      dimension: z.string().optional(),
    })).query(async ({ input }) => {
      const { getDb } = await import('./db.js');
      const { meddpiccLogs } = await import('../drizzle/schema.js');
      const { eq, and, desc } = await import('drizzle-orm');
      const db = await getDb();
      if (!db) return [];
      const conditions = input.dimension
        ? and(eq(meddpiccLogs.clientId, input.clientId), eq(meddpiccLogs.dimension, input.dimension))
        : eq(meddpiccLogs.clientId, input.clientId);
      return db.select().from(meddpiccLogs).where(conditions).orderBy(desc(meddpiccLogs.createdAt)).limit(100);
    }),
  }),

  // ── Customer Purchase Signals ────────────────────────────────────────────
  purchaseSignals: router({
    listByClient: publicProcedure.input(z.object({ clientId: z.number() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const { customerPurchaseSignals } = await import("../drizzle/schema.js");
      const { desc, eq } = await import("drizzle-orm");
      return db.select().from(customerPurchaseSignals)
        .where(eq(customerPurchaseSignals.clientId, input.clientId))
        .orderBy(desc(customerPurchaseSignals.occurredAt), desc(customerPurchaseSignals.createdAt));
    }),
    create: protectedProcedure.input(z.object({
      clientId: z.number(),
      signalType: z.enum(["intent_subject", "decision_chain", "trigger_event"]),
      subjectName: z.string().trim().min(1).max(150),
      subjectContactId: z.number().nullable().optional(),
      occurredAt: z.string().datetime(),
      statement: z.string().trim().min(8).max(5000),
      sourceType: z.enum(["meeting", "customer_message", "customer_email", "intelligence", "other_evidence"]),
      sourceMeetingId: z.number().optional(),
      sourceReference: z.string().trim().max(5000).optional(),
    })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库暂不可用" });
      const { customerPurchaseSignals, keyContacts } = await import("../drizzle/schema.js");
      const { and, eq } = await import("drizzle-orm");
      let subjectName = input.subjectName;
      if (input.signalType === "decision_chain") {
        if (!input.subjectContactId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "决策链信号必须从关键人图谱选择已入库联系人。" });
        }
        const [contact] = await db.select().from(keyContacts).where(and(
          eq(keyContacts.id, input.subjectContactId),
          eq(keyContacts.clientId, input.clientId),
        )).limit(1);
        if (!contact) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "所选关键人不属于该客户。" });
        }
        subjectName = contact.name;
      }
      const [result] = await db.insert(customerPurchaseSignals).values({
        ...input,
        subjectName,
        occurredAt: new Date(input.occurredAt),
        createdBy: ctx.user.name || ctx.user.email || "已登录用户",
      });
      // Event-driven: non-blocking refresh after new purchase signal
      setImmediate(() => triggerSingleClientRefresh(input.clientId));
      return { id: (result as any).insertId };
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库暂不可用" });
      const { customerPurchaseSignals } = await import("../drizzle/schema.js");
      const { eq } = await import("drizzle-orm");
      await db.delete(customerPurchaseSignals).where(eq(customerPurchaseSignals.id, input.id));
      return { ok: true };
    }),
  }),

  // ── Intelligence Signals ──────────────────────────────────────────────────
  intelligence: router({
    listByClient: publicProcedure.input(z.object({ clientId: z.number() })).query(({ input }) =>
      getSignalsByClientId(input.clientId)
    ),
    listAll: publicProcedure.query(() => getAllRecentSignals()),
    analyze: publicProcedure.input(z.object({
      clientId: z.number(),
      clientName: z.string(),
      rawSignal: z.string(),
      industry: z.string().optional(),
      opportunityId: z.number().optional().nullable(),
    })).mutation(async ({ input }) => {
      // AI analyze the signal
      const prompt = `
客户：${input.clientName}（${input.industry || "科技企业"}）
原始信号：${input.rawSignal}

请分析这条情报信号，返回JSON格式：
{
  "signalType": "人事变动|业务扩张|合规事件|合规政策|招聘信号|技术公告|其他",
  "urgency": "高|中|低",
  "interpretation": "对这条信号的深度解读（2-3句话，结合客户背景分析其业务含义）",
  "recommendation": "基于此信号，销售团队应立即采取的具体触达行动（包括：触达对象、触达理由、建议话术要点）"
}`;

      const res = await invokeLLM({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT }, { role: "user", content: prompt }],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "signal_analysis",
            strict: true,
            schema: {
              type: "object",
              properties: {
                signalType: { type: "string" },
                urgency: { type: "string" },
                interpretation: { type: "string" },
                recommendation: { type: "string" },
              },
              required: ["signalType", "urgency", "interpretation", "recommendation"],
              additionalProperties: false,
            },
          },
        },
      });

      const parsed = JSON.parse(extractJSON(String(res.choices[0].message.content || "{}")));
      const signalId = await insertSignal({
        clientId: input.clientId,
        rawSignal: input.rawSignal,
        signalType: parsed.signalType as any,
        aiInterpretation: parsed.interpretation,
        aiRecommendation: parsed.recommendation,
        urgency: parsed.urgency as any,
        isProcessed: true,
        opportunityId: input.opportunityId ?? undefined,
      });
      return { id: signalId, ...parsed };
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await deleteSignal(input.id);
      return { success: true };
    }),
    deleteBatch: protectedProcedure.input(z.object({ ids: z.array(z.number()) })).mutation(async ({ input }) => {
      await deleteSignalBatch(input.ids);
      return { success: true, deleted: input.ids.length };
    }),

    // P1e: 情报自动关联推送 — 规则初筛 + AI精判双层架构
    autoMatch: protectedProcedure.input(z.object({
      signalId: z.number(),
    })).mutation(async ({ input }) => {
      // 获取信号详情
      const db = await getDb();
      const { intelligenceSignals } = await import('../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      const signalRows = await db!.select().from(intelligenceSignals).where(eq(intelligenceSignals.id, input.signalId)).limit(1);
      const signal = signalRows[0];
      if (!signal) throw new Error("信号不存在");

      // 获取所有活跃客户（规则初筛）
      const allClients = await getAllClients();
      const activeClients = allClients.filter((c: any) => !c.isTest);

      // 规则初筛：关键词匹配（客户名称/行业/监控关键词）
      const signalText = (signal.rawSignal + " " + (signal.aiInterpretation || "")).toLowerCase();
      const candidates = activeClients.filter((c: any) => {
        const clientName = c.name.toLowerCase();
        const clientNameEn = (c.nameEn || "").toLowerCase();
        const industry = (c.industry || "").toLowerCase();
        const keywords = (c.monitorKeywords || []).map((k: string) => k.toLowerCase());
        
        return (
          signalText.includes(clientName) ||
          (clientNameEn && signalText.includes(clientNameEn)) ||
          keywords.some((k: string) => k.length > 2 && signalText.includes(k)) ||
          (industry && signalText.includes(industry))
        );
      });

      if (candidates.length === 0) {
        return { 
          content: "规则初筛未找到匹配客户。\n\n**信号摘要：**\n" + signal.rawSignal.slice(0, 200) + "\n\n**建议：** 如果此信号与某个客户相关，请手动关联。",
          matches: [] 
        };
      }

      // AI精判：对候选客户进行相关性评分
      const candidateList = candidates.slice(0, 10).map((c: any) => 
        `- ${c.name}（${c.industry || "未知行业"}，当前阶段：${c.stage}）`
      ).join("\n");

      const prompt = `
情报信号：
类型：${signal.signalType}
紧急度：${signal.urgency}
内容：${signal.rawSignal}
${signal.aiInterpretation ? "AI分析：" + signal.aiInterpretation.slice(0, 300) : ""}

候选关联客户（已通过关键词初筛）：
${candidateList}

请对每个候选客户进行相关性评分（0-100分），并说明：
1. 为什么这条情报与该客户相关
2. 这条情报对该客户的销售推进有什么价值（进门话题/定痛依据/竞争预警/商机加速）
3. 建议的行动（发给哪个角色/用什么角度引用）

输出格式（每个客户一段）：

**[客户名]** 相关性：X分
- 关联理由：
- 销售价值：
- 建议行动：

最后给出：**最高优先推送客户：** [客户名]，理由：[一句话]`;

      const res = await invokeLLM({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT }, { role: "user", content: prompt }],
      });
      const analysisContent = String(res.choices[0].message.content || "");

      return { 
        content: analysisContent,
        matches: candidates.map((c: any) => ({ id: c.id, name: c.name, stage: c.stage })),
        signalSummary: signal.rawSignal.slice(0, 150)
      };
    }),
  }),

  // ── RSS Sources Management ─────────────────────────────────────────────
  rss: router({
    // List all RSS sources
    listSources: publicProcedure.query(async () => {
      const db = await getDb();
      const { rssSources } = await import('../drizzle/schema');
      return db!.select().from(rssSources).orderBy(rssSources.createdAt);
    }),
    // Add a new RSS source
    addSource: protectedProcedure.input(z.object({
      name: z.string().min(1),
      url: z.string().url(),
      description: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })).mutation(async ({ input }) => {
      const db = await getDb();
      const { rssSources } = await import('../drizzle/schema');
      const [result] = await db!.insert(rssSources).values({
        name: input.name,
        url: input.url,
        description: input.description,
        tags: input.tags || [],
        isActive: true,
      });
      return { id: (result as any).insertId };
    }),
    // Toggle RSS source active/inactive
    toggleSource: protectedProcedure.input(z.object({
      id: z.number(),
      isActive: z.boolean(),
    })).mutation(async ({ input }) => {
      const db = await getDb();
      const { rssSources } = await import('../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      await db!.update(rssSources).set({ isActive: input.isActive }).where(eq(rssSources.id, input.id));
      return { success: true };
    }),
    // Delete RSS source
    deleteSource: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const db = await getDb();
      const { rssSources } = await import('../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      await db!.delete(rssSources).where(eq(rssSources.id, input.id));
      return { success: true };
    }),
    // Fetch RSS news for a client (Google News default + custom sources)
    fetchNews: publicProcedure.input(z.object({
      clientName: z.string(),
      clientNameEn: z.string().optional(),
      keywords: z.array(z.string()).optional(),
      limit: z.number().default(20),
    })).query(async ({ input }) => {
      const fetch = (await import('node-fetch')).default;
      const { XMLParser } = await import('fast-xml-parser');
      const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

      const results: Array<{
        title: string;
        link: string;
        pubDate: string;
        description: string;
        source: string;
        sourceType: 'google_news' | 'custom';
      }> = [];

      // 1. Google News RSS (default, free)
      const searchTerms = [input.clientName];
      if (input.clientNameEn) searchTerms.push(input.clientNameEn);
      if (input.keywords?.length) searchTerms.push(...input.keywords.slice(0, 2));
      const query = searchTerms.join(' ');
      const googleNewsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`;

      try {
        const res = await fetch(googleNewsUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RSS Reader)' },
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          const xml = await res.text();
          const parsed = parser.parse(xml);
          const items = parsed?.rss?.channel?.item || [];
          const arr = Array.isArray(items) ? items : [items];
          arr.slice(0, 15).forEach((item: any) => {
            results.push({
              title: String(item.title || '').replace(/<[^>]+>/g, '').replace(/\s*-\s*[^-]+$/, ''),
              link: String(item.link || item.guid || ''),
              pubDate: String(item.pubDate || ''),
              description: String(item.description || '').replace(/<[^>]+>/g, '').slice(0, 200),
              source: 'Google News',
              sourceType: 'google_news',
            });
          });
        }
      } catch (e) {
        // Google News failed, continue with custom sources
      }

      // 2. Custom RSS sources (active ones)
      try {
        const db = await getDb();
        const { rssSources } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        const customSources = await db!.select().from(rssSources).where(eq(rssSources.isActive, true));

        for (const source of customSources) {
          // 跳过合规政策类RSS源（这类源不含客户专属新闻，应在合规政策专区单独展示）
          const tags = (source.tags as string[]) || [];
          if (tags.includes('合规政策')) continue;

          try {
            const res = await fetch(source.url, {
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RSS Reader)' },
              signal: AbortSignal.timeout(5000),
            });
            if (!res.ok) continue;
            const xml = await res.text();
            const parsed = parser.parse(xml);
            const items = parsed?.rss?.channel?.item || parsed?.feed?.entry || [];
            const arr = Array.isArray(items) ? items : [items];
            // Filter by client name if possible
            const filtered = arr.filter((item: any) => {
              const text = `${item.title || ''} ${item.description || item.summary || ''}`.toLowerCase();
              return text.includes(input.clientName.toLowerCase()) ||
                (input.clientNameEn && text.includes(input.clientNameEn.toLowerCase()));
            });
            const toUse = filtered.length > 0 ? filtered : arr.slice(0, 5);
            toUse.slice(0, 8).forEach((item: any) => {
              results.push({
                title: String(item.title || '').replace(/<[^>]+>/g, ''),
                link: String(item.link?.['@_href'] || item.link || item.guid || ''),
                pubDate: String(item.pubDate || item.updated || item.published || ''),
                description: String(item.description || item.summary || '').replace(/<[^>]+>/g, '').slice(0, 200),
                source: source.name,
                sourceType: 'custom',
              });
            });
          } catch (e) {
            // Skip failed custom source
          }
        }
      } catch (e) {
        // Skip custom sources on error
      }

      // Sort by date, newest first
      results.sort((a, b) => {
        const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
        const db2 = b.pubDate ? new Date(b.pubDate).getTime() : 0;
        return db2 - da;
      });

      return results.slice(0, input.limit);
    }),
    // Fetch compliance policy RSS news (合规政策类RSS，不过滤客户名)
    fetchComplianceNews: publicProcedure.input(z.object({
      limit: z.number().default(20),
    })).query(async ({ input }) => {
      const fetch = (await import('node-fetch')).default;
      const { XMLParser } = await import('fast-xml-parser');
      const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
      const db = await getDb();
      const { rssSources } = await import('../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      const allSources = await db!.select().from(rssSources).where(eq(rssSources.isActive, true));
      const complianceSources = allSources.filter((s: any) => {
        const tags = (s.tags as string[]) || [];
        return tags.includes('合规政策');
      });
      const compResults: Array<{
        title: string; link: string; pubDate: string; description: string; source: string;
      }> = [];
      for (const source of complianceSources) {
        try {
          const res = await fetch(source.url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RSS Reader)' },
            signal: AbortSignal.timeout(6000),
          });
          if (!res.ok) continue;
          const xml = await res.text();
          const parsed = parser.parse(xml);
          const items = parsed?.rss?.channel?.item || parsed?.feed?.entry || [];
          const arr = Array.isArray(items) ? items : [items];
          arr.slice(0, 5).forEach((item: any) => {
            compResults.push({
              title: String(item.title || '').replace(/<[^>]+>/g, ''),
              link: String(item.link?.['@_href'] || item.link || item.guid || ''),
              pubDate: String(item.pubDate || item.updated || item.published || ''),
              description: String(item.description || item.summary || '').replace(/<[^>]+>/g, '').slice(0, 200),
              source: source.name,
            });
          });
        } catch (e) { /* skip */ }
      }
      compResults.sort((a, b) => {
        const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
        const db2 = b.pubDate ? new Date(b.pubDate).getTime() : 0;
        return db2 - da;
      });
      return compResults.slice(0, input.limit);
    }),
    // Mark signal as processed (已处理)
    markProcessed: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const db = await getDb();
      const { intelligenceSignals } = await import('../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      await db!.update(intelligenceSignals).set({ isProcessed: true }).where(eq(intelligenceSignals.id, input.id));
      return { success: true };
    }),
    // Ignore signal (标记忽略)
    ignoreSignal: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const db = await getDb();
      const { intelligenceSignals } = await import('../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      await db!.update(intelligenceSignals).set({ isProcessed: true, urgency: 'ignored' as any }).where(eq(intelligenceSignals.id, input.id));
      return { success: true };
    }),
  }),

  // ── Action Items ──────────────────────────────────────────────────────────
  actions: router({
    listByClient: publicProcedure.input(z.object({ clientId: z.number() })).query(({ input }) =>
      getActionsByClientId(input.clientId)
    ),
    listByRole: publicProcedure.input(z.object({ role: z.enum(["AD", "SAM", "SA", "RSM"]) })).query(({ input }) =>
      getActionsByRole(input.role)
    ),
    generate: publicProcedure.input(z.object({
      clientId: z.number(),
      clientName: z.string(),
      industry: z.string().optional(),
      stage: z.string(),
      hookTopic: z.string().optional(),
      securityAngle: z.string().optional(),
      meddpicc: z.object({
        metricsScore: z.number(),
        economicBuyerScore: z.number(),
        economicBuyerName: z.string().nullable().optional(),
        decisionCriteriaScore: z.number(),
        decisionProcessScore: z.number(),
        implicatePainScore: z.number(),
        championScore: z.number(),
        championName: z.string().nullable().optional(),
        competitionScore: z.number(),
      }),
      recentSignals: z.array(z.object({
        signalType: z.string(),
        content: z.string().optional(),
        aiInterpretation: z.string().nullable().optional(),
      })).optional(),
      visitCount: z.number().optional(),
      lastVisitDate: z.string().nullable().optional(),
    })).mutation(async ({ input }) => {
      const meddpiccSummary = `
- M(可量化价值): ${input.meddpicc.metricsScore}/100
- E(预算决策人): ${input.meddpicc.economicBuyerScore}/100, 已识别: ${input.meddpicc.economicBuyerName || "未知"}
- D(决策标准): ${input.meddpicc.decisionCriteriaScore}/100
- D(决策流程): ${input.meddpicc.decisionProcessScore}/100
- I（痛点识别）: ${input.meddpicc.implicatePainScore}/100
- C(内部Champion): ${input.meddpicc.championScore}/100, 已识别: ${input.meddpicc.championName || "未找到"}
- C(竞争态势): ${input.meddpicc.competitionScore}/100`;

      const signalsSummary = input.recentSignals?.length
        ? input.recentSignals.map((s, i) => {
            const parts = [`[情报${i+1}][${s.signalType}]`];
            if (s.content) parts.push(`原文：${s.content}`);
            if (s.aiInterpretation) parts.push(`AI解读：${s.aiInterpretation}`);
            return parts.join(' | ');
          }).join("\n")
        : "暂无最新信号";

      const prompt = `
客户：${input.clientName}（${input.industry || "科技企业"}）
当前销售阶段：${input.stage}
敲门砖话题：${input.hookTopic || "待定"}
安全切入点：${input.securityAngle || "待定"}

MEDDPICC完成度：
${meddpiccSummary}

最新情报信号：
${signalsSummary}

销售团队角色说明：
- AD（Account Director）：负责C-Level关系建立和顶层破冰
- SAM（Strategic Account Manager）：负责日常商机推进和MEDDPICC管理
- SA（Solution Architect）：负责技术方案设计和POC执行
- RSM（Regional Sales Manager / 省办）：负责属地化招投标支持、商务渠道打通和属地关系协同

请基于以上信息，为四角色销售团队生成今日/本周优先行动清单（4-6条），每条行动必须非常具体可执行，且四个角色都应有对应的行动分配。
返回JSON格式：
{
  "actions": [
    {
      "title": "行动标题（简洁，10字以内）",
      "objective": "行动目标（具体说明要达成什么结果）",
      "suggestedScript": "建议话术（可直接使用的开场白或关键话术，50-100字）",
      "responsibleRole": "AD|SAM|SA|RSM",
      "priority": "高|中|低",
      "timeframe": "今日|本周|本月"
    }
  ]
}`;

      const res = await invokeLLM({
        model: "gpt-4o",
        messages: [{ role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT }, { role: "user", content: prompt }],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "action_list",
            strict: true,
            schema: {
              type: "object",
              properties: {
                actions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      objective: { type: "string" },
                      suggestedScript: { type: "string" },
                      responsibleRole: { type: "string" },
                      priority: { type: "string" },
                      timeframe: { type: "string" },
                    },
                    required: ["title", "objective", "suggestedScript", "responsibleRole", "priority", "timeframe"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["actions"],
              additionalProperties: false,
            },
          },
        },
      });

      const parsed = JSON.parse(extractJSON(String(res.choices[0].message.content || '{"actions":[]}')));

      // Auto-append "安排拜访" action if client has never been visited or last visit > 30 days ago
      const visitCount = input.visitCount ?? 0;
      let needsVisitAction = false;
      let visitActionNote = '';
      if (visitCount === 0) {
        needsVisitAction = true;
        visitActionNote = '该客户从未建立拜访记录，建议尽快安排首次拜访以推进关系建立';
      } else if (input.lastVisitDate) {
        const daysSince = Math.floor((Date.now() - new Date(input.lastVisitDate).getTime()) / 86400000);
        if (daysSince > 30) {
          needsVisitAction = true;
          visitActionNote = `距上次拜访已超过 ${daysSince} 天，建议尽快安排拜访以维持关系热度`;
        }
      }
      if (needsVisitAction) {
        parsed.actions.push({
          title: '安排客户拜访',
          objective: visitActionNote,
          suggestedScript: `您好，我是亚信安全的 ${input.stage === '建图' ? 'SAM' : 'SAM'}，最近在关注贵司在网络安全方面的布局，希望安排一次面对面交流，分享一些行业最新实践，请问本周或下周是否有时间方便？`,
          responsibleRole: 'SAM',
          priority: visitCount === 0 ? '高' : '中',
          timeframe: '本周',
        });
      }

      const toInsert = parsed.actions.map((a: any) => ({
        clientId: input.clientId,
        title: a.title,
        objective: a.objective,
        suggestedScript: a.suggestedScript,
        responsibleRole: a.responsibleRole as "AD" | "SAM" | "SA" | "RSM",
        priority: a.priority as "高" | "中" | "低",
        timeframe: a.timeframe as "今日" | "本周" | "本月",
        aiGenerated: true,
      }));
      await insertActions(toInsert);
      return parsed.actions;
    }),
    complete: publicProcedure.input(z.object({ id: z.number() })).mutation(({ input }) =>
      completeAction(input.id)
    ),
    // Adopt a single action: push to POD task queue for the responsible role
    adoptOne: publicProcedure.input(z.object({
      actionId: z.number(),
      clientId: z.number(),
      clientName: z.string(),
    })).mutation(async ({ input }) => {
      const { getDb } = await import('./db.js');
      const { actionItems: aiTable, podTasks: ptTable } = await import('../drizzle/schema.js');
      const { eq } = await import('drizzle-orm');
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const [action] = await db.select().from(aiTable).where(eq(aiTable.id, input.actionId)).limit(1);
      if (!action) throw new Error('Action not found');
      // Insert into pod_tasks with sourceActionId for later linkback
      await db.insert(ptTable).values({
        clientId: input.clientId,
        assignedRole: action.responsibleRole as 'AD' | 'SAM' | 'SA' | 'RSM',
        title: `[${input.clientName}] ${action.title}`,
        description: action.objective || undefined,
        priority: (action.priority as '高' | '中' | '低') || '中',
        dueDate: action.timeframe === '今日' ? new Date(Date.now() + 86400000)
          : action.timeframe === '本周' ? new Date(Date.now() + 7 * 86400000)
          : new Date(Date.now() + 30 * 86400000),
        sourceActionId: action.id,
      });
      return { ok: true };
    }),
    // One-click adopt all: persist adopted actions as POD tasks for each role
    deleteOne: protectedProcedure.input(z.object({ id: z.number() })).mutation(({ input }) =>
      deleteActionById(input.id)
    ),
    clearPending: protectedProcedure.input(z.object({ clientId: z.number() })).mutation(({ input }) =>
      clearPendingActionsByClient(input.clientId)
    ),
    adoptAll: publicProcedure.input(z.object({
      actionIds: z.array(z.number()),
      clientId: z.number(),
      clientName: z.string(),
    })).mutation(async ({ input }) => {
      const { actionIds, clientId, clientName } = input;
      if (actionIds.length === 0) return { created: 0 };
      // Fetch the actions to get their details
      const allActions = await getActionsByClientId(clientId);
      const toAdopt = allActions.filter(a => actionIds.includes(a.id) && !a.isCompleted);
      // Insert as POD tasks for each role
      const podTasks = toAdopt.map(a => ({
        assignedRole: a.responsibleRole as 'AD' | 'SAM' | 'SA' | 'RSM',
        title: `[${clientName}] ${a.title}`,
        description: a.objective || undefined,
        priority: a.priority as '高' | '中' | '低',
        dueDate: a.timeframe === '今日' ? new Date(Date.now() + 86400000).toISOString().slice(0, 10)
          : a.timeframe === '本周' ? new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
          : new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      }));
      await insertPodTask(podTasks as any);
      return { created: podTasks.length };
    }),

    // Generate internal resource coordination tasks (POD internal)
    generateInternalCoord: publicProcedure.input(z.object({
      clientId: z.number(),
      clientName: z.string(),
      stage: z.string(),
      meddpiccSummary: z.string().optional(),
      context: z.string().optional(), // e.g., "SA 需要确认 AI Pentest 能力"
    })).mutation(async ({ input }) => {
      const prompt = `
客户：${input.clientName}
当前销售阶段：${input.stage}
MEDDPICC 状态：${input.meddpiccSummary || '未提供'}
背景信息：${input.context || '无'}

请生成 3-5 条对内资源协调任务，帮助 SAM 将内部资源调动起来。
典型场景：
- 指派 SA 确认产品能力（如：确认 AI Pentest 模块是否支持 HKT 的 API 安全场景）
- 申请内部资源（如：申请 POC 环境、申请技术驼居资源）
- 协调 RSM 属地化支持（如：联系香港渠道伙伴确认报价资格）
- 提醒 AD 层面关系运作（如：请 AD 确认是否有 C-Level 关系可利用）

返回 JSON 格式：
{
  "tasks": [
    {
      "title": "任务标题（10字内）",
      "description": "具体说明要完成什么、为什么重要，以及预期输出",
      "assignedRole": "SA|AD|SAM|RSM",
      "priority": "高|中|低",
      "timeframe": "今日|本周|本月",
      "taskType": "resource_coord",
      "suggestedScript": "建议话术（对内沟通时可直接使用）"
    }
  ]
}`;

      const res = await invokeLLM({
        model: 'gpt-4o',
        messages: [{ role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT }, { role: "user", content: prompt }],
      });
      const parsed = JSON.parse(extractJSON(String(res.choices[0].message.content || '{}')));
      const tasks = (parsed.tasks || []).map((t: any) => ({
        clientId: input.clientId,
        title: t.title,
        objective: t.description,
        suggestedScript: t.suggestedScript,
        responsibleRole: t.assignedRole as 'AD' | 'SAM' | 'SA' | 'RSM',
        priority: (t.priority || '中') as '高' | '中' | '低',
        timeframe: (t.timeframe || '本周') as '今日' | '本周' | '本月',
        aiGenerated: true,
        taskType: 'resource_coord',
      }));
      await insertActions(tasks);
      return tasks;
    }),
  }),

  // ── AI Insights (1-Pager) ─────────────────────────────────────────────────
  insights: router({
    listByClient: publicProcedure.input(z.object({ clientId: z.number() })).query(({ input }) =>
      getOnePagersByClientId(input.clientId)
    ),
    generate: publicProcedure.input(z.object({
      clientId: z.number(),
      clientName: z.string(),
      industry: z.string().optional(),
      hookTopic: z.string().optional(),
      securityAngle: z.string().optional(),
      notes: z.string().optional(),
      targetExecutive: z.string(),
      targetTitle: z.string().optional(),
    })).mutation(async ({ input }) => {
      // ── P0：自动拼装客户战况快照 ──────────────────────────────────────────
      let situationSnapshot = "";
      try {
        const [meddpicc, meetings, signals] = await Promise.all([
          getMeddpiccByClientId(input.clientId),
          getMeetingsByClientId(input.clientId),
          getSignalsByClientId(input.clientId),
        ]);

        // 1. 当前推进阶段 + 阶段停留天数
        const client = await getClientById(input.clientId);
        const stageInfo = client ? `当前推进阶段：${client.stage}` : "";
        const stageChangedAt = (client as any)?.stageChangedAt;
        const daysInStage = stageChangedAt
          ? Math.floor((Date.now() - new Date(stageChangedAt).getTime()) / 86400000)
          : null;
        const stageDay = daysInStage !== null ? `（已在该阶段停留 ${daysInStage} 天）` : "";

        // 2. 最近2次拜访摘要
        const recentMeetings = meetings.slice(0, 2);
        const visitSummary = recentMeetings.length > 0
          ? recentMeetings.map((m, i) => {
              const date = new Date(m.meetingDate).toLocaleDateString("zh-CN");
              const summary = m.aiMinutes
                ? m.aiMinutes.slice(0, 200).replace(/\n/g, " ")
                : (m.keyPoints || "").slice(0, 200).replace(/\n/g, " ");
              return `  第${i + 1}次（${date}）：${summary}`;
            }).join("\n")
          : "  暂无拜访记录";

        // 3. MEDDPICC 最薄弱2个维度
        const weakDimensions: string[] = [];
        if (meddpicc) {
          const dims = [
            { name: "M（可量化价值）", score: meddpicc.metricsScore, notes: meddpicc.metricsNotes },
            { name: "E（经济买家）", score: meddpicc.economicBuyerScore, notes: meddpicc.economicBuyerNotes },
            { name: "D（决策标准）", score: meddpicc.decisionCriteriaScore, notes: meddpicc.decisionCriteriaNotes },
            { name: "D2（决策流程）", score: meddpicc.decisionProcessScore, notes: meddpicc.decisionProcessNotes },
            { name: "P（采购流程）", score: meddpicc.paperProcessScore, notes: meddpicc.paperProcessNotes },
            { name: "I（痛点识别）", score: meddpicc.implicatePainScore, notes: meddpicc.implicatePainNotes },
            { name: "C（Champion）", score: meddpicc.championScore, notes: meddpicc.championNotes },
            { name: "C2（竞争态势）", score: meddpicc.competitionScore, notes: meddpicc.competitionNotes },
          ];
          dims.sort((a, b) => a.score - b.score);
          dims.slice(0, 2).forEach(d => {
            weakDimensions.push(`  ${d.name}：${d.score}分${d.notes ? `（${d.notes.slice(0, 60)}）` : ""}`);
          });
        }

        // 4. 最新7天情报信号
        const sevenDaysAgo = Date.now() - 7 * 86400000;
        const recentSignals = signals
          .filter(s => new Date(s.createdAt).getTime() > sevenDaysAgo)
          .slice(0, 3);
        const signalSummary = recentSignals.length > 0
          ? recentSignals.map(s => `  [${s.signalType}/${s.urgency}] ${s.rawSignal.slice(0, 100)}`).join("\n")
          : "  最近7天暂无新情报";

        situationSnapshot = `
【当前客户战况快照（系统数据，请优先基于此生成洞察）】
${stageInfo}${stageDay}

最近拜访记录（最新2次）：
${visitSummary}

MEDDPICC 最薄弱维度（需重点关注）：
${weakDimensions.length > 0 ? weakDimensions.join("\n") : "  暂无评分数据"}

最新情报信号（近7天）：
${signalSummary}
`;
      } catch {
        // 快照拉取失败不影响主流程
        situationSnapshot = "";
      }
      // ─────────────────────────────────────────────────────────────────────

      const prompt = `
请为以下拜访生成一份《高层会面简报（1-Pager）》，格式为Markdown，内容必须具体、可直接使用，不得使用空泛语言。

客户：${input.clientName}（${input.industry || "科技企业"}）
目标高管：${input.targetExecutive}（${input.targetTitle || "高管"}）
敲门砖话题：${input.hookTopic || "待定"}
安全切入点：${input.securityAngle || "待定"}
客户背景备注：${input.notes || "无"}
${situationSnapshot}
请生成包含以下四个部分的1-Pager：

## 一、客户战略背景（3-4句话）
（该高管近期最关注的战略议题、公开言论、业务压力；如有拜访记录，结合已知信息）

## 二、敲门砖建议（具体方案）
（用哪个跨界资源/话题开场，为什么这个话题对该高管有吸引力，预期引发的反应；如有情报信号，优先结合最新动态）

## 三、SPIN提问预演
**S（现状问题）：** [具体问题，结合已知的MEDDPICC薄弱维度]
**P（困难问题）：** [具体问题]
**I（痛点识别）：** [具体问题，要能让高管感到刺痛]
**N（价值问题）：** [具体问题，引导高管自述解决方案价值]

## 四、会面目标与成功标准
（本次会面要达成的具体目标；如有MEDDPICC薄弱维度，优先将其作为本次会面的突破目标）

## 五、本周优先行动卡
**1件事：** [最关键的一个行动]
**1个人：** [最需要接触/突破的一个人]
**1句话：** [开场或推进的核心话术]`;

      const res = await invokeLLM({
        model: "gpt-4o",
        messages: [{ role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT }, { role: "user", content: prompt }],
      });

      const content = String(res.choices[0].message.content || "");

      // Second AI call: extract structured strategy summary for SAM reference
      let hookTopicDraft = "";
      let securityAngleDraft = "";
      let hookTopicBasis = "";
      let securityAngleBasis = "";
      try {
        const strategyPrompt = `根据以下客户拜访简报，提炼关键建议供 SAM 参考。\n\n简报内容：\n${content}\n\n请以JSON格式返回：
{
  "hookTopic": "一句话总结：建议的敲门砖话题（具体、有针对性，基于公开情报）",
  "hookTopicBasis": "支撑该敲门砖建议的具体依据（引用简报中的具体事件、数据或公开言论，1-2句）",
  "securityAngle": "一句话总结：建议的亚信安全产品切入角度（具体产品线或解决方案）",
  "securityAngleBasis": "支撑该安全切入建议的具体依据（引用简报中的具体痛点、风险或行业案例，1-2句）"
}

只返回JSON，不要其他文字。`;
        const sRes = await invokeLLM({
         model: "gpt-4o-mini",
          messages: [{ role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT }, { role: "user", content: strategyPrompt }],
       });
        const sParsed = JSON.parse(extractJSON(String(sRes.choices[0].message.content || "{}")));
        hookTopicDraft = sParsed.hookTopic || "";
        securityAngleDraft = sParsed.securityAngle || "";
        hookTopicBasis = sParsed.hookTopicBasis || "";
        securityAngleBasis = sParsed.securityAngleBasis || "";
      } catch {
        // Non-critical, continue without strategy summary
      }

      const id = await insertOnePager({
        clientId: input.clientId,
        targetExecutive: input.targetExecutive,
        targetTitle: input.targetTitle,
        content,
      });
      return { id, content, hookTopicDraft, securityAngleDraft, hookTopicBasis, securityAngleBasis };
    }),
    applyStrategy: publicProcedure.input(z.object({
      clientId: z.number(),
      hookTopic: z.string().optional(),
      securityAngle: z.string().optional(),
    })).mutation(async ({ input }) => {
      const { clientId, ...data } = input;
      await updateClient(clientId, data as any);
      return { ok: true };
    }),

    // P1a: 0→1 Review — 基于客户阶段+关键人+拜访记录生成阶段推进建议
    reviewZeroToOne: protectedProcedure.input(z.object({
      clientId: z.number(),
    })).mutation(async ({ input }) => {
      const [client, contacts, meetings, meddpicc, signals] = await Promise.all([
        getClientById(input.clientId),
        getContactsByClientId(input.clientId),
        getMeetingsByClientId(input.clientId),
        getMeddpiccByClientId(input.clientId),
        getSignalsByClientId(input.clientId),
      ]);
      if (!client) throw new Error("客户不存在");

      const stage = client.stage;
      const stageChangedAt = (client as any).stageChangedAt;
      const daysInStage = stageChangedAt
        ? Math.floor((Date.now() - new Date(stageChangedAt).getTime()) / 86400000)
        : 0;

      // 阶段退出标准
      const exitCriteria: Record<string, string> = {
        "建图": "识别出 Economic Buyer + 至少3个关键人，组织架构基本清晰",
        "进门": "与关键人完成首次正式会面，客户同意安排下一次深入交流",
        "定痛": "① 客户承认痛点（I维度 ≥ 50，拜访记录中有客户原话支撑）+ ② 客户开始认可AIStorm能力（至少1个关键人态度为\"支持\"，或拜访记录出现正面表达）",
        "找人": "Champion确认（MEDDPICC C维度 ≥ 50）+ 完成与Economic Buyer的首次接触",
        "进入商机": "商机已立项，Blue Sheet已填写，MEDDPICC初始评分完成",
      };

      // SPIN话术阶段映射
      const spinMapping: Record<string, string> = {
        "建图": "Situation Questions（了解现状，摸清组织和业务背景）",
        "进门": "Situation Questions + Problem Questions（了解现状，初步探索痛点）",
        "定痛": "Problem Questions + Implication Questions（挖掘痛点并放大影响）",
        "找人": "Need-Payoff Questions（让Champion自己说出解决方案的价值）",
        "进入商机": "Need-Payoff Questions（推动Champion向EB传递价值）",
      };

      // 关系深度矩阵（区分正式/非正式接触，私信渠道）
      const contactsSummary = contacts.slice(0, 10).map(c => {
        const ca = c as any;
        const informalCount = ca.informalContactCount ?? 0;
        const customerInitCount = ca.customerInitiatedCount ?? 0;
        const channels: string[] = [];
        if (ca.hasWeChat) channels.push("微信");
        if (ca.hasWhatsapp) channels.push("WhatsApp");
        const depthLabel = informalCount >= 3 ? "深度" : informalCount >= 1 ? "中度" : "浅层（仅正式）";
        return `${c.name}（${c.title || ""}/${c.buyingRole || "未知"}，立场：${c.stance}，非正式接触：${informalCount}次，客户主动：${customerInitCount}次，私信渠道：${channels.length > 0 ? channels.join("/") : "无"}，关系深度：${depthLabel}）`;
      }).join("\n");

      // 一致性矛盾检测（0→1阶段规则）
      const contradictions: string[] = [];
      const painScore = meddpicc?.implicatePainScore ?? 0;
      const championScore = meddpicc?.championScore ?? 0;
      if (contacts.length < 3 && (meddpicc?.metricsScore ?? 0) > 40) {
        contradictions.push("⚠️ 建图完成度与关键人数量矛盾：关键人少于3人但评分偏高");
      }
      if (championScore >= 50) {
        const champion = contacts.find(c => c.buyingRole === "Champion" || c.relationship === "Champion");
        const informalCount = (champion as any)?.informalContactCount ?? 0;
        if (informalCount === 0) {
          contradictions.push("⚠️ Champion确认依据不足：仅正式会议接触，Political Will未验证（非正式接触次数=0）");
        }
      }
      if (painScore >= 50) {
        const hasClientQuote = meetings.some(m => (m.aiMinutes || m.keyPoints || "").includes("客户说") || (m.aiMinutes || m.keyPoints || "").includes("他说") || (m.aiMinutes || m.keyPoints || "").includes("表示"));
        if (!hasClientQuote) {
          contradictions.push("⚠️ 痛点定义缺乏客户原话支撑：I维度≥50但拜访记录中未检测到客户直接表述");
        }
      }
      // 定痛完整性检查：两个条件必须同时满足
      if (stage === '定痛' && painScore >= 50) {
        const hasPositiveStance = contacts.some(
          (c: any) => c.stance === '支持'
        );
        const hasPosVisitRecord = meetings.some((m: any) => {
          const text = (m.aiMinutes || '') + (m.keyPoints || '') + (m.summary || '');
          return (
            text.includes('认可') ||
            text.includes('感兴趣') ||
            text.includes('有意向') ||
            text.includes('支持') ||
            text.includes('赞同')
          );
        });
        if (!hasPositiveStance && !hasPosVisitRecord) {
          contradictions.push(
            '⚠️ 定痛不完整：客户已承认痛点（I维度达标），但尚无能力认可信号——' +
            '关键人态度中无"支持"，拜访记录中也未检测到正面表述。' +
            '建议：安排能力展示或案例分享，在客户对AIStorm产生初步认可前不推进至"找人"阶段。'
          );
        }
      }
      if (["找人", "进入商机"].includes(stage)) {
        const hasEB = contacts.some(c => c.buyingRole === "经济决策人");
        if (!hasEB) {
          contradictions.push("⚠️ 进入找人/商机阶段但EB未接触：0→1完成标准存疑");
        }
      }
      // 所有接触均为正式会议检查
      const allFormal = contacts.every(c => (c as any).informalContactCount === 0 || (c as any).informalContactCount === null);
      const executiveTitles = ["CEO", "CFO", "CIO", "CISO"];
      const executiveCoverageCount = contacts.filter(contact => executiveTitles.some(title => `${contact.title || ""} ${contact.department || ""}`.toUpperCase().includes(title))).length;
      const uncoveredPriorityLayers = Math.max(0, executiveTitles.length - executiveCoverageCount);
      // Challenger Reframe: LLM detection instead of keyword matching
      let reframeEvidence: string | null = null;
      const latestMeetingContent = meetings[0] ? (meetings[0].aiMinutes || meetings[0].keyPoints || "").slice(0, 500) : "";
      if (latestMeetingContent.length > 100) {
        try {
          const reframeCheck = await invokeLLM({
            model: "gpt-5-mini",
            maxCompletionTokens: 60,
            messages: [
              { role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT },
              { role: "user", content: `以下拜访摘要中是否出现了 Challenger Reframe 迹象？\n（Reframe定义：SAM提出了客户之前没考虑过的风险视角，客户表达了认知改变）\n拜访内容：${latestMeetingContent}\n只回答 yes 或 no，再用10字说明依据。` }
            ],
          });
          const checkResult = String(reframeCheck.choices?.[0]?.message?.content || "");
          if (checkResult.toLowerCase().startsWith("yes")) {
            reframeEvidence = `最近拜访检测到 Reframe 迹象：${checkResult.slice(3).trim()}`;
          }
        } catch (e) {
          // Fallback to keyword match if LLM fails
          const reframeMeeting = meetings.find((meeting: any) => `${meeting.aiMinutes || ""}${meeting.keyPoints || ""}`.includes("之前没这样想"));
          if (reframeMeeting) reframeEvidence = `拜访记录 ${new Date(reframeMeeting.meetingDate).toLocaleDateString("zh-CN")} 出现客户认知重构表述`;
        }
      }
      const accountMapBlock = buildAccountMapDiagnosticLayer({
        executiveCoverageCount,
        uncoveredPriorityLayers,
        reframeEvidence,
      });
      const contradictionBlock = contradictions.length > 0
        ? `\n【⚠️ AI一致性矛盾检测（${contradictions.length}项）】\n${contradictions.join("\n")}`
        : "\n【✅ AI一致性检测：未发现明显矛盾】";

      const recentVisits = meetings.slice(0, 3).map((m: any, i: number) => {
        const date = new Date(m.meetingDate).toLocaleDateString("zh-CN");
        const summary = m.aiMinutes ? m.aiMinutes.slice(0, 300) : m.keyPoints?.slice(0, 300) || "";
        const contactType = m.contactType ? `[${m.contactType}]` : "[正式会议]";
        return `第${i+1}次拜访（${date}）${contactType}：${summary}`;
      }).join("\n");

      const recentSignals = signals.slice(0, 3).map(s =>
        `[${s.signalType}/${s.urgency}] ${s.rawSignal.slice(0, 100)}`
      ).join("\n");

      const prompt = `针对企业级安全客户的 0→1 Account Map 阶段进行关系与认知诊断。这个阶段的核心是人，不是产品；不要给产品介绍或方案建议。

当前客户阶段: ${stage}
该阶段的退出标准: ${exitCriteria[stage] || "推进到下一阶段"}
阶段停留天数: ${daysInStage}天
${daysInStage > 30 ? "⚠️ 警告：已超过30天，存在停滞风险" : ""}
${allFormal ? "\n⚠️ 关键警告：所有关键人接触均为正式场合，客户真实态度存在不确定性。建议优先安排非正式接触。" : ""}

关键人列表（含角色/立场/关系深度矩阵）:
${contactsSummary || "暂无关键人记录"}

最近3次拜访摘要（含接触类型）:
${recentVisits || "暂无拜访记录"}

相关情报信号:
${recentSignals || "暂无情报信号"}

当前MEDDPICC I维度（Identify Pain）得分: ${painScore}
当前MEDDPICC C维度（Champion）得分: ${championScore}
${accountMapBlock}

SPIN话术阶段映射（供行动建议使用，不要在输出中解释框架）:
当前阶段建议使用：${spinMapping[stage] || "综合运用SPIN提问"}

${contradictionBlock}

请按以下格式输出（不得省略任何一项）:

## 1. 阶段完成度
**已完成项：**（列出已达成的退出条件）
**缺失项：**（列出尚未完成的退出条件）

## 2. 关系深度评估
- 哪些关键人停留在正式会议层面（存在真实态度盲区）
- 哪些关键人有非正式接触（信息可信度更高）
- EB是否有私信渠道（微信/WhatsApp），无则标注关系深度风险

## 3. 核心卡点
（阻止推进到下一阶段的最关键一件事，只说一件，必须具体）

## 4. 下一步3个具体行动
- 行动1：做什么 + 找谁 + 建议话题/切入点（基于SPIN阶段映射）
- 行动2：做什么 + 找谁 + 建议话题/切入点（基于SPIN阶段映射）
- 行动3：做什么 + 找谁 + 建议话题/切入点（基于SPIN阶段映射）

## 5. 下次接触建议
**建议接触类型：**（正式/非正式，基于当前关系深度）
**建议开场话题：**（结合最新情报信号，一句话）

## 6. 商机出现可能性
**评级：** 低/中/高
**依据：**（一句话，必须基于当前关系深度而非产品匹配度，引用具体数据来源）

## 7. 本周优先行动卡
**1件事：** [最关键的一个行动]
**1个人：** [最需要接触/突破的一个人]
**1句话：** [开场或推进的核心话术]

注意：
- 每个结论必须引用数据来源（哪次拜访记录、接触类型、哪条情报）
- 如果某项数据缺失，明确标注"缺少X数据，以下判断存在盲区"
- 如果所有接触均为正式会议，必须在关系深度评估中标注：⚠️ 所有接触为正式场合，客户真实态度存在不确定性`;

      // Inject Account Map diagnostic context for 0→1 Review
      const reviewAccountDiag = await getAccountDiagnosticContext(input.clientId);
      const enrichedReviewPrompt = prompt + reviewAccountDiag;
      const res = await invokeLLM({
        model: "gpt-5-mini",
        messages: [{ role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT }, { role: "user", content: enrichedReviewPrompt }],
      });
      const content = String(res.choices[0].message.content || "");
      await saveAiReview({ clientId: input.clientId, opportunityId: null, reviewType: "0to1", content, createdBy: null });
      return { content, stage, daysInStage };
    }),

    // P1b: 1→N Review — MEDDPICC健康雷达+Blue Sheet战局判断+AI质疑层
    reviewOneToN: protectedProcedure.input(z.object({
      clientId: z.number(),
      opportunityId: z.number(),
    })).mutation(async ({ input }) => {
      const [client, contacts, meetings, meddpicc, signals, baseline] = await Promise.all([
        getClientById(input.clientId),
        getContactsByClientId(input.clientId),
        getMeetingsByClientId(input.clientId),
        getMeddpiccByClientId(input.clientId),
        getSignalsByClientId(input.clientId),
        getEffectivenessBaseline(input.clientId),
      ]);
      if (!client) throw new Error("客户不存在");

      // 获取商机信息
      const { getDb } = await import('./db.js');
      const { opportunities } = await import('../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      const db = await getDb();
      const oppRows = db ? await db.select().from(opportunities).where(eq(opportunities.id, input.opportunityId)).limit(1) : [];
      const opp = oppRows[0];
      if (!opp) throw new Error("商机不存在");

      const stageChangedAt = (opp as any).stageChangedAt;
      const daysInStage = stageChangedAt
        ? Math.floor((Date.now() - new Date(stageChangedAt).getTime()) / 86400000)
        : 0;

      // 阶段停滞预警阈值
      const stageThresholds: Record<string, {yellow: number; red: number}> = {
        "初步需求": { yellow: 30, red: 60 },
        "需求挖掘": { yellow: 30, red: 60 },
        "技术验证": { yellow: 45, red: 90 },
        "方案提案": { yellow: 21, red: 45 },
        "商务谈判": { yellow: 14, red: 30 },
      };
      const threshold = stageThresholds[opp.stage] || { yellow: 30, red: 60 };
      const stagnationRisk = daysInStage >= threshold.red ? "🔴 红色预警" :
                             daysInStage >= threshold.yellow ? "🟡 黄色预警" : "🟢 正常";

      // 阶段退出条件
      const exitCriteria: Record<string, string> = {
        "初步需求": "客户确认需求范围，SA完成初步技术评估",
        "需求挖掘": "MEDDPICC各维度完成初步评分，需求调研报告提交",
        "技术验证": "客户技术负责人口头/书面确认方案可行，或POC结果已呈现",
        "方案提案": "Decision Criteria明确，客户同意评分框架，Blue Sheet完整，MEDDPICC ≥ 60",
        "商务谈判": "合同进入审批流程",
      };

      // Champion三维评分
      const champion = contacts.find(c => c.buyingRole === "Champion" || c.relationship === "Champion");
      const championScore = meddpicc?.championScore ?? 0;
      const championAccess = (champion as any)?.championAccessToPower ?? 0;
      const championWill = (champion as any)?.championPoliticalWill ?? 0;
      const championCred = (champion as any)?.championCredibility ?? 0;
      const championTotal = championAccess + championWill + championCred;
      const championStatus = championTotal >= 7 ? "有效Champion（绿）" :
                             championTotal >= 5 ? "脆弱Champion，需加固（黄）" :
                             championTotal > 0 ? "伪Champion，建议重新寻访（红）" : "未评分";

      const m = meddpicc;
      const meddpiccSummary = m ? `
M（Metrics可量化价值）: ${m.metricsScore}分 - ${m.metricsNotes?.slice(0,60) || "无备注"}${m.metricsScore >= 70 && (m.metricsNotes?.length || 0) < 30 ? " ⚠️ 评分依据不足" : ""}
E（Economic Buyer）: ${m.economicBuyerScore}分 - ${m.economicBuyerNotes?.slice(0,60) || "无备注"}${m.economicBuyerScore >= 70 && (m.economicBuyerNotes?.length || 0) < 30 ? " ⚠️ 评分依据不足" : ""}
D（Decision Criteria）: ${m.decisionCriteriaScore}分 - ${m.decisionCriteriaNotes?.slice(0,60) || "无备注"}${m.decisionCriteriaScore >= 70 && (m.decisionCriteriaNotes?.length || 0) < 30 ? " ⚠️ 评分依据不足" : ""}
D2（Decision Process）: ${m.decisionProcessScore}分 - ${m.decisionProcessNotes?.slice(0,60) || "无备注"}${m.decisionProcessScore >= 70 && (m.decisionProcessNotes?.length || 0) < 30 ? " ⚠️ 评分依据不足" : ""}
P（Paper Process）: ${m.paperProcessScore}分 - ${m.paperProcessNotes?.slice(0,60) || "无备注"}${m.paperProcessScore >= 70 && (m.paperProcessNotes?.length || 0) < 30 ? " ⚠️ 评分依据不足" : ""}
I（痛点识别）: ${m.implicatePainScore}分 - ${m.implicatePainNotes?.slice(0,60) || "无备注"}${m.implicatePainScore >= 70 && (m.implicatePainNotes?.length || 0) < 30 ? " ⚠️ 评分依据不足" : ""}
C（Champion）: ${m.championScore}分 - ${m.championNotes?.slice(0,60) || "无备注"}，Champion三维评分: Access ${championAccess}/Will ${championWill}/Credibility ${championCred}（${championStatus}）
C2（Competition）: ${m.competitionScore}分 - ${m.competitionNotes?.slice(0,60) || "无备注"}${m.competitionScore >= 70 && (m.competitionNotes?.length || 0) < 30 ? " ⚠️ 评分依据不足" : ""}` : "暂无MEDDPICC评分";

      const recentVisits = meetings.slice(0, 3).map((mt, i) => {
        const date = new Date(mt.meetingDate).toLocaleDateString("zh-CN");
        const summary = mt.aiMinutes ? mt.aiMinutes.slice(0, 200) : mt.keyPoints?.slice(0, 200) || "";
        return `第${i+1}次（${date}）：${summary}`;
      }).join("\n");

      const recentSignals = signals.slice(0, 3).map(s =>
        `[${s.signalType}/${s.urgency}] ${s.rawSignal.slice(0, 100)}`
      ).join("\n");

      const blueSheet = opp.bizObjective || opp.valueProposition || opp.winStrategy
        ? `业务目标：${opp.bizObjective || "未填写"}
价值ProPosition：${opp.valueProposition || "未填写"}
赢单策略：${opp.winStrategy || "未填写"}`
        : "Blue Sheet尚未填写";

      // 关系深度矩阵（1→N阶段：Champion非正式接触是核心信号）
      const contactsWithDepth = contacts.slice(0, 8).map(c => {
        const ca = c as any;
        const informalCount = ca.informalContactCount ?? 0;
        const customerInitCount = ca.customerInitiatedCount ?? 0;
        const channels: string[] = [];
        if (ca.hasWeChat) channels.push("微信");
        if (ca.hasWhatsapp) channels.push("WhatsApp");
        return `${c.name}（${c.buyingRole || "未知"}，${c.stance}，非正式接触：${informalCount}次，客户主动：${customerInitCount}次，私信：${channels.length > 0 ? channels.join("/") : "无"}）`;
      }).join("\n");

      // CoM框架检查（方案提案阶段及以后）
      const isProposalStage = ["方案提案", "商务谈判"].includes(opp.stage);
      const comCheck = isProposalStage ? `
CoM框架完整度检查（方案提案阶段必须完整）:
- Before State（客户现状痛点量化）: ${opp.bizObjective ? "已填写" : "📭 未填写"}
- Negative Consequences（不解决的代价）: ${opp.valueProposition ? "已填写" : "📭 未填写"}
- Required Capabilities（客户需要什么能力）: 请在分析中评估
- Positive Outcomes（量化结果）: ${opp.winStrategy ? "已填写" : "📭 未填写"}` : "";

      // 一致性矛盾检测（1→N阶段规则）
      const contradictions1N: string[] = [];
      const meddpiccData = meddpicc;
      if (meddpiccData) {
        if (meddpiccData.economicBuyerScore >= 70) {
          const ebContact = contacts.find(c => c.buyingRole === "经济决策人");
          const ebLastVisit = ebContact ? meetings.find(mt => (mt.attendees || "").includes(ebContact.name)) : null;
          if (!ebLastVisit) {
            contradictions1N.push("⚠️ EB评分≥70但无近期拜访记录关联EB，评分依据可能过时");
          }
        }
        if (meddpiccData.championScore >= 60) {
          const champion1N = contacts.find(c => c.buyingRole === "Champion" || c.relationship === "Champion");
          const informalCount1N = (champion1N as any)?.informalContactCount ?? 0;
          if (informalCount1N === 0) {
            contradictions1N.push("⚠️ Champion评分可能虚高：所有接触为正式场合，Political Will真实性待验证（非正式接触=0）");
          }
        }
        if (opp.stage === "技术验证" && daysInStage > 45) {
          const hasSAVisit = meetings.some(mt => (mt.attendees || "").includes("SA") || (mt.keyPoints || "").includes("POC") || (mt.keyPoints || "").includes("技术验证"));
          if (!hasSAVisit) {
            contradictions1N.push("⚠️ 技术验证阶段超45天但无SA参与记录，POC进展存疑");
          }
        }
        if (opp.stage === "方案提案" && !opp.bizObjective && !opp.winStrategy) {
          contradictions1N.push("⚠️ 方案提案阶段Blue Sheet未填写，竞争策略不清晰");
        }
        // 单次跳分检测（如果MEDDPICC均分超过60但备注普遍不足）
        const dims = [meddpiccData.metricsScore, meddpiccData.economicBuyerScore, meddpiccData.decisionCriteriaScore, meddpiccData.decisionProcessScore, meddpiccData.paperProcessScore, meddpiccData.implicatePainScore, meddpiccData.championScore, meddpiccData.competitionScore];
        const notes = [meddpiccData.metricsNotes, meddpiccData.economicBuyerNotes, meddpiccData.decisionCriteriaNotes, meddpiccData.decisionProcessNotes, meddpiccData.paperProcessNotes, meddpiccData.implicatePainNotes, meddpiccData.championNotes, meddpiccData.competitionNotes];
        const highScoreLowEvidence = dims.filter((s, i) => s >= 70 && (notes[i]?.length ?? 0) < 30).length;
        if (highScoreLowEvidence >= 3) {
          contradictions1N.push(`⚠️ ${highScoreLowEvidence}个维度评分≥70但备注不足30字，评分置信度已下调，建议补充拜访记录依据`);
        }
      }
            const baselineBlock = baseline ? `
効能基线数据（CoM Before State量化依据）：
- MTTR：${(baseline as any).currentMttr || "未填写"}
- 威胁检出率：${(baseline as any).currentDetectionRate || "未填写"}
- SOC人员：${(baseline as any).socHeadcount || "未填写"}人
- 合规审计准备：${(baseline as any).complianceAuditDays || "未填写"}天/次
- 每年安全事件损失：${(baseline as any).estimatedIncidentCost || "未填写"}
- 数据来源：${(baseline as any).dataSource || "未填写"}
${(baseline as any).quantifiedPainStatement ? `量化痛点陈述：${(baseline as any).quantifiedPainStatement.slice(0, 200)}` : ""}
${(baseline as any).roiSummary ? `ROI摘要已生成，可作为方案提案依据` : "⚠️ ROI摘要未生成，建议在方案提案前完成"}` : "⚠️ 效能基线未填写，CoM Before State量化依据缺失";
      const contradiction1NBlock = contradictions1N.length > 0
        ? `\n【⚠️ AI一致性矛盾检测（${contradictions1N.length}项）】\n${contradictions1N.join("\n")}`
        : "\n【✅ AI一致性检测：未发现明显矛盾】";
      const dealMapBlock = buildDealMapDiagnosticLayer({
        competitorInfluencesCriteria: opp.competitorName ? `主竞品已登记为“${opp.competitorName}”；其是否影响 Decision Criteria：数据不足` : null,
      });

      const prompt = `针对企业级安全客户的 1→N Deal Map 阶段进行赢单质量诊断。先识别 Win = Pain × Power × Champion × Value × Control 中最弱的因子，再给出有数据支撑的下一步行动。

商机: ${opp.name}
当前阶段: ${opp.stage}，在当前阶段已停留 ${daysInStage} 天（${stagnationRisk}，预警阈值：黄${threshold.yellow}天/红${threshold.red}天）
商机金额: ${opp.estimatedValue || "未填写"}
当前阶段退出标准: ${exitCriteria[opp.stage] || "推进到下一阶段"}
主要竞品: ${opp.competitorName || "未知"}

MEDDPICC评分（各维度0-100分，含评分依据）:
${meddpiccSummary}

关键人覆盖（含Buying Group角色+关系深度矩阵）:
${contactsWithDepth || "暂无关键人"}

最近3次拜访摘要:
${recentVisits || "暂无拜访记录"}

相关情报信号（含竞品动态）:
${recentSignals || "暂无情报信号"}
${baselineBlock}

Blue Sheet内容:
${blueSheet}
${comCheck}
${contradiction1NBlock}
${dealMapBlock}

请按以下格式输出（格式固定，不得省略）:

## 1. MEDDPICC健康雷达
（每个维度：🟢绿/🟡黄/🔴红 + 一行理由 + 数据来源；评分≥70且依据不足的标注⚠️；无数据的标注📭）

## 2. Champion评估
**Champion状态：** ${championStatus}
**评估：**（基于三维评分判断；如为伪Champion给出替代人选建议；如所有接触均为正式会议，标注Political Will评分上限，建议安排非正式接触）

## 3. 赢单概率
**概率：** X%
**主要依据：**
1. [依据1]（system_data 或 ai_inference）
2. [依据2]（system_data 或 ai_inference）
3. [依据3]（system_data 或 ai_inference）

## 4. 最薄弱2个维度 + 突破行动
**维度1：**
- 问题：
- 突破行动：做什么 + 找谁 + 用什么角度

**维度2：**
- 问题：
- 突破行动：做什么 + 找谁 + 用什么角度

## 5. 竞争态势
**状态：** 领先/胶着/落后
**依据：**（基于情报信号，非假设）

## 6. 停滞风险评估
${daysInStage >= threshold.yellow ? `**风险等级：** ${stagnationRisk}
**影响：**（说明停滞的具体影响）
**建议：**` : "**状态：** 正常，无停滞风险"}

## 7. Blue Sheet战局判断
（一段话，不超过100字，包含"当前优势、最大风险、赢单关键"）
${isProposalStage ? `
## 8. CoM框架完整度
（四个维度是否都已建立：Before State / Negative Consequences / Required Capabilities / Positive Outcomes；缺失项给出补全建议）

## 9. 本周行动分工` : `
## 8. 本周行动分工`}
**AD：** [1个优先行动]
**SAM：** [1个优先行动]
**SA：** [1个优先行动]
**RSM：** [仅在采购流程、属地渠道或本地关系存在可验证缺口时给出1个行动；否则写“数据不足，暂不安排”]

AI质疑层规则（内嵌在以上各节中执行）：
- 某维度自评≥70但评分依据少于30字：在该维度后标注⚠️ 评分依据不足，置信度已下调
- 缺失数据维度：标注📭 数据不足，无法判断，建议优先填补
- Champion评分高但无非正式接触：在Champion评估中标注⚠️ Political Will真实性待验证`;

      // Inject Deal Map diagnostic context for 1→N Review
      const dealDiag = await getDealDiagnosticContext(input.clientId, input.opportunityId);
      const enrichedDealPrompt = `${prompt}${dealDiag}

请严格按 JSON Schema 返回，不要在 JSON 外输出任何文字。将上方要求的完整 Markdown Review 放入 reviewContent 字段；roleActions 只保留基于已有事实可执行的 AD、SAM、SA、RSM 行动（最多每个角色一项）。没有可验证行动时返回空数组，绝不能为了填满角色而编造任务。`;
      const res = await invokeLLM({
        model: "gpt-5-mini",
        // 1→N Review 需要完整诊断和角色行动；较低 token 上限会导致无正文可回写。
        maxCompletionTokens: 5200,
        reasoning: { effort: "low" },
        messages: [{ role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT }, { role: "user", content: enrichedDealPrompt }],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "deal_review_with_role_actions",
            strict: true,
            schema: {
              type: "object",
              properties: {
                reviewContent: { type: "string", description: "完整的 Markdown 格式 1→N 商机 Review" },
                roleActions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      role: { type: "string", enum: ["AD", "SAM", "SA", "RSM"] },
                      title: { type: "string", description: "不超过 100 字的可执行任务标题" },
                      description: { type: "string", description: "任务的事实依据、完成标准或协作依赖" },
                    },
                    required: ["role", "title", "description"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["reviewContent", "roleActions"],
              additionalProperties: false,
            },
          },
        },
      });
      const rawReview = getLLMTextContent(res.choices[0]?.message.content);
      if (!rawReview) {
        const finishReason = res.choices[0]?.finish_reason || "未知";
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: `AI Review 未返回可保存内容（完成状态：${finishReason}）。本次未写入 Review，请稍后重试。`,
        });
      }
      let reviewContent = rawReview;
      let roleActions: Array<{ role: "AD" | "SAM" | "SA" | "RSM"; title: string; description: string }> = [];
      let actionTaskError: string | null = null;
      try {
        const structured = JSON.parse(extractJSON(rawReview));
        reviewContent = String(structured.reviewContent || "数据不足，暂不判断。");
        roleActions = Array.isArray(structured.roleActions)
          ? structured.roleActions.filter((action: any) => ["AD", "SAM", "SA", "RSM"].includes(action?.role) && typeof action?.title === "string" && action.title.trim().length > 3)
          : [];
      } catch {
        actionTaskError = "AI Review 未返回可验证的结构化角色行动；本次未自动创建 POD 任务。";
      }
      if (!reviewContent.trim()) {
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: "AI Review 返回为空，本次未写入 Review，请稍后重试。",
        });
      }
      const reviewId = await saveAiReview({ clientId: input.clientId, opportunityId: input.opportunityId, reviewType: "1toN", content: reviewContent, createdBy: null });
      let createdRoleTaskCount = 0;
      let skippedRoleTaskCount = 0;
      if (!actionTaskError) try {
        const { podTasks } = await import("../drizzle/schema");
        const { and: andFn, eq: eqFn } = await import("drizzle-orm");
        if (!db) throw new Error("数据库不可用");
        for (const action of roleActions) {
          const normalizedTitle = action.title.trim().slice(0, 100);
          const existing = await db.select({ id: podTasks.id }).from(podTasks).where(andFn(
            eqFn(podTasks.opportunityId, input.opportunityId),
            eqFn(podTasks.assignedRole, action.role),
            eqFn(podTasks.title, normalizedTitle),
          ));
          if (existing.length > 0) {
            skippedRoleTaskCount += 1;
            continue;
          }
          await db.insert(podTasks).values({
            clientId: input.clientId,
            opportunityId: input.opportunityId,
            assignedRole: action.role,
            title: normalizedTitle,
            description: action.description.trim().slice(0, 500) || "来自 1→N AI Review 的分角色行动建议",
            sourceReviewId: reviewId || null,
          });
          createdRoleTaskCount += 1;
        }
      } catch (error) {
        actionTaskError = `角色任务创建失败：${error instanceof Error ? error.message : "未知错误"}`;
      }
      return {
        content: reviewContent,
        reviewGenerationVersion: "review-one-to-n-v3-nonempty-guard",
        stage: opp.stage,
        daysInStage,
        stagnationRisk,
        championStatus,
        reviewId: reviewId || null,
        roleTaskCreation: {
          requested: roleActions.length,
          created: createdRoleTaskCount,
          skipped: skippedRoleTaskCount,
          error: actionTaskError,
        },
      };
    }),

    // P1c: Buying Group 覆盖分析 — 权力路径分析 + Champion→EB路径完整性
    reviewBuyingGroup: protectedProcedure.input(z.object({
      clientId: z.number(),
    })).mutation(async ({ input }) => {
      const [client, contacts, meetings] = await Promise.all([
        getClientById(input.clientId),
        getContactsByClientId(input.clientId),
        getMeetingsByClientId(input.clientId),
      ]);
      if (!client) throw new Error("客户不存在");

      const buyingRoleMap: Record<string, string[]> = {};
      contacts.forEach(c => {
        const role = c.buyingRole || "未知";
        if (!buyingRoleMap[role]) buyingRoleMap[role] = [];
        buyingRoleMap[role].push(`${c.name}（${c.title || ""}，${c.relationship}，${c.stance}）`);
      });

      const champion = contacts.find(c => c.buyingRole === "Champion" || c.relationship === "Champion");
      const eb = contacts.find(c => c.buyingRole === "经济决策人");
      const techDm = contacts.find(c => c.buyingRole === "技术决策人");
      const blocker = contacts.find(c => c.buyingRole === "阻碍者");

      const championAccess = (champion as any)?.championAccessToPower ?? 0;
      const championWill = (champion as any)?.championPoliticalWill ?? 0;
      const championCred = (champion as any)?.championCredibility ?? 0;

      // 关系路径分析
      const relationshipPaths: string[] = [];
      contacts.forEach(c => {
        const edges = (c as any).relationshipEdges;
        if (edges && Array.isArray(edges)) {
          edges.forEach((e: any) => {
            relationshipPaths.push(`${c.name} → ${e.to}（${e.type}，${e.strength}）`);
          });
        }
        if (c.reportingTo) {
          relationshipPaths.push(`${c.name} 汇报给 ${c.reportingTo}`);
        }
      });

      const recentVisits = meetings.slice(0, 3).map((m, i) => {
        const date = new Date(m.meetingDate).toLocaleDateString("zh-CN");
        const summary = m.aiMinutes ? m.aiMinutes.slice(0, 150) : m.keyPoints?.slice(0, 150) || "";
        return `第${i+1}次（${date}）：${summary}`;
      }).join("\n");

      // 功能3修正：构建关系深度矩阵（非正式接触 + 客户主动 + 私信渠道）
      const relationshipDepthMatrix = contacts.map(c => {
        const ca = c as any;
        const informalCount = ca.informalContactCount ?? 0;
        const customerInitCount = ca.customerInitiatedCount ?? 0;
        const channels: string[] = [];
        if (ca.hasWhatsapp) channels.push("WhatsApp");
        if (ca.hasWeChat) channels.push("微信");
        const lastInformal = ca.lastInformalContact
          ? new Date(ca.lastInformalContact).toLocaleDateString("zh-CN")
          : null;
        const depthScore = informalCount + customerInitCount * 2 + channels.length;
        const depthLabel = depthScore >= 5 ? "深度" : depthScore >= 2 ? "中度" : "浅层";
        return `${c.name}（${c.buyingRole || c.relationship}）：非正式接触${informalCount}次，客户主动发起${customerInitCount}次，私信渠道[${channels.join("/") || "无"}]，关系深度[${depthLabel}]${lastInformal ? `，最近非正式接触${lastInformal}` : ""}`;
      }).join("\n") || "暂无关系深度数据";

      const prompt = `
客户：${client.name}（${client.industry || "未知行业"}）
当前阶段：${client.stage}

关键人Buying Group覆盖：
${Object.entries(buyingRoleMap).map(([role, people]) => `${role}：${people.join("；")}`).join("\n") || "暂无关键人"}

Champion三维评分：
${champion ? `${champion.name} - Access to Power: ${championAccess}/3，Political Will: ${championWill}/3，Credibility: ${championCred}/3` : "未识别Champion"}

关系路径（汇报链/引荐路径）：
${relationshipPaths.join("\n") || "暂无关系路径数据"}

关系深度矩阵（非正式接触 + 客户主动发起 + 私信渠道）：
${relationshipDepthMatrix}

最近拜访摘要：
${recentVisits || "暂无拜访记录"}

请按以下格式输出：

## 1. Buying Group覆盖地图
（表格形式：角色 | 覆盖人员 | 关系深度[浅层/中度/深度] | 立场 | 风险）
注意：关系深度基于非正式接触次数、客户主动发起次数、私信渠道综合评估，而非仅凭正式会议次数
- 经济决策人（EB）：${eb ? eb.name + "（" + eb.relationship + "，" + eb.stance + "）" : "⚠️ 未覆盖"}
- 技术决策人：${techDm ? techDm.name + "（" + techDm.relationship + "，" + techDm.stance + "）" : "⚠️ 未覆盖"}
- Champion：${champion ? champion.name + "（" + champion.relationship + "）" : "⚠️ 未识别"}
- 阻碍者：${blocker ? blocker.name + "（" + blocker.stance + "）" : "暂无已知阻碍者"}

## 2. Champion→EB路径完整性
**路径状态：** 完整/不完整/未知
**路径描述：**（Champion能否直接或间接影响EB的决策？通过什么路径？）
**风险：**（如果路径不完整，说明风险）

## 3. 关键覆盖缺口
（列出最多3个最需要弥补的覆盖缺口，每个说明：缺什么人/什么角色 + 为什么重要 + 如何通过现有关系建立连接）

## 4. 权力地图分析
（基于汇报关系和关系路径，描述决策权力如何流动，谁是真正的影响者）

## 5. 下一步建议
- 最优先接触的1个人：[姓名/角色] + 通过谁引荐 + 切入话题
- 需要加固的1段关系：[现有关系] + 如何加固
- 需要中和的1个风险：[风险描述] + 应对策略

注意：每个结论必须引用具体数据来源。如果某项数据缺失，明确标注"缺少X数据"。`;

      const res = await invokeLLM({
        model: "gpt-4o",
        messages: [{ role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT }, { role: "user", content: prompt }],
      });
      const reviewContent = String(res.choices[0].message.content || "");
      await saveAiReview({ clientId: input.clientId, opportunityId: null, reviewType: "buyingGroup", content: reviewContent, createdBy: null });
      return { content: reviewContent };
    }),

    // P1d: 跨拜访趋势分析 — 滚动叙事架构 + 下次拜访建议
    reviewVisitTrend: protectedProcedure.input(z.object({
      clientId: z.number(),
    })).mutation(async ({ input }) => {
      const [client, contacts, meetings, meddpicc] = await Promise.all([
        getClientById(input.clientId),
        getContactsByClientId(input.clientId),
        getMeetingsByClientId(input.clientId),
        getMeddpiccByClientId(input.clientId),
      ]);
      if (!client) throw new Error("客户不存在");

      if (meetings.length === 0) {
        return { content: "暂无拜访记录，无法进行趋势分析。请先录入至少1次拜访日志。" };
      }

      // 按时间排序，最新在前
      const sortedMeetings = [...meetings].sort((a, b) => 
        new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime()
      );

      // 滚动叙事架构：前N-2次压缩摘要 + 最近2次完整日志（Token恒定）
      const recentTwo = sortedMeetings.slice(0, 2);
      const olderCount = Math.max(0, sortedMeetings.length - 2);
      const recentTwoLog = recentTwo.map((m, i) => {
        const date = new Date(m.meetingDate).toLocaleDateString("zh-CN");
        const attendees = m.attendees || "";
        const summary = m.aiMinutes ? m.aiMinutes.slice(0, 300) : m.keyPoints?.slice(0, 300) || "";
        return `[第${sortedMeetings.length - i}次拜访 ${date}] 参会：${attendees}\n内容：${summary}`;
      }).join("\n\n");
      // 关键人态度变化
      const contactStances = contacts.map(c => 
        `${c.name}（${c.buyingRole || "未知"}）：${c.stance}`
      ).join("；");
      // 读取已有的滚动叙事（前N-2次的压缩摘要）
      const existingNarrative = (client as any).relationshipNarrative || "";
      const visitTimeline = [
        existingNarrative
          ? `【历史关系叙事摘要（前${olderCount}次拜访压缩，约200字）】\n${existingNarrative}`
          : (olderCount > 0 ? `【历史拜访】共${olderCount}次历史拜访（暂无压缩叙事，本次生成后将自动保存）` : ''),
        recentTwo.length > 0 ? `【最近${recentTwo.length}次完整拜访记录（时间倒序）】\n${recentTwoLog}` : ''
      ].filter(Boolean).join("\n\n");
      const prompt = `客户：${client.name}（${client.industry || "未知行业"}）
当前阶段：${client.stage}
总拜访次数：${meetings.length}次
拜访记录（滚动叙事架构）：
${visitTimeline}
关键人当前立场：
${contactStances || "暂无关键人数据"}
请按以下格式输出：

## 1. 客户关系演变叙事（约150字）
（一段连贯的叙述，描述从第一次拜访到现在，客户态度/关系深度/信任度的变化轨迹。用"从...到..."的叙事结构。）

## 2. 关键转折点
（列出1-3个改变关系走向的关键事件/拜访，说明为什么重要）

## 3. 当前态势判断
**客户热度：** 升温/平稳/降温
**依据：**（基于最近3次拜访的具体变化）

## 4. 下次拜访建议
**建议时间：** 约X天内
**建议参会人：** [具体人员] + 理由
**核心议题：**（1-2个，必须基于上次拜访的未解决问题或新出现的情报）
**开场话术：**（一句具体的开场语，引用上次拜访的某个细节）
**期望成果：**（这次拜访要达到什么具体目标）

## 5. 关系风险预警
（如果有任何信号显示关系在恶化或停滞，明确指出）

注意：所有判断必须引用具体拜访记录。如果某次拜访信息不完整，标注"第X次拜访信息不足，以下判断存在盲区"。`;

      const res = await invokeLLM({
        model: "gpt-4o",
        messages: [{ role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT }, { role: "user", content: prompt }],
      });
      const reviewContent = String(res.choices[0].message.content || "");

      // 自动更新客户关系滚动叙事（提取第1节内容）
      const narrativeMatch = reviewContent.match(/## 1\..*?\n([\s\S]*?)\n## 2/);
      if (narrativeMatch) {
        const narrative = narrativeMatch[1].trim().slice(0, 500);
        await updateClient(input.clientId, { relationshipNarrative: narrative } as any);
      }

      return { content: reviewContent, visitCount: meetings.length };
    }),

    // L2: 保存 Review 结果（SAM 自 Review 持久化）
    saveReview: protectedProcedure.input(z.object({
      clientId: z.number(),
      opportunityId: z.number().optional(),
      reviewType: z.enum(["0to1", "1toN", "buyingGroup", "visitTrend"]),
      content: z.string(),
      createdBy: z.string().optional(),
    })).mutation(async ({ input }) => {
      const id = await saveAiReview({
        clientId: input.clientId,
        opportunityId: input.opportunityId ?? null,
        reviewType: input.reviewType,
        content: input.content,
        createdBy: input.createdBy ?? null,
      });
      return { id };
    }),

    // L2: 获取某客户各类型最新 Review
    getLatestReviews: protectedProcedure.input(z.object({
      clientId: z.number(),
    })).query(async ({ input }) => {
      const reviews = await getLatestReviewsByClient(input.clientId);
      // 按 reviewType 分组，每种类型只保留最新一条
      const latestByType: Record<string, typeof reviews[0]> = {};
      for (const r of reviews) {
        const key = r.reviewType + (r.opportunityId ? `_${r.opportunityId}` : '');
        if (!latestByType[key]) latestByType[key] = r;
      }
      return Object.values(latestByType);
    }),
    // 仅供任务来源追溯：按 Review ID 批量读取已持久化的原始 Review，不混入其他客户/商机的记录。
    getByIds: protectedProcedure.input(z.object({ ids: z.array(z.number().int().positive()).max(30) })).query(async ({ input }) => {
      if (input.ids.length === 0) return [];
      const db = await getDb();
      if (!db) return [];
      const { aiReviews } = await import("../drizzle/schema");
      const { inArray } = await import("drizzle-orm");
      return db.select().from(aiReviews).where(inArray(aiReviews.id, input.ids));
    }),
    // 仅统计在指定周期内由持久化 Review 生成的任务；不将手工任务混入闭环率。
    reviewClosureMetrics: protectedProcedure.input(z.object({ period: z.enum(["week", "month"]).default("week") }).optional()).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { period: input?.period ?? "week", total: 0, completed: 0, rate: null as number | null };
      const period = input?.period ?? "week";
      const since = new Date();
      if (period === "week") since.setDate(since.getDate() - 7);
      else since.setMonth(since.getMonth() - 1);
      const { podTasks } = await import("../drizzle/schema");
      const { and, gte, isNotNull } = await import("drizzle-orm");
      const tasks = await db.select({ isCompleted: podTasks.isCompleted, taskStatus: podTasks.taskStatus }).from(podTasks).where(and(
        isNotNull(podTasks.sourceReviewId),
        gte(podTasks.createdAt, since),
      ));
      const completed = tasks.filter(task => task.isCompleted || task.taskStatus === "done").length;
      return { period, total: tasks.length, completed, rate: tasks.length ? Math.round((completed / tasks.length) * 100) : null as number | null };
    }),
    // Review 改进闭环：与上次 Review 对比的变化摘要
    getReviewDelta: protectedProcedure.input(z.object({
      clientId: z.number(),
      reviewType: z.string(),
    })).query(async ({ input }) => {
      const allReviews = await getLatestReviewsByClient(input.clientId);
      const sameType = allReviews.filter(r => r.reviewType === input.reviewType).sort((a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      if (sameType.length < 2) return null;
      const latest = sameType[0];
      const prev = sameType[1];
      const daysBetween = Math.round((new Date(latest.createdAt).getTime() - new Date(prev.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      const meddpiccHistory = await getMeddpiccHistory(input.clientId, 8);
      const meddpiccDelta: Record<string, number> = {};
      if (meddpiccHistory.length >= 2) {
        const latestSnap = meddpiccHistory[0];
        const prevSnap = meddpiccHistory[meddpiccHistory.length - 1];
        const dims = ['metricsScore','economicBuyerScore','decisionCriteriaScore','decisionProcessScore','paperProcessScore','implicatePainScore','championScore','competitionScore'];
        for (const dim of dims) {
          const delta = ((latestSnap as any)[dim] ?? 0) - ((prevSnap as any)[dim] ?? 0);
          if (delta !== 0) meddpiccDelta[dim] = delta;
        }
      }
      const db = await getDb();
      let newContacts = 0;
      let newVisits = 0;
      if (db) {
        const { keyContacts, meetingMinutes } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        const prevDate = new Date(prev.createdAt);
        const [allContacts, allMeetings] = await Promise.all([
          db.select({ id: keyContacts.id, createdAt: keyContacts.createdAt }).from(keyContacts).where(eq(keyContacts.clientId, input.clientId)),
          db.select({ id: meetingMinutes.id, meetingDate: meetingMinutes.meetingDate }).from(meetingMinutes).where(eq(meetingMinutes.clientId, input.clientId)),
        ]);
        newContacts = (allContacts as any[]).filter((c: any) => new Date(c.createdAt) > prevDate).length;
        newVisits = (allMeetings as any[]).filter((m: any) => new Date(m.meetingDate) > prevDate).length;
      }
      return { daysBetween, meddpiccDelta, newContacts, newVisits, prevReviewAt: prev.createdAt };
    }),

    // 第五入口：AD 全局战场 Review（跨客户/跨商机/跨 SAM 的指挥官视角）
    globalReview: protectedProcedure.mutation(async () => {
      const db = await getDb();
      if (!db) throw new Error("数据库不可用");
      const { clients: clientsTable, meddpicc: meddpiccTable, meetingMinutes: meetingMinutesTable, opportunities: opportunitiesTable, keyContacts: keyContactsTable } = await import('../drizzle/schema');
      const { desc: descFn } = await import('drizzle-orm');

      // 拉取全量数据
      const [allClients, allMeddpicc, allOpps, allContacts, allMeetings] = await Promise.all([
        db.select().from(clientsTable),
        db.select().from(meddpiccTable),
        db.select().from(opportunitiesTable),
        db.select({ clientId: keyContactsTable.clientId, buyingRole: keyContactsTable.buyingRole, relationship: keyContactsTable.relationship }).from(keyContactsTable),
        db.select({ clientId: meetingMinutesTable.clientId, meetingDate: meetingMinutesTable.meetingDate }).from(meetingMinutesTable).orderBy(descFn(meetingMinutesTable.meetingDate)),
      ]);

      // 构建每个客户的摘要数据
      const now = Date.now();
      const meddpiccMap = new Map(allMeddpicc.map(m => [m.clientId, m]));
      const lastVisitMap = new Map<number, Date | null>();
      const visitCountMap = new Map<number, number>();
      allMeetings.forEach(m => {
        visitCountMap.set(m.clientId, (visitCountMap.get(m.clientId) ?? 0) + 1);
        if (!lastVisitMap.has(m.clientId)) lastVisitMap.set(m.clientId, m.meetingDate);
      });
      const oppsByClient = new Map<number, typeof allOpps>();
      allOpps.forEach(o => { const list = oppsByClient.get(o.clientId) ?? []; list.push(o); oppsByClient.set(o.clientId, list); });
      const contactsByClient = new Map<number, typeof allContacts>();
      allContacts.forEach(c => { const list = contactsByClient.get(c.clientId) ?? []; list.push(c); contactsByClient.set(c.clientId, list); });

      const clientSummaries = allClients.map(c => {
        const m = meddpiccMap.get(c.id);
        const mAvg = m ? Math.round([m.metricsScore, m.economicBuyerScore, m.decisionCriteriaScore, m.decisionProcessScore, m.paperProcessScore, m.implicatePainScore, m.championScore, m.competitionScore].reduce((a, b) => a + b, 0) / 8) : 0;
        const lastVisit = lastVisitMap.get(c.id);
        const daysSinceVisit = lastVisit ? Math.floor((now - new Date(lastVisit).getTime()) / 86400000) : null;
        const opps = oppsByClient.get(c.id) ?? [];
        const contacts = contactsByClient.get(c.id) ?? [];
        const hasChampion = contacts.some(ct => ct.buyingRole === 'Champion');
        const hasEB = contacts.some(ct => ct.buyingRole === '经济决策人');
        const stageChangedAt = (c as any).stageChangedAt;
        const stageDays = stageChangedAt ? Math.floor((now - new Date(stageChangedAt).getTime()) / 86400000) : null;
        return {
          id: c.id, name: c.name, stage: c.stage,
          meddpiccAvg: mAvg, daysSinceVisit, visitCount: visitCountMap.get(c.id) ?? 0,
          oppCount: opps.length, activeOppCount: opps.filter(o => o.status === '活跃').length,
          hasChampion, hasEB, stageDays,
          assignedSamName: (c as any).assignedSamName ?? null,
        };
      });

      // 构建全局统计
      const stageDistribution = allClients.reduce((acc, c) => { acc[c.stage] = (acc[c.stage] ?? 0) + 1; return acc; }, {} as Record<string, number>);
      const activeOpps = allOpps.filter(o => o.status === '活跃');
      const stagnantClients = clientSummaries.filter(c => c.daysSinceVisit !== null && c.daysSinceVisit > 30);
      const noChampionIn1N = clientSummaries.filter(c => !c.hasChampion && c.stage === '进入商机');
      const noEBIn1N = clientSummaries.filter(c => !c.hasEB && c.stage === '进入商机');

      const stageLines = Object.entries(stageDistribution).map(([s, n]) => `- ${s}: ${n}个客户`).join('\n');
      const clientLines = clientSummaries.map(c =>
        `**${c.name}**（${c.stage}）\n  - MEDDPICC均分: ${c.meddpiccAvg}%，拜访次数: ${c.visitCount}，距上次拜访: ${c.daysSinceVisit !== null ? c.daysSinceVisit + '天' : '从未拜访'}\n  - 活跃商机: ${c.activeOppCount}个，Champion: ${c.hasChampion ? '✓已找到' : '✗未找到'}，经济决策人: ${c.hasEB ? '✓已覆盖' : '✗未覆盖'}\n  - 阶段停留: ${c.stageDays !== null ? c.stageDays + '天' : '未知'}${c.assignedSamName ? `，负责SAM: ${c.assignedSamName}` : ''}`
      ).join('\n\n');
      const stagnantNames = stagnantClients.map(c => c.name).join('、') || '无';
      const noChampionNames = noChampionIn1N.map(c => c.name).join('、') || '无';
      const noEBNames = noEBIn1N.map(c => c.name).join('、') || '无';

      const prompt = `
以下是当前所有客户的战场数据摘要：

【阶段漏斗分布】
${stageLines}

【活跃商机概览】
- 活跃商机总数: ${activeOpps.length}
- 进入商机阶段客户: ${clientSummaries.filter(c => c.stage === '进入商机').length}个

【各客户战场摘要】
${clientLines}

【风险预警】
- 超30天未拜访的客户: ${stagnantNames}
- 进入商机但无Champion的客户: ${noChampionNames}
- 进入商机但无经济决策人的客户: ${noEBNames}

请从以下五个维度进行全局战场 Review，每个维度给出具体的数据支撑和行动建议：

## 1. 整体漏斗健康度评估
（各阶段分布是否合理？是否有阶段严重积压？转化率预判）

## 2. 基于事实的资源投入建议
（哪些客户出现了应升级处理的风险或购买信号？证据是什么？）

## 3. 本季度赢单风险分析
（哪些商机最有可能赢单？哪些商机存在高风险？关键阻碍是什么？）

## 4. 团队能力短板识别
（从数据模式看，整个团队在哪个销售环节系统性偏弱？Champion 找人/MEDDPICC 某维度/拜访频率？）

## 5. AD 本周三件优先行动
（作为指挥官，你本周最应该亲自介入的三件事是什么？）

请用中文回答，数据驱动，直接给出结论，不要泛泛而谈。`;

      const res = await invokeLLM({
        model: "gpt-4o",
        messages: [{ role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT }, { role: "user", content: prompt }],
      });
      const content = String(res.choices[0].message.content || "");
      return { content, clientCount: allClients.length, activeOppCount: activeOpps.length, stagnantCount: stagnantClients.length };
    }),

    // AD Review SAM 教练视角（跨商机聚合分析单个 SAM 的能力模式）
    samCoachReview: protectedProcedure.input(z.object({
      samId: z.number(),
      samName: z.string(),
    })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("数据库不可用");
      const { clients: clientsTable, meddpicc: meddpiccTable, meetingMinutes: meetingMinutesTable, opportunities: opportunitiesTable, keyContacts: keyContactsTable } = await import('../drizzle/schema');
      const { eq: eqFn, desc: descFn } = await import('drizzle-orm');

      // 获取该 SAM 名下所有客户
      const samClients = await db.select().from(clientsTable).where(eqFn(clientsTable.assignedSamId, input.samId));
      if (samClients.length === 0) {
        return { content: `${input.samName} 目前名下没有分配客户，无法生成教练 Review。`, samName: input.samName, clientCount: 0 };
      }
      const clientIds = samClients.map(c => c.id);

      // 并行拉取所有相关数据
      const [allMeddpicc, allOpps, allContacts, allMeetings] = await Promise.all([
        db.select().from(meddpiccTable),
        db.select().from(opportunitiesTable),
        db.select({ clientId: keyContactsTable.clientId, buyingRole: keyContactsTable.buyingRole, championAccessToPower: keyContactsTable.championAccessToPower, championPoliticalWill: keyContactsTable.championPoliticalWill, championCredibility: keyContactsTable.championCredibility }).from(keyContactsTable),
        db.select({ clientId: meetingMinutesTable.clientId, meetingDate: meetingMinutesTable.meetingDate }).from(meetingMinutesTable).orderBy(descFn(meetingMinutesTable.meetingDate)),
      ]);

      const now = Date.now();
      // 过滤出该 SAM 名下的数据
      const meddpiccMap = new Map(allMeddpicc.filter(m => clientIds.includes(m.clientId)).map(m => [m.clientId, m]));
      const oppsByClient = new Map<number, typeof allOpps>();
      allOpps.filter(o => clientIds.includes(o.clientId)).forEach(o => { const list = oppsByClient.get(o.clientId) ?? []; list.push(o); oppsByClient.set(o.clientId, list); });
      const contactsByClient = new Map<number, typeof allContacts>();
      allContacts.filter(c => clientIds.includes(c.clientId)).forEach(c => { const list = contactsByClient.get(c.clientId) ?? []; list.push(c); contactsByClient.set(c.clientId, list); });
      const visitCountMap = new Map<number, number>();
      const lastVisitMap = new Map<number, Date | null>();
      allMeetings.filter(m => clientIds.includes(m.clientId)).forEach(m => {
        visitCountMap.set(m.clientId, (visitCountMap.get(m.clientId) ?? 0) + 1);
        if (!lastVisitMap.has(m.clientId)) lastVisitMap.set(m.clientId, m.meetingDate);
      });

      // 计算 MEDDPICC 各维度均分
      const dimKeys = ['metricsScore','economicBuyerScore','decisionCriteriaScore','decisionProcessScore','paperProcessScore','implicatePainScore','championScore','competitionScore'] as const;
      const dimLabels = ['M-可量化价值','E-预算决策人','D1-决策标准','D2-决策流程','P-采购流程','I-痛点影响','C1-Champion','C2-竞争'];
      const dimSums = new Array(8).fill(0);
      const dimCounts = new Array(8).fill(0);
      for (const [, m] of Array.from(meddpiccMap)) {
        dimKeys.forEach((k, i) => {
          const v = (m as any)[k];
          if (v !== null && v !== undefined) { dimSums[i] += v; dimCounts[i]++; }
        });
      }
      const dimAvgs = dimSums.map((s, i) => dimCounts[i] > 0 ? Math.round(s / dimCounts[i]) : 0);
      const weakestDims = dimAvgs.map((v, i) => ({ label: dimLabels[i], score: v })).sort((a, b) => a.score - b.score).slice(0, 3);

      // 计算阶段分布
      const stageDistribution = samClients.reduce((acc, c) => { acc[c.stage] = (acc[c.stage] ?? 0) + 1; return acc; }, {} as Record<string, number>);
      const activeOpps = allOpps.filter(o => clientIds.includes(o.clientId) && o.status === '活跃');
      const wonOpps = allOpps.filter(o => clientIds.includes(o.clientId) && o.status === '赢单');
      const lostOpps = allOpps.filter(o => clientIds.includes(o.clientId) && o.status === '丢单');
      const winRate = (wonOpps.length + lostOpps.length) > 0 ? Math.round(wonOpps.length / (wonOpps.length + lostOpps.length) * 100) : null;

      // Champion 质量分析
      const allChampions = Array.from(contactsByClient.values()).flat().filter(c => c.buyingRole === 'Champion');
      const noChampionClients = samClients.filter(c => {
        const contacts = contactsByClient.get(c.id) ?? [];
        return !contacts.some(ct => ct.buyingRole === 'Champion') && c.stage !== '建图';
      });

      // 拜访频率分析
      const avgVisitCount = clientIds.length > 0 ? (Array.from(visitCountMap.values()).reduce((a, b) => a + b, 0) / clientIds.length).toFixed(1) : '0';
      const stagnantClients = samClients.filter(c => {
        const lastVisit = lastVisitMap.get(c.id);
        return !lastVisit || Math.floor((now - new Date(lastVisit).getTime()) / 86400000) > 30;
      });

      const clientSummaryLines = samClients.map(c => {
        const m = meddpiccMap.get(c.id);
        const mAvg = m ? Math.round(dimKeys.reduce((s, k) => s + ((m as any)[k] ?? 0), 0) / 8) : 0;
        const opps = oppsByClient.get(c.id) ?? [];
        const contacts = contactsByClient.get(c.id) ?? [];
        const hasChampion = contacts.some(ct => ct.buyingRole === 'Champion');
        const hasEB = contacts.some(ct => ct.buyingRole === '经济决策人');
        const lastVisit = lastVisitMap.get(c.id);
        const daysSince = lastVisit ? Math.floor((now - new Date(lastVisit).getTime()) / 86400000) : null;
        return `- **${c.name}**（${c.stage}）MEDDPICC均分:${mAvg}% Champion:${hasChampion?'✓':'✗'} EB:${hasEB?'✓':'✗'} 拜访:${visitCountMap.get(c.id)??0}次 距上次:${daysSince!==null?daysSince+'天':'从未'} 活跃商机:${opps.filter(o=>o.status==='活跃').length}个`;
      }).join('\n');

      const prompt = `正在对 SAM **${input.samName}** 进行教练 Review。

【${input.samName} 负责的客户概览】
${clientSummaryLines}

【MEDDPICC 各维度均分】
${dimAvgs.map((v, i) => `- ${dimLabels[i]}: ${v}%`).join('\n')}
最薄弱的3个维度：${weakestDims.map(d => `${d.label}(${d.score}%)`).join('、')}

【阶段漏斗分布】
${Object.entries(stageDistribution).map(([s, n]) => `- ${s}: ${n}个`).join('\n')}

【商机数据】
- 活跃商机: ${activeOpps.length}个
- 赢单: ${wonOpps.length}个 | 输单: ${lostOpps.length}个 | 赢单率: ${winRate !== null ? winRate + '%' : '暂无已结案商机'}

【Champion 质量】
- 已找到 Champion 的客户: ${samClients.length - noChampionClients.length}/${samClients.length}
- 进入商机/找人阶段但无 Champion 的客户: ${noChampionClients.map(c => c.name).join('、') || '无'}

【拜访频率】
- 平均每客户拜访次数: ${avgVisitCount}次
- 超30天未拜访的客户: ${stagnantClients.map(c => c.name).join('、') || '无'}

请从以下四个维度对 ${input.samName} 进行教练 Review，每个维度给出具体数据支撑和辅导建议：

## 1. 整体能力评估
（基于数据，这个 SAM 的整体打单能力处于什么水平？优势和短板各是什么？）

## 2. MEDDPICC 系统性短板
（哪个维度系统性偏低？根本原因是什么？建议如何针对性提升？）

## 3. Champion 找人能力诊断
（Champion 识别和培养的质量如何？有哪些改进空间？）

## 4. AD 辅导建议（本季度重点）
（作为 AD，你建议本季度重点辅导 ${input.samName} 的哪 3 件事？每件事给出具体的行动建议。）

请用中文回答，数据驱动，直接给出结论，避免泛泛而谈。`;

      const res = await invokeLLM({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT }, { role: "user", content: prompt }],
      });
      const content2 = String(res.choices[0].message.content || "");
      return {
        content: content2,
        samName: input.samName,
        clientCount: samClients.length,
        dimAvgs,
        dimLabels,
        weakestDims,
        winRate,
        stagnantCount: stagnantClients.length,
        noChampionCount: noChampionClients.length,
      };
    }),

    // ── 辅导 Action Items ────────────────────────────────────────────────────
    // AD 下发辅导建议（从教练 Review 中提取并保存 Action Items）
    createCoachingActions: protectedProcedure.input(z.object({
      samId: z.number(),
      samName: z.string(),
      actions: z.array(z.object({
        title: z.string(),
        description: z.string().optional(),
        dueDate: z.string().optional(), // ISO date string
        clientId: z.number().optional(),
      })),
      createdBy: z.string().optional(),
    })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("数据库不可用");
      const { coachingActions } = await import('../drizzle/schema');
      const inserted = [];
      for (const a of input.actions) {
        const [r] = await db.insert(coachingActions).values({
          samId: input.samId,
          samName: input.samName,
          clientId: a.clientId ?? null,
          title: a.title,
          description: a.description ?? null,
          dueDate: a.dueDate ? new Date(a.dueDate) : null,
          createdBy: input.createdBy ?? null,
        });
        inserted.push((r as any).insertId);
      }
      return { count: inserted.length, ids: inserted };
    }),

    // SAM 查询自己的辅导 Action Items
    listCoachingActions: publicProcedure.input(z.object({
      samId: z.number(),
    })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const { coachingActions } = await import('../drizzle/schema');
      const { eq: eqFn, desc: descFn } = await import('drizzle-orm');
      return db.select().from(coachingActions).where(eqFn(coachingActions.samId, input.samId)).orderBy(descFn(coachingActions.createdAt));
    }),

    // 获取所有辅导 Action Items（AD 视角）
    listAllCoachingActions: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const { coachingActions } = await import('../drizzle/schema');
      const { desc: descFn } = await import('drizzle-orm');
      return db.select().from(coachingActions).orderBy(descFn(coachingActions.createdAt));
    }),

    // SAM 标记辅导 Action Item 完成
    completeCoachingAction: publicProcedure.input(z.object({
      id: z.number(),
    })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("数据库不可用");
      const { coachingActions } = await import('../drizzle/schema');
      const { eq: eqFn } = await import('drizzle-orm');
      await db.update(coachingActions).set({ isCompleted: true, completedAt: new Date() }).where(eqFn(coachingActions.id, input.id));
      return { ok: true };
    }),

    // 提交执行反馈（SAM 完成后填写简短反馈）
    submitCoachingFeedback: publicProcedure.input(z.object({
      id: z.number(),
      feedback: z.string(),
      markCompleted: z.boolean().optional(),
    })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("数据库不可用");
      const { coachingActions } = await import('../drizzle/schema');
      const { eq: eqFn } = await import('drizzle-orm');
      const updateData: any = { executionFeedback: input.feedback };
      if (input.markCompleted) { updateData.isCompleted = true; updateData.completedAt = new Date(); }
      await db.update(coachingActions).set(updateData).where(eqFn(coachingActions.id, input.id));
      return { ok: true };
    }),

    // 删除辅导 Action Item
    deleteCoachingAction: publicProcedure.input(z.object({
      id: z.number(),
    })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("数据库不可用");
      const { coachingActions } = await import('../drizzle/schema');
      const { eq: eqFn } = await import('drizzle-orm');
      await db.delete(coachingActions).where(eqFn(coachingActions.id, input.id));
      return { ok: true };
    }),

    // ── AD 问询问题生成（区分 0→1 / 1→N 阶段）────────────────────────────────
    generateAdInquiry: publicProcedure.input(z.object({
      clientId: z.number(),
      opportunityId: z.number().optional(),
      stageType: z.enum(["0to1", "1toN"]),
    })).mutation(async ({ input }) => {
      const [client, contacts, meetings, meddpicc] = await Promise.all([
        getClientById(input.clientId),
        getContactsByClientId(input.clientId),
        getMeetingsByClientId(input.clientId),
        getMeddpiccByClientId(input.clientId),
      ]);
      if (!client) throw new Error("客户不存在");

      const stage = client.stage;
      const recentVisitSummary = meetings.slice(0, 2).map((m: any, i: number) => {
        const date = new Date(m.meetingDate).toLocaleDateString("zh-CN");
        const summary = (m.aiMinutes || m.keyPoints || "").slice(0, 150);
        return `第${i+1}次（${date}）：${summary}`;
      }).join("\n") || "暂无拜访记录";

      const champion = contacts.find(c => c.buyingRole === "Champion" || c.relationship === "Champion");
      const championInfo = champion
        ? `${champion.name}（${champion.title || ""}），Champion三维评分：Access ${(champion as any).championAccessToPower ?? 0}/Will ${(champion as any).championPoliticalWill ?? 0}/Credibility ${(champion as any).championCredibility ?? 0}，非正式接触：${(champion as any).informalContactCount ?? 0}次`
        : "尚未确认Champion";

      const meddpiccDims = meddpicc ? [
        { name: "M（可量化价值）", score: meddpicc.metricsScore },
        { name: "E（经济买家）", score: meddpicc.economicBuyerScore },
        { name: "D（决策标准）", score: meddpicc.decisionCriteriaScore },
        { name: "D2（决策流程）", score: meddpicc.decisionProcessScore },
        { name: "P（采购流程）", score: meddpicc.paperProcessScore },
        { name: "I（痛点识别）", score: meddpicc.implicatePainScore },
        { name: "C（Champion）", score: meddpicc.championScore },
        { name: "C2（竞争态势）", score: meddpicc.competitionScore },
      ].sort((a, b) => a.score - b.score).slice(0, 3).map(d => `${d.name}：${d.score}分`).join("，") : "暂无评分";

      const prompt = `生成3个针对性问题，帮助AD判断SAM的数据录入是否真实、推进判断是否准确。
问题必须是"只有真正做过这件事的人才能回答的"，不能是可以靠猜测回答的问题。

当前阶段类型: ${input.stageType === "0to1" ? "0→1（客户开发阶段）" : "1→N（商机赢单阶段）"}
客户名称: ${client.name}
当前阶段: ${stage}
MEDDPICC最薄弱3个维度: ${meddpiccDims}
最近拜访摘要: ${recentVisitSummary}
Champion信息: ${championInfo}

${input.stageType === "0to1" ? `如果是0→1阶段，问题聚焦于：
- 关系真实性（你是怎么判断这个人信任你了？他说了什么让你得出这个判断？）
- 信息来源（这个痛点是客户自己说的还是你推断的？他的原话是什么？）
- 关系深度（你们有没有在正式会议以外见过面？他主动联系过你吗？）` : `如果是1→N阶段，问题聚焦于：
- MEDDPICC评分证据（你把这个维度打X分，最近哪次拜访支持这个判断？）
- Champion行动力（Champion上次帮你做了什么具体动作？不是说支持，是做了什么？）
- 竞争态势（客户有没有同时在评估竞品？你怎么知道的？）
- Paper Process（采购流程走到哪一步了？谁在推动？）`}

输出格式（严格遵守）：
问题1: [具体问题]（考察维度：XXX）
问题2: [具体问题]（考察维度：XXX）
问题3: [具体问题]（考察维度：XXX）

附：如果SAM答不出这些问题，说明什么（给AD的参考判断，2-3句话）`;

      const res = await invokeLLM({
        model: "gpt-4o",
        messages: [{ role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT }, { role: "user", content: prompt }],
      });
      return { content: String(res.choices[0].message.content || ""), stageType: input.stageType, clientName: client.name, stage };
    }),

    // ── AD 问询辅导建议生成（基于 SAM 回答记录）────────────────────────────────
    generateCoachingSummary: publicProcedure.input(z.object({
      clientId: z.number(),
      stageType: z.enum(["0to1", "1toN"]),
      inquiryQuestions: z.string(),  // AI 生成的问题原文
      samAnswerNotes: z.string(),    // AD 记录的 SAM 回答
    })).mutation(async ({ input }) => {
      const client = await getClientById(input.clientId);
      if (!client) throw new Error("客户不存在");
      const is0to1 = input.stageType === "0to1";
      const stageLabel = is0to1 ? "0→1 客户开发" : "1→N 商机赢单";
      const stageContext = is0to1
        ? `这是0→1阶段（当前：${client.stage}），核心是"人的问题"——关系建立、信任深度、真实信息获取。辅导重点应聚焦于：关系质量判断、非正式接触能力、Champion识别和培育方法。不要给产品或方案建议。`
        : `这是1→N阶段（当前：${client.stage}），核心是"赢单的问题"——商机健康度、Champion推动力、决策流程掌握。辅导重点应聚焦于：MEDDPICC薄弱维度补强、Champion行动力提升、竞争态势应对。`;
      const prompt = `
客户：${client.name}（阶段：${client.stage}）
Review类型：${stageLabel}
阶段背景：${stageContext}

【AD 提出的问询问题】
${input.inquiryQuestions}

【AD 记录的 SAM 回答情况】
${input.samAnswerNotes}

请根据以上信息，生成一段简短的辅导建议（200字以内），格式如下：

**整体判断：** [一句话评估 SAM 对这个客户/商机的掌握程度：扎实/存在盲区/需要重点辅导]

**核心问题：** [SAM 最薄弱的1-2个方面，必须具体，针对${is0to1 ? "关系建立和信任深度" : "赢单机制和商机推进"}]

**辅导建议：** [AD 接下来应该怎么辅导，给出1-2个具体可执行的动作，${is0to1 ? "侧重关系教练方法" : "侧重赢单策略和Champion培养"}]

**下次 Review 关注点：** [下次 Review 时重点核查什么，${is0to1 ? "聚焦关系深度变化" : "聚焦商机推进动作"}]

注意：如果 SAM 回答记录为空或内容不足，直接说明"回答记录不足，无法生成有效辅导建议，建议补充记录后重试"。`;
      const res = await invokeLLM({
        model: "gpt-4o",
        messages: [{ role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT }, { role: "user", content: prompt }],
      });
      return { content: String(res.choices[0].message.content || ""), stageType: input.stageType, stageLabel, clientStage: client.stage };
    }),

    // ── 数据缺口报告 ──────────────────────────────────────────────────────────
    dataGapReport: protectedProcedure.query(async () => {
      const clients = await getAllClients();
      const db = await getDb();
      if (!db) return [];
      const { keyContacts: kc, meetingMinutes: mm, clientMetrics: cm } = await import('../drizzle/schema');
      const { eq: eqFn, count: countFn } = await import('drizzle-orm');
      const results = await Promise.all(clients.map(async (client: any) => {
        const [contactCount] = await db.select({ cnt: countFn() }).from(kc).where(eqFn(kc.clientId, client.id));
        const [meetingCount] = await db.select({ cnt: countFn() }).from(mm).where(eqFn(mm.clientId, client.id));
        const [metricsRow] = await db.select({ id: cm.id }).from(cm).where(eqFn(cm.clientId, client.id)).limit(1);
        const gaps: string[] = [];
        if ((contactCount?.cnt ?? 0) === 0) gaps.push('无关键人');
        if ((meetingCount?.cnt ?? 0) === 0) gaps.push('无拜访记录');
        if (!metricsRow) gaps.push('无效能基线');
        const meddpicc = client.meddpicc || {};
        const meddpiccFilled = Object.values(meddpicc).filter((v: any) => v > 0).length;
        if (meddpiccFilled < 4) gaps.push('MEDDPICC不完整');
        if (!client.assignedSamId) gaps.push('未分配SAM');
        return { clientId: client.id, clientName: client.name, priority: client.priority, stage: client.stage, assignedSamName: client.assignedSamName || '未分配', gaps, score: Math.max(0, 100 - gaps.length * 20) };
      }));
      return results.sort((a, b) => a.score - b.score);
    }),
    // ── 手动触发每日简报（推送个人通知）──────────────────────────────────────
    triggerDailyBriefing: protectedProcedure.mutation(async () => {
      const { notifyOwner } = await import('./_core/notification');
      const reportData = await getWeeklyReportData();
      if (!reportData) return { ok: false, message: "暂无客户数据", briefing: "" };
      const { allClients: clients, meddpiccData, latestScores, recentSignals, pendingTasks } = reportData;
      const today = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
      const clientSummaries = clients.map((client: any) => {
        const meddpicc = meddpiccData.find((m: any) => m.clientId === client.id);
        const latestScore = latestScores.find((s: any) => s.clientId === client.id);
        const recentSignalsForClient = recentSignals.filter((s: any) => s.clientId === client.id);
        const pendingTasksForClient = pendingTasks.filter((t: any) => t.clientId === client.id);
        const avgScore = meddpicc ? Math.round((meddpicc.metricsScore + meddpicc.economicBuyerScore + meddpicc.decisionCriteriaScore + meddpicc.decisionProcessScore + meddpicc.paperProcessScore + meddpicc.implicatePainScore + meddpicc.championScore + meddpicc.competitionScore) / 8) : 0;
        return { name: client.name, stage: client.stage, priority: client.priority, meddpiccScore: avgScore, opportunityScore: latestScore?.overallScore ?? null, riskLevel: latestScore?.riskLevel ?? null, recentSignalsCount: recentSignalsForClient.length, pendingTasksCount: pendingTasksForClient.length, topSignal: recentSignalsForClient[0]?.rawSignal?.slice(0, 100) ?? null };
      });
      const rssDigest = await getComplianceRssDigest(5);
      const prompt = buildDailyBriefingPrompt({ today, clientSummaries, rssDigest });
      const llmResult = await invokeLLM({ messages: [{ role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT }, { role: "user", content: prompt }] });
      const briefing = typeof llmResult.choices[0]?.message?.content === "string" ? llmResult.choices[0].message.content : "";
      if (!briefing) return { ok: false, message: "AI 生成失败", briefing: "" };
      await notifyOwner({ title: `📊 每日战情简报 · ${today}`, content: briefing.slice(0, 2000) });
      return { ok: true, briefing, today, message: "简报已生成并推送" };
    }),
  }),

  // ── Champion Ammo ─────────────────────────────────────────────────────────
  champion: router({
    listByClient: publicProcedure.input(z.object({ clientId: z.number() })).query(({ input }) =>
      getAmmoByClientId(input.clientId)
    ),
        generate: publicProcedure.input(z.object({
      clientId: z.number(),
      clientName: z.string(),
      industry: z.string().optional(),
      securityAngle: z.string().optional(),
      notes: z.string().optional(),
      championName: z.string(),
      ammoType: z.enum(["竞品对标", "合规风险量化", "ROI测算"]),
    })).mutation(async ({ input }) => {
      // Load product docs from arsenal as primary knowledge source
      const arsenalDocs = await (async () => {
        try {
          const { getDb } = await import('./db.js');
          const db = await getDb();
          if (!db) return [];
          const { productDocs } = await import('../drizzle/schema');
          return db.select({
            title: productDocs.title,
            productLine: productDocs.productLine,
            description: productDocs.description,
            extractedText: productDocs.extractedText,
          }).from(productDocs).limit(8);
        } catch { return []; }
      })();
      const docsSection = arsenalDocs.length > 0
        ? `【武器库产品文档（第一知识来源，优先引用）】\n` +
          arsenalDocs.map((d: any) => {
            const content = d.extractedText ? d.extractedText.slice(0, 600) : (d.description || '');
            return `[${d.productLine || '产品'}] ${d.title}\n${content}`;
          }).join('\n---\n')
        : `【武器库产品文档】\n暂无上传文档。请在武器库中上传产品资料以提升生成质量。`;
      const knowledgeNote = arsenalDocs.length > 0
        ? `\n\n⚠️ 知识来源说明：\n- 标注「📄 来自武器库」的内容来自已上传的产品文档，可直接使用\n- 标注「🌐 通用知识」的内容来自AI训练数据，请结合实际产品资料核实后使用`
        : `\n\n⚠️ 知识来源说明：武器库暂无产品文档，本内容完全基于AI通用知识生成，请务必结合实际产品资料核实后再使用。`;
      let prompt = "";
      if (input.ammoType === "竞品对标") {
        prompt = `请为${input.clientName}的内部Champion（${input.championName}）生成一份《竞品对标分析》，用于其在内部推动立项时使用。
安全切入点：${input.securityAngle || "综合安全方案"}
客户背景：${input.notes || "无"}

${docsSection}

【生成规则】
1. 优先从武器库文档中提取产品能力和差异化优势，引用时标注「📄 来自武器库」
2. 武器库文档中没有的内容，使用AI通用行业知识补充，标注「🌐 通用知识（请核实）」
3. 不要编造具体数字或案例，如无依据请用「[待补充]」占位

格式为Markdown，包含：
## 竞品对标分析
### 主要竞争对手对比表
（列出3个主要竞品，从功能覆盖、本地化支持、合规认证、价格、服务响应5个维度对比，标注每项数据来源）
### 差异化优势总结
（3条核心差异化，每条标注来源）
### Champion内部推荐话术
（Champion向决策层推荐时可直接使用的3句话）
${knowledgeNote}`;
      } else if (input.ammoType === "合规风险量化") {
        prompt = `请为${input.clientName}的内部Champion（${input.championName}）生成一份《合规风险量化分析》，用于其在内部推动立项时使用。
行业：${input.industry || "科技"}
客户背景：${input.notes || "无"}

${docsSection}

【生成规则】
1. 优先从武器库文档中提取合规能力和认证信息，引用时标注「📄 来自武器库」
2. 合规法规数据（罚款金额、监管要求等）来自通用知识，标注「🌐 通用知识（请核实）」
3. 不要编造具体案例，如无依据请用「[待补充]」占位

格式为Markdown，包含：
## 合规风险量化分析
### 当前面临的主要合规风险
（列出3-4个具体合规风险，每个风险注明：监管来源、违规后果、量化损失估算，标注数据来源）
### 不行动的代价
（如果不采取安全措施，未来12个月内可能面临的具体风险事件和损失）
### 合规投入ROI测算
（安全投入 vs. 潜在损失的对比，给出明确的投资回报比）
${knowledgeNote}`;
      } else {
        prompt = `请为${input.clientName}的内部Champion（${input.championName}）生成一份《ROI测算初稿》，用于其在内部申请预算时使用。
安全切入点：${input.securityAngle || "综合安全方案"}
客户背景：${input.notes || "无"}

${docsSection}

【生成规则】
1. 优先从武器库文档中提取产品定价、实施周期等信息，引用时标注「📄 来自武器库」
2. 行业基准数据来自通用知识，标注「🌐 通用知识（请核实）」
3. 不要编造具体数字，如无依据请用「[待补充]」占位

格式为Markdown，包含：
## ROI测算分析
### 投资假设
（方案规模、实施周期、主要成本项，标注数据来源）
### 收益量化
（安全事件预防节省、合规罚款规避、运营效率提升，每项给出具体数字并标注来源）
### 3年TCO对比
（自建 vs. 采购AIStorm方案的总拥有成本对比）
### 建议预算申请额度
（给出具体数字和依据）
${knowledgeNote}`;
      }

      const res = await invokeLLM({
        model: "gpt-4o",
        messages: [{ role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT }, { role: "user", content: prompt }],
      });

      const content = String(res.choices[0].message.content || "");
      const id = await insertAmmo({
        clientId: input.clientId,
        championName: input.championName,
        ammoType: input.ammoType,
        content,
      });
      return { id, content };
    }),
  }),

  // ── Meeting Minutes ───────────────────────────────────────────────────────
  meetings: router({
    listByClient: publicProcedure.input(z.object({ clientId: z.number() })).query(({ input }) =>
      getMeetingsByClientId(input.clientId)
    ),
    /**
     * AI 原生 P0：一条拜访输入只触发一次严格 JSON Schema 解析。
     * 解析结果先存入会议记录，任何客户/商机事实都必须由 SAM 在前端确认后才写入。
     */
    extractFullSignals: protectedProcedure.input(z.object({
      clientId: z.number(),
      clientName: z.string(),
      meetingDate: z.string(),
      visitType: z.string().optional(),
      attendees: z.string().optional(),
      keyPoints: z.string(),
      transcriptText: z.string().optional(),
      contactType: z.enum(["formal_meeting", "dinner_meeting", "phone_call", "video_call", "instant_message", "event", "customer_initiated"]).optional(),
      initiatedBy: z.enum(["sam", "customer", "mutual"]).optional(),
    })).mutation(async ({ input }) => {
      const sourceText = input.transcriptText
        ? `【会议原文】\n${input.transcriptText}\n\n【SAM 补充】\n${input.keyPoints}`
        : `【SAM 记录】\n${input.keyPoints}`;
      const accountContext = await getAccountDiagnosticContext(input.clientId);
      const prompt = `你现在是 SAM 的拜访后作战引导助手。SAM 只负责如实记录发生了什么；你必须从以下记录中一次性提取可验证事实，供 SAM 确认。\n\n客户：${input.clientName}\n日期：${input.meetingDate}\n拜访类型：${input.visitType || "拜访"}\n参会人：${input.attendees || "数据不足"}\n接触方式：${input.contactType || "数据不足"}\n发起方：${input.initiatedBy || "数据不足"}\n\n${sourceText}\n\n${accountContext}\n\n【严格规则】\n1. 只提取记录中明确出现或可逐字定位的客户事实；禁止猜测客户意图、预算、人物立场或竞争态势。\n2. 没有明确证据的数组返回空数组，字段无法确认则返回 null；不要为了填满字段而创作。\n3. suggestedScore 只能是 0/25/50/75/100，且 evidence 必须包含原话或可回溯表述。\n4. 关键人角色只在记录明确说明其决策职责或行为时填写；否则为“未知”。\n5. nextBestAction 必须是 SAM 下一次要验证的一件事，不能是产品推销动作。\n6. meetingSummary 用不超过120字概括本次已确认事实与未确认边界。\n7. 按给定 JSON Schema 返回，JSON 外不得输出任何文字。`;
      const result = await invokeLLM({
        model: "gpt-5-mini",
        maxCompletionTokens: 2200,
        reasoning: { effort: "low" },
        messages: [{ role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT }, { role: "user", content: prompt }],
        response_format: { type: "json_schema", json_schema: { name: "full_meeting_signals", strict: true, schema: FULL_MEETING_SIGNALS_RESPONSE_SCHEMA } },
      });
      const raw = getLLMTextContent(result.choices[0]?.message.content);
      if (!raw) throw new TRPCError({ code: "BAD_GATEWAY", message: "AI 未返回可确认的拜访信号。本次未保存，请稍后重试。" });
      let parsed: unknown;
      try { parsed = JSON.parse(extractJSON(raw)); } catch { throw new TRPCError({ code: "BAD_GATEWAY", message: "AI 返回格式无效。本次未保存，请稍后重试。" }); }
      const signals = normalizeFullMeetingSignals(parsed);
      const aiMinutes = `## 拜访作战日志\n\n${signals.meetingSummary}\n\n### 下一步需验证\n${signals.nextBestAction}`;
      const id = await insertMeeting({
        clientId: input.clientId, meetingDate: new Date(input.meetingDate), visitType: input.visitType,
        attendees: input.attendees, keyPoints: input.keyPoints, transcriptText: input.transcriptText,
        aiMinutes, contactType: input.contactType, initiatedBy: input.initiatedBy, entrySource: "manual",
      });
      const db = await getDb();
      if (db && id) {
        const { meetingMinutes } = await import("../drizzle/schema");
        await db.update(meetingMinutes).set({ aiFullSignals: { version: AI_NATIVE_GUIDANCE_VERSION, generatedAt: new Date().toISOString(), ...signals }, aiFullSignalsConfirmedKeys: [] }).where(eq(meetingMinutes.id, id));
      }
      setImmediate(() => triggerSingleClientRefresh(input.clientId));
      return { id, signals };
    }),
    /** 人工确认后才将选择的信号沉淀到对应事实表；未确认项目只保留在原拜访记录中。 */
    confirmFullSignals: protectedProcedure.input(z.object({
      meetingId: z.number(), clientId: z.number(), opportunityId: z.number().optional(), confirmedKeys: z.array(z.string()).min(1),
    })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库暂不可用" });
      const { meetingMinutes, keyContacts, opportunityMeddpicc, threeWhy, competitionMap, intelligenceSignals } = await import("../drizzle/schema");
      const [meeting] = await db.select().from(meetingMinutes).where(eq(meetingMinutes.id, input.meetingId)).limit(1);
      if (!meeting || meeting.clientId !== input.clientId) throw new TRPCError({ code: "NOT_FOUND", message: "未找到对应拜访记录" });
      const signals = normalizeFullMeetingSignals((meeting as any).aiFullSignals);
      const selected = new Set(input.confirmedKeys);
      const applied: string[] = [];
      const confirmedBefore = new Set(Array.isArray((meeting as any).aiFullSignalsConfirmedKeys) ? (meeting as any).aiFullSignalsConfirmedKeys : []);

      for (const item of signals.meddpiccUpdates) {
        const key = `meddpicc:${item.dim}`;
        if (!selected.has(key) || confirmedBefore.has(key)) continue;
        const fields = MEDDPICC_FIELD_MAP[item.dim];
        const score = item.suggestedScore / 25;
        const note = `[拜访 #${meeting.id} · ${new Date(meeting.meetingDate).toLocaleDateString("zh-CN")}] ${item.evidence}`;
        if (input.opportunityId) {
          const [existing] = await db.select().from(opportunityMeddpicc).where(eq(opportunityMeddpicc.opportunityId, input.opportunityId)).limit(1);
          const values = { [fields.score]: score, [fields.notes]: note, updatedAt: new Date() } as any;
          if (existing) await db.update(opportunityMeddpicc).set(values).where(eq(opportunityMeddpicc.opportunityId, input.opportunityId));
          else await db.insert(opportunityMeddpicc).values({ opportunityId: input.opportunityId, clientId: input.clientId, ...values });
        } else {
          await upsertMeddpicc(input.clientId, { [fields.score]: score, [fields.notes]: note } as any);
        }
        applied.push(key);
      }

      for (let index = 0; index < signals.contactDiscoveries.length; index += 1) {
        const item = signals.contactDiscoveries[index]; const key = `contact:${index}`;
        if (!selected.has(key) || confirmedBefore.has(key)) continue;
        const existingContacts = await db.select().from(keyContacts).where(eq(keyContacts.clientId, input.clientId));
        const matched = existingContacts.find((contact: any) => contact.name === item.name);
        const buyingRoleMap: Record<string, any> = { "用户决策人": "用户影响者", "内线": "内部线人", "反对者": "阻碍者" };
        const values = { title: item.title || undefined, buyingRole: buyingRoleMap[item.buyingRole] || item.buyingRole, stance: item.attitude, notes: `[拜访 #${meeting.id}] ${item.evidence}` } as any;
        if (matched) await db.update(keyContacts).set(values).where(eq(keyContacts.id, matched.id));
        else await insertContact({ clientId: input.clientId, name: item.name, influence: item.buyingRole === "Champion" ? "Champion候选" : "影响者", relationship: "已接触", ...values } as any);
        applied.push(key);
      }

      for (let index = 0; index < signals.timeSignals.length; index += 1) {
        const item = signals.timeSignals[index]; const key = `time:${index}`;
        if (!selected.has(key) || confirmedBefore.has(key)) continue;
        await db.insert(intelligenceSignals).values({
          clientId: input.clientId,
          opportunityId: input.opportunityId || null,
          rawSignal: item.date ? `${item.description}（时间：${item.date}）` : item.description,
          signalType: "其他",
          aiInterpretation: `[拜访 #${meeting.id}] 经 SAM 确认的${item.type === "deadline" ? "截止期" : item.type === "budget_cycle" ? "预算周期" : "触发事件"}事实。`,
          aiRecommendation: "在下一次客户沟通中继续确认时间节点的负责人、影响范围与不可逆后果。",
          urgency: item.type === "deadline" ? "高" : "中",
        });
        applied.push(key);
      }

      if (input.opportunityId) {
        for (let index = 0; index < signals.competitorMentions.length; index += 1) {
          const item = signals.competitorMentions[index]; const key = `competitor:${index}`;
          if (!selected.has(key) || confirmedBefore.has(key)) continue;
          await db.insert(competitionMap).values({ clientId: input.clientId, opportunityId: input.opportunityId, competitorType: item.competitorName, controlPoints: item.context, riskScore: item.threatLevel === "high" ? 5 : item.threatLevel === "medium" ? 3 : 1, nextStep: "继续核验竞品影响的决策标准" });
          applied.push(key);
        }
        const whyUpdates: Record<string, string> = {};
        if (selected.has("threewhy:change") && signals.threeWhyUpdates.whyChange) { whyUpdates.whyChangeClaim = signals.threeWhyUpdates.whyChange; whyUpdates.whyChangeEvidence = `[拜访 #${meeting.id}] ${signals.threeWhyUpdates.whyChange}`; applied.push("threewhy:change"); }
        if (selected.has("threewhy:now") && signals.threeWhyUpdates.whyNow) { whyUpdates.whyNowClaim = signals.threeWhyUpdates.whyNow; whyUpdates.whyNowEvidence = `[拜访 #${meeting.id}] ${signals.threeWhyUpdates.whyNow}`; applied.push("threewhy:now"); }
        if (selected.has("threewhy:us") && signals.threeWhyUpdates.whyUs) { whyUpdates.whyUsClaim = signals.threeWhyUpdates.whyUs; whyUpdates.whyUsEvidence = `[拜访 #${meeting.id}] ${signals.threeWhyUpdates.whyUs}`; applied.push("threewhy:us"); }
        if (Object.keys(whyUpdates).length) {
          const [existing] = await db.select().from(threeWhy).where(eq(threeWhy.opportunityId, input.opportunityId)).limit(1);
          if (existing) await db.update(threeWhy).set({ ...whyUpdates, updatedAt: new Date() }).where(eq(threeWhy.opportunityId, input.opportunityId));
          else await db.insert(threeWhy).values({ clientId: input.clientId, opportunityId: input.opportunityId, ...whyUpdates });
        }
      }
      const nextKeys = Array.from(new Set<string>((Array.from(confirmedBefore) as string[]).concat(applied)));
      await db.update(meetingMinutes).set({ aiFullSignalsConfirmedKeys: nextKeys }).where(eq(meetingMinutes.id, input.meetingId));
      setImmediate(() => triggerSingleClientRefresh(input.clientId));
      return { applied, confirmedKeys: nextKeys };
    }),
    generate: publicProcedure.input(z.object({
      clientId: z.number(),
      clientName: z.string(),
      meetingDate: z.string(),
      visitType: z.string().optional(),
      attendees: z.string().optional(),
      keyPoints: z.string(),
      transcriptText: z.string().optional(),
      contactType: z.enum(["formal_meeting","dinner_meeting","phone_call","video_call","instant_message","event","customer_initiated"]).optional(),
      initiatedBy: z.enum(["sam","customer","mutual"]).optional(),
    })).mutation(async ({ input }) => {
      // Combine keyPoints + transcript as the main content source
      const contentSource = input.transcriptText
       ? `【飞书妙记/会议记录全文】\n${input.transcriptText}\n\n【SAM补充要点】\n${input.keyPoints}`
       : `【关键信息点】\n${input.keyPoints}`;

      // 接触类型和发起方的语义化描述（用于 AI 理解信号可信度）
      const contactTypeLabel: Record<string, string> = {
        formal_meeting: "正式会议（预约拜访）",
        dinner_meeting: "非正式接触 - 饭局/酒桌",
        phone_call: "电话沟通",
        video_call: "视频会议",
        instant_message: "即时消息/私信",
        event: "活动/展会",
        customer_initiated: "客户主动发起",
      };
      const initiatedByLabel: Record<string, string> = {
        sam: "SAM 主动发起",
        customer: "客户主动发起（高价值信号）",
        mutual: "双方约定",
      };
      const contactContext = input.contactType
        ? `\n接触方式：${contactTypeLabel[input.contactType] || input.contactType}\n发起方：${initiatedByLabel[input.initiatedBy || "sam"] || input.initiatedBy}`
        : "";

      const prompt = `
客户：${input.clientName}
拜访日期：${input.meetingDate}
拜访类型：${input.visitType || '拜访'}
参会人：${input.attendees || '未记录'}
${contactContext}
${contentSource}

${input.contactType === "dinner_meeting" || input.contactType === "event" ? "⚠️ 注意：本次为非正式场合接触，客户在轻松环境下透露的信息往往更真实，可信度高于正式会议。请在分析中体现这一点。" : ""}
${input.initiatedBy === "customer" ? "⭐ 重要信号：本次接触由客户主动发起，这是强烈的关系热度信号，说明客户有主动推进意愿。请在关键人分析和信号评估中重点体现。" : ""}

请生成一份结构化拜访作战日志，格式为Markdown：

## 拜访作战日志

**客户：** ${input.clientName}
**拜访日期：** ${input.meetingDate}
**拜访类型：** ${input.visitType || '拜访'}
**参会人：** ${input.attendees || '待补充'}

### 客户关键反应与信号
（从记录中提炼客户的真实态度、关注点、疑虑、积极信号）

### 已确认情报
（本次拜访中确认的客户现状、痛点、决策信息、预算信号）

### 关键人分析
（识别参会人的角色、立场、影响力，是否具备Champion潜质）

### Next Steps
| 行动 | 责任人 | 截止时间 |
|------|--------|----------|
（每条行动必须有明确责任人和时间节点）

### MEDDPICC更新建议
（基于本次拜访，建议更新哪些MEDDPICC要素）

### 风险与注意事项
（本次拜访发现的潜在风险或需要注意的信号）`;

      // Inject Account Map diagnostic context for richer analysis
      const meetingAccountDiag = await getAccountDiagnosticContext(input.clientId);
      const enrichedMeetingPrompt = prompt + meetingAccountDiag;
      const res = await invokeLLM({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT }, { role: "user", content: enrichedMeetingPrompt }],
      });
      const aiMinutes = String(res.choices[0].message.content || "");

      // Calls 2/3/4 all depend on aiMinutes but are independent of each other — run in parallel
      const [meddpiccSuggestions, strategyResult, detectedCompetitors] = await Promise.all([
        // Call 2: extract structured MEDDPICC suggestions (using gpt-5-mini — JSON extraction task)
       invokeLLM({
         model: "gpt-4o-mini",
          messages: [{ role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT }, { role: "user", content: `根据以下会议纪要内容，分析哪些MEDDPICC维度有了新进展，给出结构化的打分建议。\n\n会议纪要：\n${aiMinutes}\n\n请以如下JSON格式返回，只包含有明确证据支持的维度更新建议（没有进展的维度不要包含）：\n{"items": [\n  {\n    "dim": "C1",\n    "label": "Champion",\n    "suggestedScore": 50,\n    "reason": "吴悠确认对GLM方案感兴趣，已从潜在支持者升级为Champion已确认",\n    "confidence": "medium"\n  }\n]}\n\n维度说明：M=可量化价值, E=预算决策人, D1=决策标准, D2=决策流程, P=合同流程, I=痛点识别, C1=Champion, C2=竞争态势\n分数档位：0, 25, 50, 75, 100\n置信度：high（有明确陈述）, medium（有间接证据）, low（推断）\n\n必须返回JSON对象，key为items，value为数组。` }],
        }).then(r => {
          try {
            const parsed = JSON.parse(extractJSON(String(r.choices[0].message.content || "")));
            // Handle all possible wrapping keys
            if (Array.isArray(parsed)) return parsed;
            if (parsed.items) return parsed.items;
            if (parsed.suggestions) return parsed.suggestions;
            if (parsed.data) return parsed.data;
            if (parsed.updates) return parsed.updates;
            if (parsed.results) return parsed.results;
            // Last resort: find the first array value in the object
            const firstArr = Object.values(parsed).find(v => Array.isArray(v));
            return firstArr || [];
          } catch { return []; }
        }).catch(() => [] as Array<{dim: string; label: string; suggestedScore: number; reason: string; confidence: string}>),

        // Call 3: extract hookTopic and securityAngle
       invokeLLM({
         model: "gpt-4o-mini",
          messages: [{ role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT }, { role: "user", content: `根据以下拜访日志，提炼两个关键建议。\n\n拜访日志：\n${aiMinutes}\n\n请以JSON格式返回：\n{\n  "hookTopic": "基于本次拜访揭示的客户痛点和关注点，下次拜访最有效的敲门砖话题（一句话，具体、有针对性）",\n  "securityAngle": "基于客户痛点，建议的为信安全产品切入角度（具体产品线或解决方案）"\n}\n\n只返回JSON，不要其他文字。` }],
        }).then(r => {
          try {
            return JSON.parse(extractJSON(String(r.choices[0].message.content || "{}")));
          } catch { return {}; }
        }).catch(() => ({})),

        // Call 4: detect competitor names
       invokeLLM({
         model: 'gpt-4o-mini',
          messages: [{ role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT }, { role: 'user', content: `从以下会议记录中识别所有提到的竞品厂商名称。常见竞品包括：奇安信(QAX)、Palo Alto Networks、CrowdStrike、Fortinet、Check Point、深信服、天山信息、安恒天蹄、火眉安全、绣球网络、SentinelOne、Microsoft Defender、Trend Micro、Symantec、McAfee等。\n\n会议记录：\n${aiMinutes}\n\n请以JSON格式返回，只返回实际提到的竞品名称（如果没有提到竞品则返回空数组）：\n{ "competitors": ["QAX", "Palo Alto Networks"] }` }],
        }).then(r => {
          try {
            const p = JSON.parse(extractJSON(String(r.choices[0].message.content || '{}')));
            return Array.isArray(p.competitors) ? p.competitors : [];
          } catch { return []; }
        }).catch(() => [] as string[]),
      ]);

      const hookTopicSuggestion = (strategyResult as any).hookTopic || "";
      const securityAngleSuggestion = (strategyResult as any).securityAngle || "";

      const id = await insertMeeting({
        clientId: input.clientId,
        meetingDate: new Date(input.meetingDate),
        visitType: input.visitType,
        attendees: input.attendees,
        keyPoints: input.keyPoints,
        transcriptText: input.transcriptText,
        aiMinutes,
        hookTopicSuggestion,
        securityAngleSuggestion,
        contactType: input.contactType,
        initiatedBy: input.initiatedBy,
        entrySource: "manual",
      });
      // Event-driven: non-blocking single-client native refresh after meeting log saved
      setImmediate(() => triggerSingleClientRefresh(input.clientId));
      // SAM Post-Meeting Conclusion Card: synchronous LLM analysis
      let postMeetingCard: any = null;
      try {
        const clientForCard = await getClientById(input.clientId);
        const meddpiccForCard = await getMeddpiccByClientId(input.clientId);
        const meddpiccSummaryCard = meddpiccForCard ? `Champion=${(meddpiccForCard as any).championScore}/100, EB=${(meddpiccForCard as any).economicBuyerScore}/100, Pain=${(meddpiccForCard as any).implicatePainScore}/100, Competition=${(meddpiccForCard as any).competitionScore}/100` : "暂无评分";
        const championNameCard = (meddpiccForCard as any)?.championName || "未找到";
        const cardRes = await invokeLLM({
          model: "gpt-5-mini",
          maxCompletionTokens: 600,
          messages: [
            { role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT },
            { role: "user", content: `以下是刚录入的拜访记录。\n\n客户：${input.clientName}，阶段：${clientForCard?.stage || "未知"}\n拜访日期：${input.meetingDate}\n拜访内容：${aiMinutes || input.keyPoints}\n当前MEDDPICC：${meddpiccSummaryCard}\n当前Champion：${championNameCard}\n\n请输出以下四项（必须基于本次拜访内容，不得补充未提到的信息）：\n1. Win公式本次进展：Pain/Power/Champion/Value/Control中哪个因子有实质推进？引用原文。\n2. MEDDPICC建议更新：哪1-2个维度本次有新证据支持评分变化？新评分建议和理由（无新证据不建议变化）。\n3. 下次拜访最高优先任务（一件事）：基于当前最弱Win因子，下次必须验证或推进的一件事。\n4. 风险预警（如无风险可不填）：本次拜访是否出现No Decision信号、竞品动态或关系倒退迹象？\n\n以JSON返回：\n{"winProgress":"...","meddpiccUpdates":[{"dim":"C1","label":"Champion","suggestedScore":50,"reason":"..."}],"nextMeetingPriority":"...","riskWarning":"..." }` }
          ],
        });
        const cardText = String(cardRes.choices?.[0]?.message?.content || "");
        const jsonMatch = cardText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          postMeetingCard = JSON.parse(jsonMatch[0]);
          // Persist to DB
          const db = await getDb();
          if (db && id) {
            const { meetingMinutes: mm } = await import("../drizzle/schema");
            const { eq } = await import("drizzle-orm");
            await db.update(mm).set({ aiPostAnalysis: postMeetingCard }).where(eq(mm.id, id));
          }
        }
      } catch (e) {
        console.warn("[Command3] Post-meeting card generation failed:", e);
      }
      return { id, aiMinutes, meddpiccSuggestions, hookTopicSuggestion, securityAngleSuggestion, detectedCompetitors, postMeetingCard };
    }),
    quickLog: publicProcedure.input(z.object({
      clientId: z.number(),
      meetingDate: z.string(),
      visitType: z.string().optional(),
      attendees: z.string().optional(),
      keyPoints: z.string(),
      contactType: z.enum(["formal_meeting","dinner_meeting","phone_call","video_call","instant_message","event","customer_initiated"]).optional(),
      initiatedBy: z.enum(["sam","customer","mutual"]).optional(),
      entrySource: z.enum(["manual","feishu_miaoji","whatsapp_quick","feishu_bot"]).optional(),
    })).mutation(async ({ input }) => {
      const id = await insertMeeting({
        clientId: input.clientId,
        meetingDate: new Date(input.meetingDate),
        visitType: input.visitType,
        attendees: input.attendees,
        keyPoints: input.keyPoints,
        transcriptText: undefined,
        aiMinutes: undefined,
        hookTopicSuggestion: undefined,
        securityAngleSuggestion: undefined,
        contactType: input.contactType,
        initiatedBy: input.initiatedBy,
        entrySource: input.entrySource ?? "manual",
      });
      return { id };
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await deleteMeeting(input.id);
      return { success: true };
    }),
    deleteBatch: protectedProcedure.input(z.object({ ids: z.array(z.number()) })).mutation(async ({ input }) => {
      await deleteMeetingBatch(input.ids);
      return { success: true, deleted: input.ids.length };
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      meetingDate: z.string().optional(),
      visitType: z.string().optional(),
      attendees: z.string().optional(),
      keyPoints: z.string().optional(),
    })).mutation(async ({ input }) => {
      const { id, meetingDate, ...rest } = input;
      await updateMeeting(id, {
        ...(meetingDate ? { meetingDate: new Date(meetingDate) } : {}),
        ...rest,
      });
      return { success: true };
    }),
  }),

  // ── POD Tasks ─────────────────────────────────────────────────────────────
  pod: router({
    listByRole: publicProcedure.input(z.object({ role: z.enum(["AD", "SAM", "SA", "RSM"]) })).query(({ input }) =>
      getPodTasksByRole(input.role)
    ),
    listByOpportunity: publicProcedure.input(z.object({ opportunityId: z.number() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const { podTasks } = await import('../drizzle/schema.js');
      const { eq, desc } = await import('drizzle-orm');
      return db.select().from(podTasks).where(eq(podTasks.opportunityId, input.opportunityId)).orderBy(desc(podTasks.createdAt));
    }),
    listByClient: publicProcedure.input(z.object({ clientId: z.number() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const { podTasks } = await import('../drizzle/schema.js');
      const { and, desc, eq, isNull } = await import('drizzle-orm');
      return db.select().from(podTasks)
        .where(and(eq(podTasks.clientId, input.clientId), isNull(podTasks.opportunityId)))
        .orderBy(desc(podTasks.createdAt));
    }),
    addTask: publicProcedure.input(z.object({
      clientId: z.number(),
      assignedRole: z.enum(["AD", "SAM", "SA", "RSM"]),
      title: z.string(),
      description: z.string().optional(),
      dueDate: z.string().optional(),
      opportunityId: z.number().optional(),
      sourceType: z.enum(["competition_counter", "manual", "review_action", "ad_command"]).optional(),
    })).mutation(({ input }) =>
      insertPodTask({
        clientId: input.clientId,
        assignedRole: input.assignedRole,
        title: input.title,
        description: input.description,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        opportunityId: input.opportunityId,
        sourceType: input.sourceType,
      })
    ),
    complete: publicProcedure.input(z.object({ id: z.number() })).mutation(({ input }) =>
      completePodTask(input.id)
    ),
    deleteOne: protectedProcedure.input(z.object({ id: z.number() })).mutation(({ input }) =>
      deletePodTask(input.id)
    ),
    clearCompleted: protectedProcedure.mutation(() =>
      clearCompletedPodTasks()
    ),
    clearByRole: protectedProcedure.input(z.object({ role: z.enum(["AD", "SAM", "SA", "RSM"]) })).mutation(({ input }) =>
      clearPodTasksByRole(input.role)
    ),
    updateTaskStatus: publicProcedure.input(z.object({
      id: z.number(),
      taskStatus: z.enum(["pending", "in_progress", "done"]),
    })).mutation(async ({ input }) => {
      const { getDb } = await import('./db.js');
      const { podTasks, actionItems } = await import('../drizzle/schema.js');
      const { eq } = await import('drizzle-orm');
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const [podTask] = await db.select({ id: podTasks.id, sourceActionId: podTasks.sourceActionId }).from(podTasks).where(eq(podTasks.id, input.id)).limit(1);
      if (!podTask) {
        const actionUpdates: any = {
          isCompleted: input.taskStatus === 'done',
          completedAt: input.taskStatus === 'done' ? new Date() : null,
        };
        await db.update(actionItems).set(actionUpdates).where(eq(actionItems.id, input.id));
        return { ok: true, source: 'actionItem' };
      }
      const updates: any = { taskStatus: input.taskStatus };
      if (input.taskStatus === 'done') {
        updates.isCompleted = true;
        updates.completedAt = new Date();
      } else {
        updates.isCompleted = false;
        updates.completedAt = null;
      }
      await db.update(podTasks).set(updates).where(eq(podTasks.id, input.id));
      if (podTask.sourceActionId) {
        await db.update(actionItems).set({
          isCompleted: input.taskStatus === 'done',
          completedAt: input.taskStatus === 'done' ? new Date() : null,
        }).where(eq(actionItems.id, podTask.sourceActionId));
      }
      return { ok: true, source: 'podTask' };
    }),
    listDealReviews: publicProcedure.query(() => getDealReviews()),
    weeklyReport: publicProcedure.mutation(async () => {
      const data = await getWeeklyReportData();
      if (!data) return { summary: "数据暂时无法读取，请稍后重试。" };

      const { recentSignals, completedTasks, pendingTasks, allClients, meddpiccData, latestScores } = data;

      const clientSummaries = allClients.map(c => {
        const m = meddpiccData.find(md => md.clientId === c.id);
        const avgScore = m ? Math.round((
          m.metricsScore + m.economicBuyerScore + m.decisionCriteriaScore +
          m.decisionProcessScore + m.paperProcessScore + m.implicatePainScore +
          m.championScore + m.competitionScore
        ) / 8) : 0;
        const signals = recentSignals.filter(s => s.clientId === c.id);
        const completed = completedTasks.filter(t => t.clientId === c.id);
        const pending = pendingTasks.filter(t => t.clientId === c.id);
        const latestScore = latestScores.find(s => s.clientId === c.id);
        return `${c.name}(${c.stage}): MEDDPICC平均${avgScore}分, 本周新增信号${signals.length}条, 完成行动${completed.length}个, 待处理${pending.length}个, AI商机温度${latestScore ? latestScore.overallScore : '未评分'}`;
      }).join('\n');

      const prompt = `以下是大湾区T100专项上周的战场数据：

${clientSummaries}

整体数据：本周共收到${recentSignals.length}条客户情报信号，完成${completedTasks.length}个作战行动，待处理${pendingTasks.length}个任务。

请以总经理视角写一段简洁的本周战报摘要（200字内），要求：
1. 先说整体战场态势和重点进展
2. 指出最需要关注的风险或机遇
3. 给出下周最重要的一个行动建议
语气要直接、具体，不要空话套话。`;

      const response = await invokeLLM({ messages: [{ role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT }, { role: "user", content: prompt }], model: "gpt-4o-mini" });
      const summary = String((response.choices?.[0]?.message?.content) ?? "未能生成战报，请重试。");
      return { summary, stats: { signals: recentSignals.length, completed: completedTasks.length, pending: pendingTasks.length } };
    }),
    addDealReview: publicProcedure.input(z.object({
      clientId: z.number(),
      content: z.string(),
      nextSteps: z.string().optional(),
      reviewDate: z.string().optional(),
    })).mutation(({ input }) =>
      insertDealReview({
        clientId: input.clientId,
        content: input.content,
        nextSteps: input.nextSteps,
        reviewDate: input.reviewDate ? new Date(input.reviewDate) : new Date(),
      })
    ),
  }),

  // ── Opportunity Score ─────────────────────────────────────────────────────
  prediction: router({
    getLatest: publicProcedure.input(z.object({ clientId: z.number() })).query(async ({ input }) => {
      const result = await getLatestScoreByClientId(input.clientId);
      return result ?? null;
    }),
    analyze: publicProcedure.input(z.object({
      clientId: z.number(),
      clientName: z.string(),
      industry: z.string().optional(),
      stage: z.string(),
      meddpicc: z.object({
        metricsScore: z.number(),
        economicBuyerScore: z.number(),
        decisionCriteriaScore: z.number(),
        decisionProcessScore: z.number(),
        paperProcessScore: z.number(),
        implicatePainScore: z.number(),
        championScore: z.number(),
        competitionScore: z.number(),
      }),
      visitCount: z.number().optional(),
      lastVisitDate: z.string().nullable().optional(),
      visitQuality: z.object({
        totalVisits: z.number(),
        aiMinutesCount: z.number(),
        transcriptCount: z.number(),
        recentKeyPoints: z.string().optional(),
      }).optional(),
      // 进入商机阶段额外字段
      oppStageDistribution: z.record(z.string(), z.number()).optional(), // { 'Qualified': 2, 'POC': 1 }
      oppCount: z.number().optional(),
      // 0→1 阶段额外字段
      stageDwellDays: z.number().optional(), // 当前阶段停留天数
    })).mutation(async ({ input }) => {
      const m = input.meddpicc;
      const meddpiccAvg = Math.round(
        (m.metricsScore + m.economicBuyerScore + m.decisionCriteriaScore +
          m.decisionProcessScore + m.paperProcessScore + m.implicatePainScore +
          m.championScore + m.competitionScore) / 8
      );

      const visitCount = input.visitCount ?? 0;
      let visitFrequencyScore = 0;
      if (visitCount === 0) {
        visitFrequencyScore = 0;
      } else if (input.lastVisitDate) {
        const daysSinceLastVisit = Math.floor((Date.now() - new Date(input.lastVisitDate).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceLastVisit <= 14) visitFrequencyScore = 100;
        else if (daysSinceLastVisit <= 30) visitFrequencyScore = 75;
        else if (daysSinceLastVisit <= 60) visitFrequencyScore = 50;
        else visitFrequencyScore = 25;
      }

      const vq = input.visitQuality;
      let visitQualityScore = 0;
      let visitQualityDesc = '';
      if (vq && vq.totalVisits > 0) {
        const aiRatio = vq.aiMinutesCount / vq.totalVisits;
        const transcriptRatio = vq.transcriptCount / vq.totalVisits;
        visitQualityScore = Math.round(aiRatio * 60 + transcriptRatio * 40);
        visitQualityDesc = `总拜访${vq.totalVisits}次，其中${vq.aiMinutesCount}次有AI纪要，${vq.transcriptCount}次有飞书妙记全文，日志质量得分${visitQualityScore}/100`;
      } else if (vq && vq.totalVisits === 0) {
        visitQualityScore = 0;
        visitQualityDesc = '从未拜访，日志质量得分 0/100';
      }

      const isOpportunityStage = input.stage === '进入商机';

      // 商机阶段分布分（进入商机阶段用）
      let oppProgressScore = 0;
      let oppDistDesc = '';
      if (isOpportunityStage && input.oppStageDistribution) {
        const dist = input.oppStageDistribution;
        const stageWeights: Record<string, number> = {
          'Qualified': 25, 'POC': 50, '商务谈判': 75, '签约': 90, '交付': 100,
        };
        const entries = Object.entries(dist);
        if (entries.length > 0) {
          const weightedSum = entries.reduce((sum, [stage, count]) => sum + (stageWeights[stage] ?? 25) * count, 0);
          const totalOpps = entries.reduce((sum, [, count]) => sum + count, 0);
          oppProgressScore = totalOpps > 0 ? Math.round(weightedSum / totalOpps) : 0;
          oppDistDesc = entries.map(([s, c]) => `${s}:${c}条`).join('、');
        }
      }

      // 阶段停留分（0→1 阶段用）
      let stageDwellScore = 100;
      let stageDwellDesc = '';
      if (!isOpportunityStage && input.stageDwellDays !== undefined) {
        const days = input.stageDwellDays;
        if (days <= 30) { stageDwellScore = 100; stageDwellDesc = `当前阶段停留${days}天，进展正常`; }
        else if (days <= 60) { stageDwellScore = 75; stageDwellDesc = `当前阶段停留${days}天，需加快推进`; }
        else if (days <= 90) { stageDwellScore = 50; stageDwellDesc = `当前阶段停留${days}天，推进较慢`; }
        else { stageDwellScore = 20; stageDwellDesc = `当前阶段停留${days}天，高风险——长期停滞`; }
      }

      // 分阶段加权综合分
      let overallScore: number;
      let scoreBreakdown: string;
      if (isOpportunityStage) {
        // 进入商机：MEDDPICC 60% + 商机推进 20% + 拜访频率 15% + 日志质量 5%
        overallScore = Math.round(meddpiccAvg * 0.6 + oppProgressScore * 0.2 + visitFrequencyScore * 0.15 + visitQualityScore * 0.05);
        scoreBreakdown = `MEDDPICC ${meddpiccAvg}分×60%，商机推进 ${oppProgressScore}分×20%，拜访频率 ${visitFrequencyScore}分×15%，日志质量 ${visitQualityScore}分×5%`;
      } else {
        // 0→1 阶段：拜访频率 35% + MEDDPICC 40% + 日志质量 15% + 阶段推进速度 10%
        overallScore = Math.round(visitFrequencyScore * 0.35 + meddpiccAvg * 0.40 + visitQualityScore * 0.15 + stageDwellScore * 0.10);
        scoreBreakdown = `拜访频率 ${visitFrequencyScore}分×35%， MEDDPICC ${meddpiccAvg}分×40%，日志质量 ${visitQualityScore}分×15%，阶段推进 ${stageDwellScore}分×10%`;
      }

      const riskLevel = overallScore >= 50 ? "低风险" : overallScore >= 25 ? "中风险" : "高风险";

      // 根据阶段分别构建 prompt
      let prompt: string;
      if (isOpportunityStage) {
        prompt = `
客户：${input.clientName}（${input.industry || "科技企业"}）
当前阶段：进入商机（共${input.oppCount ?? 0}条并行商机，MEDDPICC为各商机评分的加权均值）
商机组合健康度：${overallScore}/100（${riskLevel}）
得分构成：${scoreBreakdown}

MEDDPICC各要素得分（商机级均值）：
- M(可量化价值): ${m.metricsScore}/100
- E(预算决策人): ${m.economicBuyerScore}/100
- D(决策标准): ${m.decisionCriteriaScore}/100
- D(决策流程): ${m.decisionProcessScore}/100
- P(采购流程): ${m.paperProcessScore}/100
- I（痛点识别）: ${m.implicatePainScore}/100
- C(内部Champion): ${m.championScore}/100
- C(竞争态势): ${m.competitionScore}/100

${oppDistDesc ? `商机子阶段分布：${oppDistDesc}（商机推进得分 ${oppProgressScore}/100）` : ''}
拜访频率：${visitFrequencyScore}/100（拜访${visitCount}次，${visitCount === 0 ? '从未拜访' : input.lastVisitDate ? `最近${Math.floor((Date.now() - new Date(input.lastVisitDate).getTime()) / 86400000)}天前` : ''}）
${visitQualityDesc ? `日志质量：${visitQualityDesc}` : ''}
${vq?.recentKeyPoints ? `最近拜访要点：${vq.recentKeyPoints}` : ''}

请提供：
1. 对该客户商机组合的专业判断（2-3句，重点分析赢单概率和最大风险）
2. 最需立即解决的2-3个风险点（具体说明风险原因和应对方法）

返回JSON：
{ "analysis": "判断文本", "warnings": ["风险点1", "风险点2"] }`;
      } else {
        prompt = `
客户：${input.clientName}（${input.industry || "科技企业"}）
当前阶段：${input.stage}（客户开发阶段，尚未进入正式商机）
客户健康度：${overallScore}/100（${riskLevel}）
得分构成：${scoreBreakdown}

MEDDPICC方向性评分（客户级手动评分，早期阶段分数偏低属正常）：
- M(可量化价值): ${m.metricsScore}/100
- E(预算决策人): ${m.economicBuyerScore}/100
- D(决策标准): ${m.decisionCriteriaScore}/100
- D(决策流程): ${m.decisionProcessScore}/100
- P(采购流程): ${m.paperProcessScore}/100
- I（痛点识别）: ${m.implicatePainScore}/100
- C(内部Champion): ${m.championScore}/100
- C(竞争态势): ${m.competitionScore}/100

拜访频率：${visitFrequencyScore}/100（拜访${visitCount}次，${visitCount === 0 ? '从未拜访，高风险' : input.lastVisitDate ? `最近${Math.floor((Date.now() - new Date(input.lastVisitDate).getTime()) / 86400000)}天前拜访` : ''}）
${stageDwellDesc ? `阶段推进：${stageDwellDesc}` : ''}
${visitQualityDesc ? `日志质量：${visitQualityDesc}` : ''}
${vq?.recentKeyPoints ? `最近拜访要点：${vq.recentKeyPoints}` : ''}

请提供：
1. 对该客户当前开发状态的判断（2-3句，重点分析关系建立和阶段推进状况）
2. 最需立即解决的2-3个风险点（具体说明风险原因和应对方法）

返回JSON：
{ "analysis": "判断文本", "warnings": ["风险点1", "风险点2"] }`;
      }

      const res = await invokeLLM({
        model: "gpt-4o",
        messages: [{ role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT }, { role: "user", content: prompt }],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "prediction",
            strict: true,
            schema: {
              type: "object",
              properties: {
                analysis: { type: "string" },
                warnings: { type: "array", items: { type: "string" } },
              },
              required: ["analysis", "warnings"],
              additionalProperties: false,
            },
          },
        },
      });

      const parsed = JSON.parse(extractJSON(String(res.choices[0].message.content || "{}")));
      const aiAnalysis: string = parsed.analysis ?? '';
      const warnings: string[] = Array.isArray(parsed.warnings) ? parsed.warnings : [];
      await insertScore({
        clientId: input.clientId,
        overallScore,
        meddpiccScore: meddpiccAvg,
        signalScore: 0,
        visitFrequencyScore,
        riskLevel: riskLevel as any,
        aiAnalysis,
        warnings,
      });
      // Return with aiAnalysis key to match OpportunityScore type used by frontend
      return { overallScore, meddpiccScore: meddpiccAvg, visitFrequencyScore, riskLevel, scoreBreakdown, aiAnalysis, warnings };
    }),
  }),
  // ── Key Contacts ──────────────────────────────────────────────────────────────────────
  contacts: router({
    listByClient: publicProcedure.input(z.object({ clientId: z.number() })).query(({ input }) =>
      getContactsByClientId(input.clientId)
    ),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      name: z.string().optional(),
      title: z.string().optional(),
      department: z.string().optional(),
      influence: z.enum(['决策者', '影响者', 'Champion候选', '技术评估者', '内部线人']).optional(),
      relationship: z.enum(['待接触', '已识别', '初步接触', '已接触', '建立关系', 'Champion', '已拒绝']).optional(),
      linkedinUrl: z.string().optional(),
      email: z.string().optional(),
      notes: z.string().optional(),
      reportingTo: z.string().optional(),
      persona: z.string().optional(),
      breakthroughTip: z.string().optional(),
      stance: z.enum(['支持', '中立', '反对', '未知']).optional(),
      buyingRole: z.enum(['经济决策人', '技术决策人', '用户影响者', '阻碍者', 'Champion', '内部线人', '未知']).optional(),
    })).mutation(({ input }) => {
      const { id, ...data } = input;
      return updateContact(id, data as any);
    }),
    add: protectedProcedure.input(z.object({
      clientId: z.number(),
      name: z.string(),
      title: z.string().optional(),
      department: z.string().optional(),
      influence: z.enum(['决策者', '影响者', 'Champion候选', '技术评估者', '内部线人']).optional(),
      relationship: z.enum(['待接触', '已识别', '初步接触', '已接触', '建立关系', 'Champion', '已拒绝']).optional(),
      linkedinUrl: z.string().optional(),
      email: z.string().optional(),
      notes: z.string().optional(),
      reportingTo: z.string().optional(),
      buyingRole: z.enum(['经济决策人', '技术决策人', '用户影响者', '阻碍者', 'Champion', '内部线人', '未知']).optional(),
    })).mutation(({ input }) => insertContact(input as any)),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(({ input }) =>
      deleteContact(input.id)
    ),
    deleteBatch: protectedProcedure.input(z.object({ ids: z.array(z.number()) })).mutation(async ({ input }) => {
      await deleteContactBatch(input.ids);
      return { success: true, deleted: input.ids.length };
    }),
    // AI 分析关键人汇报链路，生成突破建议
    analyzeChain: publicProcedure.input(z.object({
      clientId: z.number(),
      clientName: z.string(),
    })).mutation(async ({ input }) => {
      const contacts = await getContactsByClientId(input.clientId);
      if (contacts.length === 0) return { reportingChain: '', tips: [] };

      const contactList = contacts.map((c: any) =>
        `- ${c.name}（${c.title || '职位未知'}，${c.department || '部门未知'}，影响力：${c.influence}，关系：${c.relationship}${c.reportingTo ? `，汇报给：${c.reportingTo}` : ''}）`
      ).join('\n');

      const prompt = `
客户：${input.clientName}
关键人列表：
${contactList}

请完成两项任务：
1. 分析汇报链路：识别组织层级（决策层→管理层→执行层），画出汇报关系
2. 为每位关键人生成「快速认知对齐话术」：一段 2-3 句话的开场白，帮助 SAM 在 3 分钟内让该关键人理解我方价值主张

返回JSON格式：
{
  "reportingChain": "汇报链路描述（如：Ronald（决策层）→ Ray（管理层）→ Tracy/Ryan（执行层））",
  "tips": [
    {
      "contactName": "关键人姓名",
      "persona": "人物画像（3句话：职责重心、决策风格、核心关切）",
      "breakthroughTip": "快速认知对齐话术（2-3句，可直接使用的开场白）",
      "approachStrategy": "接触策略（如：通过Ray引荐、直接邮件、技术演示切入）"
    }
  ]
}`;

      const res = await invokeLLM({
        model: 'gpt-4o',
        messages: [{ role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT }, { role: "user", content: prompt }],
      });
      const parsed = JSON.parse(extractJSON(String(res.choices[0].message.content || '{}')));

      // Save breakthroughTip and persona back to each contact
      const db = await getDb();
      if (db) {
        const { keyContacts } = await import('../drizzle/schema.js');
        const { eq } = await import('drizzle-orm');
        for (const tip of (parsed.tips || [])) {
          const contact = contacts.find((c: any) => c.name === tip.contactName);
          if (contact) {
            await db.update(keyContacts).set({
              persona: tip.persona,
              breakthroughTip: tip.breakthroughTip,
            }).where(eq(keyContacts.id, contact.id));
          }
        }
      }

      return parsed;
    }),
  }),

  // ── Opportunities (Active Fronts 活跃战线) ──────────────────────────────────
  opportunities: router({
    listByClient: publicProcedure.input(z.object({ clientId: z.number() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const { opportunities } = await import('../drizzle/schema.js');
      const { eq, desc } = await import('drizzle-orm');
      return db.select().from(opportunities).where(eq(opportunities.clientId, input.clientId)).orderBy(desc(opportunities.createdAt));
    }),
    customerReadiness: publicProcedure.input(z.object({ clientId: z.number() })).query(async ({ input }) => {
      const { readiness } = await loadCustomerReadiness(input.clientId);
      return readiness;
    }),
    createFromCustomerReadiness: protectedProcedure.input(z.object({
      clientId: z.number(),
      name: z.string().trim().min(3).max(200),
      productId: z.number().nullable().optional(),
      estimatedValue: z.string().trim().max(100).optional(),
      expectedCloseDate: z.string().trim().max(50).optional(),
      customerObjective: z.string().trim().max(2000).optional(),
      contactName: z.string().trim().max(100).optional(),
      bypassReason: z.literal("exec_meeting").optional(),
      executiveContactId: z.number().optional(),
      executiveMeetingIds: z.array(z.number()).min(2).max(10).optional(),
      adConfirmation: z.string().trim().min(12).max(2000).optional(),
    })).mutation(async ({ input, ctx }) => {
      const { client, readiness, contacts, meetings } = await loadCustomerReadiness(input.clientId);
      const isExecutiveBypass = input.bypassReason === "exec_meeting";
      let approval: any = { mode: "purchase_signals" };

      if (isExecutiveBypass) {
        const actor = await getEmailSessionActor(ctx);
        if (!actor || (actor.podRole !== "AD" && actor.role !== "admin")) {
          throw new TRPCError({ code: "FORBIDDEN", message: "高层直入必须由 AD 或系统管理员在登录态下确认。" });
        }
        if (!input.executiveContactId || !input.executiveMeetingIds || !input.adConfirmation) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "高层直入必须选择经济决策人、引用至少两次拜访记录并填写 AD 确认说明。" });
        }
        const executive = contacts.find((contact: any) => contact.id === input.executiveContactId);
        if (!executive || executive.buyingRole !== "经济决策人") {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "高层直入仅适用于关键人图谱中标注为经济决策人的客户联系人。" });
        }
        const selectedIds = Array.from(new Set(input.executiveMeetingIds));
        const selectedMeetings = meetings.filter((meeting: any) => selectedIds.includes(meeting.id));
        const inspectedMeetings = classifyExecutiveMeetings(selectedMeetings, executive.name);
        const executiveMeetings = inspectedMeetings.filter(meeting => meeting.executiveDetected);
        if (executiveMeetings.length < 2) {
          const matched = executiveMeetings.map(meeting => `#${meeting.id}`).join("、") || "无";
          const unmatched = inspectedMeetings.filter(meeting => !meeting.executiveDetected).map(meeting => `#${meeting.id}`).join("、") || "无";
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: `高层直入需至少两次明确记录“${executive.name}”参与或直接对话的拜访事实。已检测到：${matched}；未检测到该姓名：${unmatched}。请核对拜访记录中的与会人或纪要写法。` });
        }
        approval = {
          mode: "exec_meeting",
          approvedBy: { id: actor.id, name: actor.name, podRole: actor.podRole },
          confirmation: input.adConfirmation,
          executiveContact: { id: executive.id, name: executive.name, buyingRole: executive.buyingRole },
          meetingEvidence: executiveMeetings.map((meeting: any) => ({
            id: meeting.id,
            meetingDate: new Date(meeting.meetingDate).toISOString(),
            attendees: meeting.attendees,
          })),
        };
      } else if (!readiness.canApplyForOpportunity) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `尚不满足申请开商机的客观门控：${readiness.blockers.map(item => item.label).join("；")}`,
        });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库暂不可用" });
      const { clients, opportunities } = await import('../drizzle/schema.js');
      const { eq } = await import('drizzle-orm');
      const approvedAt = new Date();
      const snapshot = {
        approvedAt: approvedAt.toISOString(),
        customerStage: client.stage,
        gateChecks: readiness.checks.map(check => ({
          id: check.id,
          label: check.label,
          evidence: check.evidence,
          passed: check.passed,
        })),
        purchaseSignals: readiness.checks.map(check => ({
          type: check.id,
          label: check.label,
          subjectName: check.signal?.subjectName || "",
          subjectContactId: check.signal?.subjectContactId ?? null,
          occurredAt: check.signal ? new Date(check.signal.occurredAt).toISOString() : "",
          statement: check.signal?.statement || "",
          sourceType: check.signal?.sourceType || "",
          sourceReference: check.signal?.sourceReference || "",
        })),
        approval,
      };
      const gateNarrative = isExecutiveBypass
        ? "本商机由 AD 确认的高层直入路径创建：两次经济决策人拜访事实与确认说明已固化。"
        : "本商机由客户作战台三项购买信号门控申请创建；意向主体、决策链触达与触发事件的事实快照已固化。";
      const notes = `${input.customerObjective ? `补充说明：${input.customerObjective}\n\n` : ""}${gateNarrative} 后续产品方案与赢单判断请在独立商机作战室维护。`;
      const [result] = await db.insert(opportunities).values({
        clientId: input.clientId,
        name: input.name,
        stage: "初步需求",
        status: "活跃",
        productId: input.productId ?? null,
        estimatedValue: input.estimatedValue || null,
        expectedCloseDate: input.expectedCloseDate || null,
        contactName: input.contactName || approval.executiveContact?.name || null,
        notes,
        entryEvidenceSnapshot: snapshot,
      } as any);
      await db.update(clients).set({ stage: "进入商机", stageChangedAt: approvedAt }).where(eq(clients.id, input.clientId));
      invalidateClientsCache();
      return { id: (result as any).insertId, snapshot };
    }),
    create: protectedProcedure.input(z.object({
      clientId: z.number(),
      name: z.string(),
      stage: z.enum(['初步需求', '需求挖掘', '技术验证', '方案提案', '商务谈判', '赢单', '丢单']).optional(),
      status: z.enum(['活跃', '暂停', '赢单', '丢单']).optional(),
      competitorName: z.string().optional(),
      contactName: z.string().optional(),
      estimatedValue: z.string().optional(),
      expectedCloseDate: z.string().optional(),
      notes: z.string().optional(),
      productId: z.number().nullable().optional(),
    })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');
      const { opportunities } = await import('../drizzle/schema.js');
      const [result] = await db.insert(opportunities).values(input as any);
      return { id: (result as any).insertId };
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      name: z.string().optional(),
      stage: z.enum(['初步需求', '需求挖掘', '技术验证', '方案提案', '商务谈判', '赢单', '丢单']).optional(),
      status: z.enum(['活跃', '暂停', '赢单', '丢单']).optional(),
      competitorName: z.string().optional(),
      contactName: z.string().optional(),
      estimatedValue: z.string().optional(),
      expectedCloseDate: z.string().optional(),
      notes: z.string().optional(),
      productId: z.number().nullable().optional(),
    })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');
      const { opportunities } = await import('../drizzle/schema.js');
      const { eq } = await import('drizzle-orm');
      const { id, ...data } = input;
      // 当 stage 变更时自动写入 stageChangedAt，精确记录阶段停留起始时间
      const updateData: any = { ...data };
      if ((data as any).stage !== undefined) {
        updateData.stageChangedAt = new Date();
      }
      await db.update(opportunities).set(updateData).where(eq(opportunities.id, id));
      return { success: true };
    }),
    getStageGuidance: protectedProcedure.input(z.object({
      clientId: z.number(), opportunityId: z.number(), targetStage: z.enum(['初步需求', '需求挖掘', '技术验证', '方案提案', '商务谈判', '赢单', '丢单']),
    })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库暂不可用" });
      const { opportunities, opportunityMeddpicc, competitionMap } = await import("../drizzle/schema.js");
      const [opportunity] = await db.select().from(opportunities).where(eq(opportunities.id, input.opportunityId)).limit(1);
      if (!opportunity || opportunity.clientId !== input.clientId) throw new TRPCError({ code: "NOT_FOUND", message: "未找到商机" });
      const [meddpicc, competitions] = await Promise.all([
        db.select().from(opportunityMeddpicc).where(eq(opportunityMeddpicc.opportunityId, input.opportunityId)).limit(1),
        db.select().from(competitionMap).where(eq(competitionMap.opportunityId, input.opportunityId)),
      ]);
      const requirements = (STAGE_REQUIREMENTS[input.targetStage as keyof typeof STAGE_REQUIREMENTS] || []).map(requirement => {
        const isCompetition = requirement.key === "gate8CompDefensible";
        const notesField = isCompetition ? null : MEDDPICC_FIELD_MAP[requirement.key as keyof typeof MEDDPICC_FIELD_MAP]?.notes;
        const scoreField = isCompetition ? null : MEDDPICC_FIELD_MAP[requirement.key as keyof typeof MEDDPICC_FIELD_MAP]?.score;
        const evidence = isCompetition
          ? competitions.find((item: any) => String(item.counterAction || item.competitorName || "").trim())?.counterAction || ""
          : String((meddpicc[0] as any)?.[notesField || ""] || "").trim();
        const score = isCompetition ? 0 : Number((meddpicc[0] as any)?.[scoreField || ""] || 0);
        const met = isCompetition ? evidence.length >= 8 : score >= 2 && evidence.length >= 10;
        return { ...requirement, met, evidence: met ? evidence : "数据不足，暂不判断" };
      });
      return { currentStage: opportunity.stage, targetStage: input.targetStage, requirements, isReady: requirements.every(item => item.met), missing: requirements.filter(item => !item.met) };
    }),
    advanceWithEvidence: protectedProcedure.input(z.object({
      clientId: z.number(), opportunityId: z.number(), targetStage: z.enum(['初步需求', '需求挖掘', '技术验证', '方案提案', '商务谈判', '赢单', '丢单']),
    })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库暂不可用" });
      const { opportunities, opportunityMeddpicc, competitionMap } = await import("../drizzle/schema.js");
      const [opportunity] = await db.select().from(opportunities).where(eq(opportunities.id, input.opportunityId)).limit(1);
      if (!opportunity || opportunity.clientId !== input.clientId) throw new TRPCError({ code: "NOT_FOUND", message: "未找到商机" });
      const [meddpicc, competitions] = await Promise.all([
        db.select().from(opportunityMeddpicc).where(eq(opportunityMeddpicc.opportunityId, input.opportunityId)).limit(1),
        db.select().from(competitionMap).where(eq(competitionMap.opportunityId, input.opportunityId)),
      ]);
      const missing = (STAGE_REQUIREMENTS[input.targetStage as keyof typeof STAGE_REQUIREMENTS] || []).filter(requirement => {
        if (requirement.key === "gate8CompDefensible") return !competitions.some((item: any) => String(item.counterAction || item.competitorName || "").trim().length >= 8);
        const mapping = MEDDPICC_FIELD_MAP[requirement.key as keyof typeof MEDDPICC_FIELD_MAP];
        return Number((meddpicc[0] as any)?.[mapping.score] || 0) < 2 || String((meddpicc[0] as any)?.[mapping.notes] || "").trim().length < 10;
      });
      if (missing.length > 0) throw new TRPCError({ code: "PRECONDITION_FAILED", message: `尚不能推进至${input.targetStage}；请先补充：${missing.map(item => item.label).join("、")}。` });
      await db.update(opportunities).set({ stage: input.targetStage, stageChangedAt: new Date() }).where(eq(opportunities.id, input.opportunityId));
      return { success: true, stage: input.targetStage };
    }),
    delete: publicProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');
      const { opportunities } = await import('../drizzle/schema.js');
      const { eq } = await import('drizzle-orm');
      await db.delete(opportunities).where(eq(opportunities.id, input.id));
      return { success: true };
    }),

    // 更新 Blue Sheet 字段
    updateBlueSheet: publicProcedure.input(z.object({
      id: z.number(),
      bizObjective: z.string().optional(),
      valueProposition: z.string().optional(),
      champion: z.string().optional(),
      championStance: z.enum(['支持', '中立', '反对', '未知']).optional(),
      blueSheetCompetitor: z.string().optional(),
      winStrategy: z.string().optional(),
      keyMilestones: z.string().optional(),
      riskAndMitigation: z.string().optional(),
    })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');
      const { opportunities } = await import('../drizzle/schema.js');
      const { eq } = await import('drizzle-orm');
      const { id, ...data } = input;
      await db.update(opportunities).set(data as any).where(eq(opportunities.id, id));
      return { success: true };
    }),

    // 获取商机级 MEDDPICC 评分
    getMeddpicc: publicProcedure.input(z.object({ opportunityId: z.number() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const { opportunityMeddpicc } = await import('../drizzle/schema.js');
      const { eq } = await import('drizzle-orm');
      const [result] = await db.select().from(opportunityMeddpicc).where(eq(opportunityMeddpicc.opportunityId, input.opportunityId));
      return result ?? null;
    }),

    // 创建或更新商机级 MEDDPICC 评分
    upsertMeddpicc: protectedProcedure.input(z.object({
      opportunityId: z.number(),
      clientId: z.number(),
      metricsScore: z.number().min(0).max(4).optional(),
      metricsNotes: z.string().optional(),
      economicBuyerScore: z.number().min(0).max(4).optional(),
      economicBuyerNotes: z.string().optional(),
      decisionCriteriaScore: z.number().min(0).max(4).optional(),
      decisionCriteriaNotes: z.string().optional(),
      decisionProcessScore: z.number().min(0).max(4).optional(),
      decisionProcessNotes: z.string().optional(),
      paperProcessScore: z.number().min(0).max(4).optional(),
      paperProcessNotes: z.string().optional(),
      implicatePainScore: z.number().min(0).max(4).optional(),
      implicatePainNotes: z.string().optional(),
      championScore: z.number().min(0).max(4).optional(),
      championNotes: z.string().optional(),
      competitionScore: z.number().min(0).max(4).optional(),
      competitionNotes: z.string().optional(),
    })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');
      const { opportunityMeddpicc } = await import('../drizzle/schema.js');
      const { eq } = await import('drizzle-orm');
      const { opportunityId, clientId, ...scores } = input;
      // 尝试更新，如果不存在则插入
      const [existing] = await db.select({ id: opportunityMeddpicc.id })
        .from(opportunityMeddpicc)
        .where(eq(opportunityMeddpicc.opportunityId, opportunityId));
      if (existing) {
        await db.update(opportunityMeddpicc).set(scores as any).where(eq(opportunityMeddpicc.opportunityId, opportunityId));
      } else {
        await db.insert(opportunityMeddpicc).values({ opportunityId, clientId, ...scores } as any);
      }
      const [result] = await db.select().from(opportunityMeddpicc).where(eq(opportunityMeddpicc.opportunityId, opportunityId));
      return result;
    }),

    // 获取客户所有商机的 MEDDPICC 汇总（用于 AD 指挥台）
    listMeddpiccByClient: publicProcedure.input(z.object({ clientId: z.number() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const { opportunityMeddpicc, opportunities } = await import('../drizzle/schema.js');
      const { eq } = await import('drizzle-orm');
      // 联合查询：商机信息 + MEDDPICC 分数
      const results = await db
        .select({
          opportunityId: opportunities.id,
          opportunityName: opportunities.name,
          stage: opportunities.stage,
          status: opportunities.status,
          meddpicc: {
            metricsScore: opportunityMeddpicc.metricsScore,
            economicBuyerScore: opportunityMeddpicc.economicBuyerScore,
            decisionCriteriaScore: opportunityMeddpicc.decisionCriteriaScore,
            decisionProcessScore: opportunityMeddpicc.decisionProcessScore,
            paperProcessScore: opportunityMeddpicc.paperProcessScore,
            implicatePainScore: opportunityMeddpicc.implicatePainScore,
            championScore: opportunityMeddpicc.championScore,
            competitionScore: opportunityMeddpicc.competitionScore,
          }
        })
        .from(opportunities)
        .leftJoin(opportunityMeddpicc, eq(opportunities.id, opportunityMeddpicc.opportunityId))
        .where(eq(opportunities.clientId, input.clientId));
      return results;
    }),
  }),

  // ── Kill Sheets (竞品阻击包) ────────────────────────────────────────────────
  killSheets: router({
    list: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const { killSheets } = await import('../drizzle/schema.js');
      const { desc } = await import('drizzle-orm');
      return db.select().from(killSheets).orderBy(desc(killSheets.createdAt));
    }),
    create: protectedProcedure.input(z.object({
      competitorName: z.string(),
      competitorType: z.string().optional(),
      productLine: z.string().optional(),
      ourProduct: z.string().optional(),
      keyDifferentiators: z.array(z.string()).optional(),
      weaknesses: z.array(z.string()).optional(),
      weaknessesText: z.string().optional(),
      ourAdvantages: z.string().optional(),
      keyDiffs: z.string().optional(),
      battleNotes: z.string().optional(),
      clientId: z.number().optional(),
      sourceClientId: z.number().optional(),
    })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');
      const { killSheets } = await import('../drizzle/schema.js');
      const [result] = await db.insert(killSheets).values(input as any);
      return { id: (result as any).insertId };
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      competitorName: z.string().optional(),
      competitorType: z.string().optional(),
      productLine: z.string().optional(),
      ourProduct: z.string().optional(),
      weaknessesText: z.string().optional(),
      ourAdvantages: z.string().optional(),
      keyDiffs: z.string().optional(),
      battleNotes: z.string().optional(),
      clientId: z.number().optional(),
    })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');
      const { killSheets } = await import('../drizzle/schema.js');
      const { eq } = await import('drizzle-orm');
      const { id, ...data } = input;
      await db.update(killSheets).set(data as any).where(eq(killSheets.id, id));
      return { success: true };
    }),
    generateTalk: publicProcedure.input(z.object({
      id: z.number(),
    })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');
      const { killSheets } = await import('../drizzle/schema.js');
      const { eq } = await import('drizzle-orm');
      const [ks] = await db.select().from(killSheets).where(eq(killSheets.id, input.id));
      if (!ks) throw new Error('Kill sheet not found');

      const prompt = `
竞品：${ks.competitorName}
竞品类型：${ks.competitorType || '未指定'}
我方对应产品：${ks.ourProduct || '亚信安全全线产品'}
竞品弱点：${ks.weaknessesText || ''}
我方优势：${ks.ourAdvantages || ''}
关键差异点：${ks.keyDiffs || ''}
作战备注：${ks.battleNotes || ''}

请基于以上信息，生成一份简洁、可直接对客户使用的「差异化话术卡」，包含：

### 开场定位话术
（1-2句，强调我方核心优势）

### 竞品弱点应对话术
（针对客户可能提到竞品时的应对话术，2-3条）

### 关键差异化优势话术
（将差异点转化为客户语言，3-4条）

### 技术对标应对
（SA 在 POC 中应重点展示的指标，2-3条）

内容要具体、可操作，适合在客户会议中直接使用。`;

      const res = await invokeLLM({
        model: 'gpt-4o',
        messages: [{ role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT }, { role: "user", content: prompt }],
      });
      const aiGeneratedTalk = String(res.choices[0].message.content || '');
      await db.update(killSheets).set({ aiGeneratedTalk } as any).where(eq(killSheets.id, input.id));
      return { success: true, aiGeneratedTalk };
    }),
    generate: publicProcedure.input(z.object({
      competitorName: z.string(),
      productLine: z.string().optional(),
      ourProduct: z.string().optional(),
      clientContext: z.string().optional(),
      sourceClientId: z.number().optional(),
    })).mutation(async ({ input }) => {
      const prompt = `
竞品：${input.competitorName}
竞品产品线：${input.productLine || '未指定'}
我方对应产品：${input.ourProduct || '亚信安全全线产品'}
客户背景：${input.clientContext || '未提供'}

请生成一份完整的「竞品阻击包（Kill Sheet）」，包含：

## 竞品阻击包：vs ${input.competitorName}

### 核心差异化优势（我方 vs 竞品）
（3-5条，每条说明具体场景和证据）

### 竞品已知弱点
（3-4条，基于市场公开信息和客户反馈）

### 客户常见质疑与应对话术
| 客户质疑 | 应对话术 |
|---------|----------|
（3-4条最常见质疑）

### 技术对标澄清
（关键技术指标对比，帮助 SA 在 POC 中占据主动）

### 赢单策略建议
（针对该竞品的 3 步赢单策略）

请确保内容具体、可操作，避免空泛描述。`;

      const res = await invokeLLM({
        model: 'gpt-4o',
        messages: [{ role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT }, { role: "user", content: prompt }],
      });
      const aiContent = String(res.choices[0].message.content || '');

      // Save to database
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');
      const { killSheets } = await import('../drizzle/schema.js');
      const [result] = await db.insert(killSheets).values({
        competitorName: input.competitorName,
        productLine: input.productLine,
        ourProduct: input.ourProduct,
        aiContent,
        sourceClientId: input.sourceClientId,
      } as any);
      return { id: (result as any).insertId, aiContent };
    }),
    delete: publicProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');
      const { killSheets } = await import('../drizzle/schema.js');
      const { eq } = await import('drizzle-orm');
      await db.delete(killSheets).where(eq(killSheets.id, input.id));
      return { success: true };
    }),
    // List kill sheets matching detected competitor names (for meeting log auto-match)
    listByCompetitors: publicProcedure.input(z.object({
      competitorNames: z.array(z.string()),
    })).query(async ({ input }) => {
      if (!input.competitorNames.length) return [];
      const db = await getDb();
      if (!db) return [];
      const { killSheets } = await import('../drizzle/schema.js');
      const { or, like } = await import('drizzle-orm');
      const conditions = input.competitorNames.map(name => like(killSheets.competitorName, `%${name}%`));
      return db.select().from(killSheets).where(or(...conditions));
    }),
  }),

  // CRM Integration (销售易 Xiaoshouyi OpenAPI v2.0)
  // 认证：密码模式 POST https://api.xiaoshouyi.com/oauth2/token.action
  // 接口：REST v2.0 https://api.xiaoshouyi.com/rest/data/v2.0/xobjects/<object>
  // password = 账号密码 + 8位安全令牌（直接拼接，如：123456ABCDEFGH）
  crm: router({
    // 测试连接并获取 access_token
    testConnection: publicProcedure
      .input(z.object({
        clientId: z.string(),
        clientSecret: z.string(),
        redirectUri: z.string().default('https://api.xiaoshouyi.com'),
        username: z.string(),
        password: z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          const tokenUrl = 'https://api.xiaoshouyi.com/oauth2/token.action';
          const params = new URLSearchParams({
            grant_type: 'password',
            client_id: input.clientId,
            client_secret: input.clientSecret,
            redirect_uri: input.redirectUri,
            username: input.username,
            password: input.password,
          });
          const res = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
          });
          if (!res.ok) {
            const err = await res.text();
            return { success: false, error: `认证失败: ${res.status} ${err.slice(0, 200)}` };
          }
          const data = await res.json() as { access_token: string; token_type: string; id: number };
          return { success: true, accessToken: data.access_token, userId: data.id };
        } catch (e: any) {
          return { success: false, error: e.message || '连接失败' };
        }
      }),

    // 推送商机到销售易（销售机会对象）
    pushOpportunity: publicProcedure
      .input(z.object({
        accessToken: z.string(),
        clientName: z.string(),
        stage: z.string(),
        amount: z.number().optional(),
        closeDate: z.string(),
        description: z.string().optional(),
        ownerId: z.number().optional(),
        entityType: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const apiUrl = 'https://api.xiaoshouyi.com/rest/data/v2.0/xobjects/opportunity';
          const body: Record<string, unknown> = {
            data: {
              name: `${input.clientName} - T100专项商机`,
              stage: input.stage,
              closeDate: input.closeDate,
              description: input.description || 'T100专项作战指挥系统同步',
              ...(input.amount && { amount: input.amount }),
              ...(input.ownerId && { owner: input.ownerId }),
              ...(input.entityType && { entityType: input.entityType }),
            }
          };
          const res = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${input.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          });
          if (!res.ok) {
            const err = await res.text();
            return { success: false, error: `推送失败: ${res.status} ${err.slice(0, 300)}` };
          }
          const data = await res.json() as { code: number; msg: string; data: { id: number } };
          if (data.code !== 200) return { success: false, error: data.msg };
          return { success: true, crmId: String(data.data.id) };
        } catch (e: any) {
          return { success: false, error: e.message || '推送失败' };
        }
      }),

    // 推送联系人到销售易（联系人对象）
    pushContact: publicProcedure
      .input(z.object({
        accessToken: z.string(),
        fullName: z.string(),
        title: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        department: z.string().optional(),
        notes: z.string().optional(),
        ownerId: z.number().optional(),
        entityType: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const apiUrl = 'https://api.xiaoshouyi.com/rest/data/v2.0/xobjects/contact';
          const body: Record<string, unknown> = {
            data: {
              fullName: input.fullName,
              ...(input.title && { title: input.title }),
              ...(input.email && { email: input.email }),
              ...(input.phone && { phone: input.phone }),
              ...(input.department && { department: input.department }),
              ...(input.notes && { description: input.notes }),
              ...(input.ownerId && { owner: input.ownerId }),
              ...(input.entityType && { entityType: input.entityType }),
            }
          };
          const res = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${input.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          });
          if (!res.ok) {
            const err = await res.text();
            return { success: false, error: `推送失败: ${res.status} ${err.slice(0, 300)}` };
          }
          const data = await res.json() as { code: number; msg: string; data: { id: number } };
          if (data.code !== 200) return { success: false, error: data.msg };
          return { success: true, crmId: String(data.data.id) };
        } catch (e: any) {
          return { success: false, error: e.message || '推送失败' };
        }
      }),

    // 从销售易拉取商机列表
    pullOpportunities: publicProcedure
      .input(z.object({
        accessToken: z.string(),
        pageSize: z.number().default(20),
        pageNo: z.number().default(1),
      }))
      .mutation(async ({ input }) => {
        try {
          const apiUrl = `https://api.xiaoshouyi.com/rest/data/v2.0/xobjects/opportunity?pageSize=${input.pageSize}&pageNo=${input.pageNo}`;
          const res = await fetch(apiUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${input.accessToken}`,
              'Content-Type': 'application/json',
            },
          });
          if (!res.ok) {
            const err = await res.text();
            return { success: false, error: `拉取失败: ${res.status} ${err.slice(0, 300)}`, opportunities: [] };
          }
          const data = await res.json() as {
            code: number;
            msg: string;
            data: {
              total: number;
              records: Array<{
                id: number;
                name: string;
                stage: string;
                amount?: number;
                closeDate?: string;
                description?: string;
                owner?: { id: number; name: string };
                createdDate?: string;
                lastModifiedDate?: string;
              }>;
            };
          };
          if (data.code !== 200) return { success: false, error: data.msg, opportunities: [] };
          return {
            success: true,
            total: data.data.total,
            opportunities: data.data.records.map(r => ({
              id: String(r.id),
              name: r.name,
              stage: r.stage,
              amount: r.amount,
              closeDate: r.closeDate,
              description: r.description,
              ownerName: r.owner?.name,
              createdDate: r.createdDate,
              lastModifiedDate: r.lastModifiedDate,
            })),
          };
        } catch (e: any) {
          return { success: false, error: e.message || '拉取失败', opportunities: [] };
        }
      }),
    }),

  // ── 产品文档仓库 ──────────────────────────────────────────────────────────
  productDocs: router({
    // 获取所有产品文档
    list: publicProcedure
      .input(z.object({ productLine: z.string().optional() }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const { productDocs } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        if (input?.productLine) {
          return db.select().from(productDocs).where(eq(productDocs.productLine, input.productLine)).orderBy(productDocs.createdAt);
        }
        return db.select().from(productDocs).orderBy(productDocs.createdAt);
      }),

    // 上传产品文档
    // 获取预签名上传URL（前端直传S3，无大小限制）
    getUploadUrl: protectedProcedure
      .input(z.object({
        filename: z.string(),
        mimeType: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { ENV } = await import('./_core/env');
        const forgeUrl = (ENV.forgeApiUrl || '').replace(/\/+$/, '');
        const forgeKey = ENV.forgeApiKey;
        if (!forgeUrl || !forgeKey) throw new Error('Storage config missing');
        const hash = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
        const ext = input.filename.includes('.') ? input.filename.slice(input.filename.lastIndexOf('.')) : '';
        const base = input.filename.includes('.') ? input.filename.slice(0, input.filename.lastIndexOf('.')) : input.filename;
        const fileKey = `product-docs/${Date.now()}-${base}_${hash}${ext}`;
        const presignUrl = new URL('v1/storage/presign/put', forgeUrl + '/');
        presignUrl.searchParams.set('path', fileKey);
        const presignResp = await fetch(presignUrl.toString(), {
          headers: { Authorization: `Bearer ${forgeKey}` },
        });
        if (!presignResp.ok) {
          const msg = await presignResp.text().catch(() => presignResp.statusText);
          throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
        }
        const { url: s3Url } = await presignResp.json() as { url: string };
        return { fileKey, uploadUrl: s3Url, fileUrl: `/manus-storage/${fileKey}` };
      }),

    // 确认上传完成，写入数据库
    confirmUpload: protectedProcedure
      .input(z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        productLine: z.string().optional(),
        folderId: z.number().nullable().optional(),
        tags: z.array(z.string()).optional(),
        filename: z.string(),
        mimeType: z.string(),
        fileKey: z.string(),
        fileUrl: z.string(),
        fileSize: z.number().optional(),
        extractedText: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error('Database unavailable');
        const { productDocs } = await import('../drizzle/schema');
        const [result] = await db.insert(productDocs).values({
          title: input.title,
          description: input.description,
          productLine: input.productLine,
          folderId: input.folderId ?? null,
          tags: input.tags,
          filename: input.filename,
          fileKey: input.fileKey,
          fileUrl: input.fileUrl,
          mimeType: input.mimeType,
          fileSize: input.fileSize,
          extractedText: input.extractedText || null,
          uploadedBy: ctx.user?.name || 'unknown',
        });
        return { id: (result as any).insertId, fileKey: input.fileKey, fileUrl: input.fileUrl };
      }),

    // 系统内新建知识文档：内容同时存入 S3 Markdown 文件与产品文档索引，供预览和 AI 生成引用
    createNote: protectedProcedure
      .input(z.object({
        title: z.string().min(1).max(300),
        description: z.string().max(2000).optional(),
        productLine: z.string().min(1).max(100),
        folderId: z.number().nullable().optional(),
        content: z.string().min(1).max(50000),
        tags: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error('Database unavailable');
        const { productDocs } = await import('../drizzle/schema');
        const { storagePut } = await import('./storage');
        // 中文标题仅作为数据库展示名；S3/Forge 的对象路径必须严格使用 ASCII。
        const filename = `${input.title}.md`;
        const markdown = `# ${input.title}\n\n${input.description ? `> ${input.description}\n\n` : ''}${input.content.trim()}\n`;
        const { createAsciiDocumentStorageKey } = await import('./storage');
        const fileKeyBase = createAsciiDocumentStorageKey('product-docs/notes', 'md');
        const { key: fileKey, url: fileUrl } = await storagePut(
          fileKeyBase,
          markdown,
          'text/markdown; charset=utf-8',
        );
        const [result] = await db.insert(productDocs).values({
          title: input.title,
          description: input.description,
          productLine: input.productLine,
          folderId: input.folderId ?? null,
          tags: input.tags,
          filename,
          fileKey,
          fileUrl,
          mimeType: 'text/markdown',
          fileSize: Buffer.byteLength(markdown, 'utf8'),
          extractedText: markdown,
          uploadedBy: ctx.user?.name || 'unknown',
        });
        return { id: (result as any).insertId, fileKey, fileUrl };
      }),

    // 批量补跑文字提取（为已上传但无extractedText的文档）
    extractTextBatch: protectedProcedure
      .mutation(async () => {
        const db = await getDb();
        if (!db) throw new Error('Database unavailable');
        const { productDocs } = await import('../drizzle/schema');
        const { isNull, or, eq } = await import('drizzle-orm');
        // 获取所有没有 extractedText 的文档
        const docs = await db.select({
          id: productDocs.id,
          fileKey: productDocs.fileKey,
          mimeType: productDocs.mimeType,
          filename: productDocs.filename,
        }).from(productDocs).where(or(isNull(productDocs.extractedText), eq(productDocs.extractedText, '')));
        
        const { storageGetSignedUrl } = await import('./storage');
        const { extractTextFromBuffer } = await import('./docExtract');
        let processed = 0;
        let failed = 0;
        
        for (const doc of docs) {
          try {
            // 获取签名 URL 并下载文件
            const signedUrl = await storageGetSignedUrl(doc.fileKey);
            const resp = await fetch(signedUrl);
            if (!resp.ok) { failed++; continue; }
            const arrayBuffer = await resp.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const text = await extractTextFromBuffer(buffer, doc.mimeType || '', doc.filename || '');
            if (text) {
              await db.update(productDocs).set({ extractedText: text }).where(eq(productDocs.id, doc.id));
              processed++;
            }
          } catch (e: any) {
            console.error('[extractTextBatch] doc', doc.id, e.message);
            failed++;
          }
        }
        return { total: docs.length, processed, failed };
      }),
    // 自建子文件夹：产品线为固定第一层，子文件夹用于归档资料包。
    listFolders: protectedProcedure
      .input(z.object({ productLine: z.string().optional() }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const { productDocFolders } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        if (input?.productLine) {
          return db.select().from(productDocFolders)
            .where(eq(productDocFolders.productLine, input.productLine))
            .orderBy(productDocFolders.createdAt);
        }
        return db.select().from(productDocFolders).orderBy(productDocFolders.productLine, productDocFolders.createdAt);
      }),

    createFolder: protectedProcedure
      .input(z.object({ productLine: z.string().min(1).max(100), name: z.string().trim().min(1).max(120) }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error('Database unavailable');
        const { productDocFolders } = await import('../drizzle/schema');
        const { and, eq } = await import('drizzle-orm');
        const existing = await db.select({ id: productDocFolders.id }).from(productDocFolders)
          .where(and(eq(productDocFolders.productLine, input.productLine), eq(productDocFolders.name, input.name))).limit(1);
        if (existing.length) throw new Error('该产品线下已存在同名文件夹');
        const [result] = await db.insert(productDocFolders).values({
          productLine: input.productLine,
          name: input.name,
          createdBy: ctx.user?.name || 'unknown',
        });
        return { id: Number((result as any).insertId), name: input.name };
      }),

    renameFolder: protectedProcedure
      .input(z.object({ id: z.number(), name: z.string().trim().min(1).max(120) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database unavailable');
        const { productDocFolders } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        await db.update(productDocFolders).set({ name: input.name }).where(eq(productDocFolders.id, input.id));
        return { success: true };
      }),

    deleteFolder: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database unavailable');
        const { productDocFolders, productDocs } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        const docsInFolder = await db.select({ id: productDocs.id }).from(productDocs)
          .where(eq(productDocs.folderId, input.id)).limit(1);
        if (docsInFolder.length) throw new Error('请先将文件夹内文档移动到其他位置，再删除文件夹');
        await db.delete(productDocFolders).where(eq(productDocFolders.id, input.id));
        return { success: true };
      }),

    moveToFolder: protectedProcedure
      .input(z.object({ id: z.number(), folderId: z.number().nullable() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database unavailable');
        const { productDocs, productDocFolders } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        if (input.folderId === null) {
          await db.update(productDocs).set({ folderId: null }).where(eq(productDocs.id, input.id));
          return { success: true };
        }
        const [folder] = await db.select().from(productDocFolders).where(eq(productDocFolders.id, input.folderId)).limit(1);
        if (!folder) throw new Error('目标文件夹不存在或已被删除');
        await db.update(productDocs).set({ folderId: folder.id, productLine: folder.productLine }).where(eq(productDocs.id, input.id));
        return { success: true };
      }),

    // 修改文档产品线（跨产品线移动时回到目标产品线根目录）
    updateProductLine: protectedProcedure
      .input(z.object({ id: z.number(), productLine: z.string() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database unavailable');
        const { productDocs } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        await db.update(productDocs).set({ productLine: input.productLine, folderId: null }).where(eq(productDocs.id, input.id));
        return { success: true };
      }),

    // 删除产品文档（实际delete接口）
    deleteDoc: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database unavailable');
        const { productDocs } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        await db.delete(productDocs).where(eq(productDocs.id, input.id));
        return { success: true };
      }),

    // AI 批量识别产品线
    autoTagProductLine: protectedProcedure
      .mutation(async () => {
        const db = await getDb();
        if (!db) throw new Error('Database unavailable');
        const { productDocs } = await import('../drizzle/schema');
        const { isNull, or, eq } = await import('drizzle-orm');
        const { invokeLLM } = await import('./_core/llm');
        const docs = await db.select({
          id: productDocs.id,
          title: productDocs.title,
          filename: productDocs.filename,
          extractedText: productDocs.extractedText,
        }).from(productDocs).where(or(isNull(productDocs.productLine), eq(productDocs.productLine, '')));
        const productLinePromptText = getProductLinePrompt();
        let tagged = 0;
        let failed = 0;
        for (const doc of docs) {
          try {
            const textSnippet = doc.extractedText
              ? doc.extractedText.slice(0, 1500)
              : `文件名：${doc.filename || doc.title}`;
            const prompt = `请根据文档信息判断该文档属于哪个产品线。\n\n【可选产品线列表】\n${productLinePromptText}\n\n【文档标题】${doc.title}\n【文档内容摘录】\n${textSnippet}\n\n只返回产品线的 value 值（如：AI XDR、TrustOne），不含其他文字。无法判断返回"未知"。`;
            const result = await invokeLLM({ model: 'gpt-4o-mini', messages: [{ role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT }, { role: "user", content: prompt }], maxTokens: 50 });
            const rawText = result.choices?.[0]?.message?.content;
            const productLine = (typeof rawText === 'string' ? rawText : '').trim().replace(/["""'']/g, '').trim();
            if ((PRODUCT_LINE_VALUES as string[]).includes(productLine)) {
              await db.update(productDocs).set({ productLine }).where(eq(productDocs.id, doc.id));
              tagged++;
            } else {
              failed++;
            }
          } catch (e: any) {
            console.error('[autoTagProductLine] doc', doc.id, e.message);
            failed++;
          }
        }
        return { total: docs.length, tagged, failed };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database unavailable');
        const { productDocs } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        await db.delete(productDocs).where(eq(productDocs.id, input.id));
        return { success: true };
      }),

    // AI 提取文档摘要和关键卖点
    extractSummary: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database unavailable');
        const { productDocs } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        const [doc] = await db.select().from(productDocs).where(eq(productDocs.id, input.id));
        if (!doc) throw new Error('文档不存在');
        const { invokeLLM } = await import('./_core/llm');
        const context = doc.extractedText
          ? `文档内容摘录：\n${doc.extractedText.slice(0, 3000)}`
          : `文档名称：${doc.title}\n产品线：${doc.productLine || '未知'}\n描述：${doc.description || '无'}`;
        const prompt = `请分析以下产品文档，提取核心摘要和关键卖点。

${context}

请以JSON格式返回：
{
  "summary": "2-3句话的核心摘要，说明这是什么产品/文档，主要解决什么问题",
  "keyPoints": ["卖点1", "卖点2", "卖点3", "卖点4", "卖点5"],
  "targetCustomer": "适合哪类客户或场景",
  "competitiveEdge": "与竞品相比的核心优势（1句话）"
}`;
        const res = await invokeLLM({
          model: 'gpt-4o-mini',
          messages: [{ role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT }, { role: "user", content: prompt }],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'doc_summary',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  summary: { type: 'string' },
                  keyPoints: { type: 'array', items: { type: 'string' } },
                  targetCustomer: { type: 'string' },
                  competitiveEdge: { type: 'string' },
                },
                required: ['summary', 'keyPoints', 'targetCustomer', 'competitiveEdge'],
                additionalProperties: false,
              },
            },
          },
        });
        const parsed = JSON.parse(String(res.choices[0].message.content || '{}'));
        // 保存摘要到数据库
        await db.update(productDocs).set({ extractedText: JSON.stringify(parsed) }).where(eq(productDocs.id, input.id));
        return parsed;
      }),

    // 获取文档的 S3 签名直链（用于预览，有效期1小时）
    getSignedUrl: protectedProcedure
      .input(z.object({ fileKey: z.string() }))
      .mutation(async ({ input }) => {
        const { storageGetSignedUrl } = await import('./storage');
        const url = await storageGetSignedUrl(input.fileKey);
        return { url };
      }),
  }),

  // ── AI方案定制 ──────────────────────────────────────────────────────────
  arsenalAI: router({
    // 获取AI生成历史
    list: publicProcedure
      .input(z.object({ clientId: z.number().optional(), opportunityId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const { arsenalGenerated } = await import('../drizzle/schema');
        const { eq, desc } = await import('drizzle-orm');
        if (input?.opportunityId) {
          return db.select().from(arsenalGenerated).where(eq(arsenalGenerated.opportunityId, input.opportunityId)).orderBy(desc(arsenalGenerated.createdAt));
        }
        if (input?.clientId) {
          return db.select().from(arsenalGenerated).where(eq(arsenalGenerated.clientId, input.clientId)).orderBy(desc(arsenalGenerated.createdAt));
        }
        return db.select().from(arsenalGenerated).orderBy(desc(arsenalGenerated.createdAt)).limit(50);
      }),

    // AI生成方案定制内容
    generate: protectedProcedure
      .input(z.object({
        category: z.enum(['方案类', '弹药类', '话术类']),
        prompt: z.string().min(1),
        docIds: z.array(z.number()).optional(),
        clientId: z.number().optional(),
        opportunityId: z.number().optional(),
        targetContact: z.string().optional(),
        title: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error('Database unavailable');
        const { arsenalGenerated, productDocs } = await import('../drizzle/schema');
        const { inArray } = await import('drizzle-orm');

        // 读取参考文档内容
        let docContext = '';
        if (input.docIds && input.docIds.length > 0) {
          const docs = await db.select().from(productDocs).where(inArray(productDocs.id, input.docIds));
          docContext = docs.map((d: any) =>
            `【文档：${d.title}】\n${d.extractedText || d.description || '（无提取文本）'}`
          ).join('\n\n---\n\n');
        }

        const categoryGuide: Record<string, string> = {
          '方案类': '请生成一份专业的技术方案文档，包含：客户痛点分析、解决方案架构、核心功能说明、技术优势、实施路径、预期价值。',
          '弹药类': '请生成竞争弹药材料，包含：产品核心差异化亮点、竞争对比优势、关键技术指标、客户成功案例要点、常见异议处理话术。',
          '话术类': '请生成销售沟通话术，包含：开场白/破冰话术、痛点引导问题、价值主张陈述、异议处理回应、推进下一步行动的话术。',
        };

        const guide = categoryGuide[input.category] || '';
        const opportunityContext = input.clientId && input.opportunityId
          ? await getArsenalOpportunityContext(input.clientId, input.opportunityId)
          : "";
        let historyContext = "【历史方案处置记录】\n暂无同商机经人工确认的采用或客户反馈记录。";
        if (input.opportunityId) {
          const { eq, desc } = await import('drizzle-orm');
          const priorMaterials = await db.select().from(arsenalGenerated).where(eq(arsenalGenerated.opportunityId, input.opportunityId)).orderBy(desc(arsenalGenerated.createdAt)).limit(5);
          const reviewedHistory = priorMaterials
            .filter((row: any) => row.adoptionStatus === "已采用" || row.customerFeedback)
            .map((row: any) => `- ${row.title}：人工状态=${row.adoptionStatus}；客户反馈=${row.customerFeedback || "未录入"}`)
            .join("\n");
          if (reviewedHistory) historyContext = `【历史方案处置记录（仅供待验证参考）】\n${reviewedHistory}\n不得把这些反馈当作新的客户事实；如与当前证据冲突，以当前商机事实为准。`;
        }
        const userMsg = `你是 AIStorm 的资深解决方案架构师，负责将已核验的作战事实转化为可供人工审核的${input.category}材料。

${guide}

输出要求：
- 使用 Markdown，结构清晰，便于销售、SA 和 AD 审阅
- 优先解决当前商机最弱 Win 因子，而不是泛化介绍产品
- 仅引用已提供的产品文档和商机事实；无来源数据不得编造
- 未确认事项必须标为“待验证假设”或“数据不足，暂不判断”
${opportunityContext}
${historyContext}

销售需求描述：
${input.prompt}

${docContext ? `参考产品文档：\n${docContext}` : "未选择参考文档；仅可使用已入库商机事实与 AIStorm 通用产品知识，不能编造客户数据。"}`;

        const llmResult = await invokeLLM({
          messages: [
            { role: 'system', content: SALES_METHODOLOGY_SYSTEM_PROMPT },
            { role: 'user', content: userMsg },
          ],
          model: 'claude-sonnet-4-5',
          maxTokens: 4000,
        });
        const generatedContent = llmResult.choices?.[0]?.message?.content as string || '';

        // 保存生成记录
        const title = input.title || `${input.category} - ${new Date().toLocaleDateString('zh-CN')}`;
        const [result] = await db.insert(arsenalGenerated).values({
          category: input.category,
          title,
          prompt: input.prompt,
          docIds: input.docIds,
          generatedContent,
          clientId: input.clientId,
          opportunityId: input.opportunityId,
          targetContact: input.targetContact,
          createdBy: ctx.user?.name || 'unknown',
        });
        return { id: (result as any).insertId, content: generatedContent, title };
      }),

    updateOutcome: protectedProcedure
      .input(z.object({ id: z.number(), adoptionStatus: z.enum(["待确认", "已采用", "未采用"]), customerFeedback: z.string().max(3000).optional() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database unavailable');
        const { arsenalGenerated } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        await db.update(arsenalGenerated).set({ adoptionStatus: input.adoptionStatus, customerFeedback: input.customerFeedback?.trim() || null, outcomeUpdatedAt: new Date() } as any).where(eq(arsenalGenerated.id, input.id));
        return { success: true };
      }),

    // 删除生成记录
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database unavailable');
        const { arsenalGenerated } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        await db.delete(arsenalGenerated).where(eq(arsenalGenerated.id, input.id));
        return { success: true };
      }),
  }),

  // ── ListPrice 报价数据 ──────────────────────────────────────────────────────────
  listprice: router({
    // 搜索产品（支持关键词和产品线过滤）
    search: publicProcedure
      .input(z.object({
        keyword: z.string().optional(),
        productLine: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const { listpriceItems } = await import('../drizzle/schema');
        const { like, eq, and, or } = await import('drizzle-orm');
        const conditions: any[] = [];
        if (input?.productLine) {
          conditions.push(eq(listpriceItems.productLine, input.productLine));
        }
        if (input?.keyword) {
          conditions.push(or(
            like(listpriceItems.productName, `%${input.keyword}%`),
            like(listpriceItems.model || '', `%${input.keyword}%`),
            like(listpriceItems.specs || '', `%${input.keyword}%`),
          ));
        }
        const query = conditions.length > 0
          ? db.select().from(listpriceItems).where(and(...conditions))
          : db.select().from(listpriceItems);
        return query.orderBy(listpriceItems.productLine, listpriceItems.productName);
      }),

    // 获取所有产品线
    getProductLines: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const { listpriceItems } = await import('../drizzle/schema');
      const rows = await db.selectDistinct({ productLine: listpriceItems.productLine }).from(listpriceItems);
      return rows.map((r: any) => r.productLine);
    }),
  }),

  // ── 报价单 ──────────────────────────────────────────────────────────
  quotes: router({
    // 获取所有报价单
    list: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const { quotes } = await import('../drizzle/schema');
      const { desc } = await import('drizzle-orm');
      return db.select().from(quotes).orderBy(desc(quotes.createdAt));
    }),

    // 获取报价单详情（含明细）
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        const { quotes, quoteItems } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        const [quote] = await db.select().from(quotes).where(eq(quotes.id, input.id));
        const items = await db.select().from(quoteItems).where(eq(quoteItems.quoteId, input.id)).orderBy(quoteItems.sortOrder);
        return { quote, items };
      }),

    // 创建报价单
    create: protectedProcedure
      .input(z.object({
        clientName: z.string().optional(),
        clientId: z.number().optional(),
        contactName: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error('Database unavailable');
        const { quotes } = await import('../drizzle/schema');
        const quoteNumber = `QT-${Date.now().toString().slice(-8)}`;
        const [result] = await db.insert(quotes).values({
          quoteNumber,
          clientName: input.clientName,
          clientId: input.clientId,
          contactName: input.contactName,
          notes: input.notes,
          createdBy: ctx.user?.name || 'unknown',
        });
        return { id: (result as any).insertId, quoteNumber };
      }),

    // 更新报价单
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        clientName: z.string().optional(),
        contactName: z.string().optional(),
        notes: z.string().optional(),
        status: z.enum(['草稿', '已发送', '已接受', '已拒绝', '已过期']).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database unavailable');
        const { quotes } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        const { id, ...data } = input;
        await db.update(quotes).set(data as any).where(eq(quotes.id, id));
        return { success: true };
      }),

    // 删除报价单
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database unavailable');
        const { quotes, quoteItems } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        await db.delete(quoteItems).where(eq(quoteItems.quoteId, input.id));
        await db.delete(quotes).where(eq(quotes.id, input.id));
        return { success: true };
      }),

    // 添加报价明细
    addItem: protectedProcedure
      .input(z.object({
        quoteId: z.number(),
        listpriceItemId: z.number().optional(),
        productName: z.string(),
        model: z.string().optional(),
        unit: z.string().optional(),
        quantity: z.number().min(1),
        listPriceUsd: z.number(),
        discountPct: z.number().min(0).max(100),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database unavailable');
        const { quotes, quoteItems } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        // 折扣逻辑：discountPct=40 表示 40% off，实际价格 = listPrice × (1 - 40/100) = listPrice × 60%
        const discountedPriceUsd = input.listPriceUsd * (1 - input.discountPct / 100);
        const subtotalListPrice = input.listPriceUsd * input.quantity;
        const subtotalDiscounted = discountedPriceUsd * input.quantity;
        const [result] = await db.insert(quoteItems).values({
          quoteId: input.quoteId,
          listpriceItemId: input.listpriceItemId,
          productName: input.productName,
          model: input.model,
          unit: input.unit,
          quantity: input.quantity,
          listPriceUsd: input.listPriceUsd,
          discountPct: input.discountPct,
          discountedPriceUsd,
          subtotalListPrice,
          subtotalDiscounted,
          notes: input.notes,
        });
        const allItems = await db.select().from(quoteItems).where(eq(quoteItems.quoteId, input.quoteId));
        const totalListPrice = allItems.reduce((s: number, i: any) => s + i.subtotalListPrice, 0);
        const totalDiscountedPrice = allItems.reduce((s: number, i: any) => s + i.subtotalDiscounted, 0);
        await db.update(quotes).set({ totalListPrice, totalDiscountedPrice }).where(eq(quotes.id, input.quoteId));
        return { id: (result as any).insertId, discountedPriceUsd, subtotalDiscounted };
      }),

    // 更新报价明细（折扣/数量）
    updateItem: protectedProcedure
      .input(z.object({
        id: z.number(),
        quoteId: z.number(),
        quantity: z.number().min(1).optional(),
        discountPct: z.number().min(0).max(100).optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database unavailable');
        const { quotes, quoteItems } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        const [existing] = await db.select().from(quoteItems).where(eq(quoteItems.id, input.id));
        if (!existing) throw new Error('Item not found');
        const quantity = input.quantity ?? existing.quantity;
        const discountPct = input.discountPct ?? existing.discountPct;
        const discountedPriceUsd = existing.listPriceUsd * (1 - discountPct / 100);
        const subtotalListPrice = existing.listPriceUsd * quantity;
        const subtotalDiscounted = discountedPriceUsd * quantity;
        await db.update(quoteItems).set({
          quantity,
          discountPct,
          discountedPriceUsd,
          subtotalListPrice,
          subtotalDiscounted,
          notes: input.notes ?? existing.notes,
        }).where(eq(quoteItems.id, input.id));
        const allItems = await db.select().from(quoteItems).where(eq(quoteItems.quoteId, input.quoteId));
        const totalListPrice = allItems.reduce((s: number, i: any) => s + i.subtotalListPrice, 0);
        const totalDiscountedPrice = allItems.reduce((s: number, i: any) => s + i.subtotalDiscounted, 0);
        await db.update(quotes).set({ totalListPrice, totalDiscountedPrice }).where(eq(quotes.id, input.quoteId));
        return { success: true };
      }),

    // 删除报价明细
    deleteItem: protectedProcedure
      .input(z.object({ id: z.number(), quoteId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database unavailable');
        const { quotes, quoteItems } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        await db.delete(quoteItems).where(eq(quoteItems.id, input.id));
        const allItems = await db.select().from(quoteItems).where(eq(quoteItems.quoteId, input.quoteId));
        const totalListPrice = allItems.reduce((s: number, i: any) => s + i.subtotalListPrice, 0);
        const totalDiscountedPrice = allItems.reduce((s: number, i: any) => s + i.subtotalDiscounted, 0);
        await db.update(quotes).set({ totalListPrice, totalDiscountedPrice }).where(eq(quotes.id, input.quoteId));
        return { success: true };
      }),
  }),

  // ── System Config ─────────────────────────────────────────────────────────────
  systemConfig: router({
    getAll: publicProcedure.query(() => getAllSystemConfigs()),
    get: publicProcedure.input(z.object({ key: z.string() })).query(({ input }) => getSystemConfig(input.key)),
    set: adminProcedure.input(z.object({ key: z.string(), value: z.string() })).mutation(({ input }) =>
      setSystemConfig(input.key, input.value)
    ),

    // 检测飞书应用权限
    checkFeishuPermissions: adminProcedure.mutation(async () => {
      const { ENV } = await import('./_core/env');
      const checks: Array<{ name: string; pass: boolean; detail: string }> = [];

      // 1. 检查 App ID/Secret 是否配置
      const hasCredentials = !!(ENV.feishuAppId && ENV.feishuAppSecret);
      checks.push({
        name: 'App ID / Secret 已配置',
        pass: hasCredentials,
        detail: hasCredentials ? `App ID: ${ENV.feishuAppId.slice(0, 12)}...` : '未配置 FEISHU_APP_ID 或 FEISHU_APP_SECRET',
      });
      if (!hasCredentials) return { checks, allPass: false };

      // 2. 获取 Tenant Access Token
      let token = '';
      try {
        const tokenRes = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ app_id: ENV.feishuAppId, app_secret: ENV.feishuAppSecret }),
        });
        const tokenData = await tokenRes.json() as any;
        token = tokenData.tenant_access_token ?? '';
        checks.push({
          name: '获取 Tenant Access Token',
          pass: !!token,
          detail: token ? '成功' : `失败：${tokenData.msg || '未知错误'} (code: ${tokenData.code})`,
        });
      } catch (e: any) {
        checks.push({ name: '获取 Tenant Access Token', pass: false, detail: `网络错误：${e.message}` });
        return { checks, allPass: false };
      }
      if (!token) return { checks, allPass: false };

      // 3. 检测发送消息权限（尝试查询 Bot 信息）
      try {
        const botRes = await fetch('https://open.feishu.cn/open-apis/bot/v3/info', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const botData = await botRes.json() as any;
        const botOk = botData.code === 0;
        checks.push({
          name: '机器人信息可读（im:message 权限）',
          pass: botOk,
          detail: botOk ? `机器人名称：${botData.bot?.app_name || '未知'}` : `失败：${botData.msg} (code: ${botData.code})`,
        });
      } catch (e: any) {
        checks.push({ name: '机器人信息可读', pass: false, detail: `网络错误：${e.message}` });
      }

      // 4. 检测通讯录权限（查询用户 ID 所需）
      try {
        const contactRes = await fetch(
          'https://open.feishu.cn/open-apis/contact/v3/users/batch_get_id?user_id_type=open_id',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ emails: ['test@example.com'] }),
          }
        );
        const contactData = await contactRes.json() as any;
        // code 0 = success (user not found is ok), code 99991663 = no permission
        const contactOk = contactData.code !== 99991663 && contactData.code !== 99991401;
        checks.push({
          name: '通讯录查询权限（contact:user.employee_id:readonly）',
          pass: contactOk,
          detail: contactOk ? '权限已开通' : `权限不足：${contactData.msg} (code: ${contactData.code})，请在飞书开放平台开通该权限`,
        });
      } catch (e: any) {
        checks.push({ name: '通讯录查询权限', pass: false, detail: `网络错误：${e.message}` });
      }

      const allPass = checks.every(c => c.pass);
      return { checks, allPass };
    }),
  }),

  // ── LLM Configuration ─────────────────────────────────────────────────────
  llmConfig: router({
    // Get all configured providers (keys are masked)
    getAll: publicProcedure.query(async () => {
      const keys = ["llm_openai_key", "llm_claude_key", "llm_glm_key", "llm_custom_key", "llm_custom_url", "llm_primary_provider", "llm_fast_provider"];
      const configs: Record<string, string> = {};
      for (const k of keys) {
        const val = await getSystemConfig(k);
        if (val) {
          // Mask API keys for display
          if (k.endsWith("_key") && val.length > 8) {
            configs[k] = val.slice(0, 6) + "••••••••" + val.slice(-4);
          } else {
            configs[k] = val;
          }
        }
      }
      return configs;
    }),
    // Save a provider's API key
    setKey: publicProcedure.input(z.object({
      provider: z.enum(["openai", "claude", "glm", "custom"]),
      apiKey: z.string(),
      customUrl: z.string().optional(),
    })).mutation(async ({ input }) => {
      await setSystemConfig(`llm_${input.provider}_key`, input.apiKey);
      if (input.provider === "custom" && input.customUrl) {
        await setSystemConfig("llm_custom_url", input.customUrl);
      }
      return { ok: true };
    }),
    // Set routing preferences
    setRouting: publicProcedure.input(z.object({
      primaryProvider: z.enum(["openai", "claude", "glm", "custom", "auto"]),
      fastProvider: z.enum(["openai", "claude", "glm", "custom", "auto"]),
    })).mutation(async ({ input }) => {
      await setSystemConfig("llm_primary_provider", input.primaryProvider);
      await setSystemConfig("llm_fast_provider", input.fastProvider);
      return { ok: true };
    }),
    // Test connection for a provider
    testConnection: publicProcedure.input(z.object({
      provider: z.enum(["openai", "claude", "glm", "custom"]),
    })).mutation(async ({ input }) => {
      const apiKey = await getSystemConfig(`llm_${input.provider}_key`);
      if (!apiKey) throw new Error(`未配置 ${input.provider} API Key`);

      const providerConfig: Record<string, { url: string; model: string; headers?: Record<string, string>; body?: object }> = {
        openai: { url: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini" },
        claude: { url: "https://api.anthropic.com/v1/messages", model: "claude-3-haiku-20240307",
          headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
          body: { model: "claude-3-haiku-20240307", max_tokens: 5, messages: [{ role: "user", content: "hi" }] }
        },
        glm: { url: "https://open.bigmodel.cn/api/paas/v4/chat/completions", model: "glm-4-flash" },
        custom: { url: (await getSystemConfig("llm_custom_url")) || "", model: "gpt-4o-mini" },
      };

      const cfg = providerConfig[input.provider];
      if (!cfg.url) throw new Error("请先填写自定义 API 端点");

      try {
        let resp: Response;
        if (input.provider === "claude") {
          resp = await fetch(cfg.url, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...cfg.headers },
            body: JSON.stringify(cfg.body),
          });
        } else {
          resp = await fetch(cfg.url, {
            method: "POST",
            headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: cfg.model, messages: [{ role: "user", content: "hi" }], max_tokens: 5 }),
          });
        }
        if (!resp.ok) {
          const err = await resp.text();
          throw new Error(`HTTP ${resp.status}: ${err.slice(0, 100)}`);
        }
        return { ok: true, message: "连接成功" };
      } catch (e: any) {
        throw new Error(`连接失败: ${e.message}`);
      }
    }),
    // Remove a provider's key
    removeKey: publicProcedure.input(z.object({
      provider: z.enum(["openai", "claude", "glm", "custom"]),
    })).mutation(async ({ input }) => {
      await setSystemConfig(`llm_${input.provider}_key`, "");
      return { ok: true };
    }),
  }),


  // ── Email Auth ────────────────────────────────────────────
  emailAuth: router({
    register: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(8, '密码至少 8 个字符'),
        name: z.string().min(1, '请输入姓名'),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database unavailable');
        const { emailUsers } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        const existing = await db.select().from(emailUsers).where(eq(emailUsers.email, input.email.toLowerCase())).limit(1);
        if (existing.length > 0) throw new Error('该邮箱已注册，请直接登录');
        const passwordHash = await bcrypt.hash(input.password, 10);
        await db.insert(emailUsers).values({ email: input.email.toLowerCase(), passwordHash, name: input.name });
        return { success: true };
      }),

    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error('Database unavailable');
        const { emailUsers, emailSessions } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        const rows = await db.select().from(emailUsers).where(eq(emailUsers.email, input.email.toLowerCase())).limit(1);
        if (rows.length === 0) throw new Error('邮箱或密码错误');
        const user = rows[0];
        if (!user.isActive) throw new Error('账号已禁用，请联系管理员');
        const valid = await bcrypt.compare(input.password, user.passwordHash);
        if (!valid) throw new Error('邮箱或密码错误');
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await db.insert(emailSessions).values({ token, userId: user.id, expiresAt });
        // Record last login time
        const loginIp = (ctx.req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || ctx.req.socket?.remoteAddress || null;
        await db.update(emailUsers).set({ lastLoginAt: new Date(), lastLoginIp: loginIp }).where(eq(emailUsers.id, user.id));
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie('email_session', token, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });
        return { success: true, user: { id: user.id, email: user.email, name: user.name, role: user.role, podRole: user.podRole } };
      }),

    logout: publicProcedure.mutation(async ({ ctx }) => {
      const token = (() => { const h = ctx.req.headers?.cookie as string | undefined; if (!h) return undefined; const m = h.match(/(?:^|;\s*)email_session=([^;]+)/); return m?.[1]; })();
      if (token) {
        const db = await getDb();
        if (db) {
          const { emailSessions } = await import('../drizzle/schema');
          const { eq } = await import('drizzle-orm');
          await db.delete(emailSessions).where(eq(emailSessions.token, token));
        }
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.clearCookie('email_session', { ...cookieOptions, maxAge: -1 });
      }
      return { success: true };
    }),

    me: publicProcedure.query(async ({ ctx }) => {
      const token = (() => { const h = ctx.req.headers?.cookie as string | undefined; if (!h) return undefined; const m = h.match(/(?:^|;\s*)email_session=([^;]+)/); return m?.[1]; })();
      if (!token) return null;
      const db = await getDb();
      if (!db) return null;
      const { emailUsers, emailSessions } = await import('../drizzle/schema');
      const { eq, and, gt } = await import('drizzle-orm');
      const sessions = await db.select().from(emailSessions).where(
        and(eq(emailSessions.token, token), gt(emailSessions.expiresAt, new Date()))
      ).limit(1);
      if (sessions.length === 0) return null;
      const userRows = await db.select().from(emailUsers).where(eq(emailUsers.id, sessions[0].userId)).limit(1);
      if (userRows.length === 0 || !userRows[0].isActive) return null;
      const u = userRows[0];
      return { id: u.id, email: u.email, name: u.name, role: u.role, podRole: u.podRole };
    }),

    changePassword: publicProcedure
      .input(z.object({ currentPassword: z.string(), newPassword: z.string().min(8) }))
      .mutation(async ({ input, ctx }) => {
        const token = (() => { const h = ctx.req.headers?.cookie as string | undefined; if (!h) return undefined; const m = h.match(/(?:^|;\s*)email_session=([^;]+)/); return m?.[1]; })();
        if (!token) throw new Error('未登录');
        const db = await getDb();
        if (!db) throw new Error('Database unavailable');
        const { emailUsers, emailSessions } = await import('../drizzle/schema');
        const { eq, and, gt } = await import('drizzle-orm');
        const sessions = await db.select().from(emailSessions).where(
          and(eq(emailSessions.token, token), gt(emailSessions.expiresAt, new Date()))
        ).limit(1);
        if (sessions.length === 0) throw new Error('会话已过期');
        const userRows = await db.select().from(emailUsers).where(eq(emailUsers.id, sessions[0].userId)).limit(1);
        if (userRows.length === 0) throw new Error('用户不存在');
        const valid = await bcrypt.compare(input.currentPassword, userRows[0].passwordHash);
        if (!valid) throw new Error('当前密码错误');
        const newHash = await bcrypt.hash(input.newPassword, 10);
        await db.update(emailUsers).set({ passwordHash: newHash }).where(eq(emailUsers.id, userRows[0].id));
        return { success: true };
      }),
  }),

  // ── Effectiveness Baseline (效能账本) ────────────────────────────────────────
  effectiveness: router({
    get: publicProcedure.input(z.object({ clientId: z.number() })).query(({ input }) =>
      getEffectivenessBaseline(input.clientId)
    ),

    upsert: protectedProcedure.input(z.object({
      clientId: z.number(),
      currentMttr: z.string().optional(),
      currentDetectionRate: z.string().optional(),
      socHeadcount: z.number().optional(),
      falsePositiveRate: z.string().optional(),
      complianceAuditDays: z.number().optional(),
      complianceIncidentsPerYear: z.number().optional(),
      downtimeHoursPerYear: z.string().optional(),
      estimatedIncidentCost: z.string().optional(),
      dataSource: z.enum(["客户提供", "行业基准", "AI估算", "混合"]).optional(),
    })).mutation(async ({ input }) => {
      const { clientId, ...data } = input;
      await upsertEffectivenessBaseline(clientId, data as any);
      return { ok: true };
    }),

    // 定痛阶段：AI生成量化痛点陈述
    generatePainStatement: protectedProcedure.input(z.object({
      clientId: z.number(),
    })).mutation(async ({ input }) => {
      const [client, baseline, meetings] = await Promise.all([
        getClientById(input.clientId),
        getEffectivenessBaseline(input.clientId),
        getMeetingsByClientId(input.clientId),
      ]);
      if (!client) throw new Error("客户不存在");

      const recentPainPoints = meetings.slice(0, 3).map(m =>
        m.aiMinutes ? m.aiMinutes.slice(0, 200) : m.keyPoints?.slice(0, 200) || ""
      ).join("\n");

      const baselineText = baseline ? `
- 平均威胁响应时间（MTTR）：${baseline.currentMttr || "未知"}
- 威胁检出率：${baseline.currentDetectionRate || "未知"}
- 安全运营人员：${baseline.socHeadcount || "未知"}人
- 每年合规审计准备：${baseline.complianceAuditDays || "未知"}天
- 每年合规违规事件：${baseline.complianceIncidentsPerYear || "未知"}次
- 每年停机时长：${baseline.downtimeHoursPerYear || "未知"}
- 每次安全事件损失：${baseline.estimatedIncidentCost || "未知"}
- 数据来源：${baseline.dataSource || "AI估算"}` : "暂无效能基线数据，请使用行业基准估算";

      const prompt = `
客户：${client.name}（${client.industry || "未知行业"}）
当前阶段：${client.stage}

效能基线数据：
${baselineText}

从拜访记录中提炼的痛点：
${recentPainPoints || "暂无拜访记录"}

请生成三段式量化痛点陈述（面向Economic Buyer，使用业务语言而非技术语言）：

## 1. 痛点量化陈述（约100字）
（格式："以贵司目前X名安全人员，平均响应时间Y小时，按行业数据每次安全事件平均损失$Z，贵司每年因响应滞后承担的可估算风险敞口约为$W。"）
数据来源标注：[客户填写] / [行业基准，来源：Gartner/IDC 2025] / [AI估算，请核实]

## 2. 行业对比（约60字）
（同规模同行业企业的最佳实践数据，说明差距）

## 3. 不作为的时间成本（约60字）
（每延迟一个季度决策，对应的额外风险暴露）

注意：如果某项数据为"未知"，使用行业基准值并明确标注"[行业基准]"。`;

      const res = await invokeLLM({
        model: "gpt-4o",
        messages: [{ role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT }, { role: "user", content: prompt }],
      });
      const painStatement = String(res.choices[0].message.content || "");

      // 自动保存到效能基线
      await upsertEffectivenessBaseline(input.clientId, { quantifiedPainStatement: painStatement });

      return { content: painStatement };
    }),

    // 方案提案阶段：AI生成结构化ROI报告
    generateROI: protectedProcedure.input(z.object({
      clientId: z.number(),
      proposedProducts: z.string().optional(), // 拟推方案（如"TrustOne + CloudGuard"）
    })).mutation(async ({ input }) => {
      const [client, baseline, contacts] = await Promise.all([
        getClientById(input.clientId),
        getEffectivenessBaseline(input.clientId),
        getContactsByClientId(input.clientId),
      ]);
      if (!client) throw new Error("客户不存在");

      const champion = contacts.find(c => c.buyingRole === "Champion" || c.relationship === "Champion");

      const baselineText = baseline ? `
当前状态：
- MTTR：${baseline.currentMttr || "行业基准4小时"}
- 检出率：${baseline.currentDetectionRate || "行业基准75%"}
- SOC人员：${baseline.socHeadcount || "估算3"}人
- 合规审计准备：${baseline.complianceAuditDays || "行业基准21"}天/次
- 每年安全事件损失：${baseline.estimatedIncidentCost || "行业基准$150K/次"}
- 数据来源：${baseline.dataSource || "AI估算"}` : "使用行业基准数据估算";

      const prompt = `
客户：${client.name}（${client.industry || "未知行业"}）
拟推方案：${input.proposedProducts || "亚信安全整体方案"}
${champion ? `Champion：${champion.name}（${champion.title || ""}）` : ""}

${baselineText}

请生成三段式ROI报告（面向Economic Buyer审批，数字必须有依据）：

## 1. 当前状态年化成本
（分项列出：安全运营人力成本 + 事件响应损失 + 合规准备成本 + 合计）
数据置信度：高（客户实测）/ 中（行业基准）/ 低（AI估算）

## 2. 部署后预期改善
（分项列出：MTTR改善 → 人力节省 → 合规效率提升 → 年化价值合计）
每项标注数据来源（武器库/行业报告/AI估算）

## 3. ROI摘要
- 方案年费：[需填写]
- 年化价值：$X
- ROI：X%
- 回本周期：X个月
- 置信度：高/中/低（说明主要不确定因素）

## 4. 给Champion的一句话
（Champion向EB汇报时可以直接引用的一句话，包含具体数字）`;

      const res = await invokeLLM({
        model: "gpt-4o",
        messages: [{ role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT }, { role: "user", content: prompt }],
      });
      const roiContent = String(res.choices[0].message.content || "");

      // 自动保存ROI摘要
      await upsertEffectivenessBaseline(input.clientId, { roiSummary: roiContent });

      return { content: roiContent };
    }),
  }),

  // ── Win Strategy (IBM Blue Sheet 简化版) ─────────────────────────────────
  winStrategy: router({
    get: publicProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        const { winStrategies } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        const rows = await db.select().from(winStrategies).where(eq(winStrategies.clientId, input.clientId)).limit(1);
        return rows[0] ?? null;
      }),
    upsert: publicProcedure
      .input(z.object({
        clientId: z.number(),
        bizObjective: z.string().optional(),
        valueProposition: z.string().optional(),
        competitorSummary: z.string().optional(),
        winStrategy: z.string().optional(),
        keyMilestones: z.string().optional(),
        riskAndMitigation: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database unavailable');
        const { winStrategies } = await import('../drizzle/schema');
        const { eq } = await import('drizzle-orm');
        const existing = await db.select({ id: winStrategies.id }).from(winStrategies).where(eq(winStrategies.clientId, input.clientId)).limit(1);
        if (existing.length > 0) {
          await db.update(winStrategies).set({ ...input }).where(eq(winStrategies.clientId, input.clientId));
        } else {
          await db.insert(winStrategies).values({ ...input });
        }
        const rows = await db.select().from(winStrategies).where(eq(winStrategies.clientId, input.clientId)).limit(1);
        return rows[0];
      }),
    generateAI: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        clientName: z.string(),
        stage: z.string(),
        meddpiccSummary: z.string().optional(),
        contactsSummary: z.string().optional(),
        bizObjective: z.string().optional(),
        valueProposition: z.string().optional(),
        competitorSummary: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { invokeLLM } = await import('./_core/llm');
        // 拉取效能基线和情报信号
        const [baseline, signals] = await Promise.all([
          getEffectivenessBaseline(input.clientId),
          getSignalsByClientId(input.clientId),
        ]);
        const baselineContext = (baseline as any)?.estimatedIncidentCost
          ? `效能基线（ROI依据）：MTTR ${(baseline as any).currentMttr || "未知"}，事件损失估算 ${(baseline as any).estimatedIncidentCost}，SOC ${(baseline as any).socHeadcount || "?"}人`
          : "效能基线未填写";
        const recentSignalsWin = signals.slice(0, 3).map((s: any) =>
          `[${s.signalType}/${s.urgency}] ${s.rawSignal.slice(0, 80)}`
        ).join("\n") || "暂无情报信号";
        const prompt = `基于以下信息，为 SAM 生成一份 IBM Blue Sheet 风格的 Win Strategy 建议。

客户：${input.clientName}
当前阶段：${input.stage}
MEDDPICC 摘要：${input.meddpiccSummary || '暂无'}
关键人摘要：${input.contactsSummary || '暂无'}
客户业务目标（SAM填写）：${input.bizObjective || '暂未填写'}
我方价值主张（SAM填写）：${input.valueProposition || '暂未填写'}
竞争态势（SAM填写）：${input.competitorSummary || '暂未填写'}
竞品情报信号（最新3条）：
${recentSignalsWin}

${baselineContext}

请生成：
1. **赢单关键因素**：我们凭什么赢？（2-3条核心优势）
2. **最大风险点**：当前最可能失单的原因是什么？
3. **下一步关键行动**：基于当前阶段，最重要的3件事是什么？
4. **Champion 策略**：如何强化内部推动力？
5. **差异化定位**：针对竞品，如何在客户心中建立独特认知？

请用简洁的中文输出，每项不超过3句话，直接可用于 SAM 作战指导。`;
        // Inject Account Map diagnostic context for Win Strategy
        const winAccountDiag = await getAccountDiagnosticContext(input.clientId);
        const enrichedWinPrompt = prompt + winAccountDiag;
        const result = await invokeLLM({ messages: [{ role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT }, { role: "user", content: enrichedWinPrompt }], maxTokens: 1200 });
        const rawContent = result.choices?.[0]?.message?.content;
        const aiSuggestion = typeof rawContent === 'string' ? rawContent : '';
        // Save to DB
        const db = await getDb();
        if (db) {
          const { winStrategies } = await import('../drizzle/schema');
          const { eq } = await import('drizzle-orm');
          const existing = await db.select({ id: winStrategies.id }).from(winStrategies).where(eq(winStrategies.clientId, input.clientId)).limit(1);
          if (existing.length > 0) {
            await db.update(winStrategies).set({ aiSuggestion }).where(eq(winStrategies.clientId, input.clientId));
          } else {
            await db.insert(winStrategies).values({ clientId: input.clientId, aiSuggestion });
          }
        }
        // 写入版本历史（不覆盖，每次生成保留一条）
        const dbH = await getDb();
        if (dbH) {
          const { winStrategyHistory } = await import('../drizzle/schema');
          await dbH.insert(winStrategyHistory).values({
            clientId: input.clientId,
            aiSuggestion,
            stage: input.stage,
          });
        }
        return { aiSuggestion };
      }),
    getHistory: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const { winStrategyHistory } = await import('../drizzle/schema');
        const { desc, eq } = await import('drizzle-orm');
        return db.select().from(winStrategyHistory)
          .where(eq(winStrategyHistory.clientId, input.clientId))
          .orderBy(desc(winStrategyHistory.createdAt))
          .limit(10);
      }),
  }),

  winStrategyActions: router({
    extractActions: protectedProcedure.input(z.object({
      clientId: z.number(),
      aiSuggestion: z.string(),
      stage: z.string(),
    })).mutation(async ({ input }) => {
      const prompt = `从以下 Win Strategy 文本中提取3个最优先的可执行行动，分配给对应角色。

Win Strategy 内容：
${input.aiSuggestion}

当前阶段：${input.stage}

请以 JSON 格式返回3个行动项，每项包含：
- title: 行动标题（15字以内）
- description: 具体内容（50字以内）
- role: 负责角色，必须是 AD / SAM / SA 之一
- dueDays: 建议完成天数（数字，如7表示7天内）

返回格式：{ "actions": [ {...}, {...}, {...} ] }`;
      const res = await invokeLLM({
        model: "gpt-4o",
        messages: [{ role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT }, { role: "user", content: prompt }],
        response_format: { type: "json_schema", json_schema: { name: "actions", strict: true, schema: { type: "object", properties: { actions: { type: "array", items: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, role: { type: "string" }, dueDays: { type: "number" } }, required: ["title","description","role","dueDays"], additionalProperties: false } } }, required: ["actions"], additionalProperties: false } } },
      });
      const parsed = JSON.parse(String(res.choices[0].message.content || "{}"));
      return { actions: (parsed.actions ?? []) as Array<{ title: string; description: string; role: string; dueDays: number }> };
    }),
  }),
  // ── Command 2.0：Account Map（0→1）与 Deal Map（1→N）事实工作台 ────────
  command2: router({
    getAccountMap: protectedProcedure.input(z.object({ clientId: z.number() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库暂不可用" });
      const { accountOverview, relationshipCoverage } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const [overview, coverage] = await Promise.all([
        db.select().from(accountOverview).where(eq(accountOverview.clientId, input.clientId)).limit(1),
        db.select().from(relationshipCoverage).where(eq(relationshipCoverage.clientId, input.clientId)),
      ]);
      return { overview: overview[0] ?? null, coverage };
    }),
    saveAccountOverview: protectedProcedure.input(z.object({
      clientId: z.number(), strategicFitScore: z.number().int().min(0).max(5).nullable().optional(), potentialScore: z.number().int().min(0).max(5).nullable().optional(), relationshipScore: z.number().int().min(0).max(5).nullable().optional(), whitespaceScore: z.number().int().min(0).max(5).nullable().optional(), execPriorityScore: z.number().int().min(0).max(5).nullable().optional(),
      strategy12m: z.string().max(4000).nullable().optional(), strategy24m: z.string().max(4000).nullable().optional(), strategy36m: z.string().max(4000).nullable().optional(), aiOpportunity: z.string().max(4000).nullable().optional(), cyberOpportunity: z.string().max(4000).nullable().optional(), ictOpportunity: z.string().max(4000).nullable().optional(), triggerEvents: z.string().max(4000).nullable().optional(), vendorVision: z.string().max(50).nullable().optional(), annualSuccessKPI: z.string().max(4000).nullable().optional(),
    })).mutation(async ({ input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库暂不可用" });
      const { accountOverview } = await import("../drizzle/schema"); const { eq } = await import("drizzle-orm");
      const { clientId, ...values } = input;
      const existing = await db.select({ id: accountOverview.id }).from(accountOverview).where(eq(accountOverview.clientId, clientId)).limit(1);
      if (existing[0]) await db.update(accountOverview).set({ ...values, updatedAt: new Date() }).where(eq(accountOverview.clientId, clientId));
      else await db.insert(accountOverview).values({ clientId, ...values });
      return { clientId };
    }),
    saveCoverage: protectedProcedure.input(z.object({
      id: z.number().optional(), clientId: z.number(), coverageLevel: z.string().max(100).nullable().optional(), targetPerson: z.string().max(100).nullable().optional(), ourCoverer: z.string().max(100).nullable().optional(), strengthScore: z.number().int().min(0).max(5).nullable().optional(), lastInteraction: z.date().nullable().optional(), hasExecMeeting: z.boolean().optional(), stance: z.string().max(50).nullable().optional(), gapJudgment: z.enum(["P1", "P2", "P3"]).nullable().optional(), nextAction: z.string().max(4000).nullable().optional(),
    })).mutation(async ({ input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库暂不可用" });
      const { relationshipCoverage } = await import("../drizzle/schema"); const { and, eq } = await import("drizzle-orm");
      const { id, clientId, ...values } = input;
      if (id) { await db.update(relationshipCoverage).set(values).where(and(eq(relationshipCoverage.id, id), eq(relationshipCoverage.clientId, clientId))); return { id }; }
      const inserted = await db.insert(relationshipCoverage).values({ clientId, ...values }); return { id: Number((inserted as any)[0]?.insertId ?? (inserted as any).insertId) };
    }),
    deleteCoverage: protectedProcedure.input(z.object({ id: z.number(), clientId: z.number() })).mutation(async ({ input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库暂不可用" });
      const { relationshipCoverage } = await import("../drizzle/schema"); const { and, eq } = await import("drizzle-orm");
      await db.delete(relationshipCoverage).where(and(eq(relationshipCoverage.id, input.id), eq(relationshipCoverage.clientId, input.clientId))); return { id: input.id };
    }),
    getDealMap: protectedProcedure.input(z.object({ clientId: z.number(), opportunityId: z.number() })).query(async ({ input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库暂不可用" });
      const { threeWhy, painMetrics, competitionMap, goNoGo } = await import("../drizzle/schema"); const { eq } = await import("drizzle-orm");
      const [whyRows, pains, competition, gates] = await Promise.all([
        db.select().from(threeWhy).where(eq(threeWhy.opportunityId, input.opportunityId)).limit(1),
        db.select().from(painMetrics).where(eq(painMetrics.opportunityId, input.opportunityId)),
        db.select().from(competitionMap).where(eq(competitionMap.opportunityId, input.opportunityId)),
        db.select().from(goNoGo).where(eq(goNoGo.opportunityId, input.opportunityId)).limit(1),
      ]);
      const gate = gates[0] ?? null;
      const goNoGoScore = calculateGoNoGo(gate).score;
      const annualValueTotal = pains.reduce((sum, item) => sum + Number(item.annualValue ?? 0), 0);
      return { threeWhy: whyRows[0] ?? null, pains, competition, goNoGo: gate, goNoGoScore, annualValueTotal };
    }),
    saveThreeWhy: protectedProcedure.input(z.object({
      clientId: z.number(), opportunityId: z.number(), whyChangeClaim: z.string().max(4000).nullable().optional(), whyChangePain: z.string().max(4000).nullable().optional(), whyChangeConsequence: z.string().max(4000).nullable().optional(), whyChangeEvidence: z.string().max(4000).nullable().optional(), whyChangeScore: z.number().int().min(0).max(5).nullable().optional(), whyNowClaim: z.string().max(4000).nullable().optional(), whyNowTrigger: z.string().max(4000).nullable().optional(), whyNowEvidence: z.string().max(4000).nullable().optional(), whyNowScore: z.number().int().min(0).max(5).nullable().optional(), whyUsClaim: z.string().max(4000).nullable().optional(), whyUsDifferentiator: z.string().max(4000).nullable().optional(), whyUsEvidence: z.string().max(4000).nullable().optional(), whyUsScore: z.number().int().min(0).max(5).nullable().optional(), challengerTeach: z.string().max(4000).nullable().optional(), challengerTailor: z.string().max(4000).nullable().optional(), challengerControl: z.string().max(4000).nullable().optional(), reframeEvidence: z.string().max(4000).nullable().optional(),
    })).mutation(async ({ input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库暂不可用" });
      const { threeWhy } = await import("../drizzle/schema"); const { eq } = await import("drizzle-orm"); const { opportunityId, clientId, ...values } = input;
      const existing = await db.select({ id: threeWhy.id }).from(threeWhy).where(eq(threeWhy.opportunityId, opportunityId)).limit(1);
      if (existing[0]) await db.update(threeWhy).set({ ...values, updatedAt: new Date() }).where(eq(threeWhy.opportunityId, opportunityId)); else await db.insert(threeWhy).values({ clientId, opportunityId, ...values });
      return { opportunityId };
    }),
    saveGoNoGo: protectedProcedure.input(z.object({ clientId: z.number(), opportunityId: z.number(), gate1StrategicFit: z.number().int().min(0).max(2), gate2PainVerified: z.number().int().min(0).max(2), gate3ChampionExists: z.number().int().min(0).max(2), gate4EBClear: z.number().int().min(0).max(2), gate5ValueQuantified: z.number().int().min(0).max(2), gate6CriteriaWinnable: z.number().int().min(0).max(2), gate7ProcessClear: z.number().int().min(0).max(2), gate8CompDefensible: z.number().int().min(0).max(2), gate9DeliveryOK: z.number().int().min(0).max(2), gate10ROIJustified: z.number().int().min(0).max(2), managerOverride: z.enum(["Go", "Conditional Go", "No-Go"]).nullable().optional(), overrideReason: z.string().max(4000).nullable().optional() })).mutation(async ({ input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库暂不可用" });
      const { goNoGo } = await import("../drizzle/schema"); const { eq } = await import("drizzle-orm"); const { opportunityId, clientId: _clientId, ...values } = input;
      const existing = await db.select({ id: goNoGo.id }).from(goNoGo).where(eq(goNoGo.opportunityId, opportunityId)).limit(1);
      if (existing[0]) await db.update(goNoGo).set({ ...values, updatedAt: new Date() }).where(eq(goNoGo.opportunityId, opportunityId)); else await db.insert(goNoGo).values({ opportunityId, ...values });
      // Event-driven: non-blocking refresh after Go/No-Go gate change
      setImmediate(() => triggerSingleClientRefresh(input.clientId));
      return { opportunityId };
    }),
    savePainMetric: protectedProcedure.input(z.object({ id: z.number().optional(), clientId: z.number(), opportunityId: z.number(), painType: z.string().max(100).nullable().optional(), painStatement: z.string().max(4000).nullable().optional(), affectedSponsor: z.string().max(100).nullable().optional(), currentBaseline: z.string().max(4000).nullable().optional(), targetImprovement: z.string().max(4000).nullable().optional(), valueLogic: z.string().max(4000).nullable().optional(), timeframe: z.string().max(50).nullable().optional(), annualValue: z.number().int().min(0).nullable().optional(), confidence: z.number().min(0).max(1).nullable().optional(), evidenceStrength: z.enum(["未验证", "口头确认", "书面确认", "高层确认"]).nullable().optional() })).mutation(async ({ input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库暂不可用" });
      const { painMetrics } = await import("../drizzle/schema"); const { and, eq } = await import("drizzle-orm"); const { id, clientId, opportunityId, confidence, ...values } = input;
      const payload = { clientId, opportunityId, ...values, confidence: confidence == null ? null : String(confidence) } as any;
      if (id) { await db.update(painMetrics).set(payload).where(and(eq(painMetrics.id, id), eq(painMetrics.opportunityId, opportunityId))); return { id }; }
      const inserted = await db.insert(painMetrics).values(payload); return { id: Number((inserted as any)[0]?.insertId ?? (inserted as any).insertId) };
    }),
    deletePainMetric: protectedProcedure.input(z.object({ id: z.number(), opportunityId: z.number() })).mutation(async ({ input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库暂不可用" });
      const { painMetrics } = await import("../drizzle/schema"); const { and, eq } = await import("drizzle-orm"); await db.delete(painMetrics).where(and(eq(painMetrics.id, input.id), eq(painMetrics.opportunityId, input.opportunityId))); return { id: input.id };
    }),
    saveCompetition: protectedProcedure.input(z.object({ id: z.number().optional(), clientId: z.number(), opportunityId: z.number(), competitorType: z.string().max(100).nullable().optional(), controlPoints: z.string().max(4000).nullable().optional(), customerSupporter: z.string().max(100).nullable().optional(), strengths: z.string().max(4000).nullable().optional(), weaknesses: z.string().max(4000).nullable().optional(), attackVector: z.string().max(4000).nullable().optional(), counterAction: z.string().max(4000).nullable().optional(), riskScore: z.number().int().min(0).max(5).nullable().optional(), owner: z.string().max(100).nullable().optional(), nextStep: z.string().max(4000).nullable().optional() })).mutation(async ({ input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库暂不可用" });
      const { competitionMap } = await import("../drizzle/schema"); const { and, eq } = await import("drizzle-orm"); const { id, clientId, opportunityId, ...values } = input;
      if (id) { await db.update(competitionMap).set(values).where(and(eq(competitionMap.id, id), eq(competitionMap.opportunityId, opportunityId))); return { id }; }
      const inserted = await db.insert(competitionMap).values({ clientId, opportunityId, ...values }); return { id: Number((inserted as any)[0]?.insertId ?? (inserted as any).insertId) };
    }),
    deleteCompetition: protectedProcedure.input(z.object({ id: z.number(), opportunityId: z.number() })).mutation(async ({ input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库暂不可用" });
      const { competitionMap } = await import("../drizzle/schema"); const { and, eq } = await import("drizzle-orm"); await db.delete(competitionMap).where(and(eq(competitionMap.id, input.id), eq(competitionMap.opportunityId, input.opportunityId))); return { id: input.id };
    }),
  }),
  // ── AI 原生 AD 指挥中心：事实驱动建议、AD 确认与任务闭环 ──────────────────
  adCommand: router({
    refresh: publicProcedure.mutation(async () => {
      const db = await getDb();
      if (!db) return [];
      const { clients, meetingMinutes, meddpicc, opportunities, opportunityMeddpicc, actionItems, adCommandRecommendations, customerPurchaseSignals, accountOverview, relationshipCoverage, threeWhy, painMetrics, competitionMap, goNoGo } = await import('../drizzle/schema');
      const { buildAdCommandRecommendations } = await import('../shared/adCommand');
      const { enrichAdCommandRecommendation } = await import('./adCommandLLM');
      const { desc } = await import('drizzle-orm');

      const [allClients, allMeetings, clientMeddpicc, allOpportunities, oppMeddpicc, pendingActions, existing, purchaseSignals, accountOverviews, coverageRows, threeWhyRows, painMetricRows, competitionRows, goNoGoRows] = await Promise.all([
        db.select().from(clients),
        db.select({ clientId: meetingMinutes.clientId, meetingDate: meetingMinutes.meetingDate }).from(meetingMinutes),
        db.select().from(meddpicc),
        db.select().from(opportunities),
        db.select().from(opportunityMeddpicc),
        db.select().from(actionItems),
        db.select().from(adCommandRecommendations).orderBy(desc(adCommandRecommendations.createdAt)),
        db.select().from(customerPurchaseSignals),
        db.select().from(accountOverview),
        db.select().from(relationshipCoverage),
        db.select().from(threeWhy),
        db.select().from(painMetrics),
        db.select().from(competitionMap),
        db.select().from(goNoGo),
      ]);

      const latestMeeting = new Map<number, Date>();
      for (const meeting of allMeetings) {
        const previous = latestMeeting.get(meeting.clientId);
        if (!previous || meeting.meetingDate > previous) latestMeeting.set(meeting.clientId, meeting.meetingDate);
      }
      const clientScore = new Map(clientMeddpicc.map(item => [item.clientId, item]));
      const oppScore = new Map(oppMeddpicc.map(item => [item.opportunityId, item]));
      const accountByClient = new Map(accountOverviews.map(item => [item.clientId, item]));
      const whyByOpportunity = new Map(threeWhyRows.map(item => [item.opportunityId, item]));
      const gatesByOpportunity = new Map(goNoGoRows.map(item => [item.opportunityId, item]));
      const gateScore = (record: any) => calculateGoNoGo(record).score;
      const dimensionLabels: Array<[string, string]> = [
        ['metricsScore', '价值量化'], ['economicBuyerScore', '经济决策人'], ['decisionCriteriaScore', '决策标准'], ['decisionProcessScore', '决策流程'],
        ['paperProcessScore', '采购流程'], ['implicatePainScore', '痛点牵连'], ['championScore', 'Champion'], ['competitionScore', '竞争态势'],
      ];
      const oppInputs = allOpportunities.map(opp => {
        const score = oppScore.get(opp.id);
        const ordered = dimensionLabels.map(([key, label]) => ({ label, score: Number((score as any)?.[key] ?? 0) })).sort((a, b) => a.score - b.score);
        const client = allClients.find(item => item.id === opp.clientId);
        return {
          id: opp.id, clientId: opp.clientId, clientName: client?.name ?? `客户#${opp.clientId}`, name: opp.name,
          stage: opp.stage, status: opp.status, stageChangedAt: opp.stageChangedAt,
          weakestDimension: ordered[0]?.label, weakestScore: ordered[0]?.score,
        };
      });
      const stageDays = (value: Date | null | undefined) => value ? Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000)) : null;
      const clientInputs = allClients.map(client => ({
        id: client.id, name: client.name, stage: client.stage,
        stageChangedAt: client.stageChangedAt, lastMeetingAt: latestMeeting.get(client.id) ?? null,
        championScore: clientScore.get(client.id)?.championScore ?? 0, assignedSamName: client.assignedSamName,
      }));
      const { runNativeAdAnalysis, snapshotFingerprint } = await import('./adNativeAnalysis');
      const nativeSnapshot = {
        generatedAt: new Date().toISOString(),
        clients: allClients.map(client => {
          const score = clientScore.get(client.id) as any;
          const lastMeeting = latestMeeting.get(client.id) ?? null;
          const activeOpps = allOpportunities.filter(opportunity => opportunity.clientId === client.id && opportunity.status !== '丢单');
          const whyFacts = activeOpps.map(opportunity => whyByOpportunity.get(opportunity.id)).filter(Boolean) as any[];
          const clientCoverage = coverageRows.filter(item => item.clientId === client.id);
          const clientPains = painMetricRows.filter(item => item.clientId === client.id);
          const clientCompetition = competitionRows.filter(item => item.clientId === client.id);
          const gateScores = activeOpps.map(opportunity => gateScore(gatesByOpportunity.get(opportunity.id))).filter((value): value is number => value !== null);
          return {
            id: client.id,
            name: client.name,
            stage: client.stage,
            stageDays: stageDays(client.stageChangedAt),
            daysSinceLastMeeting: lastMeeting ? stageDays(lastMeeting) : null,
            totalMeetings: allMeetings.filter(meeting => meeting.clientId === client.id).length,
            purchaseSignalCount: purchaseSignals.filter(signal => signal.clientId === client.id).length,
            meddpicc: {
              champion: Number(score?.championScore ?? 0), economicBuyer: Number(score?.economicBuyerScore ?? 0),
              decisionCriteria: Number(score?.decisionCriteriaScore ?? 0), decisionProcess: Number(score?.decisionProcessScore ?? 0),
              paperProcess: Number(score?.paperProcessScore ?? 0), pain: Number(score?.implicatePainScore ?? 0),
              competition: Number(score?.competitionScore ?? 0), metrics: Number(score?.metricsScore ?? 0),
            },
            assignedSam: client.assignedSamName ?? null,
            accountFitScore: accountByClient.get(client.id)?.strategicFitScore ?? null,
            execCoverageCount: clientCoverage.filter(item => item.hasExecMeeting).length,
            competitorAdvantageCount: clientCompetition.filter(item => Number(item.riskScore ?? 0) >= 4).length,
            threeWhyScore: whyFacts.length ? {
              change: Math.min(...whyFacts.map(item => Number(item.whyChangeScore ?? 0))),
              now: Math.min(...whyFacts.map(item => Number(item.whyNowScore ?? 0))),
              us: Math.min(...whyFacts.map(item => Number(item.whyUsScore ?? 0))),
            } : null,
            painMetricsTotal: clientPains.length ? clientPains.reduce((total, item) => total + Number(item.annualValue ?? 0), 0) : null,
            goNoGoScore: gateScores.length ? Math.min(...gateScores) : null,
            dealHealthScore: (() => {
              // Calculate Deal Health from available snapshot data
              const s = score;
              const threeWhyMin = whyFacts.length ? Math.min(
                ...whyFacts.map((w: any) => Math.min(Number(w.whyChangeScore ?? 0), Number(w.whyNowScore ?? 0), Number(w.whyUsScore ?? 0)))
              ) : null;
              const execCount = clientCoverage.filter((item: any) => item.hasExecMeeting).length;
              const input = {
                relationshipPower: execCount >= 2 ? 4 : execCount > 0 ? 2 : null,
                meddpicc: s ? Math.round((Number(s.championScore ?? 0) + Number(s.economicBuyerScore ?? 0) + Number(s.decisionCriteriaScore ?? 0) + Number(s.decisionProcessScore ?? 0) + Number(s.paperProcessScore ?? 0) + Number(s.implicatePainScore ?? 0) + Number(s.competitionScore ?? 0) + Number(s.metricsScore ?? 0)) / 8 / 20) : null,
                metricsValue: s ? Math.round(Number(s.metricsScore ?? 0) / 20) : null,
                champion: s ? Math.round(Number(s.championScore ?? 0) / 20) : null,
                accountFit: accountByClient.get(client.id)?.strategicFitScore ?? null,
                economicBuyer: s ? Math.round(Number(s.economicBuyerScore ?? 0) / 20) : null,
                threeWhy: threeWhyMin != null ? Math.round(threeWhyMin / 20) : null,
                decisionCriteria: s ? Math.round(Number(s.decisionCriteriaScore ?? 0) / 20) : null,
                processPaper: s ? Math.round(Number(s.paperProcessScore ?? 0) / 20) : null,
                competition: s ? Math.round(Number(s.competitionScore ?? 0) / 20) : null,
                actionDiscipline: null, // No data source yet
              };
              const result = calculateDealHealth(input);
              return result.score;
            })(),
            activeOpportunities: activeOpps.map(opportunity => {
              const scoreItem = oppScore.get(opportunity.id) as any;
              const weakest = dimensionLabels.map(([key, label]) => ({ label, score: Number(scoreItem?.[key] ?? 0) })).sort((a, b) => a.score - b.score)[0];
              return {
                id: opportunity.id, name: opportunity.name, stage: opportunity.stage, stageDays: stageDays(opportunity.stageChangedAt),
                estimatedValue: (opportunity as any).estimatedValue ? String((opportunity as any).estimatedValue) : null,
                weakestDimension: weakest?.label ?? '数据不足', weakestScore: weakest?.score ?? 0,
              };
            }),
          };
        }),
        teamStats: {
          totalClients: allClients.length,
          stageDistribution: allClients.reduce((result, client) => ({ ...result, [client.stage]: (result[client.stage] ?? 0) + 1 }), {} as Record<string, number>),
          totalActiveOpportunities: allOpportunities.filter(opportunity => opportunity.status !== '丢单').length,
          samList: Array.from(new Map(allClients.map(client => [client.assignedSamName || '未分配 SAM', allClients.filter(item => (item.assignedSamName || '未分配 SAM') === (client.assignedSamName || '未分配 SAM')).length])).entries()).map(([name, clientCount]) => ({ name, clientCount })),
        },
      };
      const nativeHash = snapshotFingerprint(nativeSnapshot);
      const nativeSummaryFingerprint = `native-${nativeHash}-summary`;
      const nativeAlreadyExists = existing.some(item => item.fingerprint === nativeSummaryFingerprint);
      const nativeOutput = nativeAlreadyExists ? null : await runNativeAdAnalysis(nativeSnapshot);
      // 规则只在原生 LLM 调用失败或未给出任何建议时兜底；已缓存的原生结果不重复触发规则与二次 LLM。
      const shouldUseFallback = !nativeAlreadyExists && (!nativeOutput || !nativeOutput.recommendations.length);
      const fallbackGenerated = shouldUseFallback ? buildAdCommandRecommendations(
        clientInputs,
        oppInputs,
        new Date(),
        pendingActions.filter(action => !action.isCompleted).map(action => ({
          id: action.id, clientId: action.clientId, opportunityId: action.opportunityId, clientName: allClients.find(client => client.id === action.clientId)?.name ?? `客户#${action.clientId}`,
          title: action.title, objective: action.objective, priority: action.priority, timeframe: action.timeframe, responsibleRole: action.responsibleRole,
        })),
      ) : [];
      const knownFingerprints = new Set(existing.map(item => item.fingerprint));
      const newGenerated = fallbackGenerated.filter(item => !knownFingerprints.has(`fallback-${item.fingerprint}`));
      const enriched = await Promise.all(newGenerated.map(async (item) => {
        if (item.kind !== 'today_action' && item.kind !== 'anomaly') return item;
        const client = item.clientId ? allClients.find(candidate => candidate.id === item.clientId) : null;
        const opportunity = item.opportunityId ? allOpportunities.find(candidate => candidate.id === item.opportunityId) : null;
        const clientId = item.clientId ?? opportunity?.clientId ?? null;
        const clientScoreItem = clientId ? clientScore.get(clientId) : null;
        const opportunityScoreItem = opportunity ? oppScore.get(opportunity.id) : null;
        const meetingDate = clientId ? latestMeeting.get(clientId) : null;
        const stageChangedAt = opportunity?.stageChangedAt ?? client?.stageChangedAt ?? null;
        const stageDays = stageChangedAt ? Math.floor((Date.now() - new Date(stageChangedAt).getTime()) / 86_400_000) : null;
        const daysSinceVisit = meetingDate ? Math.floor((Date.now() - new Date(meetingDate).getTime()) / 86_400_000) : null;
        const weakest = opportunityScoreItem ? dimensionLabels
          .map(([key, label]) => ({ label, score: Number((opportunityScoreItem as any)[key] ?? 0) }))
          .sort((a, b) => a.score - b.score)[0] : null;
        return enrichAdCommandRecommendation(item, {
          clientName: client?.name ?? opportunity?.name ?? '未命名客户',
          stage: client?.stage ?? opportunity?.stage ?? '数据不足',
          stageDays,
          daysSinceVisit,
          championScore: Number((clientScoreItem as any)?.championScore ?? (opportunityScoreItem as any)?.championScore ?? 0),
          economicBuyerScore: Number((clientScoreItem as any)?.economicBuyerScore ?? (opportunityScoreItem as any)?.economicBuyerScore ?? 0),
          painScore: Number((clientScoreItem as any)?.implicatePainScore ?? (opportunityScoreItem as any)?.implicatePainScore ?? 0),
          decisionCriteriaScore: Number((clientScoreItem as any)?.decisionCriteriaScore ?? (opportunityScoreItem as any)?.decisionCriteriaScore ?? 0),
          signalCount: clientId ? purchaseSignals.filter(signal => signal.clientId === clientId).length : 0,
          samName: client?.assignedSamName ?? null,
          opportunityName: opportunity?.name ?? null,
          opportunityStage: opportunity?.stage ?? null,
          opportunityStagnantDays: opportunity?.stageChangedAt ? Math.floor((Date.now() - new Date(opportunity.stageChangedAt).getTime()) / 86_400_000) : null,
          weakestDimension: weakest?.label ?? null,
          weakestScore: weakest?.score ?? null,
        });
      }));
      const fallbackInserts = enriched.map(({ urgency, ...item }) => ({
        ...item,
        // 数据库遗留字段仅作存储兼容；用户界面与研判逻辑统一使用行动紧迫度。
        priority: urgency === '立即处理' ? 'P0' : urgency === '本周推进' ? 'P1' : 'P2',
        fingerprint: `fallback-${item.fingerprint}`,
        clientId: item.clientId ?? undefined,
        opportunityId: item.opportunityId ?? undefined,
        dueDate: new Date(Date.now() + (urgency === '立即处理' ? 2 : 7) * 86_400_000),
      }));
      const nativeFactsFor = (recommendation: any) => {
        const client = nativeSnapshot.clients.find(item => item.id === recommendation.clientId);
        const opportunity = recommendation.opportunityId ? client?.activeOpportunities.find(item => item.id === recommendation.opportunityId) : null;
        const facts = [
          { label: '客户阶段', value: client?.stage ?? '数据不足' },
          { label: '阶段停留', value: client?.stageDays === null || client?.stageDays === undefined ? '数据不足' : `${client.stageDays}天` },
          { label: '距上次拜访', value: client?.daysSinceLastMeeting === null || client?.daysSinceLastMeeting === undefined ? '无记录' : `${client.daysSinceLastMeeting}天` },
          { label: '购买信号', value: `${client?.purchaseSignalCount ?? 0}/3` },
        ];
        if (opportunity) facts.push({ label: '商机最弱维度', value: `${opportunity.weakestDimension} ${opportunity.weakestScore}/4` });
        return facts;
      };
      const nativeInserts = nativeOutput?.recommendations.length ? [
        {
          clientId: undefined, opportunityId: undefined, kind: 'today_action', priority: 'P1', title: '本周全局战场研判',
          aiConclusion: nativeOutput.battlefieldSummary, facts: [
            { label: '漏斗健康', value: nativeOutput.funnelHealth }, { label: '赢单风险', value: nativeOutput.winRisk }, { label: '团队模式', value: nativeOutput.teamPattern }, { label: '快照指纹', value: nativeHash },
          ], methodology: 'AI 原生全量战场研判', suggestedAction: '展开全局判断后确认需要进入 POD 的行动。', assignedRole: 'AD',
          fingerprint: nativeSummaryFingerprint, dueDate: new Date(Date.now() + 7 * 86_400_000),
        },
        ...nativeOutput.recommendations.map((recommendation, index) => ({
          clientId: recommendation.clientId, opportunityId: recommendation.opportunityId ?? undefined, kind: recommendation.kind,
          priority: recommendation.urgency === '立即处理' ? 'P0' : recommendation.urgency === '本周推进' ? 'P1' : 'P2',
          title: recommendation.title, aiConclusion: recommendation.judgment, facts: nativeFactsFor(recommendation), methodology: recommendation.methodology,
          suggestedAction: recommendation.adAction, assignedRole: 'AD', fingerprint: `native-${nativeHash}-${recommendation.clientId}-${recommendation.opportunityId ?? 'client'}-${index}`,
          dueDate: new Date(Date.now() + (recommendation.urgency === '立即处理' ? 2 : recommendation.urgency === '本周推进' ? 7 : 14) * 86_400_000),
        })),
      ] : [];
      const inserts = nativeInserts.length ? nativeInserts : fallbackInserts;
      const { generateGlobalBattleReview, getIsoWeekKey } = await import('./adGlobalReviewLLM');
      const weeklyKey = getIsoWeekKey();
      const hasWeeklyReview = knownFingerprints.has(`global-review-${weeklyKey}-summary`);
      if (!nativeInserts.length && !hasWeeklyReview) {
        const candidateFacts = fallbackGenerated.filter(item => item.clientId && (item.kind === 'today_action' || item.kind === 'anomaly')).slice(0, 6).map(item => {
          const client = allClients.find(candidate => candidate.id === item.clientId);
          return { clientId: item.clientId!, clientName: client?.name ?? item.title, stage: client?.stage ?? '数据不足', trigger: item.aiConclusion, facts: item.facts };
        });
        const globalReview = await generateGlobalBattleReview(candidateFacts);
        if (globalReview?.actions.length) {
          inserts.push({
            clientId: undefined, opportunityId: undefined, kind: 'today_action', priority: 'P1', title: '本周全局战场研判',
            aiConclusion: globalReview.judgment.slice(0, 80),
            facts: [
              { label: '整体漏斗健康度', value: globalReview.funnelHealth },
              { label: '本季度赢单风险', value: globalReview.winRisk },
              { label: '团队能力短板', value: globalReview.teamGap },
            ],
            methodology: '全局战场五维研判 · AD 指挥节奏',
            suggestedAction: `优先确认本周三项行动：${globalReview.actions.map(action => action.title).join('；')}`,
            assignedRole: 'AD', fingerprint: `global-review-${weeklyKey}-summary`, dueDate: new Date(Date.now() + 7 * 86_400_000),
          } as any);
          for (let index = 0; index < globalReview.actions.length; index += 1) {
            const action = globalReview.actions[index];
            const candidate = candidateFacts.find(item => item.clientId === action.clientId);
            inserts.push({
              clientId: action.clientId, opportunityId: undefined, kind: 'today_action', priority: index === 0 ? 'P0' : 'P1',
              title: action.title.slice(0, 240), aiConclusion: action.evidence.slice(0, 300),
              facts: candidate?.facts ?? [{ label: '全局研判依据', value: action.evidence }],
              methodology: '全局战场研判 · AD 本周行动', suggestedAction: action.action.slice(0, 100), assignedRole: 'AD',
              fingerprint: `global-review-${weeklyKey}-action-${action.clientId}-${index}`, dueDate: new Date(Date.now() + (index === 0 ? 2 : 7) * 86_400_000),
            } as any);
          }
        }
      }
      if (inserts.length) await db.insert(adCommandRecommendations).values(inserts as any);
      const currentFingerprints = new Set(fallbackGenerated.map(item => `fallback-${item.fingerprint}`));
      const derivedTypes = new Set(['contact-gap', 'champion-gap', 'opp-stagnant']);
      for (const item of existing) {
        const isDerived = Array.from(derivedTypes).some(prefix => item.fingerprint.startsWith(prefix));
        if (item.status === 'pending' && isDerived && !currentFingerprints.has(item.fingerprint)) {
          await db.update(adCommandRecommendations).set({ status: 'skipped', skipReason: '数据不足，自动撤回该 AI 判断' }).where(eq(adCommandRecommendations.id, item.id));
        }
      }
      return db.select().from(adCommandRecommendations).orderBy(desc(adCommandRecommendations.createdAt));
    }),
    list: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const { adCommandRecommendations, podTasks } = await import('../drizzle/schema');
      const { desc, eq } = await import('drizzle-orm');
      const recommendations = await db.select().from(adCommandRecommendations).orderBy(desc(adCommandRecommendations.createdAt));
      const taskIds = recommendations.flatMap(item => item.podTaskId ? [item.podTaskId] : []);
      if (taskIds.length) {
        const tasks = await db.select({ id: podTasks.id, isCompleted: podTasks.isCompleted }).from(podTasks);
        const completed = new Set(tasks.filter(task => task.isCompleted).map(task => task.id));
        for (const item of recommendations) {
          if (item.status === 'confirmed' && item.podTaskId && completed.has(item.podTaskId)) {
            await db.update(adCommandRecommendations).set({ status: 'completed' }).where(eq(adCommandRecommendations.id, item.id));
            item.status = 'completed';
          }
        }
      }
      return recommendations.map(item => ({
        ...item,
        urgency: item.priority === 'P0' ? '立即处理' : item.priority === 'P1' ? '本周推进' : '持续跟进',
      }));
    }),
    confirm: publicProcedure.input(z.object({ id: z.number(), confirmedBy: z.string().min(1) })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const { adCommandRecommendations, podTasks } = await import('../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      const [recommendation] = await db.select().from(adCommandRecommendations).where(eq(adCommandRecommendations.id, input.id)).limit(1);
      if (!recommendation) throw new TRPCError({ code: 'NOT_FOUND', message: '未找到 AI 指挥建议' });
      if (recommendation.status !== 'pending') return recommendation;
      if (!recommendation.clientId) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: '该建议缺少关联客户，无法安排任务' });
      const inserted = await db.insert(podTasks).values({
        clientId: recommendation.clientId,
        opportunityId: recommendation.opportunityId ?? undefined,
        assignedRole: recommendation.assignedRole,
        title: `[AI指挥] ${recommendation.title}`,
        description: `${recommendation.aiConclusion}\n\n方法论判断：${recommendation.methodology}\n\n建议行动：${recommendation.suggestedAction}`,
        priority: recommendation.priority === 'P0' ? '高' : recommendation.priority === 'P1' ? '中' : '低',
        dueDate: recommendation.dueDate ?? new Date(Date.now() + 7 * 86_400_000),
      } as any);
      const podTaskId = Number((inserted as any)[0]?.insertId ?? (inserted as any).insertId);
      await db.update(adCommandRecommendations).set({ status: 'confirmed', confirmedBy: input.confirmedBy, confirmedAt: new Date(), podTaskId: Number.isFinite(podTaskId) ? podTaskId : null }).where(eq(adCommandRecommendations.id, input.id));
      return { id: input.id, podTaskId };
    }),
    skip: publicProcedure.input(z.object({ id: z.number(), reason: z.string().max(500).optional() })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const { adCommandRecommendations } = await import('../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      await db.update(adCommandRecommendations).set({ status: 'skipped', skipReason: input.reason || 'AD 当前不采纳' }).where(eq(adCommandRecommendations.id, input.id));
      return { id: input.id };
    }),
    samCoachReview: publicProcedure.input(z.object({ samName: z.string().min(1).max(100) })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('DB unavailable');
      const { clients, meetingMinutes, meddpicc, opportunities } = await import('../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      const { buildSamCoachPrompt } = await import('./samCoachLLM');
      const [samClients, allMeetings, allScores, allOpportunities] = await Promise.all([
        db.select().from(clients).where(eq(clients.assignedSamName, input.samName)),
        db.select({ clientId: meetingMinutes.clientId, meetingDate: meetingMinutes.meetingDate }).from(meetingMinutes),
        db.select().from(meddpicc),
        db.select().from(opportunities),
      ]);
      if (!samClients.length) return { content: `数据不足，暂不判断。${input.samName} 暂无已分配客户记录。`, samName: input.samName, clientCount: 0 };
      const clientIds = new Set(samClients.map(client => client.id));
      const latestMeeting = new Map<number, Date>();
      for (const meeting of allMeetings.filter(meeting => clientIds.has(meeting.clientId))) {
        const current = latestMeeting.get(meeting.clientId);
        if (!current || meeting.meetingDate > current) latestMeeting.set(meeting.clientId, meeting.meetingDate);
      }
      const scoreByClient = new Map(allScores.filter(score => clientIds.has(score.clientId)).map(score => [score.clientId, score]));
      const now = Date.now();
      const facts = samClients.map(client => {
        const lastMeeting = latestMeeting.get(client.id);
        return {
          clientName: client.name,
          stage: client.stage,
          lastMeetingDays: lastMeeting ? Math.floor((now - new Date(lastMeeting).getTime()) / 86_400_000) : null,
          championScore: Number((scoreByClient.get(client.id) as any)?.championScore ?? 0),
          economicBuyerScore: Number((scoreByClient.get(client.id) as any)?.economicBuyerScore ?? 0),
          activeOpportunityCount: allOpportunities.filter(opp => opp.clientId === client.id && opp.status === '活跃').length,
        };
      });
      const response = await invokeLLM({
        model: 'gpt-5-mini',
        messages: [
          { role: 'system', content: SALES_METHODOLOGY_SYSTEM_PROMPT },
          { role: 'user', content: buildSamCoachPrompt(input.samName, facts) },
        ],
        maxCompletionTokens: 900,
      });
      const content = String(response.choices?.[0]?.message?.content || '').trim() || '数据不足，暂不判断。请补充客户对话或关键人证据后重试。';
      return { content, samName: input.samName, clientCount: samClients.length };
    }),
    samSelfCheck: protectedProcedure.input(z.object({ clientId: z.number() })).mutation(async ({ input }) => {
      const client = await getClientById(input.clientId);
      const meddpiccData = await getMeddpiccByClientId(input.clientId);
      const m = meddpiccData as any;
      const champScore = m?.championScore ?? 0;
      const ebScore = m?.economicBuyerScore ?? 0;
      const painScore = m?.implicatePainScore ?? 0;
      const prompt = `为负责客户"${client?.name || "未知"}"（阶段：${client?.stage || "未知"}）生成最多3项“待补录的可验证事实”。
当前MEDDPICC：Champion=${champScore}/100, EB=${ebScore}/100, Pain=${painScore}/100

要求：
- 每项只针对当前最弱的 Win 因子；不得要求 SAM 填写主观看法或猜测客户意图
- 明确要补录到哪个事实入口：contact（关键人图谱）、signal（购买/外部信号）、meeting（拜访日志）或 meddpicc（已有事实依据备注）
- evidenceRequired 必须写明可回溯来源，例如客户原话、拜访日期、关键人姓名、邮件/会议纪要或采购文件
- 若现有数据不足以形成补录指引，返回空数组；不要编造事实

不要输出问题、评分结论或解释框架。`;
      const res = await invokeLLM({
        model: "gpt-5-mini",
        maxCompletionTokens: 500,
        messages: [
          { role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "sam_fact_backfill_prompts",
            strict: true,
            schema: {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  maxItems: 3,
                  items: {
                    type: "object",
                    properties: {
                      target: { type: "string", enum: ["contact", "signal", "meeting", "meddpicc"] },
                      title: { type: "string" },
                      evidenceRequired: { type: "string" },
                      captureHint: { type: "string" },
                    },
                    required: ["target", "title", "evidenceRequired", "captureHint"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["items"],
              additionalProperties: false,
            },
          },
        },
      });
      try {
        const parsed = JSON.parse(String(res.choices?.[0]?.message?.content || '{"items":[]}'));
        return { items: Array.isArray(parsed.items) ? parsed.items : [] };
      } catch {
        return { items: [] };
      }
    }),
  }),
  // ── AD 指挥台聚合接口 ─────────────────────────────────────────────────────
  dashboard: router({
    summary: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return null;
      const { clients, meddpicc, meetingMinutes, podTasks, opportunities, opportunityMeddpicc } = await import('../drizzle/schema');
      const { and, gte, count, sql, eq } = await import('drizzle-orm');

      // 1. 所有客户基本信息
      const allClients = await db.select({
        id: clients.id,
        name: clients.name,
        stage: clients.stage,
        priority: clients.priority,
        industry: clients.industry,
        updatedAt: clients.updatedAt,
      }).from(clients);

      // 1b. 客户阶段变更时间（stageChangedAt）
      const allClientsWithStage = await db.select({
        id: clients.id,
        stageChangedAt: clients.stageChangedAt,
      }).from(clients);
      const stageChangedAtMap = new Map(allClientsWithStage.map(c => [c.id, c.stageChangedAt]));

      // 2. MEDDPICC 评分
      const allMeddpicc = await db.select({
        clientId: meddpicc.clientId,
        metricsScore: meddpicc.metricsScore,
        economicBuyerScore: meddpicc.economicBuyerScore,
        decisionCriteriaScore: meddpicc.decisionCriteriaScore,
        decisionProcessScore: meddpicc.decisionProcessScore,
        paperProcessScore: meddpicc.paperProcessScore,
        implicatePainScore: meddpicc.implicatePainScore,
        championScore: meddpicc.championScore,
        competitionScore: meddpicc.competitionScore,
      }).from(meddpicc);

      // 3. 本周拜访统计（7天内）
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const recentMeetings = await db.select({
        clientId: meetingMinutes.clientId,
        visitDate: meetingMinutes.meetingDate,
      }).from(meetingMinutes).where(gte(meetingMinutes.meetingDate, weekAgo));

      // 3b. 所有拜访记录（用于 visitCount + lastVisitDate + 日志质量）
      const allMeetings = await db.select({
        clientId: meetingMinutes.clientId,
        visitDate: meetingMinutes.meetingDate,
        aiMinutes: meetingMinutes.aiMinutes,
        transcriptText: meetingMinutes.transcriptText,
        keyPoints: meetingMinutes.keyPoints,
      }).from(meetingMinutes).orderBy(sql`${meetingMinutes.meetingDate} DESC`);

      // 4. POD 任务概览（待处理数量）
      const pendingTasks = await db.select({
        assignedRole: podTasks.assignedRole,
        count: count(),
      }).from(podTasks)
        .where(and(
          sql`(${podTasks.isCompleted} = 0 OR ${podTasks.isCompleted} IS NULL)`,
          sql`(${podTasks.taskStatus} = 'pending' OR ${podTasks.taskStatus} IS NULL)`
        ))
        .groupBy(podTasks.assignedRole);

      // 5. 计算每个客户的 MEDDPICC 平均分
      // 规则：建图/进门/定痛/找人 使用客户级手动评分；进入商机 自动聚合商机级均值
      const ONE_TO_N_STAGES = ['进入商机'];

      // 预先加载商机级 MEDDPICC（用于展示和聚合）
      const allOpps = await db.select().from(opportunities);
      const allOppMeddpicc = await db.select().from(opportunityMeddpicc);
      const oppMeddpiccMap = new Map(allOppMeddpicc.map(m => [m.opportunityId, m]));

      // 先计算每个客户的商机级 MEDDPICC 均值（进入商机阶段用）
      // 同时计算各维度的聚合均值，供 AI 分析使用
      const oppMeddpiccByClient = new Map<number, number[]>();
      // 每个客户各维度的聚合均值（0-100 scale）
      const oppMeddpiccDimsByClient = new Map<number, {
        metricsScore: number; economicBuyerScore: number; decisionCriteriaScore: number;
        decisionProcessScore: number; paperProcessScore: number; implicatePainScore: number;
        championScore: number; competitionScore: number;
      }>();
      // 先按客户分组所有商机 MEDDPICC
      const oppMeddpiccListByClient = new Map<number, typeof allOppMeddpicc[0][]>();
      allOppMeddpicc.forEach(om => {
        const list = oppMeddpiccListByClient.get(om.clientId) || [];
        list.push(om);
        oppMeddpiccListByClient.set(om.clientId, list);
      });
      oppMeddpiccListByClient.forEach((oms, clientId) => {
        const dimKeys = ['metricsScore', 'economicBuyerScore', 'decisionCriteriaScore',
          'decisionProcessScore', 'paperProcessScore', 'implicatePainScore',
          'championScore', 'competitionScore'] as const;
        const dimAvgs = {} as Record<string, number>;
        dimKeys.forEach(key => {
          const vals = oms.map(om => om[key]).filter(v => v !== null) as number[];
          // 0-4 分制转换为 0-100
          dimAvgs[key] = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 25) : 0;
        });
        oppMeddpiccDimsByClient.set(clientId, dimAvgs as any);
        // 整体均值
        const allDimVals = Object.values(dimAvgs);
        const oppAvg = allDimVals.length > 0 ? Math.round(allDimVals.reduce((a, b) => a + b, 0) / allDimVals.length) : 0;
        oppMeddpiccByClient.set(clientId, [oppAvg]);
      });

      const meddpiccMap = new Map(allClients.map(c => {
        const isOneToN = ONE_TO_N_STAGES.includes(c.stage);
        let avg = 0;
        let details: any = null;

        if (isOneToN) {
          // 进入商机：自动聚合商机级各维度均值
          const oppAvgs = oppMeddpiccByClient.get(c.id) || [];
          avg = oppAvgs.length > 0 ? Math.round(oppAvgs.reduce((a, b) => a + b, 0) / oppAvgs.length) : 0;
          // details 返回真实 8 维聚合分，供 AI 分析使用
          const dimAvgs = oppMeddpiccDimsByClient.get(c.id);
          details = dimAvgs ? {
            ...dimAvgs,
            _source: 'opportunity_aggregate',
            _oppCount: (oppMeddpiccListByClient.get(c.id) || []).length,
          } : { _source: 'opportunity_aggregate', _oppCount: 0,
            metricsScore: 0, economicBuyerScore: 0, decisionCriteriaScore: 0,
            decisionProcessScore: 0, paperProcessScore: 0, implicatePainScore: 0,
            championScore: 0, competitionScore: 0 };
        } else {
          // 0→1：使用客户级手动评分
          const m = allMeddpicc.find(m => m.clientId === c.id);
          if (m) {
            const scores = [m.metricsScore, m.economicBuyerScore, m.decisionCriteriaScore,
              m.decisionProcessScore, m.paperProcessScore, m.implicatePainScore,
              m.championScore, m.competitionScore].filter(s => s !== null) as number[];
            avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
            details = m;
          }
        }
        return [c.id, { avg, details, isOneToN }];
      }));

      // 6. 本周拜访客户 ID 集合
      const visitedThisWeek = new Set(recentMeetings.map(m => m.clientId));

      // 6b. 每个客户的 visitCount、lastVisitDate、日志质量指标
      const visitStatsByClient = new Map<number, {
        visitCount: number;
        lastVisitDate: Date | null;
        aiMinutesCount: number;
        transcriptCount: number;
        recentKeyPoints: string | null;
      }>();
      allMeetings.forEach(m => {
        const existing = visitStatsByClient.get(m.clientId);
        if (!existing) {
          visitStatsByClient.set(m.clientId, {
            visitCount: 1,
            lastVisitDate: m.visitDate,
            aiMinutesCount: m.aiMinutes ? 1 : 0,
            transcriptCount: m.transcriptText ? 1 : 0,
            recentKeyPoints: m.keyPoints ? m.keyPoints.slice(0, 200) : null,
          });
        } else {
          existing.visitCount += 1;
          if (m.aiMinutes) existing.aiMinutesCount += 1;
          if (m.transcriptText) existing.transcriptCount += 1;
          // allMeetings 已按日期降序，第一条就是最新的，recentKeyPoints 不需要更新
          if (m.visitDate && (!existing.lastVisitDate || m.visitDate > existing.lastVisitDate)) {
            existing.lastVisitDate = m.visitDate;
          }
        }
      });

      // 7. 阶段分布
      const stageDistribution: Record<string, number> = {};
      allClients.forEach(c => {
        stageDistribution[c.stage] = (stageDistribution[c.stage] || 0) + 1;
      });

      // 8. 按客户 ID 分组商机（需在 riskClients 之前声明）
      const oppsByClient = new Map<number, any[]>();
      allOpps.forEach(opp => {
        const list = oppsByClient.get(opp.clientId) || [];
        list.push({
          id: opp.id,
          name: opp.name,
          stage: opp.stage,
          status: opp.status,
          estimatedValue: opp.estimatedValue,
          meddpicc: oppMeddpiccMap.get(opp.id) ?? null,
        });
        oppsByClient.set(opp.clientId, list);
      });

      // 8b. 商机阶段停滞数据（stageChangedAt）
      // 全量 POD 任务（用于判断商机是否有行动分配）
      const allPodTasksForDash = await db.select({
        opportunityId: podTasks.opportunityId,
        isCompleted: podTasks.isCompleted,
      }).from(podTasks);
      const oppHasTaskSet = new Set(
        allPodTasksForDash
          .filter(t => !t.isCompleted && t.opportunityId)
          .map(t => t.opportunityId!)
      );

      // 拜访记录按clientId分组（用于0→1失联检测）
      const lastVisitByClient = new Map<number, Date | null>();
      const visitCountByClient = new Map<number, number>();
      allMeetings.forEach(m => {
        const prev = lastVisitByClient.get(m.clientId);
        if (!prev || (m.visitDate && m.visitDate > prev)) {
          lastVisitByClient.set(m.clientId, m.visitDate ?? null);
        }
        visitCountByClient.set(m.clientId, (visitCountByClient.get(m.clientId) ?? 0) + 1);
      });

      // 关键人数量 + Buying Group覆盖率（用于0→1汇报链路检测 + 决策层覆盖率大盘）
      const { keyContacts } = await import('../drizzle/schema');
      const allContacts = await db.select({
        clientId: keyContacts.clientId,
        buyingRole: keyContacts.buyingRole,
        influence: keyContacts.influence,
        name: keyContacts.name,
        title: keyContacts.title,
        stance: keyContacts.stance,
        relationship: keyContacts.relationship,
      }).from(keyContacts);
      const contactCountByClient = new Map<number, number>();
      // 决策层覆盖率：按客户统计各关键角色是否已覆盖
      type DecisionCoverage = {
        hasEconomicBuyer: boolean;
        hasTechDecisionMaker: boolean;
        hasChampion: boolean;
        hasBlocker: boolean;
        totalContacts: number;
        cLevelContacted: number; // 经济决策人+技术决策人中已有lastContactDate的数量
        cLevelTotal: number; // 经济决策人+技术决策人总数
        contacts: Array<{ name: string; title: string; buyingRole: string | null; stance: string | null; relationship: string | null }>;
      };
      const decisionCoverageByClient = new Map<number, DecisionCoverage>();
      allContacts.forEach(c => {
        contactCountByClient.set(c.clientId, (contactCountByClient.get(c.clientId) ?? 0) + 1);
        if (!decisionCoverageByClient.has(c.clientId)) {
          decisionCoverageByClient.set(c.clientId, {
            hasEconomicBuyer: false, hasTechDecisionMaker: false, hasChampion: false, hasBlocker: false,
            totalContacts: 0, cLevelContacted: 0, cLevelTotal: 0, contacts: []
          });
        }
        const cov = decisionCoverageByClient.get(c.clientId)!;
        cov.totalContacts++;
        const isContacted = c.relationship && ['初步接触', '已接触', '建立关系', 'Champion'].includes(c.relationship);
        cov.contacts.push({ name: c.name, title: c.title || '', buyingRole: c.buyingRole, stance: c.stance, relationship: c.relationship });
        if (c.buyingRole === '经济决策人') { cov.hasEconomicBuyer = true; cov.cLevelTotal++; if (isContacted) cov.cLevelContacted++; }
        if (c.buyingRole === '技术决策人') { cov.hasTechDecisionMaker = true; cov.cLevelTotal++; if (isContacted) cov.cLevelContacted++; }
        if (c.buyingRole === 'Champion') cov.hasChampion = true;
        if (c.buyingRole === '阻碍者') cov.hasBlocker = true;
        // 也检查influence字段（旧数据）
        if (c.influence === '决策者') { cov.hasEconomicBuyer = true; cov.cLevelTotal++; if (isContacted) cov.cLevelContacted++; }
        if (c.influence === 'Champion候选') cov.hasChampion = true;
      });

      const allOppsWithStage = await db.select({
        id: opportunities.id,
        clientId: opportunities.clientId,
        name: opportunities.name,
        stage: opportunities.stage,
        status: opportunities.status,
        estimatedValue: opportunities.estimatedValue,
        expectedCloseDate: opportunities.expectedCloseDate,
        champion: opportunities.champion,
        championStance: opportunities.championStance,
        stageChangedAt: opportunities.stageChangedAt,
        updatedAt: opportunities.updatedAt,
      }).from(opportunities);

      const now = Date.now();
      // 0→1 推进看板：每个非"进入商机"客户的阶段停留天数和本周动作
      const zeroToOneBoard = allClients
        .filter(c => c.stage !== '进入商机')
        .map(c => {
          const stageChangedAt = stageChangedAtMap.get(c.id);
          const stageDwellDays = stageChangedAt
            ? Math.floor((now - new Date(stageChangedAt).getTime()) / 86400000)
            : Math.floor((now - new Date(c.updatedAt).getTime()) / 86400000);
          const hasActionThisWeek = visitedThisWeek.has(c.id);
          const visitStats = visitStatsByClient.get(c.id);
          const mScore = meddpiccMap.get(c.id)?.avg ?? 0;
          const mDetails = meddpiccMap.get(c.id)?.details;
          const isStagnant = stageDwellDays > 14 && !hasActionThisWeek;

          // 关键人数量
          const contactCount = contactCountByClient.get(c.id) ?? 0;
          // 最后拜访距今天数
          const lastVisit = lastVisitByClient.get(c.id) ?? null;
          const daysSinceLastVisit = lastVisit
            ? Math.floor((now - new Date(lastVisit).getTime()) / 86400000)
            : null;
          // 拜访次数
          const visitCount = visitCountByClient.get(c.id) ?? 0;
          // Champion评分
          const championScore = mDetails?.championScore ?? 0;

          // 仅有客户档案或关键人建图，不足以构成经营判断基线。
          // 至少要有一条真实拜访/对话记录，AI 才能把事实升级为异常判断。
          const dataSufficient = visitCount > 0;

          // ── 0→1 业务异常检测 ──────────────────────────────────────────────
          const anomalies: string[] = [];
          if (dataSufficient) {
            // 1. 无Champion且已在"定痛"阶段超过7天
            if (c.stage === '定痛' && championScore === 0 && stageDwellDays > 7) {
              anomalies.push('定痛阶段无Champion');
            }
            // 1b. 定痛阶段无能力认可信号（I维度达标但无支持态度且无正面拜访记录）
            if (c.stage === '定痛' && (mDetails?.implicatePainScore ?? 0) >= 50) {
              const clientContacts = decisionCoverageByClient.get(c.id)?.contacts ?? [];
              const hasPositiveStanceAnomaly = clientContacts.some((ct: any) => ct.stance === '支持');
              if (!hasPositiveStanceAnomaly) {
                anomalies.push('定痛不完整：缺能力认可信号（无关键人态度为支持）');
              }
            }
            // 2. 关键人数量=0
            if (contactCount === 0) {
              anomalies.push('汇报链路未摸清');
            }
            // 3. 最后一次拜访距今超过21天
            if (daysSinceLastVisit !== null && daysSinceLastVisit > 21) {
              anomalies.push(`失联${daysSinceLastVisit}天`);
            }
            // 4. MEDDPICC总分<20且阶段已到"找人"
            if (c.stage === '找人' && mScore < 20) {
              anomalies.push('MEDDPICC严重滞后');
            }
          }

          return {
            id: c.id,
            name: c.name,
            stage: c.stage,
            stageDwellDays,
            hasActionThisWeek,
            lastVisitDate: visitStats?.lastVisitDate ?? null,
            visitCount,
            contactCount,
            daysSinceLastVisit,
            championScore,
            meddpiccAvg: mScore,
            dataSufficient,
            isStagnant: dataSufficient && isStagnant,
            anomalies,
          };
        })
        .sort((a, b) => b.anomalies.length - a.anomalies.length || b.stageDwellDays - a.stageDwellDays);

      // 1→N 商机推进看板：每条活跃商机的停滞天数和MEDDPICC缺口
      const oneToNBoard = allOppsWithStage
        .filter(opp => opp.status === '活跃')
        .map(opp => {
          const stageChangedAt = opp.stageChangedAt;
          const stageDwellDays = stageChangedAt
            ? Math.floor((now - new Date(stageChangedAt).getTime()) / 86400000)
            : Math.floor((now - new Date(opp.updatedAt).getTime()) / 86400000);
          // 分阶段预警阈值（企业级网络安全国际销售参考基准）
          const stageThresholds: Record<string, { yellow: number; red: number }> = {
            '初步需求':  { yellow: 21, red: 30 },
            '需求挖掘':  { yellow: 30, red: 45 },
            '技术验证':  { yellow: 45, red: 60 },
            '方案提案':  { yellow: 21, red: 30 },
            '商务谈判':  { yellow: 30, red: 45 },
          };
          const threshold = stageThresholds[opp.stage] ?? { yellow: 21, red: 30 };
          const meddpicc = oppMeddpiccMap.get(opp.id);
          // 找出最弱的1-2个MEDDPICC维度
          const dimLabels: Record<string, string> = {
            metricsScore: 'M', economicBuyerScore: 'E', decisionCriteriaScore: 'Dc',
            decisionProcessScore: 'Dp', paperProcessScore: 'P', implicatePainScore: 'I',
            championScore: 'C', competitionScore: 'C2'
          };
          const weakDims: string[] = [];
          if (meddpicc) {
            const dimScores = Object.entries(dimLabels).map(([key, label]) => ({
              label, score: (meddpicc as any)[key] ?? 0
            }));
            dimScores.sort((a, b) => a.score - b.score);
            weakDims.push(...dimScores.slice(0, 2).filter(d => d.score <= 1).map(d => d.label));
          }
          // 该商机的待处理任务
          const clientName = allClients.find(c => c.id === opp.clientId)?.name ?? '';
          const isStagnant = stageDwellDays >= threshold.red;
          const isWarning = !isStagnant && stageDwellDays >= threshold.yellow;

          // ── 1→N 业务异常检测 ──────────────────────────────────────────────
          const oppAnomalies: string[] = [];
          // 3. 商机无POD任务
          if (!oppHasTaskSet.has(opp.id)) {
            oppAnomalies.push('无行动分配');
          }
          // 4. 商机无拜访记录（通过clientId的visitCount判断，近似处理）
          const clientVisitCount = visitCountByClient.get(opp.clientId) ?? 0;
          if (clientVisitCount === 0) {
            oppAnomalies.push('客户无拜访记录');
          }
          // 5. E维度=0且阶段已到"方案提案"以后
          const eScore = meddpicc ? (meddpicc as any).economicBuyerScore ?? 0 : 0;
          const lateStages = ['方案提案', '商务谈判'];
          if (eScore === 0 && lateStages.includes(opp.stage)) {
            oppAnomalies.push('无预算决策人(E=0)');
          }
          // 6. 商机金额为空或"$0"
          const hasValue = opp.estimatedValue && opp.estimatedValue.trim() !== '' && opp.estimatedValue !== '$0' && opp.estimatedValue !== '0';
          if (!hasValue) {
            oppAnomalies.push('未填写金额');
          }
          // 7. Champion评分=0且阶段已到"技术验证"以后
          const cScore = meddpicc ? (meddpicc as any).championScore ?? 0 : 0;
          const techStages = ['技术验证', '方案提案', '商务谈判'];
          if (cScore === 0 && techStages.includes(opp.stage)) {
            oppAnomalies.push('无Champion(C=0)');
          }
          // 8. 无关单日期
          if (!opp.expectedCloseDate || opp.expectedCloseDate.trim() === '') {
            oppAnomalies.push('未设定关单日期');
          }
          // 9. 关单日期在90天内但阶段还在"需求挖掘"或更早
          if (opp.expectedCloseDate && opp.expectedCloseDate.trim() !== '') {
            // Parse Q4 2026 style or YYYY-MM-DD style
            const earlyStages = ['初步需求', '需求挖掘'];
            if (earlyStages.includes(opp.stage)) {
              // rough check: if close date mentions current or next quarter within 90 days
              const closeStr = opp.expectedCloseDate.toLowerCase();
              const nowDate = new Date(now);
              const q = nowDate.getMonth() < 3 ? 'q1' : nowDate.getMonth() < 6 ? 'q2' : nowDate.getMonth() < 9 ? 'q3' : 'q4';
              const yr = nowDate.getFullYear();
              if (closeStr.includes(`q${parseInt(q[1])} ${yr}`) || closeStr.includes(`${yr}-`) || closeStr.includes(`${yr}/`)) {
                oppAnomalies.push('关单临近但阶段过早');
              }
            }
          }

          const healthScores = meddpicc
            ? ["metricsScore", "economicBuyerScore", "decisionCriteriaScore", "decisionProcessScore", "paperProcessScore", "implicatePainScore", "championScore", "competitionScore"]
              .map(key => Number((meddpicc as any)[key] ?? 0))
            : [];
          const healthScore = healthScores.length
            ? Math.round((healthScores.reduce((sum, value) => sum + value, 0) / healthScores.length) * 25)
            : null;

          return {
            id: opp.id,
            clientId: opp.clientId,
            clientName,
            name: opp.name,
            stage: opp.stage,
            estimatedValue: opp.estimatedValue,
            expectedCloseDate: opp.expectedCloseDate,
            champion: opp.champion,
            championStance: opp.championStance,
            stageDwellDays,
            weakDims,
            isStagnant,
            isWarning,
            thresholdYellow: threshold.yellow,
            thresholdRed: threshold.red,
            healthScore,
            oppAnomalies,
            hasPendingTask: oppHasTaskSet.has(opp.id),
          };
        })
        .sort((a, b) => b.stageDwellDays - a.stageDwellDays);

      // 9. 高风险客户：仅以已入库的 MEDDPICC 证据缺口或长期未触达为依据
      const riskClients = allClients.filter(c => {
        const mScore = meddpiccMap.get(c.id)?.avg ?? 0;
        const notVisited = !visitedThisWeek.has(c.id);
        const hasAnyVisit = (visitStatsByClient.get(c.id)?.visitCount ?? 0) > 0;
        return mScore < 30 || (hasAnyVisit && notVisited);
      }).map(c => ({
        ...c,
        meddpiccAvg: meddpiccMap.get(c.id)?.avg ?? 0,
        meddpiccDetails: meddpiccMap.get(c.id)?.details ?? null,
        visitedThisWeek: visitedThisWeek.has(c.id),
        visitCount: visitStatsByClient.get(c.id)?.visitCount ?? 0,
        lastVisitDate: visitStatsByClient.get(c.id)?.lastVisitDate ?? null,
        riskReason: (meddpiccMap.get(c.id)?.avg ?? 0) < 30 ? 'MEDDPICC证据不足' : '本周尚无客户触达',
        visitQuality: {
          totalVisits: visitStatsByClient.get(c.id)?.visitCount ?? 0,
          aiMinutesCount: visitStatsByClient.get(c.id)?.aiMinutesCount ?? 0,
          transcriptCount: visitStatsByClient.get(c.id)?.transcriptCount ?? 0,
          recentKeyPoints: visitStatsByClient.get(c.id)?.recentKeyPoints ?? undefined,
        },
        // 0→1 阶段：阶段停留天数（用 updatedAt 估算）
        stageDwellDays: Math.floor((Date.now() - new Date(c.updatedAt).getTime()) / 86400000),
        // 进入商机阶段：商机子阶段分布
        oppStageDistribution: (() => {
          if (c.stage !== '进入商机') return undefined;
          const opps = (oppsByClient.get(c.id) || []);
          const dist: Record<string, number> = {};
          opps.forEach((o: any) => { if (o.stage) dist[o.stage] = (dist[o.stage] || 0) + 1; });
          return dist;
        })(),
        oppCount: c.stage === '进入商机' ? (oppsByClient.get(c.id) || []).length : undefined,
      }));

      return {
        clientCount: allClients.length,
        stageDistribution,
        clients: allClients.map(c => ({
          ...c,
          meddpiccAvg: meddpiccMap.get(c.id)?.avg ?? 0,
          meddpiccDetails: meddpiccMap.get(c.id)?.details ?? null,
          meddpiccIsAggregated: meddpiccMap.get(c.id)?.isOneToN ?? false,
          visitedThisWeek: visitedThisWeek.has(c.id),
          visitCount: visitStatsByClient.get(c.id)?.visitCount ?? 0,
          lastVisitDate: visitStatsByClient.get(c.id)?.lastVisitDate ?? null,
          opportunities: oppsByClient.get(c.id) ?? [],
        })),
        visitedThisWeekCount: visitedThisWeek.size,
        riskClients,
        pendingTasksByRole: pendingTasks.map(t => ({ role: t.assignedRole, count: t.count })),
        zeroToOneBoard,
        oneToNBoard,
        decisionLayerCoverage: allClients.map(c => {
          const cov = decisionCoverageByClient.get(c.id);
          return {
            clientId: c.id,
            clientName: c.name,
            stage: c.stage,
            priority: c.priority,
            hasEconomicBuyer: cov?.hasEconomicBuyer ?? false,
            hasTechDecisionMaker: cov?.hasTechDecisionMaker ?? false,
            hasChampion: cov?.hasChampion ?? false,
            hasBlocker: cov?.hasBlocker ?? false,
            totalContacts: cov?.totalContacts ?? 0,
            cLevelContacted: cov?.cLevelContacted ?? 0,
            cLevelTotal: cov?.cLevelTotal ?? 0,
            coverageRate: cov && cov.cLevelTotal > 0 ? Math.round((cov.cLevelContacted / cov.cLevelTotal) * 100) : 0,
            contacts: cov?.contacts ?? [],
          };
        }),
      };
    }),
  }),

  admin: router({
    listUsers: publicProcedure.query(async ({ ctx }) => {
      // Verify admin session
      const token = (() => { const h = ctx.req.headers?.cookie as string | undefined; if (!h) return undefined; const m = h.match(/(?:^|;\s*)email_session=([^;]+)/); return m?.[1]; })();
      if (!token) throw new Error('未登录');
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');
      const { emailUsers, emailSessions } = await import('../drizzle/schema');
      const { eq, and, gt } = await import('drizzle-orm');
      const sessions = await db.select().from(emailSessions).where(
        and(eq(emailSessions.token, token), gt(emailSessions.expiresAt, new Date()))
      ).limit(1);
      if (sessions.length === 0) throw new Error('会话已过期');
      const caller = await db.select().from(emailUsers).where(eq(emailUsers.id, sessions[0].userId)).limit(1);
      if (caller.length === 0 || caller[0].role !== 'admin') throw new Error('无权限：仅管理员可访问');
      const rows = await db.select({
        id: emailUsers.id,
        email: emailUsers.email,
        name: emailUsers.name,
        role: emailUsers.role,
        podRole: emailUsers.podRole,
        isActive: emailUsers.isActive,
        createdAt: emailUsers.createdAt,
        lastLoginAt: emailUsers.lastLoginAt,
        lastLoginIp: emailUsers.lastLoginIp,
      }).from(emailUsers).orderBy(emailUsers.createdAt);
      return rows;
    }),

    toggleUser: publicProcedure
      .input(z.object({ userId: z.number(), isActive: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        const token = (() => { const h = ctx.req.headers?.cookie as string | undefined; if (!h) return undefined; const m = h.match(/(?:^|;\s*)email_session=([^;]+)/); return m?.[1]; })();
        if (!token) throw new Error('未登录');
        const db = await getDb();
        if (!db) throw new Error('Database unavailable');
        const { emailUsers, emailSessions } = await import('../drizzle/schema');
        const { eq, and, gt } = await import('drizzle-orm');
        const sessions = await db.select().from(emailSessions).where(
          and(eq(emailSessions.token, token), gt(emailSessions.expiresAt, new Date()))
        ).limit(1);
        if (sessions.length === 0) throw new Error('会话已过期');
        const caller = await db.select().from(emailUsers).where(eq(emailUsers.id, sessions[0].userId)).limit(1);
        if (caller.length === 0 || caller[0].role !== 'admin') throw new Error('无权限');
        await db.update(emailUsers).set({ isActive: input.isActive }).where(eq(emailUsers.id, input.userId));
        // 异步发送飞书账号状态通知
        const targetUser = await db.select({ email: emailUsers.email, name: emailUsers.name }).from(emailUsers).where(eq(emailUsers.id, input.userId)).limit(1);
        if (targetUser.length > 0) {
          import('./feishuBot').then(({ sendFeishuAccountStatus }) => {
            sendFeishuAccountStatus({
              email: targetUser[0].email,
              name: targetUser[0].name,
              isActive: input.isActive,
              loginUrl: 'https://command.aistorm.com',
            }).then((r: { success: boolean; error?: string }) => {
              if (!r.success) console.warn('[toggleUser] 飞书通知失败:', r.error);
            });
          }).catch((e: Error) => console.warn('[toggleUser] 飞书模块加载失败:', e.message));
        }
        return { success: true };
      }),

    updateUserRole: adminProcedure
      .input(z.object({ userId: z.number(), podRole: z.string(), role: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const token = (() => { const h = ctx.req.headers?.cookie as string | undefined; if (!h) return undefined; const m = h.match(/(?:^|;\s*)email_session=([^;]+)/); return m?.[1]; })();
        if (!token) throw new Error('未登录');
        const db = await getDb();
        if (!db) throw new Error('Database unavailable');
        const { emailUsers, emailSessions } = await import('../drizzle/schema');
        const { eq, and, gt } = await import('drizzle-orm');
        const sessions = await db.select().from(emailSessions).where(
          and(eq(emailSessions.token, token), gt(emailSessions.expiresAt, new Date()))
        ).limit(1);
        if (sessions.length === 0) throw new Error('会话已过期');
        const caller = await db.select().from(emailUsers).where(eq(emailUsers.id, sessions[0].userId)).limit(1);
        if (caller.length === 0 || caller[0].role !== 'admin') throw new Error('无权限');
        await db.update(emailUsers).set({ podRole: input.podRole as "AD" | "SAM" | "SA" | "RSM", role: input.role as "user" | "admin" }).where(eq(emailUsers.id, input.userId));
        return { success: true };
      }),

    // 创建新团队成员（SAM/RSM/SA/AD）
    createMember: adminProcedure.input(z.object({
      email: z.string().email(),
      name: z.string().min(1),
      podRole: z.enum(["AD", "SAM", "SA", "RSM"]),
      password: z.string().min(6).optional(),
    })).mutation(async ({ input, ctx }) => {
      const token = (() => { const h = ctx.req.headers?.cookie as string | undefined; if (!h) return undefined; const m = h.match(/(?:^|;\s*)email_session=([^;]+)/); return m?.[1]; })();
      if (!token) throw new Error('未登录');
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');
      const { emailUsers, emailSessions } = await import('../drizzle/schema');
      const { eq, and, gt } = await import('drizzle-orm');
      const sessions = await db.select().from(emailSessions).where(
        and(eq(emailSessions.token, token), gt(emailSessions.expiresAt, new Date()))
      ).limit(1);
      if (sessions.length === 0) throw new Error('会话已过期');
      const caller = await db.select().from(emailUsers).where(eq(emailUsers.id, sessions[0].userId)).limit(1);
      if (caller.length === 0 || caller[0].role !== 'admin') throw new Error('无权限：仅管理员可操作');
      // Check email uniqueness
      const existing = await db.select({ id: emailUsers.id }).from(emailUsers).where(eq(emailUsers.email, input.email.toLowerCase())).limit(1);
      if (existing.length > 0) throw new Error('该邮箱已存在');
      const passwordHash = await bcrypt.hash(input.password || 'Aistorm2024!', 10);
      const [result] = await db.insert(emailUsers).values({
        email: input.email.toLowerCase(),
        passwordHash,
        name: input.name,
        podRole: input.podRole,
      });
      const newId = (result as any).insertId;
      // 发送飞书欢迎消息（等待结果以便前端回显状态）
      const plainPassword = input.password || 'Aistorm2024!';
      let feishuSent = false;
      let feishuError: string | undefined;
      try {
        const { sendFeishuWelcomeMessage } = await import('./feishuBot');
        const feishuResult = await sendFeishuWelcomeMessage({
          email: input.email.toLowerCase(),
          name: input.name,
          podRole: input.podRole,
          password: plainPassword,
          loginUrl: 'https://command.aistorm.com',
        });
        feishuSent = feishuResult.success;
        feishuError = feishuResult.error;
        if (!feishuSent) console.warn('[createMember] 飞书欢迎消息发送失败:', feishuError);
        else console.log('[createMember] 飞书欢迎消息已发送至', input.email);
      } catch (e: any) {
        feishuError = e.message;
        console.warn('[createMember] 飞书模块加载失败:', e.message);
      }
      return { id: newId, name: input.name, feishuSent, feishuError };
    }),

    // 更新团队成员信息（改名/改角色）
    updateMember: adminProcedure.input(z.object({
      userId: z.number(),
      name: z.string().min(1).optional(),
      podRole: z.enum(["AD", "SAM", "SA", "RSM"]).optional(),
    })).mutation(async ({ input, ctx }) => {
      const token = (() => { const h = ctx.req.headers?.cookie as string | undefined; if (!h) return undefined; const m = h.match(/(?:^|;\s*)email_session=([^;]+)/); return m?.[1]; })();
      if (!token) throw new Error('未登录');
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');
      const { emailUsers, emailSessions, clients } = await import('../drizzle/schema');
      const { eq, and, gt } = await import('drizzle-orm');
      const sessions = await db.select().from(emailSessions).where(
        and(eq(emailSessions.token, token), gt(emailSessions.expiresAt, new Date()))
      ).limit(1);
      if (sessions.length === 0) throw new Error('会话已过期');
      const caller = await db.select().from(emailUsers).where(eq(emailUsers.id, sessions[0].userId)).limit(1);
      if (caller.length === 0 || caller[0].role !== 'admin') throw new Error('无权限');
      const updateData: any = {};
      if (input.name) updateData.name = input.name;
      if (input.podRole) updateData.podRole = input.podRole;
      await db.update(emailUsers).set(updateData).where(eq(emailUsers.id, input.userId));
      // 如果改名，同步更新 clients.assignedSamName
      if (input.name) {
        await db.update(clients).set({ assignedSamName: input.name }).where(eq(clients.assignedSamId, input.userId));
      }
      // 同步更新 clients.assignedRsmName
      if (input.name) {
        await db.update(clients).set({ assignedRsmName: input.name }).where(eq(clients.assignedRsmId, input.userId));
      }
      return { success: true };
    }),

    // 删除团队成员（同时清空其名下客户归属）
    deleteMember: publicProcedure.input(z.object({
      userId: z.number(),
      reassignToUserId: z.number().nullable(),  // null = 清空归属
      reassignToUserName: z.string().nullable(),
    })).mutation(async ({ input, ctx }) => {
      const token = (() => { const h = ctx.req.headers?.cookie as string | undefined; if (!h) return undefined; const m = h.match(/(?:^|;\s*)email_session=([^;]+)/); return m?.[1]; })();
      if (!token) throw new Error('未登录');
      const db = await getDb();
      if (!db) throw new Error('Database unavailable');
      const { emailUsers, emailSessions, clients } = await import('../drizzle/schema');
      const { eq, and, gt } = await import('drizzle-orm');
      const sessions = await db.select().from(emailSessions).where(
        and(eq(emailSessions.token, token), gt(emailSessions.expiresAt, new Date()))
      ).limit(1);
      if (sessions.length === 0) throw new Error('会话已过期');
      const caller = await db.select().from(emailUsers).where(eq(emailUsers.id, sessions[0].userId)).limit(1);
      if (caller.length === 0 || caller[0].role !== 'admin') throw new Error('无权限');
      if (input.userId === caller[0].id) throw new Error('不能删除自己');
      // 重新分配或清空客户归属
      if (input.reassignToUserId) {
        await db.update(clients).set({ assignedSamId: input.reassignToUserId, assignedSamName: input.reassignToUserName }).where(eq(clients.assignedSamId, input.userId));
      } else {
        await db.update(clients).set({ assignedSamId: null, assignedSamName: null }).where(eq(clients.assignedSamId, input.userId));
      }
      // 删除用户
      await db.delete(emailUsers).where(eq(emailUsers.id, input.userId));
      return { success: true };
    }),

    // 获取某成员名下的客户列表（删除前预览）
    getMemberClients: publicProcedure.input(z.object({ userId: z.number() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const { clients } = await import('../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      return db.select({ id: clients.id, name: clients.name, priority: clients.priority, stage: clients.stage }).from(clients).where(eq(clients.assignedSamId, input.userId));
    }),

    // 批量重新分配客户（将 fromUserId 的所有客户转给 toUserId）

    // 重置成员密码（生成临时密码，返回给管理员）
    resetMemberPassword: adminProcedure.input(z.object({
      userId: z.number(),
    })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
      const { emailUsers } = await import('../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      // Generate a readable temporary password: 3 words + 4 digits
      const adjectives = ['Blue', 'Fast', 'Bold', 'Calm', 'Keen', 'Wise', 'Bright', 'Swift'];
      const nouns = ['Tiger', 'Eagle', 'Storm', 'River', 'Cloud', 'Spark', 'Stone', 'Wave'];
      const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
      const noun = nouns[Math.floor(Math.random() * nouns.length)];
      const digits = String(Math.floor(1000 + Math.random() * 9000));
      const tempPassword = `${adj}${noun}${digits}`;
      const passwordHash = await bcrypt.hash(tempPassword, 10);
      await db.update(emailUsers).set({ passwordHash }).where(eq(emailUsers.id, input.userId));
      // 异步发送飞书重置密码通知
      const targetUser = await db.select({ email: emailUsers.email, name: emailUsers.name }).from(emailUsers).where(eq(emailUsers.id, input.userId)).limit(1);
      if (targetUser.length > 0) {
        import('./feishuBot').then(({ sendFeishuPasswordReset }) => {
          sendFeishuPasswordReset({
            email: targetUser[0].email,
            name: targetUser[0].name,
            tempPassword,
            loginUrl: 'https://command.aistorm.com',
          }).then((r: { success: boolean; error?: string }) => {
            if (!r.success) console.warn('[resetMemberPassword] 飞书通知失败:', r.error);
            else console.log('[resetMemberPassword] 飞书通知已发送至', targetUser[0].email);
          });
        }).catch((e: Error) => console.warn('[resetMemberPassword] 飞书模块加载失败:', e.message));
      }
      return { tempPassword };
    }),

    bulkReassignClients: adminProcedure.input(z.object({
      fromUserId: z.number(),
      toUserId: z.number(),
      toUserName: z.string(),
    })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
      const { clients } = await import('../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      const result = await db.update(clients)
        .set({ assignedSamId: input.toUserId, assignedSamName: input.toUserName })
        .where(eq(clients.assignedSamId, input.fromUserId));
      return { success: true, affected: (result as any)[0]?.affectedRows ?? 0 };
    }),

    // 修改团队成员邮箱/密码
    updateMemberCredentials: adminProcedure.input(z.object({
      userId: z.number(),
      email: z.string().email().optional(),
      password: z.string().min(6).optional(),
    })).mutation(async ({ input, ctx }) => {
      if (!input.email && !input.password) throw new TRPCError({ code: 'BAD_REQUEST', message: '请至少提供邮箱或密码' });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
      const { emailUsers } = await import('../drizzle/schema');
      const { eq } = await import('drizzle-orm');
      const updateData: any = {};
      if (input.email) {
        // Check email uniqueness (exclude current user)
        const existing = await db.select({ id: emailUsers.id }).from(emailUsers).where(eq(emailUsers.email, input.email.toLowerCase())).limit(1);
        if (existing.length > 0 && existing[0].id !== input.userId) throw new TRPCError({ code: 'CONFLICT', message: '该邮箱已被其他账号使用' });
        updateData.email = input.email.toLowerCase();
      }
      if (input.password) {
        updateData.passwordHash = await bcrypt.hash(input.password, 10);
      }
      await db.update(emailUsers).set(updateData).where(eq(emailUsers.id, input.userId));
      return { success: true };
    }),
  }),
  // ── Client Metrics (效能基线) ──────────────────────────────────────────────
  clientMetrics: router({
    get: publicProcedure.input(z.object({ clientId: z.number() })).query(async ({ input }) => {
      return getClientMetrics(input.clientId);
    }),
    upsert: publicProcedure.input(z.object({
      clientId: z.number(),
      securityTeamSize: z.number().nullable().optional(),
      mttr: z.number().nullable().optional(),
      annualComplianceCost: z.number().nullable().optional(),
      lastBreachYear: z.number().nullable().optional(),
      currentVendors: z.string().nullable().optional(),
      contractRenewalDate: z.number().nullable().optional(),
      itBudgetRange: z.string().nullable().optional(),
      additionalNotes: z.string().nullable().optional(),
    })).mutation(async ({ input }) => {
      const { clientId, contractRenewalDate, ...rest } = input;
      const data: Record<string, unknown> = { ...rest };
      if (contractRenewalDate !== undefined) {
        data.contractRenewalDate = contractRenewalDate ? new Date(contractRenewalDate) : null;
      }
      await upsertClientMetrics(clientId, data);
      return { ok: true };
    }),
  }),
  // ── Case Studies（成功案例库）────────────────────────────────────────────
  caseStudies: router({
    list: publicProcedure.query(() => getAllCaseStudies()),
    create: publicProcedure.input(z.object({
      title: z.string(),
      clientAlias: z.string().optional(),
      isConfidential: z.boolean().optional(),
      industry: z.string().optional(),
      clientSize: z.enum(["大型企业", "中型企业", "小型企业", "政府机构"]).optional(),
      region: z.string().optional(),
      productLines: z.array(z.string()).optional(),
      painPoint: z.string(),
      solution: z.string(),
      quantifiedResult: z.string().optional(),
      roiHighlight: z.string().optional(),
      fullContent: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })).mutation(async ({ input }) => {
      const id = await insertCaseStudy(input);
      return { id };
    }),
    update: publicProcedure.input(z.object({
      id: z.number(),
      title: z.string().optional(),
      clientAlias: z.string().optional(),
      isConfidential: z.boolean().optional(),
      industry: z.string().optional(),
      clientSize: z.enum(["大型企业", "中型企业", "小型企业", "政府机构"]).optional(),
      region: z.string().optional(),
      productLines: z.array(z.string()).optional(),
      painPoint: z.string().optional(),
      solution: z.string().optional(),
      quantifiedResult: z.string().optional(),
      roiHighlight: z.string().optional(),
      fullContent: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateCaseStudy(id, data);
      return { ok: true };
    }),
    delete: publicProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await deleteCaseStudy(input.id);
      return { ok: true };
    }),

    // 从上传文档的提取文字中 AI 解析结构化字段
    parseFromDoc: publicProcedure.input(z.object({
      extractedText: z.string(),
      filename: z.string().optional(),
    })).mutation(async ({ input }) => {
      const prompt = `请从以下文档内容中提取成功案例的结构化信息。

文档名称：${input.filename || "未知"}
文档内容：
${input.extractedText.slice(0, 4000)}

请提取以下字段，以 JSON 格式返回（不要有其他内容）：
{
  "title": "案例标题（简洁描述，如'某大型银行威胁检测响应优化'，不超过50字）",
  "clientAlias": "客户别名（如文档中有客户名称，用行业+规模描述，如'华南某股份制银行'；如无则留空）",
  "industry": "行业（从以下选项中选一个：金融/制造/电信/政府/医疗/科技/零售/能源/教育/其他）",
  "clientSize": "客户规模（从以下选项中选一个：大型企业/中型企业/小型企业/政府机构）",
  "region": "地区（如华南/华北/东南亚/港澳等，如文档中未提及则留空）",
  "painPoint": "核心痛点（1-2句话，描述客户面临的核心安全挑战）",
  "solution": "解决方案摘要（2-3句话，描述提供了什么方案和核心功能）",
  "quantifiedResult": "量化结果。规则：①如文档中有具体数字（如MTTR从X降至Y、节省Z%），直接提取原文数字；②如文档只有定性描述无具体数字，则根据行业基准生成估算值，格式为'[行业基准估算，待核实] MTTR改善约60-80%，安全人力效率提升约40%'；③估算时参考：金融/电信行业MTTR基准4-8小时，XDR部署后通常改善60-80%；SOC人力效率提升30-50%；合规审计时间缩短40-60%",
  "roiHighlight": "ROI亮点一句话。规则：①如文档有ROI数据直接提取；②如无，根据行业基准估算，格式为'[行业基准估算，待核实] 12-18个月ROI约150-250%'",
  "isConfidential": false,
  "needsVerification": false
}

注意：
1. 如果文档中有真实客户名称，请在 clientAlias 中用行业描述替代（如"某制造业龙头企业"），isConfidential 设为 true
2. 量化结果是最重要的字段——文档有数字就用原文数字，没有就用行业基准估算（必须标注"[行业基准估算，待核实]"）
3. 如果 quantifiedResult 或 roiHighlight 使用了行业基准估算，needsVerification 设为 true
4. 如果某字段确实无法提取也无法估算，返回空字符串""`;

      const result = await invokeLLM({
        model: 'gpt-4o',
        messages: [{ role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT }, { role: "user", content: prompt }],
      });
      const raw = String(result.choices[0]?.message?.content || '');
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
        return {
          title: parsed.title || '',
          clientAlias: parsed.clientAlias || '',
          industry: parsed.industry || '',
          clientSize: parsed.clientSize || '大型企业',
          region: parsed.region || '',
          painPoint: parsed.painPoint || '',
          solution: parsed.solution || '',
          quantifiedResult: parsed.quantifiedResult || '',
          roiHighlight: parsed.roiHighlight || '',
          isConfidential: parsed.isConfidential ?? false,
          needsVerification: parsed.needsVerification ?? false,
        };
      } catch {
        return { title: input.filename?.replace(/\.[^.]+$/, '') || '', clientAlias: '', industry: '', clientSize: '大型企业', region: '', painPoint: '', solution: '', quantifiedResult: '', roiHighlight: '', isConfidential: false, needsVerification: false };
      }
    }),
  }),

  // ─── Products 产品配置管理 ───────────────────────────────────────────────
  products: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      const { products } = await import('../drizzle/schema.js');
      return db.select().from(products).orderBy(products.sortOrder, products.id);
    }),
    listActive: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
      const { products } = await import('../drizzle/schema.js');
      return db.select().from(products).where(eq(products.isActive, 1)).orderBy(products.sortOrder, products.id);
    }),
    create: adminProcedure
      .input(z.object({
        name: z.string().min(1).max(100),
        nameEn: z.string().max(100).optional(),
        shortCode: z.string().max(20).optional(),
        description: z.string().optional(),
        sortOrder: z.number().default(0),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
        const { products } = await import('../drizzle/schema.js');
        const [result] = await db.insert(products).values(input as any);
        return { id: (result as any).insertId };
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
        nameEn: z.string().max(100).optional(),
        shortCode: z.string().max(20).optional(),
        description: z.string().optional(),
        sortOrder: z.number().optional(),
        isActive: z.number().min(0).max(1).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
        const { products } = await import('../drizzle/schema.js');
        const { id, ...data } = input;
        await db.update(products).set(data as any).where(eq(products.id, id));
        return { success: true };
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
        const { products } = await import('../drizzle/schema.js');
        await db.delete(products).where(eq(products.id, input.id));
        return { success: true };
      }),
    // 查询某客户的产品覆盖度（从商机 productId 自动聚合）
    clientCoverage: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
        const { products, opportunities } = await import('../drizzle/schema.js');
        const allProducts = await db.select().from(products)
          .where(eq(products.isActive, 1))
          .orderBy(products.sortOrder, products.id);
        const coveredOpps = await db.select({
          productId: opportunities.productId,
          status: opportunities.status,
        }).from(opportunities)
          .where(eq(opportunities.clientId, input.clientId));
        const coveredProductIds = new Set(
          coveredOpps
            .filter(o => o.productId != null && (o.status === '活跃' || o.status === '赢单'))
            .map(o => o.productId!)
        );
        const wonProductIds = new Set(
          coveredOpps
            .filter(o => o.productId != null && o.status === '赢单')
            .map(o => o.productId!)
        );
        return allProducts.map(p => ({
          ...p,
          covered: coveredProductIds.has(p.id),
          won: wonProductIds.has(p.id),
        }));
      }),
    // 更新商机的关联产品
    setOpportunityProduct: protectedProcedure
      .input(z.object({
        opportunityId: z.number(),
        productId: z.number().nullable(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'DB unavailable' });
        const { opportunities } = await import('../drizzle/schema.js');
        await db.update(opportunities)
          .set({ productId: input.productId } as any)
          .where(eq(opportunities.id, input.opportunityId));
        return { success: true };
      }),
  }),

  // ── SA 技术定标工作台 ─────────────────────────────────────────────────────
  sa: router({
    getTechReadiness: protectedProcedure.input(z.object({
      clientId: z.number(),
      opportunityId: z.number(),
    })).mutation(async ({ input }) => {
      const client = await getClientById(input.clientId);
      const meddpiccData = await getMeddpiccByClientId(input.clientId);
      const { keyContacts, opportunities: oppsTable } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new Error("数据库不可用");
      const contacts = await db.select().from(keyContacts).where(eq(keyContacts.clientId, input.clientId));
      const techBuyer = contacts.find((c: any) => c.buyingRole === "技术决策人" || c.title?.includes("CTO") || c.title?.includes("技术"));
      const opp = (await db.select().from(oppsTable).where(eq(oppsTable.id, input.opportunityId)))[0] as any;
      const d1Score = (meddpiccData as any)?.decisionCriteriaScore ?? 0;
      const d1Evidence = (meddpiccData as any)?.decisionCriteriaNotes || "未填写";
      const competitor = opp?.competitors || "未知";
      const prompt = `当前商机技术定标阶段数据：\n\nMEDDPICC决策标准（D1）：${d1Score}/100，依据：${d1Evidence}\n技术决策人：${techBuyer?.name || "未找到"}，立场：${(techBuyer as any)?.relationship || "未知"}\n主要竞品：${competitor}\n商机阶段：${opp?.stage || "未知"}\n客户：${client?.name || "未知"}\n\n作为SA，请给出：\n1. 本阶段技术定标的最高风险（一句话，基于D1分数和技术决策人状态）\n2. POC/技术演示的最优设计建议（针对已知决策标准的弱点）\n3. 需要向SAM/AD申请的支持（具体资源）\n4. 竞品技术对比的核心差异化论点（一条，针对已录入竞品）\n\n数据不足时明确说明，不要编造技术参数。`;
      const res = await invokeLLM({
        model: "gpt-5-mini",
        maxCompletionTokens: 400,
        messages: [
          { role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
      });
      return { content: String(res.choices?.[0]?.message?.content || "数据不足，暂不判断") };
    }),
  }),

  // ── RSM 属地工作台 ─────────────────────────────────────────────────────
  rsm: router({
    getLocalActionPlan: protectedProcedure.input(z.object({
      clientId: z.number(),
      opportunityId: z.number(),
    })).mutation(async ({ input }) => {
      const client = await getClientById(input.clientId);
      const meddpiccData = await getMeddpiccByClientId(input.clientId);
      const { opportunities: oppsTable, keyContacts } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (!db) throw new Error("数据库不可用");
      const opp = (await db.select().from(oppsTable).where(eq(oppsTable.id, input.opportunityId)))[0] as any;
      const contacts = await db.select().from(keyContacts).where(eq(keyContacts.clientId, input.clientId));
      const hasProcurement = contacts.some((c: any) => (c.title || "").includes("采购") || (c.title || "").includes("法务") || c.buyingRole === "采购决策人");
      const d2Score = (meddpiccData as any)?.decisionProcessScore ?? 0;
      const pScore = (meddpiccData as any)?.paperProcessScore ?? 0;
      const pEvidence = (meddpiccData as any)?.paperProcessNotes || "未填写";
      const prompt = `属地RSM在以下商机中的协同任务分析：\n\n客户：${client?.name || "未知"}，商机阶段：${opp?.stage || "未知"}\nMEDDPICC决策流程（D2）：${d2Score}/100\nMEDDPICC采购流程（P）：${pScore}/100\nP维度评分依据：${pEvidence}\n是否有采购/法务联系人：${hasProcurement ? "是" : "否"}\n属地渠道：${(client as any)?.rsmPartner || "未登记"}\n\n请给RSM生成本周属地协同任务（最多3条）：\n1. 招投标/框架协议推进：当前最紧急的一步\n2. 渠道协调：是否需要拉入本地渠道？何时？为什么？\n3. 属地关系：有哪个属地人脉可以协助推进决策流程？\n\n只基于上述事实，不编造关系或流程细节。`;
      const res = await invokeLLM({
        model: "gpt-5-mini",
        maxCompletionTokens: 300,
        messages: [
          { role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
      });
      return { content: String(res.choices?.[0]?.message?.content || "数据不足，暂不判断") };
    }),
  }),

  // ── Command 3.1：SA / RSM 主动式角色工作台 ────────────────────────────────
  roleWorkbench: router({
    getMyDashboard: protectedProcedure.query(async ({ ctx }) => {
      const role = ctx.user.podRole;
      if (role !== "SA" && role !== "RSM") {
        throw new TRPCError({ code: "FORBIDDEN", message: "该工作台仅向 SA 或 RSM 提供" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库不可用" });
      const { clients: clientsTable, opportunities: opportunitiesTable, opportunityMeddpicc, podTasks, keyContacts } = await import("../drizzle/schema");
      const [allClients, allOpportunities, allScores, allTasks, allContacts] = await Promise.all([
        db.select().from(clientsTable),
        db.select().from(opportunitiesTable),
        db.select().from(opportunityMeddpicc),
        db.select().from(podTasks),
        db.select().from(keyContacts),
      ]);

      const ownedClients = role === "RSM"
        ? allClients.filter(client => client.assignedRsmId === ctx.user.id)
        : allClients;
      const ownedClientIds = new Set(ownedClients.map(client => client.id));
      const activeOpportunities = allOpportunities.filter(opportunity => opportunity.status === "活跃");
      const assignedOpportunities = role === "SA"
        ? activeOpportunities.filter(opportunity => opportunity.assignedSaId === ctx.user.id)
        : activeOpportunities.filter(opportunity => ownedClientIds.has(opportunity.clientId));
      const assignedOpportunityIds = new Set(assignedOpportunities.map(opportunity => opportunity.id));
      const clientById = new Map(allClients.map(client => [client.id, client]));
      const scoreByOpportunity = new Map(allScores.map(score => [score.opportunityId, score]));
      const contactsByClient = new Map<number, typeof allContacts>();
      for (const contact of allContacts) {
        const current = contactsByClient.get(contact.clientId) ?? [];
        current.push(contact);
        contactsByClient.set(contact.clientId, current);
      }

      const openTasks = allTasks.filter(task => task.assignedRole === role && task.taskStatus !== "done" && (
        assignedOpportunityIds.has(task.opportunityId ?? -1) || ownedClientIds.has(task.clientId)
      ));
      const tasksByOpportunity = new Map<number, typeof openTasks>();
      for (const task of openTasks) {
        if (!task.opportunityId) continue;
        const current = tasksByOpportunity.get(task.opportunityId) ?? [];
        current.push(task);
        tasksByOpportunity.set(task.opportunityId, current);
      }

      const workItems = assignedOpportunities.map(opportunity => {
        const client = clientById.get(opportunity.clientId);
        const score = scoreByOpportunity.get(opportunity.id) as any;
        const contacts = contactsByClient.get(opportunity.clientId) ?? [];
        const assignedTasks = tasksByOpportunity.get(opportunity.id) ?? [];
        const technicalDecisionMaker = contacts.find(contact => contact.buyingRole === "技术决策人");
        const procurementContact = contacts.find(contact => contact.buyingRole === "经济决策人" || /(采购|法务)/.test(contact.title || ""));
        const decisionCriteriaScore = Number(score?.decisionCriteriaScore ?? 0);
        const decisionProcessScore = Number(score?.decisionProcessScore ?? 0);
        const paperProcessScore = Number(score?.paperProcessScore ?? 0);
        const isUrgent = role === "SA"
          ? decisionCriteriaScore < 60 || !technicalDecisionMaker
          : decisionProcessScore < 60 || paperProcessScore < 60 || !procurementContact;
        const diagnostic = role === "SA"
          ? !technicalDecisionMaker
            ? "未入库技术决策人，不能假设 POC 验收标准已被覆盖"
            : `D1 决策标准 ${decisionCriteriaScore}/100；需以已确认技术标准校准验证动作`
          : !procurementContact
            ? "尚未入库采购或法务联系人，不能假设属地流程已打通"
            : `D2 决策流程 ${decisionProcessScore}/100，P 采购流程 ${paperProcessScore}/100；需核验本地流程证据`;
        return {
          clientId: opportunity.clientId,
          clientName: client?.name ?? "未知客户",
          opportunityId: opportunity.id,
          opportunityName: opportunity.name,
          stage: opportunity.stage,
          isUrgent,
          diagnostic,
          decisionCriteriaScore,
          decisionProcessScore,
          paperProcessScore,
          assignedTaskCount: assignedTasks.length,
          tasks: assignedTasks.map(task => ({ id: task.id, title: task.title, dueDate: task.dueDate, taskStatus: task.taskStatus })),
        };
      }).sort((a, b) => Number(b.isUrgent) - Number(a.isUrgent));

      return {
        role,
        summary: {
          activeDealCount: workItems.length,
          urgentDealCount: workItems.filter(item => item.isUrgent).length,
          openTaskCount: openTasks.length,
        },
        workItems,
      };
    }),
  }),

});
export type AppRouter = typeof appRouter;
import { triggerSingleClientRefresh } from "./eventDrivenRefresh";
