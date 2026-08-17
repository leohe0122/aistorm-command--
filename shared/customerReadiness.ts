export type CustomerStage = "建图" | "进门" | "定痛" | "找人" | "进入商机";

export type ReadinessContact = {
  id: number;
  name: string;
  buyingRole?: string | null;
  relationship?: string | null;
};

export type PurchaseSignalType = "intent_subject" | "decision_chain" | "trigger_event";

export type PurchaseSignal = {
  id: number;
  signalType: PurchaseSignalType;
  subjectName: string;
  occurredAt: Date | string;
  statement: string;
  sourceType: string;
  sourceReference?: string | null;
};

export type GateCheck = {
  id: PurchaseSignalType;
  label: string;
  prompt: string;
  passed: boolean;
  evidence: string;
  objective: string;
  signal?: PurchaseSignal;
};

export type StandardAction = GateCheck & {
  role: "SAM" | "AD";
  action: string;
};

export type CustomerReadiness = {
  stage: CustomerStage;
  checks: GateCheck[];
  standardActions: StandardAction[];
  canApplyForOpportunity: boolean;
  blockers: GateCheck[];
  signals: PurchaseSignal[];
};

function describeSignal(signal: PurchaseSignal) {
  const date = new Date(signal.occurredAt).toLocaleDateString("zh-CN", { month: "long", day: "numeric" });
  return `${signal.subjectName} · ${date} · ${signal.statement}`;
}

function latestSignal(signals: PurchaseSignal[], signalType: PurchaseSignalType) {
  return signals
    .filter(signal => signal.signalType === signalType && Boolean(signal.statement?.trim()) && Boolean(signal.subjectName?.trim()))
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())[0];
}

export function evaluateCustomerReadiness(input: {
  stage: CustomerStage;
  contacts: ReadinessContact[];
  signals: PurchaseSignal[];
}): CustomerReadiness {
  const { stage, contacts, signals } = input;
  const intentSignal = latestSignal(signals, "intent_subject");
  const decisionSignal = latestSignal(signals, "decision_chain");
  const triggerSignal = latestSignal(signals, "trigger_event");
  const decisionContact = decisionSignal && contacts.find(contact => contact.name === decisionSignal.subjectName);
  const decisionRoleValid = Boolean(decisionContact && ["经济决策人", "技术决策人", "用户影响者"].includes(decisionContact.buyingRole || ""));

  const checks: GateCheck[] = [
    {
      id: "intent_subject",
      label: "意向主体已出现",
      prompt: "哪一位客户侧人员明确表达过“需要解决 X 问题”或“正在评估此类方案”？",
      passed: Boolean(intentSignal),
      evidence: intentSignal ? describeSignal(intentSignal) : "尚未记录客户侧人员的明确需求或评估原话。",
      objective: "必须记录客户侧人员、发生时间、客户原话或明确的评估表述及其事实来源。",
      signal: intentSignal,
    },
    {
      id: "decision_chain",
      label: "决策链已触达",
      prompt: "已接触的人里，哪一位对预算、技术选择或业务采购有实质影响力？",
      passed: Boolean(decisionSignal && decisionRoleValid),
      evidence: !decisionSignal
        ? "尚未记录已接触的决策链人员事实。"
        : decisionRoleValid
          ? describeSignal(decisionSignal)
          : `${describeSignal(decisionSignal)}；该人员尚未在关键人图谱中标注为经济决策人、技术决策人或用户影响者。`,
      objective: "必须指向已入库关键人图谱中具有预算影响力、技术决策权或用户影响力的客户人员，并记录接触事实。",
      signal: decisionSignal,
    },
    {
      id: "trigger_event",
      label: "明确触发事件存在",
      prompt: "是什么事件让客户必须现在行动：合规截止日、安全事件、业务扩张、预算周期或高层指令？",
      passed: Boolean(triggerSignal),
      evidence: triggerSignal ? describeSignal(triggerSignal) : "尚未记录客户必须行动的外部或内部触发事件。",
      objective: "必须记录触发事件、发生时间、客户或公开事实来源；“客户感兴趣”不是触发事件。",
      signal: triggerSignal,
    },
  ];

  const actionMap: Record<PurchaseSignalType, { role: "SAM" | "AD"; action: string }> = {
    intent_subject: { role: "SAM", action: "在客户对话后录入提出需求或评估意向的客户人员、原话、日期和来源。" },
    decision_chain: { role: "SAM", action: "在关键人图谱确认对方的预算/技术/用户影响角色，并录入与其直接接触的事实。" },
    trigger_event: { role: "AD", action: "确认客户为什么必须现在行动，并录入合规、事件、预算或管理指令的事实来源。" },
  };
  const standardActions = checks.map(check => ({ ...check, ...actionMap[check.id] }));

  return {
    stage,
    checks,
    standardActions,
    canApplyForOpportunity: checks.every(check => check.passed),
    blockers: checks.filter(check => !check.passed),
    signals,
  };
}
