/**
 * 事件驱动的单客户原生研判触发。
 * 非阻塞调用：不影响原始 mutation 的响应时间。
 * 仅在事实变化后触发，避免无意义重复。
 */
export async function triggerSingleClientRefresh(clientId: number) {
  try {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return;
    const { clients, meetingMinutes, meddpicc, opportunities, opportunityMeddpicc,
      customerPurchaseSignals, keyContacts, accountOverview, relationshipCoverage,
      threeWhy, painMetrics, competitionMap, goNoGo, adCommandRecommendations } = await import("../drizzle/schema");
    const { eq, desc } = await import("drizzle-orm");
    const { snapshotFingerprint, runNativeAdAnalysis, NATIVE_METHODOLOGY_VERSION } = await import("./adNativeAnalysis");
    const { calculateDealHealth, calculateGoNoGo, GO_NO_GO_GATE_KEYS } = await import("../shared/command2");

    // Build single-client snapshot
    const [clientRow] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
    if (!clientRow) return;

    const [meetings, scores, opps, contacts, signals, accOv, coverages, whys, pains, comps] = await Promise.all([
      db.select().from(meetingMinutes).where(eq(meetingMinutes.clientId, clientId)),
      db.select().from(meddpicc).where(eq(meddpicc.clientId, clientId)).limit(1),
      db.select().from(opportunities).where(eq(opportunities.clientId, clientId)),
      db.select().from(keyContacts).where(eq(keyContacts.clientId, clientId)),
      db.select().from(customerPurchaseSignals).where(eq(customerPurchaseSignals.clientId, clientId)),
      db.select().from(accountOverview).where(eq(accountOverview.clientId, clientId)).limit(1),
      db.select().from(relationshipCoverage).where(eq(relationshipCoverage.clientId, clientId)),
      db.select().from(threeWhy).where(eq(threeWhy.clientId, clientId)),
      db.select().from(painMetrics).where(eq(painMetrics.clientId, clientId)),
      db.select().from(competitionMap).where(eq(competitionMap.clientId, clientId)),
    ]);

    const score = scores[0] as any;
    const activeOpps = opps.filter((o: any) => o.status !== "丢单");
    const latestMeeting = meetings.sort((a: any, b: any) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime())[0];
    const stageDays = (d: any) => d ? Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000) : null;

    // Fetch opp-level MEDDPICC for weakest dimension
    const oppScores = await Promise.all(activeOpps.map(async (o: any) => {
      const [s] = await db.select().from(opportunityMeddpicc).where(eq(opportunityMeddpicc.opportunityId, o.id)).limit(1);
      return { oppId: o.id, score: s };
    }));
    const oppScoreMap = new Map(oppScores.map(x => [x.oppId, x.score]));

    // Gate scores
    const gateRows = await Promise.all(activeOpps.map(async (o: any) => {
      const [g] = await db.select().from(goNoGo).where(eq(goNoGo.opportunityId, o.id)).limit(1);
      return { oppId: o.id, gate: g };
    }));
    const gateScores = gateRows.map(g => g.gate ? calculateGoNoGo(g.gate as any).score : null).filter((v): v is number => v !== null);

    const threeWhyMin = whys.length ? Math.min(...whys.map((w: any) => Math.min(Number(w.whyChangeScore ?? 0), Number(w.whyNowScore ?? 0), Number(w.whyUsScore ?? 0)))) : null;
    const execCount = coverages.filter((c: any) => c.hasExecMeeting).length;
    const dealHealthInput = {
      relationshipPower: execCount >= 2 ? 4 : execCount > 0 ? 2 : null,
      meddpicc: score ? Math.round((Number(score.championScore ?? 0) + Number(score.economicBuyerScore ?? 0) + Number(score.decisionCriteriaScore ?? 0) + Number(score.decisionProcessScore ?? 0) + Number(score.paperProcessScore ?? 0) + Number(score.implicatePainScore ?? 0) + Number(score.competitionScore ?? 0) + Number(score.metricsScore ?? 0)) / 8 / 20) : null,
      metricsValue: score ? Math.round(Number(score.metricsScore ?? 0) / 20) : null,
      champion: score ? Math.round(Number(score.championScore ?? 0) / 20) : null,
      accountFit: (accOv[0] as any)?.strategicFitScore ?? null,
      economicBuyer: score ? Math.round(Number(score.economicBuyerScore ?? 0) / 20) : null,
      threeWhy: threeWhyMin != null ? Math.round(threeWhyMin / 20) : null,
      decisionCriteria: score ? Math.round(Number(score.decisionCriteriaScore ?? 0) / 20) : null,
      processPaper: score ? Math.round(Number(score.paperProcessScore ?? 0) / 20) : null,
      competition: score ? Math.round(Number(score.competitionScore ?? 0) / 20) : null,
      actionDiscipline: null,
    };
    const dealHealth = calculateDealHealth(dealHealthInput);

    const dimensionLabels: [string, string][] = [
      ["metricsScore", "M"], ["economicBuyerScore", "E"], ["decisionCriteriaScore", "D1"],
      ["decisionProcessScore", "D2"], ["paperProcessScore", "P"], ["implicatePainScore", "I"],
      ["championScore", "C1"], ["competitionScore", "C2"],
    ];

    const singleClientSnapshot = {
      generatedAt: new Date().toISOString(),
      clients: [{
        id: clientRow.id, name: clientRow.name, stage: clientRow.stage,
        stageDays: stageDays(clientRow.stageChangedAt),
        daysSinceLastMeeting: latestMeeting ? stageDays((latestMeeting as any).meetingDate) : null,
        totalMeetings: meetings.length,
        purchaseSignalCount: signals.length,
        meddpicc: {
          champion: Number(score?.championScore ?? 0), economicBuyer: Number(score?.economicBuyerScore ?? 0),
          decisionCriteria: Number(score?.decisionCriteriaScore ?? 0), decisionProcess: Number(score?.decisionProcessScore ?? 0),
          paperProcess: Number(score?.paperProcessScore ?? 0), pain: Number(score?.implicatePainScore ?? 0),
          competition: Number(score?.competitionScore ?? 0), metrics: Number(score?.metricsScore ?? 0),
        },
        assignedSam: clientRow.assignedSamName ?? null,
        accountFitScore: (accOv[0] as any)?.strategicFitScore ?? null,
        execCoverageCount: execCount,
        competitorAdvantageCount: comps.filter((c: any) => Number(c.riskScore ?? 0) >= 4).length,
        threeWhyScore: whys.length ? { change: Math.min(...whys.map((w: any) => Number(w.whyChangeScore ?? 0))), now: Math.min(...whys.map((w: any) => Number(w.whyNowScore ?? 0))), us: Math.min(...whys.map((w: any) => Number(w.whyUsScore ?? 0))) } : null,
        painMetricsTotal: pains.length ? pains.reduce((t: number, p: any) => t + Number(p.annualValue ?? 0), 0) : null,
        goNoGoScore: gateScores.length ? Math.min(...gateScores) : null,
        dealHealthScore: dealHealth.score,
        activeOpportunities: activeOpps.map((o: any) => {
          const s = oppScoreMap.get(o.id) as any;
          const weakest = dimensionLabels.map(([key, label]) => ({ label, score: Number(s?.[key] ?? 0) })).sort((a, b) => a.score - b.score)[0];
          return { id: o.id, name: o.name, stage: o.stage, stageDays: stageDays(o.stageChangedAt), estimatedValue: o.estimatedValue ?? null, weakestDimension: weakest?.label ?? "数据不足", weakestScore: weakest?.score ?? 0 };
        }),
      }],
      teamStats: { totalClients: 1, stageDistribution: { [clientRow.stage]: 1 }, totalActiveOpportunities: activeOpps.length, samList: [{ name: clientRow.assignedSamName || "未分配", clientCount: 1 }] },
    };

    // Check fingerprint — skip if unchanged
    const hash = snapshotFingerprint(singleClientSnapshot);
    const eventFingerprint = `native-${hash}-${clientId}-event`;
    const existing = await db.select({ id: adCommandRecommendations.id }).from(adCommandRecommendations).where(eq(adCommandRecommendations.fingerprint, eventFingerprint)).limit(1);
    if (existing.length > 0) return; // No change since last event-driven refresh

    // Run native analysis
    const output = await runNativeAdAnalysis(singleClientSnapshot);
    if (!output || !output.recommendations || output.recommendations.length === 0) return;
    const suggestions = output.recommendations;

    // Insert new suggestions with event-driven fingerprint
    for (let i = 0; i < suggestions.length; i++) {
      const s = suggestions[i];
      const fp = `native-${hash}-${clientId}-event-${i}`;
      const existingFp = await db.select({ id: adCommandRecommendations.id }).from(adCommandRecommendations).where(eq(adCommandRecommendations.fingerprint, fp)).limit(1);
      if (existingFp.length > 0) continue;
      await db.insert(adCommandRecommendations).values({
        clientId: s.clientId ?? clientId,
        opportunityId: s.opportunityId ?? null,
        kind: s.kind ?? "anomaly",
        title: s.title,
        aiConclusion: s.judgment,
        methodology: s.methodology ?? "",
        suggestedAction: s.adAction ?? "",
        evidenceFacts: s.evidenceFacts ?? [],
        priority: s.urgency === "立即处理" ? "P0" : s.urgency === "本周推进" ? "P1" : "P2",
        assignedRole: "AD",
        fingerprint: fp,
        status: "pending",
      } as any);
    }
    console.log(`[Command2] Event-driven refresh for client ${clientId}: ${output.recommendations.length} new suggestions`);
  } catch (e) {
    console.warn("[Command2] Event-driven refresh failed:", e);
  }
}
