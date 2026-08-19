import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, Loader2, MessageSquareText, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

type Guidance = {
  dataSufficiency: "sufficient" | "partial" | "insufficient";
  factSummary: string;
  primaryQuestion: string;
  whyThisQuestion: string;
  answerFocus: string;
  winFactors: Array<{ factor: string; status: "supported" | "needs_evidence" | "unknown"; evidence: string }>;
  doNotAssume: string[];
};
type Candidate = {
  message: string; nextQuestion: string; candidateTarget: "purchase_signal" | "meddpicc" | "none";
  signalType: "intent_subject" | "decision_chain" | "trigger_event" | ""; meddpiccDim: "M" | "E" | "D1" | "D2" | "P" | "I" | "C1" | "C2" | "";
  subjectName: string; evidence: string; suggestedScore: 0 | 25 | 50 | 75 | 100; confidence: "high" | "medium" | "low";
};
const MEDDPICC_FIELDS: Record<Exclude<Candidate["meddpiccDim"], "">, { score: string; notes: string }> = {
  M: { score: "metricsScore", notes: "metricsNotes" }, E: { score: "economicBuyerScore", notes: "economicBuyerNotes" }, D1: { score: "decisionCriteriaScore", notes: "decisionCriteriaNotes" }, D2: { score: "decisionProcessScore", notes: "decisionProcessNotes" }, P: { score: "paperProcessScore", notes: "paperProcessNotes" }, I: { score: "implicatePainScore", notes: "implicatePainNotes" }, C1: { score: "championScore", notes: "championNotes" }, C2: { score: "competitionScore", notes: "competitionNotes" },
};

