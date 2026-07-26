import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Shield,
  Target,
  TrendingUp,
  Users,
  Zap,
  Calendar,
  Activity,
  Eye,
  Sparkles,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  PlusCircle,
  FileEdit,
  Clock,
} from "lucide-react";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const STAGE_ORDER = ["建图", "进门", "定痛", "找人", "进入商机"];

const STAGE_COLORS: Record<string, string> = {
  "建图": "bg-slate-500",
  "进门": "bg-blue-500",
  "定痛": "bg-yellow-500",
  "找人": "bg-orange-500",
  "进入商机": "bg-primary",
};

const OPP_STAGE_COLORS: Record<string, string> = {
  "初步需求": "bg-blue-500",
  "需求挖掘": "bg-yellow-500",
  "技术验证": "bg-cyan-500",
  "方案提案": "bg-orange-500",
  "商务谈判": "bg-primary",
  "赢单": "bg-green-500",
  "丢单": "bg-red-500",
};

const MEDDPICC_LABELS: Record<string, string> = {
  metricsScore: "M",
  economicBuyerScore: "E",
  decisionCriteriaScore: "D",
  decisionProcessScore: "D2",
  paperProcessScore: "P",
  implicatePainScore: "I",
  championScore: "C",
  competitionScore: "C2",
};

const MEDDPICC_FULL: Record<string, string> = {
  metricsScore: "Metrics",
  economicBuyerScore: "Economic Buyer",
  decisionCriteriaScore: "Decision Criteria",
  decisionProcessScore: "Decision Process",
  paperProcessScore: "Paper Process",
  implicatePainScore: "Implicate Pain",
  championScore: "Champion",
  competitionScore: "Competition",
};

function MeddpiccBar({ score, label }: { score: number | null; label: string }) {
  const val = score ?? 0;
  const color = val >= 70 ? "bg-green-500" : val >= 40 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="text-[10px] text-muted-foreground w-5 shrink-0 font-mono">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${val}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground w-5 text-right shrink-0">{val}</span>
    </div>
  );
}

function RiskBadge({ reason }: { reason: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-medium">
      <AlertTriangle className="w-2.5 h-2.5" />
      {reason}
    </span>
  );
}

function AnalysisSkeleton() {
  return (
    <div className="px-3 pb-3 space-y-2 border-t border-red-500/10 pt-2">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-14 rounded" />
        <Skeleton className="h-4 w-20 rounded" />
        <Skeleton className="h-4 w-20 rounded" />
      </div>
      <Skeleton className="h-12 w-full rounded" />
      <div className="space-y-1">
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-4 w-4/5 rounded" />
        <Skeleton className="h-4 w-3/5 rounded" />
      </div>
    </div>
  );
}

