import { useState } from "react";
import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Zap, CheckCircle2, Circle, RefreshCw, CheckCheck, FileDown, User, Calendar, Target, MessageSquare, History, Clock, X, Trash2, Network, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import ClientSelector from "@/components/ClientSelector";
import { useRole } from "@/contexts/RoleContext";

const roleColor: Record<string, string> = {
  AD: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  SAM: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  SA: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  RSM: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

const priorityColor: Record<string, string> = {
  "高": "bg-red-500/20 text-red-400 border-red-500/30",
  "中": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "低": "bg-muted text-muted-foreground border-border",
};

const timeframeColor: Record<string, string> = {
  "今日": "text-red-400",
  "本周": "text-yellow-400",
  "本月": "text-muted-foreground",
};

function exportActionsToPDF(actions: any[], clientName: string, generatedAt: string) {
  // Build a printable HTML document and trigger browser print-to-PDF
  const roleColorMap: Record<string, string> = {
    AD: "#f59e0b",
    SAM: "#22d3ee",
    SA: "#a78bfa",
    RSM: "#34d399",
  };
  const priorityColorMap: Record<string, string> = {
    "高": "#f87171",
    "中": "#facc15",
    "低": "#6b7280",
  };

  const actionRows = actions.map((action, idx) => `
    <div style="margin-bottom:16px; padding:16px; border:1px solid #2d2d3d; border-radius:8px; background:#1a1a2e;">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px; flex-wrap:wrap;">
        <span style="font-size:11px; padding:2px 8px; border-radius:4px; border:1px solid; color:${roleColorMap[action.responsibleRole] || '#888'}; border-color:${roleColorMap[action.responsibleRole] || '#888'}40; background:${roleColorMap[action.responsibleRole] || '#888'}20; font-weight:600;">${action.responsibleRole}</span>
        <span style="font-size:11px; padding:2px 6px; border-radius:4px; border:1px solid; color:${priorityColorMap[action.priority] || '#888'}; border-color:${priorityColorMap[action.priority] || '#888'}40; background:${priorityColorMap[action.priority] || '#888'}20;">${action.priority}优先</span>
        <span style="font-size:11px; color:${action.timeframe === '今日' ? '#f87171' : action.timeframe === '本周' ? '#facc15' : '#6b7280'}; font-weight:500;">${action.timeframe}</span>
        ${action.aiGenerated ? '<span style="font-size:10px; padding:1px 6px; border-radius:4px; background:#7c3aed20; color:#a78bfa; border:1px solid #7c3aed40;">AI生成</span>' : ''}
      </div>
      <div style="font-size:14px; font-weight:600; color:#e2e8f0; margin-bottom:8px;">${idx + 1}. ${action.title}</div>
      ${action.objective ? `<div style="font-size:12px; color:#94a3b8; margin-bottom:8px;"><span style="color:#cbd5e1;">行动目标：</span>${action.objective}</div>` : ''}
      ${action.suggestedScript ? `
        <div style="font-size:12px; background:#0f172a; border-radius:6px; padding:10px; border:1px solid #334155; color:#cbd5e1; line-height:1.6;">
          <span style="color:#818cf8; font-weight:500;">建议话术：</span>
          <span>${action.suggestedScript}</span>
        </div>
      ` : ''}
    </div>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>AI行动指令台 - ${clientName}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif; background: #0d0d1a; color: #e2e8f0; padding: 32px; }
        @media print {
          body { background: white; color: #1a1a2e; }
        }
      </style>
    </head>
    <body>
      <div style="max-width:800px; margin:0 auto;">
        <div style="margin-bottom:24px; padding-bottom:16px; border-bottom:1px solid #2d2d3d;">
          <div style="font-size:11px; color:#6366f1; font-weight:600; letter-spacing:2px; margin-bottom:6px; text-transform:uppercase;">T100 专项 AI 作战指挥系统</div>
          <div style="font-size:22px; font-weight:700; color:#e2e8f0; margin-bottom:4px;">AI行动指令台</div>
          <div style="font-size:14px; color:#94a3b8;">目标客户：${clientName} &nbsp;·&nbsp; 生成时间：${generatedAt}</div>
          <div style="margin-top:8px; font-size:12px; color:#64748b;">以下行动指令由 AI 基于 MEDDPICC 状态和最新情报信号自动生成，人工审核后执行</div>
        </div>
        <div style="margin-bottom:16px; display:flex; gap:16px; flex-wrap:wrap;">
          <div style="font-size:12px; color:#94a3b8;">共 <span style="color:#e2e8f0; font-weight:600;">${actions.length}</span> 条行动指令</div>
          <div style="font-size:12px; color:#f87171;">今日 ${actions.filter(a => a.timeframe === '今日').length} 条</div>
          <div style="font-size:12px; color:#facc15;">本周 ${actions.filter(a => a.timeframe === '本周').length} 条</div>
        </div>
        ${actionRows}
        <div style="margin-top:24px; padding-top:16px; border-top:1px solid #2d2d3d; font-size:11px; color:#475569; text-align:center;">
          亚信安全 AIStorm 大湾区 T100 专项 · AI 原生作战系统 · 本文件由 AI 生成，人工审核后执行
        </div>
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    toast.error("请允许弹出窗口以导出PDF");
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 500);
}

export default function ActionCommand() {
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  // 支持URL参数预填clientId（从AD指挥台跳转时使用）
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("clientId");
    if (id && !isNaN(Number(id))) setSelectedClientId(Number(id));
  }, []);
  const [generating, setGenerating] = useState(false);
  const [generatingCoord, setGeneratingCoord] = useState(false);
  const [coordContext, setCoordContext] = useState("");
  const [showCoordInput, setShowCoordInput] = useState(false);
  const [adoptingAll, setAdoptingAll] = useState(false);
  const [adoptedIds, setAdoptedIds] = useState<Set<number>>(new Set());
  const { role } = useRole();

  const { data: clients = [] } = trpc.clients.list.useQuery();
  const { data: actions = [], refetch } = trpc.actions.listByClient.useQuery(
    { clientId: selectedClientId! },
    { enabled: !!selectedClientId }
  );
  const { data: roleActions = [], refetch: refetchRole } = trpc.actions.listByRole.useQuery({ role });

  const selectedClient = clients.find(c => c.id === selectedClientId);
  const { data: meddpicc } = trpc.meddpicc.get.useQuery(
    { clientId: selectedClientId! },
    { enabled: !!selectedClientId }
  );
  const { data: signals = [] } = trpc.intelligence.listByClient.useQuery(
    { clientId: selectedClientId! },
    { enabled: !!selectedClientId }
  );

  const deleteOne = trpc.actions.deleteOne.useMutation({
    onSuccess: () => { refetch(); refetchRole(); },
    onError: () => toast.error("删除失败，请重试"),
  });
  const clearPending = trpc.actions.clearPending.useMutation({
    onSuccess: () => { refetch(); refetchRole(); setAdoptedIds(new Set()); toast.success("已清空所有待执行指令"); },
    onError: () => toast.error("清空失败，请重试"),
  });
  const adoptOne = trpc.actions.adoptOne.useMutation({
    onSuccess: (_, vars) => {
      setAdoptedIds(prev => { const s = new Set(prev); s.add(vars.actionId); return s; });
      utils.pod.listByRole.invalidate();
      toast.success("已采纳并推入任务队列", { description: "前往 POD协同中枢 查看任务" });
    },
    onError: () => toast.error("采纳失败，请重试"),
  });

  const generate = trpc.actions.generate.useMutation({
    onSuccess: () => {
      refetch();
      refetchRole();
      setAdoptedIds(new Set());
      toast.success("AI行动指令已生成");
      setGenerating(false);
    },
    onError: () => {
      toast.error("生成失败，请重试");
      setGenerating(false);
    },
  });

  const complete = trpc.actions.complete.useMutation({
    onSuccess: () => { refetch(); refetchRole(); toast.success("行动已完成"); }
  });

  const generateCoord = trpc.actions.generateInternalCoord.useMutation({
    onSuccess: () => {
      refetch();
      refetchRole();
      setAdoptedIds(new Set());
      toast.success("AI 对内资源协调指令已生成");
      setGeneratingCoord(false);
      setShowCoordInput(false);
    },
    onError: () => {
      toast.error("生成失败，请重试");
      setGeneratingCoord(false);
    },
  });

  const handleGenerateCoord = () => {
    if (!selectedClientId || !meddpicc) {
      toast.error("请先选择客户");
      return;
    }
    setGeneratingCoord(true);
    const meddpiccSummary = `M:${meddpicc.metricsScore}/E:${meddpicc.economicBuyerScore}/D:${meddpicc.decisionCriteriaScore}/D:${meddpicc.decisionProcessScore}/I:${meddpicc.implicatePainScore}/C:${meddpicc.championScore}/C:${meddpicc.competitionScore}`;
    generateCoord.mutate({
      clientId: selectedClientId,
      clientName: selectedClient?.name || "",
      stage: selectedClient?.stage || "建图",
      meddpiccSummary,
      context: coordContext || undefined,
    });
  };

  const utils = trpc.useUtils();
  const adoptAllMutation = trpc.actions.adoptAll.useMutation({
    onSuccess: (result) => {
      utils.pod.listByRole.invalidate();
      const adCount = pendingActions.filter(a => a.responsibleRole === 'AD').length;
      const samCount = pendingActions.filter(a => a.responsibleRole === 'SAM').length;
      const saCount = pendingActions.filter(a => a.responsibleRole === 'SA').length;
      const rsmCount = pendingActions.filter(a => a.responsibleRole === 'RSM').length;
      toast.success(
        `已采纳并分配 ${result.created} 条行动：AD ${adCount} 条 · SAM ${samCount} 条 · SA ${saCount} 条${rsmCount > 0 ? ` · RSM ${rsmCount} 条` : ''}`,
        { duration: 5000 }
      );
      setAdoptingAll(false);
    },
    onError: () => {
      toast.error("采纳失败，请重试");
      setAdoptingAll(false);
    },
  });

  const handleGenerate = () => {
    if (!selectedClientId || !meddpicc) {
      toast.error("请先选择客户");
      return;
    }
    setGenerating(true);
    generate.mutate({
      clientId: selectedClientId,
      clientName: selectedClient?.name || "",
      industry: selectedClient?.industry || undefined,
      stage: selectedClient?.stage || "建图",
      hookTopic: selectedClient?.hookTopic || undefined,
      securityAngle: selectedClient?.securityAngle || undefined,
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
      recentSignals: signals.slice(0, 5).map(s => ({
        signalType: s.signalType,
        content: s.rawSignal || "",
        aiInterpretation: s.aiInterpretation,
      })),
      visitCount: (selectedClient as any)?.visitCount ?? 0,
      lastVisitDate: (selectedClient as any)?.lastVisitDate
        ? new Date((selectedClient as any).lastVisitDate).toISOString()
        : null,
    });
  };

  // One-click adopt all: visually mark as adopted AND persist to POD task queue via backend
  const handleAdoptAll = () => {
    if (pendingActions.length === 0 || !selectedClientId) return;
    setAdoptingAll(true);
    // Optimistic UI update
    const newAdopted = new Set(pendingActions.map(a => a.id));
    setAdoptedIds(newAdopted);
    // Persist to backend POD task queue
    adoptAllMutation.mutate({
      actionIds: pendingActions.map(a => a.id),
      clientId: selectedClientId,
      clientName: selectedClient?.name || "",
    });
  };

  const handleExportPDF = () => {
    if (pendingActions.length === 0) {
      toast.error("暂无行动指令可导出");
      return;
    }
    const now = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
    exportActionsToPDF(pendingActions, selectedClient?.name || "", now);
    toast.success("正在打开打印预览，请选择「另存为PDF」");
  };

  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const pendingActions = actions.filter(a => !a.isCompleted);
  const completedActions = actions.filter(a => a.isCompleted);
  const allAdopted = pendingActions.length > 0 && pendingActions.every(a => adoptedIds.has(a.id));

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">AI行动指令台</h1>
        </div>
        <p className="text-sm text-muted-foreground">AI生成优先行动清单 · 人工审核后一键采纳分配 · 导出执行</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Left: Client-specific actions */}
        <div className="xl:col-span-2 space-y-4">
          <div className="mb-4">
            <div className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">选择客户生成行动指令</div>
            <ClientSelector selectedId={selectedClientId} onSelect={setSelectedClientId} />
          </div>

          {selectedClientId && (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('pending')}
                  className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                    activeTab === 'pending' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Zap className="w-3 h-3" />待执行
                  {pendingActions.length > 0 && <span className="bg-primary/20 text-primary rounded-full px-1.5 text-[10px] font-bold">{pendingActions.length}</span>}
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                    activeTab === 'history' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <History className="w-3 h-3" />历史回顾
                  {completedActions.length > 0 && <span className="bg-muted text-muted-foreground rounded-full px-1.5 text-[10px]">{completedActions.length}</span>}
                </button>
              </div>
              <div className="text-sm font-semibold text-foreground">
                {selectedClient?.name} · {activeTab === 'pending' ? '行动清单' : '历史回顾'}
                <span className="ml-2 text-xs text-muted-foreground">({activeTab === 'pending' ? pendingActions.length : completedActions.length} 条)</span>
              </div>
              <div className="flex items-center gap-2">
                {pendingActions.length > 0 && (
                  <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={() => {
                    if (confirm(`确定清空 ${pendingActions.length} 条待执行指令？此操作不可撤销。`)) {
                      clearPending.mutate({ clientId: selectedClientId! });
                    }
                  }}>
                    <Trash2 className="w-3 h-3" />清空
                  </Button>
                )}
                <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs border-border" onClick={handleGenerate} disabled={generating}>
                  <RefreshCw className={cn("w-3 h-3", generating && "animate-spin")} />
                  {generating ? "AI生成中..." : "AI重新生成"}
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs border-violet-500/30 text-violet-400 hover:bg-violet-500/10" onClick={() => setShowCoordInput(v => !v)} disabled={generatingCoord}>
                  <Network className="w-3 h-3" />
                  {generatingCoord ? "生成中..." : "对内资源协调"}
                </Button>
                {pendingActions.length > 0 && (
                  <>
                    <Button
                      size="sm"
                      className={cn("gap-1.5 h-8 text-xs", allAdopted ? "bg-green-600 hover:bg-green-700" : "")}
                      onClick={handleAdoptAll}
                      disabled={adoptingAll || allAdopted}
                    >
                      <CheckCheck className="w-3 h-3" />
                      {adoptingAll ? "分配中..." : allAdopted ? "已全部采纳" : "一键采纳并分配"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-8 text-xs border-primary/30 text-primary hover:bg-primary/10"
                      onClick={handleExportPDF}
                    >
                      <FileDown className="w-3 h-3" />
                      导出PDF
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Internal Coord Input Panel */}
          {showCoordInput && selectedClientId && (
            <div className="bg-violet-950/20 border border-violet-500/30 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Network className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-xs font-semibold text-violet-400">AI 对内资源协调指令</span>
                <span className="text-[10px] text-muted-foreground ml-1">生成指派 SA/AD/RSM 的内部协作任务，自动流转到 POD 协同中枢</span>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground mb-1 block">背景信息（可选）——如“SA 需确认 AI Pentest 能力”、“需申请 POC 环境”</label>
                <textarea
                  className="w-full h-14 rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground resize-none placeholder:text-muted-foreground/50"
                  placeholder="描述当前需要内部协调的具体场景..."
                  value={coordContext}
                  onChange={(e) => setCoordContext(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="gap-1.5 h-7 text-xs bg-violet-600 hover:bg-violet-700" onClick={handleGenerateCoord} disabled={generatingCoord}>
                  <Wrench className="w-3 h-3" />
                  {generatingCoord ? "生成中..." : "生成对内协调指令"}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowCoordInput(false)}>取消</Button>
              </div>
            </div>
          )}

          {/* Adopt all summary banner */}
          {allAdopted && pendingActions.length > 0 && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <CheckCheck className="w-4 h-4 text-green-400" />
                <span className="text-sm font-semibold text-green-400">已采纳并完成分配</span>
              </div>
              <div className="flex gap-4 text-xs">
                {["AD", "SAM", "SA", "RSM"].map(r => {
                  const count = pendingActions.filter(a => a.responsibleRole === r).length;
                  if (count === 0) return null;
                  return (
                    <div key={r} className="flex items-center gap-1.5">
                      <span className={cn("px-1.5 py-0.5 rounded border text-[10px] font-bold", roleColor[r])}>{r}</span>
                      <span className="text-muted-foreground">{count} 条行动</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">各角色可在「POD协同中枢」查看自己的任务队列并开始执行</div>
            </div>
          )}

          {!selectedClientId ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <Zap className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-30" />
              <div className="text-sm text-muted-foreground">选择客户后，AI将基于MEDDPICC状态生成具体行动指令</div>
              <div className="text-xs text-muted-foreground mt-1">人工审核后一键采纳分配给 AD/SAM/SA</div>
            </div>
          ) : activeTab === 'pending' ? (
            pendingActions.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center">
                <div className="text-sm text-muted-foreground mb-3">暂无待执行行动</div>
                <Button size="sm" className="gap-2" onClick={handleGenerate} disabled={generating}>
                  <Zap className="w-3 h-3" />
                  {generating ? "AI生成中..." : "立即生成行动指令"}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingActions.map((action) => {
                  const isAdopted = adoptedIds.has(action.id);
                  return (
                    <div key={action.id} className={cn(
                      "bg-card border rounded-xl p-4 transition-all",
                      isAdopted ? "border-green-500/40 bg-green-500/5" : "border-border hover:border-muted-foreground/50"
                    )}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className={cn("text-xs px-2 py-0.5 rounded border font-medium", roleColor[action.responsibleRole])}>
                              <span className="flex items-center gap-1">
                                <User className="w-2.5 h-2.5" />
                                {action.responsibleRole}
                              </span>
                            </span>
                            <span className={cn("text-xs px-1.5 py-0.5 rounded border", priorityColor[action.priority])}>
                              {action.priority}优先
                            </span>
                            <span className={cn("text-xs font-medium flex items-center gap-1", timeframeColor[action.timeframe])}>
                              <Calendar className="w-2.5 h-2.5" />
                              {action.timeframe}
                            </span>
                            {action.aiGenerated && <span className="ai-badge">AI生成</span>}
                            {(action as any).taskType === 'resource_coord' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded border bg-violet-500/10 text-violet-400 border-violet-500/30 flex items-center gap-1">
                                <Network className="w-2.5 h-2.5" />对内协调
                              </span>
                            )}
                            {isAdopted && (
                              <span className="text-xs flex items-center gap-1 text-green-400">
                                <CheckCheck className="w-3 h-3" />已采纳
                              </span>
                            )}
                          </div>
                          <div className="font-medium text-foreground mb-1.5">{action.title}</div>
                          {action.objective && (
                            <div className="text-xs text-muted-foreground mb-2 flex items-start gap-1.5">
                              <Target className="w-3 h-3 mt-0.5 flex-shrink-0 text-primary/60" />
                              <span><span className="text-foreground/60">行动目标：</span>{action.objective}</span>
                            </div>
                          )}
                          {action.suggestedScript && (
                            <div className="text-xs bg-muted/30 rounded-lg p-2.5 border border-border text-foreground/80 leading-relaxed flex items-start gap-1.5">
                              <MessageSquare className="w-3 h-3 mt-0.5 flex-shrink-0 text-primary/60" />
                              <span>
                                <span className="text-primary/70 font-medium">建议话术：</span>
                                <span className="ml-1">{action.suggestedScript}</span>
                              </span>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            if (isAdopted) return;
                            adoptOne.mutate({ actionId: action.id, clientId: selectedClientId!, clientName: selectedClient?.name || "" });
                          }}
                          className={cn(
                            "flex-shrink-0 mt-1 transition-colors",
                            isAdopted ? "text-green-400 cursor-default" : "text-muted-foreground hover:text-green-400"
                          )}
                          title={isAdopted ? "已采纳至任务队列" : "采纳此指令 → 推入POD任务队列"}
                          disabled={isAdopted}
                        >
                          {isAdopted ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                        </button>
                        {!isAdopted && (
                          <button
                            onClick={() => deleteOne.mutate({ id: action.id })}
                            className="flex-shrink-0 mt-1 text-muted-foreground/40 hover:text-red-400 transition-colors"
                            title="删除此指令"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

              </div>
            )
          ) : (
            /* History Tab - Timeline view of completed actions */
            completedActions.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center">
                <History className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-30" />
                <div className="text-sm text-muted-foreground">暂无已完成的行动记录</div>
                <div className="text-xs text-muted-foreground mt-1">完成行动后会在这里按时间轴展示</div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  已完成 {completedActions.length} 条行动 · 按完成时间排序
                </div>
                {completedActions.map((action, idx) => (
                  <div key={action.id} className="flex gap-3">
                    {/* Timeline line */}
                    <div className="flex flex-col items-center">
                      <div className="w-6 h-6 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                      </div>
                      {idx < completedActions.length - 1 && (
                        <div className="w-px flex-1 bg-border mt-1" />
                      )}
                    </div>
                    {/* Content */}
                    <div className="flex-1 pb-4">
                      <div className="bg-card border border-border rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className={cn("text-xs px-1.5 py-0.5 rounded border font-medium", roleColor[action.responsibleRole])}>{action.responsibleRole}</span>
                          <span className={cn("text-xs px-1.5 py-0.5 rounded border", priorityColor[action.priority])}>{action.priority}优先</span>
                          {action.aiGenerated && <span className="ai-badge">AI生成</span>}
                          {action.completedAt && (
                            <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              {new Date(action.completedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-medium text-foreground/80 line-through">{action.title}</div>
                        {action.objective && (
                          <div className="text-xs text-muted-foreground mt-1">{action.objective}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Right: Role-specific view */}
        <div className="xl:col-span-1">
          <div className="bg-card border border-border rounded-xl p-4 sticky top-6">
            <div className="flex items-center gap-2 mb-4">
              <span className={cn("text-xs font-bold px-2 py-1 rounded border", roleColor[role])}>{role}</span>
              <div className="text-sm font-semibold text-foreground">我的行动队列</div>
            </div>
            {roleActions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <div className="text-sm">暂无待执行行动</div>
                <div className="text-xs mt-1 text-muted-foreground/60">AI生成并采纳后，行动会出现在这里</div>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {roleActions.map((action) => {
                  const clientName = clients.find(c => c.id === action.clientId)?.name;
                  return (
                    <div key={action.id} className="border border-border rounded-lg p-3 hover:border-muted-foreground/50 transition-colors">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-primary font-medium">{clientName}</span>
                        <span className={cn("text-xs", timeframeColor[action.timeframe])}>{action.timeframe}</span>
                        <span className={cn("text-xs px-1.5 py-0.5 rounded border ml-auto", priorityColor[action.priority])}>
                          {action.priority}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-foreground">{action.title}</div>
                      {action.objective && (
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{action.objective}</div>
                      )}
                      <button
                        onClick={() => complete.mutate({ id: action.id })}
                        className="mt-2 text-xs text-muted-foreground hover:text-green-400 transition-colors flex items-center gap-1"
                      >
                        <Circle className="w-3 h-3" />标记完成
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