export function AIActiveGuidancePanel({ scope, clientId, opportunityId, className }: { scope: "customer" | "opportunity"; clientId: number; opportunityId?: number; className?: string }) {
  const utils = trpc.useUtils();
  const [guide, setGuide] = useState<Guidance | null>(null);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [requestTimedOut, setRequestTimedOut] = useState(false);
  const customerGuideMutation = trpc.aiGuidance.customerGuide.useMutation();
  const opportunityGuideMutation = trpc.aiGuidance.opportunityGuide.useMutation();
  const healthCheck = trpc.aiGuidance.health.useQuery(undefined, { enabled: false, retry: false });
  const interpretMutation = trpc.aiGuidance.interpretAnswer.useMutation();
  const createSignal = trpc.purchaseSignals.create.useMutation();
  const updateMeddpicc = trpc.opportunities.upsertMeddpicc.useMutation();
  const pendingGuide = customerGuideMutation.isPending || opportunityGuideMutation.isPending;
  useEffect(() => {
    if (!pendingGuide) return;
    const timeout = window.setTimeout(() => {
      setRequestTimedOut(true);
      customerGuideMutation.reset();
      opportunityGuideMutation.reset();
      toast.error("AI 引导在 20 秒内未返回。请重试；若仍失败，请刷新登录会话后再试。");
    }, 20_000);
    return () => window.clearTimeout(timeout);
  }, [pendingGuide, customerGuideMutation, opportunityGuideMutation]);
  const startGuide = async () => {
    setCandidate(null);
    setRequestTimedOut(false);
    const health = await healthCheck.refetch();
    if (health.error || health.data?.status !== "ok") {
      toast.error("AI 引导服务不可用。请刷新登录会话后重试。");
      return;
    }
    const onSuccess = (data: Guidance) => {
      setRequestTimedOut(false);
      setGuide(data);
      const currentJudgement = data.dataSufficiency === "sufficient" ? "已有事实足以明确当前最该补证的方向。" : data.dataSufficiency === "partial" ? "已有部分事实，但关键处仍需用客户事实核实。" : "数据不足，暂不判断。";
      setMessages([{ role: "assistant", content: `**当前判断**\n${currentJudgement}\n\n**我现在只想确认一件事：** ${data.primaryQuestion}` }]);
    };
    const onError = (error: { message: string }) => {
      setRequestTimedOut(false);
      toast.error(`AI 引导暂不可用：${error.message}`);
    };
    if (scope === "customer") customerGuideMutation.mutate({ clientId }, { onSuccess, onError });
    else if (opportunityId) opportunityGuideMutation.mutate({ clientId, opportunityId }, { onSuccess, onError });
  };
  const sendAnswer = (answer: string) => {
    if (!guide) return;
    setMessages(current => current.concat({ role: "user", content: answer }));
    interpretMutation.mutate({ scope, clientId, opportunityId, question: guide.primaryQuestion, answer }, {
      onSuccess: (data: Candidate) => {
        setCandidate(data);
        setGuide(current => current ? { ...current, primaryQuestion: data.nextQuestion } : current);
        setMessages(current => current.concat({ role: "assistant", content: `${data.message}\n\n**下一步我想确认：** ${data.nextQuestion}` }));
      },
      onError: error => toast.error(`AI 未能解释这条回答：${error.message}`),
    });
  };
  const confirmCandidate = () => {
    if (!candidate || candidate.candidateTarget === "none") return;
    if (candidate.candidateTarget === "purchase_signal") {
      if (!candidate.signalType || !candidate.subjectName || !candidate.evidence) return toast.error("AI 未识别到可确认的客户事实，请继续补充。" );
      createSignal.mutate({ clientId, signalType: candidate.signalType, subjectName: candidate.subjectName, occurredAt: new Date().toISOString(), statement: candidate.evidence, sourceType: "other_evidence", sourceReference: "AI 主动引导问答，经 SAM 确认" }, {
        onSuccess: () => { toast.success("已确认并写入客户购买事实"); setCandidate(null); utils.purchaseSignals.listByClient.invalidate({ clientId }); utils.opportunities.customerReadiness.invalidate({ clientId }); },
        onError: error => toast.error(`写入事实失败：${error.message}`),
      });
      return;
    }
    if (!opportunityId || !candidate.meddpiccDim || !candidate.evidence) return toast.error("当前回答不足以写入商机事实，请继续补充。" );
    const field = MEDDPICC_FIELDS[candidate.meddpiccDim];
    updateMeddpicc.mutate({ opportunityId, clientId, [field.score]: candidate.suggestedScore / 25, [field.notes]: `[AI 主动引导问答 · 经 SAM 确认] ${candidate.evidence}` } as any, {
      onSuccess: () => { toast.success("已确认并写入商机证据"); setCandidate(null); utils.opportunities.getMeddpicc.invalidate({ opportunityId }); },
      onError: error => toast.error(`写入商机证据失败：${error.message}`),
    });
  };
  const working = pendingGuide || interpretMutation.isPending || healthCheck.isFetching;
  const targetLabel = scope === "customer" ? "客户事实" : "商机证据";
  const factorSummary = useMemo(() => guide?.winFactors.filter(item => item.status !== "supported") || [], [guide]);
  return <section data-ai-active-guidance className={`rounded-2xl border border-fuchsia-400/25 bg-gradient-to-br from-fuchsia-400/[0.07] via-slate-950/70 to-slate-950/85 p-4 shadow-[0_14px_40px_rgba(192,132,252,0.08)] ${className || ""}`}>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-fuchsia-400/15 text-fuchsia-100"><Sparkles className="h-4.5 w-4.5" /></span><div><h2 className="text-sm font-semibold text-fuchsia-50">AI 主动引导</h2><p className="mt-1 text-xs leading-5 text-fuchsia-100/55">AI 先读已入库事实，再一次只问一个最该验证的问题；SAM 只需如实回答。</p></div></div><Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 border-fuchsia-400/30 bg-fuchsia-400/10 text-xs text-fuchsia-100 hover:bg-fuchsia-400/20" onClick={startGuide} disabled={working}>{pendingGuide || healthCheck.isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}{guide ? "更新 AI 问题" : "让 AI 开始引导"}</Button></div>
    {!guide ? <div className="mt-4 rounded-xl border border-dashed border-fuchsia-400/20 bg-slate-950/35 p-4 text-xs leading-5 text-slate-400">{requestTimedOut ? <><p>AI 引导未在预期时间内返回，尚未写入任何事实。</p><Button type="button" size="sm" variant="outline" className="mt-3 h-8 text-xs" onClick={startGuide}>重新尝试</Button></> : "不需要先填写方法论表格。点击“让 AI 开始引导”，系统会基于已经存在的拜访、关键人、购买信号和商机事实，提出当前最有价值的问题。"}</div> : <>
      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]"><AIChatBox messages={messages} onSendMessage={sendAnswer} isLoading={working} height="330px" placeholder="用自然语言描述客户说过什么、做过什么，或你还不知道什么…" emptyStateMessage="AI 正在准备第一个问题" /><aside className="space-y-3 rounded-xl border border-slate-700/70 bg-slate-950/50 p-3"><div><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fuchsia-200/70">当前状态</div><p className="mt-1 text-xs leading-5 text-slate-300">{guide.dataSufficiency === "sufficient" ? "现有事实支持当前问题。" : guide.dataSufficiency === "partial" ? "已有部分事实，仍需用客户原话核实。" : "数据不足，暂不判断。"}</p></div><div><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fuchsia-200/70">暂不假定</div>{guide.doNotAssume.length ? <ul className="mt-1 space-y-1 text-[11px] leading-4 text-slate-400">{guide.doNotAssume.slice(0, 3).map((item, index) => <li key={index}>• {item}</li>)}</ul> : <p className="mt-1 text-[11px] text-slate-500">无</p>}</div>{factorSummary.length > 0 && <div><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fuchsia-200/70">仍需补证</div><p className="mt-1 text-[11px] leading-4 text-amber-100/80">请优先补充本次问题所涉及的客户原话、动作或时间安排。</p></div>}<details className="rounded-lg border border-slate-700/60 bg-slate-950/35 px-2.5 py-2"><summary className="cursor-pointer text-[11px] font-medium text-fuchsia-100/80">查看 AI 依据</summary><p className="mt-2 text-[11px] leading-5 text-slate-400">{guide.factSummary}</p><p className="mt-1 text-[10px] leading-4 text-slate-500">为什么现在问：{guide.whyThisQuestion}</p></details></aside></div>
      {candidate && <div className="mt-3 rounded-xl border border-cyan-400/25 bg-cyan-400/[0.055] p-3"><div className="flex items-start gap-3"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" /><div className="min-w-0 flex-1"><div className="text-xs font-semibold text-cyan-100">AI 识别到一条待确认的{targetLabel}</div><p className="mt-1 text-xs leading-5 text-slate-300">{candidate.evidence || "数据不足，暂不判断。"}</p><p className="mt-1 text-[10px] text-slate-500">置信度：{candidate.confidence === "high" ? "高（回答中有明确事实）" : candidate.confidence === "medium" ? "中（建议继续核对）" : "低（不建议写入）"}</p></div></div>{candidate.candidateTarget !== "none" ? <div className="mt-3 flex justify-end gap-2"><Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => setCandidate(null)}>暂不写入</Button><Button type="button" size="sm" className="h-8 gap-1 text-xs" onClick={confirmCandidate} disabled={createSignal.isPending || updateMeddpicc.isPending}><CheckCircle2 className="h-3.5 w-3.5" />确认写入事实</Button></div> : <p className="mt-3 rounded-lg border border-slate-700/60 bg-slate-950/45 px-3 py-2 text-[11px] text-slate-400">本次不会写入系统。请直接回答 AI 的下一问，或保留为待验证事项。</p>}</div>}
    </>}
  </section>;
}
