import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft, BrainCircuit, CalendarClock, CheckCircle2, ChevronDown, ChevronRight, ChevronUp,
  CircleAlert, ClipboardCheck, Crosshair, FileText, Gauge, Loader2,
  Network, Plus, Save, ShieldAlert, Sparkles, Swords, Target, UsersRound
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MEDDPICC_DIMENSIONS } from "@shared/meddpicc";
import { calculateOpportunityHealth, OPPORTUNITY_MEDDPICC_FIELDS } from "@/lib/opportunityHealth";
import { mergeOpportunityTasks } from "@/lib/opportunityTasks";
import { calculateGoNoGo, GO_NO_GO_GATE_KEYS } from "@shared/command2";

type RoomSection = "overview" | "meddpicc" | "bluesheet" | "strategy" | "spin" | "threewhy" | "value" | "gonogo" | "actions";

const roomSections: Array<{ id: RoomSection; label: string; icon: typeof Target }> = [
  { id: "overview", label: "战情总览", icon: Target },
  { id: "meddpicc", label: "MEDDPICC 证据", icon: Gauge },
  { id: "bluesheet", label: "Blue Sheet", icon: Network },
  { id: "strategy", label: "Win Strategy", icon: Crosshair },
  { id: "spin", label: "SPIN", icon: BrainCircuit },
  { id: "threewhy", label: "3 Why", icon: BrainCircuit },
  { id: "value", label: "Pain & Metrics", icon: Gauge },
  { id: "gonogo", label: "Go / No-Go", icon: ShieldAlert },
  { id: "actions", label: "行动任务", icon: ClipboardCheck },
];

const roleOptions = ["AD", "SAM", "SA", "RSM"] as const;

const scoreTone = (score: number) => score >= 75 ? "text-emerald-200 border-emerald-400/25 bg-emerald-400/10" : score >= 50 ? "text-amber-200 border-amber-400/25 bg-amber-400/10" : "text-rose-200 border-rose-400/25 bg-rose-400/10";

function formatDate(value?: string | Date | null) {
  if (!value) return "暂无";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "暂无" : date.toLocaleDateString("zh-CN", { month: "long", day: "numeric" });
}

function scoreLabel(rawScore: number) {
  const display = rawScore * 25;
  return display === 0 ? "未评分" : `${display}%`;
}

function EvidenceSummary({
  meetings, contacts, signals, meddpicc
}: { meetings: any[]; contacts: any[]; signals: any[]; meddpicc: any }) {
  const evidenceNotes = OPPORTUNITY_MEDDPICC_FIELDS.filter(key => String(meddpicc?.[key.replace("Score", "Notes")] || "").trim().length >= 10).length;
  return (
    <div className="grid gap-px overflow-hidden rounded-xl border border-slate-700/60 bg-slate-700/50 sm:grid-cols-4">
      <div className="bg-slate-950/70 px-3 py-2.5"><div className="text-lg font-semibold text-cyan-200">{meetings.length}</div><div className="text-[10px] text-slate-500">拜访事实</div></div>
      <div className="bg-slate-950/70 px-3 py-2.5"><div className="text-lg font-semibold text-violet-200">{contacts.length}</div><div className="text-[10px] text-slate-500">关键人记录</div></div>
      <div className="bg-slate-950/70 px-3 py-2.5"><div className="text-lg font-semibold text-amber-200">{signals.length}</div><div className="text-[10px] text-slate-500">情报信号</div></div>
      <div className="bg-slate-950/70 px-3 py-2.5"><div className="text-lg font-semibold text-emerald-200">{evidenceNotes}/8</div><div className="text-[10px] text-slate-500">MEDDPICC 证据备注</div></div>
    </div>
  );
}

function AIProcessGuide({ methodology, facts, judgement, action }: { methodology: string; facts: string; judgement: string; action: string }) {
  return (
    <section className="grid gap-px overflow-hidden rounded-xl border border-cyan-300/15 bg-cyan-300/10 lg:grid-cols-4">
      <div className="bg-cyan-400/[0.06] p-3"><div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-300/75">AI 依据 · 已入库事实</div><p className="text-xs leading-5 text-slate-300">{facts}</p></div>
      <div className="bg-slate-950/65 p-3"><div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-300/75">方法论</div><p className="text-xs leading-5 text-slate-200">{methodology}</p></div>
      <div className="bg-slate-950/65 p-3"><div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-300/75">判断规则</div><p className="text-xs leading-5 text-slate-300">{judgement}</p></div>
      <div className="bg-slate-950/65 p-3"><div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-300/75">人类行动</div><p className="text-xs leading-5 text-cyan-100">{action}</p></div>
    </section>
  );
}

function EntryPurchaseSignals({ snapshot }: { snapshot: any }) {
  const signals = Array.isArray(snapshot?.purchaseSignals) ? snapshot.purchaseSignals : [];
  const approval = snapshot?.approval;
  const labels: Record<string, string> = { intent_subject: "意向主体", decision_chain: "决策链触达", trigger_event: "触发事件" };
  if (signals.length === 0 && approval?.mode !== "exec_meeting") return <section className="rounded-xl border border-slate-700/60 bg-slate-950/50 p-4"><div className="text-sm font-semibold text-slate-100">进入商机的事实快照</div><p className="mt-1 text-xs leading-5 text-slate-500">这是一条在新门控上线前已存在的商机，未固化入口事实。请补充已有客户事实，不能以历史推测补填。</p></section>;
  return <section className="overflow-hidden rounded-xl border border-emerald-400/20 bg-emerald-400/[0.045]"><div className="border-b border-emerald-400/15 px-4 py-3"><div className="text-sm font-semibold text-emerald-100">进入商机的事实快照</div><p className="mt-1 text-[11px] leading-5 text-emerald-50/60">说明客户为什么现在会买，而不是我们准备卖什么；入口事实只读，不参与后续赢单评分。</p></div>{approval?.mode === "exec_meeting" && <div className="border-b border-violet-400/15 bg-violet-400/[0.055] px-4 py-3"><div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-200">AD 确认 · 高层直入</div><p className="mt-1 text-xs text-slate-100">经济决策人：{approval.executiveContact?.name || "未记录"}；确认人：{approval.approvedBy?.name || "未记录"}</p><p className="mt-1 text-[11px] leading-5 text-slate-400">{approval.confirmation || "数据不足，暂不判断"}</p>{Array.isArray(approval.meetingEvidence) && <p className="mt-2 text-[10px] text-violet-100/75">拜访证据：{approval.meetingEvidence.map((meeting: any) => `${formatDate(meeting.meetingDate)}（#${meeting.id}）`).join("、")}</p>}</div>}{signals.length > 0 && <div className="grid gap-px bg-emerald-400/10 lg:grid-cols-3">{signals.map((signal: any) => <article key={signal.type} className="bg-slate-950/60 p-3"><div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-300/80">{labels[signal.type] || signal.label}</div><p className="text-xs font-medium text-slate-100">{signal.subjectName || "未记录主体"}</p><p className="mt-1 text-[10px] text-slate-500">{formatDate(signal.occurredAt)} · {signal.sourceType || "来源待补充"}</p><p className="mt-2 text-xs leading-5 text-slate-300">{signal.statement || "数据不足，暂不判断"}</p></article>)}</div>}</section>;
}

