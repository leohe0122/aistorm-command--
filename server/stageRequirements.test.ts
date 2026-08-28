import { describe, expect, it } from "vitest";
import { STAGE_REQUIREMENTS } from "./aiNativeGuidance";

describe("完整商机阶段门控", () => {
  const keys = (stage: keyof typeof STAGE_REQUIREMENTS) => STAGE_REQUIREMENTS[stage].map(item => item.key);

  it("需求挖掘必须先确认项目参与人和触发事件，再验证痛点、可量化价值与潜在 Champion", () => {
    expect(keys("需求挖掘")).toEqual(["gate_participants", "gate_trigger", "I", "M", "C1"]);
    const participants = STAGE_REQUIREMENTS["需求挖掘"][0];
    const trigger = STAGE_REQUIREMENTS["需求挖掘"][1];
    expect(participants.question).toContain("项目里");
    expect(trigger.question).toContain("必须现在");
    expect(trigger.followUp?.length).toBeGreaterThan(0);
  });

  it("技术验证必须验证决策标准、Champion 与竞争初步态势", () => {
    expect(keys("技术验证")).toEqual(["D1", "C1", "gate8CompDefensible"]);
  });

  it("方案提案必须验证经济决策人、流程、价值与 Champion 可靠性", () => {
    expect(keys("方案提案")).toEqual(["E", "D2", "M", "C1"]);
  });

  it("商务谈判只有在采购、最终签字人、竞争与 Champion 行动全部满足后才可穿透", () => {
    expect(keys("商务谈判")).toEqual(["P", "E", "gate8CompDefensible", "C1"]);
    expect(STAGE_REQUIREMENTS["商务谈判"][0].question).toContain("法务和采购");
    expect(STAGE_REQUIREMENTS["商务谈判"][1].question).toContain("最终签字人");
    expect(STAGE_REQUIREMENTS["商务谈判"][3].question).toContain("具体做了什么行动");
  });
});
