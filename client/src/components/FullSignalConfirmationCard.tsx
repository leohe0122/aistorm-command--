import { useEffect, useState } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type FullSignals = {
  meetingSummary: string;
  meddpiccUpdates: Array<{ dim: string; suggestedScore: number; evidence: string; confidence: string }>;
  contactDiscoveries: Array<{ name: string; title: string | null; buyingRole: string; attitude: string; evidence: string }>;
  competitorMentions: Array<{ competitorName: string; context: string; threatLevel: string }>;
  timeSignals: Array<{ type: string; description: string; date: string | null }>;
  threeWhyUpdates: { whyChange: string | null; whyNow: string | null; whyUs: string | null };
  winFactorAlerts: Array<{ factor: string; alert: string; severity: string }>;
  nextBestAction: string;
};

type Props = {
  clientId: number;
  meetingId: number;
  signals: FullSignals;
  opportunities: any[];
  initialConfirmed?: string[];
  onDone?: (keys: string[]) => void;
};

export default function FullSignalConfirmationCard({ clientId, meetingId, signals, opportunities, initialConfirmed = [], onDone }: Props) {
  const [opportunityId, setOpportunityId] = useState("__client_only__");
  const [confirmed, setConfirmed] = useState<Set<string>>(() => new Set(initialConfirmed));
  const hasOpportunity = opportunityId !== "__client_only__";
  const candidates = [
    ...signals.meddpiccUpdates.map(item => `meddpicc:${item.dim}`),
    ...signals.contactDiscoveries.map((_, index) => `contact:${index}`),
    ...signals.timeSignals.map((_, index) => `time:${index}`),
    ...(hasOpportunity ? signals.competitorMentions.map((_, index) => `competitor:${index}`) : []),
    ...(hasOpportunity && signals.threeWhyUpdates.whyChange ? ["threewhy:change"] : []),
    ...(hasOpportunity && signals.threeWhyUpdates.whyNow ? ["threewhy:now"] : []),
    ...(hasOpportunity && signals.threeWhyUpdates.whyUs ? ["threewhy:us"] : []),
  ].filter(key => !confirmed.has(key));
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  useEffect(() => setSelected(new Set(candidates)), [meetingId, opportunityId]);

  const confirmMutation = trpc.meetings.confirmFullSignals.useMutation({
    onSuccess: (data) => {
      const next = new Set<string>(data.confirmedKeys || []);
      setConfirmed(next);
      setSelected(new Set());
      onDone?.(Array.from(next));
      toast.success(data.applied.length ? `已确认并写入 ${data.applied.length} 条事实` : "没有新增可写入的事实");
    },
    onError: error => toast.error(`确认事实失败：${error.message}`),
  });

  const toggle = (key: string) => setSelected(current => {
    const next = new Set(current);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });
  const toggleAll = () => setSelected(current => current.size === candidates.length ? new Set() : new Set(candidates));
  const item = (key: string, title: string, detail: string, tone: string, requiresOpportunity = false) => {
    const done = confirmed.has(key);
    const locked = requiresOpportunity && !hasOpportunity;
    return <label key={key} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${done ? "border-emerald-400/25 bg-emerald-400/[0.05] opacity-75" : locked ? "border-slate-800 bg-slate-950/20 opacity-55" : tone}`}>
      <input type="checkbox" className="mt-0.5 accent-cyan-400" checked={done || selected.has(key)} disabled={done || locked} onChange={() => toggle(key)} />
      <span className="min-w-0 flex-1"><span className="flex items-center gap-2 text-xs font-semibold text-slate-100">{title}{done && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />}</span><span className="mt-1 block text-[11px] leading-5 text-slate-300">{detail}</span>{locked && <span className="mt-1 block text-[10px] text-amber-200">选择关联商机后才会写入 Deal Map。</span>}</span>
    </label>;
  };
  const total = signals.meddpiccUpdates.length + signals.contactDiscoveries.length + signals.competitorMentions.length + signals.timeSignals.length + Number(!!signals.threeWhyUpdates.whyChange) + Number(!!signals.threeWhyUpdates.whyNow) + Number(!!signals.threeWhyUpdates.whyUs);

  return <div className="space-y-4">
    <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/[0.06] p-4"><div className="flex items-center gap-2 text-sm font-semibold text-cyan-100"><Sparkles className="h-4 w-4" />本次拜访收获</div><p className="mt-2 text-xs leading-5 text-slate-300">{signals.meetingSummary}</p><p className="mt-2 text-[10px] leading-4 text-cyan-100/65">AI 先提出候选事实；你只需确认“客户是否确实说过或做过”。未确认内容不会改变任何客户或商机判断。</p></div>
    {opportunities.length > 0 && <div className="rounded-xl border border-violet-400/20 bg-violet-400/[0.05] p-3"><Label className="text-xs text-violet-100">关联商机（竞品与客户改变原因可写入该商机）</Label><Select value={opportunityId} onValueChange={setOpportunityId}><SelectTrigger className="mt-2 h-9 border-violet-400/25 bg-slate-950/60 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__client_only__">仅更新客户级事实</SelectItem>{opportunities.map((opportunity: any) => <SelectItem key={opportunity.id} value={String(opportunity.id)}>{opportunity.name}</SelectItem>)}</SelectContent></Select></div>}
    <div className="flex items-center justify-between gap-3"><div><div className="text-sm font-semibold text-slate-100">请选择确认无误的事实</div><p className="mt-1 text-[11px] text-slate-500">你无需理解 MEDDPICC、3 Why 或 Win 公式；系统会在确认后自动写到正确位置。</p></div>{total > 0 && <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 text-xs" onClick={toggleAll}>{selected.size === candidates.length && candidates.length ? "取消全选" : "全选可写入项"}</Button>}</div>
    {total === 0 ? <div className="rounded-xl border border-dashed border-slate-700 p-4 text-xs leading-5 text-slate-500">AI 未识别到可确认的新事实。数据不足，暂不判断；原始拜访记录已保留，可在下次沟通继续验证。</div> : <div className="grid gap-3 md:grid-cols-2">
      <section className="space-y-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-3"><div className="text-xs font-semibold text-amber-100">1. 推进的商机证据</div>{signals.meddpiccUpdates.length ? signals.meddpiccUpdates.map(signal => item(`meddpicc:${signal.dim}`, `${signal.dim} · 建议 ${signal.suggestedScore} 分`, `${signal.evidence}（${signal.confidence === "high" ? "明确事实" : signal.confidence === "medium" ? "间接证据" : "需继续验证"}）`, "border-amber-400/15 bg-slate-950/45")) : <p className="text-[11px] text-slate-500">本次没有可确认的商机证据更新。</p>}</section>
      <section className="space-y-2 rounded-xl border border-violet-400/20 bg-violet-400/[0.04] p-3"><div className="text-xs font-semibold text-violet-100">2. 关键人变化</div>{signals.contactDiscoveries.length ? signals.contactDiscoveries.map((signal, index) => item(`contact:${index}`, `${signal.name}${signal.title ? ` · ${signal.title}` : ""}`, `${signal.buyingRole} · ${signal.attitude}：${signal.evidence}`, "border-violet-400/15 bg-slate-950/45")) : <p className="text-[11px] text-slate-500">本次没有识别到新的关键人事实。</p>}</section>
      <section className="space-y-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.04] p-3"><div className="text-xs font-semibold text-rose-100">3. 竞品动态</div>{signals.competitorMentions.length ? signals.competitorMentions.map((signal, index) => item(`competitor:${index}`, `${signal.competitorName} · ${signal.threatLevel === "high" ? "高威胁" : signal.threatLevel === "medium" ? "中威胁" : "待观察"}`, signal.context, "border-rose-400/15 bg-slate-950/45", true)) : <p className="text-[11px] text-slate-500">本次没有可确认的竞品事实。</p>}</section>
      <section className="space-y-2 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.04] p-3"><div className="text-xs font-semibold text-cyan-100">4. 时间节点</div>{signals.timeSignals.length ? signals.timeSignals.map((signal, index) => item(`time:${index}`, `${signal.type === "deadline" ? "截止期" : signal.type === "budget_cycle" ? "预算周期" : "触发事件"}${signal.date ? ` · ${signal.date}` : ""}`, signal.description, "border-cyan-400/15 bg-slate-950/45")) : <p className="text-[11px] text-slate-500">本次没有可确认的时间节点。</p>}</section>
      <section className="space-y-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04] p-3 md:col-span-2"><div className="text-xs font-semibold text-emerald-100">5. 客户为什么会改变</div>{signals.threeWhyUpdates.whyChange && item("threewhy:change", "为什么改变", signals.threeWhyUpdates.whyChange, "border-emerald-400/15 bg-slate-950/45", true)}{signals.threeWhyUpdates.whyNow && item("threewhy:now", "为什么现在改变", signals.threeWhyUpdates.whyNow, "border-emerald-400/15 bg-slate-950/45", true)}{signals.threeWhyUpdates.whyUs && item("threewhy:us", "为什么考虑我们", signals.threeWhyUpdates.whyUs, "border-emerald-400/15 bg-slate-950/45", true)}{!signals.threeWhyUpdates.whyChange && !signals.threeWhyUpdates.whyNow && !signals.threeWhyUpdates.whyUs && <p className="text-[11px] text-slate-500">本次不足以确认客户改变原因，AI 不作推断。</p>}</section>
      <section className="space-y-2 rounded-xl border border-orange-400/20 bg-orange-400/[0.04] p-3 md:col-span-2"><div className="text-xs font-semibold text-orange-100">6. AI 判断与下一步</div>{signals.winFactorAlerts.length ? signals.winFactorAlerts.map((signal, index) => <div key={`${signal.factor}:${index}`} className="rounded-lg border border-orange-400/15 bg-slate-950/45 p-3 text-[11px] leading-5 text-slate-300"><strong className="text-orange-100">{signal.factor}：</strong>{signal.alert}</div>) : <p className="text-[11px] text-slate-500">数据不足，暂不判断 Win 因子风险。</p>}<div className="rounded-lg border border-cyan-400/15 bg-cyan-400/[0.04] p-3 text-xs leading-5 text-cyan-50"><span className="font-semibold text-cyan-200">AI 建议下一步：</span>{signals.nextBestAction}</div></section>
    </div>}
    <div className="flex justify-end gap-2 border-t border-border pt-3"><Button type="button" variant="outline" disabled={!selected.size || confirmMutation.isPending} onClick={() => setSelected(new Set())}>暂不处理</Button><Button type="button" disabled={!selected.size || confirmMutation.isPending} onClick={() => confirmMutation.mutate({ meetingId, clientId, opportunityId: hasOpportunity ? Number(opportunityId) : undefined, confirmedKeys: Array.from(selected) })}>{confirmMutation.isPending ? "正在写入事实…" : `确认并写入 ${selected.size} 条事实`}</Button></div>
  </div>;
}
