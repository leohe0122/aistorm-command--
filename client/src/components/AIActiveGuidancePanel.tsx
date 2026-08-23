import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, Loader2, MessageSquareText, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { classifyExplicitOpportunityFact, type MeddpiccDimCode } from "@shared/aiAnswerFacts";

type Guidance = {
  dataSufficiency: "sufficient" | "partial" | "insufficient";
  factSummary: string;
  primaryQuestion: string;
  whyThisQuestion: string;
  answerFocus: string;
  doNotAssume: string[];
};
type Candidate = {
  message: string; candidateTarget: "purchase_signal" | "meddpicc" | "none";
  signalType: "intent_subject" | "decision_chain" | "trigger_event" | ""; meddpiccDim: "M" | "E" | "D1" | "D2" | "P" | "I" | "C1" | "C2" | "";
  subjectName: string; evidence: string; suggestedScore: 0 | 25 | 50 | 75 | 100; confidence: "high" | "medium" | "low"; topicStatus: "continue" | "exhausted";
};
type PendingCandidate = Candidate & { id: string };
type GuidanceTurn = { question: string; answer: string };
const MEDDPICC_FIELDS: Record<Exclude<Candidate["meddpiccDim"], "">, { score: string; notes: string }> = {
  M: { score: "metricsScore", notes: "metricsNotes" }, E: { score: "economicBuyerScore", notes: "economicBuyerNotes" }, D1: { score: "decisionCriteriaScore", notes: "decisionCriteriaNotes" }, D2: { score: "decisionProcessScore", notes: "decisionProcessNotes" }, P: { score: "paperProcessScore", notes: "paperProcessNotes" }, I: { score: "implicatePainScore", notes: "implicatePainNotes" }, C1: { score: "championScore", notes: "championNotes" }, C2: { score: "competitionScore", notes: "competitionNotes" },
};
function classifyClientOpportunityAnswer(answer: string): { dim: MeddpiccDimCode; nextQuestion: string } | null {
  return classifyExplicitOpportunityFact(answer, ["M", "E", "D1", "D2", "P", "I", "C1", "C2"]);
}

function buildClientBaselineGuidance(scope: "customer" | "opportunity", powerContactNames: string[] = []): Guidance {
  const target = powerContactNames.length ? powerContactNames.join("、") : scope === "customer" ? "最能影响这家客户走向的高层" : "最能影响这笔商机走向的关键人";
  const namedTarget = powerContactNames.length > 0;
  return {
    dataSufficiency: "insufficient",
    factSummary: "数据不足，暂不判断。",
    primaryQuestion: namedTarget
      ? `关于${target}：你最近一次接触、转述或会议里，谁对当前方案、推进方向或关键分歧表达过最明确的态度？请复述该人的原话或明确动作。`
      : `请回想你与${target}最近一次沟通：他/她对当前方案、推进方向或关键分歧的真实反应是什么？请描述原话或明确动作。`,
    whyThisQuestion: "关键高层的实际立场还没有形成可回溯事实；先补齐你已知的原话或反应，才能判断这项关系是否支持推进。",
    answerFocus: "decision_chain",
    doNotAssume: ["不能假定谁拥有最终决定权", "不能假定客户高层已经支持当前方向"],
  };
}

function buildClientNoWriteCandidate(question: string): Candidate {
  return {
    message: "数据不足，暂不判断。本次回答未形成可确认、可写入的客户事实。",
    candidateTarget: "none",
    signalType: "",
    meddpiccDim: "",
    subjectName: "",
    evidence: "",
    suggestedScore: 0,
    confidence: "low",
    topicStatus: "continue",
  };
}

function buildClientProvisionalCandidate(scope: "customer" | "opportunity", question: string, answer: string): Candidate {
  const mentionedPeople = (question.match(/关于([^：:]+)[：:]/)?.[1] || "")
    .split(/[、，,]/)
    .map(name => name.trim())
    .filter(Boolean);
  const subjectName = mentionedPeople.find(name => answer.includes(name)) || mentionedPeople[0] || "待确认关键人";
  const decisionEvidence = /(最终签字|最终审批|最终决定|决策人|签字审批|决定权|支持|反对|认同|不同意|不重要|答应)/i.test(answer);
  const processEvidence = /(采购阶段|采购流程|审批流程|poc|测试结束|技术验证|合同流程|时间节点)/i.test(answer);
  const explicitOpportunityFact = scope === "opportunity" ? classifyClientOpportunityAnswer(answer) : null;
  return {
    message: explicitOpportunityFact ? "已识别到一条明确的商机事实，请核对后决定是否写入。" : "已从你的回答中保留一条低置信待确认事实；请核对后再决定是否写入。",
    candidateTarget: scope === "opportunity" ? "meddpicc" : "purchase_signal",
    signalType: scope === "customer" ? "decision_chain" : "",
    meddpiccDim: scope === "opportunity" ? (explicitOpportunityFact?.dim || (decisionEvidence ? "E" : processEvidence ? "D2" : "E")) : "",
    subjectName,
    evidence: `SAM 待确认原文：${answer.trim().slice(0, 800)}`,
    suggestedScore: scope === "opportunity" ? 50 : 0,
    confidence: explicitOpportunityFact ? "medium" : "low",
    topicStatus: "continue",
  };
}

