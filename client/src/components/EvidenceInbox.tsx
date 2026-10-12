import { useEffect, useMemo, useState } from "react";
import { Check, Inbox, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const KINDS = [
  { value: "email", label: "邮件" },
  { value: "meeting_notes", label: "会议纪要" },
  { value: "chat", label: "聊天记录" },
  { value: "call_notes", label: "电话记录" },
  { value: "document", label: "文件内容" },
  { value: "other", label: "其他" },
] as const;
type Kind = (typeof KINDS)[number]["value"];

const TOPIC_LABELS: Record<string, string> = {
  M: "价值量化", E: "经济决策人", D1: "决策标准", D2: "决策流程", P: "采购流程", I: "痛点", C1: "Champion", C2: "竞争",
  stakeholder: "关键人", relationship: "关系", timeline: "时间", budget: "预算", trigger: "触发事件",
  why_change: "为何改变", why_now: "为何现在", why_us: "为何选我们", competitor: "竞品", technical: "技术",
};

const today = () => new Date().toISOString().slice(0, 10);

/**
 * 投喂即入库：粘贴邮件、纪要、聊天等原始素材，AI 拆成候选证据，人逐条确认后入账。
 * 确认后的证据自动参与“证据推导评分”。
 */
export function EvidenceInbox({ clientId, opportunityId }: { clientId: number; opportunityId?: number }) {
  const utils = trpc.useUtils();
  const [kind, setKind] = useState<Kind>("email");
  const [title, setTitle] = useState("");
  const [occurredAt, setOccurredAt] = useState(today());
  const [text, setText] = useState("");
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [decisions, setDecisions] = useState<Record<number, "confirm" | "reject">>({});

  const candidatesQuery = trpc.ledger.candidates.useQuery({ clientId, opportunityId });
  const statusQuery = trpc.ledger.ingestion.useQuery(
    { ingestionId: pendingId ?? 0 },
    { enabled: pendingId !== null, refetchInterval: 3000, refetchIntervalInBackground: true },
  );

  useEffect(() => {
    const status = statusQuery.data?.status;
    if (!pendingId || !status || status === "pending") return;
    if (status === "done") {
      const count = statusQuery.data?.candidateCount ?? 0;
      toast.success(count > 0 ? `AI 已提取 ${count} 条候选证据，请逐条确认` : "素材中没有找到可入账的客户事实");
    } else {
      toast.error(`提取失败：${statusQuery.data?.error || "未知错误"}。素材已保存，可稍后重新投喂。`);
    }
    setPendingId(null);
    utils.ledger.candidates.invalidate({ clientId, opportunityId });
  }, [statusQuery.data, pendingId, clientId, opportunityId, utils]);

  const ingest = trpc.ledger.ingest.useMutation({
    onSuccess: ({ ingestionId }) => {
      setPendingId(ingestionId);
      setText("");
      setTitle("");
    },
    onError: error => toast.error(error.message),
  });

  const review = trpc.ledger.review.useMutation({
    onSuccess: result => {
      const parts = [result.confirmed.length ? `确认 ${result.confirmed.length} 条` : "", result.rejected.length ? `驳回 ${result.rejected.length} 条` : ""].filter(Boolean);
      toast.success(parts.join("，") || "没有可处理的条目");
      if (result.denied.length) toast.warning(`${result.denied.length} 条无权确认，已保留给录入人或 AD 处理`);
      setDecisions({});
      utils.ledger.candidates.invalidate({ clientId, opportunityId });
      utils.ledger.forTarget.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const candidates = candidatesQuery.data ?? [];
  const decided = useMemo(() => Object.entries(decisions), [decisions]);
  const toggle = (id: number, value: "confirm" | "reject") => setDecisions(current => {
    const next = { ...current };
    if (next[id] === value) delete next[id];
    else next[id] = value;
    return next;
  });
  const setAll = (value: "confirm" | "reject") => setDecisions(Object.fromEntries(candidates.filter(item => item.canConfirm).map(item => [item.id, value])));

  return (
    <section className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-4">
      <div className="mb-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-100"><Inbox className="h-4 w-4 text-cyan-300" />投喂素材</h3>
        <p className="mt-1 text-[11px] leading-4 text-slate-500">粘贴客户邮件、会议纪要、聊天记录或电话要点，AI 拆成一条条带原文出处的证据，确认后自动参与评分。无需填写任何表格。</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)_150px]">
        <select value={kind} onChange={event => setKind(event.target.value as Kind)} className="h-8 rounded border border-input bg-slate-900/60 px-2 text-xs text-slate-200" aria-label="素材类型">
          {KINDS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <Input value={title} onChange={event => setTitle(event.target.value)} placeholder="标题（可选），如：回复：POC 安排" className="h-8 bg-slate-900/60 text-xs" maxLength={200} />
        <Input type="date" value={occurredAt} onChange={event => setOccurredAt(event.target.value)} className="h-8 bg-slate-900/60 text-xs" aria-label="素材日期" />
      </div>
      <Textarea
        value={text}
        onChange={event => setText(event.target.value)}
        placeholder="在这里粘贴原文，保留客户的原话最有价值……"
        className="mt-2 min-h-[120px] bg-slate-900/60 text-xs"
        maxLength={20000}
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[10px] text-slate-500">{text.length}/20000</span>
        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs"
          disabled={text.trim().length < 20 || ingest.isPending || pendingId !== null}
          onClick={() => ingest.mutate({ clientId, opportunityId, kind, title: title.trim() || undefined, occurredAt, text })}
        >
          {pendingId !== null || ingest.isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />AI 提取中…</> : "提取证据"}
        </Button>
      </div>

      {candidates.length > 0 ? (
        <div className="mt-4 border-t border-slate-800 pt-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-amber-200">待确认 {candidates.length} 条</p>
            <div className="flex gap-1.5">
              <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setAll("confirm")}>全部确认</Button>
              <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setAll("reject")}>全部驳回</Button>
            </div>
          </div>
          <ul className="space-y-1.5">
            {candidates.map(item => {
              const decision = decisions[item.id];
              return (
                <li key={item.id} className={cn("rounded-lg border px-3 py-2", decision === "confirm" ? "border-emerald-400/40 bg-emerald-400/[0.06]" : decision === "reject" ? "border-rose-400/30 bg-rose-400/[0.04] opacity-70" : "border-slate-800 bg-slate-900/40")}>
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-xs text-slate-100", item.polarity === "negative" && "text-rose-100")}>{item.claim}</p>
                      <p className="mt-0.5 text-[11px] italic text-slate-400">“{item.quote}”</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {item.subjectName ? <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">{item.subjectName}</span> : null}
                        {item.topics.map(topic => <span key={topic} className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400">{TOPIC_LABELS[topic] ?? topic}</span>)}
                        {item.suggestedScore !== null ? <span className="text-[10px] text-cyan-300">建议 {item.suggestedScore}</span> : null}
                        <span className="text-[10px] text-slate-600">{item.sourceTitle || KINDS.find(kindItem => kindItem.value === item.sourceKind)?.label} · {item.submittedBy}</span>
                      </div>
                    </div>
                    {item.canConfirm ? (
                      <div className="flex shrink-0 gap-1">
                        <button type="button" aria-label="确认" onClick={() => toggle(item.id, "confirm")} className={cn("rounded border p-1", decision === "confirm" ? "border-emerald-400 bg-emerald-400/20 text-emerald-200" : "border-slate-700 text-slate-500 hover:text-emerald-200")}><Check className="h-3.5 w-3.5" /></button>
                        <button type="button" aria-label="驳回" onClick={() => toggle(item.id, "reject")} className={cn("rounded border p-1", decision === "reject" ? "border-rose-400 bg-rose-400/20 text-rose-200" : "border-slate-700 text-slate-500 hover:text-rose-200")}><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ) : <span className="shrink-0 text-[10px] text-slate-600">待录入人或 AD 确认</span>}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 flex justify-end">
            <Button
              size="sm"
              className="h-8 text-xs"
              disabled={decided.length === 0 || review.isPending}
              onClick={() => review.mutate({
                clientId,
                confirmIds: decided.filter(([, value]) => value === "confirm").map(([id]) => Number(id)),
                rejectIds: decided.filter(([, value]) => value === "reject").map(([id]) => Number(id)),
              })}
            >
              {review.isPending ? "提交中…" : `提交（${decided.length} 条）`}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
