export type MeddpiccDimCode = "M" | "E" | "D1" | "D2" | "P" | "I" | "C1" | "C2";

export type GuidanceTopic =
  | "project_participants"
  | "decision_stance"
  | "meeting_time"
  | "implementation_requirements"
  | "service_expectations"
  | "decision_process"
  | "procurement"
  | "commercial_value"
  | "selection_criteria"
  | "business_pain"
  | "champion"
  | "competition"
  | "unknown";

export type GuidanceHistoryTurn = { question: string; answer: string };

export const MEDDPICC_FOLLOW_UP_QUESTIONS: Record<MeddpiccDimCode, string> = {
  M: "客户希望这笔投入最终带来什么可以量化的业务结果？",
  E: "除了已经提到的人物，谁会对这笔商机作出最终签字或否决？",
  D1: "客户选择方案时最看重的具体标准是什么？",
  D2: "你提到的目标推进时间，从现在到正式决策还需要经过哪些评审或确认？",
  P: "预算确认后，合同还需要经过哪些部门审批？",
  I: "如果不推进这笔商机，客户会继续承受什么具体损失？",
  C1: "客户内部谁愿意主动替我们推动，而且已经做过什么？",
  C2: "客户还在比较哪些替代方案，各自被认可或质疑的点是什么？",
};

const TOPIC_BY_DIMENSION: Record<MeddpiccDimCode, GuidanceTopic> = {
  M: "commercial_value",
  E: "decision_stance",
  D1: "selection_criteria",
  D2: "decision_process",
  P: "procurement",
  I: "business_pain",
  C1: "champion",
  C2: "competition",
};

export function inferGuidanceTopic(value: string): GuidanceTopic {
  const text = value.replace(/\s+/g, "").toLowerCase();
  if (/(项目参与人|项目里.*哪些人|谁会参与这个项目|项目相关人)/i.test(text)) return "project_participants";
  if (/(服务|响应|巡检|总结报告|sla|支持质量|售后)/i.test(text)) return "service_expectations";
  if (/(部署|点位|上线|实施|交付|5000点|5000个点)/i.test(text)) return "implementation_requirements";
  if (/(到期|不续签|不renew|norenew|renew|renewal|续签|合同到期|存量到期|倒逼|截止日期|deadline|时间节点|时间压力|触发事件|必须在.*前|年底前|季度末|年内必须|尽快推进|必须尽快)/i.test(text)) return "decision_process";
  if (/(晚餐|dinner|会议日期|上周|本周|什么时候|时间)/i.test(text)) return "meeting_time";
  if (/(最终.{0,6}签字|最终审批|最终决定|谁决定|谁否决|不同意|不认同|分歧|态度|立场|支持|反对)/i.test(text)) return "decision_stance";
  if (/(采购阶段|采购流程|评审|poc|测试结束|技术验证|年内完成|决策流程|时间安排|推进时间)/i.test(text)) return "decision_process";
  if (/(合同|法务|采购部门|审批部门|招标)/i.test(text)) return "procurement";
  if (/(预算|金额|投入|报价|费用|合同额|roi|回报|量化)/i.test(text)) return "commercial_value";
  if (/(标准|选型|必须具备|更看重|要求|需求)/i.test(text)) return "selection_criteria";
  if (/(痛点|损失|风险|影响|不推进)/i.test(text)) return "business_pain";
  if (/(champion|内部支持者|替我们推动|帮我们推动)/i.test(text)) return "champion";
  if (/(替换|美资|国产|倾向我方|倾向我们|竞争|竞品|替代方案|其他厂商|奇安信|深信服|安天|绿盟|启明星辰|360安全|crowdstrike|sentinelone|mcafee|symantec|碳黑|carbonblack|paloalto|趋势科技|trendmicro|cylance|defender)/i.test(text)) return "competition";
  return "unknown";
}

