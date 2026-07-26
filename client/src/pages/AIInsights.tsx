import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { FileText, Sparkles, ChevronDown, ChevronUp, Download, Target, Shield, CheckCircle2, AlertCircle, Zap, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ClientSelector from "@/components/ClientSelector";
import { Streamdown } from "streamdown";
import { TermTooltip } from "@/components/TermTooltip";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function AIInsights() {
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [targetExec, setTargetExec] = useState("");
  const [targetTitle, setTargetTitle] = useState("");
  const [generating, setGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [latestPagerId, setLatestPagerId] = useState<number | null>(null);
  const [hookTopicDraft, setHookTopicDraft] = useState("");
  const [securityAngleDraft, setSecurityAngleDraft] = useState("");
  const [hookTopicBasis, setHookTopicBasis] = useState("");
  const [securityAngleBasis, setSecurityAngleBasis] = useState("");
  const [appliedHook, setAppliedHook] = useState(false);
  const [appliedSecurity, setAppliedSecurity] = useState(false);

  const { data: clients = [] } = trpc.clients.list.useQuery();
  const { data: onePagers = [], refetch } = trpc.insights.listByClient.useQuery(
    { clientId: selectedClientId! },
    { enabled: !!selectedClientId }
  );
  const utils = trpc.useUtils();

  const selectedClient = clients.find(c => c.id === selectedClientId);

  const generate = trpc.insights.generate.useMutation({
    onSuccess: (data) => {
      refetch();
      setExpandedId(data.id);
      setLatestPagerId(data.id);
      if (data.hookTopicDraft) setHookTopicDraft(data.hookTopicDraft);
      if (data.securityAngleDraft) setSecurityAngleDraft(data.securityAngleDraft);
      if ((data as any).hookTopicBasis) setHookTopicBasis((data as any).hookTopicBasis);
      if ((data as any).securityAngleBasis) setSecurityAngleBasis((data as any).securityAngleBasis);
      setAppliedHook(false);
      setAppliedSecurity(false);
      toast.success("AI 洞察简报已生成");
      setGenerating(false);
    },
    onError: () => {
      toast.error("生成失败，请重试");
      setGenerating(false);
    },
  });

  const applyStrategy = trpc.insights.applyStrategy.useMutation({
    onSuccess: (_, vars) => {
      utils.clients.list.invalidate();
      if (vars.hookTopic) { setAppliedHook(true); toast.success("敲门砖话题已应用到战场地图"); }
      if (vars.securityAngle) { setAppliedSecurity(true); toast.success("安全切入点已应用到战场地图"); }
    },
    onError: () => toast.error("应用失败，请重试"),
  });

  const handleGenerate = () => {
    if (!selectedClientId || !targetExec.trim()) {
      toast.error("请选择客户并填写目标高管姓名");
      return;
    }
    setGenerating(true);
    generate.mutate({
      clientId: selectedClientId,
      clientName: selectedClient?.name || "",
      industry: selectedClient?.industry || undefined,
      hookTopic: selectedClient?.hookTopic || undefined,
      securityAngle: selectedClient?.securityAngle || undefined,
      notes: selectedClient?.notes || undefined,
      targetExecutive: targetExec,
      targetTitle: targetTitle || undefined,
    });
  };

  const handleDownload = (content: string, execName: string, clientName: string) => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `1-Pager_${clientName}_${execName}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <TermTooltip term="AI洞察简报">
            <h1 className="text-xl font-bold text-foreground">AI 洞察简报</h1>
          </TermTooltip>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">拜访前客户洞察 1-Pager</span>
        </div>
        <p className="text-sm text-muted-foreground">基于客户情报与产品知识，生成高层拜访前的战略简报，含敲门砖建议与 SPIN 提问预演。</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Form */}
        <div className="lg:col-span-1">
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">目标客户</label>
              <ClientSelector
                selectedId={selectedClientId}
                onSelect={(id: number) => { setSelectedClientId(id); setLatestPagerId(null); setHookTopicDraft(""); setSecurityAngleDraft(""); }}
              />
            </div>
            {selectedClient && (
              <div className="p-3 rounded-lg bg-muted/20 border border-border space-y-1.5">
                <div className="text-xs text-muted-foreground">敲门砖：<span className="text-foreground">{selectedClient.hookTopic || "待定"}</span></div>
                <div className="text-xs text-muted-foreground">安全切入：<span className="text-foreground">{selectedClient.securityAngle || "待定"}</span></div>
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">目标高管姓名 *</label>
              <Input placeholder="例：张总、李 CIO" value={targetExec} onChange={e => setTargetExec(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">职位（选填）</label>
              <Input placeholder="例：CIO、CISO、IT总监" value={targetTitle} onChange={e => setTargetTitle(e.target.value)} />
            </div>
            <Button className="w-full" onClick={handleGenerate} disabled={generating || !selectedClientId}>
              {generating ? (
                <><span className="animate-spin mr-2">⟳</span>AI 生成中...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" />生成 1-Pager 简报</>
              )}
            </Button>
          </div>
        </div>

        {/* Right: Results */}
        <div className="lg:col-span-2">
          {!selectedClientId ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
              <div className="text-sm text-muted-foreground">请先选择目标客户</div>
            </div>
          ) : generating ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <Sparkles className="w-10 h-10 mx-auto mb-3 text-primary animate-pulse" />
              <div className="text-sm text-muted-foreground mb-1">AI 正在生成简报...</div>
              <div className="text-xs text-muted-foreground">同时提炼战略建议，约需 20-40 秒</div>
            </div>
          ) : onePagers.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <Sparkles className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
              <div className="text-sm text-muted-foreground mb-2">暂无简报</div>
              <div className="text-xs text-muted-foreground">填写目标高管信息后点击生成</div>
            </div>
          ) : (
            <div className="space-y-3">
              {onePagers.map((pager) => (
                <div key={pager.id} className="bg-card border border-border rounded-xl overflow-hidden">
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/20 transition-colors"
                    onClick={() => setExpandedId(expandedId === pager.id ? null : pager.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium text-foreground">
                          {pager.targetExecutive}
                          {pager.targetTitle && <span className="text-muted-foreground ml-1 text-sm">· {pager.targetTitle}</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(pager.createdAt).toLocaleDateString("zh-CN")} 生成
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(pager.content, pager.targetExecutive, selectedClient?.name || "");
                        }}
                        className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                        title="下载Markdown"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      {expandedId === pager.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>
                  {expandedId === pager.id && (
                    <div className="border-t border-border p-4 bg-muted/5">
                      {/* Strategy Summary Card - shown for latest generated pager */}
                      {pager.id === latestPagerId && (hookTopicDraft || securityAngleDraft) && (
                        <div className="mb-4 border border-cyan-500/30 rounded-lg bg-cyan-500/5 p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Target className="w-4 h-4 text-cyan-400" />
                            <span className="text-sm font-semibold text-cyan-400">战略建议摘要</span>
                            <span className="text-xs text-muted-foreground">基于公开情报的初始建议</span>
                          </div>
                          <div className="space-y-3">
                            {hookTopicDraft && (
                              <div className="flex items-start justify-between gap-3 p-3 rounded-lg bg-muted/20 border border-border">
                                <div className="flex-1">
                                  <div className="text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5">
                                    <Target className="w-3 h-3 text-cyan-400" />
                                    敲门砖话题建议
                                    {hookTopicBasis && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-cyan-400 transition-colors">
                                              <Info className="w-3 h-3" />
                                              查看依据
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="max-w-xs text-xs">
                                            <p>{hookTopicBasis}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                  </div>
                                  <p className="text-sm text-foreground">{hookTopicDraft}</p>
                                </div>
                                <button
                                  onClick={() => {
                                    if (!selectedClientId) return;
                                    applyStrategy.mutate({ clientId: selectedClientId, hookTopic: hookTopicDraft });
                                  }}
                                  disabled={appliedHook || applyStrategy.isPending}
                                  className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50 bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25 border border-cyan-500/30"
                                  title="直接写入战场地图"
                                >
                                  {appliedHook ? <><CheckCircle2 className="w-3 h-3" />已应用</> : <><Zap className="w-3 h-3" />一键应用</>}
                                </button>
                              </div>
                            )}
                            {securityAngleDraft && (
                              <div className="flex items-start justify-between gap-3 p-3 rounded-lg bg-muted/20 border border-border">
                                <div className="flex-1">
                                  <div className="text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5">
                                    <Shield className="w-3 h-3 text-violet-400" />
                                    安全切入点建议
                                    {securityAngleBasis && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-violet-400 transition-colors">
                                              <Info className="w-3 h-3" />
                                              查看依据
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="max-w-xs text-xs">
                                            <p>{securityAngleBasis}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                  </div>
                                  <p className="text-sm text-foreground">{securityAngleDraft}</p>
                                </div>
                                <button
                                  onClick={() => {
                                    if (!selectedClientId) return;
                                    applyStrategy.mutate({ clientId: selectedClientId, securityAngle: securityAngleDraft });
                                  }}
                                  disabled={appliedSecurity || applyStrategy.isPending}
                                  className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50 bg-violet-500/15 text-violet-400 hover:bg-violet-500/25 border border-violet-500/30"
                                  title="直接写入战场地图"
                                >
                                  {appliedSecurity ? <><CheckCircle2 className="w-3 h-3" />已应用</> : <><Zap className="w-3 h-3" />一键应用</>}
                                </button>
                              </div>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            以上建议基于公开情报，供参考。点击「一键应用」直接写入战场地图。拜访后请在拜访作战日志中更新。
                          </p>
                        </div>
                      )}
                      <div className="prose prose-sm prose-invert max-w-none">
                        <Streamdown>{pager.content}</Streamdown>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
