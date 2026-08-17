export type OpportunityTaskRow = {
  id: number;
  title: string;
  assignedRole: string;
  description?: string | null;
  dueDate?: string | Date | null;
  taskStatus: "pending" | "in_progress" | "done";
  source?: "actionItem";
  timeframe?: string | null;
};

/**
 * 将已采纳的 POD 任务与仍保留在行动指令台中的、已关联该商机的行动合并。
 * 不关联 opportunityId 的客户级行动不会出现在某一条商机的作战室中。
 */
export function mergeOpportunityTasks(podTasks: any[], actionItems: any[], opportunityId: number): OpportunityTaskRow[] {
  const linkedActions = actionItems
    .filter(action => Number(action.opportunityId) === opportunityId)
    .map(action => ({
      id: Number(action.id),
      title: action.title,
      assignedRole: action.responsibleRole,
      description: action.objective,
      dueDate: null,
      taskStatus: action.isCompleted ? "done" as const : "pending" as const,
      source: "actionItem" as const,
      timeframe: action.timeframe,
    }));
  return [...podTasks, ...linkedActions];
}