export function isGuidanceTopicExhaustionAnswer(answer: string) {
  const original = answer.trim();
  const text = original.replace(/[\s，。！!；;、]/g, "").toLowerCase();
  const sentences = original.split(/[。！？.!?]+/).map(sentence => sentence.trim()).filter(Boolean);
  const lastSentence = sentences[sentences.length - 1] || original;
  const normalizedLastSentence = lastSentence.replace(/[\s，。！!；;、]/g, "").toLowerCase();
  const exhaustionPattern = /(没有了|没了|没有更多|没有更多了|暂无更多|暂时没有|暂时还没有|尚未涉及|还没有涉及|这些当前都还没有涉及|当前都还没有涉及|不清楚|不知道|目前不清楚|暂时不清楚|还没了解到|还没了解|不太清楚|不确定|没有掌握|尚不清楚|暂无信息|还没开始|尚未开始|没有开始|还没结果|暂无结果|还没反馈|暂无反馈|没有表达|未表达|没有不同意见|没有明确态度|大家一致|意见一致)/;
  // 短回答直接收束；长回答仅考察结尾，以免中途出现“不清楚”时吞掉后续明确事实。
  if (original.length <= 30 && exhaustionPattern.test(text)) return true;
  if (original.length > 30 && exhaustionPattern.test(normalizedLastSentence) && !/(但是|不过|可是|但)/.test(lastSentence)) return true;
  if (/^(?:目前|这次|客户|他们|各方)?(?:都|均)?(?:没有|未)(?:明确)?(?:表达|表态|反馈|意见|不同意见|态度)(?:过|任何)?(?:.*)?$/.test(original)) return true;
  if (/^(?:目前|这次|客户|他们|各方)?(?:意见|态度)?(?:一致|没有分歧)(?:.*)?$/.test(original)) return true;
  if (/(下周|下月|下季度|下次).{0,24}(开会|评审|汇报|报告|会议).{0,24}(还没|尚未|未).{0,16}(发生|开始|举行|完成|结果|结论|反馈)/.test(original)) return true;
  // “不知道 Susanna 的具体立场”一类回答同样意味着当前主题没有可录入的客户事实，
  // 但含有“但是/不过”等转折补充的回答不得被误判为未知。
  return /^(?:我)?(?:不清楚|不知道|不了解|暂不清楚|暂时不清楚)(?:关于|对|谁|哪位|客户|他|她)?[^，。；;！!]{0,28}$/i.test(original)
    && !/(但是|不过|可是|但)/.test(original);
}

export function topicMeddpiccDimension(topic: GuidanceTopic): MeddpiccDimCode | undefined {
  if (topic === "service_expectations" || topic === "implementation_requirements" || topic === "selection_criteria") return "D1";
  if (topic === "decision_stance") return "E";
  if (topic === "decision_process" || topic === "meeting_time") return "D2";
  if (topic === "procurement") return "P";
  if (topic === "commercial_value") return "M";
  if (topic === "business_pain") return "I";
  if (topic === "champion") return "C1";
  if (topic === "competition") return "C2";
  return undefined;
}

export function isQuestionTopicAlreadyCovered(question: string, history: GuidanceHistoryTurn[]) {
  const questionTopic = inferGuidanceTopic(question);
  if (questionTopic === "unknown") return false;
  return history.some(turn => {
    if (inferGuidanceTopic(turn.question) !== questionTopic || !turn.answer.trim()) return false;
    if (isGuidanceTopicExhaustionAnswer(turn.answer)) return true;
    const answerDimension = classifyExplicitOpportunityFact(turn.answer)?.dim;
    const questionDimension = topicMeddpiccDimension(questionTopic);
    if (answerDimension && answerDimension === questionDimension) return true;
    if (questionTopic === "meeting_time" && /(上周|本周|昨天|今天|\d{1,2}[月\-/]\d{1,2}|星期[一二三四五六日天])/i.test(turn.answer)) return true;
    return false;
  });
}

/**
 * 从问题中识别被点名的已知关键人。人物是 AI 追问去重的最小单位：
 * 允许同一门控改问未覆盖的人，但不允许围绕同一人反复问同一主题。
 */
