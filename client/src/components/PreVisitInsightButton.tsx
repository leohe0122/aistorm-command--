import { useState } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Download, FileText, Info, Shield, Sparkles, Target, Zap } from "lucide-react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function downloadPager(content: string, executive: string, clientName: string) {
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `1-Pager_${clientName}_${executive}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function PreVisitInsightButton({ client }: { client: any }) {
  const [open, setOpen] = useState(false);
  const [targetExecutive, setTargetExecutive] = useState("");
  const [targetTitle, setTargetTitle] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [latestPagerId, setLatestPagerId] = useState<number | null>(null);
  const [hookTopicDraft, setHookTopicDraft] = useState("");
  const [securityAngleDraft, setSecurityAngleDraft] = useState("");
  const [hookTopicBasis, setHookTopicBasis] = useState("");
  const [securityAngleBasis, setSecurityAngleBasis] = useState("");
  const [appliedHook, setAppliedHook] = useState(false);
  const [appliedSecurity, setAppliedSecurity] = useState(false);
  const utils = trpc.useUtils();
  const { data: onePagers = [], refetch } = trpc.insights.listByClient.useQuery({ clientId: client.id }, { enabled: open });
  const generate = trpc.insights.generate.useMutation({
    onSuccess: (result) => {
      refetch();
      setLatestPagerId(result.id);
      setExpandedId(result.id);
      setHookTopicDraft(result.hookTopicDraft || "");
      setSecurityAngleDraft(result.securityAngleDraft || "");
      setHookTopicBasis((result as any).hookTopicBasis || "");
      setSecurityAngleBasis((result as any).securityAngleBasis || "");
      setAppliedHook(false);
      setAppliedSecurity(false);
      toast.success("拜访前洞察已生成");
    },
    onError: (error) => toast.error(`洞察生成失败：${error.message}`),
  });
  const applyStrategy = trpc.insights.applyStrategy.useMutation({
    onSuccess: (_result, vars) => {
      utils.clients.list.invalidate();
      if (vars.hookTopic) { setAppliedHook(true); toast.success("敲门砖话题已写入客户作战台"); }
      if (vars.securityAngle) { setAppliedSecurity(true); toast.success("安全切入点已写入客户作战台"); }
    },
    onError: () => toast.error("应用失败，请重试"),
  });
  const createInsight = () => {
    if (!targetExecutive.trim()) { toast.error("请填写本次拜访的目标高管姓名"); return; }
    generate.mutate({
      clientId: client.id,
      clientName: client.name,
      industry: client.industry || undefined,
      hookTopic: client.hookTopic || undefined,
      securityAngle: client.securityAngle || undefined,
      notes: client.notes || undefined,
      targetExecutive: targetExecutive.trim(),
      targetTitle: targetTitle.trim() || undefined,
    });
  };

  return <Dialog open={open} onOpenChange={setOpen}>
    <Button type="button" size="sm" onClick={() => setOpen(true)} className="h-8 gap-1.5 bg-violet-500/80 text-xs text-white hover:bg-violet-400"><Sparkles className="h-3.5 w-3.5" />生成拜访前洞察</Button>
    <DialogContent className="max-h-[88vh] max-w-5xl overflow-y-auto border-slate-700 bg-slate-950 p-0 text-slate-100">
      <DialogHeader className="border-b border-violet-400/15 bg-violet-400/[0.06] px-5 py-4">
        <DialogTitle className="flex items-center gap-2 text-base text-violet-50"><Sparkles className="h-4 w-4 text-violet-300" />拜访前 AI 洞察 · {client.name}</DialogTitle>
        <p className="text-xs leading-5 text-violet-100/60">在每次高层拜访前生成 1-Pager。AI 只读取已入库客户档案与情报；公开情报推断会明确标注为初始建议，不能替代客户事实。</p>
      </DialogHeader>
      <div className="grid gap-5 p-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-700/70 bg-slate-900/40 p-3 text-xs leading-5"><div className="mb-2 font-semibold text-slate-100">当前客户档案</div><p className="text-slate-400">敲门砖：<span className="text-slate-200">{client.hookTopic || "尚未形成"}</span></p><p className="mt-1 text-slate-400">安全切入：<span className="text-slate-200">{client.securityAngle || "尚未形成"}</span></p></div>
          <div className="space-y-2"><label className="text-[11px] font-medium text-slate-300">目标高管姓名 <span className="text-rose-300">*</span></label><Input value={targetExecutive} onChange={event => setTargetExecutive(event.target.value)} placeholder="例：Marcos" className="h-9 bg-slate-900/70 text-xs" /><label className="text-[11px] font-medium text-slate-300">职位（可选）</label><Input value={targetTitle} onChange={event => setTargetTitle(event.target.value)} placeholder="例：集团 CIO" className="h-9 bg-slate-900/70 text-xs" /><Button type="button" onClick={createInsight} disabled={generate.isPending || !targetExecutive.trim()} className="mt-1 h-9 w-full gap-1.5 bg-violet-500 text-xs hover:bg-violet-400">{generate.isPending ? <><Sparkles className="h-3.5 w-3.5 animate-spin" />正在研判…</> : <><Sparkles className="h-3.5 w-3.5" />生成 1-Pager</>}</Button></div>
          <div className="rounded-lg border border-amber-400/15 bg-amber-400/[0.045] p-3 text-[10px] leading-4 text-slate-400"><strong className="text-amber-100">使用边界：</strong>将 AI 建议作为会前假设；客户现场给出的原话、需求和触发事件仍须回填至拜访日志与购买信号工作区。</div>
        </aside>
        <section className="min-w-0">
          {generate.isPending ? <div className="flex min-h-72 flex-col items-center justify-center text-center"><Sparkles className="mb-3 h-9 w-9 animate-pulse text-violet-300" /><p className="text-sm text-slate-200">AI 正在生成拜访前简报…</p><p className="mt-1 text-xs text-slate-500">正在汇总当前客户档案与已有情报来源</p></div> : onePagers.length === 0 ? <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 text-center"><FileText className="mb-3 h-9 w-9 text-slate-600" /><p className="text-sm text-slate-400">尚无拜访前简报</p><p className="mt-1 text-xs text-slate-500">填写目标高管后生成当前会前准备材料</p></div> : <div className="space-y-3">{(onePagers as any[]).map(pager => <article key={pager.id} className="overflow-hidden rounded-xl border border-slate-700/70 bg-slate-900/35"><div className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-slate-900/65" onClick={() => setExpandedId(expandedId === pager.id ? null : pager.id)}><div className="flex min-w-0 items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-400/15 text-violet-200"><FileText className="h-4 w-4" /></span><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-100">{pager.targetExecutive}{pager.targetTitle ? <span className="ml-1 text-slate-500">· {pager.targetTitle}</span> : null}</p><p className="text-[10px] text-slate-500">{new Date(pager.createdAt).toLocaleDateString("zh-CN")} 生成</p></div></div><div className="flex items-center gap-2"><button type="button" onClick={event => { event.stopPropagation(); downloadPager(pager.content, pager.targetExecutive, client.name); }} className="rounded p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-100" title="下载 Markdown"><Download className="h-3.5 w-3.5" /></button>{expandedId === pager.id ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}</div></div>{expandedId === pager.id && <div className="border-t border-slate-700/60 bg-slate-950/45 p-4">{pager.id === latestPagerId && (hookTopicDraft || securityAngleDraft) && <div className="mb-4 space-y-3 rounded-xl border border-cyan-400/25 bg-cyan-400/[0.05] p-3"><div className="flex items-center gap-2"><Target className="h-4 w-4 text-cyan-300" /><p className="text-xs font-semibold text-cyan-100">战略建议摘要</p><span className="text-[10px] text-slate-500">初始假设，需在会后用客户事实校正</span></div>{hookTopicDraft && <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-700/60 bg-slate-950/55 p-3"><div><p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-slate-200"><Target className="h-3 w-3 text-cyan-300" />敲门砖话题{hookTopicBasis && <Tooltip><TooltipTrigger asChild><button type="button" className="ml-1 inline-flex items-center gap-0.5 text-[10px] font-normal text-slate-500 hover:text-cyan-200"><Info className="h-3 w-3" />依据</button></TooltipTrigger><TooltipContent className="max-w-xs text-xs"><p>{hookTopicBasis}</p></TooltipContent></Tooltip>}</p><p className="text-xs leading-5 text-slate-300">{hookTopicDraft}</p></div><Button size="sm" type="button" onClick={() => applyStrategy.mutate({ clientId: client.id, hookTopic: hookTopicDraft })} disabled={appliedHook || applyStrategy.isPending} className="h-7 shrink-0 gap-1 text-[10px] bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25">{appliedHook ? <><CheckCircle2 className="h-3 w-3" />已应用</> : <><Zap className="h-3 w-3" />写入客户</>}</Button></div>}{securityAngleDraft && <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-700/60 bg-slate-950/55 p-3"><div><p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-slate-200"><Shield className="h-3 w-3 text-violet-300" />安全切入点{securityAngleBasis && <Tooltip><TooltipTrigger asChild><button type="button" className="ml-1 inline-flex items-center gap-0.5 text-[10px] font-normal text-slate-500 hover:text-violet-200"><Info className="h-3 w-3" />依据</button></TooltipTrigger><TooltipContent className="max-w-xs text-xs"><p>{securityAngleBasis}</p></TooltipContent></Tooltip>}</p><p className="text-xs leading-5 text-slate-300">{securityAngleDraft}</p></div><Button size="sm" type="button" onClick={() => applyStrategy.mutate({ clientId: client.id, securityAngle: securityAngleDraft })} disabled={appliedSecurity || applyStrategy.isPending} className="h-7 shrink-0 gap-1 text-[10px] bg-violet-500/15 text-violet-100 hover:bg-violet-500/25">{appliedSecurity ? <><CheckCircle2 className="h-3 w-3" />已应用</> : <><Zap className="h-3 w-3" />写入客户</>}</Button></div>}<p className="flex items-center gap-1 text-[10px] text-slate-500"><AlertCircle className="h-3 w-3" />点击“写入客户”前，请先确认该建议与当前已有事实一致。</p></div>}<div className="prose prose-invert prose-sm max-w-none text-xs leading-6 prose-headings:text-violet-100 prose-strong:text-slate-100"><Streamdown>{pager.content}</Streamdown></div></div>}</article>)}</div>}
        </section>
      </div>
    </DialogContent>
  </Dialog>;
}
