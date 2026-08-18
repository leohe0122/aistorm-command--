import { describe, expect, it } from "vitest";
import { buildRecommendationLlmPrompt } from "./adCommandLLM";

describe("AD 指挥建议 LLM 提示词", () => {
  it("只传递已入库事实，并明确禁止模型编造", () => {
    const prompt = buildRecommendationLlmPrompt({
      clientId: 1, opportunityId: null, kind: "today_action", urgency: "立即处理", title: "恢复客户对话",
      aiConclusion: "客户已 42 天无有效对话", facts: [{ label: "最后有效对话", value: "42 天前" }],
      methodology: "0→1", suggestedAction: "安排接触", assignedRole: "AD", fingerprint: "test",
    }, {
      clientName: "客户A", stage: "定痛", stageDays: 32, daysSinceVisit: 42,
      championScore: 1, economicBuyerScore: 0, painScore: 2, decisionCriteriaScore: 0,
      signalCount: 1, samName: "SAM甲", opportunityName: null, opportunityStage: null,
      opportunityStagnantDays: null, weakestDimension: null, weakestScore: null,
    });
    expect(prompt).toContain("只能引用下列已入库事实");
    expect(prompt).toContain("客户已 42 天无有效对话");
    expect(prompt).toContain("Champion：1/4");
  });
});
