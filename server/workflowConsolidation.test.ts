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

  it("将外部事件信号放入客户作战台，并将 RSS 归入每日简报", () => {
    const workstation = projectFile("client/src/pages/ClientWorkstation.tsx");
    const signalEntry = projectFile("client/src/components/ExternalSignalWorkbench.tsx");
    const dailyBriefing = projectFile("client/src/pages/DailyBriefing.tsx");
    expect(workstation).toContain("<ExternalSignalWorkbench");
    expect(signalEntry).toContain("trpc.intelligence.analyze.useMutation");
    expect(signalEntry).toContain("不能由此自动放行开商机");
    expect(dailyBriefing).toContain("RSS 外部情报摘要");
  });

  it("从商机作战室直达武器库，并携带可审核的客户与商机上下文", () => {
    const opportunityRoom = projectFile("client/src/pages/OpportunityRoom.tsx");
    const arsenal = projectFile("client/src/pages/Arsenal.tsx");
    expect(opportunityRoom).toContain("生成武器");
    expect(opportunityRoom).toContain("tab: \"ai\"");
    expect(opportunityRoom).toContain("clientName");
    expect(arsenal).toContain("来自商机作战室的上下文");
    expect(arsenal).toContain("未确认事项明确标为待验证假设");
    expect(arsenal).toContain("clientId: weaponContext?.clientId");
  });

  it("将 CRM 收敛至系统设置，并将 POD 定位为次级任务汇总", () => {
    const app = projectFile("client/src/App.tsx");
    const settings = projectFile("client/src/pages/SystemSettings.tsx");
    const crm = projectFile("client/src/pages/CrmIntegration.tsx");
    const podCenter = projectFile("client/src/pages/PodCenter.tsx");
    const layout = projectFile("client/src/components/CommandLayout.tsx");
    expect(app).not.toContain('path="/crm"');
    expect(settings).toContain("<CrmIntegrationPanel embedded />");
    expect(crm).toContain("export function CrmIntegrationPanel");
    expect(crm).toContain("从销售易拉取商机");
    expect(podCenter).toContain("POD 协同 · 任务汇总");
    expect(podCenter).toContain("次级汇总入口");
    expect(layout).toContain('label: "POD 协同"');
  });

  it("将日常主导航收敛为六个清晰入口", () => {
    const layout = projectFile("client/src/components/CommandLayout.tsx");
    const expectedPaths = ["/dashboard", "/battle-map", "/meeting-minutes", "/pod-center", "/arsenal", "/daily-briefing"];
    expectedPaths.forEach(path => expect(layout).toContain(`path: "${path}"`));
    expect(layout).toContain('label: "每日情报简报"');
  });

  it("不再注册或展示独立行动指令、快速 Review、洞察、预测与情报雷达入口", () => {
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
    expect(app).not.toContain('path="/intel-radar"');
    expect(app).not.toContain('import IntelRadar');
    expect(layout).not.toContain('path: "/intel-radar"');
  });
});
