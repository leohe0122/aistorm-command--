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

// ── Account 经营题库（0→1，客户关系建立与战略锁定）──────────────────────────
// 方法论来源：华为铁三角客户关系分层、Miller Heiman 战略销售客户地图
// 每道题的目标：让 SAM 把脑子里已经知道的客户组织事实说出来，存入系统
export const ACCOUNT_REQUIREMENTS = {
  "初步接触": [
    {
      key: "contactCoverage",
      label: "关系现状摸底",
      question: "你在这家客户里现在认识谁？他是什么职位、哪个部门？你们是怎么认识的？",
      winFactor: "Power",
    },
    {
      key: "contactInfluence",
      label: "关键人影响力",
      question: "你认识的这个人，他在这个组织里能影响谁？他对采购安全产品这件事有没有说过立场？",
      winFactor: "Power",
    },
    {
      key: "businessPressure",
      label: "客户战略压力",
      question: "这家客户今年或明年最大的业务压力是什么？是监管合规、降本增效、安全事故还是高层指令？",
      winFactor: "Pain",
    },
    {
      key: "competitorPresence",
      label: "竞争对手关系",
      question: "现在这家客户用的安全产品是哪家的？是美资还是国内品牌？他们对这个供应商的评价怎么样？",
      winFactor: "Control",
    },
  ],
  "关系发展": [
    {
      key: "championActivity",
      label: "内部支持者活跃度",
      question: "客户内部有没有人主动联系过你、给你传递过内部信息？上次是什么时候、说了什么？",
      winFactor: "Champion",
    },
    {
      key: "executiveEngagement",
      label: "高层互动记录",
      question: "客户高层（CIO/CISO/VP级别）有没有参与过我们任何活动、会议或演示？他的反应是什么？",
      winFactor: "Power",
    },
    {
      key: "brandPerception",
      label: "品牌认知与态度",
      question: "客户对我们品牌或产品的第一印象是什么？有没有表达过顾虑或认可？原话是什么？",
      winFactor: "Champion",
    },
    {
      key: "blocker",
      label: "内部阻力识别",
      question: "这家客户内部有没有人对引入新安全品牌持保守或抵触态度？他的顾虑是什么？",
      winFactor: "Control",
    },
  ],
  "战略锁定": [
    {
      key: "deliveryFeedback",
      label: "交付后高层反馈",
      question: "第一个项目完成后，客户高层或关键人有没有给出评价？具体说了什么？",
      winFactor: "Champion",
    },
    {
      key: "expansionOpportunity",
      label: "扩张机会窗口",
      question: "客户未来12个月还有哪些安全预算或项目在规划中？谁提过？",
      winFactor: "Value",
    },
    {
      key: "referenceWillingness",
      label: "标杆转化意愿",
      question: "客户有没有表达过愿意参与案例合作或联合推广？谁说过？什么场合？",
      winFactor: "Value",
    },
  ],
} as const;

