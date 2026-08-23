import { describe, expect, it } from "vitest";
import { classifyExplicitOpportunityFact, hasValidExtractedFactCandidate, inferGuidanceTopic, isGuidanceTopicExhaustionAnswer, isQuestionTopicAlreadyCovered, nextUncoveredMeddpiccQuestion } from "../shared/aiAnswerFacts";

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

  it("将部署规模、服务响应和巡检要求识别为决策标准，并转向采购决策流程", () => {
    const result = classifyExplicitOpportunityFact("5000点部署，出问题要第一时间有人响应，每周至少一次安全巡检。", [...uncovered]);
    expect(result?.dim).toBe("D1");
    expect(result?.nextQuestion).toContain("评审或确认");
    expect(inferGuidanceTopic("客户对于服务质量的期待和要求还有哪些？")).toBe("service_expectations");
  });

  it("将没有更多补充识别为主题收束，而不是新的客户事实", () => {
    expect(isGuidanceTopicExhaustionAnswer("没有了")).toBe(true);
    expect(isGuidanceTopicExhaustionAnswer("这些当前都还没有涉及。")).toBe(true);
    expect(isGuidanceTopicExhaustionAnswer("Felix不认同EDR项目本身")).toBe(false);
  });

  it("不允许在已有服务要求回答后再次询问服务主题", () => {
    const history = [{ question: "客户对于服务质量的期待和要求还有哪些？", answer: "出问题要第一时间有人响应，每周至少一次安全巡检。" }];
    expect(isQuestionTopicAlreadyCovered("客户希望在服务方面有哪些具体的标准或预期？", history)).toBe(true);
    expect(nextUncoveredMeddpiccQuestion([...uncovered], "D1", history.map(turn => turn.question))).toContain("评审或确认");
  });

  it("不允许在已确认人物立场或会议日期后回到同一主题", () => {
    expect(isQuestionTopicAlreadyCovered("Felix 对当前方案的态度和分歧是什么？", [{ question: "谁对当前推进方向表达过明确态度？", answer: "Felix不认同EDR项目本身，认为并不紧迫。" }])).toBe(true);
    expect(isQuestionTopicAlreadyCovered("你能分享更多关于会议的日期或此次接触的具体时间吗？", [{ question: "这次 Dinner 是什么时候确认的信息？", answer: "就是在上周的一次Dinner上确认的信息。" }])).toBe(true);
  });

  it("将商务谈判中的合同审批事实映射为采购流程 P", () => {
    const result = classifyExplicitOpportunityFact("合同需要采购部、法务和财务三方审批，采购尤其关注服务响应条款。", [...uncovered]);
    expect(result?.dim).toBe("P");
  });

  it("保留模型已经产出的完整高置信候选，不再被确定性规则降级覆盖", () => {
    expect(hasValidExtractedFactCandidate({
      candidateTarget: "meddpicc",
      meddpiccDim: "E",
      evidence: "Susanna 是最终签字人。",
      confidence: "high",
    })).toBe(true);
    expect(hasValidExtractedFactCandidate({
      candidateTarget: "meddpicc",
      meddpiccDim: "",
      evidence: "仅有事实文本但没有维度。",
    })).toBe(false);
    expect(hasValidExtractedFactCandidate({
      candidateTarget: "none",
      evidence: "",
    })).toBe(false);
  });
});
