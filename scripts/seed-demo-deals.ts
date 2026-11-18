// 用真实提取链路生成演示数据：读取 evals/cases/deal-stories.json 中的虚构交易故事，
// 为每个故事新建一个客户，把每份素材作为“投喂”写入并调用与线上相同的 AI 提取，
// 按 server/evidence/dealStories.ts 的自动确认规则确认候选证据，最后重算评分。
//
// 只新增、不删除：同名客户已存在时跳过该故事。默认只打印计划，加 --apply 才写入。
//
// 用法：
//   pnpm tsx scripts/seed-demo-deals.ts                       # 只检查，打印计划
//   pnpm tsx scripts/seed-demo-deals.ts --apply --user-id 1   # 以 users.id=1 作为录入人写入
//   pnpm tsx scripts/seed-demo-deals.ts --apply --user-id 1 --story securities-edr-progress
//
// 需要 DATABASE_URL，以及系统设置中可用的 AI 模型 Key。

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { and, eq, inArray } from "drizzle-orm";
import { assessments, clients, evidence, ingestions, users } from "../drizzle/schema";
import { getDb } from "../server/db";
import { recomputeClientAssessments } from "../server/evidence/assessmentStore";
import type { DealStory } from "../server/evidence/dealStories";
import { runIngestionExtraction } from "../server/evidence/ingestionJobs";

const here = dirname(fileURLToPath(import.meta.url));
const CONFIRMER = "演示数据脚本";
const DEMO_NOTE = "演示数据：由 scripts/seed-demo-deals.ts 用真实提取链路生成，客户、人物与事件均为虚构。";

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const onlyStory = argValue("story");
  const userId = Number(argValue("user-id"));

  const stories = (JSON.parse(readFileSync(resolve(here, "../evals/cases/deal-stories.json"), "utf8")) as DealStory[])
    .filter(story => !onlyStory || story.id === onlyStory);
  if (stories.length === 0) throw new Error(`没有名为 ${onlyStory} 的故事`);

  const db = await getDb();
  if (!db) throw new Error("无法连接数据库：请设置 DATABASE_URL");

  let user: { id: number; name: string | null; email: string | null } | undefined;
  if (apply) {
    if (!Number.isInteger(userId) || userId <= 0) throw new Error("--apply 时必须用 --user-id 指定录入人（users.id）");
    [user] = await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new Error(`users 表中没有 id=${userId}`);
  }

  for (const story of stories) {
    const [existing] = await db.select({ id: clients.id }).from(clients).where(eq(clients.name, story.client.name)).limit(1);
    if (existing) {
      console.log(`跳过「${story.client.name}」：同名客户已存在（id=${existing.id}）`);
      continue;
    }
    console.log(`\n「${story.client.name}」${story.description}`);
    for (const material of story.materials) console.log(`  · ${material.occurredAt} ${material.kind} ${material.title}（${material.text.length} 字）`);
    if (!apply) continue;

    const [created] = await db.insert(clients).values({ name: story.client.name, industry: story.client.industry ?? null, notes: DEMO_NOTE });
    const clientId = Number((created as any).insertId);
    const ingestionIds: number[] = [];
    for (const material of story.materials) {
      const [result] = await db.insert(ingestions).values({
        clientId,
        kind: material.kind,
        title: material.title,
        occurredAt: new Date(`${material.occurredAt}T00:00:00Z`),
        rawText: material.text,
        status: "pending",
        createdByUserId: user!.id,
        createdByName: user!.name || user!.email || CONFIRMER,
      });
      const ingestionId = Number((result as any).insertId);
      ingestionIds.push(ingestionId);
      await runIngestionExtraction(ingestionId);
      const [row] = await db.select({ status: ingestions.status, error: ingestions.error, candidateCount: ingestions.candidateCount }).from(ingestions).where(eq(ingestions.id, ingestionId)).limit(1);
      console.log(`  ✓ ${material.title}：${row?.status === "done" ? `${row.candidateCount} 条候选` : `失败 ${row?.error ?? ""}`}`);
    }

    // 与评测相同的自动确认规则：把握度 low 的候选留给人工确认
    const now = new Date();
    const candidates = await db.select({ id: evidence.id, confidence: evidence.confidence }).from(evidence).where(and(
      eq(evidence.sourceType, "ingestion"), inArray(evidence.sourceId, ingestionIds), eq(evidence.status, "candidate"),
    ));
    const toConfirm = candidates.filter(item => item.confidence !== "low").map(item => item.id);
    if (toConfirm.length) await db.update(evidence).set({ status: "confirmed", confirmedBy: CONFIRMER, confirmedAt: now }).where(inArray(evidence.id, toConfirm));
    await recomputeClientAssessments(clientId);

    const scores = await db.select({ dimension: assessments.dimension, score: assessments.score }).from(assessments).where(and(eq(assessments.clientId, clientId), eq(assessments.scope, "client")));
    console.log(`  已确认 ${toConfirm.length} 条，留待人工 ${candidates.length - toConfirm.length} 条；客户 id=${clientId}`);
    console.log(`  证据分：${scores.map(item => `${item.dimension}=${item.score}`).join("  ") || "无"}`);
  }
  if (!apply) console.log("\n[只检查] 未写入任何数据。确认后加 --apply --user-id <users.id> 重新运行。");
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
