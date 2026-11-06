// 现有录入路径 → 证据台账的映射规则（纯函数，不访问数据库）。
// sourceKey 与拜访确认卡使用的键一致（meddpicc:E、contact:0、time:1、competitor:0、threewhy:now），
// 这样“确认哪几条”可以一一对应到证据记录。

import type { FullMeetingSignals } from "../aiNativeGuidance";
import type { InsertEvidence } from "../../drizzle/schema";

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
