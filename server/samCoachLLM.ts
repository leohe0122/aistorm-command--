export type SamCoachClientFact = {
  clientName: string;
  stage: string;
  lastMeetingDays: number | null;
  championScore: number | null;
  activeOpportunityCount: number;
};

export function buildSamCoachPrompt(samName: string, facts: SamCoachClientFact[]) {
  return `你是一位资深企业软件销售总监（AD），正在针对 SAM ${samName} 的实际经营记录做教练分析。

只使用以下已入库事实，不得猜测个人能力、客户态度或任何未记录信息。事实不足时明确写“数据不足，暂不判断”。

${facts.map((fact) => `- 客户：${fact.clientName}｜阶段：${fact.stage}｜距最近对话：${fact.lastMeetingDays ?? "数据不足"}天｜Champion证据：${fact.championScore ?? "数据不足"}/4｜活跃商机：${fact.activeOpportunityCount}`).join("\n")}

请用 Markdown 输出，包含四部分：
## 事实模式
## 最大能力缺口
## AD 本周辅导动作
## 下次复盘要验证的证据

每部分不超过三条；所有结论必须能回溯到上述事实。`;
}
