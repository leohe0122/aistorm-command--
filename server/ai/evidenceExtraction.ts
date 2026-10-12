// 通用证据提取：从用户投喂的原始素材（邮件、纪要、聊天、电话记录、文件文本）中
// 拆出一条条可回溯的客户事实，作为证据台账的候选。与拜访信号提取共用“只提取、不编造”的原则，
// 但直接输出证据形态（一句话事实 + 原文引用 + 标签），不再经过固定的八区块结构。

import { getLLMTextContent, invokeLLM, type InvokeParams } from "../_core/llm";
import { SALES_METHODOLOGY_SYSTEM_PROMPT } from "../salesMethodology";

export const EVIDENCE_EXTRACTION_PROMPT_VERSION = "evidence-extraction-v1";

export const EVIDENCE_TOPICS = [
  "M", "E", "D1", "D2", "P", "I", "C1", "C2",
  "stakeholder", "relationship", "timeline", "budget", "trigger",
  "why_change", "why_now", "why_us", "competitor", "technical",
] as const;
export type EvidenceTopic = (typeof EVIDENCE_TOPICS)[number];
const MEDDPICC = new Set(["M", "E", "D1", "D2", "P", "I", "C1", "C2"]);

export const INGESTION_KINDS = ["email", "meeting_notes", "chat", "call_notes", "document", "other"] as const;
export type IngestionKind = (typeof INGESTION_KINDS)[number];
const KIND_LABELS: Record<IngestionKind, string> = {
  email: "邮件",
  meeting_notes: "会议纪要",
  chat: "聊天记录",
  call_notes: "电话记录",
  document: "文件内容",
  other: "其他素材",
};

export type ExtractedEvidence = {
  claim: string;
  quote: string;
  subjectName: string | null;
  topics: EvidenceTopic[];
  polarity: "positive" | "negative" | "neutral";
  suggestedScore: 0 | 25 | 50 | 75 | 100 | null;
  confidence: "high" | "medium" | "low";
};

export type EvidenceExtractionInput = {
  clientName: string;
  kind: IngestionKind;
  title?: string | null;
  occurredAt?: string | null;
  text: string;
  /** 已知关键人姓名，帮助模型统一人名写法 */
  knownContacts?: string[];
};

export const EVIDENCE_EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          claim: { type: "string" },
          quote: { type: "string" },
          subjectName: { type: ["string", "null"] },
          topics: { type: "array", items: { type: "string", enum: [...EVIDENCE_TOPICS] } },
          polarity: { type: "string", enum: ["positive", "negative", "neutral"] },
          suggestedScore: { type: ["integer", "null"], enum: [0, 25, 50, 75, 100, null] },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["claim", "quote", "subjectName", "topics", "polarity", "suggestedScore", "confidence"],
      },
    },
  },
  required: ["summary", "items"],
} as const;

export function buildEvidenceExtractionPrompt(input: EvidenceExtractionInput): string {
  const contacts = input.knownContacts?.length ? `\n已知关键人（仅用于统一人名写法，不代表素材中出现）：${input.knownContacts.join("、")}` : "";
  return `你是销售团队的证据整理助手。下面是一份关于客户「${input.clientName}」的${KIND_LABELS[input.kind]}${input.title ? `《${input.title}》` : ""}${input.occurredAt ? `，日期 ${input.occurredAt}` : ""}。请把其中关于客户的事实逐条拆成证据，供销售人员确认。${contacts}

【素材原文】
${input.text}

【拆分规则】
1. 一条证据只表达一个事实。claim 用一句话陈述事实；quote 必须逐字摘自素材原文（可截取片段，不得改写、翻译或拼接不相邻的句子）。
2. 只提取素材中明确出现的客户事实：客户方人员说了什么、做了什么、决定了什么、要求了什么。我方的推销话术、计划和猜测不是证据。
3. 禁止编造：拿不出原文依据的内容不要输出；不要输出"未提及""数据不足"之类的占位条目；没有事实时 items 返回空数组。
4. subjectName 填事实涉及的具体客户方人员姓名；只知道职位时填职位（如"CFO"）；涉及整个组织或无法对应到具体人时填 null，不要填"未知"或"几位同事"。
5. 客户的反对、顾虑、拒绝、延期和对其他厂商的偏好同样是证据，polarity 填 negative。明确对我方有利的表态填 positive，其余填 neutral。

【标签 topics（可多选）】
- M 量化的业务影响或预算金额；E 谁拍板或签字；D1 选型标准；D2 决策步骤与时间；P 采购、审批、合同流程；I 痛点及其影响；C1 客户内部支持我方的人及其行动；C2 竞争对手相关
- stakeholder 涉及具体人员的角色或立场；relationship 与我方的关系变化；timeline 时间节点；budget 预算状态；trigger 已发生、迫使客户行动的事件
- why_change 客户为什么要改变；why_now 为什么是现在；why_us 为什么选我方；competitor 提到其他厂商；technical 技术要求、架构、测试与 POC

【建议分 suggestedScore】
只在证据带有 MEDDPICC 标签（M/E/D1/D2/P/I/C1/C2）时给出，表示这条证据把该维度推进到什么程度：25 有线索、50 已明确但未验证、75 已验证、100 已书面确认；0 表示明确的不利事实。其他证据填 null。

【输出】
summary 用不超过 80 字概括素材中的关键事实；英文素材可用英文。按给定 JSON Schema 输出，JSON 外不得有任何文字。最多 30 条证据。`;
}

