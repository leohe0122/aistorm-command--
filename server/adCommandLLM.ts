import { invokeLLM } from "./_core/llm";
import type { GeneratedCommandRecommendation } from "../shared/adCommand";

export type RecommendationLlmContext = {
  clientName: string;
  stage: string;
  stageDays: number | null;
  daysSinceVisit: number | null;
  championScore: number | null;
  economicBuyerScore: number | null;
  painScore: number | null;
  decisionCriteriaScore: number | null;
  signalCount: number;
  samName: string | null;
  opportunityName: string | null;
  opportunityStage: string | null;
  opportunityStagnantDays: number | null;
  weakestDimension: string | null;
  weakestScore: number | null;
};

export type LlmMethodologyOutput = {
  judgment: string;
  adAction: string;
  methodology: string;
};

function scoreToFour(value: number | null) {
  if (value === null || value === undefined) return "数据不足";
  return `${value > 4 ? Math.round(value / 25) : value}/4`;
}

export function buildRecommendationLlmPrompt(
  recommendation: GeneratedCommandRecommendation,
  context: RecommendationLlmContext,
) {
  const opportunitySection = context.opportunityName
    ? `\n商机：${context.opportunityName}\n商机阶段：${context.opportunityStage ?? "数据不足"}\n商机阶段停留：${context.opportunityStagnantDays ?? "数据不足"}天\n最弱 MEDDPICC 维度：${context.weakestDimension ?? "数据不足"} ${scoreToFour(context.weakestScore)}`
    : "";

  return `你是一位有15年经验的企业软件大客户销售总监（AD），正在对具体客户事实进行方法论研判。

你只能引用下列已入库事实，不得补充、猜测或虚构客户意图、人物、竞争或承诺。若事实不足，直接说明“数据不足，暂不判断”。

客户名：${context.clientName}
当前阶段：${context.stage}
阶段停留：${context.stageDays ?? "数据不足"}天
距上次有效对话：${context.daysSinceVisit ?? "数据不足"}天
Champion：${scoreToFour(context.championScore)}
经济决策人：${scoreToFour(context.economicBuyerScore)}
痛点牵连：${scoreToFour(context.painScore)}
决策标准：${scoreToFour(context.decisionCriteriaScore)}
已入库购买信号：${context.signalCount}/3
负责 SAM：${context.samName || "未分配"}${opportunitySection}

规则触发事实：${recommendation.aiConclusion}
规则事实清单：${recommendation.facts.map((fact) => `${fact.label}=${fact.value}`).join("；")}

请输出 JSON，不要 Markdown：
{
  "judgment":"不超过40字。明确当前最大推进障碍及其事实依据；事实不足时固定写数据不足，暂不判断。",
  "adAction":"不超过40字。给 AD 的单一具体动作，不是给 SAM 的动作；事实不足时说明先需补什么事实。",
  "methodology":"不超过24字。使用的销售方法论名称和当前判断角度。"
}`;
}

export async function enrichAdCommandRecommendation(
  recommendation: GeneratedCommandRecommendation,
  context: RecommendationLlmContext,
): Promise<GeneratedCommandRecommendation> {
  try {
    const response = await invokeLLM({
      // 复用系统 AI 模型配置中已验证的快速模型，避免特定供应商不支持目录模型而返回 400。
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "你是严谨的大客户销售总监。只根据输入事实研判，绝不编造。" },
        { role: "user", content: buildRecommendationLlmPrompt(recommendation, context) },
      ],
      maxTokens: 420,
    });
    const raw = String(response.choices?.[0]?.message?.content || "");
    const parsed = JSON.parse(raw) as LlmMethodologyOutput;
    if (!parsed.judgment?.trim() || !parsed.adAction?.trim() || !parsed.methodology?.trim()) return recommendation;
    return {
      ...recommendation,
      aiConclusion: parsed.judgment.trim().slice(0, 80),
      suggestedAction: parsed.adAction.trim().slice(0, 100),
      methodology: parsed.methodology.trim().slice(0, 160),
    };
  } catch {
    // LLM 不可用时保留由真实事实触发的规则建议，不能阻塞 AD 指挥台。
    return recommendation;
  }
}
