/**
 * AI 原生交互的共享事实契约。
 * AI 只提出问题、提取明确信号和解释缺口；所有业务写入须由 SAM 确认。
 */

export const AI_NATIVE_GUIDANCE_VERSION = "ai-native-guidance-v1";

export const MEDDPICC_CODES = ["M", "E", "D1", "D2", "P", "I", "C1", "C2"] as const;
export type MeddpiccCode = (typeof MEDDPICC_CODES)[number];

export const STAGE_REQUIREMENTS = {
  "需求挖掘": [
    { key: "I", label: "I 痛点牵连", question: "这个问题影响了哪个部门的哪位负责人？他上次提到这个问题时说了什么？" },
    { key: "M", label: "M 可量化价值", question: "如果这个问题不解决，客户每年大概损失多少？请记录他们的数字，不是我们的估算。" },
  ],
  "技术验证": [
    { key: "D1", label: "D1 决策标准", question: "客户评估技术方案的标准是什么？谁定的这个标准？" },
    { key: "C1", label: "C1 Champion", question: "谁在客户内部真正推动这个项目？他的个人动机和具体推动行为是什么？" },
  ],
  "方案提案": [
    { key: "E", label: "E 经济决策人", question: "最终谁签字？他关心的是成本、风险还是合规？你见过他吗？" },
    { key: "D2", label: "D2 决策流程", question: "他们内部怎么做决定？需要几轮审批？谁可能一票否决？" },
    { key: "M", label: "M 可量化价值", question: "ROI 的数字是否已经准备好？客户的 CFO 或财务会如何看待这个投入？" },
  ],
  "商务谈判": [
    { key: "P", label: "P 采购流程", question: "合同走哪个部门审批？法务和采购的关注点是什么？" },
    { key: "gate8CompDefensible", label: "竞争可防御性", question: "竞品目前的状态是什么？他们有没有提出你无法反驳的论点？" },
  ],
} as const;

export type FullMeetingSignals = {
  meddpiccUpdates: Array<{
    dim: MeddpiccCode;
    suggestedScore: 0 | 25 | 50 | 75 | 100;
    evidence: string;
    confidence: "high" | "medium" | "low";
  }>;
  contactDiscoveries: Array<{
    name: string;
    title: string | null;
    buyingRole: "经济决策人" | "技术决策人" | "用户决策人" | "Champion" | "内线" | "反对者" | "未知";
    attitude: "支持" | "中立" | "反对" | "未知";
    evidence: string;
  }>;
  competitorMentions: Array<{
    competitorName: string;
    context: string;
    threatLevel: "high" | "medium" | "low";
  }>;
  timeSignals: Array<{
    type: "deadline" | "budget_cycle" | "trigger_event";
    description: string;
    date: string | null;
  }>;
  threeWhyUpdates: {
    whyChange: string | null;
    whyNow: string | null;
    whyUs: string | null;
  };
  winFactorAlerts: Array<{
    factor: "Pain" | "Power" | "Champion" | "Value" | "Control";
    alert: string;
    severity: "critical" | "warning" | "info";
  }>;
  nextBestAction: string;
};

export const FULL_MEETING_SIGNALS_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    meddpiccUpdates: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          dim: { type: "string", enum: [...MEDDPICC_CODES] },
          suggestedScore: { type: "integer", enum: [0, 25, 50, 75, 100] },
          evidence: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["dim", "suggestedScore", "evidence", "confidence"],
      },
    },
    contactDiscoveries: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          name: { type: "string" }, title: { type: ["string", "null"] },
          buyingRole: { type: "string", enum: ["经济决策人", "技术决策人", "用户决策人", "Champion", "内线", "反对者", "未知"] },
          attitude: { type: "string", enum: ["支持", "中立", "反对", "未知"] }, evidence: { type: "string" },
        },
        required: ["name", "title", "buyingRole", "attitude", "evidence"],
      },
    },
    competitorMentions: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: { competitorName: { type: "string" }, context: { type: "string" }, threatLevel: { type: "string", enum: ["high", "medium", "low"] } },
        required: ["competitorName", "context", "threatLevel"],
      },
    },
    timeSignals: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: { type: { type: "string", enum: ["deadline", "budget_cycle", "trigger_event"] }, description: { type: "string" }, date: { type: ["string", "null"] } },
        required: ["type", "description", "date"],
      },
    },
    threeWhyUpdates: {
      type: "object", additionalProperties: false,
      properties: { whyChange: { type: ["string", "null"] }, whyNow: { type: ["string", "null"] }, whyUs: { type: ["string", "null"] } },
      required: ["whyChange", "whyNow", "whyUs"],
    },
    winFactorAlerts: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: { factor: { type: "string", enum: ["Pain", "Power", "Champion", "Value", "Control"] }, alert: { type: "string" }, severity: { type: "string", enum: ["critical", "warning", "info"] } },
        required: ["factor", "alert", "severity"],
      },
    },
    nextBestAction: { type: "string" },
  },
  required: ["meddpiccUpdates", "contactDiscoveries", "competitorMentions", "timeSignals", "threeWhyUpdates", "winFactorAlerts", "nextBestAction"],
} as const;

