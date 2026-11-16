// 只读：生成“旧手工分 vs 证据推导分”对账报告（Markdown 输出到标准输出）。
// 用法：pnpm tsx scripts/report-score-reconciliation.ts > reconciliation.md
// 不写入任何数据。需要 DATABASE_URL。

import { assessments, clients, meddpicc, opportunities, opportunityMeddpicc } from "../drizzle/schema";
import { getDb } from "../server/db";
import { legacyScores, reconcile, renderReconciliationMarkdown, type ReconTarget } from "../server/evidence/reconcile";

async function main() {
  const db = await getDb();
  if (!db) throw new Error("无法连接数据库：请设置 DATABASE_URL");

  const [clientRows, opportunityRows, legacyClient, legacyOpportunity, assessmentRows] = await Promise.all([
    db.select({ id: clients.id, name: clients.name }).from(clients),
    db.select({ id: opportunities.id, clientId: opportunities.clientId, name: opportunities.name }).from(opportunities),
    db.select().from(meddpicc),
    db.select().from(opportunityMeddpicc),
    db.select().from(assessments),
  ]);

  const clientName = new Map(clientRows.map(row => [row.id, row.name]));
  const derived = new Map<string, Partial<Record<string, number>>>();
  for (const row of assessmentRows) {
    if (row.framework !== "meddpicc") continue;
    const key = `${row.scope}:${row.targetId}`;
    const scores = derived.get(key) ?? {};
    const effective = row.overrideScore ?? row.score;
    if (effective !== null && effective !== undefined) scores[row.dimension] = effective;
    derived.set(key, scores);
  }

  const targets: ReconTarget[] = [
    ...clientRows.map(row => ({
      scope: "client" as const,
      targetId: row.id,
      label: row.name,
      legacy: legacyScores(legacyClient.find(item => item.clientId === row.id) as Record<string, unknown> | undefined, 1),
      derived: derived.get(`client:${row.id}`) ?? {},
    })),
    ...opportunityRows.map(row => ({
      scope: "opportunity" as const,
      targetId: row.id,
      label: `${clientName.get(row.clientId) ?? `客户 ${row.clientId}`} / ${row.name}`,
      legacy: legacyScores(legacyOpportunity.find(item => item.opportunityId === row.id) as Record<string, unknown> | undefined, 25),
      derived: derived.get(`opportunity:${row.id}`) ?? {},
    })),
  ];

  process.stdout.write(renderReconciliationMarkdown(reconcile(targets), new Date()));
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
