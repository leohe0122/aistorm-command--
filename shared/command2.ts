export const GO_NO_GO_GATE_KEYS = [
  "gate1StrategicFit", "gate2PainVerified", "gate3ChampionExists", "gate4EBClear", "gate5ValueQuantified",
  "gate6CriteriaWinnable", "gate7ProcessClear", "gate8CompDefensible", "gate9DeliveryOK", "gate10ROIJustified",
] as const;

export type GoNoGoGateKey = typeof GO_NO_GO_GATE_KEYS[number];
export type GoNoGoRecord = Partial<Record<GoNoGoGateKey, number>>;

export function calculateGoNoGo(record: GoNoGoRecord | null | undefined) {
  if (!record) return { score: null, status: "数据不足" as const };
  const score = GO_NO_GO_GATE_KEYS.reduce((total, key) => total + Math.max(0, Math.min(2, Number(record[key] ?? 0))), 0);
  return { score, status: score >= 16 ? "Go" as const : score >= 10 ? "有条件Go" as const : "No-Go" as const };
}

export type DealHealthInput = {
  relationshipPower: number | null; meddpicc: number | null; metricsValue: number | null; champion: number | null;
  accountFit: number | null; economicBuyer: number | null; threeWhy: number | null; decisionCriteria: number | null;
  processPaper: number | null; competition: number | null; actionDiscipline: number | null;
};

const DEAL_HEALTH_WEIGHTS: Record<keyof DealHealthInput, number> = {
  relationshipPower: 14, meddpicc: 14, metricsValue: 12, champion: 10, accountFit: 8, economicBuyer: 8,
  threeWhy: 8, decisionCriteria: 7, processPaper: 7, competition: 7, actionDiscipline: 5,
};

/** 所有维度均有可验证事实才计算预测；缺失事实时明确不输出伪精确分数。 */
export function calculateDealHealth(input: DealHealthInput) {
  const missing = (Object.keys(DEAL_HEALTH_WEIGHTS) as Array<keyof DealHealthInput>).filter(key => input[key] === null || input[key] === undefined);
  if (missing.length) return { score: null, status: "数据不足" as const, missing };
  const score = Math.round((Object.keys(DEAL_HEALTH_WEIGHTS) as Array<keyof DealHealthInput>).reduce((total, key) => total + (Math.max(0, Math.min(5, input[key] ?? 0)) / 5) * DEAL_HEALTH_WEIGHTS[key], 0));
  return { score, status: score >= 80 ? "可Commit" as const : score >= 60 ? "需补证据" as const : "不应Commit" as const, missing: [] as string[] };
}
