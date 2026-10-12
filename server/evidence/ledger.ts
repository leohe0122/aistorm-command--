// 证据台账写入。迁移第 1 阶段为“双写”：原有表照常写入，同时写证据台账。
// 台账写入失败只记日志，不影响原有业务流程。

import { and, eq, inArray } from "drizzle-orm";
import { evidence } from "../../drizzle/schema";
import { getDb } from "../db";
import type { EvidenceDraft } from "./mapping";
import { recomputeClientAssessments } from "./assessmentStore";

async function safely(label: string, task: () => Promise<void>): Promise<void> {
  try {
    await task();
  } catch (err: any) {
    console.warn(`[evidence] ${label} failed:`, err?.message);
  }
}

/** AI 提取完成：用本次结果替换该来源下尚未确认的候选证据。已确认或已驳回的记录保留。 */
export async function replaceCandidates(source: { sourceType: EvidenceDraft["sourceType"]; sourceId: number }, drafts: EvidenceDraft[], aiRunId?: number): Promise<void> {
  await safely("replaceCandidates", async () => {
    const db = await getDb();
    if (!db) return;
    await db.delete(evidence).where(and(eq(evidence.sourceType, source.sourceType), eq(evidence.sourceId, source.sourceId), eq(evidence.status, "candidate")));
    if (drafts.length === 0) return;
    await db.insert(evidence).values(drafts.map(draft => ({ ...draft, status: "candidate" as const, aiRunId: aiRunId ?? null })));
  });
}

/**
 * 人确认了来源中的若干条：已有候选则转为已确认，否则按映射新建已确认记录
 * （覆盖台账上线前就已提取、没有候选记录的历史拜访）。
 */
export async function confirmFromSource(
  source: { sourceType: EvidenceDraft["sourceType"]; sourceId: number },
  keys: string[],
  drafts: EvidenceDraft[],
  confirmedBy: string,
  opportunityId?: number | null,
): Promise<void> {
  if (keys.length === 0) return;
  await safely("confirmFromSource", async () => {
    const db = await getDb();
    if (!db) return;
    const now = new Date();
    const existing = await db.select({ id: evidence.id, sourceKey: evidence.sourceKey }).from(evidence).where(and(
      eq(evidence.sourceType, source.sourceType),
      eq(evidence.sourceId, source.sourceId),
      inArray(evidence.sourceKey, keys),
    ));
    const existingKeys = new Set(existing.map(row => row.sourceKey));
    if (existing.length > 0) {
      await db.update(evidence)
        .set({ status: "confirmed", confirmedBy, confirmedAt: now, ...(opportunityId ? { opportunityId } : {}) })
        .where(inArray(evidence.id, existing.map(row => row.id)));
    }
    const missing = drafts.filter(draft => keys.includes(draft.sourceKey) && !existingKeys.has(draft.sourceKey));
    if (missing.length > 0) {
      await db.insert(evidence).values(missing.map(draft => ({
        ...draft,
        ...(opportunityId ? { opportunityId } : {}),
        status: "confirmed" as const,
        confirmedBy,
        confirmedAt: now,
      })));
    }
    const clientId = drafts[0]?.clientId;
    if (clientId) await recomputeClientAssessments(clientId);
  });
}

/** 人工录入、无需再确认的证据。 */
export async function recordConfirmed(draft: EvidenceDraft, confirmedBy: string): Promise<void> {
  await safely("recordConfirmed", async () => {
    const db = await getDb();
    if (!db) return;
    await db.insert(evidence).values({ ...draft, status: "confirmed", confirmedBy, confirmedAt: new Date() });
    await recomputeClientAssessments(draft.clientId);
  });
}

/** 原始记录被删除时，对应证据标记为驳回（保留痕迹，不物理删除）。 */
export async function rejectBySource(source: { sourceType: EvidenceDraft["sourceType"]; sourceId: number }): Promise<void> {
  await safely("rejectBySource", async () => {
    const db = await getDb();
    if (!db) return;
    const affected = await db.select({ clientId: evidence.clientId }).from(evidence).where(and(eq(evidence.sourceType, source.sourceType), eq(evidence.sourceId, source.sourceId)));
    await db.update(evidence).set({ status: "rejected" }).where(and(eq(evidence.sourceType, source.sourceType), eq(evidence.sourceId, source.sourceId)));
    for (const clientId of Array.from(new Set(affected.map(row => row.clientId)))) await recomputeClientAssessments(clientId);
  });
}

/**
 * 人工审核候选证据：逐条确认或驳回。只处理状态为 candidate 的记录；
 * 无权确认的条目跳过并返回，不中断其余条目。
 */
export async function reviewCandidates(input: {
  confirmIds: number[];
  rejectIds: number[];
  reviewer: { userId: number; role: "admin" | "user"; podRole: string | null; name: string };
}): Promise<{ confirmed: number[]; rejected: number[]; denied: number[] }> {
  const db = await getDb();
  if (!db) throw new Error("数据库暂不可用");
  const { ingestions } = await import("../../drizzle/schema");
  const { canConfirmEvidence } = await import("../../shared/evidencePermissions");
  const ids = Array.from(new Set([...input.confirmIds, ...input.rejectIds]));
  if (ids.length === 0) return { confirmed: [], rejected: [], denied: [] };
  const rows = await db.select().from(evidence).where(and(inArray(evidence.id, ids), eq(evidence.status, "candidate")));
  const ingestionIds = Array.from(new Set(rows.filter(row => row.sourceType === "ingestion" && row.sourceId).map(row => row.sourceId as number)));
  const creators = new Map<number, number>();
  if (ingestionIds.length > 0) {
    for (const row of await db.select({ id: ingestions.id, createdByUserId: ingestions.createdByUserId }).from(ingestions).where(inArray(ingestions.id, ingestionIds))) {
      creators.set(row.id, row.createdByUserId);
    }
  }
  const allowed = (row: (typeof rows)[number]) => canConfirmEvidence(input.reviewer, {
    topics: Array.isArray(row.topics) ? row.topics : [],
    sourceType: row.sourceType,
    ingestionCreatorId: row.sourceId ? creators.get(row.sourceId) ?? null : null,
  });
  const confirmSet = new Set(input.confirmIds);
  const confirmed: number[] = [];
  const rejected: number[] = [];
  const denied: number[] = [];
  for (const row of rows) {
    if (!allowed(row)) { denied.push(row.id); continue; }
    (confirmSet.has(row.id) ? confirmed : rejected).push(row.id);
  }
  const now = new Date();
  if (confirmed.length) await db.update(evidence).set({ status: "confirmed", confirmedBy: input.reviewer.name, confirmedAt: now }).where(inArray(evidence.id, confirmed));
  if (rejected.length) await db.update(evidence).set({ status: "rejected", confirmedBy: input.reviewer.name, confirmedAt: now }).where(inArray(evidence.id, rejected));
  for (const clientId of Array.from(new Set(rows.filter(row => confirmed.includes(row.id) || rejected.includes(row.id)).map(row => row.clientId)))) {
    await recomputeClientAssessments(clientId);
  }
  return { confirmed, rejected, denied };
}
