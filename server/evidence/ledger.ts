// 证据台账写入。迁移第 1 阶段为“双写”：原有表照常写入，同时写证据台账。
// 台账写入失败只记日志，不影响原有业务流程。

import { and, eq, inArray } from "drizzle-orm";
import { evidence } from "../../drizzle/schema";
import { getDb } from "../db";
import type { EvidenceDraft } from "./mapping";

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
  });
}

/** 人工录入、无需再确认的证据。 */
export async function recordConfirmed(draft: EvidenceDraft, confirmedBy: string): Promise<void> {
  await safely("recordConfirmed", async () => {
    const db = await getDb();
    if (!db) return;
    await db.insert(evidence).values({ ...draft, status: "confirmed", confirmedBy, confirmedAt: new Date() });
  });
}

/** 原始记录被删除时，对应证据标记为驳回（保留痕迹，不物理删除）。 */
export async function rejectBySource(source: { sourceType: EvidenceDraft["sourceType"]; sourceId: number }): Promise<void> {
  await safely("rejectBySource", async () => {
    const db = await getDb();
    if (!db) return;
    await db.update(evidence).set({ status: "rejected" }).where(and(eq(evidence.sourceType, source.sourceType), eq(evidence.sourceId, source.sourceId)));
  });
}
