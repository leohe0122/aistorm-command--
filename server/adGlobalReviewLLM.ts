import { invokeLLM } from "./_core/llm";
import { SALES_METHODOLOGY_SYSTEM_PROMPT } from "./salesMethodology";

export type GlobalCandidateFact = {
  clientId: number;
  clientName: string;
  stage: string;
  trigger: string;
  facts: Array<{ label: string; value: string }>;
};

export type GlobalBattleReview = {
  judgment: string;
  funnelHealth: string;
  winRisk: string;
  teamGap: string;
  actions: Array<{
    clientId: number;
    title: string;
    action: string;
    evidence: string;
  }>;
};

export function getIsoWeekKey(now = new Date()) {
  const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function buildGlobalBattleReviewPrompt(candidates: GlobalCandidateFact[]) {
  return `你是一位企业软件大客户销售总监（AD），正在进行每周全局战场研判。

只允许根据下列已入库事实进行判断。不得编造客户意图、人物关系、预算、竞争信息或推进承诺。候选行动只能选择给出的客户 ID；没有充分事实时不得给出该客户行动。

【可升级的真实事实候选】
${candidates.map((item) => `客户ID=${item.clientId}｜${item.clientName}｜阶段=${item.stage}\n触发=${item.trigger}\n依据=${item.facts.map((fact) => `${fact.label}:${fact.value}`).join("；")}`).join("\n\n")}

请输出 JSON：
{
  "judgment":"≤40字，全局战场第一结论；无充分事实则写数据不足，暂不判断。",
  "funnelHealth":"≤100字，仅分析有事实支撑的阶段堆积或健康信号。",
  "winRisk":"≤100字，仅分析有事实支撑的商机风险。",
  "teamGap":"≤100字，仅分析有事实支撑的团队能力模式。",
  "actions":[
    {"clientId":数字且必须来自候选列表,"title":"≤28字的 AD 本周行动标题","action":"≤50字的 AD 具体动作","evidence":"≤60字的事实依据"}
  ]
}

actions 最多三项，宁缺毋滥。`;
}

export async function generateGlobalBattleReview(candidates: GlobalCandidateFact[]): Promise<GlobalBattleReview | null> {
  if (!candidates.length) return null;
  try {
    const response = await invokeLLM({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT },
        { role: "user", content: buildGlobalBattleReviewPrompt(candidates) },
      ],
      maxCompletionTokens: 1400,
    });
    const parsed = JSON.parse(String(response.choices?.[0]?.message?.content || "{}")) as GlobalBattleReview;
    const validIds = new Set(candidates.map((candidate) => candidate.clientId));
    return { ...parsed, actions: (parsed.actions || []).filter((action) => validIds.has(action.clientId)).slice(0, 3) };
  } catch {
    return null;
  }
}
