export type MeddpiccDimCode = "M" | "E" | "D1" | "D2" | "P" | "I" | "C1" | "C2";

export type GuidanceTopic =
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
  if (/^(没有了|没了|没有更多|没有更多了|暂无更多|暂时没有|尚未涉及|还没有涉及|这些当前都还没有涉及|当前都还没有涉及|不清楚|不知道)$/.test(text)) return true;
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
    if (isGuidanceTopicExhaustionAnswer(answer)) {
      // 仅在本轮对话中暂时跳过已明确“不知道”的门控，避免原题循环。
      // 这绝不改变数据库事实或实际阶段就绪状态；刷新后仍会显示该真实缺口。
      if (askedDim) covered.add(askedDim);
      const exhaustedTurnText = `${question}\n${answer}`;
      if (/(到期|不续签|renew|renewal|截止|deadline|时间节点|触发)/i.test(exhaustedTurnText)) covered.add("gate_trigger");
      continue;
    }
    const answerFact = classifyExplicitOpportunityFact(answer);
    if (answerFact?.dim) covered.add(answerFact.dim);
    if (askedDim) covered.add(askedDim);
    const turnText = `${question}\n${answer}`;
    if (/(竞品|竞争|crowdstrike|奇安信|深信服|sentinelone|替换|其他厂商)/i.test(turnText)) covered.add("gate8CompDefensible");
    if (/(到期|不续签|renew|renewal|截止|deadline|时间节点|触发)/i.test(turnText)) covered.add("gate_trigger");
    if (/(技术.*签字|签字.*技术|poc.*谁|谁.*poc|评估.*谁|谁.*评估)/i.test(turnText)) covered.add("gate_tech_owner");
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
  const budgetEvidence = /(预算|金额|投入|报价|费用|年费|合同额)|\d[\d,.]*\s*(万|亿|千|百万|元|人民币|美元|港币|usd|hkd|rmb)/i.test(text);
  const competitionEvidence = /(替换|美资|国产|倾向我方|倾向我们|竞争|竞品|替代方案|其他厂商|奇安信|深信服|安天|绿盟|启明星辰|360安全|crowdstrike|sentinelone|mcafee|symantec|碳黑|carbonblack|paloalto|趋势科技|trendmicro|cylance|defender)/i.test(text);
  const paperProcessEvidence = /(合同.{0,12}(审批|法务|采购)|法务.{0,12}(审批|合同|采购)|采购.{0,12}(审批|合同|部门|关注点)|招标)/i.test(text);
  const criteriaEvidence = /(偏好|选型|标准|要求|更看重|必须具备|需要具备|服务|响应|巡检|总结报告|部署|点位)/i.test(text);
  const decisionEvidence = /(最终签字|最终审批|最终决定|决策人|签字审批|决定权|否决权|支持|反对|认同|不同意|不认同|不重要|答应|汇报给)/i.test(text);
  const processEvidence = /(采购阶段|采购流程|审批流程|poc|测试结束|技术验证|合同流程|招标|评审|年内完成|完成部署|到期|不续签|不renew|renewal|renew|续签|合同到期|存量到期|截止日期|deadline|时间节点|倒逼|必须在.*前|年底前|季度末|尽快推进)/i.test(text);
  const dim: MeddpiccDimCode | null = budgetEvidence
    ? "M"
    : competitionEvidence
      ? "C2"
    : decisionEvidence
      ? "E"
        : paperProcessEvidence
          ? "P"
          : criteriaEvidence
            ? "D1"
            : processEvidence
              ? "D2"
              : null;
  if (!dim) return null;
  return { dim, nextQuestion: nextUncoveredMeddpiccQuestion(uncovered, dim) };
}

export function hasValidExtractedFactCandidate(value: any) {
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
