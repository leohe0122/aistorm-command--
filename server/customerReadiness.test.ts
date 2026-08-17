import { describe, expect, it } from "vitest";
import { evaluateCustomerReadiness } from "../shared/customerReadiness";

const signals = [
  { id: 1, signalType: "intent_subject" as const, subjectName: "王敏", occurredAt: new Date("2026-08-10T00:00:00.000Z"), statement: "我们正在评估替换现有终端检测平台。", sourceType: "meeting" },
  { id: 2, signalType: "decision_chain" as const, subjectName: "李总", subjectContactId: 2, occurredAt: new Date("2026-08-11T00:00:00.000Z"), statement: "李总已参与技术选型讨论并影响预算审批。", sourceType: "customer_email" },
  { id: 3, signalType: "trigger_event" as const, subjectName: "安全合规截止日", occurredAt: new Date("2026-08-12T00:00:00.000Z"), statement: "监管检查要求在本季度完成终端检测能力整改。", sourceType: "intelligence" },
];

describe("evaluateCustomerReadiness", () => {
  it("不会把销售主观兴趣、拜访次数或联系人数量当作开商机证据", () => {
    const result = evaluateCustomerReadiness({
      stage: "找人",
      contacts: [{ id: 1, name: "张总", buyingRole: "Champion", relationship: "Champion" }],
      signals: [],
    });
    expect(result.canApplyForOpportunity).toBe(false);
    expect(result.blockers.map(item => item.id)).toEqual(["intent_subject", "decision_chain", "trigger_event"]);
  });

  it("意向主体、已触达决策链与触发事件三个客户事实齐备时才允许申请开商机", () => {
    const result = evaluateCustomerReadiness({
      stage: "找人",
      contacts: [
        { id: 1, name: "王敏", buyingRole: "用户影响者", relationship: "已接触" },
        { id: 2, name: "李总", buyingRole: "经济决策人", relationship: "已接触" },
      ],
      signals,
    });
    expect(result.canApplyForOpportunity).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });

  it("决策链信号未对应至有影响力的关键人时不得放行", () => {
    const result = evaluateCustomerReadiness({
      stage: "找人",
      contacts: [{ id: 1, name: "王敏", buyingRole: "未知", relationship: "已接触" }],
      signals,
    });
    expect(result.canApplyForOpportunity).toBe(false);
    expect(result.blockers.map(item => item.id)).toContain("decision_chain");
  });

  it("决策链姓名即使相同，未关联关键人 ID 也不能作为门控事实", () => {
    const result = evaluateCustomerReadiness({
      stage: "找人",
      contacts: [{ id: 2, name: "李总", buyingRole: "经济决策人", relationship: "已接触" }],
      signals: signals.map(signal => signal.id === 2 ? { ...signal, subjectContactId: null } : signal),
    });
    expect(result.canApplyForOpportunity).toBe(false);
    expect(result.blockers.map(item => item.id)).toContain("decision_chain");
  });
});