// ── Deal 作战题库（商机阶段门控，赢单路径）────────────────────────────────────
// 方法论来源：MEDDPICC + Challenger Sale + 华为 LTC 管道管理
// 门控原则：SAM 有回答记录（notes 字段非空）即满足；分数是参考，不是门槛
// 问题原则：只问"客户说了什么/做了什么"，禁止要求 SAM 去做销售动作
export const STAGE_REQUIREMENTS = {
  "需求挖掘": [
    {
      key: "I",
      label: "I 痛点牵连",
      question: "这个安全问题影响了哪个部门的哪位负责人？他上次提到这个问题时原话是什么？",
      followUp: [
        "如果这个问题今年不解决，谁的 KPI 或绩效会直接受影响？他知道这件事吗？",
        "客户有没有发生过具体的安全事故、数据泄露或合规处罚？能描述一下是什么事情吗？",
      ],
    },
    {
      key: "M",
      label: "M 可量化损失",
      question: "如果这个安全问题不解决，客户每年大概会损失多少？请记录他们说的数字，不是我们的估算。",
      followUp: [
        "客户有没有因为这类问题被罚款、审计或被监管约谈过？金额或影响是多少？",
        "这笔安全投入在客户预算里是单独立项还是包含在 IT 总预算里？谁管这笔钱？",
      ],
    },
    {
      key: "C1",
      label: "C1 潜在 Champion",
      question: "客户内部谁对这个安全问题最有感觉、最希望解决？他有没有主动联系过你或给过你内部信息？",
      followUp: [
        "这个人的个人动机是什么？推动这个项目对他的职位或绩效有什么好处？",
        "他在这个组织里能影响谁？他的上级是谁、对这件事什么态度？",
      ],
    },
    {
      key: "gate_trigger",
      label: "触发事件",
      question: "是什么让这个安全项目现在变得紧迫？是监管要求、合同到期、安全事故还是高层指令？",
      followUp: [
        "这个触发事件有没有具体的截止时间？客户内部谁对这个时间节点最在意？",
        "如果没有这个触发事件，这个项目会不会继续往下推进？为什么？",
      ],
    },
  ],
  "技术验证": [
    {
      key: "D1",
      label: "D1 决策标准",
      question: "客户评估这个安全方案的核心标准是什么？谁定的这个标准？是书面写下来的还是口头说的？",
      followUp: [
        "POC 或测试的成功标准是谁定的？测试结果谁说了算？",
        "客户对服务响应速度、本地化部署或数据主权有没有特别要求？谁提出来的？",
      ],
    },
    {
      key: "C1",
      label: "C1 Champion 行动",
      question: "你的内部支持者最近为推动这个技术评估具体做了什么？不是计划，是他已经做了什么？",
      followUp: [
        "他有没有主动帮你争取过测试资源、会议机会或内部支持？结果如何？",
        "他在高层面前提过我们的方案吗？高层的反应是什么？",
      ],
    },
    {
      key: "gate8CompDefensible",
      label: "竞争初步态势",
      question: "客户还在评估哪些其他方案？他们内部对各家方案的看法分别是什么？",
      followUp: [
        "竞品有没有我们目前没有的功能或优势？客户内部有人特别提过吗？",
        "客户有没有倾向于某家？倾向的原因是什么——是技术、价格还是关系？",
      ],
    },
    {
      key: "gate_tech_owner",
      label: "技术决策链确认",
      question: "谁是这次技术评估的主导人？他和最终拍板签字的人是同一个人吗？",
      followUp: [
        "如果技术评估通过，下一步的决策流程是什么？谁还需要点头？",
      ],
    },
  ],
  "方案提案": [
    {
      key: "E",
      label: "E 经济决策人",
      question: "最终谁签字批这笔预算？你见过他吗？他对这个安全项目说过什么或做过什么？",
      followUp: [
        "他最关心的是成本、安全风险还是合规要求？这个判断来自他的原话还是你的推测？",
        "他有没有直接或间接表态过支持或顾虑？是什么场合说的？",
      ],
    },
    {
      key: "D2",
      label: "D2 决策流程",
      question: "从方案通过技术评估到合同签字，内部需要经过几轮审批？谁可能在某个环节说不？",
      followUp: [
        "这个审批流程客户内部有没有明确的时间表？谁在管这个节奏？",
        "有没有委员会或集体决策机制？上次类似项目是怎么走流程的？",
      ],
    },
    {
      key: "M",
      label: "M ROI 验证",
      question: "ROI 的数字你们有没有一起讨论过？客户的财务或 CFO 有没有参与过这笔投入的评估？",
      followUp: [
        "客户有没有对投资回报期或量化收益有具体期望？他们说的是什么数字？",
        "这笔预算是新增还是替换现有供应商？如果是替换，节省的成本怎么算？",
      ],
    },
    {
      key: "C1",
      label: "C1 Champion 可靠性验证",
      question: "你的内部支持者有没有在高层或决策人面前主动替我们说过话？说了什么、场合是什么？",
      followUp: [
        "他最近有没有给你传递过任何竞争对手的动态或内部决策信息？",
        "如果他被调岗或离职，这个项目会怎么样？有没有备选的内部支持者？",
      ],
    },
  ],
  "商务谈判": [
    {
      key: "P",
      label: "P 采购与审批流程",
      question: "合同走哪个部门审批？法务关注什么、采购关注什么？预计多久可以走完这个流程？",
      followUp: [
        "有没有招标要求？需要几家供应商比价？这个要求是谁提出来的？",
        "付款条件客户有没有提过期望？他们通常是预付、分期还是验收后付款？",
      ],
    },
    {
      key: "E",
      label: "E 最终签字人最新确认",
      question: "你最近一次和最终签字人的接触是什么时候？他说了什么或做了什么让你判断他仍然支持？",
      followUp: [
        "他有没有对价格、条款或实施时间表提过任何意见或要求？",
        "他身边有没有人在影响他的判断——比如顾问、副手或其他部门领导？",
      ],
    },
    {
      key: "gate8CompDefensible",
      label: "竞争可防御性",
      question: "竞品目前的状态是什么？他们有没有在这个阶段提出过你目前无法回应的论点或优势？",
      followUp: [
        "客户有没有拿竞品的报价来压价或谈条件？他们给出了什么价格或条款？",
        "竞品在客户内部还有哪些支持者？他们的影响力和我们的 Champion 比怎么样？",
      ],
    },
    {
      key: "C1",
      label: "C1 Champion 临门行动",
      question: "你的内部支持者上周或最近一次为推进签约具体做了什么行动？结果如何？",
      followUp: [
        "他有没有在决策人面前为我们解决过具体异议？是什么异议、他怎么说的？",
        "如果合同这周不签，他会主动去推动吗？他有没有说过打算怎么做？",
      ],
    },
  ],
} as const;