function RiskClientCard({ c, navigate, isExpanded, onToggle, onExpand }: {
  c: any;
  navigate: (path: string) => void;
  isExpanded: boolean;
  onToggle: () => void;
  onExpand: () => void;
}) {
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [taskRole, setTaskRole] = useState<"AD" | "SAM" | "SA" | "RSM">("AD");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskDueDate, setTaskDueDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10);
  });
  const [visitDate, setVisitDate] = useState(new Date().toISOString().slice(0, 10));
  const [visitKeyPoints, setVisitKeyPoints] = useState("");
  const [visitAttendees, setVisitAttendees] = useState("");

  const utils = trpc.useUtils();
  const { data: latestScore, refetch: refetchScore } = trpc.prediction.getLatest.useQuery({ clientId: c.id });

  // Show cached score in panel when available (no auto-expand — user controls expansion)
  const analyze = trpc.prediction.analyze.useMutation({
    onSuccess: (data) => { setResult(data); onExpand(); setAnalyzing(false); },
    onError: () => { toast.error("分析失败"); setAnalyzing(false); },
  });

  const addTask = trpc.pod.addTask.useMutation({
    onSuccess: () => {
      toast.success("跟进任务已创建，跳转到 POD 协同中枢…");
      setShowTaskDialog(false);
      setTaskTitle("");
      setTaskDesc("");
      utils.dashboard.summary.invalidate();
      // Navigate to POD center so AD can see the newly created task
      setTimeout(() => navigate('/pod-center'), 800);
    },
    onError: () => toast.error("创建任务失败"),
  });

  const quickLog = trpc.meetings.quickLog.useMutation({
    onSuccess: async () => {
      toast.success("拜访日志已录入，刷新健康度评分…");
      setShowVisitForm(false);
      setVisitKeyPoints("");
      setVisitAttendees("");
      // re-run AI analysis with updated visit count and date
      analyze.mutate(buildAnalyzePayload((c.visitCount ?? 0) + 1, new Date(visitDate).toISOString()));
      utils.dashboard.summary.invalidate();
    },
    onError: () => toast.error("录入失败"),
  });

  const score = result ?? latestScore;

  const buildAnalyzePayload = (extraVisitCount?: number, extraLastVisitDate?: string) => {
    const meddpicc = c.meddpiccDetails;
    const isOppStage = c.stage === '进入商机';
    return {
      clientId: c.id,
      clientName: c.name,
      industry: c.industry ?? "",
      stage: c.stage,
      meddpicc: {
        metricsScore: meddpicc?.metricsScore ?? 0,
        economicBuyerScore: meddpicc?.economicBuyerScore ?? 0,
        decisionCriteriaScore: meddpicc?.decisionCriteriaScore ?? 0,
        decisionProcessScore: meddpicc?.decisionProcessScore ?? 0,
        paperProcessScore: meddpicc?.paperProcessScore ?? 0,
        implicatePainScore: meddpicc?.implicatePainScore ?? 0,
        championScore: meddpicc?.championScore ?? 0,
        competitionScore: meddpicc?.competitionScore ?? 0,
      },
      visitCount: extraVisitCount ?? c.visitCount ?? 0,
      lastVisitDate: extraLastVisitDate ?? (c.lastVisitDate ? new Date(c.lastVisitDate).toISOString() : null),
      visitQuality: c.visitQuality ? {
        totalVisits: extraVisitCount ?? c.visitQuality.totalVisits,
        aiMinutesCount: c.visitQuality.aiMinutesCount,
        transcriptCount: c.visitQuality.transcriptCount,
        recentKeyPoints: c.visitQuality.recentKeyPoints,
      } : undefined,
      // 进入商机阶段额外字段
      oppStageDistribution: isOppStage ? (c.oppStageDistribution ?? undefined) : undefined,
      oppCount: isOppStage ? (c.oppCount ?? undefined) : undefined,
      // 0→1 阶段额外字段
      stageDwellDays: !isOppStage ? (c.stageDwellDays ?? undefined) : undefined,
    };
  };

  const handleAnalyze = () => {
    setAnalyzing(true);
    onExpand();
    analyze.mutate(buildAnalyzePayload());
  };

  // Smart role assignment based on warning content
  // Role assignment rules:
  // SAM is the DEFAULT owner for almost all risks — SAM drives MEDDPICC, arranges AD appearances,
  // manages champion, visit frequency, budget/decision-process clarification, and C-Level prep.
  // AD only owns tasks when strategic value delivery is needed AND champion is already in place.
  // SA owns technical/POC/architecture risks.
  // RSM owns tender/channel/regional risks.
  const inferRole = (warning: string): "AD" | "SAM" | "SA" | "RSM" => {
    const w = warning;
    if (/技术方案|poc|架构设计|竞品技术|售前工程师|技术验证/.test(w)) return 'SA';
    if (/招投标|属地化|渠道商|省办|商务谈判|商务条款/.test(w)) return 'RSM';
    // AD only for top-level strategic value delivery (rare, requires champion already established)
    if (/顶层战略价值/.test(w) && !/尚未|未确认|弱|低分|不明/.test(w)) return 'AD';
    // Everything else goes to SAM (MEDDPICC, champion, visits, C-Level arrangement, budget, pipeline)
    return 'SAM';
  };

  const handleCreateTasks = () => {
    if (!score?.warnings?.length) return;
    // Extract a short title from the first warning (take text before first '：' or first 50 chars)
    const firstWarning: string = score.warnings[0] || '';
    const shortTitle = firstWarning.includes('：')
      ? firstWarning.split('：')[0].replace(/^\s*风险\d+\s*[—\-]*\s*/, '').slice(0, 80)
      : firstWarning.slice(0, 80);
    setTaskTitle(shortTitle || '跟进客户风险项');
    // Auto-assign role based on first warning content
    setTaskRole(inferRole(firstWarning));
    // Put all warnings as description for reference
    setTaskDesc((score.warnings as string[]).join('\n\n'));
    setShowTaskDialog(true);
  };

  return (
    <>
      <div className="rounded-lg bg-red-500/5 border border-red-500/20 overflow-hidden isolate">
        <div className="flex items-center justify-between p-2">
          <div className="min-w-0 flex-1 cursor-pointer" onClick={() => navigate(`/battle-map?clientId=${c.id}`)}>
            <div className="text-sm font-medium truncate">{c.name}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Badge variant="outline" className="text-[10px] px-1 py-0">{c.stage}</Badge>
              <RiskBadge reason={c.riskReason} />
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
            <div className="text-right min-w-[44px]">
              <div className={`text-sm font-bold ${c.meddpiccAvg < 30 ? "text-red-400" : "text-yellow-400"}`}>{c.meddpiccAvg}</div>
              <div className="text-[10px] text-muted-foreground">avg</div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[10px] gap-1 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
              onClick={handleAnalyze}
              disabled={analyzing}
            >
              {analyzing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {analyzing ? "分析中" : score ? "重新分析" : "AI分析"}
            </Button>
            {(score || analyzing) && (
              <button onClick={onToggle} className="p-1 text-muted-foreground hover:text-foreground">
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>

        {/* Expanded panel */}
        {isExpanded && (
          <div className="border-t border-red-500/10">
            {analyzing ? (
              <AnalysisSkeleton />
            ) : score ? (
              <div className="px-3 pb-3 space-y-2 pt-2">
                {/* Score summary */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`font-bold px-2 py-0.5 rounded ${
                      score.riskLevel === "高风险" ? "bg-red-500/20 text-red-400" :
                      score.riskLevel === "中风险" ? "bg-yellow-500/20 text-yellow-400" :
                      "bg-green-500/20 text-green-400"
                    }`}>{score.riskLevel}</span>
                    <span className="text-muted-foreground">
                      {c.stage === '进入商机' ? '商机组合健康度' : '客户开发健康度'}
                      <span className="text-foreground font-mono ml-1">{score.overallScore}</span>
                      <span className="text-muted-foreground">/100</span>
                    </span>
                  </div>
                  {score.scoreBreakdown && (
                    <div className="text-[10px] text-muted-foreground/70 leading-relaxed">得分构成：{score.scoreBreakdown}</div>
                  )}
                </div>

                {/* AI analysis text */}
                {score.aiAnalysis && (
                  <div className="text-xs text-muted-foreground leading-relaxed bg-muted/20 rounded p-2">{score.aiAnalysis}</div>
                )}

                {/* Warnings */}
                {score.warnings && (score.warnings as string[]).length > 0 && (
                  <div className="space-y-1">
                    {(score.warnings as string[]).map((w: string, i: number) => (
                      <div key={i} className="flex items-start gap-1.5 text-[11px] text-yellow-400/80">
                        <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />{w}
                      </div>
                    ))}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-7 text-[11px] gap-1.5 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                    onClick={handleCreateTasks}
                    disabled={!score.warnings?.length}
                  >
                    <ClipboardList className="w-3 h-3" />
                    生成跟进任务
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-7 text-[11px] gap-1.5 border-green-500/30 text-green-400 hover:bg-green-500/10"
                    onClick={() => setShowVisitForm(!showVisitForm)}
                  >
                    <FileEdit className="w-3 h-3" />
                    快速录入拜访
                  </Button>
                </div>

                {/* Quick visit log form */}
                {showVisitForm && (
                  <div className="space-y-2 bg-muted/10 rounded-lg p-2.5 border border-border/50">
                    <div className="text-xs font-medium text-foreground">快速录入拜访日志</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground">拜访日期</label>
                        <Input
                          type="date"
                          value={visitDate}
                          onChange={e => setVisitDate(e.target.value)}
                          className="h-7 text-xs mt-0.5"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">参与人</label>
                        <Input
                          placeholder="如：Leo, 客户IT总监"
                          value={visitAttendees}
                          onChange={e => setVisitAttendees(e.target.value)}
                          className="h-7 text-xs mt-0.5"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">拜访要点 *</label>
                      <Textarea
                        placeholder="简要记录本次拜访的关键信息、进展、下一步行动…"
                        value={visitKeyPoints}
                        onChange={e => setVisitKeyPoints(e.target.value)}
                        className="text-xs mt-0.5 min-h-[60px] resize-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 h-7 text-xs"
                        onClick={() => quickLog.mutate({
                          clientId: c.id,
                          meetingDate: visitDate,
                          attendees: visitAttendees || undefined,
                          keyPoints: visitKeyPoints,
                        })}
                        disabled={!visitKeyPoints.trim() || quickLog.isPending}
                      >
                        {quickLog.isPending ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : null}
                        确认录入并刷新评分
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowVisitForm(false)}>取消</Button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Task creation dialog */}
      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <ClipboardList className="w-4 h-4 text-cyan-400" />
              生成跟进任务 — {c.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <label className="text-xs text-muted-foreground">责任角色</label>
              <Select value={taskRole} onValueChange={(v) => setTaskRole(v as any)}>
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AD">AD — 大客户经理</SelectItem>
                  <SelectItem value="SAM">SAM — 客户经理</SelectItem>
                  <SelectItem value="SA">SA — 售前工程师</SelectItem>
                  <SelectItem value="RSM">RSM — 区域销售总监</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">任务标题 *</label>
              <Input
                value={taskTitle}
                onChange={e => setTaskTitle(e.target.value)}
                placeholder="输入任务标题"
                className="h-8 text-xs mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">截止日期</label>
              <Input
                type="date"
                value={taskDueDate}
                onChange={e => setTaskDueDate(e.target.value)}
                className="h-8 text-xs mt-1"
                min={new Date().toISOString().slice(0, 10)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">任务说明（可选）</label>
              <Textarea
                value={taskDesc}
                onChange={e => setTaskDesc(e.target.value)}
                placeholder="详细说明或背景信息"
                className="text-xs mt-1 min-h-[60px] resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowTaskDialog(false)}>取消</Button>
            <Button
              size="sm"
              onClick={() => addTask.mutate({ clientId: c.id, assignedRole: taskRole, title: taskTitle, description: taskDesc || undefined, dueDate: taskDueDate || undefined })}
              disabled={!taskTitle.trim() || addTask.isPending}
            >
              {addTask.isPending ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : null}
              创建任务
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function ADDashboard() {
  const [, navigate] = useLocation();
  const [activeRiskClientId, setActiveRiskClientId] = useState<number | null>(null);
  const { data, isLoading } = trpc.dashboard.summary.useQuery();
  // Load pending tasks from all roles to build pending-task opportunity set
  const { data: adTasks } = trpc.pod.listByRole.useQuery({ role: "AD" });
  const { data: samTasks } = trpc.pod.listByRole.useQuery({ role: "SAM" });
  const { data: saTasks } = trpc.pod.listByRole.useQuery({ role: "SA" });
  const { data: rsmTasks } = trpc.pod.listByRole.useQuery({ role: "RSM" });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>暂无数据</p>
      </div>
    );
  }

  const totalClients = data.clientCount;
  const visitedCount = data.visitedThisWeekCount;
  const riskCount = data.riskClients.length;
  const p0Clients = data.clients.filter(c => c.priority === "P0");
  const avgMeddpicc = data.clients.length > 0
    ? Math.round(data.clients.reduce((sum, c) => sum + c.meddpiccAvg, 0) / data.clients.length)
    : 0;

  // Sort clients by MEDDPICC avg desc for health matrix
  const sortedClients = [...data.clients].sort((a, b) => b.meddpiccAvg - a.meddpiccAvg);

  // Build set of opportunity IDs that have pending tasks
  const pendingTaskOppIds = new Set<number>();
  const pendingTaskOppMap = new Map<number, { count: number; roles: string[] }>();
  for (const tasks of [adTasks, samTasks, saTasks, rsmTasks]) {
    if (!tasks) continue;
    for (const t of tasks as any[]) {
      if (!t.isCompleted && t.opportunityId) {
        pendingTaskOppIds.add(t.opportunityId);
        const existing = pendingTaskOppMap.get(t.opportunityId) || { count: 0, roles: [] };
        existing.count++;
        if (!existing.roles.includes(t.assignedRole)) existing.roles.push(t.assignedRole);
        pendingTaskOppMap.set(t.opportunityId, existing);
      }
    }
  }


  // 季度数据导出函数
  const exportQuarterlyReport = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
    const dimLabels = ["M", "E", "D", "D2", "P", "I", "C", "C2"];
    const dimFull = ["Metrics", "Economic Buyer", "Decision Criteria", "Decision Process", "Paper Process", "Implicate Pain", "Champion", "Competition"];

    let md = `# AIStorm Command 季度战情报告\n\n`;
    md += `**导出时间：** ${dateStr}  \n`;
    md += `**汇报人：** AD 指挥台自动导出\n\n---\n\n`;

    // 1. 客户健康度总览
    md += `## 一、客户健康度总览\n\n`;
    md += `| 客户 | 优先级 | 阶段 | MEDDPICC均分 | 拜访次数 | 风险状态 |\n`;
    md += `|---|---|---|---|---|---|\n`;
    for (const c of sortedClients) {
      const isRisk = data.riskClients.some((r: any) => r.id === c.id);
      md += `| ${c.name} | ${c.priority} | ${c.stage} | ${c.meddpiccAvg} | ${(c as any).visitCount ?? 0} | ${isRisk ? "⚠ 高风险" : "正常"} |\n`;
    }
    md += `\n**全组 MEDDPICC 均分：${avgMeddpicc} / 100**\n\n---\n\n`;

    // 2. MEDDPICC 矩阵
    md += `## 二、MEDDPICC 健康度矩阵\n\n`;
    md += `| 客户 | ${dimLabels.join(" | ")} |\n`;
    md += `|---|${dimLabels.map(() => "---").join("|")}|\n`;
    for (const c of sortedClients) {
      const scores = (c as any).meddpiccScores || {};
      const keys = ["metricsScore","economicBuyerScore","decisionCriteriaScore","decisionProcessScore","paperProcessScore","implicatePainScore","championScore","competitionScore"];
      const cells = keys.map(k => {
        const v = scores[k] ?? 0;
        return v >= 3 ? `✅${v}` : v >= 2 ? `🟡${v}` : `🔴${v}`;
      });
      md += `| ${c.name} | ${cells.join(" | ")} |\n`;
    }
    md += `\n*评分说明：✅ 3-4分（健康）/ 🟡 2分（需关注）/ 🔴 0-1分（高风险）*\n\n---\n\n`;

    // 3. 高风险预警
    md += `## 三、高风险预警客户\n\n`;
    if (data.riskClients.length === 0) {
      md += `暂无高风险客户。\n\n`;
    } else {
      for (const r of data.riskClients as any[]) {
        md += `### ${r.name}（${r.stage}）\n`;
        md += `- **风险原因：** ${r.riskReason}\n`;
        md += `- **MEDDPICC均分：** ${r.meddpiccAvg}\n\n`;
      }
    }
    md += `---\n\n`;

    // 4. 逾期任务
    const allTasks = [...(adTasks || []), ...(samTasks || []), ...(saTasks || []), ...(rsmTasks || [])] as any[];
    const overdueTasks = allTasks.filter(t => !t.isCompleted && t.dueDate && new Date(t.dueDate) < now);
    md += `## 四、逾期任务清单\n\n`;
    if (overdueTasks.length === 0) {
      md += `暂无逾期任务。\n\n`;
    } else {
      md += `| 任务 | 负责角色 | 截止日期 | 逾期天数 |\n`;
      md += `|---|---|---|---|\n`;
      for (const t of overdueTasks) {
        const days = Math.floor((now.getTime() - new Date(t.dueDate).getTime()) / (1000 * 60 * 60 * 24));
        md += `| ${t.title} | ${t.assignedRole} | ${new Date(t.dueDate).toLocaleDateString("zh-CN")} | ${days}天 |\n`;
      }
    }
    md += `\n---\n\n`;
    md += `*本报告由 AIStorm Command 系统自动生成，数据截止至导出时间。*\n`;

    // 下载为 Markdown 文件
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AIStorm_Command_季度报告_${now.toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Zap className="w-6 h-6 text-[#00A8D6]" />
            AD 指挥台
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Portfolio Review · 实时战况总览</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/battle-map")} className="gap-1.5">
          <Eye className="w-4 h-4" />
          战场地图
        </Button>
        <Button variant="outline" size="sm" onClick={exportQuarterlyReport} className="gap-1.5 text-[#00A8D6] border-[#00A8D6]/30 hover:bg-[#00A8D6]/10">
          <Download className="w-4 h-4" />
          导出季度报告
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Target className="w-3.5 h-3.5" />
            目标客户总数
          </div>
          <div className="text-3xl font-bold">{totalClients}</div>
          <div className="text-xs text-muted-foreground">P0: {p0Clients.length} 个</div>
        </div>
        <div className="rounded-xl border bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Calendar className="w-3.5 h-3.5" />
            本周拜访
          </div>
          <div className="text-3xl font-bold text-[#00A8D6]">{visitedCount}</div>
          <div className="text-xs text-muted-foreground">/ {totalClients} 个客户</div>
        </div>
        <div className="rounded-xl border bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Activity className="w-3.5 h-3.5" />
            MEDDPICC 均分
          </div>
          <div className={`text-3xl font-bold ${avgMeddpicc >= 60 ? "text-green-400" : avgMeddpicc >= 35 ? "text-yellow-400" : "text-red-400"}`}>
            {avgMeddpicc}
          </div>
          <div className="text-xs text-muted-foreground">满分 100</div>
        </div>
        <div className="rounded-xl border bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <AlertTriangle className="w-3.5 h-3.5" />
            高风险预警
          </div>
          <div className={`text-3xl font-bold ${riskCount > 0 ? "text-red-400" : "text-green-400"}`}>{riskCount}</div>
          <div className="text-xs text-muted-foreground">需立即关注</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Stage Funnel */}
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <BarChart3 className="w-4 h-4 text-[#00A8D6]" />
            阶段漏斗
          </div>
          <div className="space-y-2">
            {STAGE_ORDER.map(stage => {
              const count = data.stageDistribution[stage] || 0;
              const pct = totalClients > 0 ? Math.round((count / totalClients) * 100) : 0;
              return (
                <div key={stage} className="space-y-0.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{stage}</span>
                    <span className="font-medium">{count} 个</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${STAGE_COLORS[stage] || "bg-slate-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Risk Alerts */}
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            高风险预警
            {riskCount > 0 && (
              <Badge variant="destructive" className="ml-auto text-[10px] px-1.5 py-0">{riskCount}</Badge>
            )}
          </div>

          {/* Overdue task alerts */}
          {(() => {
            const now = new Date();
            const overdueTasks: Array<{ id: number; title: string; assignedRole: string; clientId: number; dueDate: string; opportunityName?: string }> = [];
            for (const tasks of [adTasks, samTasks, saTasks, rsmTasks]) {
              if (!tasks) continue;
              for (const t of tasks as any[]) {
                if (!t.isCompleted && t.dueDate && new Date(t.dueDate) < now) {
                  overdueTasks.push(t);
                }
              }
            }
            if (overdueTasks.length === 0) return null;
            return (
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-2.5 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
                  <Clock className="w-3.5 h-3.5" />
                  逃期任务 ({overdueTasks.length})
                  <button
                    className="ml-auto text-[10px] text-red-400/70 hover:text-red-400 underline"
                    onClick={() => navigate('/pod-center')}
                  >进入 POD 中枢 →</button>
                </div>
                {overdueTasks.slice(0, 4).map(t => {
                  const clientName = data.clients.find(c => c.id === t.clientId)?.name;
                  const daysOverdue = Math.floor((now.getTime() - new Date(t.dueDate).getTime()) / 86400000);
                  return (
                    <div key={t.id} className="flex items-start gap-2 text-[11px]">
                      <span className={`px-1 py-0.5 rounded text-[9px] font-bold flex-shrink-0 ${
                        t.assignedRole === 'AD' ? 'bg-amber-500/20 text-amber-400' :
                        t.assignedRole === 'SAM' ? 'bg-cyan-500/20 text-cyan-400' :
                        t.assignedRole === 'SA' ? 'bg-violet-500/20 text-violet-400' :
                        'bg-emerald-500/20 text-emerald-400'
                      }`}>{t.assignedRole}</span>
                      <div className="min-w-0 flex-1">
                        <span className="text-foreground/80 truncate block">{t.title}</span>
                        <span className="text-muted-foreground">{clientName}{t.opportunityName ? ` · ${t.opportunityName}` : ''} · 逾期 {daysOverdue} 天</span>
                      </div>
                    </div>
                  );
                })}
                {overdueTasks.length > 4 && (
                  <div className="text-[10px] text-muted-foreground text-center">还有 {overdueTasks.length - 4} 条逾期任务...</div>
                )}
              </div>
            );
          })()}

          {data.riskClients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
              <CheckCircle2 className="w-8 h-8 text-green-400 mb-2" />
              <p className="text-xs">暂无高风险客户</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {data.riskClients.map(c => (
                <RiskClientCard
                  key={c.id}
                  c={c}
                  navigate={navigate}
                  isExpanded={activeRiskClientId === c.id}
                  onToggle={() => setActiveRiskClientId(prev => prev === c.id ? null : c.id)}
                  onExpand={() => setActiveRiskClientId(c.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* POD Task Overview */}
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Users className="w-4 h-4 text-[#4DB87A]" />
            POD 团队待处理任务
          </div>
          {data.pendingTasksByRole.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
              <CheckCircle2 className="w-8 h-8 text-green-400 mb-2" />
              <p className="text-xs">暂无待处理任务</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(["AD", "SAM", "SA", "RSM"] as const).map(role => {
                const task = data.pendingTasksByRole.find(t => t.role === role);
                const cnt = task?.count ?? 0;
                return (
                  <div key={role} className="flex items-center gap-3">
                    <div className="w-10 text-xs font-mono font-semibold text-muted-foreground">{role}</div>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#00A8D6] rounded-full transition-all"
                        style={{ width: cnt > 0 ? `${Math.min(100, cnt * 10)}%` : "0%" }}
                      />
                    </div>
                    <div className="w-6 text-right text-xs font-semibold">{cnt}</div>
                  </div>
                );
              })}
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs gap-1 mt-1"
            onClick={() => navigate("/pod-center")}
          >
            查看 POD 协同中枢
            <ChevronRight className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* MEDDPICC Health Matrix — 商机级别 */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <TrendingUp className="w-4 h-4 text-[#00A8D6]" />
          商机 MEDDPICC 健康度矩阵
          <span className="text-xs text-muted-foreground font-normal ml-1">— 每条商机独立评分，点击跳转战场地图</span>
        </div>
        {/* Header row */}
        <div className="grid gap-2" style={{ gridTemplateColumns: "180px 60px repeat(8, 1fr)" }}>
          <div className="text-xs text-muted-foreground font-medium">商机</div>
          <div className="text-xs text-muted-foreground font-medium text-center">健康度</div>
          {Object.entries(MEDDPICC_LABELS).map(([key, label]) => (
            <div key={key} className="text-[10px] text-muted-foreground text-center font-mono" title={MEDDPICC_FULL[key]}>
              {label}
            </div>
          ))}
        </div>
        <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
          {sortedClients.map(client => {
            // 展示客户标题行
            return (
              <div key={client.id}>
                {/* 客户分组标题 */}
                <div className="flex items-center gap-2 py-1 px-2 mb-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${STAGE_COLORS[client.stage] || "bg-slate-400"}`} />
                  <span className="text-xs font-semibold text-foreground">{client.name}</span>
                  {client.priority === "P0" && (
                    <Badge variant="destructive" className="text-[9px] px-1 py-0">P0</Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground">{client.stage}</span>
                </div>
                {/* 商机列表 */}
                {(client as any).opportunities && (client as any).opportunities.length > 0 ? (
                  (client as any).opportunities.map((opp: any) => {
                    const meddpicc = opp.meddpicc;
                    const scores = meddpicc ? [
                      meddpicc.metricsScore, meddpicc.economicBuyerScore, meddpicc.decisionCriteriaScore,
                      meddpicc.decisionProcessScore, meddpicc.paperProcessScore, meddpicc.implicatePainScore,
                      meddpicc.championScore, meddpicc.competitionScore
                    ] : Array(8).fill(0);
                    const total = scores.reduce((s: number, v: number) => s + (v ?? 0), 0);
                    const healthPct = Math.round((total / (8 * 4)) * 100);
                    const hasData = meddpicc && total > 0;
                    return (
                      <div
                        key={opp.id}
                        className="grid items-center gap-2 py-1.5 px-2 ml-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors border-l-2 border-border/30 mb-0.5"
                        style={{ gridTemplateColumns: "180px 60px repeat(8, 1fr)" }}
                        onClick={() => navigate("/battle-map")}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <div className="text-xs font-medium truncate text-muted-foreground">{opp.name}</div>
                            {pendingTaskOppIds.has(opp.id) && (() => {
                              const info = pendingTaskOppMap.get(opp.id)!;
                              return (
                                <span
                                  title={`${info.count} \u4e2a\u5f85\u5b8c\u6210\u4efb\u52a1 (${info.roles.join('/')}) — \u70b9\u51fb\u8df3\u8f6c POD \u4e2d\u67a2`}
                                  className="relative flex-shrink-0 group cursor-pointer"
                                  onClick={(e) => { e.stopPropagation(); navigate(`/pod-center?oppId=${opp.id}&oppName=${encodeURIComponent(opp.name)}`); }}
                                >
                                  <span className="w-2 h-2 rounded-full bg-red-500 block animate-pulse hover:scale-125 transition-transform" />
                                  <span className="absolute left-3 top-0 z-10 hidden group-hover:block whitespace-nowrap text-[10px] bg-popover border border-border text-popover-foreground px-1.5 py-0.5 rounded shadow-md">
                                    {info.count}\u4e2a\u5f85\u529e \u00b7 {info.roles.join('/')} \u2192 POD\u4e2d\u67a2
                                  </span>
                                </span>
                              );
                            })()}
                          </div>
                          <span className={`text-[10px] px-1 rounded ${STAGE_COLORS[opp.stage] ? "text-white" : "text-muted-foreground"}`}
                            style={{ background: "transparent" }}>
                            {opp.stage}
                          </span>
                        </div>
                        <div className={`text-sm font-bold text-center ${
                          !hasData ? "text-muted-foreground/40" :
                          healthPct >= 60 ? "text-green-400" : healthPct >= 35 ? "text-yellow-400" : "text-red-400"
                        }`}>
                          {hasData ? `${healthPct}%` : "—"}
                        </div>
                        {scores.map((score: number, idx: number) => {
                          const color = !hasData ? "bg-muted/30" : score >= 3 ? "bg-green-500" : score >= 2 ? "bg-yellow-500" : score >= 1 ? "bg-orange-500" : "bg-red-500/50";
                          return (
                            <div key={idx} className="flex flex-col items-center gap-0.5">
                              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${color}`} style={{ width: hasData ? `${(score / 4) * 100}%` : "0%" }} />
                              </div>
                              <span className="text-[9px] text-muted-foreground">{hasData ? score : "—"}</span>

                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                ) : (
                  <div className="ml-3 py-1.5 px-2 text-[10px] text-muted-foreground/50 italic">暂无商机记录</div>
                )}
              </div>
            );
          })}
        </div>
        <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/30">
          评分说明：0—未评分 · 1—初步了解 · 2—已确认 · 3—已验证 · 4—完全控制
        </div>
      </div>

      {/* This week visit status */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Calendar className="w-4 h-4 text-[#4DB87A]" />
          本周拜访状态
          <span className="text-xs text-muted-foreground font-normal ml-1">— 过去 7 天</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {data.clients.map(client => (
            <div
              key={client.id}
              className={`p-2.5 rounded-lg border cursor-pointer transition-colors ${
                client.visitedThisWeek
                  ? "border-green-500/40 bg-green-500/5 hover:bg-green-500/10"
                  : client.priority === "P0"
                  ? "border-red-500/40 bg-red-500/5 hover:bg-red-500/10"
                  : "border-muted hover:bg-muted/50"
              }`}
              onClick={() => navigate("/battle-map")}
            >
              <div className="flex items-start justify-between gap-1">
                <span className="text-xs font-medium leading-tight truncate">{client.name}</span>
                {client.visitedThisWeek ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" />
                ) : (
                  <div className={`w-2 h-2 rounded-full shrink-0 mt-1 ${client.priority === "P0" ? "bg-red-400" : "bg-muted-foreground/30"}`} />
                )}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">
                {client.visitedThisWeek ? "已拜访" : client.priority === "P0" ? "⚠ P0 未拜访" : "未拜访"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}