import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { SALES_METHODOLOGY_SYSTEM_PROMPT } from "./salesMethodology";

const routersSource = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
const arsenalSource = readFileSync(new URL("../client/src/pages/Arsenal.tsx", import.meta.url), "utf8");
const opportunityRoomSource = readFileSync(new URL("../client/src/pages/OpportunityRoom.tsx", import.meta.url), "utf8");

describe("武器库作战上下文", () => {
  it("统一方法论明确要求数据不足时不做虚构判断", () => {
    expect(SALES_METHODOLOGY_SYSTEM_PROMPT).toContain("数据不足，暂不判断");
    expect(SALES_METHODOLOGY_SYSTEM_PROMPT).toContain("Win = Pain × Power × Champion × Value × Control");
  });

  it("方案生成接收商机上下文，并持久化采用状态和客户反馈", () => {
    expect(routersSource).toContain("opportunityId: z.number().optional()");
    expect(routersSource).toContain("SALES_METHODOLOGY_SYSTEM_PROMPT");
    expect(routersSource).toContain("updateOutcome");
    expect(routersSource).toContain("adoptionStatus");
    expect(routersSource).toContain("customerFeedback");
  });

  it("武器库允许按商机查看历史并记录人工采用反馈", () => {
    expect(arsenalSource).toContain("关联商机（可选）");
    expect(arsenalSource).toContain("客户反馈（可选）");
    expect(arsenalSource).toContain("updateOutcome");
  });

  it("商机作战室要求人工确认后才创建竞品反制 POD 任务", () => {
    expect(opportunityRoomSource).toContain("转为 POD 任务 →");
    expect(opportunityRoomSource).toContain("来源：Kill Sheet #");
    expect(opportunityRoomSource).toContain('sourceType: "competition_counter"');
    expect(opportunityRoomSource).toContain("Champion 突破话术");
  });
});
