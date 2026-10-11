// AI 评测的确定性评分规则。只依赖输入原文与输出结构，不调用模型，便于在单元测试中验证评分本身。

import type { FullMeetingSignals } from "../server/aiNativeGuidance";

export type Check = { name: string; pass: boolean; detail?: string };

const MEDDPICC_CODES = ["M", "E", "D1", "D2", "P", "I", "C1", "C2"] as const;
type MeddpiccCode = (typeof MEDDPICC_CODES)[number];
type ArrayField = "meddpiccUpdates" | "contactDiscoveries" | "competitorMentions" | "timeSignals" | "winFactorAlerts";

export type MeetingSignalsExpectation = {
  /** 必须识别出的关键人（按姓名片段匹配） */
  contactsInclude?: string[];
  /** 不应出现的关键人（如只被顺带提到、与项目无关的人） */
  contactsExclude?: string[];
  competitorsInclude?: string[];
  competitorsExclude?: string[];
  timeSignalTypesInclude?: Array<"deadline" | "budget_cycle" | "trigger_event">;
  /** 某维度建议分不得高于该值（防止无证据拔高） */
  meddpiccMax?: Partial<Record<MeddpiccCode, number>>;
  /** 某维度必须给出且不低于该值 */
  meddpiccMin?: Partial<Record<MeddpiccCode, number>>;
  /** 原文没有相关事实，对应数组必须为空 */
  expectEmpty?: ArrayField[];
  /** 原文无法支撑，3 Why 对应项必须为 null */
  whyNull?: Array<"whyChange" | "whyNow" | "whyUs">;
};

/** 去掉空白与标点并转小写，便于中英文混排比较。 */
export function normalizeForMatch(text: string): string {
  return text.toLowerCase().replace(/[\s.,;:!?'"()[\]{}<>\-—_/\\|@#$%^&*+=~`，。；：！？、“”‘’（）【】《》…·]+/g, "");
}

function bigrams(text: string): string[] {
  const chars = Array.from(normalizeForMatch(text));
  if (chars.length < 2) return chars.length ? [chars[0]] : [];
  const out: string[] = [];
  for (let i = 0; i < chars.length - 1; i++) out.push(chars[i] + chars[i + 1]);
  return out;
}

/** evidence 中有多少比例的字符二元组能在原文中找到；用于判断“是否引用/改写自原文”。 */
export function groundingRatio(evidence: string, source: string): number {
  const grams = bigrams(evidence);
  if (grams.length === 0) return 0;
  const pool = new Set(bigrams(source));
  return grams.filter(gram => pool.has(gram)).length / grams.length;
}

export function appearsIn(name: string, source: string): boolean {
  const needle = normalizeForMatch(name);
  return needle.length > 0 && normalizeForMatch(source).includes(needle);
}

export const EVIDENCE_GROUNDING_THRESHOLD = 0.5;
export const SUMMARY_MAX_CHARS = 150; // 提示词要求不超过 120 字，留 25% 容差

export function gradeMeetingSignals(output: FullMeetingSignals, source: string, expect: MeetingSignalsExpectation): Check[] {
  const checks: Check[] = [];
  const add = (name: string, pass: boolean, detail?: string) => checks.push({ name, pass, ...(detail && !pass ? { detail } : {}) });

  // ── 通用检查：不编造 ──
  const ungroundedContacts = output.contactDiscoveries.filter(contact => !appearsIn(contact.name, source)).map(contact => contact.name);
  add("关键人均出自原文", ungroundedContacts.length === 0, `原文中找不到：${ungroundedContacts.join("、")}`);

  const ungroundedCompetitors = output.competitorMentions.filter(item => !appearsIn(item.competitorName, source)).map(item => item.competitorName);
  add("竞品均出自原文", ungroundedCompetitors.length === 0, `原文中找不到：${ungroundedCompetitors.join("、")}`);

  const weakEvidence = [
    ...output.meddpiccUpdates.map(item => ({ label: `MEDDPICC ${item.dim}`, evidence: item.evidence })),
    ...output.contactDiscoveries.map(item => ({ label: `关键人 ${item.name}`, evidence: item.evidence })),
  ].filter(item => groundingRatio(item.evidence, source) < EVIDENCE_GROUNDING_THRESHOLD);
  add("证据可回溯到原文", weakEvidence.length === 0, weakEvidence.map(item => `${item.label}：「${item.evidence.slice(0, 40)}」`).join("；"));

  add("摘要长度合规", Array.from(output.meetingSummary).length <= SUMMARY_MAX_CHARS, `${Array.from(output.meetingSummary).length} 字`);
  add("给出下一步验证动作", output.nextBestAction.trim().length > 0 && output.nextBestAction !== "数据不足，暂不判断");

  // ── 用例期望 ──
  const contactNames = output.contactDiscoveries.map(contact => contact.name);
  for (const name of expect.contactsInclude ?? []) {
    add(`识别关键人：${name}`, contactNames.some(found => appearsIn(name, found) || appearsIn(found, name)), `实际：${contactNames.join("、") || "无"}`);
  }
  for (const name of expect.contactsExclude ?? []) {
    add(`不应列为关键人：${name}`, !contactNames.some(found => appearsIn(name, found)), `实际：${contactNames.join("、")}`);
  }
  const competitorNames = output.competitorMentions.map(item => item.competitorName);
  for (const name of expect.competitorsInclude ?? []) {
    add(`识别竞品：${name}`, competitorNames.some(found => appearsIn(name, found) || appearsIn(found, name)), `实际：${competitorNames.join("、") || "无"}`);
  }
  for (const name of expect.competitorsExclude ?? []) {
    add(`不应列为竞品：${name}`, !competitorNames.some(found => appearsIn(name, found)), `实际：${competitorNames.join("、")}`);
  }
  const timeTypes = output.timeSignals.map(item => item.type);
  for (const type of expect.timeSignalTypesInclude ?? []) {
    add(`识别时间信号：${type}`, timeTypes.includes(type), `实际：${timeTypes.join("、") || "无"}`);
  }
  const scoreOf = (dim: MeddpiccCode) => {
    const scores = output.meddpiccUpdates.filter(item => item.dim === dim).map(item => item.suggestedScore);
    return scores.length ? Math.max(...scores) : null;
  };
  for (const [dim, max] of Object.entries(expect.meddpiccMax ?? {}) as Array<[MeddpiccCode, number]>) {
    const score = scoreOf(dim);
    add(`${dim} 不高于 ${max}`, score === null || score <= max, `实际 ${score}`);
  }
  for (const [dim, min] of Object.entries(expect.meddpiccMin ?? {}) as Array<[MeddpiccCode, number]>) {
    const score = scoreOf(dim);
    add(`${dim} 不低于 ${min}`, score !== null && score >= min, `实际 ${score ?? "未给出"}`);
  }
  for (const field of expect.expectEmpty ?? []) {
    add(`${field} 应为空`, output[field].length === 0, `实际 ${output[field].length} 条`);
  }
  for (const key of expect.whyNull ?? []) {
    add(`3 Why ${key} 应为空`, output.threeWhyUpdates[key] === null, `实际「${output.threeWhyUpdates[key]}」`);
  }
  return checks;
}
