import { useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import {
  ArrowLeft, ArrowUpRight, Building2, CalendarClock, CheckCircle2,
  ChevronRight, CircleAlert, ClipboardCheck, ContactRound, Crosshair,
  FileText, Flag, Loader2, MessageSquareText, Plus, ShieldCheck,
  Sparkles, Target, UsersRound
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { calculateOpportunityHealth } from "@/lib/opportunityHealth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { KeyContactsPanel, ProductCoverageBar } from "./BattleMap";

const CUSTOMER_STAGES = ["建图", "进门", "定痛", "找人", "进入商机"];

function formatDate(value?: string | Date | null) {
  if (!value) return "暂无记录";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "暂无记录" : date.toLocaleDateString("zh-CN", { month: "long", day: "numeric" });
}

function OpportunityHealthBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-[10px] text-muted-foreground">商机证据待补充</span>;
  const color = score >= 60 ? "text-emerald-300 border-emerald-400/30 bg-emerald-400/10" : score >= 35 ? "text-amber-300 border-amber-400/30 bg-amber-400/10" : "text-rose-300 border-rose-400/30 bg-rose-400/10";
  return <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", color)}>商机 MEDDPICC {score}%</span>;
}

function StageRail({ stage }: { stage: string }) {
  const currentIndex = Math.max(0, CUSTOMER_STAGES.indexOf(stage));
  return (
    <div className="grid grid-cols-5 gap-1 rounded-xl border border-slate-700/60 bg-slate-950/55 p-2">
      {CUSTOMER_STAGES.map((item, index) => {
        const isCurrent = index === currentIndex;
        const isDone = index < currentIndex;
        return (
          <div key={item} className="min-w-0">
            <div className={cn("mb-1 h-1 rounded-full", isDone ? "bg-emerald-400" : isCurrent ? "bg-cyan-400" : "bg-slate-700")} />
            <div className={cn("truncate text-center text-[10px] font-medium", isCurrent ? "text-cyan-200" : isDone ? "text-emerald-200" : "text-slate-500")}>{item}</div>
          </div>
        );
      })}
    </div>
  );
}

function StandardTask({ task }: { task: any }) {
  return (
    <article className={cn("rounded-xl border p-3", task.passed ? "border-emerald-400/20 bg-emerald-400/[0.05]" : "border-amber-400/20 bg-amber-400/[0.04]")}>
      <div className="flex items-start gap-3">
        <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full", task.passed ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/15 text-amber-300")}>
          {task.passed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Flag className="h-3.5 w-3.5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xs font-semibold text-slate-100">{task.label}</h3>
            <span className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[9px] font-medium text-slate-400">系统标准动作 · {task.role}</span>
          </div>
          <p className="mt-1 text-[11px] leading-5 text-slate-400">{task.action}</p>
          <div className="mt-2 rounded-lg border border-slate-700/60 bg-slate-950/50 px-2.5 py-2 text-[10px] leading-4 text-slate-400">
            <span className="font-semibold text-slate-300">客观完成条件：</span>{task.objective}
          </div>
          <p className="mt-1.5 text-[10px] leading-4 text-slate-500">已入库事实：{task.evidence}</p>
        </div>
      </div>
    </article>
  );
}