function AIWarJudgement({
  clientId, clientName, opportunityId, opportunity, productName, contacts, meetings, signals, meddpicc
}: { clientId: number; clientName: string; opportunityId: number; opportunity: any; productName?: string; contacts: any[]; meetings: any[]; signals: any[]; meddpicc: any }) {
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const { data: reviews = [] } = trpc.insights.getLatestReviews.useQuery({ clientId });
  const latestReview = reviews.find((review: any) => review.opportunityId === opportunityId && review.reviewType === "1toN") as any;
  const [generatedReview, setGeneratedReview] = useState("");
  const [roleTaskReceipt, setRoleTaskReceipt] = useState<{ requested: number; created: number; skipped: number; error: string | null } | null>(null);
  const [forecastOpen, setForecastOpen] = useState(false);
  const reviewMutation = trpc.insights.reviewOneToN.useMutation({
    onSuccess: (result: any) => {
      setGeneratedReview(result.content);
      setRoleTaskReceipt(result.roleTaskCreation ?? null);
      utils.insights.getLatestReviews.invalidate({ clientId });
      utils.pod.listByOpportunity.invalidate({ opportunityId });
      const receipt = result.roleTaskCreation;
      if (receipt?.error) toast.warning("AI 作战判断已生成，但角色任务未自动创建");
      else if (receipt?.created > 0) toast.success(`AI 作战判断已生成，并创建 ${receipt.created} 条角色任务`);
      else toast.success("AI 作战判断已基于当前系统事实生成；未发现新增的可验证角色任务");
    },
    onError: (error) => toast.error(`AI 作战判断生成失败：${error.message}`),
  });

  const evidenceCount = meetings.length + contacts.length + signals.length + OPPORTUNITY_MEDDPICC_FIELDS.filter(key => Number(meddpicc?.[key]) > 0).length;
  const hasEvidence = evidenceCount > 0;
  const health = calculateOpportunityHealth(meddpicc);
  const lowDimensions = MEDDPICC_DIMENSIONS.filter(dim => (Number(meddpicc?.[dim.key]) || 0) <= 1).map(dim => dim.code);
  const content = generatedReview || latestReview?.content;
  const judgement = !hasEvidence
    ? "数据不足，暂不判断"
    : health === null
      ? "商机尚未形成 MEDDPICC 证据链；不能据此推断赢单概率。"
      : lowDimensions.length > 0
        ? `当前最需要补强的赢单证据是 ${lowDimensions.join("、")} 维度；在证据补齐前，健康度不应被解读为赢单承诺。`
        : "核心 MEDDPICC 维度已录入；仍需通过最新拜访、Buying Group 和竞争事实持续验证。";
  const forecastSummary = !hasEvidence
    ? "数据不足，暂不判断。"
    : health === null
      ? "尚未形成可核验的商机证据链，不能输出赢单预测。"
      : health >= 60
        ? "当前证据链相对完整，但预测仍需由最新客户事实持续校正。"
        : "当前证据链存在关键缺口；不应将分数解读为赢单概率承诺。";

  return (
    <section className="overflow-hidden rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-cyan-400/[0.10] via-slate-950/65 to-slate-950/85 shadow-[0_16px_45px_rgba(8,145,178,0.08)]">
      <div className="flex flex-col gap-3 border-b border-cyan-300/15 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-400/15 text-cyan-300"><Sparkles className="h-4 w-4" /></span>
          <div><div className="text-sm font-semibold text-cyan-100">AI 作战判断</div><div className="text-[11px] text-cyan-100/55">商机级 AI Review 只读取已入库拜访、关键人、评分、情报与效能基线。</div></div>
        </div>
        <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" className="h-8 w-fit gap-1.5 border-amber-300/30 bg-amber-400/10 text-xs text-amber-100 hover:bg-amber-400/20" onClick={() => { const query = new URLSearchParams({ tab: "ai", clientId: String(clientId), opportunityId: String(opportunityId), clientName, opportunity: String(opportunity.name || ""), stage: String(opportunity.stage || ""), product: String(productName || ""), competitor: String(opportunity.blueSheetCompetitor || opportunity.competitorName || ""), focus: lowDimensions.join("、") }); setLocation(`/arsenal?${query.toString()}`); }}><Swords className="h-3.5 w-3.5" />生成武器</Button><Button size="sm" variant="outline" className="h-8 w-fit gap-1.5 border-cyan-300/30 bg-cyan-400/10 text-xs text-cyan-100 hover:bg-cyan-400/20" onClick={() => reviewMutation.mutate({ clientId, opportunityId })} disabled={reviewMutation.isPending || !hasEvidence}>
          {reviewMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {reviewMutation.isPending ? "分析中…" : "生成 / 更新 AI Review"}
        </Button></div>
      </div>
      <div className="px-4 pt-4"><EntryPurchaseSignals snapshot={opportunity.entryEvidenceSnapshot} /></div>
      <div className="grid gap-px bg-cyan-300/10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="bg-slate-950/60 p-4">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-300/70">判断</div>
          <p className="text-sm leading-6 text-slate-100">{judgement}</p>
          {content && <div className="prose prose-invert prose-sm mt-3 max-w-none border-t border-cyan-200/10 pt-3 text-xs leading-6 text-slate-300 prose-headings:text-cyan-100 prose-strong:text-slate-100"><ReactMarkdown>{content}</ReactMarkdown></div>}
          {roleTaskReceipt && <div className={cn("mt-3 rounded-lg border px-3 py-2.5 text-xs leading-5", roleTaskReceipt.error ? "border-amber-400/25 bg-amber-400/[0.06] text-amber-100" : "border-emerald-400/25 bg-emerald-400/[0.06] text-emerald-100")}><div className="font-semibold">角色任务创建回执</div>{roleTaskReceipt.error ? <p className="mt-1">{roleTaskReceipt.error}</p> : <p className="mt-1">本次从结构化 Review 读取 {roleTaskReceipt.requested} 条任务；已创建 {roleTaskReceipt.created} 条，因相同角色与标题已存在而跳过 {roleTaskReceipt.skipped} 条。请在“行动任务”页确认责任与完成标准。</p>}</div>}
          {!content && hasEvidence && <p className="mt-3 text-xs leading-5 text-slate-500">尚未生成 AI Review。点击右上角按钮后，系统将基于本商机已有事实生成完整判断；生成结果需由负责人审核后才能转化为任务。</p>}
        </div>
        <div className="space-y-3 bg-slate-950/60 p-4">
          <div><div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-300/70">事实依据</div><EvidenceSummary meetings={meetings} contacts={contacts} signals={signals} meddpicc={meddpicc} /></div>
          <div><div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-300/70">方法论映射</div><p className="text-xs leading-5 text-slate-300"><strong className="text-slate-100">MEDDPICC</strong> 评估商机证据完整度；<strong className="text-slate-100">Blue Sheet</strong> 确认双方目标与竞争位置；<strong className="text-slate-100">Buying Group</strong> 校验决策链覆盖。</p></div>
          <div><div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-300/70">人类控制</div><p className="text-xs leading-5 text-cyan-100">AI 不会自动修改评分、阶段或预测。请在“行动任务”中由 AD、SAM 或 SA 选择并创建执行项。</p></div>
        </div>
      </div>
      <div className="border-t border-cyan-300/15 bg-slate-950/45 px-4 py-3">
        <button type="button" onClick={() => setForecastOpen(value => !value)} className="flex w-full items-center justify-between gap-3 text-left">
          <span><span className="text-xs font-semibold text-cyan-100">AI 赢单预测（辅助判断）</span><span className="ml-2 text-[10px] text-slate-500">已收敛至本商机作战室，不再作为独立入口</span></span>
          {forecastOpen ? <ChevronUp className="h-4 w-4 text-cyan-300" /> : <ChevronDown className="h-4 w-4 text-cyan-300" />}
        </button>
        {forecastOpen && <div className="mt-3 grid gap-2 lg:grid-cols-3">
          <div className="rounded-lg border border-slate-700/60 bg-slate-950/55 p-3"><div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-300/70">事实依据</div><p className="text-xs leading-5 text-slate-300">已入库 {evidenceCount} 项拜访、关键人、情报及 MEDDPICC 证据；当前商机健康度 {health === null ? "待补充" : `${health}%`}。</p></div>
          <div className="rounded-lg border border-slate-700/60 bg-slate-950/55 p-3"><div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-300/70">预测判断</div><p className="text-xs leading-5 text-slate-300">{forecastSummary}</p></div>
          <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/[0.045] p-3"><div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-300/70">下一步</div><p className="text-xs leading-5 text-cyan-50">{content ? "已生成 LLM 作战判断。请审阅上方结论并把确认的动作放入行动任务。" : "点击上方“生成 / 更新 AI Review”，由 LLM 根据该商机的真实事实输出详细判断与风险。"}</p></div>
        </div>}
      </div>
    </section>
  );
}

function MeddpiccEvidence({ clientId, opportunityId, meddpicc }: { clientId: number; opportunityId: number; meddpicc: any }) {
  const utils = trpc.useUtils();
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  useEffect(() => {
    const nextScores: Record<string, number> = {};
    const nextNotes: Record<string, string> = {};
    MEDDPICC_DIMENSIONS.forEach(dim => {
      nextScores[dim.key] = Number(meddpicc?.[dim.key]) || 0;
      nextNotes[dim.key.replace("Score", "Notes")] = meddpicc?.[dim.key.replace("Score", "Notes")] || "";
    });
    setScores(nextScores); setNotes(nextNotes);
  }, [meddpicc]);
  const saveMutation = trpc.opportunities.upsertMeddpicc.useMutation({
    onSuccess: () => { utils.opportunities.getMeddpicc.invalidate({ opportunityId }); utils.opportunities.listMeddpiccByClient.invalidate({ clientId }); toast.success("商机 MEDDPICC 证据已保存"); },
    onError: (error) => toast.error(`保存失败：${error.message}`),
  });
  const health = calculateOpportunityHealth(scores);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-700/60 bg-slate-900/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div><div className="text-sm font-semibold text-slate-100">MEDDPICC 证据盘点</div><p className="mt-1 text-xs text-slate-500">评分在数据库中以 0–4 保存，并通过证据备注进行可追溯校验；没有证据时不应抬高评分。</p></div>
        <span className={cn("w-fit rounded-full border px-3 py-1 text-xs font-semibold", health === null ? "border-slate-700 text-slate-400" : scoreTone(health))}>{health === null ? "评分待补充" : `商机健康度 ${health}%`}</span>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {MEDDPICC_DIMENSIONS.map(dim => {
          const raw = scores[dim.key] || 0;
          const noteKey = dim.key.replace("Score", "Notes");
          const evidenceWeak = raw >= 3 && String(notes[noteKey] || "").trim().length < 10;
          return (
            <article key={dim.key} className="rounded-xl border border-slate-700/60 bg-slate-950/55 p-4">
              <div className="mb-3 flex items-start gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-400/10 text-xs font-bold text-cyan-200">{dim.code}</span><div><div className="text-sm font-medium text-slate-100">{dim.chineseName}</div><p className="mt-0.5 text-[11px] leading-4 text-slate-500">{dim.question}</p></div><span className={cn("ml-auto rounded border px-1.5 py-0.5 text-[10px] font-semibold", scoreTone(raw * 25))}>{scoreLabel(raw)}</span></div>
              <div className="mb-3 grid grid-cols-5 gap-1.5">{[0, 1, 2, 3, 4].map(value => <button key={value} onClick={() => setScores(prev => ({ ...prev, [dim.key]: value }))} className={cn("rounded-md border px-1 py-1.5 text-[10px] transition-colors", raw === value ? "border-cyan-300/50 bg-cyan-400/15 text-cyan-100" : "border-slate-700/70 bg-slate-900/40 text-slate-500 hover:border-cyan-300/25")}>{value * 25 || "0"}</button>)}</div>
              <Textarea value={notes[noteKey] || ""} onChange={event => setNotes(prev => ({ ...prev, [noteKey]: event.target.value }))} placeholder="录入客户原话、会议结论或行为记录，作为评分证据" className="min-h-[74px] resize-y border-slate-700/70 bg-slate-900/45 text-xs leading-5" />
              {evidenceWeak && <p className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-200"><ShieldAlert className="h-3.5 w-3.5" />评分较高但证据备注不足，AI Review 会下调其置信度。</p>}
            </article>
          );
        })}
      </div>
      <div className="flex justify-end"><Button onClick={() => { const payload: Record<string, unknown> = { clientId, opportunityId }; MEDDPICC_DIMENSIONS.forEach(dim => { payload[dim.key] = scores[dim.key] || 0; payload[dim.key.replace("Score", "Notes")] = notes[dim.key.replace("Score", "Notes")] || ""; }); saveMutation.mutate(payload as any); }} disabled={saveMutation.isPending} className="gap-1.5"><Save className="h-3.5 w-3.5" />{saveMutation.isPending ? "保存中…" : "保存评分与证据"}</Button></div>
    </div>
  );
}

function BlueSheetWorkspace({ clientId, opportunity }: { clientId: number; opportunity: any }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({ bizObjective: "", valueProposition: "", champion: "", championStance: "未知", blueSheetCompetitor: "", winStrategy: "", keyMilestones: "", riskAndMitigation: "" });
  useEffect(() => setForm({ bizObjective: opportunity.bizObjective || "", valueProposition: opportunity.valueProposition || "", champion: opportunity.champion || "", championStance: opportunity.championStance || "未知", blueSheetCompetitor: opportunity.blueSheetCompetitor || "", winStrategy: opportunity.winStrategy || "", keyMilestones: opportunity.keyMilestones || "", riskAndMitigation: opportunity.riskAndMitigation || "" }), [opportunity]);
  const saveMutation = trpc.opportunities.updateBlueSheet.useMutation({ onSuccess: () => { utils.opportunities.listByClient.invalidate({ clientId }); toast.success("Blue Sheet 已保存"); }, onError: (error) => toast.error(`保存失败：${error.message}`) });
  const update = (key: keyof typeof form, value: string) => setForm(prev => ({ ...prev, [key]: value }));
  const cells: Array<{ key: keyof typeof form; label: string; hint: string; multiline?: boolean }> = [
    { key: "bizObjective", label: "客户业务目标", hint: "客户想达成的业务结果；不要只写产品需求", multiline: true },
    { key: "valueProposition", label: "我方价值主张", hint: "可被客户验证的差异化价值", multiline: true },
    { key: "champion", label: "内部 Champion", hint: "姓名或角色；请在关键人图谱中保留行为证据" },
    { key: "blueSheetCompetitor", label: "竞争态势", hint: "已确认的竞品与待验证假设" },
    { key: "winStrategy", label: "赢单策略", hint: "围绕决策标准、关系路径与资源分工的打法", multiline: true },
    { key: "keyMilestones", label: "关键里程碑", hint: "时间节点与可验收的完成标准", multiline: true },
    { key: "riskAndMitigation", label: "风险与应对", hint: "事实风险、影响以及责任人", multiline: true },
  ];
  return <div className="space-y-4"><div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4"><div className="text-sm font-semibold text-slate-100">Blue Sheet 商机蓝图</div><p className="mt-1 text-xs leading-5 text-slate-500">每一项都是该商机的作战假设，AI Review 将与 MEDDPICC、关键人和拜访记录交叉核验，避免“策略已具备”的无证据表达。</p></div><div className="grid gap-4 lg:grid-cols-2">{cells.map(cell => <div key={cell.key} className={cn("rounded-xl border border-slate-700/60 bg-slate-950/55 p-4", cell.multiline && "lg:col-span-1")}><Label className="text-xs text-slate-200">{cell.label}</Label><p className="mb-2 mt-1 text-[11px] text-slate-500">{cell.hint}</p>{cell.multiline ? <Textarea value={form[cell.key]} onChange={event => update(cell.key, event.target.value)} className="min-h-[104px] resize-y border-slate-700/70 bg-slate-900/45 text-xs leading-5" /> : <Input value={form[cell.key]} onChange={event => update(cell.key, event.target.value)} className="border-slate-700/70 bg-slate-900/45 text-xs" />}</div>)}</div><div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700/60 bg-slate-900/40 p-4"><div><Label className="text-xs text-slate-200">Champion 立场</Label><p className="mt-1 text-[11px] text-slate-500">立场不是 Champion 真实性证据，仍需以关键人行为记录验证。</p></div><Select value={form.championStance} onValueChange={value => update("championStance", value)}><SelectTrigger className="h-8 w-28 border-slate-700 bg-slate-950 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="支持">支持</SelectItem><SelectItem value="中立">中立</SelectItem><SelectItem value="反对">反对</SelectItem><SelectItem value="未知">未知</SelectItem></SelectContent></Select></div><div className="flex justify-end"><Button onClick={() => saveMutation.mutate({ id: opportunity.id, ...form, championStance: form.championStance as "支持" | "中立" | "反对" | "未知" })} disabled={saveMutation.isPending} className="gap-1.5"><Save className="h-3.5 w-3.5" />{saveMutation.isPending ? "保存中…" : "保存 Blue Sheet"}</Button></div></div>;
}

function StrategyWorkspace({ opportunity, contacts, meddpicc }: { opportunity: any; contacts: any[]; meddpicc: any }) {
  const health = calculateOpportunityHealth(meddpicc);
  const buyingRoles = ["经济决策人", "技术决策人", "Champion"];
  const missing = buyingRoles.filter(role => !contacts.some((contact: any) => contact.buyingRole === role));
  const blocks = [
    { label: "业务结果与价值锚点", value: opportunity.bizObjective || opportunity.valueProposition, fallback: "数据不足，暂不判断" },
    { label: "客户决策链与 Buying Group", value: missing.length ? `待补齐：${missing.join("、")}` : "核心角色已有入库记录；请继续以会谈事实验证立场与影响力。", fallback: "数据不足，暂不判断" },
    { label: "竞争与差异化", value: opportunity.blueSheetCompetitor || opportunity.competitorName, fallback: "尚未录入竞争事实，暂不形成竞争判断" },
    { label: "赢单路径", value: opportunity.winStrategy, fallback: "尚未定义；请先补全 Blue Sheet 与 MEDDPICC 证据。" },
  ];
  return <div className="space-y-4"><div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-sm font-semibold text-slate-100">Win Strategy</div><p className="mt-1 text-xs leading-5 text-slate-500">把 Blue Sheet 假设、Buying Group 覆盖和 MEDDPICC 证据汇合为可执行取胜路径，而非脱离事实的总结。</p></div><span className={cn("w-fit rounded-full border px-2.5 py-1 text-xs", health === null ? "border-slate-700 text-slate-400" : scoreTone(health))}>{health === null ? "证据待补充" : `MEDDPICC ${health}%`}</span></div></div><div className="grid gap-3 lg:grid-cols-2">{blocks.map(block => <article key={block.label} className="rounded-xl border border-slate-700/60 bg-slate-950/55 p-4"><div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-300/70">{block.label}</div><p className="text-sm leading-6 text-slate-200">{block.value || block.fallback}</p></article>)}</div><div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4"><div className="flex items-center gap-2 text-sm font-semibold text-amber-100"><ShieldAlert className="h-4 w-4" />策略质量检查</div><p className="mt-2 text-xs leading-5 text-amber-50/75">只有当前面的事实、评分与角色覆盖均已入库时，策略才可以被视为可信。未验证项应保持为“待验证假设”，而不是写成确定结论。</p></div></div>;
}

