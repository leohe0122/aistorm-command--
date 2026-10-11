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

/**
 * 修改提示词或规则时递增，ai_runs 与评测结果据此对照。
 * v2 评测（6 个用例，2026-10-11）：fast 4/6、standard 5/6、reasoning 5/6；v1 基线为 fast 2/6、reasoning 0/6。
 * 两个提取接口均使用 standard：质量与 reasoning 相当，延迟和成本更低。
 */
export const MEETING_SIGNALS_PROMPT_VERSION = "meeting-signals-v2";

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
3. evidence 必须是记录中的原话，或紧贴原文、可逐字对照的转述。严禁填写"未提供""数据不足""无"之类的占位文字；拿不出原文依据的条目整条不要输出。
4. suggestedScore 只能是 0/25/50/75/100。meddpiccUpdates 只包含本次记录提供了新证据的维度；记录没有涉及的维度不要输出，不要用 0 分条目来说明"未提及"。但记录一旦说明了谁拍板或签字（E）、采购或审批怎么走（P）、用什么标准选型（D1）、决策步骤与时间（D2）、量化的业务影响或预算（M），就必须输出对应维度。

【关键人】
5. 凡是记录中被提到、且与本项目的决策、评估、采购、审批、使用或阻碍有关的人，都要列入 contactDiscoveries，不论是否在场。例如"方案最后要财务总监张某拍板"中的张某、"技术细节由他手下的工程师李某把关"中的李某。参会人名单中的客户方人员同样要列入。
6. 记录明确说与项目无关的人不要列入。name 必须指向一个具体的人：只知道职位不知道姓名时，用职位作为 name（如"CFO"）；不要填"未知"，也不要把一群人（如"几位同事""IT 团队"）当成一个关键人。
7. 角色（buyingRole）只在记录说明其职责或行为时填写，否则为"未知"；态度（attitude）只在记录有明确表态时填写。

【负面事实同样重要】
8. 客户的反对、顾虑、不满和拒绝都是必须提取的事实：表示反对的人要列为关键人，attitude 填"反对"；对应的顾虑写进 winFactorAlerts。
9. 客户正在使用、合作或评估的其他厂商都属于竞品，必须列入 competitorMentions，并写明客户的原话语境。

【时间信号分类】
10. deadline：合同到期、截止日期、交付或验收期限、要求我方在某日前完成的事。
11. budget_cycle：预算编制、审批、财年、董事会审议等资金流程节点。
12. trigger_event：已经发生、迫使客户必须行动的事件，如安全事件、监管或总部硬性要求、高层指令、组织变动。
13. 同一段话可以同时产生多条不同类型的时间信号（例如"八月出了事故，所以年底前必须完成"既是 trigger_event 也是 deadline）。

【输出】
14. nextBestAction 必须是 SAM 下一次要验证的一件事，不能是产品推销动作。
15. meetingSummary 用不超过120字概括本次已确认事实与未确认边界；英文记录可用英文概括。
16. 按给定 JSON Schema 返回，JSON 外不得输出任何文字。`;
}

const PLACEHOLDER_EVIDENCE = /^(未提供|数据不足|暂无|无|不详|未知|n\/?a|none|not provided|not mentioned)[。.!！]?$|^数据不足，?暂不判断[。.]?$|^(记录|原文|本次)(中)?(未|没有)(提及|提到|涉及)/i;

const PLACEHOLDER_NAME = /^(未知|不详|无|unknown|n\/?a|none)$|(同事们?|团队|人员|们)$|几位|多位|若干|一些|colleagues|team$/i;

/** 模型偶尔会用占位文字充当证据或人名；这类条目没有可回溯依据，直接丢弃，避免进入待确认列表。 */
export function dropPlaceholderEvidence(signals: FullMeetingSignals): FullMeetingSignals {
  const real = (text: string) => !PLACEHOLDER_EVIDENCE.test(text.trim());
  return {
    ...signals,
    meddpiccUpdates: signals.meddpiccUpdates.filter(item => real(item.evidence)),
    contactDiscoveries: signals.contactDiscoveries.filter(item => real(item.evidence) && !PLACEHOLDER_NAME.test(item.name.trim())),
  };
}

function extractJSON(raw: string): string {
  const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  return match ? match[1].trim() : raw.trim();
}

export async function extractMeetingSignals(
  input: MeetingSignalsInput,
  options: { accountContext?: string; tier?: InvokeParams["tier"]; timeoutMs?: number } = {},
): Promise<{ signals: FullMeetingSignals; aiRunId?: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 90_000);
  let raw = "";
  let aiRunId: number | undefined;
  try {
    const result = await invokeLLM({
      tier: options.tier ?? "fast",
      feature: "meeting_signals",
      promptVersion: MEETING_SIGNALS_PROMPT_VERSION,
      // 推理档模型会先消耗大量 Token 思考，预算太小时会返回空正文
      maxCompletionTokens: (options.tier ?? "fast") === "reasoning" ? 16_000 : 4096,
      maxRetries: 0,
      signal: controller.signal,
      messages: [
        { role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT },
        { role: "user", content: buildMeetingSignalsPrompt(input, options.accountContext ?? "") },
      ],
      response_format: { type: "json_schema", json_schema: { name: "full_meeting_signals", strict: true, schema: FULL_MEETING_SIGNALS_RESPONSE_SCHEMA } },
    });
    raw = getLLMTextContent(result?.choices?.[0]?.message?.content);
    aiRunId = result?.aiRunId;
  } catch (err: any) {
    const aborted = err?.name === "AbortError" || String(err?.message || "").includes("aborted");
    throw new MeetingSignalsError(aborted ? "timeout" : "provider", aborted ? "AI 信号提取超时" : `AI 信号提取失败：${err?.message || "未知错误"}`);
  } finally {
    clearTimeout(timer);
  }
  if (!raw) throw new MeetingSignalsError("empty", "AI 未返回可确认的拜访信号");
  try {
    return { signals: dropPlaceholderEvidence(normalizeFullMeetingSignals(JSON.parse(extractJSON(raw)))), aiRunId };
  } catch {
    throw new MeetingSignalsError("invalid_json", "AI 返回格式无效");
  }
}
