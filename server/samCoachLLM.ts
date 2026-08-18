import { SALES_METHODOLOGY_SYSTEM_PROMPT } from "./salesMethodology";

export type SamCoachClientFact = {
  clientName: string;
  stage: string;
  lastMeetingDays: number | null;
  championScore: number | null;
  activeOpportunityCount: number;
  accountFitScore?: number | null;
  executiveCoverageCount?: number | null;
  economicBuyerScore?: number | null;
  threeWhyScore?: { change: number | null; now: number | null; us: number | null } | null;
};

export function buildSamCoachPrompt(samName: string, facts: SamCoachClientFact[]) {
  return `正在针对 SAM ${samName} 的实际经营记录做教练分析。

只使用以下已入库事实，不得猜测个人能力、客户态度或任何未记录信息。**字段未提供不等于未做、未记录不等于能力缺陷**，不得据此生成负面判断。事实不足时明确写“数据不足，暂不判断”。

${facts.map((fact) => `- 客户：${fact.clientName}｜阶段：${fact.stage}｜距最近对话：${fact.lastMeetingDays ?? "数据不足"}天｜Champion证据：${fact.championScore ?? "数据不足"}/4｜EB证据：${fact.economicBuyerScore ?? "数据不足"}/4｜Account战略评分：${fact.accountFitScore ?? "数据不足"}/5｜高层覆盖：${fact.executiveCoverageCount ?? "数据不足"}/4｜3 Why：Change=${fact.threeWhyScore?.change ?? "数据不足"}/Now=${fact.threeWhyScore?.now ?? "数据不足"}/Us=${fact.threeWhyScore?.us ?? "数据不足"}｜活跃商机：${fact.activeOpportunityCount}`).join("\n")}

请用 Markdown 输出，包含五部分：
## Account经营模式诊断
## Deal推进模式诊断
## 最大能力缺口
## AD 本周辅导动作
## 下次复盘要验证的两个问题

每部分不超过三条；所有结论必须能回溯到上述事实。不要评价个人，只陈述跨客户可验证的经营模式。`;
}

export { SALES_METHODOLOGY_SYSTEM_PROMPT };
