import { describe, expect, it } from "vitest";
import { buildGlobalBattleReviewPrompt, getIsoWeekKey } from "./adGlobalReviewLLM";

describe("全局战场 LLM 研判", () => {
  it("仅提供有真实事实的候选客户并限制行动客户 ID", () => {
    const prompt = buildGlobalBattleReviewPrompt([{ clientId: 1, clientName: "HKT", stage: "进入商机", trigger: "阶段停滞", facts: [{ label: "阶段停留", value: "35 天" }] }]);
    expect(prompt).toContain("客户ID=1");
    expect(prompt).toContain("不得编造");
    expect(prompt).toContain("必须来自候选列表");
  });
  it("稳定生成周度去重键", () => {
    expect(getIsoWeekKey(new Date("2026-08-17T00:00:00Z"))).toMatch(/^2026-W\d{2}$/);
  });
});
