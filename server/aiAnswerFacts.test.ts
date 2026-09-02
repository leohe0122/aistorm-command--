import { describe, expect, it } from "vitest";
import { classifyExplicitOpportunityFact, getTransientStageGateCoverage, hasValidExtractedFactCandidate, inferGuidanceTopic, isGuidancePersonTopicAlreadyCovered, isGuidanceTopicExhaustionAnswer, isQuestionTopicAlreadyCovered, nextUncoveredMeddpiccQuestion } from "../shared/aiAnswerFacts";

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
    expect(isGuidanceTopicExhaustionAnswer("不知道 Susanna 的具体立场")).toBe(true);
    expect(isGuidanceTopicExhaustionAnswer("各方都没有明确表态")).toBe(true);
    expect(isGuidanceTopicExhaustionAnswer("下周五才开评审会，目前还没有结果")).toBe(true);
    expect(isGuidanceTopicExhaustionAnswer("不知道 Susanna 的具体立场，但是 Marcos 说她关心风险")).toBe(false);
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
    expect(classifyExplicitOpportunityFact("总经理最终签字，之后交采购中心走合同流程。", [...uncovered])?.dim).toBe("P");
    expect(classifyExplicitOpportunityFact("采购委员会将先邀标和比价，完成后才安排合同盖章。", [...uncovered])?.dim).toBe("P");
  });

  it("将存量到期和不续签识别为决策流程时间触发事实", () => {
    expect(inferGuidanceTopic("现有产品明年到期，客户明确表示不续签，必须尽快推进替换。"))
      .toBe("decision_process");
    expect(classifyExplicitOpportunityFact("现有许可明年到期，年底前必须完成内部决定。", [...uncovered])?.dim)
      .toBe("D2");
  });

  it("将主流安全厂商名称识别为 C2，并阻止竞争主题重复追问", () => {
    expect(classifyExplicitOpportunityFact("CrowdStrike 明年到期且客户不续签，奇安信也在参与竞争。", [...uncovered])?.dim)
      .toBe("C2");
    expect(isQuestionTopicAlreadyCovered(
      "客户还在比较哪些竞品，各自被认可或质疑的点是什么？",
      [{ question: "当前有哪些厂商参与竞争？", answer: "CrowdStrike 明年到期，奇安信也在竞争。" }],
    )).toBe(true);
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

  it("将未确认的最终签字人回答仅作为本轮 E 门控覆盖，推进到下一题而不写入事实", () => {
    const covered = getTransientStageGateCoverage([
      {
        question: "最终谁签字批这笔预算？你见过他吗？他对这个安全项目说过什么或做过什么？",
        answer: "Susanna 是最终签字人，我见过她，她与我们的创始人关系很好。",
      },
    ]);
    expect(covered.has("E")).toBe(true);
    expect(covered.has("D2")).toBe(false);
    expect(covered.has("M")).toBe(false);
    expect(covered.has("C1")).toBe(false);
  });

  it("将明确不知道最终签字人仅作为本轮 E 门控收束，避免重复主问题", () => {
    const covered = getTransientStageGateCoverage([
      {
        question: "最终谁签字批这笔预算？你见过他吗？他对这个安全项目说过什么或做过什么？",
        answer: "不知道 Susanna 的具体立场",
      },
    ]);
    expect(covered.has("E")).toBe(true);
    expect(covered.has("M")).toBe(false);
  });

  it("将已回答的客户未来预算规划暂时覆盖为扩张机会，避免同一问题换词重复", () => {
    const covered = getTransientStageGateCoverage([
      {
        question: "谁在近期提到未来 12 个月内存在安全预算或项目规划？",
        answer: "Marcos 提到过。",
      },
    ]);
    expect(covered.has("expansionOpportunity")).toBe(true);
    expect(covered.has("deliveryFeedback")).toBe(false);
  });

  it("将尚未产生的交付反馈仅在本轮暂时收束，避免追问未来评审或报告结果", () => {
    const covered = getTransientStageGateCoverage([
      {
        question: "Felix 在第一个项目完成后有没有给出反馈？",
        answer: "项目还在评审，报告尚未提交，暂时还没有反馈。",
      },
    ]);
    expect(covered.has("deliveryFeedback")).toBe(true);
    expect(covered.has("E")).toBe(false);
  });

  it("临时覆盖客户经营的标杆、支持者、高层、品牌和阻力题目，并识别采购自然表达", () => {
    const covered = getTransientStageGateCoverage([
      { question: "客户愿意参与案例标杆或联合推广吗？", answer: "暂时不知道。" },
      { question: "内部支持者最近有没有主动联系或传递内部信息？", answer: "暂无信息。" },
      { question: "CISO 或 VP 是否参与过演示、会议或活动？", answer: "还没了解到。" },
      { question: "客户对我们品牌的第一印象或顾虑是什么？", answer: "不太清楚。" },
      { question: "客户内部是否存在反对或阻力？", answer: "没有掌握。" },
      { question: "采购流程有哪些审批与关注点？", answer: "采购委员会先邀标比价，再安排合同盖章与付款。" },
    ]);
    expect(covered).toEqual(expect.objectContaining(new Set([
      "referenceWillingness", "championActivity", "executiveEngagement", "brandPerception", "blocker", "P",
    ])));
  });

  it("将短未知表达收束为无事实，但不吞掉较长的实质描述", () => {
    expect(isGuidanceTopicExhaustionAnswer("还没了解到")).toBe(true);
    expect(isGuidanceTopicExhaustionAnswer("我不知道最终签字人，但 Marcos 明确说预算已经通过并交采购中心走流程了")).toBe(false);
  });

  it("阻止同一关键人被重复询问同一立场主题，但允许改问尚未覆盖的人", () => {
    const people = ["Ronald TK Lau", "Marcos Chow", "Felix"];
    const history = [
      { question: "Ronald TK Lau 在关于 EDR 方案的讨论中，是否提过自己的观点或支持情况？", answer: "尽管和我们关系很好，但需要测试结果说话。" },
      { question: "Marcos Chow 是否提到在会议中对 EDR 方案的看法或态度？", answer: "非常倾向于我们。" },
      { question: "Felix 在 EDR 方案的讨论中，有没有表达出他对此方案的支持或反对意见？", answer: "明确反对。" },
    ];
    expect(isGuidancePersonTopicAlreadyCovered("Ronald TK Lau 在关于 EDR 方案的讨论中，是否有进一步的支持或反对言论？", history, people)).toBe(true);
    expect(isGuidancePersonTopicAlreadyCovered("另一位尚未覆盖的技术负责人，对 EDR 的态度是什么？", history, people)).toBe(true);
  });
});
