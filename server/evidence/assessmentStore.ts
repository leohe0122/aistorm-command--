// 评估的持久化：证据确认、新增或驳回后重算该客户的规则评估。
// 规则评估整体替换；人工覆盖（overrideScore）保留在原记录上，重算时按维度带回。

import { and, eq } from "drizzle-orm";
import { assessments, evidence } from "../../drizzle/schema";
import { getDb } from "../db";
import { computeMeddpiccAssessments, type AssessableEvidence } from "./assess";

export async function recomputeClientAssessments(clientId: number): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    const rows = await db.select().from(evidence).where(and(eq(evidence.clientId, clientId), eq(evidence.status, "confirmed")));
    const computed = computeMeddpiccAssessments(clientId, rows.map(row => ({
      id: row.id,
      clientId: row.clientId,
      opportunityId: row.opportunityId,
      status: row.status,
      topics: Array.isArray(row.topics) ? row.topics : [],
      suggestedScore: row.suggestedScore,
      polarity: row.polarity,
      claim: row.claim,
      occurredAt: row.occurredAt,
      createdAt: row.createdAt,
    } satisfies AssessableEvidence)));

    const existing = await db.select().from(assessments).where(and(eq(assessments.clientId, clientId), eq(assessments.framework, "meddpicc")));
    const overrides = new Map(existing
      .filter(row => row.overrideScore !== null)
      .map(row => [`${row.scope}:${row.targetId}:${row.dimension}`, row]));

    await db.delete(assessments).where(and(eq(assessments.clientId, clientId), eq(assessments.framework, "meddpicc")));
    if (computed.length === 0) return;
    const now = new Date();
    await db.insert(assessments).values(computed.map(item => {
      const kept = overrides.get(`${item.scope}:${item.targetId}:${item.dimension}`);
      return {
        ...item,
        computedBy: "rule" as const,
        computedAt: now,
        stale: false,
        overrideScore: kept?.overrideScore ?? null,
        overrideReason: kept?.overrideReason ?? null,
        overrideBy: kept?.overrideBy ?? null,
      };
    }));
  } catch (err: any) {
    console.warn("[assessments] recompute failed:", err?.message);
  }
}
