import { useState } from "react";
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Radio, Send, AlertTriangle, TrendingUp, Users, Briefcase, Code, HelpCircle,
  Newspaper, Loader2, RefreshCw, ExternalLink, Calendar, Rss, Shield
} from "lucide-react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import ClientSelector from "@/components/ClientSelector";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const signalTypeIcon: Record<string, any> = {
  "人事变动": Users,
  "业务扩张": TrendingUp,
  "合规事件": AlertTriangle,
  "合规政策": Shield,
  "招聘信号": Briefcase,
  "技术公告": Code,
  "其他": HelpCircle,
};

const signalTypeColor: Record<string, string> = {
  "人事变动": "text-blue-400 bg-blue-500/10 border-blue-500/20",
  "业务扩张": "text-green-400 bg-green-500/10 border-green-500/20",
  "合规事件": "text-red-400 bg-red-500/10 border-red-500/20",
  "合规政策": "text-purple-400 bg-purple-500/10 border-purple-500/20",
  "招聘信号": "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  "技术公告": "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  "其他": "text-muted-foreground bg-muted/30 border-border",
};

const urgencyColor: Record<string, string> = {
  "高": "text-red-400 bg-red-500/10 border-red-500/30",
  "中": "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  "低": "text-muted-foreground bg-muted/30 border-border",
};

function formatPubDate(dateStr: string) {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  } catch {
    return dateStr.slice(0, 10);
  }
}

