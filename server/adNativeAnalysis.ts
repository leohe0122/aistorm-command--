import { createHash } from "node:crypto";
import { invokeLLM } from "./_core/llm";

export type NativeEvidenceFact = { label: string; value: string };

export type AdBattlefieldSnapshot = {
  generatedAt: string;
  clients: Array<{
    id: number;
    name: string;
    stage: string;
    stageDays: number | null;
    daysSinceLastMeeting: number | null;
    totalMeetings: number;
    purchaseSignalCount: number;
    meddpicc: {
      champion: number;
      economicBuyer: number;
      decisionCriteria: number;
      decisionProcess: number;
      paperProcess: number;
      pain: number;
      competition: number;
      metrics: number;
    };
    assignedSam: string | null;
    activeOpportunities: Array<{
      id: number;
      name: string;
      stage: string;
      stageDays: number | null;
      estimatedValue: string | null;
      weakestDimension: string;
      weakestScore: number;
    }>;
  }>;
  teamStats: {
    totalClients: number;
    stageDistribution: Record<string, number>;
    totalActiveOpportunities: number;
    samList: Array<{ name: string; clientCount: number }>;
  };
};

export type NativeAdRecommendation = {
  clientId: number;
  opportunityId: number | null;
  kind: "today_action" | "anomaly" | "sam_coaching";
  urgency: "立即处理" | "本周推进" | "持续跟进";
  title: string;
  judgment: string;
  adAction: string;
  methodology: string;
  evidenceFacts: NativeEvidenceFact[];
};

export type NativeAdOutput = {
  battlefieldSummary: string;
  funnelHealth: string;
  winRisk: string;
  teamPattern: string;
  recommendations: NativeAdRecommendation[];
};

const URGENCIES = new Set<NativeAdRecommendation["urgency"]>(["立即处理", "本周推进", "持续跟进"]);
const KINDS = new Set<NativeAdRecommendation["kind"]>(["today_action", "anomaly", "sam_coaching"]);

