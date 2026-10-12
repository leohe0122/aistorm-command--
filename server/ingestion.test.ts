import { describe, expect, it } from "vitest";
import { canConfirmEvidence } from "../shared/evidencePermissions";
import { normalizeExtractedEvidence } from "./ai/evidenceExtraction";
import { extractedToEvidence } from "./evidence/mapping";
import { gradeEvidenceExtraction } from "../evals/graders";

describe("evidence confirmation permissions", () => {
  const ingestion = { topics: ["E"], sourceType: "ingestion", ingestionCreatorId: 5 };

  it("lets AD and admins confirm anything", () => {
    expect(canConfirmEvidence({ userId: 1, role: "user", podRole: "AD" }, ingestion)).toBe(true);
    expect(canConfirmEvidence({ userId: 1, role: "admin", podRole: "SAM" }, { topics: ["M"], sourceType: "meeting" })).toBe(true);
  });

  it("lets the person who submitted the material confirm its evidence", () => {
    expect(canConfirmEvidence({ userId: 5, role: "user", podRole: "SAM" }, ingestion)).toBe(true);
    expect(canConfirmEvidence({ userId: 6, role: "user", podRole: "SAM" }, ingestion)).toBe(false);
  });

  it("limits SA to technical evidence", () => {
    const sa = { userId: 9, role: "user" as const, podRole: "SA" };
    expect(canConfirmEvidence(sa, { topics: ["D1", "technical"], sourceType: "ingestion", ingestionCreatorId: 5 })).toBe(true);
    expect(canConfirmEvidence(sa, { topics: ["D1", "E"], sourceType: "ingestion", ingestionCreatorId: 5 })).toBe(false);
    expect(canConfirmEvidence(sa, { topics: [], sourceType: "ingestion", ingestionCreatorId: 5 })).toBe(false);
  });
});

describe("extracted evidence normalisation", () => {
  it("drops placeholders, unknown topics and scores on non-MEDDPICC items", () => {
    const { items } = normalizeExtractedEvidence({
      summary: "s",
      items: [
        { claim: "周海峰最终签字", quote: "最终由他签字", subjectName: "周海峰", topics: ["E", "bogus"], polarity: "neutral", suggestedScore: 50, confidence: "high" },
        { claim: "合同年底到期", quote: "合同 12 月 31 日到期", subjectName: "未知", topics: ["timeline"], polarity: "neutral", suggestedScore: 75, confidence: "medium" },
        { claim: "未提及预算", quote: "原文未提及预算", subjectName: null, topics: ["budget"], polarity: "neutral", suggestedScore: null, confidence: "low" },
      ],
    });
    expect(items).toHaveLength(2);
    expect(items[0].topics).toEqual(["E"]);
    const competitor = normalizeExtractedEvidence({ summary: "", items: [{ claim: "倾向深信服", quote: "直接用深信服的方案", subjectName: null, topics: ["C2"], polarity: "negative", suggestedScore: 25, confidence: "high" }] });
    expect(competitor.items[0].topics).toEqual(["C2", "competitor"]);
    expect(items[0].suggestedScore).toBe(50);
    expect(items[1].subjectName).toBeNull();
    expect(items[1].suggestedScore).toBeNull();
  });

  it("maps extracted items to ingestion-sourced candidates", () => {
    const drafts = extractedToEvidence(
      [{ claim: "c", quote: "q", subjectName: null, topics: ["technical"], polarity: "negative", suggestedScore: null, confidence: "high" }],
      { clientId: 3, ingestionId: 11, kind: "chat", occurredAt: new Date("2026-10-10") },
    );
    expect(drafts[0]).toMatchObject({ clientId: 3, sourceType: "ingestion", sourceId: 11, sourceKey: "item:0", polarity: "negative", kind: "statement" });
  });
});

describe("evidence extraction grader", () => {
  const source = "黄志强：如果下轮还这样就直接用深信服的方案";
  it("requires verbatim quotes and known people", () => {
    const failed = gradeEvidenceExtraction(
      [{ claim: "张三支持我们", quote: "张三非常支持", subjectName: "张三", topics: ["C1"], polarity: "positive", suggestedScore: 75 }],
      source,
      {},
    ).filter(check => !check.pass).map(check => check.name);
    expect(failed).toEqual(["引用均逐字出自原文", "涉及人员均出自原文"]);
  });

  it("checks negative signals and empty expectations", () => {
    const items = [{ claim: "客户可能改用深信服", quote: "如果下轮还这样就直接用深信服的方案", subjectName: "黄志强", topics: ["competitor"], polarity: "negative", suggestedScore: null }];
    expect(gradeEvidenceExtraction(items, source, { negativeAbout: ["深信服"] }).every(check => check.pass)).toBe(true);
    expect(gradeEvidenceExtraction(items, source, { expectEmpty: true }).some(check => !check.pass)).toBe(true);
  });
});
