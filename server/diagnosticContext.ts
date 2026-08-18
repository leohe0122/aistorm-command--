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
  const { accountOverview, relationshipCoverage, threeWhy, painMetrics, goNoGo, opportunities } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");

  const [overviews, coverages, threeWhys, pains, opps] = await Promise.all([
    db.select().from(accountOverview).where(eq(accountOverview.clientId, clientId)).limit(1),
    db.select().from(relationshipCoverage).where(eq(relationshipCoverage.clientId, clientId)),
    db.select().from(threeWhy).where(eq(threeWhy.clientId, clientId)).limit(1),
    db.select().from(painMetrics).where(eq(painMetrics.clientId, clientId)),
    db.select().from(opportunities).where(eq(opportunities.clientId, clientId)),
  ]);

  const ov = overviews[0];
  const tw = threeWhys[0];
  const painTotal = pains.reduce((sum, p: any) => sum + (p.annualValue ?? 0), 0);

  // Fetch Go/No-Go for the first active opportunity
  const activeOpp = opps.find((o: any) => o.status !== "丢单");
  let goNoGoStatus: string | null = null;
  let weakestGate: string | null = null;
  if (activeOpp) {
    const [gng] = await db.select().from(goNoGo).where(eq(goNoGo.opportunityId, activeOpp.id)).limit(1);
    if (gng) {
      const result = calculateGoNoGo(gng as any);
      goNoGoStatus = result.status;
      const failed = GO_NO_GO_GATE_KEYS.filter(k => (gng as any)[k] === 0);
      weakestGate = failed.length ? failed[0].replace("gate", "").replace(/([0-9]+)/, "Gate $1: ") : null;
    }
  }

  // Only inject if there's meaningful data
  if (!ov && coverages.length === 0 && !tw && painTotal === 0 && !goNoGoStatus) return "";

  const executiveCoverageCount = coverages.filter((c: any) => c.coverageLevel === "C-Level" || c.coverageLevel === "VP").length;
  const uncoveredP1 = coverages.filter((c: any) => c.gapJudgment === "P1").length;

  const accountLayer = buildAccountMapDiagnosticLayer({
    strategicFitScore: (ov as any)?.strategicFitScore ?? null,
    executiveCoverageCount: executiveCoverageCount || null,
    uncoveredPriorityLayers: uncoveredP1 || null,
    competitorAdvantageCount: null,
    whyChangeScore: (tw as any)?.whyChangeScore ?? null,
    whyNowScore: (tw as any)?.whyNowScore ?? null,
    whyUsScore: (tw as any)?.whyUsScore ?? null,
    reframeEvidence: (tw as any)?.reframeEvidence ?? null,
  });

  // Append Pain & Go/No-Go context for visit preparation
  const visitContext = `
Pain 年度量化价值：${painTotal > 0 ? `$${painTotal.toLocaleString()}` : "数据不足——此次拜访需推进价值量化"}
Go/No-Go 门控状态：${goNoGoStatus ?? "数据不足"}
最弱 Go/No-Go 门控：${weakestGate ?? "数据不足"}

基于以上事实，拜访前洞察必须：
- 针对最弱 3 Why 因子设计问题（而非泛化的"了解需求"）
- 如果 Pain 年度价值未量化，提供具体的 Metrics 探询问题
- 如果 Go/No-Go 某门控评分为0，建议在此次拜访中获取该门控证据`;

  return "\n\n" + accountLayer + visitContext;
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

/**
 * 武器库方案定制使用的商机级事实摘要。
 * 只返回数据库中已经存在的 Deal Map 事实；缺失项明确保留为数据不足，禁止补写销售判断。
 */