function safeText(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

export function snapshotFingerprint(snapshot: AdBattlefieldSnapshot) {
  const stable = {
    clients: snapshot.clients.map((client) => ({ ...client, activeOpportunities: client.activeOpportunities.slice().sort((a, b) => a.id - b.id) })).sort((a, b) => a.id - b.id),
    teamStats: snapshot.teamStats,
  };
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex").slice(0, 16);
}

export function buildNativeAnalysisPrompt(snapshot: AdBattlefieldSnapshot) {
  return `你是一位有15年经验的企业软件大客户销售总监（AD）。以下是你负责的完整战场原始事实快照。

今天是 ${snapshot.generatedAt}。你必须独立从全量数据识别真正需要 AD 介入的问题和机会；系统没有预先判断哪些客户有问题。

【完整战场快照】
${snapshot.clients.map((client) => `
客户：${client.name}（ID=${client.id}）
阶段：${client.stage}｜停留：${client.stageDays ?? "未知"}天｜距上次拜访：${client.daysSinceLastMeeting ?? "无记录"}天｜累计拜访：${client.totalMeetings}次
购买信号：${client.purchaseSignalCount}/3｜负责 SAM：${client.assignedSam ?? "未分配"}
MEDDPICC：Champion=${client.meddpicc.champion}/4｜EB=${client.meddpicc.economicBuyer}/4｜Pain=${client.meddpicc.pain}/4｜DC=${client.meddpicc.decisionCriteria}/4｜DP=${client.meddpicc.decisionProcess}/4｜Paper=${client.meddpicc.paperProcess}/4｜Comp=${client.meddpicc.competition}/4｜Metrics=${client.meddpicc.metrics}/4
活跃商机：${client.activeOpportunities.length}个${client.activeOpportunities.map((opportunity) => `
  - ${opportunity.name}（ID=${opportunity.id}，${opportunity.stage}，停留${opportunity.stageDays ?? "未知"}天，最弱维度：${opportunity.weakestDimension} ${opportunity.weakestScore}/4${opportunity.estimatedValue ? `，预估${opportunity.estimatedValue}` : ""}）`).join("")}`).join("\n")}

【团队概况】
总客户：${snapshot.teamStats.totalClients}｜活跃商机：${snapshot.teamStats.totalActiveOpportunities}
阶段分布：${JSON.stringify(snapshot.teamStats.stageDistribution)}
SAM 负荷：${snapshot.teamStats.samList.map((sam) => `${sam.name}(${sam.clientCount}个)`).join("｜")}

规则：
1. 只引用上述存在的事实，绝不编造客户意图、人物、预算、竞争或承诺。
2. 不是所有客户都有问题；没有真实风险不要列入。字段数据不足时明确说“数据不足”。
3. recommendations 最多8条，优先季度业绩影响最大的 AD 介入事项。
4. judgment 与 adAction 必须具体可执行，adAction 必须是 AD 动作而非泛化的“跟进”。
5. evidenceFacts 必须从上方快照逐字可验证地摘取，最多4条。

请只输出合法 JSON：
{
  "battlefieldSummary":"≤60字全局第一判断",
  "funnelHealth":"≤80字漏斗健康分析",
  "winRisk":"≤80字赢单风险识别",
  "teamPattern":"≤80字团队能力模式",
  "recommendations":[{
    "clientId":数字,
    "opportunityId":数字或null,
    "kind":"today_action|anomaly|sam_coaching",
    "urgency":"立即处理|本周推进|持续跟进",
    "title":"≤28字",
    "judgment":"≤50字方法论判断",
    "adAction":"≤50字 AD 具体动作",
    "methodology":"≤24字方法论名称",
    "evidenceFacts":[{"label":"","value":""}]
  }]
}`;
}

export function parseNativeAdOutput(raw: string, snapshot: AdBattlefieldSnapshot): NativeAdOutput | null {
  try {
    const parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "")) as Partial<NativeAdOutput>;
    const clients = new Map(snapshot.clients.map((client) => [client.id, client]));
    const recommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations.flatMap((item): NativeAdRecommendation[] => {
      const candidate = item as Partial<NativeAdRecommendation>;
      const client = clients.get(Number(candidate.clientId));
      if (!client || !KINDS.has(candidate.kind as NativeAdRecommendation["kind"]) || !URGENCIES.has(candidate.urgency as NativeAdRecommendation["urgency"])) return [];
      const opportunityId = candidate.opportunityId === null || candidate.opportunityId === undefined ? null : Number(candidate.opportunityId);
      if (opportunityId !== null && !client.activeOpportunities.some((opportunity) => opportunity.id === opportunityId)) return [];
      const title = safeText(candidate.title, 56);
      const judgment = safeText(candidate.judgment, 100);
      const adAction = safeText(candidate.adAction, 100);
      const methodology = safeText(candidate.methodology, 48);
      if (!title || !judgment || !adAction || !methodology) return [];
      return [{
        clientId: client.id,
        opportunityId,
        kind: candidate.kind as NativeAdRecommendation["kind"],
        urgency: candidate.urgency as NativeAdRecommendation["urgency"],
        title,
        judgment,
        adAction,
        methodology,
        evidenceFacts: Array.isArray(candidate.evidenceFacts) ? candidate.evidenceFacts.slice(0, 4).flatMap((fact): NativeEvidenceFact[] => {
          const label = safeText((fact as NativeEvidenceFact).label, 40);
          const value = safeText((fact as NativeEvidenceFact).value, 100);
          return label && value ? [{ label, value }] : [];
        }) : [],
      }];
    }).slice(0, 8) : [];
    return {
      battlefieldSummary: safeText(parsed.battlefieldSummary, 120) || "数据不足，暂不判断",
      funnelHealth: safeText(parsed.funnelHealth, 160) || "数据不足，暂不判断",
      winRisk: safeText(parsed.winRisk, 160) || "数据不足，暂不判断",
      teamPattern: safeText(parsed.teamPattern, 160) || "数据不足，暂不判断",
      recommendations,
    };
  } catch {
    return null;
  }
}

export async function runNativeAdAnalysis(snapshot: AdBattlefieldSnapshot): Promise<NativeAdOutput | null> {
  if (!snapshot.clients.length) return null;
  try {
    const response = await invokeLLM({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "你是严谨的企业软件大客户销售总监。仅基于原始事实快照输出可解析 JSON。" },
        { role: "user", content: buildNativeAnalysisPrompt(snapshot) },
      ],
      maxTokens: 2600,
    });
    return parseNativeAdOutput(String(response.choices?.[0]?.message?.content || ""), snapshot);
  } catch {
    return null;
  }
}