export default function IntelRadar() {
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [signalInput, setSignalInput] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [latestResult, setLatestResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"news" | "signals" | "compliance">("news");
  const [selectedNewsItem, setSelectedNewsItem] = useState<any>(null);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<number | null>(null);
  const [complianceExpanded, setComplianceExpanded] = useState(true);
  const [confirmDeleteSignalId, setConfirmDeleteSignalId] = useState<number | null>(null);
  const [deletingSignalId, setDeletingSignalId] = useState<number | null>(null);

  const { data: clients = [] } = trpc.clients.list.useQuery();
  const { data: signals = [], refetch } = trpc.intelligence.listByClient.useQuery(
    { clientId: selectedClientId! },
    { enabled: !!selectedClientId }
  );
  const { data: allSignals = [], refetch: refetchAll } = trpc.intelligence.listAll.useQuery();

  const selectedClient = clients.find(c => c.id === selectedClientId);
  const { data: opportunities = [] } = trpc.opportunities.listByClient.useQuery(
    { clientId: selectedClientId! },
    { enabled: !!selectedClientId }
  );

  // Real RSS news fetch
  const { data: newsItems = [], isLoading: fetchingNews, refetch: refetchNews } = trpc.rss.fetchNews.useQuery(
    {
      clientName: selectedClient?.name || "",
      clientNameEn: selectedClient?.nameEn || undefined,
      keywords: (selectedClient?.monitorKeywords as string[] || []).slice(0, 3),
      limit: 20,
    },
    { enabled: !!selectedClientId && !!selectedClient }
  );

  // Compliance policy RSS (港澳+东南亚合规政策动态，全局，不过滤客户)
  const deleteSignal = trpc.intelligence.delete.useMutation({
    onSuccess: () => {
      refetch();
      refetchAll();
      setConfirmDeleteSignalId(null);
      setDeletingSignalId(null);
      toast.success("信号已删除");
    },
    onError: () => {
      setDeletingSignalId(null);
      toast.error("删除失败，请重试");
    },
  });

  const { data: complianceItems = [], isLoading: fetchingCompliance, refetch: refetchCompliance } = trpc.rss.fetchComplianceNews.useQuery(
    { limit: 30 }
  );

  const analyze = trpc.intelligence.analyze.useMutation({
    onSuccess: (data) => {
      setLatestResult(data);
      setSignalInput("");
      refetch();
      refetchAll();
      toast.success("AI情报解读完成");
      setAnalyzing(false);
      setActiveTab("signals");
    },
    onError: () => {
      toast.error("解读失败，请重试");
      setAnalyzing(false);
    },
  });

  const handleAnalyze = () => {
    if (!selectedClientId || !signalInput.trim()) {
      toast.error("请先选择客户并输入信号内容");
      return;
    }
    setAnalyzing(true);
    setLatestResult(null);
    analyze.mutate({
      clientId: selectedClientId,
      clientName: selectedClient?.name || "",
      rawSignal: signalInput,
      industry: selectedClient?.industry || undefined,
      opportunityId: selectedOpportunityId ?? undefined,
    });
  };

  // Use a news item as signal input
  const handleUseAsSignal = (item: any) => {
    setSignalInput(`${item.title}\n\n${item.description}`);
    setSelectedNewsItem(item);
    setActiveTab("signals");
    toast.info("新闻已填入信号输入框，点击「AI解读信号」进行分析");
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Radio className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">AI情报雷达</h1>
        </div>
        <p className="text-sm text-muted-foreground">实时监控客户外部动态，AI自动解读并生成销售触达建议</p>
      </div>

      {/* Client Selector */}
      <div className="mb-5">
        <div className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">选择目标客户</div>
        <ClientSelector selectedId={selectedClientId} onSelect={setSelectedClientId} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Left: Input Panel */}
        <div className="xl:col-span-1 space-y-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-sm font-semibold text-foreground mb-3">手动输入情报信号</div>
            {selectedClient && (selectedClient.monitorKeywords as string[] || []).length > 0 && (
              <div className="mb-3 p-2 bg-muted/30 rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">监控关键词</div>
                <div className="flex flex-wrap gap-1">
                  {(selectedClient.monitorKeywords as string[] || []).map((kw: string, i: number) => (
                    <span key={i} className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded border border-primary/20">{kw}</span>
                  ))}
                </div>
              </div>
            )}
            {selectedNewsItem && (
              <div className="mb-3 p-2 bg-primary/5 rounded-lg border border-primary/20">
                <div className="text-xs text-primary mb-1">来源新闻</div>
                <div className="text-xs text-muted-foreground line-clamp-2">{selectedNewsItem.title}</div>
              </div>
            )}
            {selectedClientId && opportunities.length > 0 && (
              <div className="mb-3">
                <div className="text-xs text-muted-foreground mb-1">关联商机（可选）</div>
                <select
                  className="w-full h-7 text-xs bg-muted/30 border border-border rounded px-2 text-foreground"
                  value={selectedOpportunityId ?? ""}
                  onChange={(e) => setSelectedOpportunityId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">不关联商机</option>
                  {opportunities.map((opp: any) => (
                    <option key={opp.id} value={opp.id}>{opp.name} · {opp.stage}</option>
                  ))}
                </select>
              </div>
            )}
            <Textarea
              className="resize-none h-28 text-sm mb-3"
              placeholder={selectedClientId
                ? "粘贴或输入原始情报信号...\n\n或从右侧新闻列表点击\u300c用作信号\u300d自动填入"
                : "请先选择目标客户"}
              value={signalInput}
              onChange={(e) => { setSignalInput(e.target.value); setSelectedNewsItem(null); }}
              disabled={!selectedClientId}
            />
            <Button
              className="w-full gap-2"
              onClick={handleAnalyze}
              disabled={!selectedClientId || !signalInput.trim() || analyzing}
            >
              <Send className="w-4 h-4" />
              {analyzing ? "AI解读中..." : "AI解读信号"}
            </Button>
          </div>

          {/* Latest AI Result */}
          {latestResult && (
            <div className="bg-card border border-primary/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-medium">AI 解读结果</span>
                <span className={cn("text-xs px-2 py-0.5 rounded border", urgencyColor[latestResult.urgency])}>
                  紧迫度：{latestResult.urgency}
                </span>
              </div>
              <div className={cn("inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded border mb-3", signalTypeColor[latestResult.signalType])}>
                {(() => { const Icon = signalTypeIcon[latestResult.signalType] || HelpCircle; return <Icon className="w-3 h-3" />; })()}
                {latestResult.signalType}
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">信号解读</div>
                  <div className="text-sm text-foreground leading-relaxed">{latestResult.interpretation}</div>
                </div>
                <div className="border-t border-border pt-3">
                  <div className="text-xs text-muted-foreground mb-1">触达建议</div>
                  <div className="text-sm text-foreground leading-relaxed bg-primary/5 rounded-lg p-2 border border-primary/15">{latestResult.recommendation}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: News + Signal History Tabs */}
        <div className="xl:col-span-2">
          {/* Tab switcher */}
          <div className="flex items-center gap-1 mb-3 bg-muted/30 rounded-lg p-1 w-fit">
            <button
              onClick={() => setActiveTab("news")}
              className={cn(
                "text-xs px-3 py-1.5 rounded-md transition-colors font-medium flex items-center gap-1.5",
                activeTab === "news"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Newspaper className="w-3 h-3" />
              外部新闻
              {selectedClientId && newsItems.length > 0 && (
                <span className="text-xs bg-primary/10 text-primary px-1 rounded">{newsItems.length}</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("signals")}
              className={cn(
                "text-xs px-3 py-1.5 rounded-md transition-colors font-medium flex items-center gap-1.5",
                activeTab === "signals"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Radio className="w-3 h-3" />
              情报记录
              {(selectedClientId ? signals : allSignals).length > 0 && (
                <span className="text-xs bg-primary/10 text-primary px-1 rounded">
                  {selectedClientId ? signals.length : allSignals.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("compliance" as any)}
              className={cn(
                "text-xs px-3 py-1.5 rounded-md transition-colors font-medium flex items-center gap-1.5",
                activeTab === "compliance"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Shield className="w-3 h-3 text-purple-400" />
              合规政策动态
              {complianceItems.length > 0 && (
                <span className="text-xs bg-purple-500/10 text-purple-400 px-1 rounded border border-purple-500/20">{complianceItems.length}</span>
              )}
            </button>
          </div>

          {/* News Tab */}
          {activeTab === "news" && (
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Rss className="w-4 h-4 text-primary" />
                  {selectedClient ? `${selectedClient.name} · 外部新闻` : "请先选择客户"}
                </div>
                {selectedClientId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => refetchNews()}
                    disabled={fetchingNews}
                  >
                    <RefreshCw className={cn("w-3 h-3", fetchingNews && "animate-spin")} />
                    刷新
                  </Button>
                )}
              </div>

              {!selectedClientId ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Newspaper className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <div className="text-sm">请先选择目标客户</div>
                  <div className="text-xs mt-1">选择客户后自动抓取最新外部新闻</div>
                </div>
              ) : fetchingNews ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin opacity-50" />
                  <div className="text-sm">正在抓取最新新闻...</div>
                  <div className="text-xs mt-1">来源：Google News + 自定义 RSS</div>
                </div>
              ) : newsItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Newspaper className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <div className="text-sm">暂无相关新闻</div>
                  <div className="text-xs mt-1">可在 <Link href="/settings" className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2">系统设置</Link> 中添加自定义 RSS 信息源</div>
                </div>
              ) : (
                <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                  {newsItems.map((item, i) => (
                    <div key={i} className="border border-border rounded-lg p-3 hover:border-muted-foreground/40 transition-colors group">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="text-sm font-medium text-foreground leading-snug line-clamp-2 flex-1">
                          {item.title}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                          {item.link && (
                            <a
                              href={item.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-primary transition-colors"
                              title="打开原文"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                      {item.description && (
                        <div className="text-xs text-muted-foreground line-clamp-2 mb-2">{item.description}</div>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground/70 flex items-center gap-1">
                            <Rss className="w-2.5 h-2.5" />
                            {item.source}
                          </span>
                          {item.pubDate && (
                            <span className="text-xs text-muted-foreground/70 flex items-center gap-1">
                              <Calendar className="w-2.5 h-2.5" />
                              {formatPubDate(item.pubDate)}
                            </span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs px-2 text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleUseAsSignal(item)}
                        >
                          用作信号 →
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Signal History Tab */}
          {activeTab === "signals" && (
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-semibold text-foreground">
                  {selectedClientId ? `${selectedClient?.name} · 情报历史` : "全部客户情报流"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {selectedClientId ? signals.length : allSignals.length} 条记录
                </div>
              </div>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {(selectedClientId ? signals : allSignals).length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Radio className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <div className="text-sm">暂无情报信号</div>
                    <div className="text-xs mt-1">从「外部新闻」Tab 选择新闻点击「用作信号」，或手动输入后点击「AI解读信号」</div>
                  </div>
                ) : (
                  (selectedClientId ? signals : allSignals).map((signal) => {
                    const Icon = signalTypeIcon[signal.signalType] || HelpCircle;
                    const clientName = clients.find(c => c.id === signal.clientId)?.name;
                    return (
                      <div key={signal.id} className="border border-border rounded-lg p-3 hover:border-muted-foreground/50 transition-colors">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {!selectedClientId && clientName && (
                              <span className="text-xs font-medium text-primary">{clientName}</span>
                            )}
                            <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border", signalTypeColor[signal.signalType])}>
                              <Icon className="w-3 h-3" />
                              {signal.signalType}
                            </span>
                           <span className={cn("text-xs px-1.5 py-0.5 rounded border", urgencyColor[signal.urgency])}>
                             {signal.urgency}
                           </span>
                           {(signal as any).opportunityId && (
                             <span className="text-xs px-1.5 py-0.5 rounded border bg-cyan-500/15 text-cyan-400 border-cyan-500/30 font-medium">
                               🎯 商机窗口
                             </span>
                           )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-xs text-muted-foreground">
                              {new Date(signal.createdAt).toLocaleDateString("zh-CN")}
                            </span>
                            <button
                              onClick={() => setConfirmDeleteSignalId(signal.id)}
                              className="p-1 rounded hover:bg-red-500/10 text-muted-foreground/50 hover:text-red-400 transition-colors"
                              title="删除此信号"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mb-2 line-clamp-2">{signal.rawSignal}</div>
                        {signal.aiInterpretation && (
                          <div className="text-xs text-foreground mb-1.5 leading-relaxed">{signal.aiInterpretation}</div>
                        )}
                        {signal.aiRecommendation && (
                          <div className="text-xs text-primary/80 bg-primary/5 rounded p-2 border border-primary/15 leading-relaxed">
                            💡 {signal.aiRecommendation}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
          {/* Compliance Tab */}
          {activeTab === "compliance" && (
            <div className="bg-card border border-purple-500/20 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Shield className="w-4 h-4 text-purple-400" />
                  港澳 + 东南亚合规政策动态
                  <span className="text-xs text-muted-foreground font-normal">PCPD · PDPC · JPDP · Kominfo · NPC · CSA ...</span>
                </div>
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs"
                  onClick={() => refetchCompliance()} disabled={fetchingCompliance}>
                  <RefreshCw className={cn("w-3 h-3", fetchingCompliance && "animate-spin")} />刷新
                </Button>
              </div>
              {fetchingCompliance ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin opacity-50" />
                  <div className="text-sm">正在抓取合规政策动态...</div>
                </div>
              ) : complianceItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <div className="text-sm">暂无合规政策动态</div>
                  <div className="text-xs mt-1">请检查系统设置中的合规政策 RSS 源是否已启用</div>
                </div>
              ) : (
                <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                  {complianceItems.map((item: any, i: number) => (
                    <div key={i} className="border border-purple-500/10 rounded-lg p-3 hover:border-purple-500/30 transition-colors group">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="text-sm font-medium text-foreground leading-snug line-clamp-2 flex-1">{item.title}</div>
                        {item.link && (
                          <a href={item.link} target="_blank" rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-purple-400 transition-colors flex-shrink-0 mt-0.5" title="打开原文">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                      {item.description && (
                        <div className="text-xs text-muted-foreground line-clamp-2 mb-2">{item.description}</div>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-purple-400/70 flex items-center gap-1">
                            <Shield className="w-2.5 h-2.5" />{item.source}
                          </span>
                          {item.pubDate && (
                            <span className="text-xs text-muted-foreground/70 flex items-center gap-1">
                              <Calendar className="w-2.5 h-2.5" />{formatPubDate(item.pubDate)}
                            </span>
                          )}
                        </div>
                        <Button variant="ghost" size="sm"
                          className="h-6 text-xs px-2 text-purple-400 hover:bg-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleUseAsSignal(item)}>
                          用作信号 →
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>


      {/* Delete Signal Confirmation Dialog */}
      <Dialog open={confirmDeleteSignalId !== null} onOpenChange={(open) => { if (!open) setConfirmDeleteSignalId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <Trash2 className="w-4 h-4" />
              确认删除情报信号
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-muted-foreground">此操作不可撤销，该条情报信号及其 AI 解读将被永久删除。</p>
          </div>
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmDeleteSignalId(null)}>取消</Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deletingSignalId !== null}
              onClick={() => {
                if (confirmDeleteSignalId) {
                  setDeletingSignalId(confirmDeleteSignalId);
                  deleteSignal.mutate({ id: confirmDeleteSignalId });
                }
              }}
            >
              {deletingSignalId !== null ? "删除中..." : "确认删除"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
