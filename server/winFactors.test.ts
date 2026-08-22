import { describe, expect, it } from "vitest";
import { calculateWinFactors } from "../shared/winFactors";

describe("calculateWinFactors", () => {
  it("marks the result as insufficient when no persisted evidence exists", () => {
    const result = calculateWinFactors({ meddpicc: null, threeWhy: null, annualValue: 0, contactCount: 0 });

    expect(result.dataSufficient).toBe(false);
    expect(result.factors).toEqual({ Pain: 0, Power: 0, Champion: 0, Value: 0, Control: 0 });
  });

  it("calculates the five factors from the persisted MEDDPICC 0-4 and 3 Why 0-5 scales", () => {
    const result = calculateWinFactors({
      meddpicc: {
        implicatePainScore: 3,
        economicBuyerScore: 2,
        championScore: 4,
        metricsScore: 3,
        decisionCriteriaScore: 2,
        decisionProcessScore: 3,
        paperProcessScore: 1,
      },
      threeWhy: { whyChangeScore: 4, whyNowScore: 3, whyUsScore: 5 },
      annualValue: 300000,
      contactCount: 7,
    });

    expect(result.dataSufficient).toBe(true);
    expect(result.factors).toEqual({ Pain: 68, Power: 50, Champion: 100, Value: 75, Control: 50 });
    expect(result.weakest.score).toBe(50);
    expect(result.evidence.annualValue).toBe(300000);
  });

  it("uses verified notes and annual value as evidence without inventing higher scores", () => {
    const result = calculateWinFactors({
      meddpicc: { economicBuyerNotes: "客户尚未确认最终经济决策人，需继续验证。" },
      threeWhy: null,
      annualValue: 200000,
      contactCount: 2,
    });

    expect(result.dataSufficient).toBe(true);
    expect(result.factors.Power).toBe(0);
    expect(result.factors.Value).toBe(25);
  });
});
