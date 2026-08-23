/**
 * AI 原生交互的共享事实契约。
 * AI 只提出问题、提取明确信号和解释缺口；所有业务写入须由 SAM 确认。
 */

export const AI_NATIVE_GUIDANCE_VERSION = "ai-native-guidance-v1";

export const MEDDPICC_CODES = ["M", "E", "D1", "D2", "P", "I", "C1", "C2"] as const;
export type MeddpiccCode = (typeof MEDDPICC_CODES)[number];

export const MEDDPICC_FIELD_MAP: Record<MeddpiccCode, { score: string; notes: string }> = {
  M: { score: "metricsScore", notes: "metricsNotes" },
  E: { score: "economicBuyerScore", notes: "economicBuyerNotes" },
  D1: { score: "decisionCriteriaScore", notes: "decisionCriteriaNotes" },
  D2: { score: "decisionProcessScore", notes: "decisionProcessNotes" },
  P: { score: "paperProcessScore", notes: "paperProcessNotes" },
  I: { score: "implicatePainScore", notes: "implicatePainNotes" },
  C1: { score: "championScore", notes: "championNotes" },
  C2: { score: "competitionScore", notes: "competitionNotes" },
};

export const STAGE_REQUIREMENTS = {
  "需求挖掘": [
    { key: "I", label: "I 痛点牵连", question: "这个问题影响了哪个部门的哪位负责人？他上次提到这个问题时说了什么？" },
    { key: "M", label: "M 可量化价值", question: "如果这个问题不解决，客户每年大概损失多少？请记录他们的数字，不是我们的估算。" },
    { key: "C1", label: "C1 潜在 Champion", question: "客户内部谁对这个问题最有感觉、最希望解决？他有没有主动找过你？" },
  ],
  "技术验证": [
    { key: "D1", label: "D1 决策标准", question: "客户评估技术方案的标准是什么？谁定的这个标准？" },
    { key: "C1", label: "C1 Champion", question: "谁在客户内部真正推动这个项目？他的个人动机和具体推动行为是什么？" },
    { key: "gate8CompDefensible", label: "竞争初步态势", question: "客户还在看哪些其他方案？我们和他们相比，客户是怎么说的？" },
  ],
  "方案提案": [
    { key: "E", label: "E 经济决策人", question: "最终谁签字？他关心的是成本、风险还是合规？你见过他吗？" },
    { key: "D2", label: "D2 决策流程", question: "他们内部怎么做决定？需要几轮审批？谁可能一票否决？" },
    { key: "M", label: "M 可量化价值", question: "ROI 的数字是否已经准备好？客户的 CFO 或财务会如何看待这个投入？" },
    { key: "C1", label: "C1 Champion 可靠性", question: "你的内部支持者有没有在高层面前替你说过话？说了什么？" },
  ],
  "商务谈判": [
    { key: "P", label: "P 采购流程", question: "合同走哪个部门审批？法务和采购的关注点是什么？预计多久可以完成？" },
    { key: "E", label: "E 最终签字人确认", question: "最终签字人对这个项目的立场，你最近一次接触是什么时候？他说了什么或做了什么？" },
    { key: "gate8CompDefensible", label: "竞争可防御性", question: "竞品目前的状态是什么？他们有没有提出你无法反驳的论点？" },
    { key: "C1", label: "C1 Champion 行动", question: "你的内部支持者上次为推进这个项目具体做了什么行动？结果如何？" },
  ],
} as const;

export function buildStageAwareGuidancePromptSuffix(
  stage: string,
  missingGates: Array<{ label: string; question: string }>,
  contactNames: string[],
): string {
  const gateSection = missingGates.length
    ? `当前阶段“${stage}”尚未满足的门控（按顺序处理第一项）：\n${missingGates.map((gate, index) => `${index + 1}. ${gate.label}：${gate.question}`).join("\n")}\n\n规则：必须围绕第一项未满足门控提问；全部满足后才可按 Win 因子排序。`
    : `当前阶段“${stage}”的门控已全部满足，按 Win 因子最弱维度排序提问。`;
  const contactSection = contactNames.length
    ? `已知客户关键人：${contactNames.join("、")}。提问时必须点名其中最相关的人，禁止泛化问“谁”。`
    : "当前没有可用的关键人姓名；问题必须指向具体事件或决策节点，不能泛化问‘谁’。";
  return `\n\n${gateSection}\n${contactSection}\n\n问题质量要求：\n- 必须是 SAM 能用一段话直接回答的事实性问题\n- 必须包含具体人名或具体事件\n- 必须承接本轮临时问答，不能要求 SAM 重复已经回答的内容\n- 禁止问“你计划做什么”或“你打算怎样”，只问“他说了什么”或“发生了什么”\n- 禁止出现 MEDDPICC、Win 公式、Champion 等方法论术语`;
}

export type FullMeetingSignals = {
  meetingSummary: string;
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
    meetingSummary: { type: "string" },
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
  required: ["meetingSummary", "meddpiccUpdates", "contactDiscoveries", "competitorMentions", "timeSignals", "threeWhyUpdates", "winFactorAlerts", "nextBestAction"],
} as const;

export function normalizeFullMeetingSignals(value: unknown): FullMeetingSignals {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, any>;
  const safeArray = (input: unknown) => Array.isArray(input) ? input : [];
  return {
    meetingSummary: typeof raw.meetingSummary === "string" && raw.meetingSummary.trim() ? raw.meetingSummary.trim() : "数据不足，暂不判断",
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

export { calculateWinFactors } from "@shared/winFactors";
