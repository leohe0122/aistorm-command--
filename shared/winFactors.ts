export type WinFactorName = "Pain" | "Power" | "Champion" | "Value" | "Control";

export type WinFactorResult = {
  factors: Record<WinFactorName, number>;
  weakest: { factor: WinFactorName; score: number };
  evidence: { annualValue: number; contactCount: number; evidenceCount: number };
  dataSufficient: boolean;
};

const MEDDPICC_NOTE_FIELDS = [
  "implicatePainNotes",
  "economicBuyerNotes",
  "championNotes",
  "metricsNotes",
  "decisionCriteriaNotes",
  "decisionProcessNotes",
  "paperProcessNotes",
] as const;

export function calculateWinFactors(input: { meddpicc: any; threeWhy: any; annualValue: number; contactCount: number }): WinFactorResult {
  const score = (value: unknown) => Math.max(0, Math.min(100, Number(value || 0) * 25));
  const whyScores = [input.threeWhy?.whyChangeScore, input.threeWhy?.whyNowScore, input.threeWhy?.whyUsScore]
    .filter((value) => value != null)
    .map((value) => Math.max(0, Math.min(100, Number(value) * 20)));
  const pain = whyScores.length
    ? Math.round((score(input.meddpicc?.implicatePainScore) + Math.min(...whyScores)) / 2)
    : score(input.meddpicc?.implicatePainScore);
  const power = score(input.meddpicc?.economicBuyerScore);
  const champion = score(input.meddpicc?.championScore);
  const value = input.annualValue > 0
    ? Math.max(25, score(input.meddpicc?.metricsScore))
    : score(input.meddpicc?.metricsScore);
  const control = Math.round((
    score(input.meddpicc?.decisionCriteriaScore)
    + score(input.meddpicc?.decisionProcessScore)
    + score(input.meddpicc?.paperProcessScore)
  ) / 3);
  const factors = { Pain: pain, Power: power, Champion: champion, Value: value, Control: control };
  const weakest = (Object.entries(factors).sort((left, right) => left[1] - right[1])[0] || ["Pain", 0]) as [WinFactorName, number];
  const scoredDimensions = [
    input.meddpicc?.implicatePainScore,
    input.meddpicc?.economicBuyerScore,
    input.meddpicc?.championScore,
    input.meddpicc?.metricsScore,
    input.meddpicc?.decisionCriteriaScore,
    input.meddpicc?.decisionProcessScore,
    input.meddpicc?.paperProcessScore,
  ].filter((value) => Number(value || 0) > 0).length;
  const noteEvidence = MEDDPICC_NOTE_FIELDS.filter((field) => String(input.meddpicc?.[field] || "").trim().length >= 10).length;
  const whyEvidence = [input.threeWhy?.whyChangeScore, input.threeWhy?.whyNowScore, input.threeWhy?.whyUsScore].filter((value) => value != null).length;
  const valueEvidence = input.annualValue > 0 ? 1 : 0;
  const evidenceCount = scoredDimensions + noteEvidence + whyEvidence + valueEvidence;

  return {
    factors,
    weakest: { factor: weakest[0], score: weakest[1] },
    evidence: { annualValue: input.annualValue, contactCount: input.contactCount, evidenceCount },
    dataSufficient: evidenceCount > 0,
  };
}
