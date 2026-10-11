// 拜访信号提取：把一次拜访的原始记录转成可确认的结构化事实。
// 作为独立函数存在，供同步/异步两个接口以及 AI 评测（evals/）共用同一套提示词与解析逻辑。

import { getLLMTextContent, invokeLLM, type InvokeParams } from "../_core/llm";
import { FULL_MEETING_SIGNALS_RESPONSE_SCHEMA, normalizeFullMeetingSignals, type FullMeetingSignals } from "../aiNativeGuidance";
import { SALES_METHODOLOGY_SYSTEM_PROMPT } from "../salesMethodology";

export type MeetingSignalsInput = {
  clientName: string;
  meetingDate: string;
  visitType?: string;
  attendees?: string;
  keyPoints: string;
  transcriptText?: string;
  contactType?: string;
  initiatedBy?: string;
};

export type MeetingSignalsErrorCode = "timeout" | "provider" | "empty" | "invalid_json";

export class MeetingSignalsError extends Error {
  constructor(public readonly code: MeetingSignalsErrorCode, message: string) {
    super(message);
    this.name = "MeetingSignalsError";
  }
}

/** 拜访原文在提示词中的呈现方式；评测的“事实可回溯”检查也以此为原文。 */
export function meetingSourceText(input: Pick<MeetingSignalsInput, "keyPoints" | "transcriptText">): string {
  return input.transcriptText
    ? `【会议原文】\n${input.transcriptText}\n\n【SAM 补充】\n${input.keyPoints}`
    : `【SAM 记录】\n${input.keyPoints}`;
}

export function buildMeetingSignalsPrompt(input: MeetingSignalsInput, accountContext: string): string {
  return `你现在是 SAM 的拜访后作战引导助手。SAM 只负责如实记录发生了什么；你必须从以下记录中一次性提取可验证事实，供 SAM 确认。

客户：${input.clientName}
日期：${input.meetingDate}
拜访类型：${input.visitType || "拜访"}
参会人：${input.attendees || "数据不足"}
接触方式：${input.contactType || "数据不足"}
发起方：${input.initiatedBy || "数据不足"}

${meetingSourceText(input)}

${accountContext}

【严格规则】
1. 只提取记录中明确出现或可逐字定位的客户事实；禁止猜测客户意图、预算、人物立场或竞争态势。
2. 没有明确证据的数组返回空数组，字段无法确认则返回 null；不要为了填满字段而创作。
3. suggestedScore 只能是 0/25/50/75/100，且 evidence 必须包含原话或可回溯表述。
4. 关键人角色只在记录明确说明其决策职责或行为时填写；否则为"未知"。
5. nextBestAction 必须是 SAM 下一次要验证的一件事，不能是产品推销动作。
6. meetingSummary 用不超过120字概括本次已确认事实与未确认边界。
7. 按给定 JSON Schema 返回，JSON 外不得输出任何文字。`;
}

function extractJSON(raw: string): string {
  const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  return match ? match[1].trim() : raw.trim();
}

export async function extractMeetingSignals(
  input: MeetingSignalsInput,
  options: { accountContext?: string; tier?: InvokeParams["tier"]; timeoutMs?: number } = {},
): Promise<FullMeetingSignals> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 90_000);
  let raw = "";
  try {
    const result = await invokeLLM({
      tier: options.tier ?? "fast",
      maxCompletionTokens: 4096,
      maxRetries: 0,
      signal: controller.signal,
      messages: [
        { role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT },
        { role: "user", content: buildMeetingSignalsPrompt(input, options.accountContext ?? "") },
      ],
      response_format: { type: "json_schema", json_schema: { name: "full_meeting_signals", strict: true, schema: FULL_MEETING_SIGNALS_RESPONSE_SCHEMA } },
    });
    raw = getLLMTextContent(result?.choices?.[0]?.message?.content);
  } catch (err: any) {
    const aborted = err?.name === "AbortError" || String(err?.message || "").includes("aborted");
    throw new MeetingSignalsError(aborted ? "timeout" : "provider", aborted ? "AI 信号提取超时" : `AI 信号提取失败：${err?.message || "未知错误"}`);
  } finally {
    clearTimeout(timer);
  }
  if (!raw) throw new MeetingSignalsError("empty", "AI 未返回可确认的拜访信号");
  try {
    return normalizeFullMeetingSignals(JSON.parse(extractJSON(raw)));
  } catch {
    throw new MeetingSignalsError("invalid_json", "AI 返回格式无效");
  }
}