export function getGuidanceQuestionPersonNames(question: string, knownPeople: string[] = []) {
  const normalizedQuestion = question.replace(/\s+/g, " ").toLowerCase();
  return knownPeople
    .map(name => name.trim())
    .filter(Boolean)
    .filter(name => normalizedQuestion.includes(name.toLowerCase()));
}

export function isGuidancePersonTopicAlreadyCovered(
  question: string,
  history: GuidanceHistoryTurn[],
  knownPeople: string[] = [],
) {
  const topic = inferGuidanceTopic(question);
  if (topic === "unknown") return false;
  const askedPeople = getGuidanceQuestionPersonNames(question, knownPeople);
  const historicalTopics = history.map(turn => inferGuidanceTopic(turn.question));

  // 没有具体人物的同主题追问会把已覆盖的事项重新泛化，直接拦截。
  if (!askedPeople.length) return historicalTopics.includes(topic);

  return askedPeople.some(person => history.some(turn =>
    inferGuidanceTopic(turn.question) === topic
    && getGuidanceQuestionPersonNames(turn.question, knownPeople).some(previous => previous.toLowerCase() === person.toLowerCase())
    && Boolean(turn.answer.trim()),
  ));
}

/**
 * 本轮问答只用于选择下一问，绝不代表已经写入或确认的商机事实。
 * 它让阶段门控跳过 SAM 已明确回答的主题，避免同一轮中重复追问。
 */
export function getTransientStageGateCoverage(history: GuidanceHistoryTurn[]) {
  const covered = new Set<string>();
  for (const turn of history) {
    const question = String(turn.question || "").trim();
    const answer = String(turn.answer || "").trim();
    if (!question || !answer) continue;
    const askedDim = topicMeddpiccDimension(inferGuidanceTopic(question));
    const turnText = `${question}\n${answer}`;
    // 客户经营（Account Map）与商机阶段（Deal Map）分别消费这些覆盖标记。
    // 此处仅记录本轮“已经回答过”的题目，绝不把回答视为已写入的客户事实。
    const askedExpansionOpportunity = /(未来.{0,18}(?:12个?月|一年|安全)?(?:还有)?(?:安全)?(?:预算|项目)|(?:预算|项目).{0,18}(?:规划|未来|明年|下一个项目)|明年.*(?:预算|项目)|下一个项目)/i.test(question);
    const askedDeliveryFeedback = /(?:第(?:一个|1)项目|首个项目).{0,24}(?:完成|交付|上线|验收).{0,24}(?:反馈|评价)|(?:交付|上线|验收)后.{0,24}(?:反馈|评价)/i.test(question);
    const askedReferenceWillingness = /(案例|标杆|联合推广|背书|愿意.*合作)/i.test(question);
    const askedChampionActivity = /(主动联系|传递内部|帮我们推|替我们推|内部支持者.*行动)/i.test(question);
    const askedExecutiveEngagement = /(cio|ciso|cto|vp|副总裁|首席|高层).{0,20}(参与.*(?:演示|活动|会议)|互动|反应)/i.test(question);
    const askedBrandPerception = /(品牌.*印象|第一印象|认可.*品牌|品牌.*顾虑)/i.test(question);
    const askedBlocker = /(反对|阻力|抵触|不引入|不认同)/i.test(question);
    const deliveryFeedbackNotAvailable = /(还没|尚未|未).{0,18}(?:评审|反馈|评价|验收|上线|完成)|(?:报告|评审).{0,12}(?:还没|尚未|未).{0,18}(?:提交|反馈|结果|结论)|正在.{0,12}评审/i.test(answer);
    const procurementMentioned = /(招标|采购流程|法务|合同审批|盖章|签约|付款|比价|邀标|询价|单一来源|框架协议|采购委员会)/i.test(turnText);
    if (isGuidanceTopicExhaustionAnswer(answer)) {
      // 仅在本轮对话中暂时跳过已明确“不知道”的门控，避免原题循环。
      // 这绝不改变数据库事实或实际阶段就绪状态；刷新后仍会显示该真实缺口。
      if (askedDim) covered.add(askedDim);
      if (/(到期|不续签|renew|renewal|截止|deadline|时间节点|触发)/i.test(turnText)) covered.add("gate_trigger");
      if (askedExpansionOpportunity) covered.add("expansionOpportunity");
      if (askedDeliveryFeedback && deliveryFeedbackNotAvailable) covered.add("deliveryFeedback");
      if (askedReferenceWillingness) covered.add("referenceWillingness");
      if (askedChampionActivity) covered.add("championActivity");
      if (askedExecutiveEngagement) covered.add("executiveEngagement");
      if (askedBrandPerception) covered.add("brandPerception");
      if (askedBlocker) covered.add("blocker");
      if (procurementMentioned) covered.add("P");
      if (inferGuidanceTopic(question) === "project_participants") covered.add("gate_participants");
      continue;
    }
    const answerFact = classifyExplicitOpportunityFact(answer);
    if (answerFact?.dim) covered.add(answerFact.dim);
    if (askedDim) covered.add(askedDim);
    if (/(竞品|竞争|crowdstrike|奇安信|深信服|sentinelone|替换|其他厂商)/i.test(turnText)) covered.add("gate8CompDefensible");
    if (/(到期|不续签|renew|renewal|截止|deadline|时间节点|触发)/i.test(turnText)) covered.add("gate_trigger");
    if (/(技术.*签字|签字.*技术|poc.*谁|谁.*poc|评估.*谁|谁.*评估)/i.test(turnText)) covered.add("gate_tech_owner");
    if (askedExpansionOpportunity) covered.add("expansionOpportunity");
    if (askedDeliveryFeedback && deliveryFeedbackNotAvailable) covered.add("deliveryFeedback");
    if (askedReferenceWillingness) covered.add("referenceWillingness");
    if (askedChampionActivity) covered.add("championActivity");
    if (askedExecutiveEngagement) covered.add("executiveEngagement");
    if (askedBrandPerception) covered.add("brandPerception");
    if (askedBlocker) covered.add("blocker");
    if (procurementMentioned) covered.add("P");
    if (inferGuidanceTopic(question) === "project_participants") covered.add("gate_participants");
  }
  return covered;
}