const PLACEHOLDER = /^(未提供|数据不足|暂无|无|不详|未知|n\/?a|none|not provided|not mentioned)[。.!！]?$|^数据不足，?暂不判断[。.]?$|^(记录|原文|本次|素材)(中)?(未|没有)(提及|提到|涉及)/i;
const PLACEHOLDER_NAME = /^(未知|不详|无|unknown|n\/?a|none)$|(同事们?|团队|人员|们)$|几位|多位|若干|一些|colleagues|team$/i;

/** 清洗模型输出：过滤非法标签与占位内容，非 MEDDPICC 证据不带建议分。 */
export function normalizeExtractedEvidence(value: unknown): { summary: string; items: ExtractedEvidence[] } {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, any>;
  const items: ExtractedEvidence[] = [];
  for (const item of Array.isArray(raw.items) ? raw.items : []) {
    const claim = String(item?.claim ?? "").trim();
    const quote = String(item?.quote ?? "").trim();
    if (!claim || !quote || PLACEHOLDER.test(quote) || PLACEHOLDER.test(claim)) continue;
    const topics = (Array.isArray(item.topics) ? item.topics : []).filter((topic: unknown): topic is EvidenceTopic => (EVIDENCE_TOPICS as readonly string[]).includes(String(topic)));
    // C2 与 competitor 含义相同（竞争对手），统一成对出现，便于按任一标签检索
    if (topics.includes("C2") || topics.includes("competitor")) topics.push("C2", "competitor");
    const uniqueTopics = Array.from(new Set(topics)) as EvidenceTopic[];
    const subject = typeof item.subjectName === "string" ? item.subjectName.trim() : "";
    const hasMeddpicc = uniqueTopics.some(topic => MEDDPICC.has(topic));
    const score = [0, 25, 50, 75, 100].includes(Number(item.suggestedScore)) && item.suggestedScore !== null ? Number(item.suggestedScore) as ExtractedEvidence["suggestedScore"] : null;
    items.push({
      claim,
      quote,
      subjectName: subject && !PLACEHOLDER_NAME.test(subject) ? subject : null,
      topics: uniqueTopics,
      polarity: ["positive", "negative", "neutral"].includes(item.polarity) ? item.polarity : "neutral",
      suggestedScore: hasMeddpicc ? score : null,
      confidence: ["high", "medium", "low"].includes(item.confidence) ? item.confidence : "low",
    });
    if (items.length >= 30) break;
  }
  const summary = typeof raw.summary === "string" ? raw.summary.trim() : "";
  return { summary, items };
}

function extractJSON(raw: string): string {
  const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  return match ? match[1].trim() : raw.trim();
}

export async function extractEvidence(
  input: EvidenceExtractionInput,
  options: { tier?: InvokeParams["tier"]; timeoutMs?: number } = {},
): Promise<{ summary: string; items: ExtractedEvidence[]; aiRunId?: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 90_000);
  try {
    const result = await invokeLLM({
      tier: options.tier ?? "standard",
      feature: "evidence_extraction",
      promptVersion: EVIDENCE_EXTRACTION_PROMPT_VERSION,
      maxCompletionTokens: (options.tier ?? "standard") === "reasoning" ? 16_000 : 6000,
      maxRetries: 0,
      signal: controller.signal,
      messages: [
        { role: "system", content: SALES_METHODOLOGY_SYSTEM_PROMPT },
        { role: "user", content: buildEvidenceExtractionPrompt(input) },
      ],
      response_format: { type: "json_schema", json_schema: { name: "evidence_extraction", strict: true, schema: EVIDENCE_EXTRACTION_SCHEMA as any } },
    });
    const raw = getLLMTextContent(result?.choices?.[0]?.message?.content);
    if (!raw) throw new Error("AI 未返回内容");
    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJSON(raw));
    } catch {
      throw new Error("AI 返回格式无效");
    }
    return { ...normalizeExtractedEvidence(parsed), aiRunId: result.aiRunId };
  } catch (err: any) {
    const aborted = err?.name === "AbortError" || String(err?.message || "").includes("aborted");
    throw new Error(aborted ? "AI 证据提取超时" : err?.message || "AI 证据提取失败");
  } finally {
    clearTimeout(timer);
  }
}
