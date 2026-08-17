import { describe, expect, it } from "vitest";
import { mergeOpportunityTasks } from "../client/src/lib/opportunityTasks";

describe("mergeOpportunityTasks", () => {
  it("keeps POD tasks and only includes action items explicitly linked to the current opportunity", () => {
    const tasks = mergeOpportunityTasks(
      [{ id: 91, title: "已采纳行动", assignedRole: "SAM", taskStatus: "pending" }],
      [
        { id: 1, title: "EDR 决策路径", responsibleRole: "AD", objective: "确认审批节奏", opportunityId: 7, isCompleted: false, timeframe: "本周" },
        { id: 2, title: "客户级风险", responsibleRole: "AD", objective: "需跨商机处理", opportunityId: null, isCompleted: false, timeframe: "本周" },
        { id: 3, title: "其他商机", responsibleRole: "SA", objective: "不应显示", opportunityId: 8, isCompleted: false, timeframe: "本月" },
      ],
      7,
    );

    expect(tasks).toHaveLength(2);
    expect(tasks.map(task => task.title)).toEqual(["已采纳行动", "EDR 决策路径"]);
    expect(tasks[1]).toMatchObject({ assignedRole: "AD", taskStatus: "pending", source: "actionItem" });
  });

  it("preserves completion state for linked action items", () => {
    const tasks = mergeOpportunityTasks([], [{ id: 4, title: "已完成", responsibleRole: "SAM", opportunityId: 9, isCompleted: true }], 9);
    expect(tasks[0].taskStatus).toBe("done");
  });
});
