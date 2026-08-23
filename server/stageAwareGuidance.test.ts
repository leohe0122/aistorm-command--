import { describe, expect, it } from "vitest";
import { buildStageAwareGuidancePromptSuffix } from "./aiNativeGuidance";

describe("stage-aware opportunity guidance context", () => {
  it("forces the first missing stage gate before Win-factor questions", () => {
    const suffix = buildStageAwareGuidancePromptSuffix(
      "商务谈判",
      [
        { label: "P 采购流程", question: "合同走哪个部门审批？" },
        { label: "E 最终签字人确认", question: "最终签字人最近说了什么？" },
      ],
      ["Susanna", "Marcos Chow", "Felix"],
    );

    expect(suffix).toContain("按顺序处理第一项");
    expect(suffix).toContain("1. P 采购流程");
    expect(suffix).toContain("全部满足后才可按 Win 因子排序");
    expect(suffix).toContain("Susanna、Marcos Chow、Felix");
    expect(suffix).toContain("必须点名其中最相关的人");
  });

  it("requires a concrete event when no contact name is available", () => {
    const suffix = buildStageAwareGuidancePromptSuffix("技术验证", [], []);

    expect(suffix).toContain("门控已全部满足");
    expect(suffix).toContain("问题必须指向具体事件或决策节点");
    expect(suffix).toContain("不能泛化问‘谁’");
    expect(suffix).toContain("不能要求 SAM 重复已经回答的内容");
  });
});