export function nextUncoveredMeddpiccQuestion(
  uncovered: MeddpiccDimCode[],
  completed?: MeddpiccDimCode,
  askedQuestions: string[] = [],
) {
  const prioritiesByCompleted: Partial<Record<MeddpiccDimCode, MeddpiccDimCode[]>> = {
    E: ["D1", "C2", "M", "D2", "P", "I", "C1"],
    D1: ["D2", "M", "C2", "P", "I", "C1", "E"],
    C2: ["M", "D1", "D2", "P", "I", "C1", "E"],
    M: ["P", "D2", "C1", "I", "C2", "D1", "E"],
    D2: ["P", "C1", "I", "M", "C2", "D1", "E"],
    P: ["C1", "I", "D2", "M", "C2", "D1", "E"],
  };
  const priority = prioritiesByCompleted[completed || "M"] || ["P", "D2", "C2", "D1", "I", "C1", "E", "M"];
  const askedTopics = new Set(askedQuestions.map(inferGuidanceTopic));
  const available = priority
    .filter(dim => dim !== completed && uncovered.includes(dim))
    .find(dim => !askedTopics.has(TOPIC_BY_DIMENSION[dim]));
  if (available) return MEDDPICC_FOLLOW_UP_QUESTIONS[available];
  const fallback = priority.find(dim => dim !== completed && uncovered.includes(dim));
  return fallback ? MEDDPICC_FOLLOW_UP_QUESTIONS[fallback] : "客户最近有没有给出新的明确动作、承诺或时间安排？";
}

