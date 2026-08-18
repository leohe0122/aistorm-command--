import { describe, expect, it } from "vitest";
import { parseNativeAdOutput, snapshotFingerprint, type AdBattlefieldSnapshot } from "./adNativeAnalysis";

const snapshot: AdBattlefieldSnapshot = {
  generatedAt: "2026-08-18",
  clients: [{
    id: 1, name: "香港电讯", stage: "进入商机", stageDays: 12, daysSinceLastMeeting: 3, totalMeetings: 2, purchaseSignalCount: 3,
    meddpicc: { champion: 2, economicBuyer: 3, decisionCriteria: 2, decisionProcess: 2, paperProcess: 1, pain: 3, competition: 1, metrics: 2 },
    assignedSam: "Vivian", activeOpportunities: [{ id: 8, name: "EDR", stage: "技术验证", stageDays: 20, estimatedValue: "300K", weakestDimension: "竞争态势", weakestScore: 1 }],
  }],
  teamStats: { totalClients: 1, stageDistribution: { "进入商机": 1 }, totalActiveOpportunities: 1, samList: [{ name: "Vivian", clientCount: 1 }] },
};

describe("adNativeAnalysis", () => {
  it("只接受快照中存在的客户与商机引用", () => {
    const result = parseNativeAdOutput(JSON.stringify({
      battlefieldSummary: "商机竞争维度需 AD 介入", funnelHealth: "数据有限", winRisk: "竞争态势弱", teamPattern: "数据不足",
      recommendations: [
        { clientId: 1, opportunityId: 8, kind: "today_action", urgency: "本周推进", title: "对齐竞争路径", judgment: "竞争态势只有1分", adAction: "AD 与 Marcos 对齐差异化路径", methodology: "MEDDPICC竞争态势", evidenceFacts: [{ label: "竞争态势", value: "1/4" }] },
        { clientId: 99, opportunityId: null, kind: "anomaly", urgency: "立即处理", title: "无效", judgment: "无效", adAction: "无效", methodology: "无效", evidenceFacts: [] },
      ],
    }), snapshot);
    expect(result?.recommendations).toHaveLength(1);
    expect(result?.recommendations[0].opportunityId).toBe(8);
  });

  it("相同事实快照生成稳定指纹", () => {
    expect(snapshotFingerprint(snapshot)).toBe(snapshotFingerprint({ ...snapshot, generatedAt: "2026-08-19" }));
  });
});
