import { useMemo } from "react";
import { useLocation, useRoute } from "wouter";
import {
  ArrowLeft, ArrowUpRight, Building2, CalendarClock, ChevronRight,
  CircleAlert, ContactRound, Crosshair, Loader2, Radio, ShieldCheck,
  Sparkles, Target, UsersRound
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { calculateOpportunityHealth } from "@/lib/opportunityHealth";
import { Button } from "@/components/ui/button";
import { KeyContactsPanel, ProductCoverageBar } from "./BattleMap";

const buyingGroupRoles = ["经济决策人", "技术决策人", "Champion"];

function formatDate(value?: string | Date | null) {
  if (!value) return "暂无记录";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "暂无记录" : date.toLocaleDateString("zh-CN", { month: "long", day: "numeric" });
}

function OpportunityHealthBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-[10px] text-muted-foreground">评分待补充</span>;
  const color = score >= 60 ? "text-emerald-300 border-emerald-400/30 bg-emerald-400/10" : score >= 35 ? "text-amber-300 border-amber-400/30 bg-amber-400/10" : "text-rose-300 border-rose-400/30 bg-rose-400/10";
  return <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", color)}>MEDDPICC {score}%</span>;
}

function AIJudgementCard({
  contacts, meetings, clientStage
}: { contacts: any[]; meetings: any[]; clientStage?: string | null }) {
  const roleCoverage = buyingGroupRoles.filter(role => contacts.some((contact: any) => contact.buyingRole === role));
  const missingRoles = buyingGroupRoles.filter(role => !roleCoverage.includes(role));
  const latestMeeting = [...meetings].sort((a: any, b: any) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime())[0];
  const relationshipContacts = contacts.filter((contact: any) => ["建立关系", "Champion"].includes(contact.relationship)).length;
  const hasFacts = contacts.length > 0 || meetings.length > 0;

  const judgement = !hasFacts
    ? "数据不足，暂不判断"
    : missingRoles.length > 0
      ? `关系就绪度尚未满足进入商机的条件：缺少 ${missingRoles.join("、")} 证据。`
      : "核心 Buying Group 角色已有入库记录；是否进入商机仍需以阶段门控交付物为准。";
  const suggestedAction = !hasFacts
    ? "由 SAM 先录入关键人图谱或第一条拜访事实，系统才会开始形成可验证判断。"
    : missingRoles.length > 0
      ? `SAM：围绕 ${missingRoles.join("、")} 制定下一次接触或验证计划；AD：审核是否存在可用的高层切入路径。`
      : "SAM：补齐客户原话、痛点与下一步会议证据；AD：审核阶段门控是否可放行。";

  return (
    <section className="overflow-hidden rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-cyan-400/[0.10] via-slate-950/60 to-slate-950/80 shadow-[0_16px_45px_rgba(8,145,178,0.08)]">
      <div className="flex flex-col gap-3 border-b border-cyan-300/15 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-400/15 text-cyan-300"><Sparkles className="h-4 w-4" /></span>
          <div>
            <div className="text-sm font-semibold text-cyan-100">AI 作战判断</div>
            <div className="text-[11px] text-cyan-100/55">只依据 Command 中已入库的客户事实；不以销售自述替代证据。</div>
          </div>
        </div>
        <span className="w-fit rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-medium text-cyan-200">0→1 关系就绪度</span>
      </div>
      <div className="grid gap-px bg-cyan-300/10 lg:grid-cols-4">
        <div className="bg-slate-950/55 p-4 lg:col-span-2">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-300/70">判断</div>
          <p className="text-sm leading-6 text-slate-100">{judgement}</p>
        </div>
        <div className="bg-slate-950/55 p-4">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-300/70">事实依据</div>
          <div className="space-y-1.5 text-xs leading-5 text-slate-300">
            <p>已入库关键人：<strong className="text-slate-100">{contacts.length}</strong> 人；已建立关系：<strong className="text-slate-100">{relationshipContacts}</strong> 人。</p>
            <p>Buying Group 已覆盖：<strong className="text-slate-100">{roleCoverage.length}/{buyingGroupRoles.length}</strong> 个核心角色。</p>
            <p>最近拜访：<strong className="text-slate-100">{latestMeeting ? formatDate(latestMeeting.meetingDate) : "暂无"}</strong>。</p>
          </div>
        </div>
        <div className="bg-slate-950/55 p-4">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-300/70">方法论与行动</div>
          <p className="mb-2 text-xs leading-5 text-slate-300">映射：<strong className="text-slate-100">Buying Group + 0→1 阶段门控</strong>；当前客户阶段：<strong className="text-slate-100">{clientStage || "未设置"}</strong>。</p>
          <p className="text-xs leading-5 text-cyan-100">{suggestedAction}</p>
        </div>
      </div>
    </section>
  );
}