export function classifyExplicitOpportunityFact(answer: string, uncovered: MeddpiccDimCode[] = []) {
  const text = answer.trim();
  // “评审尚未开始”“暂无结果/反馈”等表达说明该事项尚未发生，不能被“测试/评审”等词误写为事实候选。
  const unavailableOutcome = /(?:正式|技术|测试|验收|内部)?(?:评审|测试|验收|反馈|结果|报告).{0,12}(?:还没|尚未|未|没有).{0,10}(?:开始|完成|结果|结论|反馈|提交)|(?:还没|尚未|暂未|没有|暂无).{0,12}(?:开始|结果|结论|反馈|评审|提交)|(?:目前|暂时).{0,6}(?:还)?不清楚/i.test(text);
  if (unavailableOutcome) return null;
  const budgetEvidence = /(预算|金额|投入|报价|费用|年费|合同额)|\d[\d,.]*\s*(万|亿|千|百万|元|人民币|美元|港币|usd|hkd|rmb)/i.test(text);
  const competitionEvidence = /(替换|美资|国产|倾向我方|倾向我们|竞争|竞品|替代方案|其他厂商|奇安信|深信服|安天|绿盟|启明星辰|360安全|crowdstrike|sentinelone|mcafee|symantec|碳黑|carbonblack|paloalto|趋势科技|trendmicro|cylance|defender)/i.test(text);
  const paperProcessEvidence = /(合同.{0,12}(审批|法务|采购|流程|签署)|法务.{0,12}(审批|合同|采购|审核)|采购.{0,12}(审批|合同|部门|关注点|中心|流程|委员会)|采购中心|走流程|流程由|招标|邀标|询价|比价|单一来源|框架协议|年度合同|采购周期|付款条件|合同期限|签约|盖章)/i.test(text);
  const criteriaEvidence = /(偏好|选型|标准|要求|更看重|必须具备|需要具备|服务|响应|巡检|总结报告|部署|点位)/i.test(text);
  const decisionEvidence = /(最终签字|最终审批|最终决定|决策人|签字审批|决定权|否决权|支持|反对|认同|不同意|不认同|不重要|答应|汇报给)/i.test(text);
  const processEvidence = /(采购阶段|采购流程|审批流程|poc|测试结束|技术验证|合同流程|招标|评审|年内完成|完成部署|到期|不续签|不renew|renewal|renew|续签|合同到期|存量到期|截止日期|deadline|时间节点|倒逼|必须在.*前|年底前|季度末|尽快推进)/i.test(text);
  const dim: MeddpiccDimCode | null = budgetEvidence
    ? "M"
    : competitionEvidence
      ? "C2"
    : paperProcessEvidence
      ? "P"
        : decisionEvidence
          ? "E"
          : criteriaEvidence
            ? "D1"
            : processEvidence
              ? "D2"
              : null;
  if (!dim) return null;
  return { dim, nextQuestion: nextUncoveredMeddpiccQuestion(uncovered, dim) };
}

export function hasValidExtractedFactCandidate(value: any) {
  if (value?.candidateTarget === "participants") {
    return Array.isArray(value?.participants) && value.participants.some((person: any) => String(person?.name || "").trim() && ["技术评估", "使用方", "决策人", "评审人", "签字人", "阻力", "无关"].includes(person?.role));
  }
  const evidence = String(value?.evidence || "").trim();
  if (!evidence) return false;
  if (value?.candidateTarget === "purchase_signal") {
    return ["intent_subject", "decision_chain", "executive_validation", "high_level_trigger"].includes(value?.signalType);
  }
  if (value?.candidateTarget === "meddpicc") {
    return ["M", "E", "D1", "D2", "P", "I", "C1", "C2"].includes(value?.meddpiccDim);
  }
  return false;
}

/** 明确“与项目无关”的回答只改变项目参与人范围，绝不生成客户事实候选。 */
export function inferIrrelevantProjectParticipants(answer: string) {
  const names = Array.from(answer.matchAll(/(?:^|[，,；;、\s])([A-Za-z][A-Za-z .'-]{1,70}|[\u4e00-\u9fff]{2,8})(?:与|跟)?(?:本)?项目无关/g))
    .map(match => String(match[1] || "").trim())
    .filter(Boolean);
  return Array.from(new Set(names)).map(name => ({ name, role: "无关" as const }));
}
