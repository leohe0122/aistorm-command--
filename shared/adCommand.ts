export type CommandFact = { label: string; value: string };

export type GeneratedCommandRecommendation = {
  clientId: number | null;
  opportunityId: number | null;
  kind: "today_action" | "anomaly" | "pending_approval" | "sam_coaching";
  priority: "P0" | "P1" | "P2";
  title: string;
  aiConclusion: string;
  facts: CommandFact[];
  methodology: string;
  suggestedAction: string;
  assignedRole: "AD" | "SAM" | "SA" | "RSM";
  fingerprint: string;
};

type ClientInput = {
  id: number;
  name: string;
  stage: string;
  priority: string;
  stageChangedAt?: Date | string | null;
  lastMeetingAt?: Date | string | null;
  championScore?: number | null;
  assignedSamName?: string | null;
};

type OpportunityInput = {
  id: number;
  clientId: number;
  clientName: string;
  name: string;
  stage: string;
  status: string;
  stageChangedAt?: Date | string | null;
  weakestDimension?: string | null;
  weakestScore?: number | null;
};

function daysSince(value?: Date | string | null, now = new Date()) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((now.getTime() - date.getTime()) / 86_400_000);
}

/**
 * 基于真实字段的可解释排序。它不编造风险，也不调用 LLM 代替事实判断。
 */
export function buildAdCommandRecommendations(
  clients: ClientInput[],
  opportunities: OpportunityInput[],
  now = new Date(),
): GeneratedCommandRecommendation[] {
  const result: GeneratedCommandRecommendation[] = [];

  for (const client of clients) {
    if (client.stage === "进入商机") continue;
    const days = daysSince(client.lastMeetingAt, now);
    if (client.priority === "P0" && (days === null || days > 30)) {
      result.push({
        clientId: client.id, opportunityId: null, kind: "today_action", priority: "P0",
        title: `介入 ${client.name} 的客户对话恢复`,
        aiConclusion: days === null ? "P0 客户尚无已入库有效对话" : `P0 客户已 ${days} 天无有效对话`,
        facts: [
          { label: "客户优先级", value: client.priority },
          { label: "最后有效对话", value: days === null ? "尚无入库记录" : `${days} 天前` },
          { label: "当前阶段", value: client.stage },
        ],
        methodology: "0→1 作战节奏 · 购买信号验证",
        suggestedAction: "由 AD 确认一次高价值客户接触或升级路径，并指定 SAM 在会后回填购买信号事实。",
        assignedRole: "AD", fingerprint: `p0-contact-${client.id}-${days ?? "none"}`,
      });
    }
    if ((client.championScore ?? 0) <= 1) {
      result.push({
        clientId: client.id, opportunityId: null, kind: "sam_coaching", priority: "P1",
        title: `辅导 ${client.name} 的内部推动者识别`,
        aiConclusion: "Champion 证据不足，客户关系缺少内部推动力",
        facts: [
          { label: "Champion 证据", value: `${client.championScore ?? 0}/4` },
          { label: "负责 SAM", value: client.assignedSamName || "未分配" },
          { label: "客户阶段", value: client.stage },
        ],
        methodology: "Buying Group · Champion 真实性",
        suggestedAction: "由 AD 与 SAM 明确一个可验证的内部推动者接触计划，而非仅提高评分。",
        assignedRole: "AD", fingerprint: `champion-gap-${client.id}-${client.championScore ?? 0}`,
      });
    }
  }

  for (const opp of opportunities) {
    if (["赢单", "丢单"].includes(opp.status) || ["赢单", "丢单"].includes(opp.stage)) continue;
    const days = daysSince(opp.stageChangedAt, now);
    if (days !== null && days > 30) {
      const dim = opp.weakestDimension || "关键赢单证据";
      const score = opp.weakestScore ?? 0;
      result.push({
        clientId: opp.clientId, opportunityId: opp.id, kind: "anomaly", priority: "P0",
        title: `介入 ${opp.clientName} · ${opp.name} 的停滞战线`,
        aiConclusion: `商机停滞 ${days} 天，${dim} 证据不足`,
        facts: [
          { label: "商机阶段", value: opp.stage },
          { label: "阶段停留", value: `${days} 天` },
          { label: dim, value: `${score}/4` },
        ],
        methodology: "1→N · MEDDPICC 证据与阶段推进",
        suggestedAction: `由 AD 审阅 ${dim} 缺口，确认需要高层介入、资源协调或退回 SAM 补证。`,
        assignedRole: "AD", fingerprint: `opp-stagnant-${opp.id}-${opp.stage}-${days}-${dim}-${score}`,
      });
    }
  }

  const rank = { P0: 0, P1: 1, P2: 2 };
  return result.sort((a, b) => rank[a.priority] - rank[b.priority]).slice(0, 12);
}