export async function getArsenalOpportunityContext(clientId: number, opportunityId: number): Promise<string> {
  const db = await getDb();
  if (!db) return "";
  const { opportunities, opportunityMeddpicc, threeWhy, painMetrics, competitionMap } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const [opportunityRows, meddpiccRows, whyRows, pains, competitors] = await Promise.all([
    db.select().from(opportunities).where(eq(opportunities.id, opportunityId)).limit(1),
    db.select().from(opportunityMeddpicc).where(eq(opportunityMeddpicc.opportunityId, opportunityId)).limit(1),
    db.select().from(threeWhy).where(eq(threeWhy.opportunityId, opportunityId)).limit(1),
    db.select().from(painMetrics).where(eq(painMetrics.opportunityId, opportunityId)),
    db.select().from(competitionMap).where(eq(competitionMap.opportunityId, opportunityId)),
  ]);
  const opportunity = opportunityRows[0] as any;
  if (!opportunity || opportunity.clientId !== clientId) return "";
  const meddpicc = meddpiccRows[0] as any;
  const why = whyRows[0] as any;
  const dealLayer = await getDealDiagnosticContext(clientId, opportunityId);
  const dimensions = [
    ["M 指标", meddpicc?.metricsScore, meddpicc?.metricsNotes],
    ["E 经济决策人", meddpicc?.economicBuyerScore, meddpicc?.economicBuyerNotes],
    ["D1 决策标准", meddpicc?.decisionCriteriaScore, meddpicc?.decisionCriteriaNotes],
    ["D2 决策流程", meddpicc?.decisionProcessScore, meddpicc?.decisionProcessNotes],
    ["P 采购流程", meddpicc?.paperProcessScore, meddpicc?.paperProcessNotes],
    ["I 痛点牵连", meddpicc?.implicatePainScore, meddpicc?.implicatePainNotes],
    ["C Champion", meddpicc?.championScore, meddpicc?.championNotes],
    ["C2 竞争", meddpicc?.competitionScore, meddpicc?.competitionNotes],
  ] as Array<[string, number | null | undefined, string | null | undefined]>;
  const scored = dimensions.filter(([, score]) => typeof score === "number" && score > 0);
  const weakest = scored.length ? [...scored].sort((a, b) => Number(a[1]) - Number(b[1]))[0] : null;
  const painTotal = pains.reduce((sum, item: any) => sum + (Number(item.annualValue) || 0), 0);
  const painFacts = pains.filter((item: any) => item.painStatement || item.currentBaseline || item.valueLogic).slice(0, 3);
  const competitorFacts = competitors.filter((item: any) => item.competitorName || item.competitorType || item.controlPoints).slice(0, 3);

  return `\n\n【当前商机的已入库 Deal Map 事实】
商机：${opportunity.name}；阶段：${opportunity.stage}
当前最弱 Win 因子：${weakest ? `${weakest[0]}（${Number(weakest[1]) * 25}%）` : "数据不足，暂不判断"}
决策标准（D1）：${meddpicc?.decisionCriteriaNotes || "数据不足"}
痛点牵连（I）：${meddpicc?.implicatePainNotes || "数据不足"}
Why Change：${why?.whyChangeEvidence || why?.whyChangePain || "数据不足"}
Why Now：${why?.whyNowEvidence || why?.whyNowTrigger || "数据不足"}
Why Us：${why?.whyUsEvidence || why?.whyUsDifferentiator || "数据不足"}
已量化年度价值：${painTotal > 0 ? `$${painTotal.toLocaleString()}` : "数据不足，暂不判断"}
痛点明细：${painFacts.length ? painFacts.map((item: any) => item.painStatement || item.currentBaseline || item.valueLogic).join("；") : "数据不足"}
已入库竞争事实：${competitorFacts.length ? competitorFacts.map((item: any) => item.competitorName || item.competitorType || item.controlPoints).join("；") : opportunity.blueSheetCompetitor || opportunity.competitorName || "数据不足"}

材料必须围绕上述事实短板设计。不得将缺失维度、未验证竞品主张或客户意图写成确定结论；需要补充时使用“待验证假设”或“数据不足，暂不判断”。${dealLayer}`;
}
