import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectFile = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("作战工作流入口收敛", () => {
  it("仅在进入商机后的客户作战台提供 AI 行动生成与采纳闭环", () => {
    const workstation = projectFile("client/src/pages/ClientWorkstation.tsx");
    expect(workstation).toContain("function ClientActionDesk");
    expect(workstation).toContain("trpc.actions.generate.useMutation");
    expect(workstation).toContain("trpc.actions.adoptOne.useMutation");
    expect(workstation).toContain('client.stage === "进入商机" && <ClientActionDesk');
  });

  it("将 0→1 Review 迁回客户作战台，并保留其服务端事实研判能力", () => {
    const workstation = projectFile("client/src/pages/ClientWorkstation.tsx");
    expect(workstation).toContain("function ClientRelationshipReview");
    expect(workstation).toContain("trpc.insights.reviewZeroToOne.useMutation");
    expect(workstation).toContain('client.stage !== "进入商机" && <ClientRelationshipReview');
  });

  it("将拜访前洞察保留在客户作战台，并继续支持 1-Pager 与策略回写", () => {
    const workstation = projectFile("client/src/pages/ClientWorkstation.tsx");
    const insightEntry = projectFile("client/src/components/PreVisitInsightButton.tsx");
    expect(workstation).toContain("<PreVisitInsightButton client={client} />");
    expect(insightEntry).toContain("trpc.insights.generate.useMutation");
    expect(insightEntry).toContain("trpc.insights.applyStrategy.useMutation");
    expect(insightEntry).toContain("生成拜访前洞察");
  });

  it("将赢单预测降级为商机作战室内的展开式辅助判断", () => {
    const opportunityRoom = projectFile("client/src/pages/OpportunityRoom.tsx");
    expect(opportunityRoom).toContain("AI 赢单预测（辅助判断）");
    expect(opportunityRoom).toContain("生成 / 更新 AI Review");
    expect(opportunityRoom).toContain("数据不足，暂不判断");
  });

  it("不再注册或展示独立行动指令、快速 Review、洞察与预测入口", () => {
    const app = projectFile("client/src/App.tsx");
    const layout = projectFile("client/src/components/CommandLayout.tsx");
    expect(app).not.toContain('path="/action-command"');
    expect(app).not.toContain('import ActionCommand');
    expect(layout).not.toContain('path: "/action-command"');
    expect(app).not.toContain('path="/quick-review"');
    expect(app).not.toContain('import QuickReview');
    expect(layout).not.toContain('path: "/quick-review"');
    expect(app).not.toContain('path="/ai-insights"');
    expect(app).not.toContain('import AIInsights');
    expect(layout).not.toContain('path: "/ai-insights"');
    expect(app).not.toContain('path="/prediction"');
    expect(app).not.toContain('import OpportunityPrediction');
  });
});
