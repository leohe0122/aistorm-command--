export const OPPORTUNITY_MEDDPICC_FIELDS = [
  "metricsScore",
  "economicBuyerScore",
  "decisionCriteriaScore",
  "decisionProcessScore",
  "paperProcessScore",
  "implicatePainScore",
  "championScore",
  "competitionScore",
] as const;

/**
 * 商机级 MEDDPICC 在数据库中以 0–4 存储；此函数将其转换为 0–100 的健康度。
 * 当没有商机评分记录时返回 null，界面必须提示“评分待补充”，而非伪造健康度。
 */
export function calculateOpportunityHealth(meddpicc: Record<string, unknown> | null | undefined): number | null {
  if (!meddpicc) return null;
  const total = OPPORTUNITY_MEDDPICC_FIELDS.reduce((sum, key) => sum + (Number(meddpicc[key]) || 0), 0);
  return Math.round((total / (OPPORTUNITY_MEDDPICC_FIELDS.length * 4)) * 100);
}
