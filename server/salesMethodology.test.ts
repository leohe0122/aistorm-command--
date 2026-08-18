import { describe, expect, it } from "vitest";
import { SALES_METHODOLOGY_SYSTEM_PROMPT, buildAccountMapDiagnosticLayer, buildDealMapDiagnosticLayer } from "./salesMethodology";

describe("Command 2.0 sales methodology", () => {
  it("以 Win 公式、事实约束和 Account/Deal Map 区分作为统一基础", () => {
    expect(SALES_METHODOLOGY_SYSTEM_PROMPT).toContain("Win = Pain × Power × Champion × Value × Control");
    expect(SALES_METHODOLOGY_SYSTEM_PROMPT).toContain("数据不足，暂不判断");
    expect(SALES_METHODOLOGY_SYSTEM_PROMPT).toContain("Account Map");
    expect(SALES_METHODOLOGY_SYSTEM_PROMPT).toContain("Deal Map");
  });

  it("缺失的 Account Map 与 Deal Map 字段明确保持数据不足", () => {
    expect(buildAccountMapDiagnosticLayer({})).toContain("数据不足");
    expect(buildDealMapDiagnosticLayer({})).toContain("技术价值尚未翻译成商业价值");
    expect(buildDealMapDiagnosticLayer({ goNoGoScore: 8 })).toContain("No-Go，建议停止重资源投入");
  });
});
