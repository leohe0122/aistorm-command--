/**
 * 为高频 LLM 调用场景构建 Account Map / Deal Map 诊断上下文。
 * 查询已入库的事实数据，调用 salesMethodology 的诊断层函数，返回可直接拼入 user prompt 的文本。
 * 数据不足时返回空字符串（不注入无意义的占位）。
 */
import { getDb } from "./db";
import { buildAccountMapDiagnosticLayer, buildDealMapDiagnosticLayer } from "./salesMethodology";
import { calculateGoNoGo, GO_NO_GO_GATE_KEYS } from "../shared/command2";

export async function getAccountDiagnosticContext(clientId: number): Promise<string> {
  const db = await getDb();
  if (!db) return "";
  const { accountOverview, relationshipCoverage, threeWhy } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");

  const [overviews, coverages, threeWhys] = await Promise.all([
    db.select().from(accountOverview).where(eq(accountOverview.clientId, clientId)).limit(1),
    db.select().from(relationshipCoverage).where(eq(relationshipCoverage.clientId, clientId)),
    db.select().from(threeWhy).where(eq(threeWhy.clientId, clientId)).limit(1),
  ]);

  const ov = overviews[0];
  const tw = threeWhys[0];

  // Only inject if there's meaningful data
  if (!ov && coverages.length === 0 && !tw) return "";

  const executiveCoverageCount = coverages.filter((c: any) => c.coverageLevel === "C-Level" || c.coverageLevel === "VP").length;
  const uncoveredP1 = coverages.filter((c: any) => c.gapJudgment === "P1").length;

  return "\n\n" + buildAccountMapDiagnosticLayer({
    strategicFitScore: (ov as any)?.strategicFitScore ?? null,
    executiveCoverageCount: executiveCoverageCount || null,
    uncoveredPriorityLayers: uncoveredP1 || null,
    competitorAdvantageCount: null,
    whyChangeScore: (tw as any)?.whyChangeScore ?? null,
    whyNowScore: (tw as any)?.whyNowScore ?? null,
    whyUsScore: (tw as any)?.whyUsScore ?? null,
    reframeEvidence: (tw as any)?.reframeEvidence ?? null,
  });
}

export async function getDealDiagnosticContext(clientId: number, opportunityId: number): Promise<string> {
  const db = await getDb();
  if (!db) return "";
  const { painMetrics, competitionMap, goNoGo } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");

  const [pains, competitions, goNoGos] = await Promise.all([
    db.select().from(painMetrics).where(eq(painMetrics.opportunityId, opportunityId)),
    db.select().from(competitionMap).where(eq(competitionMap.opportunityId, opportunityId)),
    db.select().from(goNoGo).where(eq(goNoGo.opportunityId, opportunityId)).limit(1),
  ]);

  if (pains.length === 0 && competitions.length === 0 && !goNoGos[0]) return "";

  const painTotal = pains.reduce((sum, p: any) => sum + (p.annualValue ?? 0), 0) || null;
  const noDecisionRisk = (competitions.find((c: any) => c.competitorType === "no_decision") as any)?.riskScore ?? null;
  const criteriaInfluence = (competitions.find((c: any) => c.influencesCriteria) as any)?.controlPoint ?? null;

  const gng = goNoGos[0] as any;
  const gates = gng ? Object.fromEntries(GO_NO_GO_GATE_KEYS.map(k => [k, gng[k] ?? 0])) : null;
  const goNoGoResult = gates ? calculateGoNoGo(gates as any) : null;

  const failedGates = gng ? GO_NO_GO_GATE_KEYS.filter(k => (gng as any)[k] === 0).map(k => k.replace("gate", "").replace(/([0-9]+)/, "$1.")) : null;

  return "\n\n" + buildDealMapDiagnosticLayer({
    painMetricsTotal: painTotal,
    noDecisionRisk,
    competitorInfluencesCriteria: criteriaInfluence,
    dealHealthScore: null, // Deal Health requires full 11-dim input; omit when incomplete
    goNoGoScore: goNoGoResult?.score ?? null,
    failedGates,
  });
}
