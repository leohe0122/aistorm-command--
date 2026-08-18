import { useMemo, useState } from "react";
import { AlertTriangle, Link2, Loader2, Radio, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const urgencyTone: Record<string, string> = { 高: "border-rose-400/25 bg-rose-400/[0.08] text-rose-200", 中: "border-amber-400/25 bg-amber-400/[0.08] text-amber-200", 低: "border-slate-600 bg-slate-800/50 text-slate-300" };

export default function ExternalSignalWorkbench({ client, clientId, opportunities, signals }: { client: any; clientId: number; opportunities: any[]; signals: any[] }) {
  const utils = trpc.useUtils();
  const [rawSignal, setRawSignal] = useState("");
  const [opportunityId, setOpportunityId] = useState<number | null>(null);
  const [latestResult, setLatestResult] = useState<any>(null);
  const recentSignals = useMemo(() => [...signals].sort((a: any, b: any) => new Date(b.createdAt || b.publishedAt || 0).getTime() - new Date(a.createdAt || a.publishedAt || 0).getTime()).slice(0, 4), [signals]);
  const analyze = trpc.intelligence.analyze.useMutation({
    onSuccess: result => {
      setLatestResult(result);
      setRawSignal("");
      utils.intelligence.listByClient.invalidate({ clientId });
      toast.success("外部事件已解读并归档为客户情报信号");
    },
    onError: error => toast.error(`外部事件解读失败：${error.message}`),
  });
  const submit = () => {
    if (!rawSignal.trim()) { toast.error("请填写外部事件原文或可靠来源摘要"); return; }
    analyze.mutate({ clientId, clientName: client.name, rawSignal: rawSignal.trim(), industry: client.industry || undefined, opportunityId: opportunityId || undefined });
  };
  return <section className="overflow-hidden rounded-2xl border border-amber-400/20 bg-gradient-to-br from-amber-400/[0.06] via-slate-950/70 to-slate-950/85 shadow-[0_12px_35px_rgba(0,0,0,0.12)]">
    <div className="flex flex-col gap-2 border-b border-amber-400/15 px-5 py-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-200"><Radio className="h-4.5 w-4.5" /></span><div><h2 className="text-sm font-semibold text-amber-50">外部事件信号</h2><p className="mt-1 text-[11px] leading-5 text-amber-100/55">将可追溯的新闻、政策、招聘、组织或技术事件归档并交由 AI 解读；系统不会将外部事件自动认定为客户购买意图。</p></div></div><span className="w-fit rounded-full border border-amber-400/20 bg-amber-400/[0.08] px-2 py-1 text-[10px] text-amber-100">客户级情报资产</span></div>
    <div className="grid gap-px bg-amber-400/10 xl:grid-cols-[0.9fr_1.1fr]"><div className="space-y-3 bg-slate-950/60 p-4"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-100">录入可核验的外部事件</span>{opportunities.length > 0 && <select value={opportunityId ?? ""} onChange={event => setOpportunityId(event.target.value ? Number(event.target.value) : null)} className="h-7 max-w-[52%] rounded border border-slate-700 bg-slate-900 px-2 text-[10px] text-slate-200"><option value="">不关联商机</option>{opportunities.map(opportunity => <option key={opportunity.id} value={opportunity.id}>{opportunity.name}</option>)}</select>}</div><Textarea value={rawSignal} onChange={event => setRawSignal(event.target.value)} placeholder="粘贴新闻原文、政策链接摘要或可靠来源中的关键事件。请保留主体、时间与原始表述。" className="min-h-28 resize-none border-slate-700 bg-slate-900/65 text-xs leading-5" /><Button type="button" onClick={submit} disabled={analyze.isPending || !rawSignal.trim()} className="h-8 w-full gap-1.5 bg-amber-500/80 text-xs text-slate-950 hover:bg-amber-400">{analyze.isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />AI 解读中…</> : <><Send className="h-3.5 w-3.5" />AI 解读并归档</>}</Button>{latestResult && <div className="rounded-lg border border-amber-400/20 bg-amber-400/[0.045] p-3"><div className="mb-2 flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-amber-200" /><span className="text-[11px] font-semibold text-amber-100">AI 解读结果</span><span className={cn("ml-auto rounded border px-1.5 py-0.5 text-[10px]", urgencyTone[latestResult.urgency] || urgencyTone.低)}>紧迫度：{latestResult.urgency || "待定"}</span></div><p className="text-xs leading-5 text-slate-300">{latestResult.interpretation}</p><p className="mt-2 border-t border-amber-400/10 pt-2 text-xs leading-5 text-amber-50">下一步：{latestResult.recommendation}</p></div>}<p className="flex items-start gap-1.5 text-[10px] leading-4 text-slate-500"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-300" />若事件构成客户明确的触发事件，仍须在“购买信号”工作区以客户事实重新记录，不能由此自动放行开商机。</p></div>
      <div className="bg-slate-950/60 p-4"><div className="mb-3 flex items-center justify-between"><div><div className="text-xs font-semibold text-slate-100">已入库外部事件</div><p className="mt-1 text-[10px] text-slate-500">最近 {recentSignals.length} 条；完整客户事实可在下方时间线复查。</p></div><span className="text-[10px] text-slate-500">{signals.length} 条</span></div>{recentSignals.length === 0 ? <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-slate-700 px-4 text-center text-xs leading-5 text-slate-500">尚无外部事件信号。仅在有可靠来源时录入，避免以猜测填充客户档案。</div> : <div className="space-y-2">{recentSignals.map((signal: any) => <article key={signal.id} className="rounded-lg border border-slate-700/60 bg-slate-900/35 p-3"><div className="mb-1.5 flex items-center gap-2"><span className="rounded border border-amber-400/20 bg-amber-400/[0.08] px-1.5 py-0.5 text-[10px] text-amber-100">{signal.signalType || "外部事件"}</span><span className={cn("rounded border px-1.5 py-0.5 text-[10px]", urgencyTone[signal.urgency] || urgencyTone.低)}>{signal.urgency || "待定"}</span>{signal.opportunityId && <span className="ml-auto flex items-center gap-1 text-[10px] text-cyan-200"><Link2 className="h-3 w-3" />已关联商机</span>}</div><p className="line-clamp-2 text-xs leading-5 text-slate-300">{signal.rawSignal || signal.summary || "无原始事件内容"}</p></article>)}</div>}</div>
    </div>
  </section>;
}
