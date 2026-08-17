import { describe, expect, it } from "vitest";
import { buildAdCommandRecommendations } from "../shared/adCommand";

describe("AD 指挥建议生成", () => {
  const now = new Date("2026-08-17T00:00:00.000Z");

  it("仅用已入库事实识别 P0 客户对话中断", () => {
    const recommendations = buildAdCommandRecommendations([{ id: 1, name: "客户A", stage: "进门", priority: "P0", lastMeetingAt: "2026-07-01", championScore: 3 }], [], now);
    expect(recommendations[0]).toMatchObject({ priority: "P0", clientId: 1, methodology: "0→1 作战节奏 · 购买信号验证" });
    expect(recommendations[0].facts.some(f => f.label === "最后有效对话" && f.value === "47 天前")).toBe(true);
  });

  it("没有有效对话事实基线时不把 P0 客户误判为异常", () => {
    const recommendations = buildAdCommandRecommendations([{ id: 1, name: "客户A", stage: "建图", priority: "P0", lastMeetingAt: null, championScore: 0 }], [], now);
    expect(recommendations).toHaveLength(0);
  });

  it("优先把已确认的 AD 经营行动转为待确认指令", () => {
    const recommendations = buildAdCommandRecommendations([], [], now, [{ id: 71, clientId: 150001, opportunityId: 1, clientName: "香港电讯", title: "与 Marcos 对齐年底签单路径", objective: "确认高层路径", priority: "高", timeframe: "本月", responsibleRole: "AD" }]);
    expect(recommendations[0]).toMatchObject({ priority: "P0", clientId: 150001, fingerprint: "ad-action-71" });
  });

  it("将停滞商机与明确的 MEDDPICC 缺口关联", () => {
    const recommendations = buildAdCommandRecommendations([], [{ id: 8, clientId: 1, clientName: "客户A", name: "EDR", stage: "技术验证", status: "活跃", stageChangedAt: "2026-07-01", weakestDimension: "竞争态势", weakestScore: 1 }], now);
    expect(recommendations[0]).toMatchObject({ opportunityId: 8, kind: "anomaly", priority: "P0" });
    expect(recommendations[0].aiConclusion).toContain("竞争态势");
  });

  it("不为已关闭商机生成建议", () => {
    const recommendations = buildAdCommandRecommendations([], [{ id: 8, clientId: 1, clientName: "客户A", name: "EDR", stage: "赢单", status: "赢单", stageChangedAt: "2026-01-01" }], now);
    expect(recommendations).toHaveLength(0);
  });
});
