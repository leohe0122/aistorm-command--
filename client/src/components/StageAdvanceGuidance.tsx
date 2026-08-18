import { useMemo, useState } from "react";
import { CheckCircle2, ChevronRight, CircleAlert, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const STAGES = ["初步需求", "需求挖掘", "技术验证", "方案提案", "商务谈判", "赢单", "丢单"] as const;

export function StageAdvanceGuidance({ clientId, opportunityId, currentStage }: { clientId: number; opportunityId: number; currentStage: string }) {
  const utils = trpc.useUtils();
  const currentIndex = Math.max(0, STAGES.indexOf(currentStage as typeof STAGES[number]));
  const [targetStage, setTargetStage] = useState<(typeof STAGES)[number]>(() => STAGES[Math.min(currentIndex + 1, STAGES.length - 1)]);
  const input = useMemo(() => ({ clientId, opportunityId, targetStage }), [clientId, opportunityId, targetStage]);
  const guidance = trpc.opportunities.getStageGuidance.useQuery(input);
  const advance = trpc.opportunities.advanceWithEvidence.useMutation({
    onSuccess: result => {
      toast.success(`商机已推进至${result.stage}`);
      utils.opportunities.listByClient.invalidate({ clientId });
      utils.opportunities.getStageGuidance.invalidate(input);
    },
    onError: error => toast.error(`暂不能推进：${error.message}`),
  });
  const data = guidance.data;
  const firstMissing = data?.missing?.[0];
  const canAdvance = Boolean(data?.isReady) && targetStage !== currentStage;
  const openAI = () => {
    document.querySelector<HTMLElement>("[data-ai-active-guidance]")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  return <section className="rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-400/[0.075] via-slate-950/70 to-slate-950/85 p-4 shadow-[0_14px_40px_rgba(251,191,36,0.08)]">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-200"><ChevronRight className="h-4.5 w-4.5" /></span><div><h2 className="text-sm font-semibold text-amber-50">AI 阶段推进引导</h2><p className="mt-1 text-xs leading-5 text-amber-100/55">不是选择阶段后再补表。AI 先告诉你还需要从客户那里确认什么；只有证据入库后，才能推进。</p></div></div><select value={targetStage} onChange={event => setTargetStage(event.target.value as typeof targetStage)} className="h-8 rounded-md border border-amber-400/25 bg-slate-950/70 px-2.5 text-xs text-amber-100 outline-none focus:ring-2 focus:ring-amber-400/40">{STAGES.slice(Math.min(currentIndex + 1, STAGES.length - 1)).map(stage => <option key={stage} value={stage}>准备推进至：{stage}</option>)}</select></div>
    {guidance.isLoading ? <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-950/45 px-3 py-4 text-xs text-slate-400"><Loader2 className="h-4 w-4 animate-spin" />正在核对已入库的客户证据…</div> : data ? <><div className="mt-4 grid gap-2">{data.requirements.map((requirement: any) => <article key={requirement.key} className={cn("rounded-xl border px-3 py-3", requirement.met ? "border-emerald-400/20 bg-emerald-400/[0.045]" : "border-amber-400/20 bg-amber-400/[0.045]")}><div className="flex items-start gap-2"><span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full", requirement.met ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-400/15 text-amber-200")}>{requirement.met ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleAlert className="h-3.5 w-3.5" />}</span><div className="min-w-0"><div className="text-xs font-semibold text-slate-100">{requirement.label}</div>{requirement.met ? <p className="mt-1 text-[11px] leading-5 text-slate-400">已入库事实：{requirement.evidence}</p> : <><p className="mt-1 text-xs leading-5 text-amber-100">AI 建议这样问：{requirement.question}</p><p className="mt-1 text-[10px] text-slate-500">数据不足，暂不判断。请用下方 AI 主动引导记录客户回答，再确认写入事实。</p></>}</div></div></article>)}</div>{firstMissing ? <div className="mt-3 flex flex-col gap-2 rounded-xl border border-fuchsia-400/20 bg-fuchsia-400/[0.055] p-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-2"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-200" /><p className="text-xs leading-5 text-fuchsia-100">下一步优先确认：{firstMissing.question}</p></div><Button type="button" size="sm" variant="outline" className="h-8 shrink-0 gap-1.5 border-fuchsia-400/30 bg-fuchsia-400/10 text-xs text-fuchsia-100 hover:bg-fuchsia-400/20" onClick={openAI}><Sparkles className="h-3.5 w-3.5" />让 AI 引导补证</Button></div> : <div className="mt-3 flex flex-col gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.055] p-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs leading-5 text-emerald-100">目标阶段的硬性证据已入库。请确认后推进；系统将重新开始计算该阶段的停留时间。</p><Button type="button" size="sm" className="h-8 shrink-0 gap-1.5 bg-emerald-500 text-xs text-white hover:bg-emerald-400" disabled={!canAdvance || advance.isPending} onClick={() => advance.mutate(input)}>{advance.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}确认推进至 {targetStage}</Button></div>}</> : <p className="mt-4 text-xs text-slate-500">暂无法读取阶段要求，请稍后重试。</p>}
  </section>;
}
