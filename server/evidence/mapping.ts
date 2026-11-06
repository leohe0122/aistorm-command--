// 现有录入路径 → 证据台账的映射规则（纯函数，不访问数据库）。
// sourceKey 与拜访确认卡使用的键一致（meddpicc:E、contact:0、time:1、competitor:0、threewhy:now），
// 这样“确认哪几条”可以一一对应到证据记录。

import type { FullMeetingSignals } from "../aiNativeGuidance";
import type { InsertEvidence } from "../../drizzle/schema";
import { hasValidExtractedFactCandidate, inferIrrelevantProjectParticipants, isGuidanceTopicExhaustionAnswer } from "../../shared/aiAnswerFacts";

export type EvidenceDraft = Omit<InsertEvidence, "id" | "createdAt" | "updatedAt" | "status" | "confirmedBy" | "confirmedAt"> & {
  sourceKey: string;
};

type MeetingContext = {
  clientId: number;
  opportunityId?: number | null;
  meetingId: number;
  occurredAt: Date;
};

const ATTITUDE_POLARITY: Record<string, EvidenceDraft["polarity"]> = { 支持: "positive", 反对: "negative" };
const ROLE_TOPICS: Record<string, string[]> = {
  经济决策人: ["E"],
  技术决策人: ["D1"],
  用户决策人: ["D1"],
  Champion: ["C1"],
  内线: ["C1"],
  反对者: [],
};
const TIME_TOPICS: Record<string, string[]> = {
  deadline: ["timeline", "why_now"],
  budget_cycle: ["budget", "P"],
  trigger_event: ["trigger", "why_now"],
};

export function meetingSignalsToEvidence(signals: FullMeetingSignals, ctx: MeetingContext): EvidenceDraft[] {
  const base = {
    clientId: ctx.clientId,
    opportunityId: ctx.opportunityId ?? null,
    occurredAt: ctx.occurredAt,
    sourceType: "meeting" as const,
    sourceId: ctx.meetingId,
    createdBy: "ai",
  };
  const drafts: EvidenceDraft[] = [];

  for (const item of signals.meddpiccUpdates) {
    drafts.push({
      ...base,
      sourceKey: `meddpicc:${item.dim}`,
      kind: "statement",
      claim: item.evidence,
      quote: item.evidence,
      topics: [item.dim],
      polarity: "neutral",
      confidence: item.confidence,
      suggestedScore: item.suggestedScore,
    });
  }

  signals.contactDiscoveries.forEach((item, index) => {
    drafts.push({
      ...base,
      sourceKey: `contact:${index}`,
      kind: "statement",
      claim: [item.name, item.title, item.buyingRole !== "未知" ? item.buyingRole : null, item.attitude !== "未知" ? `态度${item.attitude}` : null].filter(Boolean).join(" · "),
      quote: item.evidence,
      subjectName: item.name,
      topics: ["stakeholder", ...(ROLE_TOPICS[item.buyingRole] ?? [])],
      polarity: ATTITUDE_POLARITY[item.attitude] ?? "neutral",
    });
  });

  signals.timeSignals.forEach((item, index) => {
    drafts.push({
      ...base,
      sourceKey: `time:${index}`,
      kind: "statement",
      claim: item.date ? `${item.description}（${item.date}）` : item.description,
      topics: TIME_TOPICS[item.type] ?? ["timeline"],
      polarity: "neutral",
    });
  });

  signals.competitorMentions.forEach((item, index) => {
    drafts.push({
      ...base,
      sourceKey: `competitor:${index}`,
      kind: "statement",
      claim: `${item.competitorName}：${item.context}`,
      subjectName: item.competitorName,
      topics: ["competitor", "C2"],
      polarity: item.threatLevel === "high" ? "negative" : "neutral",
    });
  });

  const whyEntries: Array<[keyof FullMeetingSignals["threeWhyUpdates"], string, string]> = [
    ["whyChange", "threewhy:change", "why_change"],
    ["whyNow", "threewhy:now", "why_now"],
    ["whyUs", "threewhy:us", "why_us"],
  ];
  for (const [field, sourceKey, topic] of whyEntries) {
    const value = signals.threeWhyUpdates[field];
    if (!value) continue;
    drafts.push({ ...base, sourceKey, kind: "statement", claim: value, topics: [topic], polarity: topic === "why_us" ? "positive" : "neutral" });
  }

  return drafts;
}

const PURCHASE_SIGNAL_TOPICS: Record<string, string[]> = {
  intent_subject: ["I", "why_change"],
  decision_chain: ["stakeholder", "E", "D2"],
  trigger_event: ["trigger", "why_now"],
};
const PURCHASE_SOURCE_TYPE: Record<string, EvidenceDraft["sourceType"]> = {
  meeting: "meeting",
  customer_message: "manual",
  customer_email: "email",
  intelligence: "intelligence",
  other_evidence: "manual",
};

