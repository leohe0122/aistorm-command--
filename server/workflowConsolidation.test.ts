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

  it("将商机作战材料留在 actions 工作区，不再跳转到武器库生成内容", () => {
    const opportunityRoom = projectFile("client/src/pages/OpportunityRoom.tsx");
    const arsenal = projectFile("client/src/pages/Arsenal.tsx");
    expect(opportunityRoom).toContain("生成作战材料");
    expect(opportunityRoom).toContain('data-room-section={section.id}');
    expect(opportunityRoom).toContain("opportunity-material-generator");
    expect(opportunityRoom).not.toContain('tab: "ai"');
    expect(arsenal).not.toContain("AIArsenalTab");
    expect(arsenal).not.toContain('value="ai"');
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

  it("不保存空的 1→N AI Review，并向商机作战室明确回传生成、成功或失败状态", () => {
    const routers = projectFile("server/routers.ts");
    const opportunityRoom = projectFile("client/src/pages/OpportunityRoom.tsx");
    expect(routers).toContain("maxCompletionTokens: 5200");
    expect(routers).toContain('reasoning: { effort: "low" }');
    expect(routers).toContain("AI Review 未返回可保存内容");
    expect(routers).toContain("本次未写入 Review");
    expect(routers).toContain("extractJSON(rawReview)");
    expect(routers).toContain("getLLMTextContent(res.choices[0]?.message.content)");
    expect(routers).toContain("review-one-to-n-v3-nonempty-guard");
    expect(opportunityRoom).toContain("reviewRunStatus");
    expect(opportunityRoom).toContain("AI Review 已生成并写入当前商机");
    expect(opportunityRoom).toContain("本次未保存 Review");
  });

  it("更新 Service Worker 后加载新版入口脚本，避免旧缓存遮蔽 AI Review 修复", () => {
    const indexHtml = projectFile("client/index.html");
    const serviceWorker = projectFile("client/public/sw.js");
    const app = projectFile("client/src/App.tsx");
    expect(indexHtml).toContain("/sw.js?v=20260819-ai-guidance-client-v2");
    expect(serviceWorker).toContain("aistorm-command-v20260819-ai-guidance-client-v2");
    expect(serviceWorker).toContain("event.request.mode === 'navigate'");
    expect(app).toContain("controllerchange");
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

  it("将内容生成留在客户与商机上下文，将武器库收敛为三类仓库能力", () => {
    const routers = projectFile("server/routers.ts");
    const diagnosticContext = projectFile("server/diagnosticContext.ts");
    const arsenal = projectFile("client/src/pages/Arsenal.tsx");
    const workstation = projectFile("client/src/pages/ClientWorkstation.tsx");
    const opportunityRoom = projectFile("client/src/pages/OpportunityRoom.tsx");
    expect(routers).toContain("opportunityId: z.number().optional()");
    expect(routers).toContain("getArsenalOpportunityContext");
    expect(routers).toContain("content: SALES_METHODOLOGY_SYSTEM_PROMPT");
    expect(diagnosticContext).toContain("当前商机的已入库 Deal Map 事实");
    expect(diagnosticContext).toContain("当前最弱 Win 因子");
    expect(arsenal).toContain('grid w-full max-w-3xl grid-cols-3');
    expect(arsenal).not.toContain("AI方案定制");
    expect(arsenal).not.toContain("trpc.arsenalAI.generate.useMutation");
    expect(arsenal).not.toContain('value="champion"');
    expect(arsenal).not.toContain('value="killsheets"');
    expect(workstation).toContain("function ClientKnockMaterialGenerator");
    expect(workstation).toContain("trpc.arsenalAI.generate.useMutation");
    expect(workstation).toContain("clientId: client.id");
    expect(workstation).toContain("进入商机后请在商机作战室生成上下文化内容");
    expect(opportunityRoom).toContain("Champion 突破话术");
    expect(opportunityRoom).toContain("竞品对比作战卡");
    expect(opportunityRoom).toContain("启动 Champion 培育计划");
    expect(opportunityRoom).toContain("覆盖 Economic Buyer 并建立高层通路");
    expect(opportunityRoom).toContain("SA 入场推进技术验证");
    expect(opportunityRoom).toContain("激活属地资源与商务通路");
  });

  it("将 AI 作战材料分层为客户 0→1 敲门材料与商机 1→N 赢单材料", () => {
    const workstation = projectFile("client/src/pages/ClientWorkstation.tsx");
    const opportunityRoom = projectFile("client/src/pages/OpportunityRoom.tsx");
    const arsenal = projectFile("client/src/pages/Arsenal.tsx");
    const layout = projectFile("client/src/components/CommandLayout.tsx");
    expect(workstation).toContain("生成敲门材料");
    expect(workstation).toContain("0→1 敲门材料");
    expect(workstation).toContain("已保存到武器库历史");
    expect(opportunityRoom).toContain("AI 作战材料生成");
    expect(opportunityRoom).toContain("trpc.arsenalAI.generate.useMutation");
    expect(opportunityRoom).toContain("opportunityId: opportunity.id");
    expect(opportunityRoom).toContain("保存到武器库历史");
    expect(opportunityRoom).toContain("转为 POD 任务");
    expect(opportunityRoom).toContain('sourceType: "manual"');
    expect(arsenal).toContain("产品文档管理 · 成功案例库 · 智能报价工具");
    expect(arsenal).not.toContain("AI方案定制");
    expect(layout).toContain("产品文档·成功案例库·报价工具");
  });

  it("让销售阶段条具备建图专属配色，并能按点击阶段筛选客户", () => {
    const battleMap = projectFile("client/src/pages/BattleMap.tsx");
    const pipeline = projectFile("client/src/components/SalesPipelineSteps.tsx");
    expect(pipeline).toContain('"建图": {');
    expect(pipeline).toContain("bg-violet-500/15");
    expect(pipeline).toContain("onStageSelect?: (stage: string | null) => void");
    expect(pipeline).toContain('onStageSelect?.(selectedStage === stage ? null : stage)');
    expect(battleMap).toContain('if (STAGES.includes(stageFilter) && c.stage !== stageFilter) return false;');
    expect(battleMap).toContain('onStageSelect={stage => setStageFilter(stage ?? "all")}');
    expect(battleMap).toContain("显示全部客户");
  });

  it("禁止战场地图直改进入商机，并保留申请开商机和 AD 高层直入两条受控路径", () => {
    const battleMap = projectFile("client/src/pages/BattleMap.tsx");
    const workstation = projectFile("client/src/pages/ClientWorkstation.tsx");
    const routers = projectFile("server/routers.ts");
    expect(battleMap).toContain('STAGES_LIST = ["建图", "进门", "定痛", "找人"]');
    expect(battleMap).toContain('nextStage === "进入商机"');
    expect(battleMap).toContain('#opportunity-application');
    expect(battleMap).toContain("仅 AD 可选择高层直入例外");
    expect(workstation).toContain('id="opportunity-application"');
    expect(workstation).toContain('id="executive-opportunity-exception"');
    expect(workstation).toContain("高层直接建立商机信号");
    expect(routers).toContain('bypassReason: z.literal("exec_meeting").optional()');
    expect(routers).toContain("高层直入必须由 AD 或系统管理员在登录态下确认");
    expect(routers).toContain("进入商机必须通过“申请开商机”完成");
    expect(routers).toContain('stage: z.enum(["建图", "进门", "定痛", "找人"]).default("建图")');
  });

  it("展示客户关系基础叙事，但明确其不能替代新商机门控", () => {
    const workstation = projectFile("client/src/pages/ClientWorkstation.tsx");
    expect(workstation).toContain("客户关系背景");
    expect(workstation).toContain("client.relationshipNarrative");
    expect(workstation).toContain("不会替代本次商机的购买信号或 AD 例外确认");
  });

  it("在战场地图客户名称旁渲染可信品牌标识，并在资产不可用时保留文字回退", () => {
    const battleMap = projectFile("client/src/pages/BattleMap.tsx");
    const brandMark = projectFile("client/src/components/ClientBrandMark.tsx");
    expect(battleMap).toContain('<ClientBrandMark clientName={client.name} />');
    expect(brandMark).toContain('"美的集团"');
    expect(brandMark).toContain('"香港电讯"');
    expect(brandMark).toContain('"星展银行"');
    expect(brandMark).toContain("onError={event => event.currentTarget.classList.add");
    expect(brandMark).toContain("clientName.slice(0, 2)");
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
    expect(commandCenter).toContain("Review 闭环率 · {period}");
    expect(commandCenter).toContain('period: "week"');
    expect(commandCenter).toContain('period: "month"');
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

  it("以单次严格 JSON 提取拜访全量信号，并只在 SAM 确认后写入事实表", () => {
    const routers = projectFile("server/routers.ts");
    const schema = projectFile("drizzle/schema.ts");
    const guidance = projectFile("server/aiNativeGuidance.ts");
    const meetingMinutes = projectFile("client/src/pages/MeetingMinutes.tsx");
    const confirmationCard = projectFile("client/src/components/FullSignalConfirmationCard.tsx");
    expect(routers).toContain("extractFullSignals: protectedProcedure");
    expect(routers).toContain("confirmFullSignals: protectedProcedure");
    expect(routers).toContain('name: "full_meeting_signals"');
    expect(routers).toContain("FULL_MEETING_SIGNALS_RESPONSE_SCHEMA");
    expect(routers).toContain("normalizeFullMeetingSignals");
    expect(routers).toContain("aiFullSignalsConfirmedKeys");
    expect(schema).toContain('aiFullSignals: json("aiFullSignals")');
    expect(schema).toContain('aiFullSignalsConfirmedKeys: json("aiFullSignalsConfirmedKeys")');
    expect(guidance).toContain("数据不足，暂不判断");
    expect(guidance).toContain("STAGE_REQUIREMENTS");
    expect(meetingMinutes).toContain("trpc.meetings.extractFullSignals.useMutation");
    expect(meetingMinutes).toContain("AI 拜访后事实确认");
    expect(confirmationCard).toContain("本次拜访收获");
    expect(confirmationCard).toContain("确认并写入");
    expect(confirmationCard).toContain("你无需理解 MEDDPICC、3 Why 或 Win 公式");
  });

  it("让 AI 在客户和商机作战台主动提出一个问题，并只在 SAM 确认后沉淀回答中的事实", () => {
    const routers = projectFile("server/routers.ts");
    const workstation = projectFile("client/src/pages/ClientWorkstation.tsx");
    const opportunityRoom = projectFile("client/src/pages/OpportunityRoom.tsx");
    const guidancePanel = projectFile("client/src/components/AIActiveGuidancePanel.tsx");
    expect(routers).toContain("aiGuidance: router");
    expect(routers).toContain("customerGuide: protectedProcedure");
    expect(routers).toContain("opportunityGuide: protectedProcedure");
    expect(routers).toContain("interpretAnswer: protectedProcedure");
    expect(routers).toContain("health: protectedProcedure.query");
    expect(routers).toContain("数据不足，暂不判断");
    expect(routers).toContain('candidateTarget: { type: "string", enum: ["purchase_signal", "meddpicc", "none"] }');
    expect(workstation).toContain('<AIActiveGuidancePanel scope="customer" clientId={clientId} />');
    expect(opportunityRoom).toContain('<AIActiveGuidancePanel scope="opportunity" clientId={clientId} opportunityId={opportunityId} />');
    expect(guidancePanel).toContain("让 AI 开始引导");
    expect(guidancePanel).toContain("当前判断");
    expect(guidancePanel).toContain("查看 AI 依据");
    expect(guidancePanel).toContain("已切换为基础引导");
    expect(guidancePanel).toContain("buildClientBaselineGuidance");
    expect(guidancePanel).toContain("}, 12_000)");
    expect(guidancePanel).toContain("已切换为基础引导");
    expect(guidancePanel).toContain("const working = pendingGuide || interpretMutation.isPending");
    expect(guidancePanel).not.toContain("healthCheck.refetch()");
    expect(guidancePanel).not.toContain("health_timeout");
    expect(guidancePanel).not.toContain("checkingHealth");
    expect(guidancePanel).not.toContain("healthCheck.isFetching");
    expect(guidancePanel).not.toContain("**AI 当前判断**\\n${data.factSummary}");
    expect(guidancePanel).toContain("确认写入事实");
    expect(guidancePanel).toContain("暂不写入");
    expect(guidancePanel).toContain("trpc.purchaseSignals.create.useMutation");
    expect(guidancePanel).toContain("trpc.opportunities.upsertMeddpicc.useMutation");
  });

  it("将客户 AI 引导限制为最小可用事实快照和单一问题的输出预算", () => {
    const routers = projectFile("server/routers.ts");
    expect(routers).toContain("function buildCustomerGuidanceSnapshot");
    expect(routers).toContain("contacts.slice(0, 8)");
    expect(routers).toContain("meetings.slice(0, 2)");
    expect(routers).toContain("signals.slice(0, 3)");
    expect(routers).toContain("summarizeGuidanceMeddpiccScores");
    expect(routers).toContain('maxCompletionTokens: model === "gpt-5" ? 800 : 600');
    expect(routers).not.toContain("readiness.checks || []");
    expect(routers).toContain("AI_GUIDANCE_PRIMARY_TIMEOUT_MS = 8_500");
    expect(routers).toContain("AI_GUIDANCE_TOTAL_TIMEOUT_MS = 15_000");
    expect(routers).toContain('runGuidanceModel("gpt-5-mini", scope, prompt, totalController.signal)');
    expect(routers).toContain("maxRetries: 0");
    expect(routers).toContain("buildBaselineGuidance(scope)");
    expect(routers).not.toContain('factor: { type: "string", enum: ["Pain", "Power", "Champion", "Value", "Control"] }');
    expect(routers).toContain("AI_ACTIVE_GUIDANCE_SYSTEM_PROMPT");
    expect(routers).toContain('content: AI_ACTIVE_GUIDANCE_SYSTEM_PROMPT');
  });

  it("在推进商机阶段前由 AI 展示硬性证据缺口，并只允许证据满足后受控推进", () => {
    const routers = projectFile("server/routers.ts");
    const guidance = projectFile("server/aiNativeGuidance.ts");
    const opportunityRoom = projectFile("client/src/pages/OpportunityRoom.tsx");
    const stagePanel = projectFile("client/src/components/StageAdvanceGuidance.tsx");
    expect(routers).toContain("getStageGuidance: protectedProcedure");
    expect(routers).toContain("advanceWithEvidence: protectedProcedure");
    expect(routers).toContain("尚不能推进至");
    expect(routers).toContain("stageChangedAt: new Date()");
    expect(guidance).toContain("STAGE_REQUIREMENTS");
    expect(opportunityRoom).toContain("<StageAdvanceGuidance");
    expect(stagePanel).toContain("AI 阶段推进引导");
    expect(stagePanel).toContain("AI 建议这样问：");
    expect(stagePanel).toContain("让 AI 引导补证");
    expect(stagePanel).toContain("确认推进至");
    expect(stagePanel).toContain("data-ai-active-guidance");
  });

  it("为不支持 reasoning 的兼容模型自动降级一次，且不对参数错误进行无效退避重试", () => {
    const llmCore = projectFile("server/_core/llm.ts");
    expect(llmCore).toContain("response.status === 429 || response.status >= 500");
    expect(llmCore).toContain("Provider rejected reasoning; retrying once without the optional parameter.");
    expect(llmCore).toContain("delete payload.reasoning");
    expect(llmCore).toContain("不牺牲 JSON Schema 约束");
  });

  it("在 API 被登录页或静态回退页替代时明确提示服务响应异常，而不是暴露 JSON 解析异常", () => {
    const clientEntry = projectFile("client/src/main.tsx");
    expect(clientEntry).toContain("content-type");
    expect(clientEntry).toContain("application/json");
    expect(clientEntry).toContain("服务响应异常");
    expect(clientEntry).toContain("AI 服务未返回 JSON");
    expect(clientEntry).toContain("刷新登录会话后重试");
  });

  it("让 useBuiltin 直接使用 BUILT_IN_FORGE 配置，不继承 OpenAI 环境变量优先级", () => {
    const llmCore = projectFile("server/_core/llm.ts");
    expect(llmCore).toContain("resolveBuiltinForgeApiUrl");
    expect(llmCore).toContain("process.env.BUILT_IN_FORGE_API_URL");
    expect(llmCore).toContain("process.env.BUILT_IN_FORGE_API_KEY");
    expect(llmCore).toContain("apiUrl: resolveBuiltinForgeApiUrl()");
  });
});
