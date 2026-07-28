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
  CheckSquare,
  Trash2,
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
import ReactMarkdown from "react-markdown";

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
        {/* 卡片头部：严格三区分隔，不允许任何换行叠加 */}
        <div className="p-2.5 pb-2">
          {/* 第一行：客户名 + 右侧操作区（固定高度，不换行） */}
          <div className="flex items-center gap-2" style={{ flexWrap: 'nowrap' }}>
            {/* 左：客户名（截断，不挤压右侧） */}
            <div
              className="text-sm font-semibold truncate cursor-pointer hover:text-primary transition-colors"
              style={{ minWidth: 0, flex: '1 1 0' }}
              onClick={() => navigate(`/battle-map?clientId=${c.id}`)}
            >
              {c.name}
            </div>
            {/* 右：MEDDPICC分数 + AI分析按钮 + 展开按钮（固定宽度，不收缩） */}
            <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
              <div className="text-center" style={{ minWidth: 36 }}>
                <div className={`text-sm font-bold leading-none ${c.meddpiccAvg < 30 ? "text-red-400" : "text-yellow-400"}`}>{c.meddpiccAvg}</div>
                <div className="text-[9px] text-muted-foreground leading-none mt-0.5">avg</div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-1.5 text-[10px] gap-0.5 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 whitespace-nowrap"
                style={{ flexShrink: 0 }}
                onClick={handleAnalyze}
                disabled={analyzing}
              >
                {analyzing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {analyzing ? "分析中" : score ? "重新分析" : "AI分析"}
              </Button>
              {(score || analyzing) && (
                <button onClick={onToggle} className="p-0.5 text-muted-foreground hover:text-foreground" style={{ flexShrink: 0 }}>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>
          {/* 第二行：阶段标签 + 风险原因（独立一行，不与任何数字并排） */}
          <div className="flex items-center gap-1.5 mt-1.5" style={{ flexWrap: 'nowrap', overflow: 'hidden' }}>
            <Badge variant="outline" className="text-[10px] px-1 py-0 whitespace-nowrap" style={{ flexShrink: 0 }}>{c.stage}</Badge>
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <RiskBadge reason={c.riskReason} />
            </div>
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
                </div>
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
  // 全局 Review（第五入口）
  const [globalReviewOpen, setGlobalReviewOpen] = useState(false);
  const [globalReviewContent, setGlobalReviewContent] = useState("");
  const [globalReviewLoading, setGlobalReviewLoading] = useState(false);
  const globalReviewMut = trpc.insights.globalReview.useMutation();

  const handleGlobalReview = async () => {
    setGlobalReviewOpen(true);
    setGlobalReviewLoading(true);
    setGlobalReviewContent("");
    try {
      const res = await globalReviewMut.mutateAsync();
      setGlobalReviewContent(res.content);
    } catch (e: any) {
      setGlobalReviewContent("全局 Review 生成失败：" + (e?.message || "未知错误"));
    } finally {
      setGlobalReviewLoading(false);
    }
  };

  // SAM 教练 Review（第三/四入口）
  const [coachReviewOpen, setCoachReviewOpen] = useState(false);
  const [coachReviewContent, setCoachReviewContent] = useState("");
  const [coachReviewLoading, setCoachReviewLoading] = useState(false);
  const [coachReviewSamId, setCoachReviewSamId] = useState<number | null>(null);
  const [coachReviewSamName, setCoachReviewSamName] = useState("");
  const [coachReviewData, setCoachReviewData] = useState<any>(null);
  const samCoachMut = trpc.insights.samCoachReview.useMutation();
  const { data: samUsers = [] } = trpc.clients.listSamUsers.useQuery();
  const [samSelectorOpen, setSamSelectorOpen] = useState(false);

  const handleCoachReview = async (samId: number, samName: string) => {
    setCoachReviewSamId(samId);
    setCoachReviewSamName(samName);
    setCoachReviewOpen(true);
    setCoachReviewLoading(true);
    setCoachReviewContent("");
    setCoachReviewData(null);
    setSamSelectorOpen(false);
    try {
      const res = await samCoachMut.mutateAsync({ samId, samName });
      setCoachReviewContent(res.content);
      setCoachReviewData(res);
    } catch (e: any) {
      setCoachReviewContent("SAM 教练 Review 生成失败：" + (e?.message || "未知错误"));
    } finally {
      setCoachReviewLoading(false);
    }
  };

  // 辅导建议下发
  const [coachActionsOpen, setCoachActionsOpen] = useState(false);
  const [coachActionItems, setCoachActionItems] = useState<Array<{ title: string; description: string; dueDate: string }>>([]);
  const [coachActionsLoading, setCoachActionsLoading] = useState(false);
  const createCoachingMut = trpc.insights.createCoachingActions.useMutation({
    onSuccess: (res) => {
      toast.success(`已下发 ${res.count} 条辅导建议给 ${coachReviewSamName}`);
      setCoachActionsOpen(false);
    },
    onError: (e) => toast.error("下发失败：" + e.message),
  });
  const { data: allCoachingActions = [] } = trpc.insights.listAllCoachingActions.useQuery();
  const completeCoachingMut = trpc.insights.completeCoachingAction.useMutation({
    onSuccess: () => { trpc.useUtils().insights.listAllCoachingActions.invalidate(); },
  });
  const deleteCoachingMut = trpc.insights.deleteCoachingAction.useMutation({
    onSuccess: () => { trpc.useUtils().insights.listAllCoachingActions.invalidate(); },
  });

  const handlePrepareCoachActions = async () => {
    if (!coachReviewContent) return;
    setCoachActionsLoading(true);
    // 从 AI 诊断文本中提取 3 条默认辅导建议
    const defaultItems = [
      { title: "MEDDPICC 系统性短板提升", description: "基于教练 Review 诊断，重点补强最薄弱的 MEDDPICC 维度", dueDate: "" },
      { title: "Champion 识别与培养", description: "在名下客户中加速找到并培养 Champion，提升 Champion 质量评分", dueDate: "" },
      { title: "拜访频率优化", description: "对停滞超过 30 天的 P0/P1 客户制定拜访计划并执行", dueDate: "" },
    ];
    setCoachActionItems(defaultItems);
    setCoachActionsLoading(false);
    setCoachActionsOpen(true);
  };
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
  // Champion缺口：客户级championScore≤1（0→1阶段）或商机级championScore≤1（1→N阶段）
  const championGapCount = data.clients.filter(c => {
    const details = (c as any).meddpiccDetails;
    if (!details) return true; // 无评分视为缺口
    return (details.championScore ?? 0) <= 1;
  }).length;
  // 商机停滞数（超过30天无阶段推进的活跃商机）
  const stagnantOppCount = (data as any).oneToNBoard?.filter((o: any) => o.isStagnant).length ?? 0;

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
    const avgMeddpiccForExport = data.clients.length > 0
      ? Math.round(data.clients.reduce((sum: number, c: any) => sum + c.meddpiccAvg, 0) / data.clients.length)
      : 0;
    md += `\n**全组 MEDDPICC 均分：${avgMeddpiccForExport} / 100**\n\n---\n\n`;

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
    <div className="p-4 md:p-6 space-y-5">
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
        <Button
          variant="outline"
          size="sm"
          onClick={handleGlobalReview}
          disabled={globalReviewLoading}
          className="gap-1.5 text-purple-400 border-purple-500/30 hover:bg-purple-500/10"
        >
          {globalReviewLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          🌐 全局 Review
        </Button>
        {/* SAM 教练 Review 按钮 */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSamSelectorOpen(v => !v)}
            className="gap-1.5 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
          >
            <Users className="w-4 h-4" />
            👨‍🏫 SAM 教练 Review
          </Button>
          {samSelectorOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-xl py-1 min-w-[180px]">
              <div className="px-3 py-1 text-[10px] text-muted-foreground font-medium border-b border-border mb-1">选择 SAM 进行教练 Review</div>
              {samUsers.filter((u: any) => u.podRole === 'SAM').map((u: any) => (
                <button key={u.id} type="button"
                  onClick={() => handleCoachReview(u.id, u.name)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 text-foreground flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                    {u.name.charAt(0)}
                  </span>
                  {u.name}
                </button>
              ))}
              {samUsers.filter((u: any) => u.podRole === 'SAM').length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">暂无 SAM 成员</div>
              )}
            </div>
          )}
        </div>
      </div>
      {/* 全局战场 Review Dialog（含图表可视化）*/}
      <Dialog open={globalReviewOpen} onOpenChange={(o) => { if (!o) { setTimeout(() => { setGlobalReviewContent(""); setGlobalReviewLoading(false); }, 300); } setGlobalReviewOpen(o); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#00A8D6]">
              <Sparkles className="w-4 h-4" />
              🌐 全局战场 Review · AD 指挥官视角
            </DialogTitle>
          </DialogHeader>
          {globalReviewLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-8 h-8 border-2 border-[#00A8D6] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">AI 正在分析全局战场态势，请稍候...</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* 图表可视化区域 */}
              {data && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 漏斗健康度：阶段分布横向条形图 */}
                  <div className="rounded-xl border border-border bg-muted/10 p-4">
                    <div className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                      <BarChart3 className="w-3.5 h-3.5 text-[#00A8D6]" />
                      漏斗阶段分布
                    </div>
                    {(() => {
                      const STAGE_ORDER = ["建图","进门","定痛","找人","进入商机"];
                      const STAGE_COLORS = ["#64748b","#3b82f6","#f59e0b","#8b5cf6","#10b981"];
                      const stageData = STAGE_ORDER.map((s, i) => ({
                        stage: s,
                        count: data.clients.filter((c: any) => c.stage === s).length,
                        fill: STAGE_COLORS[i],
                      }));
                      return (
                        <ResponsiveContainer width="100%" height={160}>
                          <BarChart data={stageData} layout="vertical" margin={{ left: 8, right: 20, top: 4, bottom: 4 }}>
                            <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                            <YAxis type="category" dataKey="stage" tick={{ fontSize: 11, fill: '#e2e8f0' }} width={52} />
                            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', fontSize: 12 }} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                              {stageData.map((entry, index) => <Cell key={index} fill={entry.fill} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      );
                    })()}
                  </div>
                  {/* 资源优先级：P0/P1/P2 MEDDPICC 均分对比 */}
                  <div className="rounded-xl border border-border bg-muted/10 p-4">
                    <div className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-amber-400" />
                      优先级 × MEDDPICC 健康度
                    </div>
                    {(() => {
                      const priorities = ["P0","P1","P2"];
                      const PCOLORS = { P0: "#ef4444", P1: "#f59e0b", P2: "#64748b" };
                      const prioData = priorities.map(p => {
                        const pClients = data.clients.filter((c: any) => c.priority === p);
                        const avg = pClients.length > 0 ? Math.round(pClients.reduce((s: number, c: any) => s + c.meddpiccAvg, 0) / pClients.length) : 0;
                        return { priority: p, avg, count: pClients.length, fill: (PCOLORS as any)[p] };
                      });
                      return (
                        <ResponsiveContainer width="100%" height={160}>
                          <BarChart data={prioData} margin={{ left: 8, right: 20, top: 4, bottom: 4 }}>
                            <XAxis dataKey="priority" tick={{ fontSize: 11, fill: '#e2e8f0' }} />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', fontSize: 12 }}
                              formatter={(v: any, n: any, p: any) => [`${v}% (${p.payload.count}个客户)`, 'MEDDPICC均分']} />
                            <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                              {prioData.map((entry, index) => <Cell key={index} fill={entry.fill} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      );
                    })()}
                  </div>
                  {/* MEDDPICC 团队均分雷达图 */}
                  <div className="rounded-xl border border-border bg-muted/10 p-4 md:col-span-2">
                    <div className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-violet-400" />
                      团队 MEDDPICC 各维度均分（识别系统性短板）
                    </div>
                    {(() => {
                      const dimKeys = ['metricsScore','economicBuyerScore','decisionCriteriaScore','decisionProcessScore','paperProcessScore','implicatePainScore','championScore','competitionScore'];
                      const dimLabels = ['M-价值','E-决策人','D1-标准','D2-流程','P-采购','I-痛点','C1-Champion','C2-竞争'];
                      const radarData = dimLabels.map((label, i) => {
                        const scores = data.clients.map((c: any) => (c as any).meddpiccScores?.[dimKeys[i]] ?? 0);
                        const avg = scores.length > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0;
                        return { dim: label, score: avg, fullMark: 100 };
                      });
                      return (
                        <ResponsiveContainer width="100%" height={200}>
                          <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                            <PolarGrid stroke="#334155" />
                            <PolarAngleAxis dataKey="dim" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                            <Radar name="团队均分" dataKey="score" stroke="#00A8D6" fill="#00A8D6" fillOpacity={0.2} />
                            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', fontSize: 12 }} />
                          </RadarChart>
                        </ResponsiveContainer>
                      );
                    })()}
                  </div>
                </div>
              )}
              {/* AI 文字分析 */}
              <div className="text-sm leading-relaxed border-t border-border pt-4">
                <div className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  AI 全局战场分析
                </div>
                <ReactMarkdown
                  components={{
                    h1: ({children}) => <h1 className="text-lg font-bold text-[#00A8D6] mt-4 mb-2 pb-1 border-b border-[#00A8D6]/30">{children}</h1>,
                    h2: ({children}) => <h2 className="text-base font-semibold text-cyan-300 mt-4 mb-2">{children}</h2>,
                    h3: ({children}) => <h3 className="text-sm font-semibold text-blue-300 mt-3 mb-1">{children}</h3>,
                    p: ({children}) => <p className="text-foreground/90 mb-2 leading-relaxed">{children}</p>,
                    ul: ({children}) => <ul className="list-none space-y-1 mb-3">{children}</ul>,
                    ol: ({children}) => <ol className="list-decimal list-inside space-y-1 mb-3 text-foreground/90">{children}</ol>,
                    li: ({children}) => <li className="flex items-start gap-2 text-foreground/85"><span className="text-[#00A8D6] mt-0.5 flex-shrink-0">▸</span><span>{children}</span></li>,
                    strong: ({children}) => <strong className="text-yellow-300 font-semibold">{children}</strong>,
                    em: ({children}) => <em className="text-cyan-300 not-italic font-medium">{children}</em>,
                    blockquote: ({children}) => <blockquote className="border-l-2 border-[#00A8D6] pl-3 my-2 text-muted-foreground italic">{children}</blockquote>,
                    hr: () => <hr className="border-border/50 my-3" />,
                  }}
                >
                  {globalReviewContent || "暂无内容"}
                </ReactMarkdown>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => { if (globalReviewContent) { navigator.clipboard.writeText(globalReviewContent); toast.success("已复制到剪贴板"); } }}>
              复制全文
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setGlobalReviewOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SAM 教练 Review Dialog */}
      <Dialog open={coachReviewOpen} onOpenChange={(o) => { if (!o) { setTimeout(() => { setCoachReviewContent(""); setCoachReviewData(null); }, 300); } setCoachReviewOpen(o); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-400">
              <Users className="w-4 h-4" />
              👨‍🏫 SAM 教练 Review · {coachReviewSamName}
            </DialogTitle>
          </DialogHeader>
          {coachReviewLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">AI 正在分析 {coachReviewSamName} 的能力模式，请稍候...</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* 能力数据摘要卡片 */}
              {coachReviewData && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-lg border border-border bg-muted/20 p-3 text-center">
                    <div className="text-2xl font-bold text-[#00A8D6]">{coachReviewData.clientCount}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">负责客户数</div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-3 text-center">
                    <div className={`text-2xl font-bold ${coachReviewData.winRate !== null ? (coachReviewData.winRate >= 50 ? 'text-green-400' : 'text-orange-400') : 'text-muted-foreground'}`}>
                      {coachReviewData.winRate !== null ? `${coachReviewData.winRate}%` : 'N/A'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">赢单率</div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-3 text-center">
                    <div className={`text-2xl font-bold ${coachReviewData.noChampionCount > 0 ? 'text-orange-400' : 'text-green-400'}`}>{coachReviewData.noChampionCount}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">无 Champion 客户</div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-3 text-center">
                    <div className={`text-2xl font-bold ${coachReviewData.stagnantCount > 0 ? 'text-red-400' : 'text-green-400'}`}>{coachReviewData.stagnantCount}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">停滞客户数</div>
                  </div>
                </div>
              )}
              {/* MEDDPICC 能力雷达图 */}
              {coachReviewData?.dimAvgs && (
                <div className="rounded-xl border border-border bg-muted/10 p-4">
                  <div className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-emerald-400" />
                    {coachReviewSamName} · MEDDPICC 各维度均分
                  </div>
                  <div className="flex gap-4">
                    <ResponsiveContainer width="60%" height={200}>
                      <RadarChart data={coachReviewData.dimLabels.map((label: string, i: number) => ({ dim: label.split('-')[0], score: coachReviewData.dimAvgs[i], fullMark: 100 }))}>
                        <PolarGrid stroke="#334155" />
                        <PolarAngleAxis dataKey="dim" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                        <Radar name="均分" dataKey="score" stroke="#10b981" fill="#10b981" fillOpacity={0.25} />
                        <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', fontSize: 12 }} />
                      </RadarChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-1.5">
                      <div className="text-xs text-muted-foreground font-medium mb-2">各维度得分</div>
                      {coachReviewData.dimLabels.map((label: string, i: number) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground w-20 flex-shrink-0">{label.split('-')[0]}</span>
                          <div className="flex-1 h-1.5 bg-muted/40 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${coachReviewData.dimAvgs[i] >= 60 ? 'bg-green-500' : coachReviewData.dimAvgs[i] >= 30 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${coachReviewData.dimAvgs[i]}%` }} />
                          </div>
                          <span className={`text-[10px] font-medium w-8 text-right ${coachReviewData.dimAvgs[i] >= 60 ? 'text-green-400' : coachReviewData.dimAvgs[i] >= 30 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {coachReviewData.dimAvgs[i]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {/* AI 教练分析 */}
              <div className="text-sm leading-relaxed border-t border-border pt-4">
                <div className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  AI 教练诊断报告
                </div>
                <ReactMarkdown
                  components={{
                    h1: ({children}) => <h1 className="text-lg font-bold text-emerald-400 mt-4 mb-2 pb-1 border-b border-emerald-500/30">{children}</h1>,
                    h2: ({children}) => <h2 className="text-base font-semibold text-emerald-300 mt-4 mb-2">{children}</h2>,
                    h3: ({children}) => <h3 className="text-sm font-semibold text-cyan-300 mt-3 mb-1">{children}</h3>,
                    p: ({children}) => <p className="text-foreground/90 mb-2 leading-relaxed">{children}</p>,
                    ul: ({children}) => <ul className="list-none space-y-1 mb-3">{children}</ul>,
                    ol: ({children}) => <ol className="list-decimal list-inside space-y-1 mb-3 text-foreground/90">{children}</ol>,
                    li: ({children}) => <li className="flex items-start gap-2 text-foreground/85"><span className="text-emerald-400 mt-0.5 flex-shrink-0">▸</span><span>{children}</span></li>,
                    strong: ({children}) => <strong className="text-yellow-300 font-semibold">{children}</strong>,
                    em: ({children}) => <em className="text-emerald-300 not-italic font-medium">{children}</em>,
                    blockquote: ({children}) => <blockquote className="border-l-2 border-emerald-500 pl-3 my-2 text-muted-foreground italic">{children}</blockquote>,
                    hr: () => <hr className="border-border/50 my-3" />,
                  }}
                >
                  {coachReviewContent || "暂无内容"}
                </ReactMarkdown>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => { if (coachReviewContent) { navigator.clipboard.writeText(coachReviewContent); toast.success("已复制到剪贴板"); } }}>
              复制全文
            </Button>
            {!coachReviewLoading && coachReviewContent && (
              <Button type="button" size="sm" onClick={handlePrepareCoachActions}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
                <CheckSquare className="w-3.5 h-3.5" />
                📋 下发辅导建议
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={() => setCoachReviewOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* KPI Cards */}
      {/* 辅导建议下发 Dialog */}
      <Dialog open={coachActionsOpen} onOpenChange={setCoachActionsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-400">
              <CheckSquare className="w-4 h-4" />
              下发辅导建议给 {coachReviewSamName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">以下是基于 AI 教练诊断生成的辅导 Action Items，你可以编辑后下发给 {coachReviewSamName}。</p>
            {coachActionItems.map((item, i) => (
              <div key={i} className="rounded-lg border border-border bg-muted/10 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-xs font-bold text-emerald-400 mt-0.5 flex-shrink-0">#{i + 1}</span>
                  <div className="flex-1 space-y-2">
                    <input
                      value={item.title}
                      onChange={(e) => setCoachActionItems(prev => prev.map((it, idx) => idx === i ? { ...it, title: e.target.value } : it))}
                      className="w-full text-sm bg-transparent border-b border-border/50 focus:border-emerald-500/50 outline-none pb-1 text-foreground"
                      placeholder="辅导建议标题"
                    />
                    <textarea
                      value={item.description}
                      onChange={(e) => setCoachActionItems(prev => prev.map((it, idx) => idx === i ? { ...it, description: e.target.value } : it))}
                      className="w-full text-xs bg-muted/20 border border-border/30 rounded p-2 outline-none focus:border-emerald-500/30 text-muted-foreground resize-none"
                      rows={2}
                      placeholder="具体辅导内容（可选）"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">截止日期：</span>
                      <input
                        type="date"
                        value={item.dueDate}
                        onChange={(e) => setCoachActionItems(prev => prev.map((it, idx) => idx === i ? { ...it, dueDate: e.target.value } : it))}
                        className="text-xs bg-muted/20 border border-border/30 rounded px-2 py-0.5 outline-none focus:border-emerald-500/30 text-muted-foreground"
                      />
                    </div>
                  </div>
                  <button type="button" onClick={() => setCoachActionItems(prev => prev.filter((_, idx) => idx !== i))}
                    className="text-muted-foreground hover:text-red-400 transition-colors flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            <button type="button"
              onClick={() => setCoachActionItems(prev => [...prev, { title: "", description: "", dueDate: "" }])}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors">
              + 添加辅导建议
            </button>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setCoachActionsOpen(false)}>取消</Button>
            <Button size="sm" onClick={() => {
              if (!coachReviewSamId) return;
              createCoachingMut.mutate({
                samId: coachReviewSamId,
                samName: coachReviewSamName,
                actions: coachActionItems.filter(a => a.title.trim()),
                createdBy: "AD",
              });
            }}
              disabled={createCoachingMut.isPending || coachActionItems.filter(a => a.title.trim()).length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
              {createCoachingMut.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckSquare className="w-3.5 h-3.5" />}
              确认下发 ({coachActionItems.filter(a => a.title.trim()).length} 条)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            Champion 缺口
          </div>
          <div className="text-3xl font-bold">
            <span className={championGapCount > 0 ? "text-orange-400" : "text-green-400"}>{championGapCount}</span>
          </div>
          <div className="text-xs text-muted-foreground">户客户 Champion 未确认（C ≤ 1）</div>
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

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* 0→1 客户推进看板 */}
        <div className="lg:col-span-2 rounded-xl border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <BarChart3 className="w-4 h-4 text-[#00A8D6]" />
            0→1 客户推进
            <span className="text-xs text-muted-foreground font-normal ml-1">— 阶段推进 · 异常检测</span>
          </div>
          {(() => {
            const board = (data as any).zeroToOneBoard ?? [];
            if (board.length === 0) {
              return <div className="text-xs text-muted-foreground text-center py-4">暂无 0→1 阶段客户</div>;
            }
            return (
              <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                {board.map((c: any) => {
                  const hasAnomaly = c.anomalies?.length > 0;
                  return (
                    <div
                      key={c.id}
                      className={`p-2 rounded-lg cursor-pointer transition-colors border ${
                        hasAnomaly
                          ? "bg-orange-500/5 border-orange-500/25 hover:bg-orange-500/10"
                          : c.isStagnant
                          ? "bg-red-500/8 border-red-500/25 hover:bg-red-500/15"
                          : c.hasActionThisWeek
                          ? "bg-green-500/5 border-green-500/20 hover:bg-green-500/10"
                          : "bg-muted/20 border-border/30 hover:bg-muted/40"
                      }`}
                      onClick={() => navigate(`/battle-map?clientId=${c.id}`)}
                    >
                      {/* 行1：客户名 + 阶段 + 停留天数 */}
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1 flex items-center gap-1.5">
                          <span className="text-xs font-semibold truncate">{c.name}</span>
                          {c.priority === "P0" && (
                            <span className="text-[9px] px-1 py-0 rounded bg-red-500/20 text-red-400 font-bold flex-shrink-0">P0</span>
                          )}
                          <span className="text-[10px] px-1.5 py-0 rounded bg-muted/50 text-muted-foreground flex-shrink-0">{c.stage}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className={`text-xs font-bold ${c.stageDwellDays > 14 ? "text-red-400" : c.stageDwellDays > 7 ? "text-yellow-400" : "text-green-400"}`}>
                            {c.stageDwellDays}天
                          </div>
                          {c.hasActionThisWeek
                            ? <span className="text-[10px] text-green-400">✓本周</span>
                            : <span className="text-[10px] text-muted-foreground/50">无动作</span>
                          }
                        </div>
                      </div>
                      {/* 行2：异常标签 */}
                      {hasAnomaly && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(c.anomalies as string[]).map((a: string, i: number) => (
                            <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 font-medium">
                              ⚠ {a}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* 行3：拜访次数 + 关键人数 + 指令台快捷按钮 */}
                      <div className="flex items-center gap-3 mt-1 text-[9px] text-muted-foreground/60">
                        <span>拜访 {c.visitCount ?? 0} 次</span>
                        <span>关键人 {c.contactCount ?? 0} 人</span>
                        {c.daysSinceLastVisit !== null && (
                          <span className={c.daysSinceLastVisit > 21 ? "text-red-400/70" : ""}>
                            上次拜访 {c.daysSinceLastVisit} 天前
                          </span>
                        )}
                        <button
                          className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex-shrink-0"
                          onClick={(e) => { e.stopPropagation(); navigate(`/action-command?clientId=${c.id}`); }}
                        >
                          → 指令台
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Risk Alerts */}
        <div className="lg:col-span-2 rounded-xl border bg-card p-4 space-y-3">
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

      {/* 1→N 商机推进看板 */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <TrendingUp className="w-4 h-4 text-orange-400" />
          1→N 商机推进
          <span className="text-xs text-muted-foreground font-normal ml-1">— 活跃商机阶段停滞监控</span>
          {stagnantOppCount > 0 && (
            <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-semibold">
              {stagnantOppCount} 条停滞 &gt;30天
            </span>
          )}
        </div>
        {(() => {
          const board = (data as any).oneToNBoard ?? [];
          if (board.length === 0) {
            return <div className="text-xs text-muted-foreground text-center py-4">暂无活跃商机</div>;
          }
          return (
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {/* 按客户分组 */}
              {(() => {
                // 按clientId分组
                const byClient = new Map<number, { clientName: string; clientId: number; opps: any[] }>();
                board.forEach((opp: any) => {
                  if (!byClient.has(opp.clientId)) {
                    byClient.set(opp.clientId, { clientName: opp.clientName, clientId: opp.clientId, opps: [] });
                  }
                  byClient.get(opp.clientId)!.opps.push(opp);
                });
                return Array.from(byClient.values()).map(group => (
                  <div key={group.clientId} className="space-y-1">
                    {/* 客户分组标题 */}
                    <div
                      className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-muted/20 rounded"
                      onClick={() => navigate(`/battle-map?clientId=${group.clientId}`)}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00A8D6] flex-shrink-0" />
                      <span className="text-xs font-semibold text-foreground">{group.clientName}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">{group.opps.length} 条商机 →</span>
                    </div>
                    {/* 该客户下的商机列表 */}
                    <div className="ml-3 space-y-1 border-l-2 border-border/30 pl-2">

                      {/* 列表头 */}
                      <div className="flex items-center gap-2 px-2 py-0.5 text-[9px] text-muted-foreground/40 font-medium border-b border-border/20 mb-0.5">
                        <span className="flex-1">商机名称</span>
                        <span className="w-16 text-right">关单日期</span>
                        <span className="w-12 text-right">金额</span>
                        <span className="w-16 text-center">阶段</span>
                        <span className="w-8 text-right">停留</span>
                        <span className="w-6 text-center">异常</span>
                      </div>
                      {group.opps.map((opp: any) => {
                        const allAnomalies = [
                          ...(opp.oppAnomalies ?? []),
                          ...(opp.weakDims?.length > 0 ? [`MEDDPICC缺口:${opp.weakDims.join('/')}`] : []),
                        ];
                        const hasAnomaly = allAnomalies.length > 0;
                        const anomalyTooltip = allAnomalies.join(' · ');
                        return (
                          <div
                            key={opp.id}
                            title={hasAnomaly ? `⚠ ${anomalyTooltip}` : `${opp.name} · ${opp.stage}`}
                            className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors text-xs ${
                              opp.isStagnant
                                ? "bg-red-500/8 border-l-2 border-red-500/50 hover:bg-red-500/12"
                                : hasAnomaly
                                ? "bg-orange-500/5 border-l-2 border-orange-500/40 hover:bg-orange-500/10"
                                : opp.isWarning
                                ? "bg-yellow-500/5 border-l-2 border-yellow-500/30 hover:bg-yellow-500/10"
                                : "border-l-2 border-transparent hover:bg-muted/20"
                            }`}
                            onClick={() => navigate(`/battle-map?clientId=${opp.clientId}&oppId=${opp.id}`)}
                          >
                            <span className="font-medium truncate min-w-0 flex-1">{opp.name}</span>
                            <span className={`w-16 text-right text-[9px] flex-shrink-0 ${!opp.expectedCloseDate ? "text-orange-400/60" : "text-muted-foreground/60"}`}>
                              {opp.expectedCloseDate ?? "TBD"}
                            </span>
                            <span className={`w-12 text-right text-[9px] font-mono flex-shrink-0 ${!opp.estimatedValue ? "text-orange-400/60" : "text-muted-foreground/70"}`}>
                              {opp.estimatedValue ?? "—"}
                            </span>
                            <span className="w-16 text-center text-[9px] px-1 py-0.5 rounded bg-muted/40 text-muted-foreground flex-shrink-0">{opp.stage}</span>
                            <span className={`w-8 text-right font-bold flex-shrink-0 ${opp.isStagnant ? "text-red-400" : opp.isWarning ? "text-yellow-400" : "text-green-400"}`}>
                              {opp.stageDwellDays}天
                            </span>
                            <span className="w-6 text-center flex-shrink-0">
                              {hasAnomaly
                                ? <span className="text-[9px] px-1 py-0.5 rounded bg-orange-500/20 text-orange-400 font-bold">⚠{allAnomalies.length}</span>
                                : <span className="text-[9px] text-green-400/50">✓</span>
                              }
                            </span>
                            <button
                              className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex-shrink-0"
                              onClick={(e) => { e.stopPropagation(); navigate(`/action-command?clientId=${opp.clientId}`); }}
                              title="前往AI行动指令台，为此客户生成针对性指令"
                            >
                              →
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}
            </div>
          );
        })()}
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
              onClick={() => navigate(`/battle-map?clientId=${client.id}`)}
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

      {/* 决策层覆盖率大盘 */}
      {(() => {
        const coverage = (data as any).decisionLayerCoverage ?? [];
        if (coverage.length === 0) return null;
        const totalClients = coverage.length;
        const withEconomicBuyer = coverage.filter((c: any) => c.hasEconomicBuyer).length;
        const withTechDM = coverage.filter((c: any) => c.hasTechDecisionMaker).length;
        const withChampion = coverage.filter((c: any) => c.hasChampion).length;
        const withBlocker = coverage.filter((c: any) => c.hasBlocker).length;
        return (
          <div className="rounded-xl border bg-card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <Users className="w-4 h-4 text-[#00A8D6]" />
                决策层覆盖率大盘
                <span className="text-xs text-muted-foreground font-normal ml-1">— C-Level 触达率 · Buying Group 完整度</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>经济决策人 <span className={`font-bold ${withEconomicBuyer < totalClients ? 'text-orange-400' : 'text-green-400'}`}>{withEconomicBuyer}/{totalClients}</span></span>
                <span>技术决策人 <span className={`font-bold ${withTechDM < totalClients ? 'text-orange-400' : 'text-green-400'}`}>{withTechDM}/{totalClients}</span></span>
                <span>Champion <span className={`font-bold ${withChampion < totalClients ? 'text-orange-400' : 'text-green-400'}`}>{withChampion}/{totalClients}</span></span>
                {withBlocker > 0 && <span>已知阻碍者 <span className="font-bold text-red-400">{withBlocker}</span></span>}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-1.5 pr-3 font-medium w-32">客户</th>
                    <th className="text-center py-1.5 px-2 font-medium">优先级</th>
                    <th className="text-center py-1.5 px-2 font-medium">经济决策人</th>
                    <th className="text-center py-1.5 px-2 font-medium">技术决策人</th>
                    <th className="text-center py-1.5 px-2 font-medium">Champion</th>
                    <th className="text-center py-1.5 px-2 font-medium">阻碍者</th>
                    <th className="text-center py-1.5 px-2 font-medium">C-Level触达率</th>
                    <th className="text-right py-1.5 pl-2 font-medium">关键人总数</th>
                  </tr>
                </thead>
                <tbody>
                  {coverage.map((c: any) => (
                    <tr
                      key={c.clientId}
                      className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => navigate(`/battle-map?clientId=${c.clientId}`)}
                    >
                      <td className="py-2 pr-3 font-medium truncate max-w-[8rem]">{c.clientName}</td>
                      <td className="py-2 px-2 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${c.priority === 'P0' ? 'bg-red-500/20 text-red-400' : c.priority === 'P1' ? 'bg-orange-500/20 text-orange-400' : 'bg-muted text-muted-foreground'}`}>{c.priority}</span>
                      </td>
                      <td className="py-2 px-2 text-center">{c.hasEconomicBuyer ? <span className="text-green-400">✓</span> : <span className="text-red-400/70">—</span>}</td>
                      <td className="py-2 px-2 text-center">{c.hasTechDecisionMaker ? <span className="text-green-400">✓</span> : <span className="text-red-400/70">—</span>}</td>
                      <td className="py-2 px-2 text-center">{c.hasChampion ? <span className="text-green-400">✓</span> : <span className="text-orange-400/70">—</span>}</td>
                      <td className="py-2 px-2 text-center">{c.hasBlocker ? <span className="text-red-400 font-bold">⚠</span> : <span className="text-muted-foreground/30">—</span>}</td>
                      <td className="py-2 px-2 text-center">
                        {c.cLevelTotal > 0 ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-[#00A8D6] rounded-full" style={{ width: `${c.coverageRate}%` }} />
                            </div>
                            <span className={c.coverageRate < 50 ? 'text-orange-400' : 'text-green-400'}>{c.coverageRate}%</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50 text-[10px]">未录入</span>
                        )}
                      </td>
                      <td className="py-2 pl-2 text-right text-muted-foreground">{c.totalContacts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from "recharts";