export function AIActiveGuidancePanel({ scope, clientId, opportunityId, powerContactNames = [], stageTarget, className }: { scope: "customer" | "opportunity"; clientId: number; opportunityId?: number; powerContactNames?: string[]; stageTarget?: string; className?: string }) {
  const utils = trpc.useUtils();
  const contactsQuery = trpc.contacts.listByClient.useQuery({ clientId });
  const [guide, setGuide] = useState<Guidance | null>(null);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [pendingCandidates, setPendingCandidates] = useState<PendingCandidate[]>([]);
  const [guidanceHistory, setGuidanceHistory] = useState<GuidanceTurn[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [requestTimedOut, setRequestTimedOut] = useState(false);
  const customerGuideMutation = trpc.aiGuidance.customerGuide.useMutation();
  const opportunityGuideMutation = trpc.aiGuidance.opportunityGuide.useMutation();
  const interpretMutation = trpc.aiGuidance.interpretAnswer.useMutation();
  const createSignal = trpc.purchaseSignals.create.useMutation();
  const updateMeddpicc = trpc.opportunities.upsertMeddpicc.useMutation();
  const pendingGuide = customerGuideMutation.isPending || opportunityGuideMutation.isPending;
  useEffect(() => {
    if (!pendingGuide) return;
    const timeout = window.setTimeout(() => {
      if (scope === "opportunity") {
        setRequestTimedOut(true);
        customerGuideMutation.reset();
        opportunityGuideMutation.reset();
        toast.error("完整商机诊断未在预期时间内返回；本次未生成替代问题，也未写入任何事实。");
        return;
      }
      const baseline = buildClientBaselineGuidance(scope, powerContactNames);
      setGuide(current => current ?? baseline);
      setMessages(current => current.length ? current : [{ role: "assistant", content: `**当前判断**\n数据不足，暂不判断。\n\n**我现在只想确认一件事：** ${baseline.primaryQuestion}` }]);
      setRequestTimedOut(false);
      customerGuideMutation.reset();
      opportunityGuideMutation.reset();
      toast.info("已切换为基础引导：不会写入任何事实，请如实补充客户原话或动作。");
    }, 20_000);
    return () => window.clearTimeout(timeout);
  }, [pendingGuide, customerGuideMutation, opportunityGuideMutation, powerContactNames, scope]);

  const requestGuidance = (history: GuidanceTurn[], leadMessage = "", resetConversation = false) => {
    setRequestTimedOut(false);
    const onSuccess = (data: Guidance) => {
      setRequestTimedOut(false);
      setGuide(data);
      const currentJudgement = data.dataSufficiency === "sufficient" ? "已有事实足以明确当前最该补证的方向。" : data.dataSufficiency === "partial" ? "已有部分事实，但关键处仍需用客户事实核实。" : "数据不足，暂不判断。";
      const content = `${leadMessage ? `${leadMessage}\n\n` : ""}**当前判断**\n${currentJudgement}\n\n**${resetConversation ? "我现在只想确认一件事" : "下一步我想确认"}：** ${data.primaryQuestion}`;
      setMessages(current => resetConversation ? [{ role: "assistant", content }] : current.concat({ role: "assistant", content }));
    };
    const onError = (error: { message: string }) => {
      setRequestTimedOut(false);
      if (scope === "customer" && !guide) {
        const baseline = buildClientBaselineGuidance(scope, powerContactNames);
        setGuide(baseline);
        setMessages([{ role: "assistant", content: `**当前判断**\n数据不足，暂不判断。\n\n**我现在只想确认一件事：** ${baseline.primaryQuestion}` }]);
        toast.info("AI 服务暂不可用，已切换为基础引导；不会写入任何事实。");
        return;
      }
      if (leadMessage) setMessages(current => current.concat({ role: "assistant", content: `${leadMessage}\n\n下一问生成失败，本次未写入任何事实。请点击“更新 AI 问题”重试。` }));
      toast.error(`完整诊断暂不可用：${error.message}`);
    };
    if (scope === "customer") customerGuideMutation.mutate({ clientId }, { onSuccess, onError });
    else if (opportunityId) opportunityGuideMutation.mutate({ clientId, opportunityId, stageTarget: stageTarget as any, history }, { onSuccess, onError });
  };

  const startGuide = () => {
    const initial = !guide;
    setCandidate(null);
    if (initial) {
      setPendingCandidates([]);
      setGuidanceHistory([]);
      setMessages([]);
    }
    requestGuidance(initial ? [] : guidanceHistory, "", initial);
  };

  const sendAnswer = (answer: string) => {
    if (!guide) return;
    const currentQuestion = guide.primaryQuestion;
    const nextHistory = guidanceHistory.concat({ question: currentQuestion, answer }).slice(-10);
    setMessages(current => current.concat({ role: "user", content: answer }));
    interpretMutation.mutate({ scope, clientId, opportunityId, question: currentQuestion, answer, history: guidanceHistory, stageTarget: stageTarget as any }, {
      onSuccess: (data: Candidate) => {
        setCandidate(data);
        setGuidanceHistory(nextHistory);
        if (data.candidateTarget !== "none") {
          setPendingCandidates(current => current.concat({ ...data, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` }));
        }
        requestGuidance(nextHistory, data.message);
      },
      onError: () => {
        const fallback = scope === "opportunity" ? buildClientProvisionalCandidate(scope, currentQuestion, answer) : buildClientNoWriteCandidate(currentQuestion);
        setCandidate(fallback);
        setGuidanceHistory(nextHistory);
        if (fallback.candidateTarget !== "none") {
          setPendingCandidates(current => current.concat({ ...fallback, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` }));
        }
        requestGuidance(nextHistory, fallback.message);
        toast.info("回答已作为未确认临时上下文保留；系统未写入任何事实。 ");
      },
    });
  };
  const removePendingCandidate = (id: string) => setPendingCandidates(current => current.filter(item => item.id !== id));
  const confirmCandidate = (pendingCandidate: PendingCandidate) => {
    if (pendingCandidate.candidateTarget === "none") return;
    if (pendingCandidate.candidateTarget === "purchase_signal") {
      if (!pendingCandidate.signalType || !pendingCandidate.subjectName || !pendingCandidate.evidence) return toast.error("AI 未识别到可确认的客户事实，请继续补充。" );
      let effectiveSignalType = pendingCandidate.signalType;
      let subjectContactId: number | null = null;
      if (effectiveSignalType === "decision_chain") {
        const matchedContact = (contactsQuery.data || []).find((c: any) => pendingCandidate.subjectName && c.name?.includes(pendingCandidate.subjectName.split(/[·\s]/)[0]));
        if (matchedContact) {
          subjectContactId = matchedContact.id;
        } else {
          effectiveSignalType = "intent_subject";
        }
      }
      createSignal.mutate({ clientId, signalType: effectiveSignalType, subjectName: pendingCandidate.subjectName, subjectContactId, occurredAt: new Date().toISOString(), statement: pendingCandidate.evidence, sourceType: "other_evidence", sourceReference: "AI 主动引导问答，经 SAM 确认" }, {
        onSuccess: () => { toast.success("已确认并写入客户购买事实"); removePendingCandidate(pendingCandidate.id); utils.purchaseSignals.listByClient.invalidate({ clientId }); utils.opportunities.customerReadiness.invalidate({ clientId }); },
        onError: error => toast.error(`写入事实失败：${error.message}`),
      });
      return;
    }
    if (!opportunityId || !pendingCandidate.meddpiccDim || !pendingCandidate.evidence) return toast.error("当前回答不足以写入商机事实，请继续补充。" );
    const field = MEDDPICC_FIELDS[pendingCandidate.meddpiccDim];
    updateMeddpicc.mutate({ opportunityId, clientId, [field.score]: pendingCandidate.suggestedScore / 25, [field.notes]: `[AI 主动引导问答 · 经 SAM 确认] ${pendingCandidate.evidence}` } as any, {
      onSuccess: () => {
        toast.success("已确认并写入商机证据");
        removePendingCandidate(pendingCandidate.id);
        utils.opportunities.getMeddpicc.invalidate({ opportunityId });
        utils.command2.getDealMap.invalidate({ clientId, opportunityId });
        utils.opportunities.getStageGuidance.invalidate({ clientId, opportunityId });
      },
      onError: error => toast.error(`写入商机证据失败：${error.message}`),
    });
  };
  const working = pendingGuide || interpretMutation.isPending;
  const targetLabel = scope === "customer" ? "客户事实" : "商机证据";
  return <section data-ai-active-guidance className={`rounded-2xl border border-fuchsia-400/25 bg-gradient-to-br from-fuchsia-400/[0.07] via-slate-950/70 to-slate-950/85 p-4 shadow-[0_14px_40px_rgba(192,132,252,0.08)] ${className || ""}`}>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-fuchsia-400/15 text-fuchsia-100"><Sparkles className="h-4.5 w-4.5" /></span><div><h2 className="text-sm font-semibold text-fuchsia-50">AI 主动引导</h2><p className="mt-1 text-xs leading-5 text-fuchsia-100/55">AI 先读已入库事实，再一次只问一个最该验证的问题；SAM 只需如实回答。</p>{scope === "opportunity" && stageTarget && <p className="mt-1 text-[11px] text-amber-100/80">当前优先：补齐进入「{stageTarget}」所需的阶段证据；完成后才按 Win 因子排序。</p>}</div></div><Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 border-fuchsia-400/30 bg-fuchsia-400/10 text-xs text-fuchsia-100 hover:bg-fuchsia-400/20" onClick={startGuide} disabled={working}>{pendingGuide ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}{guide ? "更新 AI 问题" : "让 AI 开始引导"}</Button></div>
    {!guide ? <div className="mt-4 rounded-xl border border-dashed border-fuchsia-400/20 bg-slate-950/35 p-4 text-xs leading-5 text-slate-400">{requestTimedOut ? <><p>AI 引导未在预期时间内返回，尚未写入任何事实。</p><Button type="button" size="sm" variant="outline" className="mt-3 h-8 text-xs" onClick={startGuide}>重新尝试</Button></> : "不需要先填写方法论表格。点击“让 AI 开始引导”，系统会基于已经存在的拜访、关键人、购买信号和商机事实，提出当前最有价值的问题。"}</div> : <>
      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]"><AIChatBox messages={messages} onSendMessage={sendAnswer} isLoading={working} height="330px" placeholder="用自然语言描述客户说过什么、做过什么，或你还不知道什么…" emptyStateMessage="AI 正在准备第一个问题" /><aside className="space-y-3 rounded-xl border border-slate-700/70 bg-slate-950/50 p-3"><div><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fuchsia-200/70">当前状态</div><p className="mt-1 text-xs leading-5 text-slate-300">{guide.dataSufficiency === "sufficient" ? "现有事实支持当前问题。" : guide.dataSufficiency === "partial" ? "已有部分事实，仍需用客户原话核实。" : "数据不足，暂不判断。"}</p></div><div><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fuchsia-200/70">暂不假定</div>{guide.doNotAssume.length ? <ul className="mt-1 space-y-1 text-[11px] leading-4 text-slate-400">{guide.doNotAssume.slice(0, 2).map((item, index) => <li key={index}>• {item}</li>)}</ul> : <p className="mt-1 text-[11px] text-slate-500">无</p>}</div><div><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fuchsia-200/70">回答提示</div><p className="mt-1 text-[11px] leading-4 text-amber-100/80">请优先补充本次问题所涉及的客户原话、动作或时间安排。</p></div><details className="rounded-lg border border-slate-700/60 bg-slate-950/35 px-2.5 py-2"><summary className="cursor-pointer text-[11px] font-medium text-fuchsia-100/80">查看 AI 依据</summary><p className="mt-2 text-[11px] leading-5 text-slate-400">{guide.factSummary}</p><p className="mt-1 text-[10px] leading-4 text-slate-500">为什么现在问：{guide.whyThisQuestion}</p></details></aside></div>
      {candidate?.candidateTarget === "none" && <div className="mt-3 rounded-xl border border-slate-700/70 bg-slate-950/45 p-3"><div className="flex items-start gap-3"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" /><div><div className="text-xs font-semibold text-slate-100">{candidate.topicStatus === "exhausted" ? "当前主题已收束" : "暂未形成待确认事实"}</div><p className="mt-1 text-xs leading-5 text-slate-300">{candidate.message}</p><p className="mt-1 text-[11px] text-slate-500">本次不会写入系统。AI 已切换到不同的事实方向。</p></div></div></div>}
      {pendingCandidates.length > 0 && <div className="mt-3 space-y-3">{pendingCandidates.map(pendingCandidate => <div key={pendingCandidate.id} className="rounded-xl border border-cyan-400/25 bg-cyan-400/[0.055] p-3"><div className="flex items-start gap-3"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" /><div className="min-w-0 flex-1"><div className="text-xs font-semibold text-cyan-100">AI 识别到一条待确认的{targetLabel}</div><p className="mt-1 text-xs leading-5 text-slate-300">{pendingCandidate.evidence}</p><p className="mt-1 text-[10px] text-slate-500">置信度：{pendingCandidate.confidence === "high" ? "高（回答中有明确事实）" : pendingCandidate.confidence === "medium" ? "中（建议继续核对）" : "低（不建议写入）"}</p></div></div><div className="mt-3 flex justify-end gap-2"><Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => removePendingCandidate(pendingCandidate.id)}>暂不写入</Button><Button type="button" size="sm" className="h-8 gap-1 text-xs" onClick={() => confirmCandidate(pendingCandidate)} disabled={createSignal.isPending || updateMeddpicc.isPending}><CheckCircle2 className="h-3.5 w-3.5" />确认写入事实</Button></div></div>)}</div>}
    </>}
  </section>;
}
