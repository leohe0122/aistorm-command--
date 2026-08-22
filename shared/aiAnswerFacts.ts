export type MeddpiccDimCode = "M" | "E" | "D1" | "D2" | "P" | "I" | "C1" | "C2";

export const MEDDPICC_FOLLOW_UP_QUESTIONS: Record<MeddpiccDimCode, string> = {
  M: "客户希望这笔投入最终带来什么可以量化的业务结果？",
  E: "除了已经提到的人物，谁会对这笔商机作出最终签字或否决？",
  D1: "客户选择方案时最看重的具体标准是什么？",
  D2: "从当前阶段到正式决策，还需要经过哪些评审或确认？",
  P: "预算确认后，合同还需要经过哪些部门审批？",
  I: "如果不推进这笔商机，客户会继续承受什么具体损失？",
  C1: "客户内部谁愿意主动替我们推动，而且已经做过什么？",
  C2: "客户还在比较哪些替代方案，各自被认可或质疑的点是什么？",
};

export function nextUncoveredMeddpiccQuestion(uncovered: MeddpiccDimCode[], completed?: MeddpiccDimCode) {
  const prioritiesByCompleted: Partial<Record<MeddpiccDimCode, MeddpiccDimCode[]>> = {
    E: ["D1", "C2", "M", "D2", "P", "I", "C1"],
    D1: ["C2", "M", "D2", "P", "I", "C1", "E"],
    C2: ["M", "D1", "D2", "P", "I", "C1", "E"],
    M: ["P", "D2", "C1", "I", "C2", "D1", "E"],
    D2: ["P", "C1", "I", "M", "C2", "D1", "E"],
    P: ["C1", "I", "D2", "M", "C2", "D1", "E"],
  };
  const priority = prioritiesByCompleted[completed || "M"] || ["P", "D2", "C2", "D1", "I", "C1", "E", "M"];
  const next = priority.find(dim => dim !== completed && uncovered.includes(dim));
  return next ? MEDDPICC_FOLLOW_UP_QUESTIONS[next] : "客户最近有没有给出新的明确动作、承诺或时间安排？";
}

export function classifyExplicitOpportunityFact(answer: string, uncovered: MeddpiccDimCode[] = []) {
  const text = answer.trim();
  const budgetEvidence = /(预算|金额|投入|报价|费用|年费|合同额)|\d[\d,.]*\s*(万|亿|千|百万|元|人民币|美元|港币|usd|hkd|rmb)/i.test(text);
  const competitionEvidence = /(替换|美资|国产|倾向我方|倾向我们|竞争|竞品|替代方案|其他厂商)/i.test(text);
  const criteriaEvidence = /(偏好|选型|标准|要求|更看重|必须具备|需要具备)/i.test(text);
  const decisionEvidence = /(最终签字|最终审批|最终决定|决策人|签字审批|决定权|否决权|支持|反对|认同|不同意|不重要|答应|汇报给)/i.test(text);
  const processEvidence = /(采购阶段|采购流程|审批流程|poc|测试结束|技术验证|合同流程|招标|评审|时间节点)/i.test(text);
  const dim: MeddpiccDimCode | null = budgetEvidence
    ? "M"
    : competitionEvidence
      ? "C2"
      : criteriaEvidence
        ? "D1"
        : decisionEvidence
          ? "E"
          : processEvidence
            ? "D2"
            : null;
  if (!dim) return null;
  return { dim, nextQuestion: nextUncoveredMeddpiccQuestion(uncovered, dim) };
}
