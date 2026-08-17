import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TrendingUp, RefreshCw, AlertTriangle, CheckCircle, AlertCircle, Sparkles, Zap, BarChart3, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Streamdown } from "streamdown";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";
import { TermTooltip } from "@/components/TermTooltip";

const riskColor: Record<string, { bg: string; text: string; border: string; icon: any; hex: string }> = {
  "低风险": { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/30", icon: CheckCircle, hex: "#22c55e" },
  "中风险": { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/30", icon: AlertCircle, hex: "#eab308" },
  "高风险": { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30", icon: AlertTriangle, hex: "#ef4444" },
};

const stageColor: Record<string, string> = {
  "建图": "text-muted-foreground",
  "进门": "text-blue-400",
  "定痛": "text-yellow-400",
  "找人": "text-orange-400",
  "进入商机": "text-primary",
};

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = size * 0.4;
  const circumference = 2 * Math.PI * r;
  const strokeDasharray = `${(score / 100) * circumference} ${circumference}`;
  const color = score >= 50 ? "#22c55e" : score >= 25 ? "#eab308" : "#ef4444";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={size * 0.08} className="text-muted/30" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={size * 0.08}
        strokeDasharray={strokeDasharray}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize={size * 0.22} fontWeight="bold" fill="white">{score}</text>
    </svg>
  );
}

// Custom tooltip for the comparison chart
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 text-xs shadow-lg">
        <div className="font-semibold text-foreground mb-2">{label}</div>
        {payload.map((entry: any) => (
          <div key={entry.name} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
            <span className="text-muted-foreground">{entry.name}：</span>
            <span className="text-foreground font-mono">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

function ClientPredictionCard({ client, triggerAnalyze, onScoreLoaded }: { client: any; triggerAnalyze?: boolean; onScoreLoaded?: (clientId: number, score: any) => void }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const { data: score, refetch } = trpc.prediction.getLatest.useQuery({ clientId: client.id });
  // Report score to parent for comparison chart
  useEffect(() => { if (score !== undefined) onScoreLoaded?.(client.id, score); }, [score, client.id]);
  const { data: meddpicc } = trpc.meddpicc.get.useQuery({ clientId: client.id });
  const { data: signals = [] } = trpc.intelligence.listByClient.useQuery({ clientId: client.id });

  const analyze = trpc.prediction.analyze.useMutation({
    onSuccess: () => {
      refetch();
      toast.success(`${client.name} 商机温度已更新`);
      setAnalyzing(false);
    },
    onError: () => {
      toast.error(`${client.name} 分析失败`);
      setAnalyzing(false);
    },
  });

  const handleAnalyze = () => {
    if (!meddpicc) { toast.error("请先完善MEDDPICC数据"); return; }
    setAnalyzing(true);
    analyze.mutate({
      clientId: client.id,
      clientName: client.name,
      industry: client.industry ?? "",
      stage: client.stage,
      meddpicc: {
        metricsScore: meddpicc.metricsScore,
        economicBuyerScore: meddpicc.economicBuyerScore,
        decisionCriteriaScore: meddpicc.decisionCriteriaScore,
        decisionProcessScore: meddpicc.decisionProcessScore,
        paperProcessScore: meddpicc.paperProcessScore,
        implicatePainScore: meddpicc.implicatePainScore,
        championScore: meddpicc.championScore,
        competitionScore: meddpicc.competitionScore,
      },

      visitCount: (client as any).visitCount ?? 0,
      lastVisitDate: (client as any).lastVisitDate ? new Date((client as any).lastVisitDate).toISOString() : null,
    });
  };

  const riskInfo = score ? riskColor[score.riskLevel] : null;
  const RiskIcon = riskInfo?.icon || AlertCircle;

  return (
    <div className={cn(
      "bg-card border rounded-xl overflow-hidden transition-all",
      score ? riskInfo?.border : "border-border"
    )}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground">{client.name}</h3>
              <span className={cn("text-xs", stageColor[client.stage])}>{client.stage}</span>
            </div>
            <div className="text-xs text-muted-foreground">{client.industry}</div>
          </div>

          <div className="flex-shrink-0">
            {score ? (
              <ScoreRing score={score.overallScore} size={72} />
            ) : (
              <div className="w-[72px] h-[72px] rounded-full border-2 border-dashed border-border flex items-center justify-center">
                <span className="text-xs text-muted-foreground text-center leading-tight">未<br/>评分</span>
              </div>
            )}
          </div>
        </div>

        {score && (
          <div className="mt-3 space-y-2">
            <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border", riskInfo?.bg, riskInfo?.border)}>
              <RiskIcon className={cn("w-4 h-4", riskInfo?.text)} />
              <span className={cn("text-sm font-semibold", riskInfo?.text)}>{score.riskLevel}</span>
              <div className="ml-auto flex gap-3 text-xs text-muted-foreground">
                <span>MEDDPICC: <span className="text-foreground font-mono">{score.meddpiccScore}</span></span>
                <span className={(score as any).visitFrequencyScore === 0 ? "text-red-400" : (score as any).visitFrequencyScore >= 75 ? "text-green-400" : "text-yellow-400"}>
                  拜访频率: <span className="font-mono">{(score as any).visitFrequencyScore ?? 0}</span>
                </span>
              </div>
            </div>

            {/* Visit frequency explanation */}
            {(score as any).visitFrequencyScore !== undefined && (
              <div className={cn(
                "flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-md",
                (score as any).visitFrequencyScore === 0
                  ? "bg-red-500/10 text-red-400"
                  : (score as any).visitFrequencyScore >= 75
                    ? "bg-green-500/10 text-green-400"
                    : "bg-yellow-500/10 text-yellow-400"
              )}>
                <Calendar className="w-3 h-3 flex-shrink-0" />
                <span>
                  拜访频率：
                  {(score as any).visitFrequencyScore === 0
                    ? "从未拜访，建议尽快安排首次拜访"
                    : (score as any).visitFrequencyScore >= 75
                      ? "拜访频率良好（最近 14 天内有拜访）"
                      : (score as any).visitFrequencyScore >= 50
                        ? "拜访频率一般（15-30 天内有拜访）"
                        : "拜访间隔过长（31-60 天未拜访），建议尽快跟进"}
                </span>
              </div>
            )}

            {score.warnings && (score.warnings as string[]).length > 0 && (
              <div className="space-y-1">
                {(score.warnings as string[]).map((w, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs text-yellow-400/80">
                    <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    {w}
                  </div>
                ))}
              </div>
            )}

            {score.aiAnalysis && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                {expanded ? "收起AI分析" : "查看AI分析"}
              </button>
            )}

            {expanded && score.aiAnalysis && (
              <div className="bg-muted/10 rounded-lg p-3 border border-border">
                <div className="prose prose-sm prose-invert max-w-none text-xs">
                  <Streamdown>{score.aiAnalysis}</Streamdown>
                </div>
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              上次分析：{new Date(score.createdAt).toLocaleDateString("zh-CN")}
            </div>
          </div>
        )}

        <Button
          size="sm"
          className="w-full mt-3 gap-2 h-8"
          variant={score ? "outline" : "default"}
          onClick={handleAnalyze}
          disabled={analyzing}
        >
          <RefreshCw className={cn("w-3 h-3", analyzing && "animate-spin")} />
          {analyzing ? "AI分析中..." : score ? "重新分析" : "AI分析商机温度"}
        </Button>
      </div>
    </div>
  );
}

// Comparison chart component
function ComparisonChart({ clients, scores }: { clients: any[]; scores: Record<number, any> }) {
  const chartData = clients.map(c => {
    const s = scores[c.id];
    return {
      name: c.name.length > 4 ? c.name.slice(0, 4) : c.name,
      fullName: c.name,
      总分: s?.overallScore ?? 0,
      MEDDPICC: s?.meddpiccScore ?? 0,
      拜访频率: s?.visitFrequencyScore ?? 0,
      riskLevel: s?.riskLevel ?? "未评分",
    };
  });

  const getBarColor = (riskLevel: string) => {
    if (riskLevel === "低风险") return "#22c55e";
    if (riskLevel === "中风险") return "#eab308";
    if (riskLevel === "高风险") return "#ef4444";
    return "#4b5563";
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-4 h-4 text-primary" />
        <div className="text-sm font-semibold text-foreground">5户客户商机温度横向对比</div>
        <div className="ml-auto text-xs text-muted-foreground">绿色=低风险 · 黄色=中风险 · 红色=高风险 · 灰色=未评分</div>
      </div>
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2030" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <Bar dataKey="总分" radius={[4, 4, 0, 0]} maxBarSize={48}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.riskLevel)} fillOpacity={0.85} />
              ))}
            </Bar>
            <Bar dataKey="MEDDPICC" fill="#6366f1" fillOpacity={0.5} radius={[3, 3, 0, 0]} maxBarSize={48} />
            <Bar dataKey="拜访频率" fill="#06b6d4" fillOpacity={0.4} radius={[3, 3, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Ranking */}
      <div className="mt-3 flex gap-2 flex-wrap">
        {[...clients]
          .sort((a, b) => (scores[b.id]?.overallScore ?? 0) - (scores[a.id]?.overallScore ?? 0))
          .map((c, idx) => {
            const s = scores[c.id];
            const ri = s ? riskColor[s.riskLevel] : null;
            return (
              <div key={c.id} className={cn(
                "flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border",
                ri ? `${ri.bg} ${ri.border}` : "bg-muted/20 border-border"
              )}>
                <span className="text-muted-foreground font-mono">#{idx + 1}</span>
                <span className={ri?.text || "text-muted-foreground"}>{c.name}</span>
                <span className="font-mono font-bold">{s?.overallScore ?? "—"}</span>
              </div>
            );
          })}
      </div>
    </div>
  );
}

export default function OpportunityPrediction() {
  const { data: clients = [], isLoading } = trpc.clients.list.useQuery();
  const [scoringAll, setScoringAll] = useState(false);
  const [scoredCount, setScoredCount] = useState(0);

  const utils = trpc.useUtils();

  const analyzeAll = trpc.prediction.analyze.useMutation({
    onSuccess: (_, variables) => {
      utils.prediction.getLatest.invalidate({ clientId: variables.clientId });
    },
  });

  // latestScores is populated by child components via onScoreLoaded callback
  const [latestScores, setLatestScores] = useState<Record<number, any>>({});

  const handleScoreLoaded = (clientId: number, score: any) => {
    setLatestScores(prev => score ? { ...prev, [clientId]: score } : prev);
  };

  const hasAnyScore = Object.keys(latestScores).length > 0;

  const handleScoreAll = async () => {
    if (scoringAll) return;
    setScoringAll(true);
    setScoredCount(0);

    let completed = 0;
    const promises = clients.map(async (client) => {
      // Fetch meddpicc and signals data fresh for each client
      const [meddpiccResult, signalsResult] = await Promise.all([
        utils.meddpicc.get.fetch({ clientId: client.id }),
        utils.intelligence.listByClient.fetch({ clientId: client.id }),
      ]);
      const meddpicc = meddpiccResult;
      const signals = signalsResult ?? [];
      if (!meddpicc) return;

      try {
        await analyzeAll.mutateAsync({
          clientId: client.id,
          clientName: client.name,
          industry: client.industry ?? undefined,
          stage: client.stage,
          meddpicc: {
            metricsScore: meddpicc.metricsScore,
            economicBuyerScore: meddpicc.economicBuyerScore,
            decisionCriteriaScore: meddpicc.decisionCriteriaScore,
            decisionProcessScore: meddpicc.decisionProcessScore,
            paperProcessScore: meddpicc.paperProcessScore,
            implicatePainScore: meddpicc.implicatePainScore,
            championScore: meddpicc.championScore,
            competitionScore: meddpicc.competitionScore,
          },

          visitCount: (client as any).visitCount ?? 0,
          lastVisitDate: (client as any).lastVisitDate ? new Date((client as any).lastVisitDate).toISOString() : null,
        });
        completed++;
        setScoredCount(completed);
      } catch {
        // individual errors handled per card
      }
    });

    await Promise.allSettled(promises);
    // Refresh all score queries
    clients.forEach(c => utils.prediction.getLatest.invalidate({ clientId: c.id }));
    setScoringAll(false);
    toast.success(`已完成 ${completed}/${clients.length} 户客户商机温度评分`, { duration: 4000 });
  };

  return (
    <div className="p-6">
      <div className="mb-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-bold text-foreground">商机温度预测</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              基于 
              <TermTooltip term="MEDDPICC" label="MEDDPICC" showIcon={true} className="text-muted-foreground" />
               完成度和情报信号频率，AI对每户客户给出商机健康度评分与风险预警
            </p>
          </div>
          <Button
            className="gap-2 shrink-0"
            onClick={handleScoreAll}
            disabled={scoringAll || isLoading}
          >
            <Zap className={cn("w-4 h-4", scoringAll && "animate-pulse")} />
            {scoringAll
              ? `AI评分中 ${scoredCount}/${clients.length}...`
              : "一键全部评分"}
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-5 flex-wrap">
        {Object.entries(riskColor).map(([level, colors]) => {
          const Icon = colors.icon;
          return (
            <div key={level} className={cn("flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border", colors.bg, colors.border)}>
              <Icon className={cn("w-3.5 h-3.5", colors.text)} />
              <span className={colors.text}>{level}</span>
            </div>
          );
        })}
        <div className="text-xs text-muted-foreground flex items-center ml-auto gap-1">
          评分 = <TermTooltip term="MEDDPICC" label="MEDDPICC(80%)" showIcon={false} className="text-muted-foreground" /> + 拜访频率(20%)
        </div>
      </div>

      {/* Comparison Chart - shown when at least one score exists */}
      {hasAnyScore && !isLoading && (
        <div className="mb-5">
          <ComparisonChart clients={clients} scores={latestScores} />
        </div>
      )}

      {/* One-click scoring progress banner */}
      {scoringAll && (
        <div className="mb-4 bg-primary/10 border border-primary/30 rounded-xl p-3 flex items-center gap-3">
          <RefreshCw className="w-4 h-4 text-primary animate-spin" />
          <div>
            <div className="text-sm font-semibold text-primary">AI正在并行评估5户客户商机温度...</div>
            <div className="text-xs text-muted-foreground mt-0.5">已完成 {scoredCount}/{clients.length} 户 · 评分完成后对比图将自动更新</div>
          </div>
          <div className="ml-auto flex gap-1">
            {clients.map((_, i) => (
              <div key={i} className={cn(
                "w-2 h-2 rounded-full transition-colors",
                i < scoredCount ? "bg-green-400" : "bg-muted"
              )} />
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="bg-card border border-border rounded-xl h-40 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {clients.map(client => (
            <ClientPredictionCard key={client.id} client={client} onScoreLoaded={handleScoreLoaded} />
          ))}
        </div>
      )}
    </div>
  );
}
