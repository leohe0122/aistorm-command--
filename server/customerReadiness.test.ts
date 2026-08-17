import { describe, expect, it } from "vitest";
import { evaluateCustomerReadiness } from "../shared/customerReadiness";

const meeting = {
  id: 1,
  meetingDate: new Date("2026-08-10T00:00:00.000Z"),
  attendees: "张总, 王敏",
  keyPoints: "客户确认目前终端告警响应缓慢，需在本季度内明确改善路径。",
};

describe("evaluateCustomerReadiness", () => {
  it("不会把销售主观兴趣当作开商机证据", () => {
    const result = evaluateCustomerReadiness({
      stage: "找人",
      contacts: [{ id: 1, name: "张总", buyingRole: "Champion", relationship: "Champion" }],
      meetings: [{ ...meeting, attendees: "王敏" }],
      evidence: { implicatePainNotes: "客户表达兴趣" },
    });
    expect(result.canApplyForOpportunity).toBe(false);
    expect(result.blockers.map(item => item.id)).toContain("decision_path");
    expect(result.blockers.map(item => item.id)).toContain("champion_direct_dialogue");
  });

  it("只有带时间戳的直接对话、痛点与决策路径同时存在时才允许申请开商机", () => {
    const result = evaluateCustomerReadiness({
      stage: "找人",
      contacts: [
        { id: 1, name: "张总", buyingRole: "Champion", relationship: "Champion" },
        { id: 2, name: "李总", buyingRole: "经济决策人", relationship: "已接触" },
        { id: 3, name: "王敏", buyingRole: "技术决策人", relationship: "已接触" },
      ],
      meetings: [meeting],
      evidence: { implicatePainNotes: "客户确认告警响应时间过长影响关键系统稳定运行。" },
    });
    expect(result.canApplyForOpportunity).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });
});