function SpinWorkspace({ opportunity, meddpicc }: { opportunity: any; meddpicc: any }) {
  const weak = MEDDPICC_DIMENSIONS.filter(dim => (Number(meddpicc?.[dim.key]) || 0) <= 1);
  const focus = weak.slice(0, 2).map(dim => dim.chineseName).join("、") || "当前商机的客户目标与决策流程";
  const title = opportunity.name || "该商机";
  const prompts = [
    { code: "S", title: "Situation · 现状", owner: "SAM 会前摸底", text: `围绕 ${title}，客户目前如何处理 ${focus}？请区分已确认事实与待验证信息。`, tone: "border-blue-400/25 bg-blue-400/[0.07] text-blue-100" },
    { code: "P", title: "Problem · 困难", owner: "SAM 初次接触", text: `现有做法在哪些具体场景无法满足客户目标？请让客户描述问题影响，而不是由销售替客户下结论。`, tone: "border-amber-400/25 bg-amber-400/[0.07] text-amber-100" },
    { code: "I", title: "Implication · 影响", owner: "AD / SA 深度会谈", text: `如果 ${focus} 在本周期无法改善，对业务、风险、成本或决策时间线将造成什么可量化影响？`, tone: "border-orange-400/25 bg-orange-400/[0.07] text-orange-100" },
    { code: "N", title: "Need-payoff · 需求回报", owner: "AD 高层会面", text: `如果客户获得可验证的改善结果，哪一个价值指标、验收标准或内部决策条件会因此被满足？`, tone: "border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-100" },
  ];
  return <div className="space-y-4"><div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4"><div className="text-sm font-semibold text-slate-100">SPIN 证据导向提问</div><p className="mt-1 text-xs leading-5 text-slate-500">问题根据本商机尚未闭合的 MEDDPICC 维度生成。回答必须回填到拜访记录与证据备注，才能改善商机判断。</p></div><div className="grid gap-3 xl:grid-cols-2">{prompts.map(prompt => <article key={prompt.code} className={cn("rounded-xl border p-4", prompt.tone)}><div className="mb-3 flex items-center justify-between"><span className="text-sm font-semibold">{prompt.code} · {prompt.title}</span><span className="text-[10px] opacity-70">{prompt.owner}</span></div><p className="text-sm leading-6 text-slate-100/90">{prompt.text}</p><p className="mt-3 text-[11px] leading-5 text-slate-300/75">会后动作：将客户原话、关键人反应及下一步承诺录入拜访作战日志；AI 之后才会重新评估对应维度。</p></article>)}</div></div>;
}

