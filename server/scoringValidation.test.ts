import { describe, expect, it } from "vitest";
import { scoreStory, shouldAutoConfirm } from "./evidence/dealStories";
import { legacyScores, reconcile, renderReconciliationMarkdown } from "./evidence/reconcile";
import { gradeDealScoring } from "../evals/graders";

const item = (over: Record<string, unknown>) => ({
  claim: "示例", quote: "示例", subjectName: null, topics: [] as string[], polarity: "neutral" as const,
  suggestedScore: null as number | null, confidence: "high" as const, ...over,
}) as any;

describe("story scoring", () => {
  it("leaves low-confidence candidates for people to confirm", () => {
    expect(shouldAutoConfirm({ confidence: "low" })).toBe(false);
    expect(shouldAutoConfirm({ confidence: "medium" })).toBe(true);
  });

  it("lets a later fact replace an earlier one (champion lost)", () => {
    const { scores } = scoreStory(1, [
      { material: { kind: "email", title: "a", occurredAt: "2026-08-15", text: "" }, items: [item({ topics: ["C1"], suggestedScore: 75 })] },
      { material: { kind: "call_notes", title: "b", occurredAt: "2026-10-28", text: "" }, items: [item({ topics: ["C1"], suggestedScore: 0, polarity: "negative" })] },
    ]);
    expect(scores.C1).toBe(0);
  });

  it("does not score from unconfirmed candidates", () => {
    const { scores } = scoreStory(1, [
      { material: { kind: "email", title: "a", occurredAt: "2026-10-01", text: "" }, items: [item({ topics: ["E"], suggestedScore: 75, confidence: "low" })] },
    ]);
    expect(scores).toEqual({});
  });
});

describe("deal scoring grader", () => {
  it("checks ranges, absence and over-scoring", () => {
    const failed = gradeDealScoring({ E: 25, P: 75, M: 50 }, { dims: { E: { min: 50 }, P: { absent: true }, C1: { present: true } }, maxScore: 25, maxScoredDims: 2 })
      .filter(check => !check.pass).map(check => check.name);
    expect(failed).toEqual(["E 不低于 50", "P 不应有分数", "C1 应有分数", "所有维度不高于 25", "有分数的维度不多于 2 个"]);
  });
});

describe("legacy vs evidence reconciliation", () => {
  it("treats legacy zero as unscored and rescales opportunity scores", () => {
    expect(legacyScores({ metricsScore: 0, economicBuyerScore: 3 }, 25)).toEqual({ E: 75 });
    expect(legacyScores({ championScore: 60 }, 1)).toEqual({ C1: 60 });
  });

  it("summarises coverage, gaps and unsupported legacy scores", () => {
    const result = reconcile([
      { scope: "client", targetId: 1, label: "客户甲", legacy: { E: 100, C1: 75 }, derived: { E: 25, P: 50 } },
    ]);
    expect(result.summary.bothScored).toBe(1);
    expect(result.summary.largeGaps.map(row => row.dimension)).toEqual(["E"]);
    expect(result.summary.legacyWithoutEvidence.map(row => row.dimension)).toEqual(["C1"]);
    expect(result.summary.evidenceWithoutLegacy.map(row => row.dimension)).toEqual(["P"]);
    const markdown = renderReconciliationMarkdown(result, new Date("2026-11-16T00:00:00Z"));
    expect(markdown).toContain("| 客户 | 客户甲 | E | 100 | 25 | -75 |");
  });
});
