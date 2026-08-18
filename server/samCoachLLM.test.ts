import { describe, expect, it } from "vitest";
import { buildSamCoachPrompt } from "./samCoachLLM";

describe("SAM 教练 LLM 提示词", () => {
  it("只包含实际客户事实并要求数据不足时不判断", () => {
    const prompt = buildSamCoachPrompt("Vivian", [{ clientName: "客户A", stage: "定痛", lastMeetingDays: 35, championScore: 1, activeOpportunityCount: 0 }]);
    expect(prompt).toContain("客户A");
    expect(prompt).toContain("不得猜测个人能力");
    expect(prompt).toContain("数据不足，暂不判断");
  });
});