function DealBattleTools({ client, opportunity, contacts }: { client: any; opportunity: any; contacts: any[] }) {
  const championContact = contacts.find((contact: any) => contact.buyingRole === "Champion") || contacts.find((contact: any) => contact.name === opportunity.champion);
  const championName = opportunity.champion || championContact?.name || "";
  const competitor = String(opportunity.blueSheetCompetitor || opportunity.competitorName || "").trim();
  const { data: killSheets = [] } = trpc.killSheets.list.useQuery();
  const [ammoContent, setAmmoContent] = useState<string | null>(null);
  const ammoMutation = trpc.champion.generate.useMutation({
    onSuccess: (data: any) => { setAmmoContent(data.content || null); toast.success("Champion 突破话术已生成，请审核后使用"); },
    onError: (error) => toast.error(`Champion 弹药生成失败：${error.message}`),
  });
  const matchingSheets = (killSheets as any[]).filter((item: any) => {
    const known = `${item.competitorName || ""} ${item.productLine || ""}`.toLowerCase();
    return competitor && known.includes(competitor.toLowerCase());
  }).slice(0, 2);
  const generateAmmo = () => {
    if (!championName) { toast.warning("尚未形成 Champion 事实；请先在 Blue Sheet 或关键人图谱补录后再生成话术。"); return; }
    ammoMutation.mutate({
      clientId: client.id,
      clientName: client.name,
      industry: client.industry || undefined,
      securityAngle: client.securityAngle || undefined,
      notes: `${opportunity.name} · ${opportunity.stage} · ${opportunity.winStrategy || "赢单策略待补"}`,
      championName,
      ammoType: competitor ? "竞品对标" : "ROI测算",
    });
  };
  return <section className="grid gap-4 xl:grid-cols-2">
    <article className="rounded-xl border border-violet-400/20 bg-violet-400/[0.045] p-4">
      <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-semibold text-violet-100"><ShieldAlert className="h-4 w-4" />Champion 突破话术</div><p className="mt-1 text-xs leading-5 text-slate-400">只面向本商机已入库的 Champion 与 Blue Sheet 事实生成，不以销售主观判断替代关键人证据。</p></div><Button size="sm" variant="outline" onClick={generateAmmo} disabled={ammoMutation.isPending} className="h-8 shrink-0 gap-1.5 border-violet-400/30 text-xs text-violet-100 hover:bg-violet-400/10">{ammoMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}{ammoMutation.isPending ? "生成中…" : "生成话术"}</Button></div>
      <p className="mt-3 rounded-lg border border-violet-400/15 bg-slate-950/45 px-3 py-2 text-xs text-slate-300">当前 Champion：{championName || "数据不足，暂不生成"}</p>
      {ammoContent && <div className="prose prose-invert prose-sm mt-3 max-w-none rounded-lg border border-violet-400/20 bg-slate-950/55 p-3 text-xs"><ReactMarkdown>{ammoContent}</ReactMarkdown></div>}
    </article>
    <article className="rounded-xl border border-amber-400/20 bg-amber-400/[0.045] p-4">
      <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-semibold text-amber-100"><Swords className="h-4 w-4" />竞品对比作战卡</div><p className="mt-1 text-xs leading-5 text-slate-400">从已入库的 Kill Sheet 中匹配本商机已确认竞品；未命中时不虚构对比结论。</p></div></div>
      <p className="mt-3 rounded-lg border border-amber-400/15 bg-slate-950/45 px-3 py-2 text-xs text-slate-300">已确认竞品：{competitor || "数据不足，暂不判断"}</p>
      {competitor && matchingSheets.length === 0 && <p className="mt-3 text-xs leading-5 text-amber-100/80">未找到对应 Kill Sheet。请使用上方“生成武器”，针对当前 Deal Map 事实生成待审核的竞争材料。</p>}
      {matchingSheets.map((sheet: any) => <div key={sheet.id} className="mt-3 rounded-lg border border-amber-400/15 bg-slate-950/55 p-3"><div className="text-xs font-semibold text-amber-100">{sheet.competitorName || competitor} · {sheet.productLine || "产品线待补"}</div><p className="mt-1 text-[11px] leading-5 text-slate-300">{sheet.aiGeneratedTalk || sheet.ourAdvantages || sheet.keyDiffs || "已有 Kill Sheet，但核心差异化内容待补充。"}</p></div>)}
    </article>
  </section>;
}

