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
      [{ name: "Susanna", role: "签字人" }, { name: "Marcos Chow", role: "决策人" }],
    );

    expect(suffix).toContain("按顺序处理第一项");
    expect(suffix).toContain("1. P 采购流程");
    expect(suffix).toContain("全部满足后才可按 Win 因子排序");
    expect(suffix).toContain("项目参与人（已确认）");
    expect(suffix).toContain("Susanna：签字人");
    expect(suffix).toContain("当前第一门控暂无已确认对应角色人物");
    expect(suffix).toContain("仅可围绕具体事件或门控问题提问");
  });

  it("requires a concrete event when no contact name is available", () => {
    const suffix = buildStageAwareGuidancePromptSuffix("技术验证", [], []);

    expect(suffix).toContain("门控已全部满足");
    expect(suffix).toContain("尚未确认项目参与人");
    expect(suffix).toContain("必须包含具体人名或具体事件");
    expect(suffix).toContain("不得从客户级全量关键人中机械轮询");
    expect(suffix).toContain("不能要求 SAM 重复已经回答的内容");
  });
});