export function normalizeFullMeetingSignals(value: unknown): FullMeetingSignals {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, any>;
  const safeArray = (input: unknown) => Array.isArray(input) ? input : [];
  return {
    meddpiccUpdates: safeArray(raw.meddpiccUpdates).filter((item: any) => MEDDPICC_CODES.includes(item?.dim) && [0, 25, 50, 75, 100].includes(Number(item?.suggestedScore)) && String(item?.evidence || "").trim()).map((item: any) => ({ dim: item.dim as MeddpiccCode, suggestedScore: Number(item.suggestedScore) as 0 | 25 | 50 | 75 | 100, evidence: String(item.evidence).trim(), confidence: (["high", "medium", "low"].includes(item.confidence) ? item.confidence : "low") as "high" | "medium" | "low" })),
    contactDiscoveries: safeArray(raw.contactDiscoveries).filter((item: any) => String(item?.name || "").trim() && String(item?.evidence || "").trim()).map((item: any) => ({ name: String(item.name).trim(), title: item.title == null || !String(item.title).trim() ? null : String(item.title).trim(), buyingRole: ["经济决策人", "技术决策人", "用户决策人", "Champion", "内线", "反对者", "未知"].includes(item.buyingRole) ? item.buyingRole : "未知", attitude: ["支持", "中立", "反对", "未知"].includes(item.attitude) ? item.attitude : "未知", evidence: String(item.evidence).trim() })),
    competitorMentions: safeArray(raw.competitorMentions).filter((item: any) => String(item?.competitorName || "").trim() && String(item?.context || "").trim()).map((item: any) => ({ competitorName: String(item.competitorName).trim(), context: String(item.context).trim(), threatLevel: ["high", "medium", "low"].includes(item.threatLevel) ? item.threatLevel : "low" })),
    timeSignals: safeArray(raw.timeSignals).filter((item: any) => ["deadline", "budget_cycle", "trigger_event"].includes(item?.type) && String(item?.description || "").trim()).map((item: any) => ({ type: item.type, description: String(item.description).trim(), date: item.date == null || !String(item.date).trim() ? null : String(item.date).trim() })),
    threeWhyUpdates: { whyChange: typeof raw.threeWhyUpdates?.whyChange === "string" && raw.threeWhyUpdates.whyChange.trim() ? raw.threeWhyUpdates.whyChange.trim() : null, whyNow: typeof raw.threeWhyUpdates?.whyNow === "string" && raw.threeWhyUpdates.whyNow.trim() ? raw.threeWhyUpdates.whyNow.trim() : null, whyUs: typeof raw.threeWhyUpdates?.whyUs === "string" && raw.threeWhyUpdates.whyUs.trim() ? raw.threeWhyUpdates.whyUs.trim() : null },
    winFactorAlerts: safeArray(raw.winFactorAlerts).filter((item: any) => ["Pain", "Power", "Champion", "Value", "Control"].includes(item?.factor) && String(item?.alert || "").trim()).map((item: any) => ({ factor: item.factor, alert: String(item.alert).trim(), severity: ["critical", "warning", "info"].includes(item.severity) ? item.severity : "info" })),
    nextBestAction: typeof raw.nextBestAction === "string" && raw.nextBestAction.trim() ? raw.nextBestAction.trim() : "数据不足，暂不判断",
  };
}

export function calculateClientDataSufficiency(input: { meetings: number; contacts: number; purchaseSignals: number; accountFields: number; coverage: number }) {
  const points = Math.min(input.meetings, 3) * 12 + Math.min(input.contacts, 4) * 8 + Math.min(input.purchaseSignals, 3) * 14 + Math.min(input.accountFields, 5) * 4 + Math.min(input.coverage, 4) * 3;
  return Math.min(100, points);
}

export function calculateWinFactors(input: { meddpicc: any; threeWhy: any; annualValue: number; contactCount: number }) {
  const score = (value: unknown) => Math.max(0, Math.min(100, Number(value || 0) * 25));
  const whyScores = [input.threeWhy?.whyChangeScore, input.threeWhy?.whyNowScore, input.threeWhy?.whyUsScore].filter((value) => value != null).map((value) => Number(value) * 20);
  const pain = whyScores.length ? Math.round((score(input.meddpicc?.implicatePainScore) + Math.min(...whyScores)) / 2) : score(input.meddpicc?.implicatePainScore);
  const power = score(input.meddpicc?.economicBuyerScore);
  const champion = score(input.meddpicc?.championScore);
  const value = input.annualValue > 0 ? Math.max(25, score(input.meddpicc?.metricsScore)) : score(input.meddpicc?.metricsScore);
  const control = Math.round((score(input.meddpicc?.decisionCriteriaScore) + score(input.meddpicc?.decisionProcessScore) + score(input.meddpicc?.paperProcessScore)) / 3);
  const factors = { Pain: pain, Power: power, Champion: champion, Value: value, Control: control };
  const weakest = (Object.entries(factors).sort((a, b) => a[1] - b[1])[0] || ["Pain", 0]) as [keyof typeof factors, number];
  return { factors, weakest: { factor: weakest[0], score: weakest[1] }, evidence: { annualValue: input.annualValue, contactCount: input.contactCount } };
}
