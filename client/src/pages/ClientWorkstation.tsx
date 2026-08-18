import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowUpRight, Building2, CalendarClock, CheckCircle2,
  ChevronRight, CircleAlert, ClipboardCheck, ContactRound, Crosshair,
  FileText, Flag, Loader2, MessageSquareText, Plus, ShieldCheck,
  Sparkles, Target, UsersRound, Zap, RefreshCw, CheckCheck, Circle
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { calculateOpportunityHealth } from "@/lib/opportunityHealth";
import { classifyExecutiveMeetings } from "@shared/executiveMeetingEvidence";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { KeyContactsPanel, ProductCoverageBar } from "./BattleMap";
import PreVisitInsightButton from "@/components/PreVisitInsightButton";
import ExternalSignalWorkbench from "@/components/ExternalSignalWorkbench";

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

function PurchaseSignalWorkbench({ readiness, clientId, contacts }: { readiness: any; clientId: number; contacts: any[] }) {
  const utils = trpc.useUtils();
  const { data: signals = [] } = trpc.purchaseSignals.listByClient.useQuery({ clientId });
  const [signalType, setSignalType] = useState<"intent_subject" | "decision_chain" | "trigger_event">("intent_subject");
  const [subjectName, setSubjectName] = useState("");
  const [subjectContactId, setSubjectContactId] = useState("");
  const [occurredDate, setOccurredDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [statement, setStatement] = useState("");
  const [sourceType, setSourceType] = useState<"meeting" | "customer_message" | "customer_email" | "intelligence" | "other_evidence">("meeting");
  const [sourceReference, setSourceReference] = useState("");
  const createSignal = trpc.purchaseSignals.create.useMutation({ onSuccess: () => { utils.purchaseSignals.listByClient.invalidate({ clientId }); utils.opportunities.customerReadiness.invalidate({ clientId }); setSubjectName(""); setSubjectContactId(""); setStatement(""); setSourceReference(""); } });
  const signalMeta = {
    intent_subject: { label: "意向主体已出现", subjectLabel: "客户侧表达者", prompt: "谁明确表达过“需要解决 X”或“正在评估此类方案”？请原样记录客户表述。" },
    decision_chain: { label: "决策链已触达", subjectLabel: "从关键人图谱选择人员", prompt: "选择已接触且具有预算影响力、技术决策权或用户影响力的关键人，并记录本次直接接触事实。" },
    trigger_event: { label: "明确触发事件存在", subjectLabel: "触发事件名称", prompt: "是什么让客户必须现在行动？例如合规截止日、安全事件、业务扩张、预算周期或高层指令。" },
  }[signalType];
  const submit = () => {
    if (!subjectName.trim() || statement.trim().length < 8 || (signalType === "decision_chain" && !subjectContactId)) return;
    createSignal.mutate({ clientId, signalType, subjectName: subjectName.trim(), subjectContactId: signalType === "decision_chain" ? Number(subjectContactId) : null, occurredAt: new Date(`${occurredDate}T12:00:00`).toISOString(), statement: statement.trim(), sourceType, sourceReference: sourceReference.trim() || undefined });
  };
  return (
    <section className="rounded-2xl border border-slate-700/70 bg-slate-950/55 p-4 shadow-[0_12px_35px_rgba(0,0,0,0.12)] lg:p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2 text-sm font-semibold text-slate-100"><ShieldCheck className="h-4 w-4 text-emerald-300" />客户购买信号</div><p className="mt-1 text-xs leading-5 text-slate-500">这是申请开商机的唯一门控：记录客户端发生了什么，不记录销售做了什么。每项都要有主体、时间、原话或事件及来源。</p></div><span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-400">产品无关门控</span></div>
      <div className="grid gap-3 md:grid-cols-3">{(readiness.checks || []).map((check: any) => <EvidenceCard key={check.id} label={check.label} prompt={check.prompt} status={check.passed ? "verified" : "missing"} evidence={check.evidence} />)}</div>
      <div className="mt-4 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.045] p-3"><div className="mb-3 text-xs font-semibold text-cyan-100">录入一条客户购买信号</div><div className="grid gap-2 md:grid-cols-2"><select value={signalType} onChange={event => { setSignalType(event.target.value as typeof signalType); setSubjectName(""); setSubjectContactId(""); }} className="h-9 rounded-md border border-input bg-slate-900/60 px-3 text-xs text-slate-100"><option value="intent_subject">意向主体已出现</option><option value="decision_chain">决策链已触达</option><option value="trigger_event">明确触发事件存在</option></select>{signalType === "decision_chain" ? <select value={subjectContactId} onChange={event => { const contact = contacts.find(item => item.id === Number(event.target.value)); setSubjectContactId(event.target.value); setSubjectName(contact?.name || ""); }} className="h-9 rounded-md border border-input bg-slate-900/60 px-3 text-xs text-slate-100"><option value="">选择已入库关键人</option>{contacts.map(contact => <option key={contact.id} value={contact.id}>{contact.name} {contact.buyingRole ? `· ${contact.buyingRole}` : "· 未标注角色"}</option>)}</select> : <Input value={subjectName} onChange={event => setSubjectName(event.target.value)} placeholder={signalMeta.subjectLabel} className="h-9 bg-slate-900/60 text-xs" />}<Input type="date" value={occurredDate} onChange={event => setOccurredDate(event.target.value)} className="h-9 bg-slate-900/60 text-xs" /><select value={sourceType} onChange={event => setSourceType(event.target.value as typeof sourceType)} className="h-9 rounded-md border border-input bg-slate-900/60 px-3 text-xs text-slate-100"><option value="meeting">客户会议</option><option value="customer_message">客户消息</option><option value="customer_email">客户邮件</option><option value="intelligence">外部情报</option><option value="other_evidence">其他可追溯证据</option></select><div className="md:col-span-2"><Textarea value={statement} onChange={event => setStatement(event.target.value)} placeholder={signalMeta.prompt} className="min-h-[76px] resize-none bg-slate-900/60 text-xs" /></div><div className="md:col-span-2"><Input value={sourceReference} onChange={event => setSourceReference(event.target.value)} placeholder="来源说明（会议主题、邮件主题、情报链接或记录编号；可选）" className="h-9 bg-slate-900/60 text-xs" /></div></div><Button type="button" size="sm" className="mt-3 h-8 gap-1.5 text-xs" onClick={submit} disabled={!subjectName.trim() || statement.trim().length < 8 || (signalType === "decision_chain" && !subjectContactId) || createSignal.isPending}><Plus className="h-3.5 w-3.5" />{createSignal.isPending ? "正在写入事实…" : "记录购买信号"}</Button></div>
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

function ExecutiveOpportunityPanel({ client, contacts, meetings, isAd, onSubmit, submitting }: { client: any; contacts: any[]; meetings: any[]; isAd: boolean; onSubmit: (payload: any) => void; submitting: boolean }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(`${client.name} — 高层直入商机`);
  const [executiveContactId, setExecutiveContactId] = useState("");
  const [meetingIds, setMeetingIds] = useState<number[]>([]);
  const [confirmation, setConfirmation] = useState("");
  if (client.stage === "进入商机") return null;
  const executives = contacts.filter(contact => contact.buyingRole === "经济决策人");
  const selectedExecutive = executives.find(contact => contact.id === Number(executiveContactId));
  const inspectedMeetings = classifyExecutiveMeetings(meetings, selectedExecutive?.name);
  const validSelectedMeetings = inspectedMeetings.filter(meeting => meetingIds.includes(meeting.id) && meeting.executiveDetected);
  const toggleMeeting = (id: number) => setMeetingIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);

  return <section className="rounded-2xl border border-violet-400/20 bg-violet-400/[0.035] p-4 shadow-[0_12px_35px_rgba(0,0,0,0.12)] lg:p-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-sm font-semibold text-violet-100">高层直接建立商机信号</h2><p className="mt-1 text-xs leading-5 text-slate-500">这是受控例外：高层直接释放明确信号时，可不等待三项常规信号齐备；但必须由 AD 确认，并引用至少两次经济决策人直接对话的拜访事实。</p></div><Button type="button" size="sm" variant="outline" className="border-violet-400/30 bg-violet-400/10 text-violet-100 hover:bg-violet-400/20" onClick={() => setOpen(value => !value)}>{open ? "收起" : "展开入口"}</Button></div>
    {open && <div className="mt-4 space-y-3 border-t border-violet-400/15 pt-4">{!isAd && <div className="rounded-lg border border-amber-400/20 bg-amber-400/[0.05] px-3 py-2 text-[11px] leading-5 text-amber-100">仅 AD 或系统管理员可提交高层直入确认；其他角色可查看条件但不能放行。</div>}<div className="grid gap-3 md:grid-cols-2"><div className="space-y-1.5"><label className="text-[11px] font-medium text-slate-300">商机名称</label><Input value={name} onChange={event => setName(event.target.value)} className="h-9 bg-slate-900/60 text-xs" /></div><div className="space-y-1.5"><label className="text-[11px] font-medium text-slate-300">经济决策人</label><select value={executiveContactId} onChange={event => { setExecutiveContactId(event.target.value); setMeetingIds([]); }} className="h-9 w-full rounded-md border border-input bg-slate-900/60 px-3 text-xs text-slate-100"><option value="">从关键人图谱选择</option>{executives.map(contact => <option key={contact.id} value={contact.id}>{contact.name} · 经济决策人</option>)}</select></div></div><div><p className="mb-2 text-[11px] font-medium text-slate-300">引用至少两次该高层参与或直接对话的拜访记录</p>{selectedExecutive && <p className="mb-2 text-[10px] text-violet-100/75">检测规则：只在与会人、关键信息、全文或 AI 纪要中检测“{selectedExecutive.name}”；不同英文名或缩写不会被自动视为同一人。</p>}{meetings.length === 0 ? <p className="rounded-lg border border-dashed border-slate-700 px-3 py-4 text-xs text-slate-500">暂无可引用拜访记录。</p> : <div className="grid gap-2 md:grid-cols-2">{inspectedMeetings.map((meeting: any) => <label key={meeting.id} className={cn("flex cursor-pointer gap-2 rounded-lg border px-3 py-2 text-xs", meetingIds.includes(meeting.id) ? "border-violet-400/45 bg-violet-400/[0.08] text-violet-100" : "border-slate-700/60 bg-slate-950/35 text-slate-400")}><input type="checkbox" checked={meetingIds.includes(meeting.id)} onChange={() => toggleMeeting(meeting.id)} className="mt-0.5 accent-violet-400" /><span><strong className="font-medium text-slate-200">{formatDate(meeting.meetingDate)}</strong><br />{meeting.attendees || meeting.keyPoints?.slice(0, 80) || "拜访记录"}<br /><em className={cn("mt-1 inline-block not-italic", meeting.executiveDetected ? "text-emerald-300" : "text-slate-500")}>{selectedExecutive ? (meeting.executiveDetected ? `已检测到 ${selectedExecutive.name} 参与` : `未检测到 ${selectedExecutive.name} 姓名`) : "请先选择经济决策人"}</em></span></label>)}</div>}{selectedExecutive && <p className="mt-2 text-[10px] text-slate-500">当前已选择 {validSelectedMeetings.length}/2 条有效拜访证据；仅绿色“已检测到”记录会被服务端计入门控。</p>}</div><div className="space-y-1.5"><label className="text-[11px] font-medium text-slate-300">AD 确认说明</label><Textarea value={confirmation} onChange={event => setConfirmation(event.target.value)} placeholder="说明高层释放的具体商机信号、为何可直接进入商机，以及引用的两次对话事实。" className="min-h-[84px] resize-none bg-slate-900/60 text-xs" /></div><Button type="button" className="h-9 w-full gap-1.5 bg-violet-500 text-white hover:bg-violet-400" disabled={!isAd || !name.trim() || !selectedExecutive || validSelectedMeetings.length < 2 || confirmation.trim().length < 12 || submitting} onClick={() => onSubmit({ name: name.trim(), bypassReason: "exec_meeting", executiveContactId: selectedExecutive.id, executiveMeetingIds: validSelectedMeetings.map(meeting => meeting.id), adConfirmation: confirmation.trim(), contactName: selectedExecutive.name })}><ShieldCheck className="h-3.5 w-3.5" />{submitting ? "正在核验拜访事实…" : "AD 确认并建立商机"}</Button></div>}
  </section>;
}

function ClientActionDesk({ client, clientId, meddpicc, signals }: { client: any; clientId: number; meddpicc: any; signals: any[] }) {
  const utils = trpc.useUtils();
  const [adoptedIds, setAdoptedIds] = useState<Set<number>>(new Set());
  const { data: actions = [], refetch } = trpc.actions.listByClient.useQuery({ clientId });
  const pendingActions = actions.filter((action: any) => !action.isCompleted);
  const generate = trpc.actions.generate.useMutation({
    onSuccess: () => { refetch(); setAdoptedIds(new Set()); },
  });
  const adoptOne = trpc.actions.adoptOne.useMutation({
    onSuccess: (_result, variables) => {
      setAdoptedIds(current => new Set(Array.from(current).concat(variables.actionId)));
      utils.pod.listByClient.invalidate({ clientId });
    },
  });

  const generateActions = () => {
    if (!meddpicc) return;
    generate.mutate({
      clientId,
      clientName: client.name,
      industry: client.industry || undefined,
      stage: client.stage || "进入商机",
      hookTopic: client.hookTopic || undefined,
      securityAngle: client.securityAngle || undefined,
      meddpicc: {
        metricsScore: meddpicc.metricsScore,
        economicBuyerScore: meddpicc.economicBuyerScore,
        economicBuyerName: meddpicc.economicBuyerName,
        decisionCriteriaScore: meddpicc.decisionCriteriaScore,
        decisionProcessScore: meddpicc.decisionProcessScore,
        implicatePainScore: meddpicc.implicatePainScore,
        championScore: meddpicc.championScore,
        championName: meddpicc.championName,
        competitionScore: meddpicc.competitionScore,
      },
      recentSignals: signals.slice(0, 5).map((signal: any) => ({
        signalType: signal.signalType,
        content: signal.rawSignal || "",
        aiInterpretation: signal.aiInterpretation,
      })),
      visitCount: client.visitCount ?? 0,
      lastVisitDate: client.lastVisitDate ? new Date(client.lastVisitDate).toISOString() : null,
    });
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-400/[0.07] via-slate-950/75 to-slate-950/80 shadow-[0_16px_45px_rgba(124,58,237,0.08)]">
      <div className="flex flex-col gap-3 border-b border-violet-400/15 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-400/15 text-violet-200"><Zap className="h-4.5 w-4.5" /></span>
          <div>
            <h2 className="text-sm font-semibold text-violet-50">AI 行动指令</h2>
            <p className="mt-1 text-[11px] leading-5 text-violet-100/55">AI 根据已入库客户事实、客户级关系证据与外部信号提出客户经营行动；采纳后才会进入 POD 协同任务。</p>
          </div>
        </div>
        <Button size="sm" type="button" variant="outline" onClick={generateActions} disabled={!meddpicc || generate.isPending} className="h-8 gap-1.5 border-violet-400/30 bg-violet-400/10 text-xs text-violet-100 hover:bg-violet-400/20">
          <RefreshCw className={cn("h-3.5 w-3.5", generate.isPending && "animate-spin")} />
          {generate.isPending ? "AI 生成中…" : pendingActions.length ? "刷新行动指令" : "生成行动指令"}
        </Button>
      </div>
      {!meddpicc ? (
        <div className="px-5 py-5 text-xs leading-5 text-slate-400">数据不足，暂不判断。请先补充客户级关系证据，AI 才会生成可核验的行动建议。</div>
      ) : pendingActions.length === 0 ? (
        <div className="px-5 py-5 text-xs leading-5 text-slate-400">尚无待执行指令。生成时只使用已入库的客户事实，不将销售主观判断当作证据。</div>
      ) : (
        <div className="space-y-2 px-5 py-4">
          {pendingActions.map((action: any) => {
            const adopted = adoptedIds.has(action.id);
            return <article key={action.id} className={cn("rounded-xl border p-3", adopted ? "border-emerald-400/35 bg-emerald-400/[0.06]" : "border-slate-700/70 bg-slate-950/45")}>
              <div className="flex items-start gap-3">
                <button type="button" disabled={adopted || adoptOne.isPending} onClick={() => adoptOne.mutate({ actionId: action.id, clientId, clientName: client.name })} className={cn("mt-0.5 shrink-0", adopted ? "cursor-default text-emerald-300" : "text-slate-500 transition-colors hover:text-emerald-300")} title={adopted ? "已采纳并推入 POD" : "采纳并推入 POD 任务"}>{adopted ? <CheckCheck className="h-5 w-5" /> : <Circle className="h-5 w-5" />}</button>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5"><span className="rounded border border-violet-400/25 bg-violet-400/10 px-1.5 py-0.5 text-[9px] font-semibold text-violet-200">{action.responsibleRole}</span><span className="text-[10px] text-slate-500">{action.timeframe} · {action.priority}优先</span>{adopted && <span className="text-[10px] text-emerald-300">已进入 POD 任务</span>}</div>
                  <h3 className="text-xs font-semibold text-slate-100">{action.title}</h3>
                  {action.objective && <p className="mt-1 text-[11px] leading-5 text-slate-400"><span className="font-medium text-slate-300">行动目标：</span>{action.objective}</p>}
                  {action.suggestedScript && <p className="mt-2 rounded-lg border border-slate-700/60 bg-slate-950/65 px-2.5 py-2 text-[10px] leading-4 text-slate-400"><span className="font-semibold text-violet-200">建议话术：</span>{action.suggestedScript}</p>}
                </div>
              </div>
            </article>;
          })}
        </div>
      )}
    </section>
  );
}

function ClientRelationshipReview({ clientId, stage, contacts, meetings, signals }: { clientId: number; stage: string; contacts: any[]; meetings: any[]; signals: any[] }) {
  const utils = trpc.useUtils();
  const [generatedReview, setGeneratedReview] = useState("");
  const [activeReview, setActiveReview] = useState<"0to1" | "buyingGroup" | "visitTrend">("0to1");
  const { data: reviews = [] } = trpc.insights.getLatestReviews.useQuery({ clientId });
  const hasEvidence = contacts.length + meetings.length + signals.length > 0;
  const latestForType = (type: string) => (reviews as any[]).find(review => review.reviewType === type)?.content || "";
  const zeroToOne = trpc.insights.reviewZeroToOne.useMutation({
    onSuccess: result => { setActiveReview("0to1"); setGeneratedReview(result.content); utils.insights.getLatestReviews.invalidate({ clientId }); toast.success("AI 关系推进 Review 已生成"); },
    onError: error => toast.error(`AI Review 生成失败：${error.message}`),
  });
  const buyingGroup = trpc.insights.reviewBuyingGroup.useMutation({
    onSuccess: result => { setActiveReview("buyingGroup"); setGeneratedReview(result.content); utils.insights.getLatestReviews.invalidate({ clientId }); toast.success("Buying Group 分析已生成"); },
    onError: error => toast.error(`Buying Group 分析失败：${error.message}`),
  });
  const visitTrend = trpc.insights.reviewVisitTrend.useMutation({
    onSuccess: result => { setActiveReview("visitTrend"); setGeneratedReview(result.content || ""); utils.insights.getLatestReviews.invalidate({ clientId }); toast.success("拜访趋势分析已生成"); },
    onError: error => toast.error(`拜访趋势分析失败：${error.message}`),
  });
  const pending = zeroToOne.isPending || buyingGroup.isPending || visitTrend.isPending;
  const reviewContent = generatedReview || latestForType(activeReview);

  return <section className="overflow-hidden rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-400/[0.07] via-slate-950/75 to-slate-950/80 shadow-[0_16px_45px_rgba(124,58,237,0.08)]">
    <div className="flex flex-col gap-3 border-b border-violet-400/15 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex items-start gap-3"><span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-400/15 text-violet-200"><Sparkles className="h-4.5 w-4.5" /></span><div><h2 className="text-sm font-semibold text-violet-50">AI 关系推进 Review</h2><p className="mt-1 text-[11px] leading-5 text-violet-100/55">仅用于 0→1 客户经营：识别关系是否足够热、决策链覆盖何处缺口；不会以销售自评或拜访数量替代客户购买信号。</p></div></div>
      <div className="flex flex-wrap gap-2"><Button size="sm" type="button" onClick={() => zeroToOne.mutate({ clientId })} disabled={!hasEvidence || pending} className="h-8 gap-1.5 bg-violet-500/80 text-xs text-white hover:bg-violet-400"><Sparkles className="h-3.5 w-3.5" />{zeroToOne.isPending ? "分析中…" : "关系推进 Review"}</Button><Button size="sm" type="button" variant="outline" onClick={() => buyingGroup.mutate({ clientId })} disabled={!hasEvidence || pending} className="h-8 border-cyan-400/30 bg-cyan-400/10 text-xs text-cyan-100 hover:bg-cyan-400/20">Buying Group</Button><Button size="sm" type="button" variant="outline" onClick={() => visitTrend.mutate({ clientId })} disabled={!hasEvidence || pending} className="h-8 border-emerald-400/30 bg-emerald-400/10 text-xs text-emerald-100 hover:bg-emerald-400/20">拜访趋势</Button></div>
    </div>
    <div className="grid gap-px bg-violet-300/10 lg:grid-cols-[0.82fr_1.18fr]">
      <div className="space-y-3 bg-slate-950/60 p-4"><div><div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-200/75">事实依据</div><div className="grid grid-cols-3 gap-2"><div className="rounded-lg border border-slate-700/60 bg-slate-950/60 px-2.5 py-2"><div className="text-sm font-semibold text-violet-200">{contacts.length}</div><div className="text-[9px] text-slate-500">关键人</div></div><div className="rounded-lg border border-slate-700/60 bg-slate-950/60 px-2.5 py-2"><div className="text-sm font-semibold text-cyan-200">{meetings.length}</div><div className="text-[9px] text-slate-500">拜访事实</div></div><div className="rounded-lg border border-slate-700/60 bg-slate-950/60 px-2.5 py-2"><div className="text-sm font-semibold text-amber-200">{signals.length}</div><div className="text-[9px] text-slate-500">情报信号</div></div></div></div><div className="rounded-lg border border-violet-400/15 bg-violet-400/[0.04] p-3"><div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-200/75">方法论边界</div><p className="text-[11px] leading-5 text-slate-300">客户级 MEDDPICC 只记录关系就绪度证据；Buying Group 验证决策链覆盖；购买信号门控决定是否可以申请开商机。</p></div><p className="text-[10px] leading-4 text-slate-500">{hasEvidence ? "AI 结论仅基于已入库事实；生成后需由负责人审核，并将新的客户事实回填至对应工作区。" : "数据不足，暂不判断。请先录入拜访、关键人或外部情报事实。"}</p></div>
      <div className="bg-slate-950/60 p-4"><div className="mb-2 flex flex-wrap items-center gap-2"><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-200/75">AI 判断与下一步</div><div className="ml-auto flex gap-1">{(["0to1", "buyingGroup", "visitTrend"] as const).map(type => <button key={type} type="button" onClick={() => { setActiveReview(type); setGeneratedReview(""); }} className={cn("rounded px-1.5 py-0.5 text-[9px]", activeReview === type ? "bg-violet-400/15 text-violet-100" : "text-slate-500 hover:text-slate-300")}>{type === "0to1" ? "关系" : type === "buyingGroup" ? "组织" : "趋势"}</button>)}</div></div>{pending ? <div className="flex min-h-36 items-center justify-center gap-2 text-xs text-slate-400"><Loader2 className="h-4 w-4 animate-spin text-violet-300" />AI 正在基于客户事实研判…</div> : reviewContent ? <div className="prose prose-invert prose-sm max-w-none text-xs leading-6 prose-headings:text-violet-100 prose-strong:text-slate-100"><ReactMarkdown>{reviewContent}</ReactMarkdown></div> : <div className="flex min-h-36 items-center rounded-lg border border-dashed border-slate-700 px-4 text-xs leading-5 text-slate-500">尚未生成该维度的 Review。点击上方按钮，让 AI 根据已入库客户事实给出判断；无数据时不会替你推断客户意图。</div>}</div>
    </div>
  </section>;
}

const ACCOUNT_SCORE_FIELDS = [
  ["strategicFitScore", "战略匹配"], ["potentialScore", "客户潜力"], ["relationshipScore", "关系基础"], ["whitespaceScore", "Whitespace"], ["execPriorityScore", "高层优先级"],
] as const;
const COVERAGE_LEVELS = ["C-Suite", "业务 Sponsor", "技术架构", "采购/法务", "使用部门", "区域/子公司"];

function AccountMapPanel({ clientId }: { clientId: number }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.command2.getAccountMap.useQuery({ clientId });
  const overview = data?.overview as any;
  const coverage = (data?.coverage || []) as any[];
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [coverageDraft, setCoverageDraft] = useState({ coverageLevel: "C-Suite", targetPerson: "", ourCoverer: "", strengthScore: "", gapJudgment: "P1", nextAction: "" });
  useEffect(() => {
    setDraft({
      strategicFitScore: overview?.strategicFitScore == null ? "" : String(overview.strategicFitScore), potentialScore: overview?.potentialScore == null ? "" : String(overview.potentialScore), relationshipScore: overview?.relationshipScore == null ? "" : String(overview.relationshipScore), whitespaceScore: overview?.whitespaceScore == null ? "" : String(overview.whitespaceScore), execPriorityScore: overview?.execPriorityScore == null ? "" : String(overview.execPriorityScore),
      strategy12m: overview?.strategy12m || "", strategy24m: overview?.strategy24m || "", strategy36m: overview?.strategy36m || "", triggerEvents: overview?.triggerEvents || "", vendorVision: overview?.vendorVision || "", annualSuccessKPI: overview?.annualSuccessKPI || "",
    });
  }, [overview?.id, overview?.updatedAt]);
  const saveOverview = trpc.command2.saveAccountOverview.useMutation({ onSuccess: () => { utils.command2.getAccountMap.invalidate({ clientId }); toast.success("Account Map 已保存"); }, onError: error => toast.error(error.message) });
  const saveCoverage = trpc.command2.saveCoverage.useMutation({ onSuccess: () => { utils.command2.getAccountMap.invalidate({ clientId }); setCoverageDraft({ coverageLevel: "C-Suite", targetPerson: "", ourCoverer: "", strengthScore: "", gapJudgment: "P1", nextAction: "" }); } });
  const deleteCoverage = trpc.command2.deleteCoverage.useMutation({ onSuccess: () => utils.command2.getAccountMap.invalidate({ clientId }) });
  const parseScore = (value: string) => value === "" ? null : Number(value);
  const tone = (value: number | null | undefined) => value == null ? "border-slate-700 bg-slate-900/35 text-slate-500" : value <= 2 ? "border-rose-400/25 bg-rose-400/[0.06] text-rose-200" : value === 3 ? "border-amber-400/25 bg-amber-400/[0.06] text-amber-200" : "border-emerald-400/25 bg-emerald-400/[0.06] text-emerald-200";
  if (isLoading) return <section className="rounded-2xl border border-slate-700/60 bg-slate-950/55 p-5 text-xs text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />加载 Account Map…</section>;
  return <section className="overflow-hidden rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/[0.07] via-slate-950/70 to-slate-950/80 shadow-[0_16px_45px_rgba(8,145,178,0.08)]">
    <div className="flex flex-col gap-3 border-b border-cyan-300/15 px-5 py-4 lg:flex-row lg:items-start lg:justify-between"><div className="flex gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-200"><Target className="h-4.5 w-4.5" /></span><div><h2 className="text-sm font-semibold text-cyan-50">Account Map｜客户战略经营</h2><p className="mt-1 text-[11px] leading-5 text-cyan-100/55">仅用于 0→1：判断是否值得重兵投入、关系是否多层覆盖、客户对我方认知是否深化；未填写即为数据不足，AI 不会自行推断。</p></div></div><span className="w-fit rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-1 text-[10px] font-semibold text-cyan-100">0→1 专属</span></div>
    <div className="grid gap-px bg-cyan-300/10 xl:grid-cols-[1.05fr_0.95fr]"><div className="space-y-4 bg-slate-950/60 p-4"><div className="grid grid-cols-5 gap-2">{ACCOUNT_SCORE_FIELDS.map(([key, label]) => { const value = parseScore(draft[key] || ""); return <label key={key} className={cn("rounded-xl border p-2 text-center", tone(value))}><span className="block text-base font-semibold">{value == null ? "—" : value}</span><span className="block text-[9px]">{label}</span><select value={draft[key] || ""} onChange={event => setDraft(current => ({ ...current, [key]: event.target.value }))} className="mt-1 h-6 w-full rounded border border-slate-700 bg-slate-950/70 px-1 text-[9px] text-slate-200"><option value="">未填写</option>{[0,1,2,3,4,5].map(score => <option key={score} value={score}>{score}/5</option>)}</select></label>; })}</div>
      <div className="grid gap-2 sm:grid-cols-2"><Textarea value={draft.strategy12m || ""} onChange={event => setDraft(current => ({ ...current, strategy12m: event.target.value }))} placeholder="12个月客户经营目标（事实假设需后续验证）" className="min-h-[72px] resize-none bg-slate-900/60 text-xs" /><Textarea value={draft.triggerEvents || ""} onChange={event => setDraft(current => ({ ...current, triggerEvents: event.target.value }))} placeholder="已知触发事件（合规、预算、安全事件等）" className="min-h-[72px] resize-none bg-slate-900/60 text-xs" /><Input value={draft.vendorVision || ""} onChange={event => setDraft(current => ({ ...current, vendorVision: event.target.value }))} placeholder="客户当前将我们视为：Advisor / Partner / Vendor / Challenger" className="h-9 bg-slate-900/60 text-xs" /><Input value={draft.annualSuccessKPI || ""} onChange={event => setDraft(current => ({ ...current, annualSuccessKPI: event.target.value }))} placeholder="年度成功 KPI（可为空）" className="h-9 bg-slate-900/60 text-xs" /></div>
      <Button type="button" size="sm" className="h-8 gap-1.5 text-xs" disabled={saveOverview.isPending} onClick={() => saveOverview.mutate({ clientId, strategicFitScore: parseScore(draft.strategicFitScore || ""), potentialScore: parseScore(draft.potentialScore || ""), relationshipScore: parseScore(draft.relationshipScore || ""), whitespaceScore: parseScore(draft.whitespaceScore || ""), execPriorityScore: parseScore(draft.execPriorityScore || ""), strategy12m: draft.strategy12m || null, strategy24m: draft.strategy24m || null, strategy36m: draft.strategy36m || null, triggerEvents: draft.triggerEvents || null, vendorVision: draft.vendorVision || null, annualSuccessKPI: draft.annualSuccessKPI || null })}><CheckCheck className="h-3.5 w-3.5" />{saveOverview.isPending ? "保存中…" : "保存 Account Map 事实"}</Button></div>
      <div className="bg-slate-950/60 p-4"><div className="mb-3"><h3 className="text-xs font-semibold text-slate-100">多层覆盖矩阵</h3><p className="mt-1 text-[10px] leading-4 text-slate-500">覆盖层级、我方关系人与下步行动均须来自真实经营记录。P1 表示当前最紧急的覆盖缺口。</p></div><div className="space-y-2">{coverage.length === 0 ? <p className="rounded-lg border border-dashed border-slate-700 px-3 py-4 text-center text-[11px] text-slate-500">未填写——AI 无法判断多层关系是否健康。</p> : coverage.map(item => <div key={item.id} className={cn("flex items-start gap-2 rounded-lg border px-3 py-2", item.gapJudgment === "P1" ? "border-rose-400/25 bg-rose-400/[0.05]" : "border-slate-700/60 bg-slate-950/45")}><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1.5"><span className="text-[10px] font-semibold text-slate-200">{item.coverageLevel || "未分层"}</span><span className="text-[10px] text-cyan-200">{item.targetPerson || "目标人未填"}</span><span className="text-[9px] text-slate-500">关系 {item.strengthScore ?? "—"}/5 · {item.gapJudgment || "未分级"}</span></div><p className="mt-1 text-[10px] text-slate-500">我方覆盖：{item.ourCoverer || "未填写"}{item.nextAction ? ` · 下一步：${item.nextAction}` : ""}</p></div><button type="button" className="text-[10px] text-slate-500 hover:text-rose-200" onClick={() => deleteCoverage.mutate({ id: item.id, clientId })}>删除</button></div>)}</div><div className="mt-3 grid gap-2 sm:grid-cols-2"><select value={coverageDraft.coverageLevel} onChange={event => setCoverageDraft(current => ({ ...current, coverageLevel: event.target.value }))} className="h-8 rounded border border-input bg-slate-900/60 px-2 text-xs text-slate-200">{COVERAGE_LEVELS.map(item => <option key={item}>{item}</option>)}</select><Input value={coverageDraft.targetPerson} onChange={event => setCoverageDraft(current => ({ ...current, targetPerson: event.target.value }))} placeholder="目标人物 / 岗位" className="h-8 bg-slate-900/60 text-xs" /><Input value={coverageDraft.ourCoverer} onChange={event => setCoverageDraft(current => ({ ...current, ourCoverer: event.target.value }))} placeholder="我方覆盖人" className="h-8 bg-slate-900/60 text-xs" /><select value={coverageDraft.gapJudgment} onChange={event => setCoverageDraft(current => ({ ...current, gapJudgment: event.target.value }))} className="h-8 rounded border border-input bg-slate-900/60 px-2 text-xs text-slate-200"><option value="P1">P1 紧急缺口</option><option value="P2">P2 重要缺口</option><option value="P3">P3 持续经营</option></select><Input value={coverageDraft.nextAction} onChange={event => setCoverageDraft(current => ({ ...current, nextAction: event.target.value }))} placeholder="下一步可验证动作" className="h-8 bg-slate-900/60 text-xs sm:col-span-2" /></div><Button type="button" size="sm" variant="outline" className="mt-2 h-8 w-full gap-1.5 border-cyan-400/30 bg-cyan-400/10 text-xs text-cyan-100" disabled={!coverageDraft.targetPerson.trim() || saveCoverage.isPending} onClick={() => saveCoverage.mutate({ clientId, coverageLevel: coverageDraft.coverageLevel, targetPerson: coverageDraft.targetPerson.trim(), ourCoverer: coverageDraft.ourCoverer.trim() || null, strengthScore: parseScore(coverageDraft.strengthScore), gapJudgment: coverageDraft.gapJudgment as "P1" | "P2" | "P3", nextAction: coverageDraft.nextAction.trim() || null })}><Plus className="h-3.5 w-3.5" />添加覆盖事实</Button></div></div>
  </section>;
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
  const { data: meddpicc } = trpc.meddpicc.get.useQuery({ clientId }, { enabled: Number.isFinite(clientId) });
  const { data: readiness, isLoading: readinessLoading } = trpc.opportunities.customerReadiness.useQuery({ clientId }, { enabled: Number.isFinite(clientId) });
  const { data: customTasks = [] } = trpc.pod.listByClient.useQuery({ clientId }, { enabled: Number.isFinite(clientId) });
  const { data: products = [] } = trpc.products.listActive.useQuery();
  const { data: emailUser } = trpc.emailAuth.me.useQuery();

  // Command 3.0: AI Coach self-check
  const [showCoachSelfCheck, setShowCoachSelfCheck] = useState(false);
  const [coachQuestions, setCoachQuestions] = useState<string | null>(null);
  const samSelfCheck = trpc.adCommand.samSelfCheck.useMutation({
    onSuccess: (result: any) => setCoachQuestions(result.content),
    onError: () => { toast.error("AI 自检生成失败"); setCoachQuestions(null); },
  });
  const handleCoachSelfCheck = () => {
    setShowCoachSelfCheck(true);
    setCoachQuestions(null);
    samSelfCheck.mutate({ clientId });
  };

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
            <div className="flex flex-col items-end gap-3"><div className="flex gap-2"><PreVisitInsightButton client={client} /><Button variant="outline" size="sm" className="text-purple-300 border-purple-500/30 hover:bg-purple-500/10" onClick={handleCoachSelfCheck}><Sparkles className="h-3.5 w-3.5 mr-1" />AI 自检</Button></div><div className="grid grid-cols-3 gap-2 sm:min-w-[330px]"><div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-3 py-2.5 text-center"><div className="text-lg font-semibold text-cyan-200">{contacts.length}</div><div className="text-[10px] text-slate-500">关键人</div></div><div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-3 py-2.5 text-center"><div className="text-lg font-semibold text-amber-200">{activeOpportunities.length}</div><div className="text-[10px] text-slate-500">在打商机</div></div><div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-3 py-2.5 text-center"><div className="text-lg font-semibold text-emerald-200">{meetings.length}</div><div className="text-[10px] text-slate-500">入库对话</div></div></div></div>
          </div>{/* AI Coach Self-Check */}{showCoachSelfCheck && <div className="mt-4 rounded-xl border border-purple-500/30 bg-purple-950/20 p-4"><div className="flex items-center justify-between mb-3"><span className="text-sm font-medium text-purple-300 flex items-center gap-1.5"><Sparkles className="h-4 w-4" /> AI 自检问题</span><button onClick={() => setShowCoachSelfCheck(false)} className="text-muted-foreground hover:text-foreground text-sm">&times;</button></div>{coachQuestions ? <div className="space-y-2 text-sm text-slate-300"><ReactMarkdown>{coachQuestions}</ReactMarkdown></div> : <div className="text-xs text-muted-foreground">生成中...</div>}</div>}
          <ProductCoverageBar clientId={clientId} />
        </header>

        {client.stage !== "进入商机" && <AccountMapPanel clientId={clientId} />}
        <StageTaskCenter readiness={readiness} customTasks={customClientTasks} taskSubmitting={addTask.isPending} onAddTask={(title, description) => addTask.mutate({ clientId, assignedRole: "SAM", title, description: description || undefined })} onToggleTask={(task) => updateTask.mutate({ id: task.id, taskStatus: task.isCompleted || task.taskStatus === "done" ? "pending" : "done" })} />
        {client.stage === "进入商机" && <ClientActionDesk client={client} clientId={clientId} meddpicc={meddpicc} signals={signals as any[]} />}

        <OpportunityApplicationPanel readiness={readiness} client={client} products={products as any[]} submitting={applyForOpportunity.isPending} onSubmit={(payload) => applyForOpportunity.mutate({ clientId, ...payload })} />
        <ExecutiveOpportunityPanel client={client} contacts={contacts as any[]} meetings={meetings as any[]} isAd={emailUser?.podRole === "AD" || emailUser?.role === "admin"} submitting={applyForOpportunity.isPending} onSubmit={(payload) => applyForOpportunity.mutate({ clientId, ...payload })} />

        {client.stage !== "进入商机" && <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(340px,0.85fr)]">
          <PurchaseSignalWorkbench readiness={readiness} clientId={clientId} contacts={contacts as any[]} />
          <CustomerDiscoverySpin readiness={readiness} />
        </div>}
        {client.stage !== "进入商机" && <ClientRelationshipReview clientId={clientId} stage={client.stage} contacts={contacts as any[]} meetings={meetings as any[]} signals={signals as any[]} />}
        <ExternalSignalWorkbench client={client} clientId={clientId} opportunities={opportunities as any[]} signals={signals as any[]} />

        <section className="rounded-2xl border border-slate-700/70 bg-slate-950/55 p-4 shadow-[0_12px_35px_rgba(0,0,0,0.12)] lg:p-5"><div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2 text-sm font-semibold text-slate-100"><Crosshair className="h-4 w-4 text-amber-300" />{client.stage === "进入商机" ? "在打商机" : "机会假设与商机门控"}</div><p className="mt-1 text-xs text-slate-500">{client.stage === "进入商机" ? "客户级只看商机摘要；所有交易方法论、证据与行动均进入独立作战室。" : "当阶段门控满足后，SAM 或 AD 才能申请开商机；系统不会把主观兴趣视为证据。"}</p></div><span className="text-xs text-slate-500">{opportunities.length} 条商机</span></div><div className="space-y-3">{opportunities.length === 0 ? <div className="rounded-xl border border-dashed border-slate-700 px-5 py-8 text-center text-sm text-slate-500">暂无已开商机。请先完成当前阶段的客观证据与标准动作。</div> : opportunities.map((opportunity: any) => { const score = calculateOpportunityHealth(opportunityMeddpicc.find((item: any) => item.opportunityId === opportunity.id)); return <article key={opportunity.id} className="group rounded-xl border border-slate-700/60 bg-slate-900/35 p-4 transition-colors hover:border-cyan-400/35 hover:bg-slate-900/60"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-slate-100">{opportunity.name}</h3><span className="rounded border border-cyan-300/20 bg-cyan-400/10 px-1.5 py-0.5 text-[10px] text-cyan-200">{opportunity.stage || "阶段待定义"}</span><OpportunityHealthBadge score={score} /></div><div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">{opportunity.estimatedValue && <span>金额：<strong className="font-medium text-slate-300">{opportunity.estimatedValue}</strong></span>}{opportunity.productName && <span>产品：<strong className="font-medium text-slate-300">{opportunity.productName}</strong></span>}{opportunity.competitorName && <span>竞品：<strong className="font-medium text-amber-200">{opportunity.competitorName}</strong></span>}</div></div><Button size="sm" className="h-8 shrink-0 gap-1.5 bg-cyan-500/15 text-xs text-cyan-100 hover:bg-cyan-400/25" variant="outline" onClick={() => setLocation(`/clients/${clientId}/opportunities/${opportunity.id}`)}>进入作战室 <ArrowUpRight className="h-3.5 w-3.5" /></Button></div></article>; })}</div></section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.95fr)]">
          <section className="rounded-2xl border border-slate-700/70 bg-slate-950/55 p-4 shadow-[0_12px_35px_rgba(0,0,0,0.12)] lg:p-5"><div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-100"><UsersRound className="h-4 w-4 text-cyan-300" />组织与 Buying Group</div><p className="mb-4 text-xs text-slate-500">客户级维护组织关系和角色覆盖；商机页只引用与该交易相关的子集。</p><KeyContactsPanel clientId={clientId} clientName={client.name} /></section>
          <section className="rounded-2xl border border-slate-700/70 bg-slate-950/55 p-4 shadow-[0_12px_35px_rgba(0,0,0,0.12)] lg:p-5"><div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-100"><CalendarClock className="h-4 w-4 text-violet-300" />客户事实时间线</div><div className="space-y-3">{latestEvents.length === 0 ? <p className="rounded-lg border border-dashed border-slate-700 px-3 py-6 text-center text-xs text-slate-500">暂无拜访或情报事实。录入后，AI 才能识别趋势与门控缺口。</p> : latestEvents.map((event: any) => <div key={event.id} className="border-l border-slate-700 pl-3"><div className="mb-1 flex items-center gap-2"><span className={cn("rounded px-1.5 py-0.5 text-[10px]", event.type === "拜访" ? "bg-violet-400/10 text-violet-200" : "bg-amber-400/10 text-amber-200")}>{event.type}</span><span className="text-[10px] text-slate-500">{formatDate(event.date)}</span></div><div className="text-xs font-medium text-slate-300">{event.title}</div><p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">{event.detail}</p></div>)}</div></section>
        </div>
      </div>
    </main>
  );
}