export default function ClientWorkstation() {
  const [, params] = useRoute("/clients/:clientId");
  const [, setLocation] = useLocation();
  const clientId = Number(params?.clientId);
  const { data: clients = [], isLoading: clientsLoading } = trpc.clients.list.useQuery();
  const client = clients.find((item: any) => item.id === clientId) as any;
  const { data: contacts = [], isLoading: contactsLoading } = trpc.contacts.listByClient.useQuery({ clientId }, { enabled: Number.isFinite(clientId) });
  const { data: opportunities = [], isLoading: opportunitiesLoading } = trpc.opportunities.listByClient.useQuery({ clientId }, { enabled: Number.isFinite(clientId) });
  const { data: opportunityMeddpicc = [] } = trpc.opportunities.listMeddpiccByClient.useQuery({ clientId }, { enabled: Number.isFinite(clientId) });
  const { data: meetings = [] } = trpc.meetings.listByClient.useQuery({ clientId }, { enabled: Number.isFinite(clientId) });
  const { data: signals = [] } = trpc.intelligence.listByClient.useQuery({ clientId }, { enabled: Number.isFinite(clientId) });

  const latestEvents = useMemo(() => {
    const visitEvents = meetings.map((meeting: any) => ({
      id: `meeting-${meeting.id}`, type: "拜访", date: meeting.meetingDate, title: meeting.subject || meeting.customerName || "客户拜访记录", detail: meeting.aiMinutes || meeting.keyPoints || meeting.nextSteps || "已入库拜访事实"
    }));
    const signalEvents = signals.map((signal: any) => ({
      id: `signal-${signal.id}`, type: "情报", date: signal.createdAt || signal.publishedAt, title: signal.title || signal.signalType || "客户情报信号", detail: signal.rawSignal || signal.summary || "已入库情报信号"
    }));
    return [...visitEvents, ...signalEvents].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6);
  }, [meetings, signals]);

  if (clientsLoading || contactsLoading || opportunitiesLoading) {
    return <div className="flex min-h-full items-center justify-center py-28 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />正在加载客户作战台…</div>;
  }

  if (!client) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <CircleAlert className="mx-auto mb-3 h-10 w-10 text-amber-300" />
        <h1 className="text-xl font-semibold text-foreground">未找到该客户</h1>
        <p className="mt-2 text-sm text-muted-foreground">客户可能已被删除，或当前链接中的客户编号无效。</p>
        <Button className="mt-6" variant="outline" onClick={() => setLocation("/battle-map")}>返回战场地图</Button>
      </div>
    );
  }

  const activeOpportunities = opportunities.filter((opportunity: any) => opportunity.status === "活跃");
  const totalValue = opportunities.reduce((sum: number, opportunity: any) => {
    const raw = String(opportunity.estimatedValue || "").replace(/[$,\s]/g, "").toUpperCase();
    const value = raw.endsWith("M") ? Number.parseFloat(raw) * 1_000_000 : raw.endsWith("K") ? Number.parseFloat(raw) * 1_000 : Number.parseFloat(raw);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
  const latestMeeting = [...meetings].sort((a: any, b: any) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime())[0];

  return (
    <main className="min-h-full bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.10),transparent_33%),linear-gradient(180deg,rgba(10,15,28,0.45),rgba(3,8,18,0.12))] px-4 py-5 lg:px-7 lg:py-7">
      <div className="mx-auto max-w-[1540px] space-y-5">
        <button onClick={() => setLocation("/battle-map")} className="group flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-cyan-200">
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" /> 返回战场地图
        </button>

        <header className="overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950/65 shadow-[0_18px_55px_rgba(0,0,0,0.2)] backdrop-blur-sm">
          <div className="flex flex-col gap-5 px-5 py-5 lg:flex-row lg:items-start lg:justify-between lg:px-7 lg:py-6">
            <div className="flex min-w-0 gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-200"><Building2 className="h-6 w-6" /></div>
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-50">{client.name}</h1>
                  <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-200">客户作战台</span>
                </div>
                <p className="text-sm text-slate-400">{[client.industry, client.country, client.stage].filter(Boolean).join(" · ") || "客户级经营、关系与机会组合视图"}</p>
                <p className="mt-2 text-xs text-slate-500">最后客户接触：{latestMeeting ? formatDate(latestMeeting.meetingDate) : "暂无入库拜访记录"}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:min-w-[330px]">
              <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-3 py-2.5 text-center"><div className="text-lg font-semibold text-cyan-200">{contacts.length}</div><div className="text-[10px] text-slate-500">关键人</div></div>
              <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-3 py-2.5 text-center"><div className="text-lg font-semibold text-amber-200">{activeOpportunities.length}</div><div className="text-[10px] text-slate-500">活跃战线</div></div>
              <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-3 py-2.5 text-center"><div className="text-lg font-semibold text-emerald-200">{totalValue >= 1000 ? `$${Math.round(totalValue / 1000)}K` : totalValue ? `$${Math.round(totalValue)}` : "—"}</div><div className="text-[10px] text-slate-500">机会组合</div></div>
            </div>
          </div>
          <ProductCoverageBar clientId={clientId} />
        </header>

        <AIJudgementCard contacts={contacts as any[]} meetings={meetings as any[]} clientStage={client.stage} />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,0.9fr)]">
          <section className="rounded-2xl border border-slate-700/70 bg-slate-950/55 p-4 shadow-[0_12px_35px_rgba(0,0,0,0.12)] lg:p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-100"><Crosshair className="h-4 w-4 text-amber-300" />机会组合</div>
                <p className="mt-1 text-xs text-slate-500">客户级只看战线的经营状态；方法论和赢单证据进入各自的商机作战室。</p>
              </div>
              <span className="text-xs text-slate-500">{opportunities.length} 条商机</span>
            </div>
            <div className="space-y-3">
              {opportunities.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 px-5 py-10 text-center text-sm text-slate-500">暂无商机。客户经营仍可继续通过建图、拜访和阶段门控积累关系证据。</div>
              ) : opportunities.map((opportunity: any) => {
                const score = calculateOpportunityHealth(opportunityMeddpicc.find((item: any) => item.opportunityId === opportunity.id));
                return (
                  <article key={opportunity.id} className="group rounded-xl border border-slate-700/60 bg-slate-900/35 p-4 transition-colors hover:border-cyan-400/35 hover:bg-slate-900/60">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-slate-100">{opportunity.name}</h3>
                          <span className="rounded border border-cyan-300/20 bg-cyan-400/10 px-1.5 py-0.5 text-[10px] text-cyan-200">{opportunity.stage || "阶段待定义"}</span>
                          <OpportunityHealthBadge score={score} />
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                          {opportunity.estimatedValue && <span>金额：<strong className="font-medium text-slate-300">{opportunity.estimatedValue}</strong></span>}
                          {opportunity.productName && <span>产品：<strong className="font-medium text-slate-300">{opportunity.productName}</strong></span>}
                          {opportunity.competitorName && <span>竞品：<strong className="font-medium text-amber-200">{opportunity.competitorName}</strong></span>}
                          {opportunity.expectedCloseDate && <span>预计签约：<strong className="font-medium text-slate-300">{opportunity.expectedCloseDate}</strong></span>}
                        </div>
                        {opportunity.notes && <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{opportunity.notes}</p>}
                      </div>
                      <Button size="sm" className="h-8 shrink-0 gap-1.5 bg-cyan-500/15 text-xs text-cyan-100 hover:bg-cyan-400/25" variant="outline" onClick={() => setLocation(`/clients/${clientId}/opportunities/${opportunity.id}`)}>
                        进入作战室 <ArrowUpRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-700/70 bg-slate-950/55 p-4 shadow-[0_12px_35px_rgba(0,0,0,0.12)] lg:p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-100"><CalendarClock className="h-4 w-4 text-violet-300" />客户经营时间线</div>
            <div className="space-y-3">
              {latestEvents.length === 0 ? <p className="rounded-lg border border-dashed border-slate-700 px-3 py-6 text-center text-xs text-slate-500">暂无拜访或情报事实。录入后，AI 才能开始识别趋势与矛盾。</p> : latestEvents.map((event: any) => (
                <div key={event.id} className="border-l border-slate-700 pl-3">
                  <div className="mb-1 flex items-center gap-2"><span className={cn("rounded px-1.5 py-0.5 text-[10px]", event.type === "拜访" ? "bg-violet-400/10 text-violet-200" : "bg-amber-400/10 text-amber-200")}>{event.type}</span><span className="text-[10px] text-slate-500">{formatDate(event.date)}</span></div>
                  <div className="text-xs font-medium text-slate-300">{event.title}</div>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{event.detail}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-slate-700/70 bg-slate-950/55 p-4 shadow-[0_12px_35px_rgba(0,0,0,0.12)] lg:p-5">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100"><UsersRound className="h-4 w-4 text-cyan-300" />组织与 Buying Group</div>
            <p className="text-xs text-slate-500">客户级维护组织关系与角色覆盖，不在此混排某一条商机的赢单判断。</p>
          </div>
          <KeyContactsPanel clientId={clientId} clientName={client.name} />
        </section>
      </div>
    </main>
  );
}
