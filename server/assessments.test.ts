import { describe, expect, it } from "vitest";
import { computeMeddpiccAssessments, UNSCORED_EVIDENCE_SCORE, type AssessableEvidence } from "./evidence/assess";

let nextId = 1;
const ev = (over: Partial<AssessableEvidence>): AssessableEvidence => ({
  id: nextId++,
  clientId: 7,
  opportunityId: null,
  status: "confirmed",
  topics: [],
  suggestedScore: null,
  polarity: "neutral",
  claim: "示例事实",
  occurredAt: new Date("2026-10-01"),
  createdAt: new Date("2026-10-01"),
  ...over,
});

describe("evidence-derived MEDDPICC assessments", () => {
  it("scores only dimensions that have confirmed evidence", () => {
    const out = computeMeddpiccAssessments(7, [ev({ topics: ["E"], suggestedScore: 75 })]);
    expect(out.map(item => `${item.scope}:${item.dimension}:${item.score}`)).toEqual(["client:E:75"]);
  });

  it("uses the most recent scored evidence, not the historical maximum", () => {
    const older = ev({ topics: ["M"], suggestedScore: 100, occurredAt: new Date("2026-09-01") });
    const newer = ev({ topics: ["M"], suggestedScore: 25, occurredAt: new Date("2026-10-05"), claim: "预算被砍半" });
    const [m] = computeMeddpiccAssessments(7, [older, newer]);
    expect(m.score).toBe(25);
    expect(m.rationale).toContain("预算被砍半");
    expect(m.evidenceIds).toEqual([newer.id, older.id]);
  });

  it("gives unscored evidence a low placeholder score and counts negatives", () => {
    const [c1] = computeMeddpiccAssessments(7, [ev({ topics: ["stakeholder", "C1"], polarity: "negative" })]);
    expect(c1.score).toBe(UNSCORED_EVIDENCE_SCORE);
    expect(c1.rationale).toContain("1 条为不利信号");
  });

  it("ignores candidates, rejected evidence and other clients", () => {
    const out = computeMeddpiccAssessments(7, [
      ev({ topics: ["E"], suggestedScore: 75, status: "candidate" }),
      ev({ topics: ["E"], suggestedScore: 75, status: "rejected" }),
      ev({ topics: ["E"], suggestedScore: 75, clientId: 8 }),
    ]);
    expect(out).toEqual([]);
  });

  it("produces opportunity-level assessments from that opportunity's evidence only", () => {
    const out = computeMeddpiccAssessments(7, [
      ev({ topics: ["P"], suggestedScore: 50, opportunityId: 3 }),
      ev({ topics: ["P"], suggestedScore: 75, opportunityId: 4 }),
    ]);
    const byTarget = Object.fromEntries(out.map(item => [`${item.scope}:${item.targetId}`, item.score]));
    expect(byTarget["opportunity:3"]).toBe(50);
    expect(byTarget["opportunity:4"]).toBe(75);
    expect(byTarget["client:7"]).toBeDefined();
  });
});