/** 购买信号本身就是“谁在何时说了什么”的证据形态，人工录入即视为已确认。 */
export function purchaseSignalToEvidence(signal: {
  id: number;
  clientId: number;
  signalType: string;
  subjectName: string;
  subjectContactId?: number | null;
  occurredAt: Date;
  statement: string;
  sourceType: string;
  sourceReference?: string | null;
  createdBy?: string | null;
}): EvidenceDraft {
  return {
    clientId: signal.clientId,
    opportunityId: null,
    kind: PURCHASE_SOURCE_TYPE[signal.sourceType] === "intelligence" ? "external" : "statement",
    claim: `${signal.subjectName}：${signal.statement}`,
    quote: signal.statement,
    subjectName: signal.subjectName,
    contactId: signal.subjectContactId ?? null,
    topics: PURCHASE_SIGNAL_TOPICS[signal.signalType] ?? [],
    polarity: "neutral",
    occurredAt: signal.occurredAt,
    // 来源统一指向购买信号记录本身，删除购买信号时据此同步驳回证据
    sourceType: "purchase_signal",
    sourceId: signal.id,
    sourceKey: "signal",
    sourceExcerpt: signal.sourceReference ?? null,
    createdBy: signal.createdBy || "已登录用户",
  };
}

/** 投喂素材中提取的证据 → 证据台账候选。sourceKey 用 item:<序号>，对应提取结果中的位置。 */
export function extractedToEvidence(
  items: Array<{
    claim: string;
    quote: string;
    subjectName: string | null;
    topics: string[];
    polarity: "positive" | "negative" | "neutral";
    suggestedScore: number | null;
    confidence: "high" | "medium" | "low";
  }>,
  ctx: { clientId: number; opportunityId?: number | null; ingestionId: number; kind: string; occurredAt: Date },
): EvidenceDraft[] {
  return items.map((item, index) => ({
    clientId: ctx.clientId,
    opportunityId: ctx.opportunityId ?? null,
    kind: ctx.kind === "document" ? "document" as const : "statement" as const,
    claim: item.claim,
    quote: item.quote,
    subjectName: item.subjectName,
    topics: item.topics,
    polarity: item.polarity,
    occurredAt: ctx.occurredAt,
    sourceType: "ingestion" as const,
    sourceId: ctx.ingestionId,
    sourceKey: `item:${index}`,
    confidence: item.confidence,
    suggestedScore: item.suggestedScore,
    createdBy: "ai",
  }));
}

// ── AI 主动引导问答 → 证据台账候选 ─────────────────────────────────────────
// sourceId 指向商机；sourceKey 记录回答人与维度：guidance:u<用户编号>:<维度>，
// 用于判断“回答人本人可确认”，无需新增字段。

const GUIDANCE_KEY = /^guidance:u(\d+):/;

export function guidanceSourceKey(answererUserId: number, dim: string): string {
  return `guidance:u${answererUserId}:${dim}`;
}

export function guidanceAnswererId(sourceKey: string | null | undefined): number | null {
  const match = sourceKey ? GUIDANCE_KEY.exec(sourceKey) : null;
  return match ? Number(match[1]) : null;
}

export type GuidanceAnswerInput = {
  clientId: number;
  opportunityId: number;
  dim: "M" | "E" | "D1" | "D2" | "P" | "I" | "C1" | "C2";
  /** AI 对 SAM 回答的简洁转述（一句话事实） */
  claim: string;
  /** SAM 的原始回答（逐字） */
  answer: string;
  question: string;
  subjectName?: string | null;
  suggestedScore?: number | null;
  confidence: "high" | "medium" | "low";
  answererUserId: number;
  answererName: string;
  occurredAt: Date;
};

/** 商机场景的 AI 引导回答 → 一条候选证据（status 由写入方固定为 candidate）。 */
export function guidanceAnswerToEvidence(input: GuidanceAnswerInput): EvidenceDraft {
  const claim = input.claim.replace(/^SAM 待确认原文[:：]\s*/, "").trim().slice(0, 800);
  const score = typeof input.suggestedScore === "number" && Number.isFinite(input.suggestedScore)
    ? Math.max(0, Math.min(100, Math.round(input.suggestedScore / 25) * 25))
    : null;
  return {
    clientId: input.clientId,
    opportunityId: input.opportunityId,
    kind: "observation",
    claim,
    quote: input.answer.trim().slice(0, 800),
    subjectName: input.subjectName?.trim() || null,
    topics: [input.dim],
    polarity: "neutral",
    occurredAt: input.occurredAt,
    sourceType: "ai_guidance",
    sourceId: input.opportunityId,
    sourceKey: guidanceSourceKey(input.answererUserId, input.dim),
    sourceExcerpt: `AI 问：${input.question.trim().slice(0, 300)}`,
    confidence: input.confidence,
    suggestedScore: score,
    createdBy: input.answererName,
  };
}

/**
 * 服务端兜底：判断一次引导回答能否进入证据台账。返回 null 表示可以，否则返回原因。
 * “不知道 / 没有 / 尚未发生 / 与项目无关”以及行动安排都不是客户事实，一律不入账。
 */
export function guidanceAnswerRejection(input: { answer: string; claim: string; dim: string; answerFocus?: string | null; subjectName?: string | null }): string | null {
  const answer = input.answer.trim();
  if (!answer) return "回答为空";
  if (input.answerFocus === "action_plan") return "行动安排不是客户事实";
  if (isGuidanceTopicExhaustionAnswer(answer)) return "回答表示未知、没有或尚未发生";
  const irrelevant = inferIrrelevantProjectParticipants(answer).map(person => person.name);
  const subject = input.subjectName?.trim();
  if (irrelevant.length > 0 && (!subject || irrelevant.some(name => name.includes(subject) || subject.includes(name)))) return "回答表示与项目无关";
  if (!hasValidExtractedFactCandidate({ candidateTarget: "meddpicc", meddpiccDim: input.dim, evidence: input.claim })) return "没有可识别的 MEDDPICC 维度或事实";
  return null;
}
