// 由已确认证据推导评估（纯函数）。第 2 阶段先实现 MEDDPICC 八维，规则透明、可复核：
// - 只看已确认（confirmed）的证据；
// - 某维度最近一条带建议分的证据决定分数（事实会变化，以最新为准，而不是取历史最高）；
// - 有证据但都没有建议分时记 25，表示“有线索、未量化”；
// - 没有证据的维度不产生评估，页面显示“暂无证据”，不臆造 0 分。

export const MEDDPICC_DIMENSIONS = ["M", "E", "D1", "D2", "P", "I", "C1", "C2"] as const;
export type MeddpiccDimension = (typeof MEDDPICC_DIMENSIONS)[number];

export const UNSCORED_EVIDENCE_SCORE = 25;

export type AssessableEvidence = {
  id: number;
  clientId: number;
  opportunityId: number | null;
  status: string;
  topics: string[];
  suggestedScore: number | null;
  polarity: string;
  claim: string;
  occurredAt: Date | null;
  createdAt: Date;
};

export type ComputedAssessment = {
  scope: "client" | "opportunity";
  targetId: number;
  clientId: number;
  framework: "meddpicc";
  dimension: MeddpiccDimension;
  score: number;
  rationale: string;
  evidenceIds: number[];
};

const timeOf = (item: AssessableEvidence) => (item.occurredAt ?? item.createdAt).getTime();

function assessDimension(items: AssessableEvidence[], dimension: MeddpiccDimension): Omit<ComputedAssessment, "scope" | "targetId" | "clientId" | "framework"> | null {
  const relevant = items
    .filter(item => item.status === "confirmed" && item.topics.includes(dimension))
    .sort((a, b) => timeOf(b) - timeOf(a) || b.id - a.id);
  if (relevant.length === 0) return null;
  const latestScored = relevant.find(item => typeof item.suggestedScore === "number");
  const negatives = relevant.filter(item => item.polarity === "negative").length;
  const score = latestScored ? latestScored.suggestedScore! : UNSCORED_EVIDENCE_SCORE;
  const basis = latestScored ? `以最新一条评分证据为准：「${latestScored.claim.slice(0, 60)}」` : "有相关证据但均未量化";
  const rationale = `${relevant.length} 条已确认证据；${basis}${negatives ? `；其中 ${negatives} 条为不利信号` : ""}。`;
  return { dimension, score, rationale, evidenceIds: relevant.map(item => item.id) };
}

/** 计算一个客户的客户级评估，以及其下每个有证据的商机的商机级评估。 */
export function computeMeddpiccAssessments(clientId: number, items: AssessableEvidence[]): ComputedAssessment[] {
  const own = items.filter(item => item.clientId === clientId);
  const results: ComputedAssessment[] = [];
  const push = (scope: "client" | "opportunity", targetId: number, pool: AssessableEvidence[]) => {
    for (const dimension of MEDDPICC_DIMENSIONS) {
      const assessed = assessDimension(pool, dimension);
      if (assessed) results.push({ scope, targetId, clientId, framework: "meddpicc", ...assessed });
    }
  };
  // 客户级：该客户的全部证据
  push("client", clientId, own);
  // 商机级：只用挂在该商机下的证据
  const opportunityIds = Array.from(new Set(own.map(item => item.opportunityId).filter((id): id is number => typeof id === "number")));
  for (const opportunityId of opportunityIds) push("opportunity", opportunityId, own.filter(item => item.opportunityId === opportunityId));
  return results;
}
