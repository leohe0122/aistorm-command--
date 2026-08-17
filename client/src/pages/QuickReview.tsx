import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

const ZERO_TO_ONE_STAGES = ["建图", "进门", "定痛", "找人"];

export default function QuickReview() {
  const { data: clients = [] } = trpc.clients.list.useQuery();
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [selectedOppId, setSelectedOppId] = useState<number | null>(null);
  const [reviewContent, setReviewContent] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<any>(null);

  const { data: reviewHistory = [] } = trpc.insights.getLatestReviews.useQuery(
    { clientId: selectedClientId! },
    { enabled: !!selectedClientId }
  );

  const selectedClient = clients.find(c => c.id === selectedClientId);
  const is0to1 = selectedClient ? ZERO_TO_ONE_STAGES.includes(selectedClient.stage) : false;

  const { data: opps = [] } = trpc.opportunities.listByClient.useQuery(
    { clientId: selectedClientId! },
    { enabled: !!selectedClientId && !is0to1 }
  );

  const reviewZeroToOne = trpc.insights.reviewZeroToOne.useMutation();
  const reviewOneToN = trpc.insights.reviewOneToN.useMutation();
  const reviewBuyingGroup = trpc.insights.reviewBuyingGroup.useMutation();
  const reviewVisitTrend = trpc.insights.reviewVisitTrend.useMutation();

  const handleReview = async (type: "0to1" | "1toN" | "buyingGroup" | "visitTrend") => {
    if (!selectedClientId || !selectedClient) return;
    setReviewLoading(true);
    setReviewContent("");
    try {
      let result: any;
      if (type === "0to1") {
        result = await reviewZeroToOne.mutateAsync({ clientId: selectedClientId });
        setReviewContent(result.content);
      } else if (type === "1toN") {
        if (!selectedOppId) { toast.error("请先选择商机"); setReviewLoading(false); return; }
        result = await reviewOneToN.mutateAsync({ clientId: selectedClientId, opportunityId: selectedOppId });
        setReviewContent(result.content);
      } else if (type === "buyingGroup") {
        result = await reviewBuyingGroup.mutateAsync({ clientId: selectedClientId });
        setReviewContent(result.content);
      } else if (type === "visitTrend") {
        result = await reviewVisitTrend.mutateAsync({ clientId: selectedClientId });
        setReviewContent(result.content || result.narrativeUpdate || "");
      }
    } catch (e: any) {
      toast.error("生成失败：" + (e?.message || "未知错误"));
    } finally {
      setReviewLoading(false);
    }
  };

  const handleCopy = () => {
    const plain = reviewContent.replace(/#{1,6}\s/g, '').replace(/\*\*/g, '').replace(/\*/g, '').replace(/^[-•▸]\s/gm, '').replace(/`/g, '');
    navigator.clipboard.writeText(plain);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">⚡ 快速 Review</h1>
          <p className="text-sm text-muted-foreground mt-1">选择客户，一键生成 AI Review，无需进入战场地图</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-6">

        {/* Client Selector */}
        <div className="p-4 bg-card border border-border rounded-xl space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">选择客户</label>
            <select
              value={selectedClientId ?? ""}
              onChange={e => { setSelectedClientId(Number(e.target.value) || null); setSelectedOppId(null); setReviewContent(""); }}
              className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">-- 请选择客户 --</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}（{c.stage}）
                </option>
              ))}
            </select>
          </div>

          {selectedClient && (
            <div className="flex items-center gap-2 text-xs">
              <span className={`px-2 py-0.5 rounded font-medium ${is0to1 ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                {is0to1 ? "0→1 客户开发阶段" : "1→N 商机推进阶段"}
              </span>
              <span className="text-muted-foreground">{selectedClient.stage} · {selectedClient.industry || "未知行业"}</span>
            </div>
          )}

          {/* Opp selector for 1→N */}
          {selectedClient && !is0to1 && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">选择商机（1→N Review 需要）</label>
              <select
                value={selectedOppId ?? ""}
                onChange={e => setSelectedOppId(Number(e.target.value) || null)}
                className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">-- 请选择商机 --</option>
                {(opps as any[]).map((o: any) => (
                  <option key={o.id} value={o.id}>{o.name}（{o.stage}）</option>
                ))}
              </select>
            </div>
          )}

          {/* Review Buttons */}
          {selectedClient && (
            <div className="flex flex-wrap gap-2 pt-1">
              {is0to1 ? (
                <button
                  type="button"
                  disabled={reviewLoading}
                  onClick={() => handleReview("0to1")}
                  className="px-4 py-2 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  🔍 0→1 关系推进 Review
                </button>
              ) : (
                <button
                  type="button"
                  disabled={reviewLoading || !selectedOppId}
                  onClick={() => handleReview("1toN")}
                  className="px-4 py-2 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  🎯 1→N 赢单 Review
                </button>
              )}
              <button
                type="button"
                disabled={reviewLoading}
                onClick={() => handleReview("buyingGroup")}
                className="px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 text-sm font-medium disabled:opacity-50 transition-colors"
              >
                👥 Buying Group 分析
              </button>
              <button
                type="button"
                disabled={reviewLoading}
                onClick={() => handleReview("visitTrend")}
                className="px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 text-sm font-medium disabled:opacity-50 transition-colors"
              >
                📈 拜访趋势分析
              </button>
            </div>
          )}
        </div>

        {/* Result Area */}
        {(reviewLoading || reviewContent) && (
          <div className="p-4 bg-card border border-border rounded-xl">
            {reviewLoading ? (
              <div className="flex items-center gap-3 py-8 justify-center text-muted-foreground">
                <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">AI 正在分析战局，请稍候...</span>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-muted-foreground">AI Review 结果</span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="text-xs px-3 py-1.5 rounded border border-border hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {copied ? "✓ 已复制" : "📋 复制（纯文本）"}
                  </button>
                </div>
                <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed">
                  <ReactMarkdown
                    components={{
                      h1: ({children}) => <h1 className="text-base font-bold text-purple-300 mt-4 mb-2">{children}</h1>,
                      h2: ({children}) => <h2 className="text-sm font-semibold text-cyan-300 mt-3 mb-1.5 border-b border-border/30 pb-1">{children}</h2>,
                      h3: ({children}) => <h3 className="text-sm font-medium text-foreground mt-2 mb-1">{children}</h3>,
                      p: ({children}) => <p className="text-sm text-foreground/90 mb-2 leading-relaxed">{children}</p>,
                      li: ({children}) => <li className="text-sm text-foreground/80 mb-1">{children}</li>,
                      strong: ({children}) => <strong className="text-yellow-300 font-semibold">{children}</strong>,
                      blockquote: ({children}) => <blockquote className="border-l-2 border-purple-500 pl-3 my-2 text-muted-foreground italic">{children}</blockquote>,
                    }}
                  >
                    {reviewContent}
                  </ReactMarkdown>
                </div>
              </>
            )}
          </div>
        )}

        {/* Empty state */}
        {!selectedClient && (
          <div className="text-center py-16 text-muted-foreground">
            <div className="text-4xl mb-3">⚡</div>
            <p className="text-sm">选择一个客户，即可快速生成 AI Review</p>
            <p className="text-xs mt-1 text-muted-foreground/60">无需进入战场地图，2步完成 Review</p>
          </div>
        )}
        </div>

        {/* Right: History Review Panel */}
        <div className="xl:col-span-1">
          {selectedClientId && (reviewHistory as any[]).length > 0 ? (
            <div className="bg-card border border-border rounded-xl overflow-hidden sticky top-4">
              <button
                onClick={() => setHistoryOpen(h => !h)}
                className="flex items-center justify-between w-full px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted/30 transition-colors"
              >
                <span className="flex items-center gap-2">
                  🕐 历史 Review
                  <span className="text-xs font-normal text-muted-foreground">({(reviewHistory as any[]).length} 条)</span>
                </span>
                <span className={cn("text-muted-foreground transition-transform text-xs", historyOpen && "rotate-180")}>▼</span>
              </button>
              {historyOpen && (
                <div className="border-t border-border divide-y divide-border/30 max-h-[480px] overflow-y-auto">
                  {(reviewHistory as any[]).map((r: any) => (
                    <button
                      key={r.id}
                      onClick={() => { setSelectedHistory(r); setReviewContent(r.content); }}
                      className={cn(
                        "w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors",
                        selectedHistory?.id === r.id && "bg-primary/5 border-l-2 border-primary"
                      )}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium",
                          r.reviewType === "0to1" ? "bg-purple-500/20 text-purple-400" :
                          r.reviewType === "1toN" ? "bg-blue-500/20 text-blue-400" :
                          r.reviewType === "buyingGroup" ? "bg-cyan-500/20 text-cyan-400" :
                          "bg-emerald-500/20 text-emerald-400"
                        )}>
                          {r.reviewType === "0to1" ? "0→1" : r.reviewType === "1toN" ? "1→N" : r.reviewType === "buyingGroup" ? "BG" : "趋势"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(r.createdAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground/80 line-clamp-2">{r.content?.slice(0, 80)}...</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : selectedClientId ? (
            <div className="bg-card border border-border rounded-xl p-4 text-center text-muted-foreground">
              <div className="text-2xl mb-2">📋</div>
              <p className="text-xs">暂无历史 Review</p>
              <p className="text-xs mt-1 text-muted-foreground/60">生成第一次 Review 后将在此显示</p>
            </div>
          ) : null}
        </div>
        </div>
      </div>
    </div>
  );
}
