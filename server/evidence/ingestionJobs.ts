// 投喂素材的后台提取任务。
// 提取在请求返回后于进程内异步执行；如果服务在提取途中重启，记录会永远停在 pending。
// 这里提供：统一的提取执行入口（新投喂与重试共用）、超时判定、过期 pending 的回收，以及重试。
// 不需要新表或新字段：判定依据是 ingestions.updatedAt（每次状态变化自动刷新）。

import { and, eq, lt } from "drizzle-orm";
import { getDb } from "../db";

/** AI 提取本身 90 秒超时；超过这个时长仍为 pending，说明任务已中断（例如服务重启）。 */
export const INGESTION_STALE_MS = 5 * 60 * 1000;
export const STALE_ERROR_MESSAGE = "提取中断（服务重启或处理超时），素材已保存，可点击重试";

export type IngestionStatusRow = { status: "pending" | "done" | "failed"; updatedAt: Date | string | null };

export function isStaleIngestion(row: IngestionStatusRow, now: Date = new Date(), staleMs = INGESTION_STALE_MS): boolean {
  if (row.status !== "pending" || !row.updatedAt) return false;
  const updated = row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt);
  if (Number.isNaN(updated.getTime())) return false;
  return now.getTime() - updated.getTime() > staleMs;
}

/** 失败或已中断的素材可以重试；正在处理（未过期）或已完成的不行。 */
export function canRetryIngestion(row: IngestionStatusRow, now: Date = new Date()): boolean {
  return row.status === "failed" || isStaleIngestion(row, now);
}

/** 重试权限：录入人本人、AD 与管理员。 */
export function canManageIngestion(user: { userId: number; role: string; podRole: string | null }, createdByUserId: number): boolean {
  return user.role === "admin" || user.podRole === "AD" || user.userId === createdByUserId;
}

/** 把超过时限仍为 pending 的记录标记为失败。服务启动时与查询状态时调用。返回被回收的条数。 */
export async function recoverStaleIngestions(now: Date = new Date()): Promise<number> {
  try {
    const db = await getDb();
    if (!db) return 0;
    const { ingestions } = await import("../../drizzle/schema");
    const cutoff = new Date(now.getTime() - INGESTION_STALE_MS);
    const [result] = await db.update(ingestions)
      .set({ status: "failed", error: STALE_ERROR_MESSAGE })
      .where(and(eq(ingestions.status, "pending"), lt(ingestions.updatedAt, cutoff)));
    return Number((result as any)?.affectedRows ?? 0);
  } catch (err: any) {
    console.warn("[ingest] stale recovery failed:", err?.message);
    return 0;
  }
}

/** 执行一条素材的 AI 提取并写入候选证据。任何异常都把记录标为 failed，不会留在 pending。 */
export async function runIngestionExtraction(ingestionId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const { ingestions, clients: clientsTable, keyContacts } = await import("../../drizzle/schema");
  try {
    const [row] = await db.select().from(ingestions).where(eq(ingestions.id, ingestionId)).limit(1);
    if (!row) return;
    const [client] = await db.select({ name: clientsTable.name }).from(clientsTable).where(eq(clientsTable.id, row.clientId)).limit(1);
    if (!client) throw new Error("客户不存在");
    const occurredAt = row.occurredAt ?? row.createdAt ?? new Date();
    const contacts = await db.select({ name: keyContacts.name }).from(keyContacts).where(eq(keyContacts.clientId, row.clientId)).limit(50);
    const { extractEvidence } = await import("../ai/evidenceExtraction");
    const extracted = await extractEvidence({
      clientName: client.name,
      kind: row.kind,
      title: row.title ?? undefined,
      occurredAt: new Date(occurredAt).toISOString().slice(0, 10),
      text: row.rawText,
      knownContacts: contacts.map(contact => contact.name).filter(Boolean),
    });
    const { extractedToEvidence } = await import("./mapping");
    const { replaceCandidates } = await import("./ledger");
    await replaceCandidates(
      { sourceType: "ingestion", sourceId: ingestionId },
      extractedToEvidence(extracted.items, { clientId: row.clientId, opportunityId: row.opportunityId ?? undefined, ingestionId, kind: row.kind, occurredAt: new Date(occurredAt) }),
      extracted.aiRunId,
    );
    await db.update(ingestions).set({ status: "done", error: null, summary: extracted.summary || null, candidateCount: extracted.items.length, aiRunId: extracted.aiRunId ?? null }).where(eq(ingestions.id, ingestionId));
  } catch (err: any) {
    console.error("[ingest] extraction failed:", err?.message);
    try {
      await db.update(ingestions).set({ status: "failed", error: String(err?.message || "未知错误").slice(0, 500) }).where(eq(ingestions.id, ingestionId));
    } catch (updateErr: any) {
      // 数据库也不可用时只能留在 pending；之后会被 recoverStaleIngestions 回收。
      console.error("[ingest] could not mark failure:", updateErr?.message);
    }
  }
}

/** 在后台启动提取，不阻塞请求。 */
export function startIngestionExtraction(ingestionId: number): void {
  void Promise.resolve().then(() => runIngestionExtraction(ingestionId));
}