function StageTaskCenter({
  readiness, customTasks, onAddTask, onToggleTask, taskSubmitting,
}: {
  readiness: any;
  customTasks: any[];
  onAddTask: (title: string, description: string) => void;
  onToggleTask: (task: any) => void;
  taskSubmitting: boolean;
}) {
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const isOneToN = readiness.stage === "进入商机";
  const blockers = readiness.blockers || [];

  const addTask = () => {
    const title = newTitle.trim();
    if (!title) return;
    onAddTask(title, newDescription.trim());
    setNewTitle("");
    setNewDescription("");
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-cyan-400/[0.10] via-slate-950/75 to-slate-950/80 shadow-[0_16px_45px_rgba(8,145,178,0.08)]">
      <div className="flex flex-col gap-3 border-b border-cyan-300/15 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-200"><ClipboardCheck className="h-4.5 w-4.5" /></span>
          <div>
            <div className="text-sm font-semibold text-cyan-50">{isOneToN ? "客户关系资产持续经营" : "当前 0→1 阶段任务中心"}</div>
            <p className="mt-1 text-[11px] leading-5 text-cyan-100/55">{isOneToN ? "客户关系、组织与产品覆盖继续在这里经营；每笔交易的赢单节奏进入各自的商机作战室。" : "系统围绕客户购买信号生成验证重点；SAM 可额外添加经营任务，但任务完成不等于门控放行。"}</p>
          </div>
        </div>
        <span className="w-fit rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-semibold text-cyan-100">当前阶段：{readiness.stage}</span>
      </div>
      <div className="px-5 py-4">
        <StageRail stage={readiness.stage} />
      </div>

      {isOneToN ? (
        <div className="border-t border-cyan-300/10 bg-slate-950/35 px-5 py-4 text-xs leading-5 text-slate-300">
          客户已进入商机经营。这里继续记录关键人、客户关系、客户发现与产品覆盖；请从下方“在打商机”进入对应作战室，不在客户页修改某一笔交易的 MEDDPICC、策略或预测。
        </div>
      ) : (
        <div className="grid gap-px border-t border-cyan-300/10 bg-cyan-300/10 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.9fr)]">
          <div className="bg-slate-950/55 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-xs font-semibold text-slate-100">购买信号验证重点</h2>
                <p className="mt-1 text-[10px] text-slate-500">只看客户端已发生的购买事实，不以拜访次数或销售自评放行。</p>
              </div>
              <span className="text-[10px] text-cyan-200">{(readiness.standardActions || []).filter((task: any) => task.passed).length}/{(readiness.standardActions || []).length} 已满足</span>
            </div>
            <div className="space-y-2">
              {(readiness.standardActions || []).map((task: any) => <StandardTask key={task.id} task={task} />)}
            </div>
            <div className="mt-3 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.05] p-3 text-xs leading-5 text-slate-300">
              <span className="font-semibold text-cyan-100">AI 购买信号判断：</span>{blockers.length === 0 ? "三项客户购买信号均已入库，可由 SAM 或 AD 发起申请开商机。" : `尚不可申请开商机，缺少：${blockers.map((blocker: any) => blocker.label).join("、")}。`}
            </div>
          </div>

          <div className="bg-slate-950/55 p-4">
            <div className="mb-3">
              <h2 className="text-xs font-semibold text-slate-100">SAM 自定义客户任务</h2>
              <p className="mt-1 text-[10px] text-slate-500">用于补充本周客户经营动作，不替代购买信号门控。</p>
            </div>
            <div className="space-y-2">
              {customTasks.length === 0 ? <p className="rounded-lg border border-dashed border-slate-700 px-3 py-4 text-center text-[11px] text-slate-500">暂无自定义任务。标准动作已由系统展示。</p> : customTasks.map((task: any) => (
                <button key={task.id} type="button" onClick={() => onToggleTask(task)} className="flex w-full items-start gap-2 rounded-lg border border-slate-700/70 bg-slate-900/35 px-3 py-2 text-left transition-colors hover:border-cyan-400/25">
                  <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border", task.isCompleted || task.taskStatus === "done" ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-300" : "border-slate-600 text-transparent")}>✓</span>
                  <span className={cn("min-w-0 flex-1 text-[11px] leading-5", task.isCompleted || task.taskStatus === "done" ? "text-slate-500 line-through" : "text-slate-200")}>{task.title}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 space-y-2 border-t border-slate-700/60 pt-3">
              <Input value={newTitle} onChange={event => setNewTitle(event.target.value)} placeholder="添加客户经营任务" className="h-8 bg-slate-900/60 text-xs" />
              <Textarea value={newDescription} onChange={event => setNewDescription(event.target.value)} placeholder="说明目标、对象或完成标准（可选）" className="min-h-[58px] resize-none bg-slate-900/60 text-xs" />
              <Button size="sm" type="button" onClick={addTask} disabled={!newTitle.trim() || taskSubmitting} className="h-8 w-full gap-1.5 text-xs"><Plus className="h-3.5 w-3.5" />添加自定义任务</Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function EvidenceCard({ label, prompt, evidence, status }: { label: string; prompt: string; evidence: string; status: "verified" | "missing" }) {
  return (
    <article className={cn("rounded-xl border p-3", status === "verified" ? "border-emerald-400/20 bg-emerald-400/[0.045]" : "border-amber-400/20 bg-amber-400/[0.035]")}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-slate-100">{label}</h3>
        <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-semibold", status === "verified" ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-400/15 text-amber-200")}>{status === "verified" ? "已入库事实" : "待验证"}</span>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-cyan-100/85">{prompt}</p>
      <p className="mt-2 rounded-lg border border-slate-700/60 bg-slate-950/45 px-2.5 py-2 text-[10px] leading-4 text-slate-400">{evidence}</p>
    </article>
  );
}

function PurchaseSignalWorkbench({ readiness, clientId }: { readiness: any; clientId: number }) {
  const utils = trpc.useUtils();
  const { data: signals = [] } = trpc.purchaseSignals.listByClient.useQuery({ clientId });
  const [signalType, setSignalType] = useState<"intent_subject" | "decision_chain" | "trigger_event">("intent_subject");
  const [subjectName, setSubjectName] = useState("");
  const [occurredDate, setOccurredDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [statement, setStatement] = useState("");
  const [sourceType, setSourceType] = useState<"meeting" | "customer_message" | "customer_email" | "intelligence" | "other_evidence">("meeting");
  const [sourceReference, setSourceReference] = useState("");
  const createSignal = trpc.purchaseSignals.create.useMutation({ onSuccess: () => { utils.purchaseSignals.listByClient.invalidate({ clientId }); utils.opportunities.customerReadiness.invalidate({ clientId }); setSubjectName(""); setStatement(""); setSourceReference(""); } });
  const signalMeta = {
    intent_subject: { label: "意向主体已出现", subjectLabel: "客户侧表达者", prompt: "谁明确表达过“需要解决 X”或“正在评估此类方案”？请原样记录客户表述。" },
    decision_chain: { label: "决策链已触达", subjectLabel: "已接触的客户人员", prompt: "哪位已接触人员具有预算影响力、技术决策权或用户影响力？先确保他/她已在关键人图谱中标注角色。" },
    trigger_event: { label: "明确触发事件存在", subjectLabel: "触发事件名称", prompt: "是什么让客户必须现在行动？例如合规截止日、安全事件、业务扩张、预算周期或高层指令。" },
  }[signalType];
  const submit = () => {
    if (!subjectName.trim() || statement.trim().length < 8) return;
    createSignal.mutate({ clientId, signalType, subjectName: subjectName.trim(), occurredAt: new Date(`${occurredDate}T12:00:00`).toISOString(), statement: statement.trim(), sourceType, sourceReference: sourceReference.trim() || undefined });
  };
  return (
    <section className="rounded-2xl border border-slate-700/70 bg-slate-950/55 p-4 shadow-[0_12px_35px_rgba(0,0,0,0.12)] lg:p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2 text-sm font-semibold text-slate-100"><ShieldCheck className="h-4 w-4 text-emerald-300" />客户购买信号</div><p className="mt-1 text-xs leading-5 text-slate-500">这是申请开商机的唯一门控：记录客户端发生了什么，不记录销售做了什么。每项都要有主体、时间、原话或事件及来源。</p></div><span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-400">产品无关门控</span></div>
      <div className="grid gap-3 md:grid-cols-3">{(readiness.checks || []).map((check: any) => <EvidenceCard key={check.id} label={check.label} prompt={check.prompt} status={check.passed ? "verified" : "missing"} evidence={check.evidence} />)}</div>
      <div className="mt-4 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.045] p-3"><div className="mb-3 text-xs font-semibold text-cyan-100">录入一条客户购买信号</div><div className="grid gap-2 md:grid-cols-2"><select value={signalType} onChange={event => setSignalType(event.target.value as typeof signalType)} className="h-9 rounded-md border border-input bg-slate-900/60 px-3 text-xs text-slate-100"><option value="intent_subject">意向主体已出现</option><option value="decision_chain">决策链已触达</option><option value="trigger_event">明确触发事件存在</option></select><Input value={subjectName} onChange={event => setSubjectName(event.target.value)} placeholder={signalMeta.subjectLabel} className="h-9 bg-slate-900/60 text-xs" /><Input type="date" value={occurredDate} onChange={event => setOccurredDate(event.target.value)} className="h-9 bg-slate-900/60 text-xs" /><select value={sourceType} onChange={event => setSourceType(event.target.value as typeof sourceType)} className="h-9 rounded-md border border-input bg-slate-900/60 px-3 text-xs text-slate-100"><option value="meeting">客户会议</option><option value="customer_message">客户消息</option><option value="customer_email">客户邮件</option><option value="intelligence">外部情报</option><option value="other_evidence">其他可追溯证据</option></select><div className="md:col-span-2"><Textarea value={statement} onChange={event => setStatement(event.target.value)} placeholder={signalMeta.prompt} className="min-h-[76px] resize-none bg-slate-900/60 text-xs" /></div><div className="md:col-span-2"><Input value={sourceReference} onChange={event => setSourceReference(event.target.value)} placeholder="来源说明（会议主题、邮件主题、情报链接或记录编号；可选）" className="h-9 bg-slate-900/60 text-xs" /></div></div><Button type="button" size="sm" className="mt-3 h-8 gap-1.5 text-xs" onClick={submit} disabled={!subjectName.trim() || statement.trim().length < 8 || createSignal.isPending}><Plus className="h-3.5 w-3.5" />{createSignal.isPending ? "正在写入事实…" : "记录购买信号"}</Button></div>
      {signals.length > 0 && <div className="mt-3 border-t border-slate-700/60 pt-3"><p className="mb-2 text-[10px] font-medium text-slate-500">已入库购买信号（最新优先）</p><div className="space-y-2">{signals.slice(0, 5).map((signal: any) => <div key={signal.id} className="rounded-lg border border-slate-700/60 bg-slate-950/45 px-3 py-2"><p className="text-[11px] font-medium text-slate-200">{signal.subjectName} · {formatDate(signal.occurredAt)}</p><p className="mt-1 text-[10px] leading-4 text-slate-400">{signal.statement}</p></div>)}</div></div>}
    </section>
  );
}

function CustomerDiscoverySpin({ readiness }: { readiness: any }) {
  const needs = new Set((readiness.blockers || []).map((blocker: any) => blocker.id));
  const questions = [
    { kind: "S", title: "Situation｜现状", question: "目前谁负责这个场景？谁会参与预算、技术选择或业务采购？", evidence: "确认可触达的决策链人员" },
    { kind: "P", title: "Problem｜问题", question: "哪位客户侧人员明确说过需要解决什么问题，或正在评估什么类型的方案？", evidence: "记录意向主体的客户原话" },
    { kind: "I", title: "Implication｜影响", question: "如果不在当前窗口行动，会受到什么合规、风险、业务或管理影响？", evidence: "发现并记录必须行动的触发事件" },
    { kind: "N", title: "Need-payoff｜价值", question: "如果问题被解决，谁最在意结果？这会如何影响当前决策或预算安排？", evidence: "深化意向与决策链事实，不作产品假设" },
  ];
  const focusedHint = needs.has("intent_subject") ? "当前优先：找到表达明确需求或评估意向的客户侧人员。" : needs.has("decision_chain") ? "当前优先：触达一位对预算、技术选择或采购有影响力的人。" : needs.has("trigger_event") ? "当前优先：确认客户为什么必须现在行动。" : "三项购买信号均已就绪；进入商机后再讨论产品方案与赢单策略。";
  return (
    <section className="rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-400/[0.07] to-slate-950/55 p-4 shadow-[0_12px_35px_rgba(0,0,0,0.12)] lg:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-400/15 text-violet-200"><MessageSquareText className="h-4 w-4" /></span>
        <div>
          <h2 className="text-sm font-semibold text-slate-100">客户发现 SPIN</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">AI 根据当前门控缺口生成下次会谈提纲；问题不是事实，客户回答回填后才成为证据。</p>
        </div>
      </div>
      <div className="mt-3 rounded-lg border border-violet-400/15 bg-violet-400/[0.05] px-3 py-2 text-[11px] text-violet-100">AI 提示：{focusedHint}</div>
      <div className="mt-3 space-y-2">
        {questions.map(item => (
          <div key={item.kind} className="rounded-lg border border-slate-700/60 bg-slate-950/45 p-3">
            <div className="flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded bg-violet-400/15 text-[10px] font-bold text-violet-200">{item.kind}</span><span className="text-[11px] font-semibold text-slate-200">{item.title}</span></div>
            <p className="mt-2 text-[11px] leading-5 text-slate-300">{item.question}</p>
            <p className="mt-1 text-[10px] text-slate-500">会后应回填：{item.evidence}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function OpportunityApplicationPanel({ readiness, client, products, onSubmit, submitting }: { readiness: any; client: any; products: any[]; onSubmit: (payload: any) => void; submitting: boolean }) {
  const [name, setName] = useState(`${client.name} — 新商机`);
  const [productId, setProductId] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [contactName, setContactName] = useState(readiness.championName || "");

  if (readiness.stage === "进入商机") return null;
  const blockers = readiness.blockers || [];
  return (
    <section className={cn("rounded-2xl border p-4 shadow-[0_12px_35px_rgba(0,0,0,0.12)] lg:p-5", readiness.canApplyForOpportunity ? "border-emerald-400/25 bg-emerald-400/[0.045]" : "border-slate-700/70 bg-slate-950/55")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3"><span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", readiness.canApplyForOpportunity ? "bg-emerald-400/15 text-emerald-200" : "bg-slate-800 text-slate-400")}><ArrowUpRight className="h-4 w-4" /></span><div><h2 className="text-sm font-semibold text-slate-100">申请开商机</h2><p className="mt-1 text-xs leading-5 text-slate-500">唯一放行依据是意向主体、决策链触达和触发事件三项客户事实。系统在提交时再次复核，并把只读事实快照带入商机作战室。</p></div></div>
        <span className={cn("w-fit rounded-full px-2 py-1 text-[10px] font-semibold", readiness.canApplyForOpportunity ? "bg-emerald-400/15 text-emerald-100" : "bg-slate-800 text-slate-400")}>{readiness.canApplyForOpportunity ? "具备申请资格" : "尚不可申请"}</span>
      </div>
      {!readiness.canApplyForOpportunity ? <div className="mt-4 rounded-xl border border-amber-400/15 bg-amber-400/[0.04] p-3"><p className="text-xs font-semibold text-amber-100">还缺少购买信号事实</p><div className="mt-2 grid gap-2 md:grid-cols-2">{blockers.map((blocker: any) => <div key={blocker.id} className="rounded-lg border border-slate-700/60 bg-slate-950/45 px-3 py-2"><p className="text-[11px] font-medium text-slate-200">{blocker.label}</p><p className="mt-1 text-[10px] leading-4 text-slate-500">{blocker.evidence}</p></div>)}</div><p className="mt-3 text-[10px] leading-4 text-slate-500">AI 只能指出缺口，不能绕过门控、自动创建商机或把“客户感兴趣”当作购买信号。</p></div> : <div className="mt-4 grid gap-3 md:grid-cols-2"><div className="space-y-1.5"><label className="text-[11px] font-medium text-slate-300">商机名称</label><Input value={name} onChange={event => setName(event.target.value)} className="h-9 bg-slate-900/60 text-xs" /></div><div className="space-y-1.5"><label className="text-[11px] font-medium text-slate-300">拟推产品 / 能力</label><select value={productId} onChange={event => setProductId(event.target.value)} className="h-9 w-full rounded-md border border-input bg-slate-900/60 px-3 text-xs text-slate-100 outline-none focus:ring-2 focus:ring-cyan-400/40"><option value="">暂不关联，进入作战室后确认</option>{products.map((product: any) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></div><div className="space-y-1.5"><label className="text-[11px] font-medium text-slate-300">预估金额（可选）</label><Input value={estimatedValue} onChange={event => setEstimatedValue(event.target.value)} placeholder="例：USD 100K / 年" className="h-9 bg-slate-900/60 text-xs" /></div><div className="space-y-1.5"><label className="text-[11px] font-medium text-slate-300">客户侧主要对接人（可选）</label><Input value={contactName} onChange={event => setContactName(event.target.value)} placeholder="可在商机作战室后续确认" className="h-9 bg-slate-900/60 text-xs" /></div><div className="flex items-end md:col-span-2"><Button type="button" className="h-9 w-full gap-1.5" disabled={!name.trim() || submitting} onClick={() => onSubmit({ name: name.trim(), productId: productId ? Number(productId) : null, estimatedValue: estimatedValue.trim() || undefined, expectedCloseDate: expectedCloseDate.trim() || undefined, contactName: contactName.trim() || undefined })}><FileText className="h-3.5 w-3.5" />{submitting ? "正在复核购买信号…" : "复核购买信号并创建商机"}</Button></div></div>}
    </section>
  );
}

export default function ClientWorkstation() {
  const [, params] = useRoute("/clients/:clientId");
  const [, setLocation] = useLocation();
  const clientId = Number(params?.clientId);
  const utils = trpc.useUtils();
  const { data: clients = [], isLoading: clientsLoading } = trpc.clients.list.useQuery();
  const client = clients.find((item: any) => item.id === clientId) as any;
  const { data: contacts = [], isLoading: contactsLoading } = trpc.contacts.listByClient.useQuery({ clientId }, { enabled: Number.isFinite(clientId) });
  const { data: opportunities = [], isLoading: opportunitiesLoading } = trpc.opportunities.listByClient.useQuery({ clientId }, { enabled: Number.isFinite(clientId) });
  const { data: opportunityMeddpicc = [] } = trpc.opportunities.listMeddpiccByClient.useQuery({ clientId }, { enabled: Number.isFinite(clientId) });
  const { data: meetings = [] } = trpc.meetings.listByClient.useQuery({ clientId }, { enabled: Number.isFinite(clientId) });
  const { data: signals = [] } = trpc.intelligence.listByClient.useQuery({ clientId }, { enabled: Number.isFinite(clientId) });
  const { data: readiness, isLoading: readinessLoading } = trpc.opportunities.customerReadiness.useQuery({ clientId }, { enabled: Number.isFinite(clientId) });
  const { data: customTasks = [] } = trpc.pod.listByClient.useQuery({ clientId }, { enabled: Number.isFinite(clientId) });
  const { data: products = [] } = trpc.products.listActive.useQuery();

  const addTask = trpc.pod.addTask.useMutation({
    onSuccess: () => utils.pod.listByClient.invalidate({ clientId }),
  });
  const updateTask = trpc.pod.updateTaskStatus.useMutation({
    onSuccess: () => utils.pod.listByClient.invalidate({ clientId }),
  });
  const applyForOpportunity = trpc.opportunities.createFromCustomerReadiness.useMutation({
    onSuccess: (result) => {
      utils.clients.list.invalidate();
      utils.opportunities.listByClient.invalidate({ clientId });
      utils.opportunities.customerReadiness.invalidate({ clientId });
      setLocation(`/clients/${clientId}/opportunities/${result.id}`);
    },
  });

  const latestEvents = useMemo(() => {
    const visitEvents = meetings.map((meeting: any) => ({
      id: `meeting-${meeting.id}`, type: "拜访", date: meeting.meetingDate, title: meeting.subject || meeting.customerName || "客户拜访记录", detail: meeting.aiMinutes || meeting.keyPoints || meeting.nextSteps || "已入库拜访事实"
    }));
    const signalEvents = signals.map((signal: any) => ({
      id: `signal-${signal.id}`, type: "情报", date: signal.createdAt || signal.publishedAt, title: signal.title || signal.signalType || "客户情报信号", detail: signal.rawSignal || signal.summary || "已入库情报信号"
    }));
    return [...visitEvents, ...signalEvents].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6);
  }, [meetings, signals]);

  if (clientsLoading || contactsLoading || opportunitiesLoading || readinessLoading) {
    return <div className="flex min-h-full items-center justify-center py-28 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />正在加载客户作战台…</div>;
  }
  if (!client || !readiness) {
    return <div className="mx-auto max-w-2xl px-6 py-20 text-center"><CircleAlert className="mx-auto mb-3 h-10 w-10 text-amber-300" /><h1 className="text-xl font-semibold text-foreground">未找到客户作战台</h1><Button className="mt-6" variant="outline" onClick={() => setLocation("/battle-map")}>返回战场地图</Button></div>;
  }

  const activeOpportunities = opportunities.filter((opportunity: any) => opportunity.status === "活跃");
  const latestMeeting = [...meetings].sort((a: any, b: any) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime())[0];
  const customClientTasks = customTasks.filter((task: any) => !task.opportunityId);

  return (
    <main className="min-h-full bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.10),transparent_33%),linear-gradient(180deg,rgba(10,15,28,0.45),rgba(3,8,18,0.12))] px-4 py-5 lg:px-7 lg:py-7">
      <div className="mx-auto max-w-[1540px] space-y-5">
        <button onClick={() => setLocation("/battle-map")} className="group flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-cyan-200"><ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" /> 返回战场地图</button>
        <header className="overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950/65 shadow-[0_18px_55px_rgba(0,0,0,0.2)] backdrop-blur-sm">
          <div className="flex flex-col gap-5 px-5 py-5 lg:flex-row lg:items-start lg:justify-between lg:px-7 lg:py-6">
            <div className="flex min-w-0 gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-200"><Building2 className="h-6 w-6" /></div><div className="min-w-0"><div className="mb-1 flex flex-wrap items-center gap-2"><h1 className="text-2xl font-semibold tracking-tight text-slate-50">{client.name}</h1><span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-200">客户作战台</span></div><p className="text-sm text-slate-400">{[client.industry, client.country, client.stage].filter(Boolean).join(" · ")}</p><p className="mt-2 text-xs text-slate-500">最后有效客户对话：{latestMeeting ? formatDate(latestMeeting.meetingDate) : "暂无入库拜访记录"}</p></div></div>
            <div className="grid grid-cols-3 gap-2 sm:min-w-[330px]"><div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-3 py-2.5 text-center"><div className="text-lg font-semibold text-cyan-200">{contacts.length}</div><div className="text-[10px] text-slate-500">关键人</div></div><div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-3 py-2.5 text-center"><div className="text-lg font-semibold text-amber-200">{activeOpportunities.length}</div><div className="text-[10px] text-slate-500">在打商机</div></div><div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-3 py-2.5 text-center"><div className="text-lg font-semibold text-emerald-200">{meetings.length}</div><div className="text-[10px] text-slate-500">入库对话</div></div></div>
          </div>
          <ProductCoverageBar clientId={clientId} />
        </header>

        <StageTaskCenter readiness={readiness} customTasks={customClientTasks} taskSubmitting={addTask.isPending} onAddTask={(title, description) => addTask.mutate({ clientId, assignedRole: "SAM", title, description: description || undefined })} onToggleTask={(task) => updateTask.mutate({ id: task.id, taskStatus: task.isCompleted || task.taskStatus === "done" ? "pending" : "done" })} />

        <OpportunityApplicationPanel readiness={readiness} client={client} products={products as any[]} submitting={applyForOpportunity.isPending} onSubmit={(payload) => applyForOpportunity.mutate({ clientId, ...payload })} />

        {client.stage !== "进入商机" && <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(340px,0.85fr)]">
          <PurchaseSignalWorkbench readiness={readiness} clientId={clientId} />
          <CustomerDiscoverySpin readiness={readiness} />
        </div>}

        <section className="rounded-2xl border border-slate-700/70 bg-slate-950/55 p-4 shadow-[0_12px_35px_rgba(0,0,0,0.12)] lg:p-5"><div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2 text-sm font-semibold text-slate-100"><Crosshair className="h-4 w-4 text-amber-300" />{client.stage === "进入商机" ? "在打商机" : "机会假设与商机门控"}</div><p className="mt-1 text-xs text-slate-500">{client.stage === "进入商机" ? "客户级只看商机摘要；所有交易方法论、证据与行动均进入独立作战室。" : "当阶段门控满足后，SAM 或 AD 才能申请开商机；系统不会把主观兴趣视为证据。"}</p></div><span className="text-xs text-slate-500">{opportunities.length} 条商机</span></div><div className="space-y-3">{opportunities.length === 0 ? <div className="rounded-xl border border-dashed border-slate-700 px-5 py-8 text-center text-sm text-slate-500">暂无已开商机。请先完成当前阶段的客观证据与标准动作。</div> : opportunities.map((opportunity: any) => { const score = calculateOpportunityHealth(opportunityMeddpicc.find((item: any) => item.opportunityId === opportunity.id)); return <article key={opportunity.id} className="group rounded-xl border border-slate-700/60 bg-slate-900/35 p-4 transition-colors hover:border-cyan-400/35 hover:bg-slate-900/60"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-slate-100">{opportunity.name}</h3><span className="rounded border border-cyan-300/20 bg-cyan-400/10 px-1.5 py-0.5 text-[10px] text-cyan-200">{opportunity.stage || "阶段待定义"}</span><OpportunityHealthBadge score={score} /></div><div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">{opportunity.estimatedValue && <span>金额：<strong className="font-medium text-slate-300">{opportunity.estimatedValue}</strong></span>}{opportunity.productName && <span>产品：<strong className="font-medium text-slate-300">{opportunity.productName}</strong></span>}{opportunity.competitorName && <span>竞品：<strong className="font-medium text-amber-200">{opportunity.competitorName}</strong></span>}</div></div><Button size="sm" className="h-8 shrink-0 gap-1.5 bg-cyan-500/15 text-xs text-cyan-100 hover:bg-cyan-400/25" variant="outline" onClick={() => setLocation(`/clients/${clientId}/opportunities/${opportunity.id}`)}>进入作战室 <ArrowUpRight className="h-3.5 w-3.5" /></Button></div></article>; })}</div></section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.95fr)]">
          <section className="rounded-2xl border border-slate-700/70 bg-slate-950/55 p-4 shadow-[0_12px_35px_rgba(0,0,0,0.12)] lg:p-5"><div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-100"><UsersRound className="h-4 w-4 text-cyan-300" />组织与 Buying Group</div><p className="mb-4 text-xs text-slate-500">客户级维护组织关系和角色覆盖；商机页只引用与该交易相关的子集。</p><KeyContactsPanel clientId={clientId} clientName={client.name} /></section>
          <section className="rounded-2xl border border-slate-700/70 bg-slate-950/55 p-4 shadow-[0_12px_35px_rgba(0,0,0,0.12)] lg:p-5"><div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-100"><CalendarClock className="h-4 w-4 text-violet-300" />客户事实时间线</div><div className="space-y-3">{latestEvents.length === 0 ? <p className="rounded-lg border border-dashed border-slate-700 px-3 py-6 text-center text-xs text-slate-500">暂无拜访或情报事实。录入后，AI 才能识别趋势与门控缺口。</p> : latestEvents.map((event: any) => <div key={event.id} className="border-l border-slate-700 pl-3"><div className="mb-1 flex items-center gap-2"><span className={cn("rounded px-1.5 py-0.5 text-[10px]", event.type === "拜访" ? "bg-violet-400/10 text-violet-200" : "bg-amber-400/10 text-amber-200")}>{event.type}</span><span className="text-[10px] text-slate-500">{formatDate(event.date)}</span></div><div className="text-xs font-medium text-slate-300">{event.title}</div><p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{event.detail}</p></div>)}</div></section>
        </div>
      </div>
    </main>
  );
}
