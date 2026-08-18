import { describe, expect, it } from "vitest";
import { calculateDealHealth, calculateGoNoGo } from "../shared/command2";

describe("Command 2.0 scoring", () => {
  it("按十项门控将资源决策分为 Go、有条件 Go 与 No-Go", () => {
    expect(calculateGoNoGo(null)).toEqual({ score: null, status: "数据不足" });
    expect(calculateGoNoGo({ gate1StrategicFit: 2, gate2PainVerified: 2, gate3ChampionExists: 2, gate4EBClear: 2, gate5ValueQuantified: 2, gate6CriteriaWinnable: 2, gate7ProcessClear: 2, gate8CompDefensible: 2 })).toMatchObject({ score: 16, status: "Go" });
    expect(calculateGoNoGo({ gate1StrategicFit: 1, gate2PainVerified: 1, gate3ChampionExists: 1, gate4EBClear: 1, gate5ValueQuantified: 1, gate6CriteriaWinnable: 1, gate7ProcessClear: 1, gate8CompDefensible: 1, gate9DeliveryOK: 1, gate10ROIJustified: 0 })).toMatchObject({ score: 9, status: "No-Go" });
  });

  it("Deal Health 缺少任何事实维度时不伪造精确分数", () => {
    const full = { relationshipPower: 5, meddpicc: 5, metricsValue: 5, champion: 5, accountFit: 5, economicBuyer: 5, threeWhy: 5, decisionCriteria: 5, processPaper: 5, competition: 5, actionDiscipline: 5 };
    expect(calculateDealHealth(full)).toMatchObject({ score: 100, status: "可Commit" });
    expect(calculateDealHealth({ ...full, threeWhy: null })).toMatchObject({ score: null, status: "数据不足", missing: ["threeWhy"] });
  });
});