function ActionWorkspace({ clientId, opportunityId }: { clientId: number; opportunityId: number }) {
  const utils = trpc.useUtils();
  const { data: podTasks = [], isLoading } = trpc.pod.listByOpportunity.useQuery({ opportunityId });
  const { data: actionItems = [] } = trpc.actions.listByClient.useQuery({ clientId });
  const tasks = mergeOpportunityTasks(podTasks, actionItems, opportunityId);
  const sourceReviewIds = useMemo(() => Array.from(new Set((podTasks as any[]).map(task => task.sourceReviewId).filter((id): id is number => Number.isInteger(id) && id > 0))), [podTasks]);
  const sourceReviewInput = useMemo(() => ({ ids: sourceReviewIds }), [sourceReviewIds]);
  const { data: sourceReviews = [] } = trpc.insights.getByIds.useQuery(sourceReviewInput, { enabled: sourceReviewIds.length > 0 });
  const sourceReviewById = useMemo(() => new Map((sourceReviews as any[]).map(review => [review.id, review])), [sourceReviews]);
  const reviewTasks = (podTasks as any[]).filter(task => Number.isInteger(task.sourceReviewId) && task.sourceReviewId > 0);
  const completedReviewTasks = reviewTasks.filter(task => task.taskStatus === "done" || task.isCompleted).length;
  const [expandedReviewId, setExpandedReviewId] = useState<number | null>(null);
  const { data: oppData } = trpc.opportunities.listByClient.useQuery({ clientId });
  const { data: meddpiccData } = trpc.opportunities.getMeddpicc.useQuery({ opportunityId });
  const opp = (oppData ?? []).find((o: any) => o.id === opportunityId) as any;
  const champScore = Number((meddpiccData as any)?.championScore ?? 0);
  const saHasTask = tasks.some((t: any) => t.assignedRole === "SA");
  const rsmHasTask = tasks.some((t: any) => t.assignedRole === "RSM");
  const d2Score = Number((meddpiccData as any)?.decisionProcessScore ?? 0);
  const deployRecs: Array<{ role: string; title: string }> = [];
  const [form, setForm] = useState({ title: "", description: "", role: "SAM" as (typeof roleOptions)[number], dueDate: "" });
  const createMutation = trpc.pod.addTask.useMutation({ onSuccess: () => { utils.pod.listByOpportunity.invalidate({ opportunityId }); setForm({ title: "", description: "", role: "SAM", dueDate: "" }); toast.success("商机行动任务已创建，等待责任人执行"); }, onError: (error) => toast.error(`创建任务失败：${error.message}`) });
  const statusMutation = trpc.pod.updateTaskStatus.useMutation({ onSuccess: () => { utils.pod.listByOpportunity.invalidate({ opportunityId }); utils.actions.listByClient.invalidate({ clientId }); }, onError: (error) => toast.error(`更新任务失败：${error.message}`) });
  return <div className="space-y-4">
    {reviewTasks.length > 0 && <section className="rounded-xl border border-violet-400/25 bg-violet-400/[0.045] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold text-violet-100">上次 Review 行动闭环</p><p className="mt-1 text-xs text-slate-400">只统计由已持久化 Review 生成的任务；手工任务不计入，避免虚高。</p></div><Badge variant="outline" className="border-violet-400/35 text-violet-200">{completedReviewTasks}/{reviewTasks.length} 已完成 · {Math.round((completedReviewTasks / reviewTasks.length) * 100)}%</Badge></div></section>}
    {deployRecs.length > 0 && <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4"><div className="mb-2 text-xs font-semibold text-amber-300 flex items-center gap-1.5"><UsersRound className="h-4 w-4" />调兵入场建议</div><div className="space-y-2">{deployRecs.map((rec, i) => <div key={i} className="flex items-center justify-between"><span className="text-xs text-slate-300">{rec.title}</span><Button size="sm" variant="outline" className="h-7 text-xs border-amber-500/30 text-amber-200 hover:bg-amber-500/10" onClick={() => { setForm({ title: rec.title, description: "基于商机阶段和 MEDDPICC 评分的 AI 推荐", role: rec.role as any, dueDate: "" }); toast.success("已填入" + rec.role + "任务，请确认后创建"); }}>一键填入</Button></div>)}</div></div>}
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4"><div className="text-sm font-semibold text-slate-100">行动闭环</div><p className="mt-1 text-xs leading-5 text-slate-500">AI 的建议必须由人审核并显式创建为任务；来源 Review、责任角色和完成状态均可追溯，但系统不自动代替团队执行。</p></div>
    <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/[0.05] p-4"><div className="mb-3 flex items-center gap-2 text-sm font-medium text-cyan-100"><Plus className="h-4 w-4" />新建商机行动</div><div className="grid gap-3 lg:grid-cols-[1fr_140px_160px]"><Input value={form.title} onChange={event => setForm(prev => ({ ...prev, title: event.target.value }))} placeholder="例如：确认两个最终用户部门汇报时间" className="border-slate-700 bg-slate-950/60 text-xs" /><Select value={form.role} onValueChange={value => setForm(prev => ({ ...prev, role: value as any }))}><SelectTrigger className="h-9 border-slate-700 bg-slate-950/60 text-xs"><SelectValue /></SelectTrigger><SelectContent>{roleOptions.map(role => <SelectItem key={role} value={role}>{role}</SelectItem>)}</SelectContent></Select><Input type="date" value={form.dueDate} onChange={event => setForm(prev => ({ ...prev, dueDate: event.target.value }))} className="border-slate-700 bg-slate-950/60 text-xs" /></div><Textarea value={form.description} onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))} placeholder="完成标准、依赖条件或来自 AI Review 的事实依据" className="mt-3 min-h-[80px] resize-y border-slate-700 bg-slate-950/60 text-xs" /><div className="mt-3 flex justify-end"><Button onClick={() => createMutation.mutate({ clientId, opportunityId, assignedRole: form.role, title: form.title, description: form.description || undefined, dueDate: form.dueDate || undefined })} disabled={!form.title.trim() || createMutation.isPending} className="gap-1.5"><Plus className="h-3.5 w-3.5" />{createMutation.isPending ? "创建中…" : "创建任务"}</Button></div></div>
    <div className="space-y-2">{isLoading ? <div className="py-8 text-center text-xs text-slate-500"><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />加载任务…</div> : tasks.length === 0 ? <div className="rounded-xl border border-dashed border-slate-700 px-4 py-9 text-center text-xs text-slate-500">暂无该商机的行动任务。请将已审核的建议转化为明确的责任事项。</div> : tasks.map((task: any) => { const sourceReview = task.sourceReviewId ? sourceReviewById.get(task.sourceReviewId) : null; return <article key={task.id} className="flex flex-col gap-3 rounded-xl border border-slate-700/60 bg-slate-950/55 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0 flex-1"><div className="mb-1 flex flex-wrap items-center gap-2"><span className="text-sm font-medium text-slate-100">{task.title}</span><span className="rounded border border-cyan-300/20 bg-cyan-400/10 px-1.5 py-0.5 text-[10px] text-cyan-200">{task.assignedRole}</span><span className={cn("rounded px-1.5 py-0.5 text-[10px]", task.taskStatus === "done" ? "bg-emerald-400/10 text-emerald-200" : "bg-slate-700/50 text-slate-400")}>{task.taskStatus === "done" ? "已完成" : task.taskStatus === "in_progress" ? "进行中" : "待处理"}</span></div>{task.description && <p className="text-xs leading-5 text-slate-500">任务依据：{task.description}</p>}<div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-600"><span>截止：{formatDate(task.dueDate)}</span>{task.sourceReviewId ? <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px] text-violet-200 hover:bg-violet-400/10" onClick={() => setExpandedReviewId(expandedReviewId === task.sourceReviewId ? null : task.sourceReviewId)}>查看来源 Review #{task.sourceReviewId}</Button> : null}</div>{expandedReviewId === task.sourceReviewId ? <div className="prose prose-invert prose-sm mt-3 max-w-none rounded-lg border border-violet-400/20 bg-violet-400/[0.04] p-3"><p className="!mb-2 text-xs text-violet-200">来源：{sourceReview ? `${formatDate(sourceReview.createdAt)} 的 ${sourceReview.reviewType} Review` : "加载来源 Review…"}</p>{sourceReview ? <ReactMarkdown>{sourceReview.content}</ReactMarkdown> : null}</div> : null}</div>{task.taskStatus !== "done" && <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ id: task.id, taskStatus: "done" })} disabled={statusMutation.isPending} className="h-8 shrink-0 gap-1.5 border-emerald-400/25 text-xs text-emerald-200 hover:bg-emerald-400/10"><CheckCircle2 className="h-3.5 w-3.5" />标记完成</Button>}</article>; })}</div>
  </div>;
}

const WHY_FIELDS = [
  ["whyChange", "Why Change｜为什么必须改变", "不行动后果、客户原话与可追溯证据"],
  ["whyNow", "Why Now｜为什么必须现在行动", "触发事件、时限与客户侧证据"],
  ["whyUs", "Why Us｜为什么是我们", "差异化、客户认可与竞品/No Decision 证据"],
] as const;
const GATE_LABELS = ["客户战略匹配", "业务痛点已验证", "Champion 存在", "Economic Buyer 清楚", "商业价值可量化", "决策标准可赢", "流程/Paper 路径清楚", "竞争可防守", "交付/合规可承诺", "资源投入有回报"];

function DealMapWorkspace({ clientId, opportunityId, mode }: { clientId: number; opportunityId: number; mode: "threewhy" | "value" | "gonogo" }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.command2.getDealMap.useQuery({ clientId, opportunityId });
  const [why, setWhy] = useState<Record<string, string>>({});
  const [gates, setGates] = useState<Record<string, number>>({});
  const [pain, setPain] = useState({ painType: "", painStatement: "", affectedSponsor: "", annualValue: "", evidenceStrength: "未验证" });
  const [competition, setCompetition] = useState({ competitorType: "NoDecision", controlPoints: "", counterAction: "", riskScore: "" });
  useEffect(() => {
    const item: any = data?.threeWhy;
    setWhy({ whyChangeClaim: item?.whyChangeClaim || "", whyChangePain: item?.whyChangePain || "", whyChangeConsequence: item?.whyChangeConsequence || "", whyChangeEvidence: item?.whyChangeEvidence || "", whyChangeScore: item?.whyChangeScore == null ? "" : String(item.whyChangeScore), whyNowClaim: item?.whyNowClaim || "", whyNowTrigger: item?.whyNowTrigger || "", whyNowEvidence: item?.whyNowEvidence || "", whyNowScore: item?.whyNowScore == null ? "" : String(item.whyNowScore), whyUsClaim: item?.whyUsClaim || "", whyUsDifferentiator: item?.whyUsDifferentiator || "", whyUsEvidence: item?.whyUsEvidence || "", whyUsScore: item?.whyUsScore == null ? "" : String(item.whyUsScore), challengerTeach: item?.challengerTeach || "", challengerTailor: item?.challengerTailor || "", challengerControl: item?.challengerControl || "", reframeEvidence: item?.reframeEvidence || "" });
    const record: any = data?.goNoGo; setGates(Object.fromEntries(GO_NO_GO_GATE_KEYS.map(key => [key, Number(record?.[key] ?? 0)])));
  }, [data?.threeWhy?.id, data?.threeWhy?.updatedAt, data?.goNoGo?.id, data?.goNoGo?.updatedAt]);
  const invalidate = () => utils.command2.getDealMap.invalidate({ clientId, opportunityId });
  const saveWhy = trpc.command2.saveThreeWhy.useMutation({ onSuccess: () => { invalidate(); toast.success("3 Why 证据已保存"); }, onError: error => toast.error(error.message) });
  const saveGates = trpc.command2.saveGoNoGo.useMutation({ onSuccess: () => { invalidate(); toast.success("Go/No-Go 已保存"); }, onError: error => toast.error(error.message) });
  const savePain = trpc.command2.savePainMetric.useMutation({ onSuccess: () => { invalidate(); setPain({ painType: "", painStatement: "", affectedSponsor: "", annualValue: "", evidenceStrength: "未验证" }); } });
  const deletePain = trpc.command2.deletePainMetric.useMutation({ onSuccess: invalidate });
  const saveCompetition = trpc.command2.saveCompetition.useMutation({ onSuccess: () => { invalidate(); setCompetition({ competitorType: "NoDecision", controlPoints: "", counterAction: "", riskScore: "" }); } });
  const score = data?.goNoGo ? calculateGoNoGo(gates as any) : { score: null, status: "数据不足" as const };
  if (isLoading) return <div className="py-12 text-center text-xs text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />加载 Deal Map…</div>;
  if (mode === "threewhy") return <div className="space-y-4"><AIProcessGuide methodology="3 Why × Challenger：验证采购动力，而不是记录我方产品设想。" facts="读取本商机独立的客户主张、痛点、触发事件、差异化证据与 Reframe 记录。" judgement="任一 Why 未达到可验证事实时，AI 必须标记采购动力不足，不能据此承诺 Forecast。" action="补录客户原话、可追溯来源和下一步验证动作，再由 AD/SAM 审核保存。" /><div className="grid gap-3 xl:grid-cols-3">{WHY_FIELDS.map(([prefix, title, hint]) => <article key={prefix} className="rounded-xl border border-slate-700/60 bg-slate-950/55 p-4"><div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-semibold text-slate-100">{title}</h3><select value={why[`${prefix}Score`] || ""} onChange={event => setWhy(current => ({ ...current, [`${prefix}Score`]: event.target.value }))} className="h-7 rounded border border-slate-700 bg-slate-900 px-1 text-[10px] text-slate-200"><option value="">未评分</option>{[0,1,2,3,4,5].map(value => <option key={value} value={value}>{value}/5</option>)}</select></div><p className="mb-2 text-[10px] leading-4 text-slate-500">{hint}</p><Textarea value={why[`${prefix}Claim`] || ""} onChange={event => setWhy(current => ({ ...current, [`${prefix}Claim`]: event.target.value }))} placeholder="一句话主张" className="mb-2 min-h-[58px] resize-none bg-slate-900/60 text-xs" />{prefix === "whyChange" ? <><Textarea value={why.whyChangePain || ""} onChange={event => setWhy(current => ({ ...current, whyChangePain: event.target.value }))} placeholder="现状痛点" className="mb-2 min-h-[58px] resize-none bg-slate-900/60 text-xs" /><Textarea value={why.whyChangeConsequence || ""} onChange={event => setWhy(current => ({ ...current, whyChangeConsequence: event.target.value }))} placeholder="不行动后果" className="mb-2 min-h-[58px] resize-none bg-slate-900/60 text-xs" /></> : prefix === "whyNow" ? <Textarea value={why.whyNowTrigger || ""} onChange={event => setWhy(current => ({ ...current, whyNowTrigger: event.target.value }))} placeholder="真实触发事件" className="mb-2 min-h-[58px] resize-none bg-slate-900/60 text-xs" /> : <Textarea value={why.whyUsDifferentiator || ""} onChange={event => setWhy(current => ({ ...current, whyUsDifferentiator: event.target.value }))} placeholder="客户认可的差异化" className="mb-2 min-h-[58px] resize-none bg-slate-900/60 text-xs" />}<Textarea value={why[`${prefix}Evidence`] || ""} onChange={event => setWhy(current => ({ ...current, [`${prefix}Evidence`]: event.target.value }))} placeholder="证据 / 客户原话 / 来源" className="min-h-[64px] resize-none bg-slate-900/60 text-xs" /></article>)}</div><div className="grid gap-3 rounded-xl border border-violet-400/20 bg-violet-400/[0.045] p-4 lg:grid-cols-2"><Textarea value={why.challengerTeach || ""} onChange={event => setWhy(current => ({ ...current, challengerTeach: event.target.value }))} placeholder="Challenger Teach：客户尚未看到的风险" className="min-h-[72px] resize-none bg-slate-900/60 text-xs" /><Textarea value={why.reframeEvidence || ""} onChange={event => setWhy(current => ({ ...current, reframeEvidence: event.target.value }))} placeholder="Reframe 证据：客户是否表达‘我之前没这样想过’" className="min-h-[72px] resize-none bg-slate-900/60 text-xs" /></div><div className="flex justify-end"><Button onClick={() => saveWhy.mutate({ clientId, opportunityId, ...Object.fromEntries(Object.entries(why).map(([key, value]) => [key, key.endsWith("Score") ? (value === "" ? null : Number(value)) : value || null])) } as any)} disabled={saveWhy.isPending} className="gap-1.5"><Save className="h-3.5 w-3.5" />保存 3 Why 证据</Button></div></div>;
  if (mode === "value") return <div className="space-y-4"><AIProcessGuide methodology="Pain & Metrics：将客户痛点翻译为可核验的商业价值，而非技术愿望。" facts="读取每条痛点的基线、年度价值、证据强度和受影响业务方。" judgement="没有量化或客户证据时，CFO 语言未就绪；系统显示数据不足，不计算虚构 ROI。" action="录入客户确认的痛点、量化逻辑与证据强度，再形成价值主张。" /><div className="grid gap-3 lg:grid-cols-3"><Input value={pain.painType} onChange={event => setPain(current => ({ ...current, painType: event.target.value }))} placeholder="痛点类型（如合规风险）" className="bg-slate-900/60 text-xs" /><Input value={pain.affectedSponsor} onChange={event => setPain(current => ({ ...current, affectedSponsor: event.target.value }))} placeholder="受影响业务方 / Sponsor" className="bg-slate-900/60 text-xs" /><Input type="number" value={pain.annualValue} onChange={event => setPain(current => ({ ...current, annualValue: event.target.value }))} placeholder="年度价值 USD（可选）" className="bg-slate-900/60 text-xs" /><Textarea value={pain.painStatement} onChange={event => setPain(current => ({ ...current, painStatement: event.target.value }))} placeholder="客户痛点、当前基线或可验证事实" className="min-h-[76px] resize-none bg-slate-900/60 text-xs lg:col-span-2" /><select value={pain.evidenceStrength} onChange={event => setPain(current => ({ ...current, evidenceStrength: event.target.value }))} className="rounded border border-input bg-slate-900/60 px-3 text-xs text-slate-200"><option>未验证</option><option>口头确认</option><option>书面确认</option><option>高层确认</option></select></div><div className="flex justify-end"><Button size="sm" onClick={() => savePain.mutate({ clientId, opportunityId, painType: pain.painType || null, affectedSponsor: pain.affectedSponsor || null, painStatement: pain.painStatement || null, annualValue: pain.annualValue ? Number(pain.annualValue) : null, evidenceStrength: pain.evidenceStrength as any })} disabled={!pain.painStatement.trim() || savePain.isPending} className="gap-1.5"><Plus className="h-3.5 w-3.5" />记录痛点事实</Button></div><div className="grid gap-3 lg:grid-cols-2">{(data?.pains || []).length === 0 ? <p className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-xs text-slate-500 lg:col-span-2">未填写——AI 无法将技术价值翻译为商业价值。</p> : (data?.pains || []).map((item: any) => <article key={item.id} className="rounded-xl border border-slate-700/60 bg-slate-950/55 p-4"><div className="flex gap-2"><div className="min-w-0 flex-1"><div className="text-xs font-semibold text-slate-100">{item.painType || "未分类痛点"}</div><p className="mt-2 text-xs leading-5 text-slate-300">{item.painStatement || "数据不足"}</p><p className="mt-2 text-[10px] text-slate-500">{item.affectedSponsor || "Sponsor 未填"} · 年度价值 {item.annualValue == null ? "未量化" : `$${Number(item.annualValue).toLocaleString()}`} · {item.evidenceStrength || "未验证"}</p></div><button className="text-[10px] text-slate-500 hover:text-rose-200" onClick={() => deletePain.mutate({ id: item.id, opportunityId })}>删除</button></div></article>)}</div></div>;
  return <div className="space-y-4"><AIProcessGuide methodology="Go/No-Go：在投入重资源前，以十项可验证门控而非销售信心做资源决定。" facts="读取每一项门控的 0/1/2 事实评分，并单独记录竞争或 No Decision 风险。" judgement="总分低于 10 为 No-Go；10–15 为有条件 Go；16+ 才可 Go。人工 Override 必须说明原因。" action="AD 审核门控、补齐最弱项；不要以 AI 或总分自动改变商机阶段。" /><div className="rounded-xl border border-cyan-400/20 bg-cyan-400/[0.05] p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold text-cyan-100">资源投入门控</h3><p className="mt-1 text-[11px] text-slate-500">当前：{score.score == null ? "数据不足" : `${score.score}/20 · ${score.status}`}</p></div><span className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", score.status === "Go" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : score.status === "No-Go" ? "border-rose-400/30 bg-rose-400/10 text-rose-200" : "border-amber-400/30 bg-amber-400/10 text-amber-200")}>{score.status}</span></div><div className="grid gap-2 md:grid-cols-2">{GO_NO_GO_GATE_KEYS.map((key, index) => <label key={key} className="flex items-center justify-between rounded-lg border border-slate-700/60 bg-slate-950/55 px-3 py-2 text-xs"><span className="text-slate-300">{index + 1}. {GATE_LABELS[index]}</span><select value={gates[key] ?? 0} onChange={event => setGates(current => ({ ...current, [key]: Number(event.target.value) }))} className="h-7 rounded border border-slate-700 bg-slate-900 px-1 text-[10px] text-slate-200"><option value={0}>0 · No-Go</option><option value={1}>1 · 部分</option><option value={2}>2 · 充分</option></select></label>)}</div><div className="mt-3 flex justify-end"><Button onClick={() => saveGates.mutate({ clientId, opportunityId, ...(gates as any) })} disabled={saveGates.isPending} className="gap-1.5"><Save className="h-3.5 w-3.5" />保存 Go/No-Go</Button></div></div><div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.045] p-4"><h3 className="text-xs font-semibold text-amber-100">竞争 / No Decision 风险</h3><div className="mt-3 grid gap-2 lg:grid-cols-2"><select value={competition.competitorType} onChange={event => setCompetition(current => ({ ...current, competitorType: event.target.value }))} className="h-9 rounded border border-input bg-slate-900/60 px-3 text-xs text-slate-200"><option value="NoDecision">No Decision（今年先不做）</option><option value="Incumbent">存量厂商</option><option value="Competitor">直接竞品</option><option value="InternalBuild">内部自建</option><option value="LowPrice">低价替代</option></select><Input type="number" min="0" max="5" value={competition.riskScore} onChange={event => setCompetition(current => ({ ...current, riskScore: event.target.value }))} placeholder="风险 0–5" className="bg-slate-900/60 text-xs" /><Textarea value={competition.controlPoints} onChange={event => setCompetition(current => ({ ...current, controlPoints: event.target.value }))} placeholder="竞品/No Decision 控制的关键人或决策标准" className="min-h-[64px] resize-none bg-slate-900/60 text-xs" /><Textarea value={competition.counterAction} onChange={event => setCompetition(current => ({ ...current, counterAction: event.target.value }))} placeholder="已审核的反制动作" className="min-h-[64px] resize-none bg-slate-900/60 text-xs" /></div><Button size="sm" variant="outline" className="mt-3 h-8 gap-1.5 border-amber-400/30 bg-amber-400/10 text-xs text-amber-100" onClick={() => saveCompetition.mutate({ clientId, opportunityId, competitorType: competition.competitorType, controlPoints: competition.controlPoints || null, counterAction: competition.counterAction || null, riskScore: competition.riskScore ? Number(competition.riskScore) : null })} disabled={saveCompetition.isPending}><Plus className="h-3.5 w-3.5" />记录竞争事实</Button></div></div>;
}

export default function OpportunityRoom() {
  const [, params] = useRoute("/clients/:clientId/opportunities/:opportunityId");
  const [, setLocation] = useLocation();
  const clientId = Number(params?.clientId);
  const opportunityId = Number(params?.opportunityId);
  const [activeSection, setActiveSection] = useState<RoomSection>("overview");
  const { data: clients = [], isLoading: clientsLoading } = trpc.clients.list.useQuery();
  const client = clients.find((item: any) => item.id === clientId) as any;
  const { data: opportunities = [], isLoading: opportunitiesLoading } = trpc.opportunities.listByClient.useQuery({ clientId }, { enabled: Number.isFinite(clientId) });
  const opportunity = opportunities.find((item: any) => item.id === opportunityId) as any;
  const { data: meddpicc } = trpc.opportunities.getMeddpicc.useQuery({ opportunityId }, { enabled: Number.isFinite(opportunityId) });
  const { data: contacts = [] } = trpc.contacts.listByClient.useQuery({ clientId }, { enabled: Number.isFinite(clientId) });
  const { data: meetings = [] } = trpc.meetings.listByClient.useQuery({ clientId }, { enabled: Number.isFinite(clientId) });
  const { data: signals = [] } = trpc.intelligence.listByClient.useQuery({ clientId }, { enabled: Number.isFinite(clientId) });
  const { data: products = [] } = trpc.products.listActive.useQuery();
  const product = products.find((item: any) => item.id === opportunity?.productId) as any;
  const recentMeetings = useMemo(() => [...meetings].sort((a: any, b: any) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime()).slice(0, 3), [meetings]);
  const health = calculateOpportunityHealth(meddpicc);
  const weakDimensionNames = MEDDPICC_DIMENSIONS
    .filter(dim => (Number((meddpicc as any)?.[dim.key]) || 0) <= 1)
    .map(dim => dim.chineseName);

  if (clientsLoading || opportunitiesLoading) return <div className="flex min-h-full items-center justify-center py-28 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />正在加载商机作战室…</div>;
  if (!client || !opportunity) return <div className="mx-auto max-w-2xl px-6 py-20 text-center"><CircleAlert className="mx-auto mb-3 h-10 w-10 text-amber-300" /><h1 className="text-xl font-semibold text-foreground">未找到该商机</h1><p className="mt-2 text-sm text-muted-foreground">商机可能已删除，或链接中的客户 / 商机编号无效。</p><Button className="mt-6" variant="outline" onClick={() => setLocation(`/clients/${clientId}`)}>返回客户作战台</Button></div>;

  const sectionContent: Record<RoomSection, React.ReactNode> = {
    overview: <div className="space-y-5"><div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]"><section className="rounded-2xl border border-slate-700/60 bg-slate-950/55 p-5"><div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-100"><Crosshair className="h-4 w-4 text-amber-300" />商机战情</div><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-slate-700/60 bg-slate-900/35 p-4"><div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">竞争状态</div><p className="mt-2 text-sm leading-6 text-slate-200">{opportunity.blueSheetCompetitor || opportunity.competitorName || "数据不足，暂不判断"}</p></div><div className="rounded-xl border border-slate-700/60 bg-slate-900/35 p-4"><div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">客户决策与 Champion</div><p className="mt-2 text-sm leading-6 text-slate-200">{opportunity.champion ? `${opportunity.champion} · ${opportunity.championStance || "立场待确认"}` : "尚未在该商机 Blue Sheet 中形成 Champion 结论"}</p></div><div className="rounded-xl border border-slate-700/60 bg-slate-900/35 p-4 sm:col-span-2"><div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">当前最大作战缺口</div><p className="mt-2 text-sm leading-6 text-slate-200">{weakDimensionNames.join("、") || "当前评分未识别低分维度；请审阅证据时效与备注完整度。"}</p></div></div></section><section className="rounded-2xl border border-slate-700/60 bg-slate-950/55 p-5"><div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-100"><UsersRound className="h-4 w-4 text-violet-300" />Buying Group</div><div className="space-y-2">{contacts.length === 0 ? <p className="text-xs text-slate-500">数据不足，暂不判断。请先在客户作战台补充关键人。</p> : contacts.map((contact: any) => <div key={contact.id} className="flex items-center justify-between rounded-lg border border-slate-700/50 bg-slate-900/35 px-3 py-2"><div><div className="text-xs font-medium text-slate-200">{contact.name}</div><div className="text-[10px] text-slate-500">{contact.title || "职位待补充"}</div></div><span className="rounded bg-violet-400/10 px-1.5 py-0.5 text-[10px] text-violet-200">{contact.buyingRole || "角色待确认"}</span></div>)}</div></section></div><section className="rounded-2xl border border-slate-700/60 bg-slate-950/55 p-5"><div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-100"><CalendarClock className="h-4 w-4 text-cyan-300" />近期拜访与情报事实</div><div className="grid gap-3 lg:grid-cols-2"><div className="space-y-2">{recentMeetings.length === 0 ? <p className="rounded-lg border border-dashed border-slate-700 px-3 py-6 text-center text-xs text-slate-500">暂无拜访事实</p> : recentMeetings.map((meeting: any) => <div key={meeting.id} className="rounded-lg border border-slate-700/50 bg-slate-900/35 p-3"><div className="mb-1 flex items-center justify-between"><span className="text-xs font-medium text-slate-200">{meeting.subject || "客户拜访"}</span><span className="text-[10px] text-slate-500">{formatDate(meeting.meetingDate)}</span></div><p className="line-clamp-3 text-[11px] leading-5 text-slate-500">{meeting.aiMinutes || meeting.keyPoints || meeting.nextSteps || "已入库拜访事实"}</p></div>)}</div><div className="space-y-2">{signals.slice(0, 3).length === 0 ? <p className="rounded-lg border border-dashed border-slate-700 px-3 py-6 text-center text-xs text-slate-500">暂无情报信号</p> : signals.slice(0, 3).map((signal: any) => <div key={signal.id} className="rounded-lg border border-slate-700/50 bg-slate-900/35 p-3"><div className="mb-1 flex items-center justify-between"><span className="text-xs font-medium text-slate-200">{signal.signalType || "客户情报"}</span><span className="text-[10px] text-slate-500">{formatDate(signal.createdAt || signal.publishedAt)}</span></div><p className="line-clamp-3 text-[11px] leading-5 text-slate-500">{signal.rawSignal || signal.summary || "已入库情报信号"}</p></div>)}</div></div></section></div>,
    meddpicc: <div className="space-y-4"><AIProcessGuide methodology="MEDDPICC：以维度化证据衡量该商机的可验证赢单质量。" facts="读取八个商机级分值及其备注；评分数据采用 0–4 的持久化刻度。" judgement="分数较高但备注不足时会被标记为低置信度；没有记录时显示待补充，不推断赢单概率。" action="SAM/AD 补充客户原话、会议结论或行为证据，再保存评分。" /><MeddpiccEvidence clientId={clientId} opportunityId={opportunityId} meddpicc={meddpicc} /></div>,
    bluesheet: <div className="space-y-4"><AIProcessGuide methodology="Blue Sheet：把客户目标、竞争、Champion、风险和里程碑组织为单商机作战假设。" facts="读取本商机已保存的 Blue Sheet 字段；不引用其他商机的策略文本。" judgement="空白字段保持“待验证”，并会被 AI Review 与 MEDDPICC、Buying Group 事实交叉检查。" action="负责人补齐假设并保存；下一次 AI Review 再基于更新后的事实判断。" /><BlueSheetWorkspace clientId={clientId} opportunity={opportunity} /></div>,
    strategy: <div className="space-y-4"><AIProcessGuide methodology="Win Strategy：汇合 MEDDPICC、Buying Group 和 Blue Sheet，形成可审核的取胜路径。" facts="读取当前商机评分、关键人角色、竞争信息与 Blue Sheet 内容。" judgement="缺少 EB、技术决策人或 Champion，或缺少价值、竞争证据时，策略只能视为待验证假设。" action="AD/SAM/SA 审核资源分工和里程碑；不能由 AI 自动改变策略或阶段。" /><StrategyWorkspace opportunity={opportunity} contacts={contacts as any[]} meddpicc={meddpicc} /></div>,
    spin: <div className="space-y-4"><AIProcessGuide methodology="SPIN：从未闭合的 MEDDPICC 维度反推下一轮应验证的问题。" facts="读取低分或未评分维度、商机名称及已入库的客户事实。" judgement="问题用于获取事实，不能替代事实本身；未获得客户回答前，AI 不会把问题当作证据。" action="SAM/AD 在会谈中使用并把客户原话回填至拜访作战日志与对应证据字段。" /><SpinWorkspace opportunity={opportunity} meddpicc={meddpicc} /></div>,
    threewhy: <DealMapWorkspace clientId={clientId} opportunityId={opportunityId} mode="threewhy" />,
    value: <DealMapWorkspace clientId={clientId} opportunityId={opportunityId} mode="value" />,
    gonogo: <DealMapWorkspace clientId={clientId} opportunityId={opportunityId} mode="gonogo" />,
    actions: <div className="space-y-4"><AIProcessGuide methodology="行动闭环：将经人工审核的 AI 建议转化为有责任角色和状态的任务。" facts="只读取已关联本商机的行动指令和 POD 任务；客户级或其他商机任务不会混入。" judgement="未关联、未审核或数据不足的建议不会被自动下发。" action="AD/SAM/SA 明确责任、截止与完成标准，并由负责人显式关闭任务。" /><DealBattleTools client={client} opportunity={opportunity} contacts={contacts as any[]} /><ActionWorkspace clientId={clientId} opportunityId={opportunityId} /></div>,
  };

  return <main className="min-h-full bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_28%),linear-gradient(180deg,rgba(10,15,28,0.45),rgba(3,8,18,0.12))] px-4 py-5 lg:px-7 lg:py-7"><div className="mx-auto max-w-[1640px]"><button onClick={() => setLocation(`/clients/${clientId}`)} className="group mb-4 flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-cyan-200"><ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />返回 {client.name} 客户作战台</button><header className="mb-5 overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950/70 shadow-[0_18px_55px_rgba(0,0,0,0.2)] backdrop-blur-sm"><div className="flex flex-col gap-5 px-5 py-5 lg:flex-row lg:items-start lg:justify-between lg:px-7 lg:py-6"><div className="flex min-w-0 gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-400/10 text-amber-200"><Target className="h-6 w-6" /></div><div className="min-w-0"><div className="mb-1 flex flex-wrap items-center gap-2"><h1 className="text-2xl font-semibold tracking-tight text-slate-50">{opportunity.name}</h1><span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-100">独立商机作战室</span></div><p className="text-sm text-slate-400">{[client.name, product?.name || null, opportunity.stage].filter(Boolean).join(" · ")}</p><p className="mt-2 text-xs text-slate-500">本页只承载该商机的赢单方法论、证据与行动；客户级关系经营留在客户作战台。</p></div></div><div className="grid grid-cols-3 gap-2 sm:min-w-[330px]"><div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-3 py-2.5 text-center"><div className="text-sm font-semibold text-amber-200">{opportunity.estimatedValue || "—"}</div><div className="text-[10px] text-slate-500">金额</div></div><div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-3 py-2.5 text-center"><div className="text-sm font-semibold text-cyan-200">{opportunity.expectedCloseDate || "—"}</div><div className="text-[10px] text-slate-500">预计签约</div></div><div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-3 py-2.5 text-center"><div className={cn("text-sm font-semibold", health === null ? "text-slate-400" : health >= 60 ? "text-emerald-200" : health >= 35 ? "text-amber-200" : "text-rose-200")}>{health === null ? "—" : `${health}%`}</div><div className="text-[10px] text-slate-500">MEDDPICC</div></div></div></div></header><AIWarJudgement clientId={clientId} clientName={client.name} opportunityId={opportunityId} opportunity={opportunity} productName={product?.name} contacts={contacts as any[]} meetings={meetings as any[]} signals={signals as any[]} meddpicc={meddpicc} /><div className="mt-5 grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)]"><aside className="h-fit rounded-2xl border border-slate-700/70 bg-slate-950/60 p-2 xl:sticky xl:top-5"><div className="px-3 pb-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">商机工作流</div><nav className="space-y-1">{roomSections.map(section => { const Icon = section.icon; const active = activeSection === section.id; return <button key={section.id} onClick={() => setActiveSection(section.id)} className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs transition-colors", active ? "border border-cyan-300/25 bg-cyan-400/10 font-semibold text-cyan-100" : "border border-transparent text-slate-400 hover:bg-slate-900/70 hover:text-slate-200")}><Icon className="h-3.5 w-3.5" />{section.label}<ChevronRight className={cn("ml-auto h-3 w-3", active ? "text-cyan-200" : "text-slate-600")} /></button>; })}</nav></aside><section className="min-w-0 rounded-2xl border border-slate-700/70 bg-slate-950/55 p-4 shadow-[0_12px_35px_rgba(0,0,0,0.12)] lg:p-5">{sectionContent[activeSection]}</section></div></div></main>;
}