export function buildStageAwareGuidancePromptSuffix(
  stage: string,
  missingGates: Array<{ label: string; question: string; followUp?: readonly string[] }>,
  contactNames: string[],
): string {
  const gateSection = missingGates.length
    ? `当前阶段”${stage}”尚未满足的门控（按顺序处理第一项）：\n${missingGates.map((gate, index) => {
        const followUpHint = gate.followUp?.length
          ? `\n   追问备选（若 SAM 已回答主问题但信息仍不完整时使用其中一条）：${gate.followUp.slice(0, 2).map(q => `\n   • ${q}`).join(“”)}`
          : “”;
        return `${index + 1}. ${gate.label}：${gate.question}${followUpHint}`;
      }).join(“\n”)}\n\n规则：必须围绕第一项未满足门控的主问题提问；若 SAM 已回答主问题则选用追问备选；全部满足后才可按 Win 因子排序。`
    : `当前阶段”${stage}”的门控已全部满足，按 Win 因子最弱维度排序提问。`;
  const contactSection = contactNames.length
    ? `已知客户关键人：${contactNames.join(“、”)}。提问时必须点名其中最相关的人，禁止泛化问”谁”。`
    : “当前没有可用的关键人姓名；问题必须指向具体事件或决策节点，不能泛化问’谁’。”;
  return `\n\n${gateSection}\n${contactSection}\n\n问题质量要求：\n- 必须是 SAM 能用一段话直接回答的事实性问题\n- 必须包含具体人名或具体事件\n- 必须承接本轮临时问答，不能要求 SAM 重复已经回答的内容\n- 禁止问”你计划做什么”或”你打算怎样”，只问”他说了什么”或”发生了什么”\n- 禁止出现 MEDDPICC、Win 公式、Champion 等方法论术语`;
}

// Account 经营引导的 prompt 后缀（0→1 阶段，客户关系地图）
export function buildAccountGuidancePromptSuffix(
  stage: string,
  missingGates: Array<{ label: string; question: string; followUp?: readonly string[] }>,
  contactNames: string[],
): string {
  const gateSection = missingGates.length
    ? `当前客户经营阶段”${stage}”尚未建立的关键认知（按顺序处理第一项）：\n${missingGates.map((gate, index) => {
        const followUpHint = gate.followUp?.length
          ? `\n   追问备选：${gate.followUp.slice(0, 2).map(q => `\n   • ${q}`).join(“”)}`
          : “”;
        return `${index + 1}. ${gate.label}：${gate.question}${followUpHint}`;
      }).join(“\n”)}\n\n规则：围绕第一项未建立认知的主问题提问；SAM 已回答则用追问备选深挖。`
    : `当前阶段”${stage}”的关键客户认知已基本建立，可以讨论扩张机会或标杆转化。`;
  const contactSection = contactNames.length
    ? `已知关键联系人：${contactNames.join(“、”)}。提问时必须点名，不能泛化问”谁”。`
    : “暂无已知关键联系人；请先通过提问帮助 SAM 描述他在这家客户的关系网络。”;
  return `\n\n${gateSection}\n${contactSection}\n\n问题质量要求：\n- 只问 SAM 已经经历或知道的事实，不要求他去做新动作\n- 必须聚焦具体人物的具体行为或表态\n- 禁止出现方法论术语（铁三角、战略客户、关系层级等）`;
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
