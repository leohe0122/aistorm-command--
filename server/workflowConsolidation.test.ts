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
    expect(workstation).toContain('client.stage !== "进入商机" && <div id="client-relationship-review"');
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
    expect(arsenal).toContain("clientId: selectedClientId");
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

  it("将 Account Map 限定在客户 0→1 作战台，并在商机作战室提供三类 Deal Map 工作区", () => {
    const workstation = projectFile("client/src/pages/ClientWorkstation.tsx");
    const opportunityRoom = projectFile("client/src/pages/OpportunityRoom.tsx");
    expect(workstation).toContain("function AccountMapPanel");
    expect(workstation).toContain('client.stage !== "进入商机" && <AccountMapPanel');
    expect(workstation).toContain("多层覆盖矩阵");
    expect(opportunityRoom).toContain('label: "3 Why"');
    expect(opportunityRoom).toContain('label: "Pain & Metrics"');
    expect(opportunityRoom).toContain('label: "Go / No-Go"');
    expect(opportunityRoom).toContain("trpc.command2.getDealMap.useQuery");
    expect(opportunityRoom).toContain("数据不足");
  });

  it("以严格 JSON Schema 输出 1→N Review 的角色行动，并向商机作战室返回可靠创建回执", () => {
    const routers = projectFile("server/routers.ts");
    const opportunityRoom = projectFile("client/src/pages/OpportunityRoom.tsx");
    expect(routers).toContain('name: "deal_review_with_role_actions"');
    expect(routers).toContain('strict: true');
    expect(routers).toContain("roleTaskCreation");
    expect(routers).toContain("createdRoleTaskCount");
    expect(routers).toContain("skippedRoleTaskCount");
    expect(routers).not.toContain("const actionSection = reviewContent.split");
    expect(opportunityRoom).toContain("角色任务创建回执");
    expect(opportunityRoom).toContain("roleTaskReceipt");
  });

  it("将 RSM 纳入 1→N Review 的结构化行动，并让 Review 生成的任务可追溯且可计算闭环率", () => {
    const routers = projectFile("server/routers.ts");
    const schema = projectFile("drizzle/schema.ts");
    const opportunityRoom = projectFile("client/src/pages/OpportunityRoom.tsx");
    expect(routers).toContain('enum: ["AD", "SAM", "SA", "RSM"]');
    expect(routers).toContain("sourceReviewId: reviewId || null");
    expect(routers).toContain("getByIds: protectedProcedure");
    expect(schema).toContain('sourceReviewId: int("sourceReviewId")');
    expect(opportunityRoom).toContain("上次 Review 行动闭环");
    expect(opportunityRoom).toContain("查看来源 Review");
    expect(opportunityRoom).toContain("任务依据：");
  });

  it("在 ESM 服务端路径中不使用 CommonJS require，避免 SAM AI 自检与原生刷新出现运行时异常", () => {
    const routers = projectFile("server/routers.ts");
    expect(routers).not.toContain("require(");
    expect(routers).toContain('import { calculateDealHealth, calculateGoNoGo, GO_NO_GO_GATE_KEYS } from "../shared/command2"');
    expect(routers).toContain("samSelfCheck: protectedProcedure");
  });

  it("为 SA/RSM 提供主动式角色首页，并将 SAM 自检转为可验证事实的补录引导", () => {
    const routers = projectFile("server/routers.ts");
    const commandCenter = projectFile("client/src/pages/AICommandCenter.tsx");
    const workstation = projectFile("client/src/pages/ClientWorkstation.tsx");
    expect(routers).toContain("roleWorkbench: router");
    expect(routers).toContain("getMyDashboard: protectedProcedure");
    expect(commandCenter).toContain("SA 技术定标工作台");
    expect(commandCenter).toContain("RSM 属地推进工作台");
    expect(commandCenter).toContain("trpc.roleWorkbench.getMyDashboard.useQuery");
    expect(routers).toContain('name: "sam_fact_backfill_prompts"');
    expect(routers).toContain("evidenceRequired");
    expect(workstation).toContain("AI 事实补录引导");
    expect(workstation).toContain("去补录事实");
    expect(workstation).not.toContain("coachQuestions");
  });

  it("将方案定制绑定统一方法论与商机 Deal Map 事实，并将 Champion/竞品能力迁回商机作战室", () => {
    const routers = projectFile("server/routers.ts");
    const diagnosticContext = projectFile("server/diagnosticContext.ts");
    const arsenal = projectFile("client/src/pages/Arsenal.tsx");
    const opportunityRoom = projectFile("client/src/pages/OpportunityRoom.tsx");
    expect(routers).toContain("opportunityId: z.number().optional()");
    expect(routers).toContain("getArsenalOpportunityContext");
    expect(routers).toContain("content: SALES_METHODOLOGY_SYSTEM_PROMPT");
    expect(diagnosticContext).toContain("当前商机的已入库 Deal Map 事实");
    expect(diagnosticContext).toContain("当前最弱 Win 因子");
    expect(arsenal).toContain("const [selectedOpportunityId, setSelectedOpportunityId]");
    expect(arsenal).toContain("关联商机（可选）");
    expect(arsenal).toContain("opportunityId: selectedOpportunityId");
    expect(arsenal).toContain('value="champion"');
    expect(arsenal).toContain('value="killsheets"');
    expect(arsenal).toContain("建议在商机作战室中使用。");
    expect(opportunityRoom).toContain("Champion 突破话术");
    expect(opportunityRoom).toContain("竞品对比作战卡");
  });

  it("让竞品反制任务、POD 来源 Review 深链与本周闭环率形成可解释的产品化闭环", () => {
    const routers = projectFile("server/routers.ts");
    const schema = projectFile("drizzle/schema.ts");
    const commandCenter = projectFile("client/src/pages/AICommandCenter.tsx");
    const opportunityRoom = projectFile("client/src/pages/OpportunityRoom.tsx");
    const podCenter = projectFile("client/src/pages/PodCenter.tsx");
    expect(schema).toContain('sourceType: varchar("sourceType", { length: 50 })');
    expect(routers).toContain('"competition_counter"');
    expect(routers).toContain("reviewClosureMetrics: protectedProcedure");
    expect(commandCenter).toContain("Review 闭环率 · 本周");
    expect(opportunityRoom).toContain("转为 POD 任务 →");
    expect(opportunityRoom).toContain('sourceType: "competition_counter"');
    expect(podCenter).toContain("来源: 1→N Deal Review");
    expect(podCenter).toContain("section=actions&reviewId=");
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
