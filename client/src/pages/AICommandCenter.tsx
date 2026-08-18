import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { AlertTriangle, BarChart3, CheckCircle2, ChevronRight, Clock3, MapPinned, RefreshCw, Sparkles, Target, Users, Wrench, Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AIConfidenceBar } from "@/components/AIConfidenceBar";
import { toast } from "sonner";

type CommandRecommendation = {
  id: number;
  clientId: number | null;
  opportunityId: number | null;
  kind: "today_action" | "anomaly" | "pending_approval" | "sam_coaching";
  urgency: "立即处理" | "本周推进" | "持续跟进";
  title: string;
  aiConclusion: string;
  facts: Array<{ label: string; value: string }>;
  methodology: string;
  suggestedAction: string;
  assignedRole: "AD" | "SAM" | "SA" | "RSM";
  dueDate: Date | string | null;
  status: "pending" | "confirmed" | "skipped" | "completed";
  podTaskId: number | null;
  fingerprint?: string;
};

const URGENCY_STYLE: Record<string, string> = {
  "立即处理": "bg-red-500/15 text-red-300 border-red-500/30",
  "本周推进": "bg-amber-500/15 text-amber-300 border-amber-500/30",
  "持续跟进": "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

function formatDueDate(value: Date | string | null) {
  if (!value) return "待 AD 排期";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "待 AD 排期" : `${date.getMonth() + 1}/${date.getDate()} 前`;
}

function RecommendationCard({ item, onConfirm, onSkip, onNavigate }: {
  item: CommandRecommendation;
  onConfirm: (item: CommandRecommendation) => void;
  onSkip: (item: CommandRecommendation) => void;
  onNavigate: (item: CommandRecommendation) => void;
}) {
  return (
    <article className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex gap-3">
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${URGENCY_STYLE[item.urgency]}`}>
          {item.kind === "anomaly" ? <AlertTriangle className="h-4 w-4" /> : item.kind === "pending_approval" ? <Clock3 className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={`border ${URGENCY_STYLE[item.urgency]}`}>{item.urgency}</Badge>
            <Badge variant="outline" className={item.fingerprint?.startsWith("native-") ? "border-cyan-500/35 bg-cyan-500/10 text-cyan-200" : "border-slate-500/35 text-slate-400"}>
              {item.fingerprint?.startsWith("native-") ? "AI 原生研判" : "规则触发"}
            </Badge>
            <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
          </div>
          <p className="mt-1 text-sm text-foreground/90">{item.aiConclusion}</p>
          <AIConfidenceBar signalDimensions={item.facts.filter(fact => fact.value && !/数据不足|暂无|未录入/.test(fact.value)).length} />
          <p className="mt-2 text-xs text-cyan-300"><span className="font-semibold">建议行动：</span>{item.suggestedAction}</p>
          <details className="mt-3 rounded-lg bg-muted/30 px-3 py-2 text-xs">
            <summary className="cursor-pointer font-medium text-muted-foreground">查看 AI 依据与方法论判断</summary>
            <div className="mt-2 space-y-1.5 text-muted-foreground">
              {item.facts.map((fact, index) => <p key={index}><span className="text-foreground/80">{fact.label}：</span>{fact.value}</p>)}
              <p className="border-t border-border/60 pt-2"><span className="text-foreground/80">方法论判断：</span>{item.methodology}</p>
            </div>
          </details>
          {item.status === "pending" ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" className="h-8 bg-cyan-600 hover:bg-cyan-500" onClick={() => onConfirm(item)}>
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> 已安排
              </Button>
              <Button size="sm" variant="outline" className="h-8" onClick={() => onSkip(item)}>跳过</Button>
              <Button size="sm" variant="ghost" className="h-8 text-muted-foreground" onClick={() => onNavigate(item)}>进入战场</Button>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{item.status === "confirmed" ? "已安排" : item.status === "completed" ? "已完成" : "已跳过"}</Badge>
              {item.podTaskId ? <span>已关联 POD 任务 #{item.podTaskId}</span> : null}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function CompactCard({ label, conclusion, badge, onClick }: { label: string; conclusion: string; badge?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full rounded-lg border border-border/70 bg-card p-3 text-left transition hover:border-cyan-500/50 hover:bg-cyan-500/5">
      <div className="flex items-center gap-2">
        <span className="truncate text-sm font-semibold">{label}</span>
        {badge ? <Badge variant="outline" className="ml-auto text-[10px]">{badge}</Badge> : null}
      </div>
      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{conclusion}</p>
    </button>
  );
}

export function AICommandCenter() {
  const [, navigate] = useLocation();
  const [view, setView] = useState<"command" | "boards" | "analytics" | "coach">("command");
  const [didRefresh, setDidRefresh] = useState(false);
  const [globalExpanded, setGlobalExpanded] = useState(false);
  const { data: dashboard, isLoading: dashboardLoading } = trpc.dashboard.summary.useQuery();
  const { data: me } = trpc.emailAuth.me.useQuery();
  const userRole = (me as any)?.podRole || "AD";
  const isSam = userRole === "SAM";
  const isSaOrRsm = userRole === "SA" || userRole === "RSM";
  const roleWorkbenchQuery = trpc.roleWorkbench.getMyDashboard.useQuery(undefined, { enabled: isSaOrRsm });
  const recommendationsQuery = trpc.adCommand.list.useQuery(undefined, { refetchInterval: 60_000 });
  const reviewClosureWeekQuery = trpc.insights.reviewClosureMetrics.useQuery({ period: "week" });
  const reviewClosureMonthQuery = trpc.insights.reviewClosureMetrics.useQuery({ period: "month" });
  const utils = trpc.useUtils();
  const refresh = trpc.adCommand.refresh.useMutation({
    onSuccess: () => { utils.adCommand.list.invalidate(); setDidRefresh(true); },
    onError: () => toast.error("AI 指挥研判刷新失败"),
  });
  const confirm = trpc.adCommand.confirm.useMutation({
    onSuccess: () => { toast.success("已安排为持久化 POD 作战任务"); utils.adCommand.list.invalidate(); utils.pod.listByRole.invalidate(); },
    onError: (error) => toast.error(error.message),
  });
  const skip = trpc.adCommand.skip.useMutation({
    onSuccess: () => { toast.success("已记录为本轮不采纳"); utils.adCommand.list.invalidate(); },
    onError: (error) => toast.error(error.message),
  });
  const [coachAnalyses, setCoachAnalyses] = useState<Record<string, string>>({});
  const [coachLoadingSam, setCoachLoadingSam] = useState<string | null>(null);
  const samCoachReview = trpc.adCommand.samCoachReview.useMutation({
    onSuccess: (result) => {
      setCoachAnalyses((current) => ({ ...current, [result.samName]: result.content }));
      setCoachLoadingSam(null);
    },
    onError: (error) => {
      setCoachLoadingSam(null);
      toast.error(error.message || "SAM 教练分析生成失败");
    },
  });

  useEffect(() => {
    if (!didRefresh && !refresh.isPending && !dashboardLoading) refresh.mutate();
  // 仅在页面打开后后台刷新一次；已经持久化的建议仍会立即展示。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardLoading, didRefresh]);

  const recommendations = (recommendationsQuery.data ?? []) as CommandRecommendation[];
  const pending = recommendations.filter(item => item.status === "pending");
  const globalBattlefield = pending.find(item => !item.clientId && item.fingerprint?.includes("-summary"))
    ?? recommendations.find(item => !item.clientId && item.fingerprint?.includes("-summary"));
  const today = pending.filter(item => (item.kind === "today_action" || item.kind === "sam_coaching") && item.id !== globalBattlefield?.id).slice(0, 3);
  const anomalies = pending.filter(item => item.kind === "anomaly");
  const approvals = pending.filter(item => item.kind === "pending_approval");
  const allVisible = [...today, ...anomalies, ...approvals];

  const recommendationForClient = (clientId: number) => pending.find(item => item.clientId === clientId);
  const recommendationForOpp = (opportunityId: number) => pending.find(item => item.opportunityId === opportunityId);
  const onConfirm = (item: CommandRecommendation) => confirm.mutate({ id: item.id, confirmedBy: me?.name || "AD" });
  const onNavigate = (item: CommandRecommendation) => {
    if (item.clientId && item.opportunityId) navigate(`/clients/${item.clientId}/opportunities/${item.opportunityId}`);
    else if (item.clientId) navigate(`/clients/${item.clientId}`);
    else navigate("/battle-map");
  };

  const zeroToOne = ((dashboard as any)?.zeroToOneBoard ?? []) as any[];
  const oneToN = ((dashboard as any)?.oneToNBoard ?? []) as any[];
  const samWarnings = useMemo(() => {
    const grouped = new Map<string, { total: number; gaps: number }>();
    for (const client of (dashboard as any)?.clients ?? []) {
      const name = client.assignedSamName || "未分配 SAM";
      const current = grouped.get(name) || { total: 0, gaps: 0 };
      current.total += 1;
      if ((client.meddpiccDetails?.championScore ?? 0) <= 1) current.gaps += 1;
      grouped.set(name, current);
    }
    return Array.from(grouped.entries()).map(([name, value]) => ({ name, ...value }));
  }, [dashboard]);
  const samWarningByName = useMemo(() => new Map(samWarnings.map(item => [item.name, item])), [samWarnings]);

  if (dashboardLoading) return <div className="space-y-4 p-6"><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-52 rounded-xl" /><Skeleton className="h-52 rounded-xl" /></div>;

  // Command 3.0: SAM role-specific view
  const samName = (me as any)?.name || "";
  const myClients = isSam ? ((dashboard as any)?.clients ?? []).filter((c: any) => c.assignedSamName === samName) : [];
  const myRecommendations = isSam ? recommendations.filter(r => r.assignedRole === "SAM" && r.status === "pending") : [];

  if (isSam) {
    return (
      <main className="space-y-5 p-4 md:p-6">
        <header className="flex flex-col gap-3 rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/40 to-slate-950/30 p-5">
          <div className="flex items-center gap-2"><Target className="h-5 w-5 text-emerald-300" /><h1 className="text-xl font-bold">我的战场快照</h1></div>
          <p className="mt-1 text-sm text-muted-foreground">你负责的 {myClients.length} 户客户 · AI 已为你排好今日优先行动</p>
        </header>
        {myRecommendations.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-emerald-300 flex items-center gap-1.5"><Sparkles className="h-4 w-4" /> AI 今日优先行动</h2>
            {myRecommendations.slice(0, 3).map(item => (
              <article key={item.id} className="rounded-xl border border-border/70 bg-card p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-sm">{item.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">{item.aiConclusion}</div>
                  </div>
                  <Badge variant="outline" className={URGENCY_STYLE[item.urgency]}>{item.urgency}</Badge>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="outline" onClick={() => onNavigate(item)}>进入客户</Button>
                </div>
              </article>
            ))}
          </section>
        )}
        <section className="grid gap-3 md:grid-cols-2">
          {myClients.map((client: any) => {
            const rec = recommendationForClient(client.id);
            const weakest = client.meddpiccDetails ? Object.entries(client.meddpiccDetails).sort(([,a],[,b]) => Number(a) - Number(b))[0] : null;
            return (
              <article key={client.id} className="rounded-xl border border-border/60 bg-card p-4 hover:border-emerald-500/40 transition-colors cursor-pointer" onClick={() => navigate(`/clients/${client.id}`)}>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">{client.name}</span>
                  <Badge variant="outline" className="text-xs">{client.stage}</Badge>
                </div>
                {weakest && <div className="text-xs text-red-400 mb-1">最弱维度：{weakest[0]} = {String(weakest[1])}/100</div>}
                {rec && <div className="text-xs text-emerald-400 mt-1 truncate">AI：{rec.aiConclusion}</div>}
                {!rec && <div className="text-xs text-muted-foreground mt-1">暂无 AI 行动建议</div>}
              </article>
            );
          })}
          {myClients.length === 0 && <div className="col-span-2 text-center text-muted-foreground py-8">暂无分配客户</div>}
        </section>
      </main>
    );
  }

  if (isSaOrRsm) {
    const workbench = roleWorkbenchQuery.data as any;
    const roleLabel = userRole === "SA" ? "SA 技术定标工作台" : "RSM 属地推进工作台";
    const roleDescription = userRole === "SA"
      ? "仅展示已分配给你的商机；AI 聚焦技术决策人、验收标准与 POC 证据缺口。"
      : "仅展示你负责客户下的活跃商机；AI 聚焦采购流程、属地渠道与关系推进证据。";
    const icon = userRole === "SA" ? <Wrench className="h-5 w-5 text-violet-300" /> : <MapPinned className="h-5 w-5 text-amber-300" />;
    const items = workbench?.workItems ?? [];
    return (
      <main className="space-y-5 p-4 md:p-6">
        <header className="rounded-2xl border border-violet-500/20 bg-gradient-to-r from-violet-950/35 to-slate-950/30 p-5">
          <div className="flex items-center gap-2">{icon}<h1 className="text-xl font-bold">{roleLabel}</h1></div>
          <p className="mt-1 text-sm text-muted-foreground">{roleDescription}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {[["我的活跃商机", workbench?.summary?.activeDealCount ?? 0], ["需本周处理", workbench?.summary?.urgentDealCount ?? 0], ["待办任务", workbench?.summary?.openTaskCount ?? 0]].map(([label, value]) => <div key={String(label)} className="rounded-lg border border-white/10 bg-black/10 px-3 py-2"><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold text-foreground">{value}</p></div>)}
          </div>
        </header>
        {roleWorkbenchQuery.isLoading ? <div className="grid gap-3 md:grid-cols-2"><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-40 rounded-xl" /></div> : null}
        {!roleWorkbenchQuery.isLoading && items.length === 0 ? <section className="rounded-2xl border border-dashed bg-card p-10 text-center"><p className="font-medium">当前没有已分配给你的活跃商机</p><p className="mt-2 text-sm text-muted-foreground">系统不会把未分配商机或主观判断当成你的任务。请由 AD/SAM 在商机作战室完成角色分配或调兵入场。</p></section> : null}
        <section className="grid gap-3 lg:grid-cols-2">
          {items.map((item: any) => <article key={item.opportunityId} className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm"><div className="flex gap-3"><div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${item.isUrgent ? "border-amber-500/35 bg-amber-500/10 text-amber-200" : "border-violet-500/35 bg-violet-500/10 text-violet-200"}`}>{item.isUrgent ? <AlertTriangle className="h-4 w-4" /> : icon}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-semibold">{item.clientName} · {item.opportunityName}</h2><Badge variant="outline">{item.stage || "阶段待定义"}</Badge>{item.isUrgent ? <Badge variant="outline" className="border-amber-500/35 text-amber-200">需本周处理</Badge> : <Badge variant="outline" className="border-emerald-500/35 text-emerald-200">持续经营</Badge>}</div><p className="mt-2 text-xs leading-5 text-muted-foreground">{item.diagnostic}</p><p className="mt-3 text-xs text-foreground/80">已分配待办：{item.assignedTaskCount} 条{item.assignedTaskCount > 0 ? ` · ${item.tasks.map((task: any) => task.title).join("；")}` : " · 暂无明细任务，请进入作战室确认下一动作"}</p><div className="mt-3 flex gap-2"><Button size="sm" variant="outline" onClick={() => navigate(`/clients/${item.clientId}/opportunities/${item.opportunityId}`)}>进入商机作战室</Button></div></div></div></article>)}
        </section>
      </main>
    );
  }

  return (
    <main className="space-y-5 p-4 md:p-6">
      <header className="flex flex-col gap-3 rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-cyan-950/40 to-slate-950/30 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2"><Zap className="h-5 w-5 text-cyan-300" /><h1 className="text-xl font-bold">AD AI 作战指挥中心</h1></div>
          <p className="mt-1 text-sm text-muted-foreground">AI 已基于系统事实完成排序；AD 只需确认正确的动作并安排执行。</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refresh.isPending ? "animate-spin" : ""}`} /> 刷新研判
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/battle-map")}>战场地图</Button>
        </div>
      </header>

      <nav className="flex flex-wrap gap-1 rounded-xl border bg-card p-1.5">
        {([
          ["command", "AI 指挥"], ["boards", "作战看板"], ["analytics", "数据分析"], ["coach", "团队教练"],
        ] as const).map(([key, label]) => (
          <Button key={key} size="sm" variant={view === key ? "default" : "ghost"} className={view === key ? "bg-cyan-600 hover:bg-cyan-500" : ""} onClick={() => setView(key)}>{label}</Button>
        ))}
      </nav>

      {view === "command" && <>
        {globalBattlefield ? <section className="rounded-2xl border border-violet-500/30 bg-gradient-to-r from-violet-950/35 to-cyan-950/20 p-4">
          <button className="flex w-full items-start gap-3 text-left" onClick={() => setGlobalExpanded(value => !value)}>
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-violet-200" />
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-violet-100">本周全局战场研判</p><Badge variant="outline" className={globalBattlefield.fingerprint?.startsWith("native-") ? "border-cyan-500/35 bg-cyan-500/10 text-cyan-200" : "border-slate-500/35 text-slate-400"}>{globalBattlefield.fingerprint?.startsWith("native-") ? "AI 原生研判" : "规则触发"}</Badge></div><p className="mt-1 text-sm text-foreground/90">{globalBattlefield.aiConclusion}</p><AIConfidenceBar signalDimensions={globalBattlefield.facts.filter(fact => fact.value && !/数据不足|暂无|未录入/.test(fact.value)).length} /></div>
            <span className="text-xs text-muted-foreground">{globalExpanded ? "收起 ▲" : "展开详情 ▼"}</span>
          </button>
          {globalExpanded ? <div className="mt-4 grid gap-3 border-t border-violet-500/20 pt-4 md:grid-cols-3">{globalBattlefield.facts.filter(fact => fact.label !== "快照指纹").map((fact, index) => <div key={index} className="rounded-lg bg-background/30 p-3"><p className="text-xs font-medium text-violet-200">{fact.label}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{fact.value}</p></div>)}</div> : null}
        </section> : null}
        <section className="grid gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2 rounded-2xl border border-cyan-500/25 bg-card p-4">
            <div className="mb-4 flex items-center justify-between"><div><p className="text-sm font-semibold text-cyan-200">AI 今日指令</p><p className="text-xs text-muted-foreground">最多三条；确认后自动进入 AD/POD 作战任务。</p></div><Badge variant="outline">待确认 {today.length}</Badge></div>
            <div className="space-y-3">{today.length ? today.map(item => <RecommendationCard key={item.id} item={item} onConfirm={onConfirm} onSkip={item => skip.mutate({ id: item.id })} onNavigate={onNavigate} />) : <p className="rounded-lg bg-muted/30 p-6 text-center text-sm text-muted-foreground">当前没有需 AD 确认的今日指令。AI 会在事实变化后生成新建议。</p>}</div>
          </div>
          <div className="rounded-2xl border border-amber-500/25 bg-card p-4">
            <div className="mb-4"><p className="text-sm font-semibold text-amber-200">挂起确认</p><p className="text-xs text-muted-foreground">高层直入、升级申请及关键动作。</p></div>
            <div className="space-y-3">{approvals.length ? approvals.map(item => <RecommendationCard key={item.id} item={item} onConfirm={onConfirm} onSkip={item => skip.mutate({ id: item.id })} onNavigate={onNavigate} />) : <p className="rounded-lg bg-muted/30 p-5 text-center text-xs text-muted-foreground">暂无待 AD 审批事项</p>}</div>
          </div>
        </section>
        <section className="rounded-2xl border border-red-500/25 bg-card p-4">
          <div className="mb-4 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-300" /><div><p className="text-sm font-semibold">异常预警</p><p className="text-xs text-muted-foreground">AI 只升级需要 AD 介入的停滞、证据缺口与风险战线。</p></div></div>
          <div className="grid gap-3 lg:grid-cols-2">{anomalies.length ? anomalies.map(item => <RecommendationCard key={item.id} item={item} onConfirm={onConfirm} onSkip={item => skip.mutate({ id: item.id })} onNavigate={onNavigate} />) : <p className="rounded-lg bg-muted/30 p-6 text-center text-sm text-muted-foreground lg:col-span-2">暂无达到 AD 介入阈值的异常。</p>}</div>
        </section>
      </>}

      {view === "boards" && <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border bg-card p-4"><div className="mb-4 flex items-center gap-2"><Target className="h-4 w-4 text-cyan-300" /><div><p className="text-sm font-semibold">0→1 客户看板</p><p className="text-xs text-muted-foreground">AI 单句结论与 SAM 能力预警。</p></div></div><div className="space-y-2">{zeroToOne.map((client: any) => { const rec = recommendationForClient(client.id); const fallback = !client.dataSufficient ? "数据不足，暂不判断。请先完成一条客户对话或购买信号录入。" : client.isStagnant ? `阶段停留 ${client.stageDwellDays} 天，需恢复购买信号验证` : client.anomalies?.[0] || "购买信号仍待验证"; const warning = samWarningByName.get(client.assignedSamName || "未分配 SAM"); const samTag = warning && warning.gaps > 0 ? `${client.assignedSamName} · Champion缺口 ${warning.gaps}` : client.assignedSamName || "SAM待分配"; const badge = !client.dataSufficient ? `${client.stage} · 数据不足` : `${client.stage} · ${samTag}`; return <CompactCard key={client.id} label={client.name} badge={badge} conclusion={rec?.aiConclusion || fallback} onClick={() => navigate(`/clients/${client.id}`)} />; })}</div></section>
        <section className="rounded-2xl border bg-card p-4"><div className="mb-4 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-orange-300" /><div><p className="text-sm font-semibold">1→N 商机看板</p><p className="text-xs text-muted-foreground">最大风险与停滞战线。</p></div></div><div className="space-y-2">{oneToN.map((opp: any) => { const rec = recommendationForOpp(opp.id); const fallback = opp.isStagnant ? `停滞 ${opp.stageDwellDays} 天，${opp.weakDims?.[0] || "关键证据"}待补` : opp.oppAnomalies?.[0] || "商机证据持续经营中"; return <CompactCard key={opp.id} label={`${opp.clientName} · ${opp.name}`} badge={opp.stage} conclusion={rec?.aiConclusion || fallback} onClick={() => navigate(`/clients/${opp.clientId}/opportunities/${opp.id}`)} />; })}</div></section>
      </div>}

      {view === "analytics" && <section className="grid gap-4 md:grid-cols-4">
        {[
          ["目标客户", (dashboard as any)?.clientCount ?? 0, "客户组合"], ["高风险", (dashboard as any)?.riskClients?.length ?? 0, "需要 AI 升级"], ["本周拜访", (dashboard as any)?.visitedThisWeekCount ?? 0, "已入库行为"], ["待确认建议", allVisible.length, "AD 人类控制"],
        ].map(([label, value, note]) => <div key={String(label)} className="rounded-2xl border bg-card p-5"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></div>)}
        {[["本周", reviewClosureWeekQuery], ["本月", reviewClosureMonthQuery]].map(([period, query]: any) => <div key={period} className={cn("rounded-2xl border p-5", (query.data?.rate ?? 100) < 60 ? "border-amber-500/35 bg-amber-500/5" : "bg-card")}><p className="text-xs text-muted-foreground">Review 闭环率 · {period}</p><p className="mt-2 text-3xl font-bold">{query.data?.rate === null || query.data?.rate === undefined ? "数据不足" : `${query.data.rate}%`}</p><p className={cn("mt-1 text-xs", (query.data?.rate ?? 100) < 60 ? "text-amber-300" : "text-muted-foreground")}>{query.data ? `${query.data.completed}/${query.data.total} 项已完成` : "加载中…"}{(query.data?.rate ?? 100) < 60 ? " · 需在下轮 Review 升级未完成任务" : ""}</p></div>)}
        <div className="md:col-span-4 rounded-2xl border bg-card p-5 text-sm text-muted-foreground"><BarChart3 className="mb-2 h-5 w-5 text-cyan-300" />漏斗、MEDDPICC 雷达、拜访频率等详细数据保留为按需分析，不再占用 AD 的决策首屏。</div>
      </section>}

      {view === "coach" && <section className="rounded-2xl border bg-card p-4"><div className="mb-4 flex items-center gap-2"><Users className="h-4 w-4 text-emerald-300" /><div><p className="text-sm font-semibold">SAM 教练</p><p className="text-xs text-muted-foreground">按需生成、不持久化；分析只使用已入库的客户、拜访与 Champion 事实。</p></div></div><div className="grid gap-3 md:grid-cols-2">{samWarnings.map(sam => <div key={sam.name} className="rounded-xl border border-border/70 p-4"><p className="font-semibold">{sam.name}</p><p className="mt-1 text-sm text-muted-foreground">负责 {sam.total} 个客户，其中 {sam.gaps} 个存在 Champion 证据缺口。</p><div className="mt-3 flex gap-2"><Button size="sm" variant="outline" disabled={coachLoadingSam === sam.name} onClick={() => { setCoachLoadingSam(sam.name); samCoachReview.mutate({ samName: sam.name }); }}>{coachLoadingSam === sam.name ? <><RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />生成中</> : coachAnalyses[sam.name] ? "刷新教练分析" : "生成教练分析"}</Button><Button size="sm" variant="ghost" onClick={() => setView("boards")}>查看相关客户</Button></div>{coachAnalyses[sam.name] ? <div className="prose prose-invert prose-sm mt-4 max-w-none rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3"><ReactMarkdown>{coachAnalyses[sam.name]}</ReactMarkdown></div> : null}</div>)}</div></section>}
    </main>
  );
}
