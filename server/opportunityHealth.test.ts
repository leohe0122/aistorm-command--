import { describe, expect, it } from "vitest";
import { calculateOpportunityHealth } from "../client/src/lib/opportunityHealth";

describe("calculateOpportunityHealth", () => {
  it("returns null rather than inventing a health score when opportunity evidence is absent", () => {
    expect(calculateOpportunityHealth(null)).toBeNull();
  });

  it("converts the persisted 0–4 MEDDPICC score scale into a percentage", () => {
    expect(calculateOpportunityHealth({
      metricsScore: 4,
      economicBuyerScore: 2,
      decisionCriteriaScore: 2,
      decisionProcessScore: 2,
      paperProcessScore: 2,
      implicatePainScore: 2,
      championScore: 2,
      competitionScore: 2,
    })).toBe(56);
  });

  it("treats incomplete dimension values as zero instead of producing NaN", () => {
    expect(calculateOpportunityHealth({ metricsScore: 4 })).toBe(13);
  });
});
