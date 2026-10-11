import { describe, expect, it } from "vitest";
import { appearsIn, gradeMeetingSignals, groundingRatio } from "../evals/graders";
import type { FullMeetingSignals } from "./aiNativeGuidance";

const source = "【SAM 记录】\n王建国说现有终端防护明年3月31日合同到期，不打算续签。奇安信上周来做过演示。最终由CIO刘明签字。";

const base: FullMeetingSignals = {
  meetingSummary: "终端防护明年3月到期不续签，CIO 刘明签字。",
  meddpiccUpdates: [{ dim: "E", suggestedScore: 50, evidence: "最终由CIO刘明签字", confidence: "high" }],
  contactDiscoveries: [{ name: "刘明", title: "CIO", buyingRole: "经济决策人", attitude: "未知", evidence: "最终由CIO刘明签字" }],
  competitorMentions: [{ competitorName: "奇安信", context: "上周来做过演示", threatLevel: "medium" }],
  timeSignals: [{ type: "deadline", description: "明年3月31日合同到期", date: "2027-03-31" }],
  threeWhyUpdates: { whyChange: null, whyNow: "合同到期不续签", whyUs: null },
  winFactorAlerts: [],
  nextBestAction: "确认刘明对选型时间表的态度",
};

describe("eval graders", () => {
  it("measures how much of the evidence comes from the source", () => {
    expect(groundingRatio("最终由CIO刘明签字", source)).toBe(1);
    expect(groundingRatio("客户预算充足且非常满意", source)).toBeLessThan(0.5);
    expect(appearsIn("Daniel Tan", "Customer: daniel tan (Head of IT)")).toBe(true);
  });

  it("passes a faithful extraction", () => {
    const checks = gradeMeetingSignals(base, source, { contactsInclude: ["刘明"], competitorsInclude: ["奇安信"], timeSignalTypesInclude: ["deadline"], meddpiccMin: { E: 25 } });
    expect(checks.filter(check => !check.pass)).toEqual([]);
  });

  it("flags invented people, competitors and evidence", () => {
    const fabricated: FullMeetingSignals = {
      ...base,
      contactDiscoveries: [...base.contactDiscoveries, { name: "张三", title: null, buyingRole: "Champion", attitude: "支持", evidence: "张三非常支持我们的方案" }],
      competitorMentions: [{ competitorName: "CrowdStrike", context: "客户在评估", threatLevel: "high" }],
    };
    const failed = gradeMeetingSignals(fabricated, source, {}).filter(check => !check.pass).map(check => check.name);
    expect(failed).toContain("关键人均出自原文");
    expect(failed).toContain("竞品均出自原文");
    expect(failed).toContain("证据可回溯到原文");
  });

  it("enforces case expectations", () => {
    const failed = gradeMeetingSignals(base, source, { expectEmpty: ["competitorMentions"], meddpiccMax: { E: 25 }, whyNull: ["whyNow"], contactsExclude: ["刘明"] })
      .filter(check => !check.pass).map(check => check.name);
    expect(failed).toEqual(["不应列为关键人：刘明", "E 不高于 25", "competitorMentions 应为空", "3 Why whyNow 应为空"]);
  });
});
