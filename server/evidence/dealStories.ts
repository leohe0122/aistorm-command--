// 故事化交易素材：同一批虚构故事既是端到端评分评测（evals/cases/deal-stories.json），
// 也是演示数据脚本（scripts/seed-demo-deals.ts）的输入。两边使用同一套“自动确认”规则，
// 保证评测验证的就是写进系统的那条链路。

import type { EvidenceExtractionInput, ExtractedEvidence, IngestionKind } from "../ai/evidenceExtraction";
import { computeMeddpiccAssessments, type AssessableEvidence } from "./assess";

export type DealStoryMaterial = { kind: IngestionKind; title: string; occurredAt: string; text: string };
export type DealStory = {
  id: string;
  description: string;
  client: { name: string; industry?: string };
  materials: DealStoryMaterial[];
};

/** 演示数据的自动确认规则：AI 把握度为 low 的候选留待人工确认，其余视为已确认。 */
export function shouldAutoConfirm(item: Pick<ExtractedEvidence, "confidence">): boolean {
  return item.confidence !== "low";
}

export function materialToExtractionInput(story: DealStory, material: DealStoryMaterial): EvidenceExtractionInput {
  return { clientName: story.client.name, kind: material.kind, title: material.title, occurredAt: material.occurredAt, text: material.text };
}

/**
 * 不访问数据库，按系统规则推演一个故事的最终客户级 MEDDPICC 分数：
 * 每份素材的提取结果按自动确认规则入账，再用 computeMeddpiccAssessments 计分。
 */
export function scoreStory(clientId: number, extracted: Array<{ material: DealStoryMaterial; items: ExtractedEvidence[] }>): {
  scores: Record<string, number>;
  evidence: AssessableEvidence[];
} {
  let nextId = 1;
  const evidence: AssessableEvidence[] = [];
  for (const { material, items } of extracted) {
    const occurredAt = new Date(`${material.occurredAt}T00:00:00Z`);
    for (const item of items) {
      evidence.push({
        id: nextId++,
        clientId,
        opportunityId: null,
        status: shouldAutoConfirm(item) ? "confirmed" : "candidate",
        topics: item.topics,
        suggestedScore: item.suggestedScore,
        polarity: item.polarity,
        claim: item.claim,
        occurredAt,
        createdAt: occurredAt,
      });
    }
  }
  const scores: Record<string, number> = {};
  for (const assessment of computeMeddpiccAssessments(clientId, evidence)) {
    if (assessment.scope === "client") scores[assessment.dimension] = assessment.score;
  }
  return { scores, evidence };
}
