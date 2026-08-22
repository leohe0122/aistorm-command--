import { describe, expect, it } from "vitest";
import { classifyExplicitOpportunityFact } from "../shared/aiAnswerFacts";

describe("AI 主动引导明确商机事实分类", () => {
  const uncovered = ["M", "E", "D1", "D2", "P", "I", "C1", "C2"] as const;

  it("将最终签字人与权力关系识别为 E", () => {
    const result = classifyExplicitOpportunityFact(
      "Susanna是最终签字审批人，Marcos答应就没有问题，但Felix作为CISO不太听Marcos的话。",
      [...uncovered],
    );
    expect(result?.dim).toBe("E");
    expect(result?.nextQuestion).not.toContain("最终签字");
    expect(result?.nextQuestion).toContain("标准");
  });

  it("将替换美资产品与倾向我方识别为 C2", () => {
    const result = classifyExplicitOpportunityFact(
      "他们需要替换美资产品，而我们是中国终端安全排名靠前的公司，所以他们倾向我们。",
      [...uncovered],
    );
    expect(result?.dim).toBe("C2");
    expect(result?.nextQuestion).toContain("量化");
  });

  it("将明确预算金额识别为 M，并继续询问采购审批", () => {
    const result = classifyExplicitOpportunityFact("预算大概250万人民币左右", [...uncovered]);
    expect(result?.dim).toBe("M");
    expect(result?.nextQuestion).toContain("合同");
  });

  it("不把没有事实的愿望识别为候选", () => {
    expect(classifyExplicitOpportunityFact("我希望客户尽快签单", [...uncovered])).toBeNull();
  });
});
