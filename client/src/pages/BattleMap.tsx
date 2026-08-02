import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { Edit2, Save, X, ChevronDown, ChevronUp, Users, Plus, Trash2, UserCheck, TrendingUp, Sparkles, Upload, Download, AlertCircle, CheckCircle2, Calendar, MapPin, Swords, Target, Trophy, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

import { TermTooltip, MeddpiccLabel } from "@/components/TermTooltip";
import SalesPipelineSteps from "@/components/SalesPipelineSteps";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MEDDPICC_DIMENSIONS } from "../../../shared/meddpicc";
import { useRole } from "@/contexts/RoleContext";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const MEDDPICC_ITEMS = [
  { key: "metrics", label: "M", fullLabel: "M — Metrics 可量化价值", tooltipTerm: "Metrics", scoreKey: "metricsScore", notesKey: "metricsNotes", placeholder: "例：减少80%响应时间，节省150万港元/年" },
  { key: "economicBuyer", label: "E", fullLabel: "E — Economic Buyer 预算决策人", tooltipTerm: "Economic Buyer", scoreKey: "economicBuyerScore", notesKey: "economicBuyerNotes", nameKey: "economicBuyerName", placeholder: "例：已约到CEO马红军，确认预算权限" },
  { key: "decisionCriteria", label: "D", fullLabel: "D — Decision Criteria 决策标准", tooltipTerm: "Decision Criteria", scoreKey: "decisionCriteriaScore", notesKey: "decisionCriteriaNotes", placeholder: "例：客户要求支持PDPA合规+本地技术支持" },
  { key: "decisionProcess", label: "D", fullLabel: "D — Decision Process 决策流程", tooltipTerm: "Decision Process", scoreKey: "decisionProcessScore", notesKey: "decisionProcessNotes", placeholder: "例：IT评估→安委会→CFO→CEO，约10周" },
  { key: "paperProcess", label: "P", fullLabel: "P — Paper Process 采购流程", tooltipTerm: "Paper Process", scoreKey: "paperProcessScore", notesKey: "paperProcessNotes", placeholder: "例：上市公司>50万需董事会审批，提前6周启动" },
  { key: "implicatePain", label: "I", fullLabel: "I — Implicate Pain 痛点紧迫性", tooltipTerm: "Implicate Pain", scoreKey: "implicatePainScore", notesKey: "implicatePainNotes", placeholder: "例：PDPA违规最高罚款100万新元+72小时报告义务" },
  { key: "champion", label: "C", fullLabel: "C — Champion 内部推手", tooltipTerm: "Champion", scoreKey: "championScore", notesKey: "championNotes", nameKey: "championName", placeholder: "例：信息安全总监张伟，认可TrustOne价值，愿意内部推动" },
  { key: "competition", label: "C", fullLabel: "C — Competition 竞争态势", tooltipTerm: "Competition", scoreKey: "competitionScore", notesKey: "competitionNotes", placeholder: "例：同时评估Palo Alto，我方优势：中文支持+出海场景" },
] as const;

const STAGES = ["建图", "进门", "定痛", "找人", "进入商机"];
const PRIORITIES = ["P0", "P1", "P2"];
const INFLUENCE_OPTIONS = ["决策者", "影响者", "Champion候选", "技术评估者", "内部线人"];
const BUYING_ROLE_OPTIONS = ["经济决策人", "技术决策人", "用户影响者", "阻碍者", "Champion", "内部线人", "未知"];
const buyingRoleColor: Record<string, string> = {
  "经济决策人": "bg-amber-500/20 text-amber-400 border-amber-500/40",
  "技术决策人": "bg-blue-500/20 text-blue-400 border-blue-500/40",
  "用户影响者": "bg-cyan-500/20 text-cyan-400 border-cyan-500/40",
  "阻碍者": "bg-red-500/20 text-red-400 border-red-500/40",
  "Champion": "bg-green-500/20 text-green-400 border-green-500/40",
  "内部线人": "bg-muted text-muted-foreground border-border",
  "未知": "bg-muted/50 text-muted-foreground/60 border-border/40",
};
const RELATIONSHIP_OPTIONS = ["待接触", "已识别", "初步接触", "已接触", "建立关系", "Champion", "已拒绝"];

const stageColor: Record<string, string> = {
  "建图": "bg-muted/50 text-muted-foreground",
  "进门": "bg-blue-500/20 text-blue-400",
  "定痛": "bg-yellow-500/20 text-yellow-400",
  "找人": "bg-orange-500/20 text-orange-400",
  "进入商机": "bg-primary/20 text-primary",
};

const oppStageColor: Record<string, string> = {
  "初步需求": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "需求挖掘": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "技术验证": "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  "方案提案": "bg-orange-500/20 text-orange-400 border-orange-500/30",
  "商务谈判": "bg-primary/20 text-primary border-primary/30",
  "赢单": "bg-green-500/20 text-green-400 border-green-500/30",
  "丢单": "bg-red-500/20 text-red-400 border-red-500/30",
};

const influenceColor: Record<string, string> = {
  "决策者": "bg-red-500/20 text-red-400 border-red-500/30",
  "影响者": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Champion候选": "bg-green-500/20 text-green-400 border-green-500/30",
  "技术评估者": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "内部线人": "bg-muted text-muted-foreground border-border",
};

const relationshipColor: Record<string, string> = {
  "待接触": "text-muted-foreground",
  "已识别": "text-blue-400",
  "初步接触": "text-yellow-400",
  "已接触": "text-cyan-400",
  "建立关系": "text-orange-400",
  "Champion": "text-green-400",
  "已拒绝": "text-red-400",
};


function scoreColor(score: number) {
  if (score >= 60) return "bg-green-500";
  if (score >= 30) return "bg-yellow-500";
  return "bg-red-500/70";
}

function MeddpiccBar({ label, score, fullLabel }: { label: string; score: number; fullLabel: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center flex-shrink-0">
        <span className="text-[10px] font-bold text-primary">{label}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-xs text-muted-foreground truncate">{fullLabel}</span>
          <span className="text-xs font-mono text-foreground ml-2">{score}</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className={cn("h-full rounded-full transition-all", scoreColor(score))} style={{ width: `${score}%` }} />
        </div>
      </div>
    </div>
  );
}

// ── Active Fronts Panel (活跃战线：多商机并行管理) ──────────────────────────
const OPP_STAGES = ["初步需求", "需求挖掘", "技术验证", "方案提案", "商务谈判", "赢单", "丢单"] as const;
const OPP_STATUSES = ["活跃", "暂停", "赢单", "丢单"] as const;
const oppStatusColor: Record<string, string> = {
  "活跃": "bg-green-500/20 text-green-400 border-green-500/30",
  "暂停": "bg-muted/50 text-muted-foreground border-border",
  "赢单": "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  "丢单": "bg-red-500/20 text-red-400 border-red-500/30",
};
const STANCE_OPTIONS = ["支持", "中立", "反对", "未知"] as const;
const stanceColor: Record<string, string> = {
  "支持": "bg-green-500/20 text-green-400 border-green-500/30",
  "中立": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "反对": "bg-red-500/20 text-red-400 border-red-500/30",
  "未知": "bg-muted/50 text-muted-foreground border-border",
};

// MEDDPICC 8 维定义（商机级别）
const OPP_MEDDPICC_ITEMS = [
  { key: "metricsScore", label: "M", fullLabel: "Metrics — 可量化价值", color: "text-blue-400" },
  { key: "economicBuyerScore", label: "E", fullLabel: "Economic Buyer — 预算决策人", color: "text-purple-400" },
  { key: "decisionCriteriaScore", label: "D", fullLabel: "Decision Criteria — 决策标准", color: "text-cyan-400" },
  { key: "decisionProcessScore", label: "D", fullLabel: "Decision Process — 决策流程", color: "text-cyan-400" },
  { key: "paperProcessScore", label: "P", fullLabel: "Paper Process — 采购流程", color: "text-orange-400" },
  { key: "implicatePainScore", label: "I", fullLabel: "Implicate Pain — 痛点紧迫性", color: "text-red-400" },
  { key: "championScore", label: "C", fullLabel: "Champion — 内部推手", color: "text-green-400" },
  { key: "competitionScore", label: "C", fullLabel: "Competition — 竞争态势", color: "text-yellow-400" },
] as const;

// 单个商机的 Blue Sheet + MEDDPICC 展开面板
function OppBlueSheetPanel({ opp, clientId, onClose }: { opp: any; clientId: number; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [activeSection, setActiveSection] = useState<"bluesheet" | "meddpicc">("bluesheet");
  const [blueSheet, setBlueSheet] = useState({
    bizObjective: opp.bizObjective || "",
    valueProposition: opp.valueProposition || "",
    champion: opp.champion || "",
    championStance: (opp.championStance || "未知") as string,
    blueSheetCompetitor: opp.blueSheetCompetitor || "",
    winStrategy: opp.winStrategy || "",
    keyMilestones: opp.keyMilestones || "",
    riskAndMitigation: opp.riskAndMitigation || "",
  });
  const [meddpiccScores, setMeddpiccScores] = useState<Record<string, number>>({});
  const [meddpiccNotes, setMeddpiccNotes] = useState<Record<string, string>>({});
  const [savingBlueSheet, setSavingBlueSheet] = useState(false);
  const [savingMeddpicc, setSavingMeddpicc] = useState(false);
  // Opportunity-level task creation
  const [showOppTaskDialog, setShowOppTaskDialog] = useState(false);
  const [oppTaskTitle, setOppTaskTitle] = useState("");
  const [oppTaskRole, setOppTaskRole] = useState<"AD" | "SAM" | "SA" | "RSM">("SAM");
  const [oppTaskDesc, setOppTaskDesc] = useState("");
  const [oppTaskDueDate, setOppTaskDueDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10);
  });
  const addOppTask = trpc.pod.addTask.useMutation({
    onSuccess: () => {
      toast.success(`商机跟进任务已创建，已分配给 ${oppTaskRole}`);
      setShowOppTaskDialog(false);
      setOppTaskTitle("");
      setOppTaskDesc("");
    },
    onError: () => toast.error("创建任务失败"),
  });

  const { data: meddpiccData } = trpc.opportunities.getMeddpicc.useQuery({ opportunityId: opp.id });

  // Initialize scores from fetched data when it arrives
  const [meddpiccInitialized, setMeddpiccInitialized] = useState(false);
  if (meddpiccData && !meddpiccInitialized) {
    const scores: Record<string, number> = {};
    const notes: Record<string, string> = {};
    MEDDPICC_DIMENSIONS.forEach(dim => {
      scores[dim.key] = (meddpiccData as any)[dim.key] ?? 0;
      const notesKey = dim.key.replace('Score', 'Notes');
      notes[notesKey] = (meddpiccData as any)[notesKey] ?? "";
    });
    setMeddpiccScores(scores);
    setMeddpiccNotes(notes);
    setMeddpiccInitialized(true);
  }

  const updateBlueSheet = trpc.opportunities.updateBlueSheet.useMutation({
    onSuccess: () => {
      utils.opportunities.listByClient.invalidate({ clientId });
      toast.success("Blue Sheet 已保存");
      setSavingBlueSheet(false);
    },
    onError: () => setSavingBlueSheet(false),
  });

  const upsertMeddpicc = trpc.opportunities.upsertMeddpicc.useMutation({
    onSuccess: () => {
      utils.opportunities.getMeddpicc.invalidate({ opportunityId: opp.id });
      toast.success("MEDDPICC 评分已保存");
      setSavingMeddpicc(false);
    },
    onError: () => setSavingMeddpicc(false),
  });

  // 分数存 0-4，对应 0/25/50/75/100，健康度 = 均值百分比
  const totalScore = MEDDPICC_DIMENSIONS.reduce((sum, dim) => sum + (meddpiccScores[dim.key] ?? 0), 0);

  // MEDDPICC → Blue Sheet 弱项映射（分数 ≤ 1 时触发高亮）
  const weakM  = (meddpiccScores["metricsScore"] ?? 0) <= 1 && meddpiccInitialized;
  const weakE  = (meddpiccScores["economicBuyerScore"] ?? 0) <= 1 && meddpiccInitialized;
  const weakDc = (meddpiccScores["decisionCriteriaScore"] ?? 0) <= 1 && meddpiccInitialized;
  const weakDp = (meddpiccScores["decisionProcessScore"] ?? 0) <= 1 && meddpiccInitialized;
  const weakP  = (meddpiccScores["paperProcessScore"] ?? 0) <= 1 && meddpiccInitialized;
  const weakI  = (meddpiccScores["implicatePainScore"] ?? 0) <= 1 && meddpiccInitialized;
  const weakC  = (meddpiccScores["championScore"] ?? 0) <= 1 && meddpiccInitialized;
  const weakC2 = (meddpiccScores["competitionScore"] ?? 0) <= 1 && meddpiccInitialized;

  // 字段级弱项标记
  const weakBizObj    = weakM || weakI;         // 客户业务目标 ← M + I
  const weakValueProp = weakM || weakE;         // 我方价值主张 ← M + E
  const weakChampion  = weakC;                  // Champion ← C
  const weakCompetitor = weakC2;               // 竞争态势 ← C2
  const weakWinStrat  = weakI || weakDc;        // 赢单策略 ← I + Dc
  const weakMilestone = weakDp || weakP;        // 关键里程碑 ← Dp + P
  const weakRisk      = weakDp || weakP || weakE; // 风险与应对 ← Dp + P + E

  function WeakHint({ dims }: { dims: string[] }) {
    return (
      <div className="flex items-center gap-1 mt-0.5 mb-1">
        <span className="text-[9px] text-orange-400 font-medium">⚠ MEDDPICC</span>
        <span className="text-[9px] text-orange-400/80">{dims.join(" · ")} 评分偏低 — 请在此补充应对策略</span>
      </div>
    );
  }
  const maxScore = MEDDPICC_DIMENSIONS.length * 4;
  const healthPct = Math.round((totalScore / maxScore) * 100);
  const weakDimensions = MEDDPICC_DIMENSIONS.filter(dim => (meddpiccScores[dim.key] ?? 0) <= 1).map(dim => ({
    label: dim.code,
    fullLabel: `${dim.code} — ${dim.chineseName}`
  }));

  return (
    <div className="mt-2 border border-primary/20 rounded-lg bg-background/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-primary/5 border-b border-primary/10">
        <div className="flex items-center gap-2">
          <Target className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-primary">{opp.name} — 商机蓝图</span>
          {healthPct > 0 && (
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-bold border",
              healthPct >= 60 ? "bg-green-500/20 text-green-400 border-green-500/30" :
              healthPct >= 35 ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
              "bg-red-500/20 text-red-400 border-red-500/30"
            )}>MEDDPICC {healthPct}%</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { setOppTaskTitle(`跟进商机：${opp.name}`); setShowOppTaskDialog(true); }}
            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10 transition-colors"
          >
            <Plus className="w-3 h-3" />生成跟进任务
          </button>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex border-b border-border/50">
        <button
          onClick={() => setActiveSection("bluesheet")}
          className={cn("flex-1 py-2 text-xs font-medium transition-colors",
            activeSection === "bluesheet" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"
          )}
        >📋 Blue Sheet</button>
        <button
          onClick={() => setActiveSection("meddpicc")}
          className={cn("flex-1 py-2 text-xs font-medium transition-colors",
            activeSection === "meddpicc" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"
          )}
        >🎯 MEDDPICC 评分</button>
      </div>

      {/* Blue Sheet section */}
      {activeSection === "bluesheet" && (
        <div className="p-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-medium text-cyan-400 mb-1 block">客户业务目标</label>
              {weakBizObj && <WeakHint dims={[...(weakM ? ["M-价值量化"] : []), ...(weakI ? ["I-痛点识别"] : [])]} />}
              <Textarea className={cn("text-xs h-16 resize-none", weakBizObj && "border-orange-500/50 focus-visible:ring-orange-500/30")} placeholder="此商机解决客户什么核心业务问题？" value={blueSheet.bizObjective} onChange={e => setBlueSheet(p => ({ ...p, bizObjective: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] font-medium text-green-400 mb-1 block">我方价值主张</label>
              {weakValueProp && <WeakHint dims={[...(weakM ? ["M-价值量化"] : []), ...(weakE ? ["E-决策人"] : [])]} />}
              <Textarea className={cn("text-xs h-16 resize-none", weakValueProp && "border-orange-500/50 focus-visible:ring-orange-500/30")} placeholder="针对此商机的差异化价值（量化）" value={blueSheet.valueProposition} onChange={e => setBlueSheet(p => ({ ...p, valueProposition: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-medium text-yellow-400 mb-1 block">Champion</label>
              {weakChampion && <WeakHint dims={["C-Champion"]} />}
              <div className="flex gap-1.5">
                <Input className={cn("h-7 text-xs flex-1", weakChampion && "border-orange-500/50")} placeholder="Champion 姓名" value={blueSheet.champion} onChange={e => setBlueSheet(p => ({ ...p, champion: e.target.value }))} />
                <Select value={blueSheet.championStance} onValueChange={v => setBlueSheet(p => ({ ...p, championStance: v }))}>
                  <SelectTrigger className="h-7 text-xs w-20"><SelectValue /></SelectTrigger>
                  <SelectContent>{STANCE_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-medium text-orange-400 mb-1 block">竞争态势</label>
              {weakCompetitor && <WeakHint dims={["C2-竞争态势"]} />}
              <Input className={cn("h-7 text-xs", weakCompetitor && "border-orange-500/50")} placeholder="竞品名称及应对策略" value={blueSheet.blueSheetCompetitor} onChange={e => setBlueSheet(p => ({ ...p, blueSheetCompetitor: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-medium text-primary mb-1 block">赢单策略</label>
            {weakWinStrat && <WeakHint dims={[...(weakI ? ["I-痛点识别"] : []), ...(weakDc ? ["Dc-决策标准"] : [])]} />}
            <Textarea className={cn("text-xs h-14 resize-none", weakWinStrat && "border-orange-500/50 focus-visible:ring-orange-500/30")} placeholder="针对此商机的具体打法和差异化策略" value={blueSheet.winStrategy} onChange={e => setBlueSheet(p => ({ ...p, winStrategy: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-medium text-blue-400 mb-1 block">关键里程碑</label>
              {weakMilestone && <WeakHint dims={[...(weakDp ? ["Dp-决策流程"] : []), ...(weakP ? ["P-采购流程"] : [])]} />}
              <Textarea className={cn("text-xs h-14 resize-none", weakMilestone && "border-orange-500/50 focus-visible:ring-orange-500/30")} placeholder="时间节点，每行一条" value={blueSheet.keyMilestones} onChange={e => setBlueSheet(p => ({ ...p, keyMilestones: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] font-medium text-red-400 mb-1 block">风险与应对</label>
              {weakRisk && <WeakHint dims={[...(weakDp ? ["Dp-决策流程"] : []), ...(weakP ? ["P-采购流程"] : []), ...(weakE ? ["E-决策人"] : [])]} />}
              <Textarea className={cn("text-xs h-14 resize-none", weakRisk && "border-orange-500/50 focus-visible:ring-orange-500/30")} placeholder="主要风险及应对措施" value={blueSheet.riskAndMitigation} onChange={e => setBlueSheet(p => ({ ...p, riskAndMitigation: e.target.value }))} />
            </div>
          </div>
          <Button size="sm" className="h-7 text-xs gap-1" disabled={savingBlueSheet || updateBlueSheet.isPending}
            onClick={() => { setSavingBlueSheet(true); updateBlueSheet.mutate({ id: opp.id, ...blueSheet, championStance: blueSheet.championStance as "支持" | "中立" | "反对" | "未知" }); }}>
            <Save className="w-3 h-3" />{savingBlueSheet ? "保存中..." : "保存 Blue Sheet"}
          </Button>
        </div>
      )}

      {/* MEDDPICC section */}
      {activeSection === "meddpicc" && (
        <div className="p-3 space-y-2">
          {/* Health summary */}
          <div className="flex items-center gap-3 p-2 bg-muted/20 rounded-lg mb-3">
            <div className="text-center">
              <div className={cn("text-xl font-bold",
                healthPct >= 60 ? "text-green-400" : healthPct >= 35 ? "text-yellow-400" : "text-red-400"
              )}>{healthPct}%</div>
              <div className="text-[10px] text-muted-foreground">健康度</div>
            </div>
            <div className="flex-1">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all",
                  healthPct >= 60 ? "bg-green-500" : healthPct >= 35 ? "bg-yellow-500" : "bg-red-500"
                )} style={{ width: `${healthPct}%` }} />
              </div>
              {weakDimensions.length > 0 && (
                <div className="text-[10px] text-red-400 mt-1">
                  ⚠ 薄弱维度：{weakDimensions.map(d => d.label + "—" + d.fullLabel.split("—")[0].trim()).join("、")}
                </div>
              )}
            </div>
          </div>

          {MEDDPICC_DIMENSIONS.map(dim => {
            const notesKey = dim.key.replace('Score', 'Notes');
            // 商机级分数存 0-4，对应客户级的 0/25/50/75/100
            const rawScore = meddpiccScores[dim.key] ?? 0;
            // 将 0-4 映射到 0/25/50/75/100
            const displayScore = rawScore * 25;
            const oppItem = OPP_MEDDPICC_ITEMS.find(i => i.key === dim.key);
            return (
              <div key={dim.key} className="border border-border/40 rounded-lg p-2.5 space-y-2">
                <div className="flex items-center gap-2">
                  <div className={cn("w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-[10px] font-bold bg-muted/50", oppItem?.color ?? "text-muted-foreground")}>{dim.code}</div>
                  <div className="flex-1">
                    <div className="text-xs font-medium text-foreground">{dim.chineseName}</div>
                    <div className="text-[10px] text-muted-foreground">{dim.question}</div>
                  </div>
                  <div className={cn("text-sm font-bold",
                    displayScore >= 75 ? "text-green-400" : displayScore >= 50 ? "text-yellow-400" : displayScore >= 25 ? "text-orange-400" : "text-red-400/60"
                  )}>{displayScore > 0 ? displayScore : "—"}</div>
                </div>
                {/* 选项卡片 */}
                <div className="space-y-1">
                  {dim.levels.map(level => {
                    const levelVal = level.score / 25; // 0-4
                    const isSelected = rawScore === levelVal;
                    return (
                      <button
                        key={level.score}
                        onClick={() => setMeddpiccScores(p => ({ ...p, [dim.key]: levelVal }))}
                        className={cn(
                          "w-full text-left px-2.5 py-1.5 rounded-md border text-xs transition-colors",
                          isSelected
                            ? "bg-primary/15 border-primary/50 text-foreground"
                            : "bg-muted/10 border-border/30 text-muted-foreground hover:border-primary/30 hover:bg-muted/30"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div className={cn("w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center",
                            isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"
                          )}>
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <span className={cn("font-medium", isSelected ? "text-primary" : "")}>{level.label}</span>
                          <span className={cn("ml-auto text-[10px] font-mono px-1 rounded",
                            level.score >= 75 ? "bg-green-500/20 text-green-400" :
                            level.score >= 50 ? "bg-yellow-500/20 text-yellow-400" :
                            level.score >= 25 ? "bg-orange-500/20 text-orange-400" :
                            "bg-muted/30 text-muted-foreground"
                          )}>{level.score}</span>
                        </div>
                        {isSelected && (
                          <div className="text-[10px] text-muted-foreground mt-0.5 ml-6">{level.description}</div>
                        )}
                      </button>
                    );
                  })}
                </div>
                {/* 备注输入 */}
                <Input className="h-6 text-[11px]" placeholder="证据备注（可选）"
                  value={meddpiccNotes[notesKey] ?? ""}
                  onChange={e => setMeddpiccNotes(p => ({ ...p, [notesKey]: e.target.value }))} />
              </div>
            );
          })}

          <Button size="sm" className="h-7 text-xs gap-1 mt-2" disabled={savingMeddpicc || upsertMeddpicc.isPending}
            onClick={() => {
              setSavingMeddpicc(true);
              const payload: any = { opportunityId: opp.id, clientId };
              MEDDPICC_DIMENSIONS.forEach(dim => {
                payload[dim.key] = meddpiccScores[dim.key] ?? 0;
                const notesKey = dim.key.replace('Score', 'Notes');
                payload[notesKey] = meddpiccNotes[notesKey] ?? "";
              });
              upsertMeddpicc.mutate(payload);
            }}>
            <Save className="w-3 h-3" />{savingMeddpicc ? "保存中..." : "保存 MEDDPICC 评分"}
          </Button>
        </div>
      )}
      {/* Opportunity-level task creation dialog */}
      <Dialog open={showOppTaskDialog} onOpenChange={setShowOppTaskDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Target className="w-4 h-4 text-cyan-400" />
              商机跟进任务 — {opp.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <label className="text-xs text-muted-foreground">责任角色</label>
              <Select value={oppTaskRole} onValueChange={(v) => setOppTaskRole(v as any)}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SAM">SAM — 客户经理（默认）</SelectItem>
                  <SelectItem value="SA">SA — 售前工程师</SelectItem>
                  <SelectItem value="RSM">RSM — 区域销售总监</SelectItem>
                  <SelectItem value="AD">AD — 大客户经理</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">任务标题 *</label>
              <Input
                value={oppTaskTitle}
                onChange={e => setOppTaskTitle(e.target.value)}
                placeholder="输入任务标题"
                className="h-8 text-xs mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">截止日期</label>
              <Input
                type="date"
                value={oppTaskDueDate}
                onChange={e => setOppTaskDueDate(e.target.value)}
                className="h-8 text-xs mt-1"
                min={new Date().toISOString().slice(0, 10)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">任务说明（可选）</label>
              <Textarea
                value={oppTaskDesc}
                onChange={e => setOppTaskDesc(e.target.value)}
                placeholder="详细说明或背景信息"
                className="text-xs mt-1 min-h-[60px] resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowOppTaskDialog(false)}>取消</Button>
            <Button
              size="sm"
              onClick={() => addOppTask.mutate({
                clientId,
                assignedRole: oppTaskRole,
                title: oppTaskTitle,
                description: oppTaskDesc || undefined,
                dueDate: oppTaskDueDate || undefined,
                opportunityId: opp.id,
              })}
              disabled={!oppTaskTitle.trim() || addOppTask.isPending}
            >
              {addOppTask.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
              创建任务
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ActiveFrontsPanel({ clientId, focusOppId }: { clientId: number; focusOppId?: number | null }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expandedOppId, setExpandedOppId] = useState<number | null>(null);
  const [newOpp, setNewOpp] = useState({ name: "", stage: "建图" as string, status: "活跃" as string, competitorName: "", contactName: "", estimatedValue: "", expectedCloseDate: "", notes: "" });
  const [editData, setEditData] = useState<any>({});

  const utils = trpc.useUtils();
  const { data: opps = [], isLoading } = trpc.opportunities.listByClient.useQuery({ clientId });

  const createOpp = trpc.opportunities.create.useMutation({
    onSuccess: () => {
      utils.opportunities.listByClient.invalidate({ clientId });
      toast.success("商机已添加");
      setShowAdd(false);
      setNewOpp({ name: "", stage: "建图", status: "活跃", competitorName: "", contactName: "", estimatedValue: "", expectedCloseDate: "", notes: "" });
    },
  });
  const updateOpp = trpc.opportunities.update.useMutation({
    onSuccess: () => { utils.opportunities.listByClient.invalidate({ clientId }); toast.success("商机已更新"); setEditingId(null); },
  });
  const deleteOpp = trpc.opportunities.delete.useMutation({
    onSuccess: () => { utils.opportunities.listByClient.invalidate({ clientId }); toast.success("已删除"); },
  });

  if (isLoading) return <div className="text-xs text-muted-foreground py-2">加载中...</div>;

  // Compute summary stats
  const activeOpps = opps.filter((o: any) => o.status === '活跃');
  const stageCounts = OPP_STAGES.reduce((acc: Record<string, number>, s) => {
    acc[s] = opps.filter((o: any) => o.stage === s).length;
    return acc;
  }, {});
  const stagesWithOpps = OPP_STAGES.filter(s => stageCounts[s] > 0);
  // Parse estimated values - all amounts are in USD
  // Normalize: strip $ prefix, convert K->*1000, M->*1000000, then sum
  const totalValueUSD = opps.reduce((sum: number, o: any) => {
    if (!o.estimatedValue) return sum;
    const raw = o.estimatedValue.replace(/[$,\s]/g, '').toUpperCase();
    let num: number;
    if (raw.endsWith('M')) {
      num = parseFloat(raw.slice(0, -1)) * 1_000_000;
    } else if (raw.endsWith('K')) {
      num = parseFloat(raw.slice(0, -1)) * 1_000;
    } else {
      num = parseFloat(raw);
    }
    return isNaN(num) ? sum : sum + num;
  }, 0);
  // Format total for display: use M if >= 1M, K if >= 1K, else plain
  const formatUSD = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
    return `$${v.toFixed(0)}`;
  };

  return (
    <div className="space-y-3">
      {/* Summary Dashboard */}
      {opps.length > 0 && (
        <div className="bg-gradient-to-r from-cyan-500/5 to-blue-500/5 border border-cyan-500/20 rounded-lg p-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="text-center">
                <div className="text-lg font-bold text-cyan-400">{opps.length}</div>
                <div className="text-[10px] text-muted-foreground">并行战线</div>
              </div>
            </div>
            <div className="w-px h-8 bg-border/50" />
            <div className="flex items-center gap-2">
              <div className="text-center">
                <div className="text-lg font-bold text-green-400">{activeOpps.length}</div>
                <div className="text-[10px] text-muted-foreground">活跃商机</div>
              </div>
            </div>
            {totalValueUSD > 0 && (
              <>
                <div className="w-px h-8 bg-border/50" />
                <div className="text-center">
                  <div className="text-lg font-bold text-amber-400">{formatUSD(totalValueUSD)}</div>
                  <div className="text-[10px] text-muted-foreground">预估总金额 (USD)</div>
                </div>
              </>
            )}
            {stagesWithOpps.length > 0 && (
              <>
                <div className="w-px h-8 bg-border/50" />
                <div className="flex items-center gap-1.5 flex-wrap">
                  {stagesWithOpps.map(s => (
                    <span key={s} className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", stageColor[s] || "bg-muted text-muted-foreground")}>
                      {s} ×{stageCounts[s]}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {opps.length === 0 && !showAdd && (
        <div className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">
          <Swords className="w-5 h-5 mx-auto mb-1.5 opacity-40" />
          暂无并行商机，点击下方按钮添加战线
        </div>
      )}

      {opps.map((opp: any) => (
        <div
          key={opp.id}
          id={`opp-${opp.id}`}
          className={`rounded-lg border overflow-hidden transition-colors ${
            focusOppId === opp.id
              ? "bg-primary/8 border-primary/40 ring-1 ring-primary/30"
              : "bg-muted/20 border-border/50"
          }`}
        >
          {editingId === opp.id ? (
            <div className="p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground mb-0.5 block">商机名称 *</label>
                  <Input className="h-7 text-xs" defaultValue={opp.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-0.5 block">竞品</label>
                  <Input className="h-7 text-xs" placeholder="QAX / Palo Alto..." defaultValue={opp.competitorName || ""} onChange={(e) => setEditData({ ...editData, competitorName: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground mb-0.5 block">阶段</label>
                  <Select value={editData.stage || opp.stage} onValueChange={(v) => setEditData({ ...editData, stage: v })}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{OPP_STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-0.5 block">状态</label>
                  <Select value={editData.status || opp.status} onValueChange={(v) => setEditData({ ...editData, status: v })}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{OPP_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground mb-0.5 block">对接人</label>
                  <Input className="h-7 text-xs" placeholder="客户侧对接人" defaultValue={opp.contactName || ""} onChange={(e) => setEditData({ ...editData, contactName: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-0.5 block">预估金额</label>
                  <Input className="h-7 text-xs" placeholder="50K (USD)" defaultValue={opp.estimatedValue || ""} onChange={(e) => setEditData({ ...editData, estimatedValue: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground mb-0.5 block">备注</label>
                <Textarea className="text-xs h-12 resize-none" defaultValue={opp.notes || ""} onChange={(e) => setEditData({ ...editData, notes: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="h-6 text-xs px-2 gap-1" onClick={() => updateOpp.mutate({ id: opp.id, ...editData })} disabled={updateOpp.isPending}>
                  <Save className="w-3 h-3" />保存
                </Button>
                <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => { setEditingId(null); setEditData({}); }}>取消</Button>
              </div>
            </div>
          ) : (
            <div className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-medium text-foreground">{opp.name}</span>
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", oppStageColor[opp.stage] || "bg-muted text-muted-foreground")}>{opp.stage}</span>
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", oppStatusColor[opp.status] || "bg-muted text-muted-foreground border-border")}>{opp.status}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                    {opp.competitorName && (
                      <span className="flex items-center gap-1 text-orange-400">
                        <Swords className="w-3 h-3" />{opp.competitorName}
                      </span>
                    )}
                    {opp.contactName && <span>对接：{opp.contactName}</span>}
                    {opp.estimatedValue && <span className="text-cyan-400">{opp.estimatedValue}</span>}
                    {opp.expectedCloseDate && <span>预计结单：{opp.expectedCloseDate}</span>}
                  </div>
                  {opp.notes && <div className="text-xs text-muted-foreground/70 mt-1 line-clamp-1">{opp.notes}</div>}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => setExpandedOppId(expandedOppId === opp.id ? null : opp.id)}
                    className={cn("text-xs px-2 py-0.5 rounded border transition-colors flex items-center gap-1",
                      expandedOppId === opp.id
                        ? "bg-primary/20 text-primary border-primary/40"
                        : "text-muted-foreground hover:text-primary border-border hover:border-primary/40"
                    )}
                  >
                    <Target className="w-3 h-3" />
                    <span className="text-[10px]">蓝图</span>
                  </button>
                  <button onClick={() => { setEditingId(opp.id); setEditData({}); }} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button onClick={() => deleteOpp.mutate({ id: opp.id })} className="text-muted-foreground hover:text-red-400 transition-colors p-1">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              {/* Blue Sheet + MEDDPICC 展开面板 */}
              {expandedOppId === opp.id && (
                <OppBlueSheetPanel
                  opp={opp}
                  clientId={clientId}
                  onClose={() => setExpandedOppId(null)}
                />
              )}
            </div>
          )}
        </div>
      ))}

      {showAdd && (
        <div className="bg-muted/10 rounded-lg p-3 border border-primary/20 space-y-2">
          <div className="text-xs font-medium text-primary mb-2 flex items-center gap-1.5"><Target className="w-3.5 h-3.5" />新增战线</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground mb-0.5 block">商机名称 *</label>
              <Input className="h-7 text-xs" placeholder="如：EDR 端点检测" value={newOpp.name} onChange={(e) => setNewOpp({ ...newOpp, name: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-0.5 block">竞品</label>
              <Input className="h-7 text-xs" placeholder="QAX / Palo Alto..." value={newOpp.competitorName} onChange={(e) => setNewOpp({ ...newOpp, competitorName: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground mb-0.5 block">阶段</label>
              <Select value={newOpp.stage} onValueChange={(v) => setNewOpp({ ...newOpp, stage: v })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{OPP_STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-0.5 block">对接人</label>
              <Input className="h-7 text-xs" placeholder="客户侧对接人" value={newOpp.contactName} onChange={(e) => setNewOpp({ ...newOpp, contactName: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground mb-0.5 block">预估金额</label>
              <Input className="h-7 text-xs" placeholder="50K (USD)" value={newOpp.estimatedValue} onChange={(e) => setNewOpp({ ...newOpp, estimatedValue: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-0.5 block">预计结单</label>
              <Input className="h-7 text-xs" placeholder="Q4 2026" value={newOpp.expectedCloseDate} onChange={(e) => setNewOpp({ ...newOpp, expectedCloseDate: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-0.5 block">备注</label>
            <Textarea className="text-xs h-10 resize-none" placeholder="商机背景..." value={newOpp.notes} onChange={(e) => setNewOpp({ ...newOpp, notes: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs gap-1" disabled={!newOpp.name || createOpp.isPending}
              onClick={() => createOpp.mutate({ clientId, ...newOpp as any })}>
              <Plus className="w-3 h-3" />添加
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowAdd(false)}>取消</Button>
          </div>
        </div>
      )}

      {!showAdd && (
        <button onClick={() => setShowAdd(true)}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors py-2 border border-dashed border-border hover:border-primary/40 rounded-lg">
          <Plus className="w-3 h-3" />新增战线
        </button>
      )}
    </div>
  );
}

function KeyContactsPanel({ clientId, clientName }: { clientId: number; clientName: string }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [chainAnalysis, setChainAnalysis] = useState<{ reportingChain: string; tips: any[] } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [showChainPanel, setShowChainPanel] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<number>>(new Set());
  const [confirmBatchDeleteContacts, setConfirmBatchDeleteContacts] = useState(false);
  const [batchDeletingContacts, setBatchDeletingContacts] = useState(false);
  const [newContact, setNewContact] = useState({
    name: "", title: "", department: "", influence: "影响者", relationship: "未接触", email: "", linkedinUrl: "", notes: ""
    , buyingRole: "未知"
  });
  const [editData, setEditData] = useState<any>({});

  const utils = trpc.useUtils();
  const { data: contacts = [], isLoading } = trpc.contacts.listByClient.useQuery({ clientId });

  const addContact = trpc.contacts.add.useMutation({
    onSuccess: () => {
      utils.contacts.listByClient.invalidate({ clientId });
      toast.success("关键人已添加");
      setShowAdd(false);
      setNewContact({ name: "", title: "", department: "", influence: "影响者", relationship: "未接触", email: "", linkedinUrl: "", notes: "", buyingRole: "未知" });
    },
  });

  const updateContact = trpc.contacts.update.useMutation({
    onSuccess: () => {
      utils.contacts.listByClient.invalidate({ clientId });
      toast.success("关键人信息已更新");
      setEditingId(null);
    },
  });

  const deleteContact = trpc.contacts.delete.useMutation({
    onSuccess: () => {
      utils.contacts.listByClient.invalidate({ clientId });
      toast.success("已删除");
    },
  });

  const deleteContactBatchMutation = trpc.contacts.deleteBatch.useMutation({
    onSuccess: () => {
      utils.contacts.listByClient.invalidate({ clientId });
      setSelectedContactIds(new Set());
      setConfirmBatchDeleteContacts(false);
      setBatchDeletingContacts(false);
      toast.success("已批量删除所选关键人");
    },
    onError: () => {
      setBatchDeletingContacts(false);
      toast.error("批量删除失败，请重试");
    },
  });

  const toggleContactSelect = (id: number) => {
    setSelectedContactIds(prev => {
      const next = new Set(Array.from(prev));
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllContacts = () => {
    if (selectedContactIds.size === contacts.length) {
      setSelectedContactIds(new Set());
    } else {
      setSelectedContactIds(new Set(contacts.map((c: any) => c.id)));
    }
  };

  const analyzeChain = trpc.contacts.analyzeChain.useMutation({
    onSuccess: (data: any) => {
      setChainAnalysis(data);
      setShowChainPanel(true);
      setAnalyzing(false);
      toast.success("AI 关键人分析完成");
    },
    onError: (e: any) => {
      toast.error("分析失败: " + e.message);
      setAnalyzing(false);
    },
  });

  if (isLoading) return <div className="text-xs text-muted-foreground py-2">加载中...</div>;

  return (
    <div className="space-y-3">
      {/* AI Chain Analysis Button + Panel */}
      <div className="flex items-center justify-between">
        <div className="text-[10px] text-muted-foreground">分析汇报链路并生成突破话术</div>
        <button
          onClick={() => { setAnalyzing(true); analyzeChain.mutate({ clientId, clientName }); }}
          disabled={analyzing || contacts.length === 0}
          className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 border border-primary/30 hover:border-primary/60 rounded px-2 py-1 transition-all disabled:opacity-40">
          <Sparkles className="w-3 h-3" />
          {analyzing ? 'AI分析中...' : 'AI 关键人突破建议'}
        </button>
      </div>

      {/* Chain Analysis Result Panel */}
      {showChainPanel && chainAnalysis && (
        <div className="bg-cyan-950/20 border border-cyan-800/30 rounded-xl p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-cyan-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              AI 关键人分析
            </div>
            <button onClick={() => setShowChainPanel(false)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {chainAnalysis.reportingChain && (
            <div className="bg-cyan-900/20 rounded-lg px-3 py-2">
              <div className="text-[10px] text-cyan-400/80 mb-1">汇报链路</div>
              <div className="text-xs text-foreground font-medium">{chainAnalysis.reportingChain}</div>
            </div>
          )}
          {chainAnalysis.tips && chainAnalysis.tips.length > 0 && (
            <div className="space-y-2">
              {chainAnalysis.tips.map((tip: any, i: number) => (
                <div key={i} className="bg-background/40 border border-border/50 rounded-lg p-2.5 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <UserCheck className="w-3 h-3 text-primary" />
                    <span className="text-xs font-medium text-foreground">{tip.contactName}</span>
                    {tip.approachStrategy && (
                      <span className="text-[10px] text-muted-foreground ml-auto">{tip.approachStrategy}</span>
                    )}
                  </div>
                  {tip.persona && (
                    <div className="text-[10px] text-muted-foreground/80 leading-relaxed">{tip.persona}</div>
                  )}
                  {tip.breakthroughTip && (
                    <div className="bg-primary/5 border border-primary/20 rounded px-2 py-1.5">
                      <div className="text-[10px] text-primary/80 mb-0.5">快速认知对齐话术</div>
                      <div className="text-xs text-foreground leading-relaxed">{tip.breakthroughTip}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Buying Group 覆盖缺口分析 */}
      {contacts.length > 0 && (() => {
        const roles = contacts.map((c: any) => c.buyingRole || '未知');
        const missing = [];
        if (!roles.includes('经济决策人')) missing.push('经济决策人 (E)');
        if (!roles.includes('技术决策人')) missing.push('技术决策人 (D)');
        if (!roles.includes('Champion')) missing.push('Champion (C)');
        const blockers = contacts.filter((c: any) => c.buyingRole === '阻碍者');
        return (missing.length > 0 || blockers.length > 0) ? (
          <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-2.5 mb-2">
            <div className="text-[10px] font-medium text-orange-400 mb-1.5 flex items-center gap-1">
              <span>⚠</span> Buying Group 覆盖缺口
            </div>
            {missing.length > 0 && (
              <div className="text-[10px] text-muted-foreground mb-1">
                <span className="text-orange-300/80">未覆盖关键角色：</span>{missing.join(' · ')}
              </div>
            )}
            {blockers.length > 0 && (
              <div className="text-[10px] text-red-400/80">
                <span className="text-red-400">⛔ 已识别阻碍者：</span>{blockers.map((c: any) => c.name).join('、')}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-2 mb-2">
            <div className="text-[10px] text-green-400 flex items-center gap-1">
              <span>✓</span> Buying Group 核心角色已全部覆盖
            </div>
          </div>
        );
      })()}

      {/* Batch select toolbar */}
      {contacts.length > 0 && (
        <div className="flex items-center justify-between px-1 pb-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" className="w-3.5 h-3.5 accent-primary"
              checked={selectedContactIds.size === contacts.length && contacts.length > 0}
              onChange={toggleSelectAllContacts} />
            <span className="text-xs text-muted-foreground">
              {selectedContactIds.size > 0 ? `已选 ${selectedContactIds.size} 人` : "全选"}
            </span>
          </label>
          {selectedContactIds.size > 0 && (
            <Button variant="destructive" size="sm" className="h-6 text-xs px-2 gap-1"
              onClick={() => setConfirmBatchDeleteContacts(true)}>
              <Trash2 className="w-3 h-3" />删除所选 ({selectedContactIds.size})
            </Button>
          )}
        </div>
      )}

      {/* Contact list */}
      {contacts.length === 0 && !showAdd && (
        <div className="text-xs text-muted-foreground text-center py-3 border border-dashed border-border rounded-lg">
          暂无关键人，点击下方按钮添加
        </div>
      )}

      {contacts.map((contact) => (
        <div key={contact.id} className="bg-muted/20 rounded-lg p-3 border border-border/50">
          {editingId === contact.id ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground mb-0.5 block">姓名 *</label>
                  <Input className="h-7 text-xs" defaultValue={contact.name}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-0.5 block">职位</label>
                  <Input className="h-7 text-xs" defaultValue={contact.title || ""}
                    onChange={(e) => setEditData({ ...editData, title: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground mb-0.5 block">影响力类型</label>
                  <Select value={editData.influence || contact.influence || "影响者"}
                    onValueChange={(v) => setEditData({ ...editData, influence: v })}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{INFLUENCE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-0.5 block">Buying Group角色</label>
                  <div data-highlight="champion-role">
                  <Select value={editData.buyingRole || (contact as any).buyingRole || "未知"}
                    onValueChange={(v) => setEditData({ ...editData, buyingRole: v })}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{BUYING_ROLE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-0.5 block">关系状态</label>
                  <Select value={editData.relationship || contact.relationship || "未接触"}
                    onValueChange={(v) => setEditData({ ...editData, relationship: v })}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{RELATIONSHIP_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground mb-0.5 block">备注</label>
                <Textarea className="text-xs h-12 resize-none" defaultValue={contact.notes || ""}
                  onChange={(e) => setEditData({ ...editData, notes: e.target.value })} />
              </div>
              {/* 关系深度数据 */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground mb-0.5 block">非正式接触次数</label>
                  <Input data-highlight="informal-count" type="number" className="h-6 text-xs" defaultValue={(contact as any).informalContactCount || 0}
                    onChange={(e) => setEditData({ ...editData, informalContactCount: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-0.5 block">客户主动发起次数</label>
                  <Input type="number" className="h-6 text-xs" defaultValue={(contact as any).customerInitiatedCount || 0}
                    onChange={(e) => setEditData({ ...editData, customerInitiatedCount: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="flex gap-3 items-center">
                <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
                  <input type="checkbox" defaultChecked={(contact as any).hasWhatsapp || false}
                    onChange={(e) => setEditData({ ...editData, hasWhatsapp: e.target.checked })}
                    className="w-3 h-3" />
                  💬 WhatsApp 渠道
                </label>
                <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
                  <input type="checkbox" defaultChecked={(contact as any).hasFeishu || false}
                    onChange={(e) => setEditData({ ...editData, hasWeChat: e.target.checked })}
                    className="w-3 h-3" />
              💚 微信渠道
                </label>
              </div>
              {/* Champion 三维评分（仅当 buyingRole 为 Champion 时显示） */}
              {((editData.buyingRole ?? (contact as any).buyingRole) === "Champion" || contact.relationship === "Champion") && (
                <div className="border border-green-500/30 rounded-lg p-2.5 bg-green-500/5 space-y-2">
                  <div className="text-[10px] font-semibold text-green-400 mb-1.5">🏆 Champion 三维评分（1-3分）</div>
                  {/* Political Will 校验 */}
                  {(() => {
                    const pw = editData.championPoliticalWill ?? (contact as any).championPoliticalWill ?? 0;
                    const informal = editData.informalContactCount ?? (contact as any).informalContactCount ?? 0;
                    const showWarning = pw >= 2 && informal === 0;
                    return showWarning ? (
                      <div className="flex items-start gap-1.5 p-2 rounded bg-yellow-500/10 border border-yellow-500/30 text-[10px] text-yellow-400">
                        <span className="mt-0.5">⚠️</span>
                        <span>Political Will ≥2 但非正式接触次数为 0，Champion 意愿评分可能虚高——建议先完成至少 1 次非正式接触（饭局/微信私聊）再评分。</span>
                      </div>
                    ) : null;
                  })()}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground mb-0.5 block">触达 EB 能力</label>
                      <select className="w-full h-6 text-xs bg-muted/30 border border-border rounded px-1"
                        defaultValue={(contact as any).championAccessToPower || 0}
                        onChange={e => setEditData({ ...editData, championAccessToPower: parseInt(e.target.value) })}>
                        <option value={0}>未评</option>
                        <option value={1}>1 — 弱</option>
                        <option value={2}>2 — 中</option>
                        <option value={3}>3 — 强</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground mb-0.5 block">Political Will</label>
                      <select className="w-full h-6 text-xs bg-muted/30 border border-border rounded px-1"
                        defaultValue={(contact as any).championPoliticalWill || 0}
                        onChange={e => setEditData({ ...editData, championPoliticalWill: parseInt(e.target.value) })}>
                        <option value={0}>未评</option>
                        <option value={1}>1 — 被动</option>
                        <option value={2}>2 — 支持</option>
                        <option value={3}>3 — 主动推</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground mb-0.5 block">可信度</label>
                      <select className="w-full h-6 text-xs bg-muted/30 border border-border rounded px-1"
                        defaultValue={(contact as any).championCredibility || 0}
                        onChange={e => setEditData({ ...editData, championCredibility: parseInt(e.target.value) })}>
                        <option value={0}>未评</option>
                        <option value={1}>1 — 一般</option>
                        <option value={2}>2 — 受信任</option>
                        <option value={3}>3 — 高影响力</option>
                      </select>
                    </div>
                  </div>
                  {/* Show total score */}
                  {(() => {
                    const a = editData.championAccessToPower ?? (contact as any).championAccessToPower ?? 0;
                    const p = editData.championPoliticalWill ?? (contact as any).championPoliticalWill ?? 0;
                    const c = editData.championCredibility ?? (contact as any).championCredibility ?? 0;
                    const total = a + p + c;
                    if (total === 0) return null;
                    const color = total >= 7 ? "text-green-400" : total >= 5 ? "text-yellow-400" : "text-red-400";
                    const label = total >= 7 ? "强Champion" : total >= 5 ? "中等Champion" : "弱Champion";
                    return (
                      <div className={`text-[10px] font-medium ${color}`}>
                        综合评分：{total}/9 — {label}
                      </div>
                    );
                  })()}
                </div>
              )}
              <div className="flex gap-2">
                <Button size="sm" className="h-6 text-xs px-2 gap-1" onClick={() => updateContact.mutate({ id: contact.id, ...editData })}
                  disabled={updateContact.isPending}>
                  <Save className="w-3 h-3" />保存
                </Button>
                <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => { setEditingId(null); setEditData({}); }}>取消</Button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{contact.name}</span>
                    {contact.influence && (
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", influenceColor[contact.influence] || "bg-muted text-muted-foreground border-border")}>
                        {contact.influence}
                      </span>
                    )}
                    {(contact as any).buyingRole && (contact as any).buyingRole !== '未知' && (
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", buyingRoleColor[(contact as any).buyingRole] || "bg-muted text-muted-foreground border-border")}>
                        {(contact as any).buyingRole}
                      </span>
                    )}
                  </div>
                  {contact.title && <div className="text-xs text-muted-foreground mt-0.5">{contact.title}{contact.department && ` · ${contact.department}`}</div>}
                  {contact.notes && <div className="text-xs text-muted-foreground/80 mt-1 line-clamp-2">{contact.notes}</div>}
                  {contact.email && <div className="text-xs text-primary/70 mt-0.5">{contact.email}</div>}
                  {/* Stance quick toggle */}
                  {/* 关系深度矩阵：非正式接触数据 */}
                  {((contact as any).informalContactCount > 0 || (contact as any).customerInitiatedCount > 0 || (contact as any).hasWhatsapp || (contact as any).hasWeChat) && (
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {(contact as any).customerInitiatedCount > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 font-medium">
                          ⭐ 客户主动 ×{(contact as any).customerInitiatedCount}
                        </span>
                      )}
                      {(contact as any).informalContactCount > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          🍽️ 非正式 ×{(contact as any).informalContactCount}
                        </span>
                      )}
                      {(contact as any).hasWhatsapp && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">💬 WA</span>
                      )}
                      {(contact as any).hasWeChat && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-600/10 text-green-400 border border-green-600/20">💚 微信</span>
                      )}
                    </div>
                  )}
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {(['支持', '中立', '反对', '未知'] as const).map(s => {
                      const stanceConfig = { '支持': { icon: '🟢', active: 'bg-green-500/20 text-green-400 border-green-500/40' }, '中立': { icon: '🟡', active: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' }, '反对': { icon: '🔴', active: 'bg-red-500/20 text-red-400 border-red-500/40' }, '未知': { icon: '⚪', active: 'bg-muted/50 text-muted-foreground border-border' } };
                      const cfg = stanceConfig[s];
                      const isActive = (contact.stance || '未知') === s;
                      return (
                        <button key={s} onClick={() => updateContact.mutate({ id: contact.id, stance: s as any })}
                          className={cn("text-[10px] px-2 py-0.5 rounded-full border transition-all",
                            isActive ? cfg.active + ' font-bold' : 'bg-transparent text-muted-foreground/60 border-border/40 hover:border-muted-foreground/40 hover:text-muted-foreground'
                          )}
                          disabled={updateContact.isPending}>
                          {cfg.icon} {s}
                        </button>
                      );
                    })}
                  </div>
                  {/* Quick relationship status chips */}
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {RELATIONSHIP_OPTIONS.map(opt => (
                      <button
                        key={opt}
                        onClick={() => updateContact.mutate({ id: contact.id, relationship: opt as any })}
                        className={cn(
                          "text-[10px] px-2 py-0.5 rounded-full border transition-all",
                          contact.relationship === opt
                            ? opt === "Champion" ? "bg-green-500/20 text-green-400 border-green-500/40 font-bold"
                              : opt === "建立关系" ? "bg-orange-500/20 text-orange-400 border-orange-500/40 font-bold"
                              : opt === "初步接触" ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/40 font-bold"
                              : opt === "已识别" ? "bg-blue-500/20 text-blue-400 border-blue-500/40 font-bold"
                              : opt === "已接触" ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/40 font-bold"
                              : opt === "已拒绝" ? "bg-red-500/20 text-red-400 border-red-500/40 font-bold"
                              : opt === "待接触" ? "bg-muted/50 text-muted-foreground border-border font-bold"
                              : "bg-muted/50 text-muted-foreground border-border font-bold"
                            : "bg-transparent text-muted-foreground/60 border-border/40 hover:border-muted-foreground/40 hover:text-muted-foreground"
                        )}
                        disabled={updateContact.isPending}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => { setEditingId(contact.id); setEditData({}); }}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1">
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button onClick={() => deleteContact.mutate({ id: contact.id })}
                    className="text-muted-foreground hover:text-red-400 transition-colors p-1">
                    <Trash2 className="w-3 h-3" />
                  </button>
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5 accent-primary ml-0.5"
                    checked={selectedContactIds.has(contact.id)}
                    onChange={() => toggleContactSelect(contact.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Add new contact form */}
      {showAdd && (
        <div className="bg-muted/10 rounded-lg p-3 border border-primary/20 space-y-2">
          <div className="text-xs font-medium text-primary mb-2">添加关键人</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground mb-0.5 block">姓名 *</label>
              <Input className="h-7 text-xs" placeholder="姓名" value={newContact.name}
                onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-0.5 block">职位</label>
              <Input className="h-7 text-xs" placeholder="CTO / CISO / CDO..." value={newContact.title}
                onChange={(e) => setNewContact({ ...newContact, title: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground mb-0.5 block">部门</label>
              <Input className="h-7 text-xs" placeholder="部门" value={newContact.department}
                onChange={(e) => setNewContact({ ...newContact, department: e.target.value })} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-0.5 block">邮箱</label>
              <Input className="h-7 text-xs" placeholder="email@company.com" value={newContact.email}
                onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground mb-0.5 block">影响力类型</label>
              <Select value={newContact.influence} onValueChange={(v) => setNewContact({ ...newContact, influence: v })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{INFLUENCE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-0.5 block">关系状态</label>
              <Select value={newContact.relationship} onValueChange={(v) => setNewContact({ ...newContact, relationship: v })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{RELATIONSHIP_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-0.5 block">备注（背景、切入点等）</label>
            <Textarea className="text-xs h-14 resize-none" placeholder="关键背景信息、触达建议..." value={newContact.notes}
              onChange={(e) => setNewContact({ ...newContact, notes: e.target.value })} />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-0.5 block">Buying Group 角色</label>
            <Select value={newContact.buyingRole} onValueChange={(v) => setNewContact({ ...newContact, buyingRole: v })}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{BUYING_ROLE_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs gap-1" disabled={!newContact.name || addContact.isPending}
              onClick={() => addContact.mutate({ clientId, ...newContact as any })}>
              <Plus className="w-3 h-3" />添加
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowAdd(false)}>取消</Button>
          </div>
        </div>
      )}

      {!showAdd && (
        <button onClick={() => setShowAdd(true)}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors py-2 border border-dashed border-border hover:border-primary/40 rounded-lg">
          <Plus className="w-3 h-3" />添加关键人
        </button>
      )}

      {/* Batch Delete Contacts Confirmation Dialog */}
      {confirmBatchDeleteContacts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-xl p-5 max-w-sm w-full mx-4 shadow-xl">
            <div className="flex items-center gap-2 mb-3 text-red-400">
              <Trash2 className="w-4 h-4" />
              <span className="font-semibold text-sm">确认批量删除关键人</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              即将永久删除 <span className="text-red-400 font-medium">{selectedContactIds.size} 位</span> 关键人，此操作不可撤销。
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmBatchDeleteContacts(false)}
                className="px-3 py-1.5 text-xs rounded-md border border-border hover:bg-muted/30 transition-colors">取消</button>
              <button
                disabled={batchDeletingContacts}
                onClick={() => { setBatchDeletingContacts(true); deleteContactBatchMutation.mutate({ ids: Array.from(selectedContactIds) }); }}
                className="px-3 py-1.5 text-xs rounded-md bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 transition-colors disabled:opacity-50">
                {batchDeletingContacts ? "删除中..." : `确认删除 ${selectedContactIds.size} 人`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ClientCard({ client, onFocus, defaultExpanded, initialTab, focusOppId }: {
  client: any;
  onFocus?: () => void;
  defaultExpanded?: boolean;
  initialTab?: "meddpicc" | "contacts" | "trend" | "fronts" | "winstrategy" | "spin";
  focusOppId?: number | null;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);
  const [activeTab, setActiveTab] = useState<"meddpicc" | "contacts" | "trend" | "fronts" | "winstrategy" | "spin" | "metrics">(initialTab ?? "meddpicc");
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [meddpiccEdit, setMeddpiccEdit] = useState<any>({});
  const [logNote, setLogNote] = useState<Record<string, string>>({});
  const [expandedDim, setExpandedDim] = useState<string | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestReasoning, setSuggestReasoning] = useState<string>('');
  const [showStageGate, setShowStageGate] = useState(false);
  const { role } = useRole();

  const utils = trpc.useUtils();
  const { data: meddpicc } = trpc.meddpicc.get.useQuery({ clientId: client.id });
  const { data: currentUserCard } = trpc.emailAuth.me.useQuery();
  const isAD = !currentUserCard || currentUserCard.podRole === 'AD';
  // When no DB record exists yet, fall back to all-zero defaults so the panel is always interactive
  const DEFAULT_MEDDPICC = {
    metricsScore: 0, economicBuyerScore: 0, decisionCriteriaScore: 0,
    decisionProcessScore: 0, paperProcessScore: 0, implicatePainScore: 0,
    championScore: 0, competitionScore: 0, economicBuyerName: "", championName: "",
  };
  const effectiveMeddpicc: any = meddpicc ?? DEFAULT_MEDDPICC;
  // 始终查询商机级 MEDDPICC，用于聚合显示
  const { data: oppMeddpiccList = [] } = trpc.opportunities.listMeddpiccByClient.useQuery({ clientId: client.id });
  const { data: contacts = [] } = trpc.contacts.listByClient.useQuery({ clientId: client.id });
  const { data: historySnapshots = [] } = trpc.meddpicc.history.useQuery({ clientId: client.id, weeks: 16 }, { enabled: expanded && activeTab === "trend" });
  const { data: opps = [] } = trpc.opportunities.listByClient.useQuery({ clientId: client.id }, { enabled: expanded && activeTab === "fronts" });
  const { data: winStrategy, refetch: refetchWinStrategy } = trpc.winStrategy.get.useQuery({ clientId: client.id }, { enabled: expanded && activeTab === "winstrategy" });
  const [wsGenerating, setWsGenerating] = useState(false);
  const [wsEdit, setWsEdit] = useState<any>(null);
  const saveWinStrategy = trpc.winStrategy.upsert.useMutation({ onSuccess: () => { refetchWinStrategy(); toast.success("Win Strategy 已保存"); setWsEdit(null); } });
  const generateWinStrategy = trpc.winStrategy.generateAI.useMutation({
    onSuccess: () => { refetchWinStrategy(); setWsGenerating(false); toast.success("AI Win Strategy 已生成"); },
    onError: () => setWsGenerating(false),
  });

  const suggestMutation = trpc.clients.suggestHookAndAngle.useMutation();
  // P1a/P1b: AI Review
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewContent, setReviewContent] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewType, setReviewType] = useState<"0to1" | "1toN" | "buyingGroup" | "visitTrend">("0to1");
  const [reviewOppId, setReviewOppId] = useState<number | null>(null);
  // Review 改进闭环：提升到组件顶层（不能在 IIFE 中调用 hook）
  const { data: reviewDelta } = trpc.insights.getReviewDelta.useQuery(
    { clientId: client.id, reviewType },
    { enabled: reviewOpen && !reviewLoading && !!reviewContent }
  );
  const reviewZeroToOneMut = trpc.insights.reviewZeroToOne.useMutation();
  const reviewOneToNMut = trpc.insights.reviewOneToN.useMutation();
  const reviewBuyingGroupMut = trpc.insights.reviewBuyingGroup.useMutation();
  const reviewVisitTrendMut = trpc.insights.reviewVisitTrend.useMutation();
  const [reviewDropdownOpen, setReviewDropdownOpen] = useState(false);
  const adInquiryMut = trpc.insights.generateAdInquiry.useMutation();
  const [adInquiryOpen, setAdInquiryOpen] = useState(false);
  const [adInquiryContent, setAdInquiryContent] = useState("");
  const [adInquiryLoading, setAdInquiryLoading] = useState(false);
  const [adInquiryNotes, setAdInquiryNotes] = useState("");
  const [adInquiryStageType, setAdInquiryStageType] = useState<"0to1" | "1toN">("0to1");
  const [coachingSummary, setCoachingSummary] = useState("");
  const [coachingSummaryLoading, setCoachingSummaryLoading] = useState(false);
  const [coachingSummaryStageLabel, setCoachingSummaryStageLabel] = useState("");
  const [dispatchingToSam, setDispatchingToSam] = useState(false);
  const [dispatchEditOpen, setDispatchEditOpen] = useState(false);
  const [dispatchEditContent, setDispatchEditContent] = useState("");
  const coachingSummaryMut = trpc.insights.generateCoachingSummary.useMutation();
  const createCoachingActionsMut = trpc.insights.createCoachingActions.useMutation();

  const handleGenerateCoachingSummary = async () => {
    if (!adInquiryNotes.trim()) { toast.error("请先填写 SAM 回答记录"); return; }
    setCoachingSummaryLoading(true); setCoachingSummary(""); setCoachingSummaryStageLabel("");
    try {
      const res = await coachingSummaryMut.mutateAsync({
        clientId: client.id,
        stageType: adInquiryStageType,
        inquiryQuestions: adInquiryContent,
        samAnswerNotes: adInquiryNotes,
      });
      setCoachingSummary(res.content);
      setCoachingSummaryStageLabel(res.stageLabel || "");
    } catch (e: any) { toast.error("生成失败：" + (e?.message || "未知错误")); }
    finally { setCoachingSummaryLoading(false); }
  };

  const handleDispatchToSam = () => {
    const samId = (client as any).assignedSamId;
    const samName = (client as any).assignedSamName;
    if (!samId || !samName) { toast.error("该客户尚未分配 SAM，请先分配 SAM"); return; }
    if (!coachingSummary) { toast.error("请先生成辅导建议"); return; }
    // Open edit dialog with current coaching summary
    setDispatchEditContent(coachingSummary);
    setDispatchEditOpen(true);
  };

  const handleConfirmDispatch = async () => {
    const samId = (client as any).assignedSamId;
    const samName = (client as any).assignedSamName;
    if (!samId || !samName) return;
    setDispatchingToSam(true);
    try {
      const lines = dispatchEditContent.split("\n").filter(l => l.trim());
      const focusLine = lines.find(l => l.includes("下次") && l.includes("关注"));
      const actions = [
        { title: `[${coachingSummaryStageLabel || adInquiryStageType}] ${client.name} 辅导任务`, description: dispatchEditContent.slice(0, 800), clientId: client.id },
        ...(focusLine ? [{ title: `下次Review关注：${focusLine.replace(/\*\*/g, "").replace(/^.*：/, "").trim().slice(0, 50)}`, clientId: client.id }] : []),
      ];
      await createCoachingActionsMut.mutateAsync({ samId, samName, actions, createdBy: "AD" });
      toast.success(`辅导建议已下发给 ${samName}`);
      setDispatchEditOpen(false);
    } catch (e: any) { toast.error("下发失败：" + (e?.message || "未知错误")); }
    finally { setDispatchingToSam(false); }
  };

  const handleAdInquiry = async (stageType: "0to1" | "1toN", oppId?: number) => {
    setAdInquiryStageType(stageType);
    setAdInquiryOpen(true); setAdInquiryLoading(true); setAdInquiryContent(""); setReviewDropdownOpen(false);
    try {
      const res = await adInquiryMut.mutateAsync({ clientId: client.id, opportunityId: oppId, stageType });
      setAdInquiryContent(res.content);
    } catch (e: any) { setAdInquiryContent("生成失败：" + (e?.message || "未知错误")); }
    finally { setAdInquiryLoading(false); }
  };
  // L2: Review 持久化
  const saveReviewMut = trpc.insights.saveReview.useMutation();
  const { data: latestReviews = [] } = trpc.insights.getLatestReviews.useQuery({ clientId: client.id });
  const [reviewSavedAt, setReviewSavedAt] = useState<Date | null>(null);
  const [highlightedSection, setHighlightedSection] = useState<string | null>(null);
  const [highlightTarget, setHighlightTarget] = useState<string | null>(null);
  const [highlightBubble, setHighlightBubble] = useState<string | null>(null);

  // Auto-highlight target field after tab switch
  useEffect(() => {
    if (!highlightTarget) return;
    const timer = setTimeout(() => {
      // Find and highlight the target element
      const el = document.querySelector(`[data-highlight="${highlightTarget}"]`) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-yellow-400", "ring-offset-1");
        setTimeout(() => {
          el.classList.remove("ring-2", "ring-yellow-400", "ring-offset-1");
          setHighlightTarget(null);
          setHighlightBubble(null);
        }, 3000);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [highlightTarget, activeTab]);

  // Map contradiction keywords to section anchors
  const contradictionKeyMap: Record<string, string> = {
    "EB评分": "economic-buyer", "经济买家": "economic-buyer",
    "Champion评分": "champion", "Champion": "champion", "Political Will": "champion",
    "技术验证": "technical-verification", "SA参与": "technical-verification",
    "Blue Sheet": "blue-sheet", "方案提案": "blue-sheet",
    "关键人数量": "contacts", "建图": "contacts",
    "痛点": "pain", "客户原话": "pain",
    "EB未接触": "economic-buyer",
  };

  const getHighlightKey = (warningText: string) => {
    for (const [keyword, key] of Object.entries(contradictionKeyMap)) {
      if (warningText.includes(keyword)) return key;
    }
    return null;
  };
  // 负责 SAM 分配
  const [samDropdownOpen, setSamDropdownOpen] = useState(false);
  const { data: samUsers = [] } = trpc.clients.listSamUsers.useQuery();
  const assignSamMut = trpc.clients.assignSam.useMutation({
    onSuccess: () => { utils.clients.list.invalidate(); toast.success("SAM 分配已更新"); setSamDropdownOpen(false); },
  });
  // 负责 RSM 分配
  const [rsmDropdownOpen, setRsmDropdownOpen] = useState(false);
  const assignRsmMut = trpc.clients.assignRsm.useMutation({
    onSuccess: () => { utils.clients.list.invalidate(); toast.success("RSM 分配已更新"); setRsmDropdownOpen(false); },
  });
  const rsmUsers = samUsers.filter((u: any) => u.podRole === 'RSM');

  const handleReview = async (type: "0to1" | "1toN" | "buyingGroup" | "visitTrend", oppId?: number) => {
    setReviewType(type as any);
    setReviewOppId(oppId ?? null);
    setReviewOpen(true);
    setReviewLoading(true);
    setReviewContent("");
    setReviewDropdownOpen(false);
    try {
      let generatedContent = "";
      if (type === "0to1") {
        const res = await reviewZeroToOneMut.mutateAsync({ clientId: client.id });
        generatedContent = res.content;
      } else if (type === "1toN" && oppId) {
        const res = await reviewOneToNMut.mutateAsync({ clientId: client.id, opportunityId: oppId });
        generatedContent = res.content;
      } else if (type === "buyingGroup") {
        const res = await reviewBuyingGroupMut.mutateAsync({ clientId: client.id });
        generatedContent = res.content;
      } else if (type === "visitTrend") {
        const res = await reviewVisitTrendMut.mutateAsync({ clientId: client.id });
        generatedContent = res.content;
      } else {
        generatedContent = "请先选择一个商机后再进行1→N Review。";
      }
      setReviewContent(generatedContent);
      // L2: 自动保存 Review 结果到数据库
      if (generatedContent && !generatedContent.startsWith("请先") && !generatedContent.startsWith("AI Review 生成失败")) {
        const now = new Date();
        setReviewSavedAt(now);
        saveReviewMut.mutate({
          clientId: client.id,
          opportunityId: oppId ?? undefined,
          reviewType: type,
          content: generatedContent,
        });
      }
    } catch (e: any) {
      setReviewContent("AI Review 生成失败：" + (e?.message || "未知错误"));
    } finally {
      setReviewLoading(false);
    }
  };

  // 加载历史 Review（打开 Dialog 时如果没有新内容，显示上次结果）
  const loadHistoryReview = (type: "0to1" | "1toN" | "buyingGroup" | "visitTrend", oppId?: number) => {
    const key = type + (oppId ? `_${oppId}` : '');
    const hist = latestReviews.find((r: any) => {
      const rKey = r.reviewType + (r.opportunityId ? `_${r.opportunityId}` : '');
      return rKey === key;
    });
    if (hist) {
      setReviewContent(hist.content);
      setReviewSavedAt(new Date(hist.createdAt));
    }
  };

  const updateClient = trpc.clients.update.useMutation({
    onSuccess: () => { utils.clients.list.invalidate(); toast.success("客户信息已更新"); setEditing(false); }
  });
  const updateMeddpicc = trpc.meddpicc.update.useMutation({
    onSuccess: () => { utils.meddpicc.get.invalidate({ clientId: client.id }); utils.meddpicc.getLogs.invalidate({ clientId: client.id }); toast.success("MEDDPICC已更新"); }
  });
  const addLog = trpc.meddpicc.addLog.useMutation({
    onSuccess: (_, vars) => { utils.meddpicc.getLogs.invalidate({ clientId: client.id, dimension: vars.dimension }); }
  });
  const { data: allLogs = [] } = trpc.meddpicc.getLogs.useQuery({ clientId: client.id }, { enabled: expanded && activeTab === "meddpicc" });

  // 商机级聚合：如果有商机 MEDDPICC 数据则使用均值，否则回退到客户级手动评分
  const avgScore = (() => {
    const oppAvgs: number[] = [];
    oppMeddpiccList.forEach((opp: any) => {
      const m = opp.meddpicc;
      if (!m) return;
      const scores = [m.metricsScore, m.economicBuyerScore, m.decisionCriteriaScore,
        m.decisionProcessScore, m.paperProcessScore, m.implicatePainScore,
        m.championScore, m.competitionScore].filter((s: any) => s !== null && s !== undefined) as number[];
      if (scores.length > 0) {
        // 0-4 分制转换为 0-100
        oppAvgs.push(Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length * 25));
      }
    });
    if (oppAvgs.length > 0) {
      return Math.round(oppAvgs.reduce((a, b) => a + b, 0) / oppAvgs.length);
    }
    // 回退到客户级手动评分
    return Math.round((effectiveMeddpicc.metricsScore + effectiveMeddpicc.economicBuyerScore + effectiveMeddpicc.decisionCriteriaScore +
      effectiveMeddpicc.decisionProcessScore + effectiveMeddpicc.paperProcessScore + effectiveMeddpicc.implicatePainScore +
      effectiveMeddpicc.championScore + effectiveMeddpicc.competitionScore) / 8);
  })();

  const handleSave = () => {
    if (Object.keys(editData).length > 0) updateClient.mutate({ id: client.id, ...editData });
    else setEditing(false);
  };

  const championCount = contacts.filter(c => c.relationship === "Champion" || c.influence === "Champion候选").length;
  const contactedCount = contacts.filter(c => c.relationship !== "待接触" && c.relationship !== null).length;
  const contactProgressPct = contacts.length > 0 ? Math.round((contactedCount / contacts.length) * 100) : 0;

  // 建图缺口预警
  const hasEconomicBuyer = contacts.some(c => c.influence === "决策者") || effectiveMeddpicc.economicBuyerName;
  const hasChampion = contacts.some(c => c.relationship === "Champion" || c.influence === "Champion候选");
  const gapWarnings: string[] = [];
  if (!hasEconomicBuyer) gapWarnings.push("缺 Economic Buyer");
  if (!hasChampion) gapWarnings.push("缺 Champion");

  // 阶段门控：每个阶段的完成标准检查
  const visitCount = (client as any).visitCount ?? 0;
  const mScore = effectiveMeddpicc.metricsScore ?? 0;
  const eScore = effectiveMeddpicc.economicBuyerScore ?? 0;
  const iScore = effectiveMeddpicc.implicatePainScore ?? 0;
  const cScore = effectiveMeddpicc.championScore ?? 0;
  const championName = effectiveMeddpicc.championName || null;
  const hasKeywords = !!(client.monitorKeywords && client.monitorKeywords.length > 0);
  const hasHookTopic = !!(client.hookTopic && client.hookTopic.trim());

  // 门控条件定义
  const stageGates: Record<string, { label: string; checks: { text: string; pass: boolean; critical?: boolean }[] }> = {
    "建图": {
      label: "建图 → 进门",
      checks: [
        { text: `关键人图谱 ≥ 3 人（当前 ${contacts.length} 人）`, pass: contacts.length >= 3, critical: true },
        { text: `敲门砖话题已填写`, pass: hasHookTopic, critical: true },
        { text: `安全切入点已填写`, pass: !!(client.securityAngle && client.securityAngle.trim()) },
        { text: `情报监控关键词已配置`, pass: hasKeywords },
      ]
    },
    "进门": {
      label: "进门 → 定痛",
      checks: [
        { text: `E（Economic Buyer）维度有初始评分（当前 ${eScore}/4）`, pass: eScore >= 1, critical: true },
        { text: `至少 1 次拜访记录（当前 ${visitCount} 次）`, pass: visitCount >= 1, critical: true },
        { text: `关键人图谱 ≥ 3 人（当前 ${contacts.length} 人）`, pass: contacts.length >= 3 },
      ]
    },
    "定痛": {
      label: "定痛 → 找人",
      checks: [
        { text: `M（Metrics）评分 ≥ 2/4，客户有可量化目标（当前 ${mScore}/4）`, pass: mScore >= 2, critical: true },
        { text: `I（Implicate Pain）评分 ≥ 2/4，痛点已量化（当前 ${iScore}/4）`, pass: iScore >= 2, critical: true },
        { text: `至少 2 次拜访记录（当前 ${visitCount} 次）`, pass: visitCount >= 2 },
      ]
    },
    "找人": {
      label: "找人 → 进入商机",
      checks: [
        { text: `C（Champion）评分 ≥ 3/4，Champion 已激活（当前 ${cScore}/4）`, pass: cScore >= 3, critical: true },
        { text: `Champion 姓名已录入`, pass: !!(championName && championName.trim()), critical: true },
        { text: `Champion 在关键人图谱中已标注`, pass: hasChampion },
        { text: `E（Economic Buyer）评分 ≥ 2/4（当前 ${eScore}/4）`, pass: eScore >= 2 },
      ]
    },
  };
  const currentGate = stageGates[client.stage];
  const gatePassCount = currentGate ? currentGate.checks.filter(c => c.pass).length : 0;
  const gateTotalCount = currentGate ? currentGate.checks.length : 0;
  const criticalFails = currentGate ? currentGate.checks.filter(c => c.critical && !c.pass) : [];
  const canAdvance = criticalFails.length === 0;

  return (
    <>
    <div className={cn("bg-card border rounded-xl overflow-hidden transition-all", expanded ? "border-primary/30" : "border-border hover:border-muted-foreground/50")}>
      {/* Card Header */}
      <div className={cn("p-4", !expanded && "md:p-4 py-3 px-3")} onClick={!expanded ? () => setExpanded(true) : undefined} style={!expanded ? { cursor: 'pointer' } : undefined}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded border",
                client.priority === "P0" ? "bg-red-500/20 text-red-400 border-red-500/30" :
                  client.priority === "P1" ? "bg-orange-500/20 text-orange-400 border-orange-500/30" :
                    "bg-muted text-muted-foreground border-border"
              )}>{client.priority}</span>
              <h3 className="font-semibold text-foreground">{client.name}</h3>
              <span className="text-xs text-muted-foreground">{client.nameEn}</span>
              {client.isTest && (
                <span className="text-[10px] px-1.5 py-0.5 rounded border bg-violet-500/15 text-violet-400 border-violet-500/30 font-medium">测试客户</span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-xs text-muted-foreground">{client.industry}</div>
              {gapWarnings.length > 0 && (
                <div className="flex items-center gap-1">
                  {gapWarnings.map(w => (
                    <span key={w} className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 font-medium">
                      ⚠ {w}
                    </span>
                  ))}
                </div>
              )}
              {contacts.length > 0 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="w-3 h-3" />
                  <span>{contacts.length}人</span>
                  {championCount > 0 && (
                    <span className="text-green-400">· {championCount} Champion</span>
                  )}
                </div>
              )}
              {/* Visit stats */}
              {(client as any).visitCount > 0 ? (
                <div className="flex items-center gap-1 text-xs text-cyan-400">
                  <Calendar className="w-3 h-3" />
                  <span>已拜访 {(client as any).visitCount} 次</span>
                  {(client as any).lastVisitDate && (
                    <span className="text-muted-foreground">· 最近 {new Date((client as any).lastVisitDate).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}</span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1 text-xs text-muted-foreground/60">
                  <Calendar className="w-3 h-3" />
                  <span>未拜访</span>
                </div>
              )}
              {/* 负责 SAM/RSM 显示（AD 可分配，其他角色只读） */}
              {isAD ? (
                <>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSamDropdownOpen(v => !v); }}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Users className="w-3 h-3" />
                      <span>{(client as any).assignedSamName ? `SAM: ${(client as any).assignedSamName}` : '分配 SAM'}</span>
                    </button>
                    {samDropdownOpen && (
                      <div className="absolute left-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-xl py-1 min-w-[160px]" onClick={(e) => e.stopPropagation()}>
                        <div className="px-3 py-1 text-[10px] text-muted-foreground font-medium border-b border-border mb-1">分配负责 SAM</div>
                        <button type="button" onClick={() => assignSamMut.mutate({ clientId: client.id, samId: null, samName: null })}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 text-muted-foreground">
                          — 取消分配
                        </button>
                        {samUsers.map((u: any) => (
                          <button key={u.id} type="button"
                            onClick={() => assignSamMut.mutate({ clientId: client.id, samId: u.id, samName: u.name })}
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 text-foreground flex items-center gap-2">
                            <span className={`text-[10px] px-1 py-0.5 rounded font-medium ${u.podRole === 'SAM' ? 'bg-blue-500/20 text-blue-400' : u.podRole === 'AD' ? 'bg-red-500/20 text-red-400' : 'bg-muted text-muted-foreground'}`}>{u.podRole}</span>
                            {u.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setRsmDropdownOpen(v => !v); setSamDropdownOpen(false); }}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Users className="w-3 h-3 text-emerald-400/70" />
                      <span>{(client as any).assignedRsmName ? `RSM: ${(client as any).assignedRsmName}` : '分配 RSM'}</span>
                    </button>
                    {rsmDropdownOpen && (
                      <div className="absolute left-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-xl py-1 min-w-[160px]" onClick={(e) => e.stopPropagation()}>
                        <div className="px-3 py-1 text-[10px] text-muted-foreground font-medium border-b border-border mb-1">分配属地 RSM</div>
                        <button type="button" onClick={() => assignRsmMut.mutate({ clientId: client.id, rsmId: null, rsmName: null })}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 text-muted-foreground">
                          — 取消分配
                        </button>
                        {samUsers.map((u: any) => (
                          <button key={u.id} type="button"
                            onClick={() => assignRsmMut.mutate({ clientId: client.id, rsmId: u.id, rsmName: u.name })}
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 text-foreground flex items-center gap-2">
                            <span className={`text-[10px] px-1 py-0.5 rounded font-medium ${u.podRole === 'SAM' ? 'bg-cyan-500/20 text-cyan-400' : u.podRole === 'RSM' ? 'bg-emerald-500/20 text-emerald-400' : u.podRole === 'AD' ? 'bg-amber-500/20 text-amber-400' : 'bg-muted text-muted-foreground'}`}>{u.podRole}</span>
                            {u.name}
                          </button>
                        ))}
                        {samUsers.length === 0 && (
                          <div className="px-3 py-2 text-xs text-muted-foreground">暂无团队成员</div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {(client as any).assignedSamName && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="w-3 h-3" />
                      <span>SAM: {(client as any).assignedSamName}</span>
                    </div>
                  )}
                  {(client as any).assignedRsmName && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="w-3 h-3 text-emerald-400/70" />
                      <span>RSM: {(client as any).assignedRsmName}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {(['建图', '进门', '定痛', '找人', '进入商机'] as string[]).includes(client.stage) ? (
              <TermTooltip term={client.stage as any} label={client.stage} className={cn("text-xs px-2 py-1 rounded-md font-medium cursor-help", stageColor[client.stage])} />
            ) : (
              <span className={cn("text-xs px-2 py-1 rounded-md font-medium", stageColor[client.stage])}>{client.stage}</span>
            )}
            {/* 阶段推进按钮 */}
            {currentGate && (
              <button
                onClick={() => setShowStageGate(v => !v)}
                title="查看阶段推进门控"
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded border font-medium transition-colors flex items-center gap-0.5",
                  canAdvance
                    ? "bg-green-500/15 text-green-400 border-green-500/30 hover:bg-green-500/25"
                    : "bg-orange-500/15 text-orange-400 border-orange-500/30 hover:bg-orange-500/25"
                )}
              >
                {canAdvance ? "✓" : `${gatePassCount}/${gateTotalCount}`} →
              </button>
            )}
            <div className="relative w-10 h-10 flex-shrink-0">
              <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/30" />
                <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3"
                  className={avgScore >= 60 ? "text-green-500" : avgScore >= 30 ? "text-yellow-500" : "text-red-500"}
                  strokeDasharray={`${avgScore * 0.942} 94.2`} strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-foreground">{avgScore}</span>
            </div>
            {/* AI Review 下拉菜单 */}
            <div className="relative flex-shrink-0">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setReviewDropdownOpen(v => !v); }}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border bg-purple-500/10 text-purple-400 border-purple-500/30 hover:bg-purple-500/20 transition-colors font-medium"
                title="AI 分析当前阶段进度，找出卡点，给出3个具体下一步行动"
              >
                <Sparkles className="w-3 h-3" />
                AI Review ▾
              </button>
              {reviewDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-xl py-1 min-w-[160px]" onClick={(e) => e.stopPropagation()}>
                  <button type="button" onClick={() => handleReview("0to1")} className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 text-foreground">
                    🗺️ 0→1 阶段推进
                  </button>
                  {opps.length > 0 && (
                    <>
                      {opps.slice(0, 3).map((opp: any) => (
                        <button key={opp.id} type="button" onClick={() => handleReview("1toN", opp.id)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 text-foreground truncate">
                          🎯 1→N: {opp.name.slice(0, 15)}
                        </button>
                      ))}
                    </>
                  )}
                  <button type="button" onClick={() => handleReview("buyingGroup")} className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 text-foreground">
                    👥 Buying Group 分析
                  </button>
                  <button type="button" onClick={() => handleReview("visitTrend")} className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 text-foreground">
                    📈 拜访趋势分析
                  </button>
                  <div className="border-t border-border my-1" />
                  <div className="px-3 py-1 text-[10px] text-muted-foreground font-medium">AD 问询工具</div>
                  <button type="button" onClick={() => handleAdInquiry("0to1")} className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 text-orange-400">
                    <span title="生成3个只有真正做过这件事的人才能回答的问题，用于验证 SAM 数据真实性">🔍 AD问询（0→1关系质量）</span>
                  </button>
                  {opps.length > 0 && (
                    <button type="button" onClick={() => handleAdInquiry("1toN", opps[0]?.id)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 text-orange-400">
                      <span title="生成3个只有真正做过这件事的人才能回答的问题，用于验证 SAM 数据真实性">🔍 AD问询（1→N赢单机制）</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

      {/* 阶段门控面板 */}
      {showStageGate && currentGate && (
        <div className="border-t border-border bg-muted/5 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">阶段门控：{currentGate.label}</span>
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", canAdvance ? "bg-green-500/15 text-green-400" : "bg-orange-500/15 text-orange-400")}>
                {canAdvance ? "✓ 可推进" : `${criticalFails.length} 项关键条件未满足`}
              </span>
            </div>
            <button onClick={() => setShowStageGate(false)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
          </div>
          <div className="space-y-2 mb-4">
            {currentGate.checks.map((check, idx) => (
              <div key={idx} className={cn("flex items-start gap-2 text-xs p-2 rounded-lg", check.pass ? "bg-green-500/5" : check.critical ? "bg-red-500/8 border border-red-500/20" : "bg-muted/30")}>
                <span className={cn("mt-0.5 flex-shrink-0 font-bold", check.pass ? "text-green-400" : check.critical ? "text-red-400" : "text-muted-foreground")}>
                  {check.pass ? "✓" : check.critical ? "✗" : "○"}
                </span>
                <span className={cn(check.pass ? "text-foreground/70" : check.critical ? "text-foreground" : "text-muted-foreground")}>
                  {check.text}
                  {check.critical && !check.pass && <span className="ml-1 text-[10px] text-red-400 font-medium">（必须满足）</span>}
                </span>
              </div>
            ))}
          </div>
          {canAdvance ? (
            <div className="flex items-center gap-2">
              <div className="text-xs text-green-400 font-medium">✓ 所有关键条件已满足，可以推进到下一阶段</div>
              <button
                onClick={() => {
                  const nextStage = STAGES[STAGES.indexOf(client.stage) + 1];
                  if (nextStage) {
                    updateClient.mutate({ id: client.id, stage: nextStage });
                    setShowStageGate(false);
                    toast.success(`已推进到「${nextStage}」阶段`);
                  }
                }}
                className="ml-auto text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors"
              >
                确认推进 → {STAGES[STAGES.indexOf(client.stage) + 1]}
              </button>
            </div>
          ) : (
            <div className="text-xs text-orange-400/80 bg-orange-500/5 border border-orange-500/20 rounded-lg p-2">
              ⚠ 请先完成上方标红的关键条件，再推进到下一阶段。未完成关键条件强行推进会导致商机质量失真。
            </div>
          )}
        </div>
      )}
      {/* 0→1 → 1→N 阶段转换进度条 */}
      {(() => {
        const zeroToOneStages = ['建图', '进门', '定痛', '找人'];
        const oneToNStages = ['进入商机', '初步需求', '需求挖掘', '技术验证', '方案提案', '商务谈判', '赢单'];
        const allStages = [...zeroToOneStages, ...oneToNStages];
        const currentIdx = allStages.indexOf(client.stage);
        if (currentIdx < 0) return null;
        const totalStages = allStages.length;
        const progressPct = Math.round(((currentIdx + 1) / totalStages) * 100);
        const isTransitionStage = client.stage === '找人';
        const isOneToN = oneToNStages.includes(client.stage);
        const transitionWarnings: string[] = [];
        if (isTransitionStage) {
          if (!hasChampion) transitionWarnings.push("Champion 尚未在关键人图谱中标注");
          const informalCount = contacts.reduce((sum: number, c: any) => sum + (c.informalContactCount ?? 0), 0);
          if (informalCount === 0) transitionWarnings.push("所有接触均为正式会议，关系深度存疑");
          if (eScore < 2) transitionWarnings.push("EB 接触不足（E维度 < 2/4）");
        }
        const readyToTransition = isTransitionStage && canAdvance && transitionWarnings.length === 0;
        return (
          <div className="mt-2 mb-1 px-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] text-muted-foreground w-8 text-right">0→1</span>
              <div className="flex-1 relative h-2 bg-muted/40 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${isOneToN ? 'bg-gradient-to-r from-blue-500 to-green-500' : 'bg-gradient-to-r from-purple-500 to-blue-500'}`}
                  style={{ width: `${progressPct}%` }}
                />
                <div className="absolute top-0 bottom-0 w-0.5 bg-yellow-400/60" style={{ left: `${(4 / totalStages) * 100}%` }} />
              </div>
              <span className="text-[10px] text-muted-foreground w-8">1→N</span>
            </div>
            <div className="flex items-center gap-0.5 mb-1">
              {allStages.map((s, i) => (
                <div key={s} className={`flex-1 text-center text-[8px] truncate px-0.5 rounded transition-colors ${i === currentIdx ? (isOneToN ? 'text-green-400 font-semibold' : 'text-purple-400 font-semibold') : i < currentIdx ? 'text-muted-foreground/60' : 'text-muted-foreground/30'}`}>
                  {s === '进入商机' ? '↗' : s.slice(0, 2)}
                </div>
              ))}
            </div>
            {isTransitionStage && (
              <div className={`mt-1 rounded-lg px-2 py-1.5 text-[10px] border ${readyToTransition ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'}`}>
                {readyToTransition ? (
                  <span>✅ 具备进入商机条件：Champion 已激活，关键条件全部满足</span>
                ) : (
                  <div>
                    <div className="font-medium mb-0.5">⚠️ 尚不具备进入商机条件：</div>
                    {transitionWarnings.map((w, i) => {
                      // Map warning to quick action
                      const isChampionWarning = w.includes("Champion");
                      const isInformalWarning = w.includes("正式会议");
                      const isEBWarning = w.includes("EB");
                      const handleQuickFix = () => {
                        if (isChampionWarning) {
                          setActiveTab("contacts");
                          setExpanded(true);
                          toast("请在关键人列表中标注 Champion 角色", { icon: "👤" });
                        } else if (isInformalWarning) {
                          setActiveTab("contacts");
                          setExpanded(true);
                          toast("请在关键人中更新非正式接触次数", { icon: "🤝" });
                        } else if (isEBWarning) {
                          setActiveTab("meddpicc");
                          setExpanded(true);
                          toast("请更新 E（经济买家）维度评分", { icon: "💼" });
                        }
                      };
                      return (
                        <div key={i} className="flex items-center gap-1 mt-0.5">
                          <span>•</span>
                          <span>{w}</span>
                          <button type="button"
                            onClick={(e) => { e.stopPropagation(); handleQuickFix(); }}
                            className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 text-yellow-300 flex-shrink-0 transition-colors">
                            → 去补充
                          </button>
                        </div>
                      );
                    })}
                    {criticalFails.filter(f => !transitionWarnings.some(w => w.includes(f.text.slice(0,10)))).map((f, i) => (
                      <div key={`cf-${i}`} className="flex items-center gap-1 mt-0.5">
                        <span>•</span>
                        <span>{f.text}</span>
                        <button type="button"
                          onClick={(e) => { e.stopPropagation(); setActiveTab("meddpicc"); setExpanded(true); }}
                          className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 text-yellow-300 flex-shrink-0 transition-colors">
                          → 去补充
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {isOneToN && (
              <div className="mt-1 rounded-lg px-2 py-1 text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-400">
                🎯 1→N 赢单阶段 · {client.stage} · 停留 {(() => { const sc = (client as any).stageChangedAt; return sc ? Math.floor((Date.now() - new Date(sc).getTime()) / 86400000) : '?'; })()} 天
              </div>
            )}
          </div>
        );
      })()}

      {/* MEDDPICC mini bars */}
        {(() => {
          const isOneToN = client.stage === '进入商机';
          if (isOneToN && oppMeddpiccList.length > 0) {
            // 进入商机阶段：聚合商机均值显示
            const oppScoreKeys = ['metricsScore','economicBuyerScore','decisionCriteriaScore','decisionProcessScore','paperProcessScore','implicatePainScore','championScore','competitionScore'];
            const labels = ['M','E','D','D2','P','I','C','C2'];
            const aggScores = oppScoreKeys.map(key => {
              const vals = oppMeddpiccList.map((o: any) => o.meddpicc?.[key]).filter((v: any) => v !== null && v !== undefined) as number[];
              return vals.length > 0 ? Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length) : 0;
            });
            return (
              <div className="mt-3 grid grid-cols-4 gap-x-4 gap-y-1.5">
                {aggScores.map((score, idx) => (
                  <MeddpiccBar key={labels[idx]} label={labels[idx]} score={score * 25} fullLabel={labels[idx]} />
                ))}
              </div>
            );
          }
          return (
            <div className="mt-3 grid grid-cols-4 gap-x-4 gap-y-1.5">
              {MEDDPICC_ITEMS.map((item) => (
                <MeddpiccBar key={item.key} label={item.label} score={effectiveMeddpicc[item.scoreKey] ?? 0} fullLabel={item.label} />
              ))}
            </div>
          );
        })()}

        {/* Hook & Security */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="bg-muted/30 rounded-lg p-2">
            <div className="text-xs text-muted-foreground mb-0.5">敲门砖</div>
            <div className="text-xs text-foreground line-clamp-2">{client.hookTopic || "待定"}</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-2">
            <div className="text-xs text-muted-foreground mb-0.5">安全切入</div>
            <div className="text-xs text-foreground line-clamp-2">{client.securityAngle || "待定"}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-3">
          {onFocus ? (
            /* Grid mode: clicking expands into full-screen single-client view */
            !expanded ? (
              <button
                onClick={onFocus}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <ChevronDown className="w-3 h-3" />
                展开详情
              </button>
            ) : null
          ) : (
            /* Full-screen mode: show collapse button */
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? "收起详情" : "展开详情"}
            </button>
          )}
          <button
            onClick={() => { setEditing(!editing); setEditData({}); }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <Edit2 className="w-3 h-3" />
            快速编辑
          </button>
        </div>
      </div>

      {/* Quick Edit Panel */}
      {editing && (
        <div className="border-t border-border p-4 bg-muted/10">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">销售阶段</label>
              <Select value={editData.stage || client.stage} onValueChange={(v) => setEditData({ ...editData, stage: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">优先级</label>
              <Select value={editData.priority || client.priority} onValueChange={(v) => setEditData({ ...editData, priority: v as any })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-muted-foreground">敲门砖话题</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                  setSuggestLoading(true);
                  setSuggestReasoning('');
                  try {
                    const res = await suggestMutation.mutateAsync({ clientId: client.id, clientName: client.name, industry: client.industry || undefined });
                    setEditData((prev: any) => ({ ...prev, hookTopic: res.hookTopic, securityAngle: res.securityAngle }));
                    setSuggestReasoning(res.reasoning);
                  } catch { toast.error('AI建议失败，请重试'); } finally { setSuggestLoading(false); }
                }}
                  disabled={suggestLoading}
                  className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-50"
                >
                  <Sparkles className="w-3 h-3" />{suggestLoading ? 'AI分析中...' : 'AI建议'}
                </button>
              </div>
            </div>
            <Textarea className="text-xs h-12 resize-none" placeholder="描述打开话题的切入点..."
              value={editData.hookTopic !== undefined ? editData.hookTopic : (client.hookTopic || '')}
              onChange={(e) => setEditData({ ...editData, hookTopic: e.target.value })} />
          </div>
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-muted-foreground">安全切入点</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    setSuggestLoading(true);
                    setSuggestReasoning('');
                    try {
                      const res = await suggestMutation.mutateAsync({ clientId: client.id, clientName: client.name, industry: client.industry || undefined });
                      setEditData((prev: any) => ({ ...prev, hookTopic: res.hookTopic, securityAngle: res.securityAngle }));
                      setSuggestReasoning(res.reasoning);
                    } catch { toast.error('AI建议失败，请重试'); } finally { setSuggestLoading(false); }
                  }}
                  disabled={suggestLoading}
                  className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-50"
                >
                  <Sparkles className="w-3 h-3" />{suggestLoading ? 'AI分析中...' : 'AI建议'}
                </button>
              </div>
            </div>
            <Textarea className="text-xs h-12 resize-none" placeholder="描述安全产品的切入场景..."
              value={editData.securityAngle !== undefined ? editData.securityAngle : (client.securityAngle || '')}
              onChange={(e) => setEditData({ ...editData, securityAngle: e.target.value })} />
          </div>
          {suggestReasoning && (
            <div className="mb-3 p-2 rounded bg-cyan-950/30 border border-cyan-800/30">
              <div className="text-xs text-cyan-400 font-medium mb-1">AI建议理由</div>
              <div className="text-xs text-muted-foreground">{suggestReasoning}</div>
            </div>
          )}
          <div className="mb-3">
            <label className="text-xs text-muted-foreground mb-1 block">备注</label>
            <Textarea className="text-xs h-16 resize-none" placeholder="输入备注..."
              defaultValue={client.notes || ""}
              onChange={(e) => setEditData({ ...editData, notes: e.target.value })} />
          </div>
          {(client as any).visitCount === 0 && (
            <div className="mb-3">
              <label className="text-xs text-muted-foreground mb-1 block">计划首次拜访日期</label>
              <input
                type="date"
                className="w-full h-8 rounded-md border border-input bg-background px-3 text-xs text-foreground"
                value={editData.plannedFirstVisitDate
                  ? new Date(editData.plannedFirstVisitDate).toISOString().split('T')[0]
                  : (client as any).plannedFirstVisitDate
                    ? new Date((client as any).plannedFirstVisitDate).toISOString().split('T')[0]
                    : ''}
                onChange={(e) => setEditData({ ...editData, plannedFirstVisitDate: e.target.value ? new Date(e.target.value).getTime() : null })}
              />
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs gap-1" onClick={handleSave} disabled={updateClient.isPending}>
              <Save className="w-3 h-3" />保存
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setEditing(false)}>
              <X className="w-3 h-3" />取消
            </Button>
          </div>
        </div>
      )}

      {/* Expanded Detail Panel with tabs */}
      {expanded && (
        <div className="border-t border-border">
          {/* AI 提示气泡（跳转后自动显示，3秒后消失） */}
          {highlightBubble && (
            <div className="mx-3 mt-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-xs text-yellow-300 animate-pulse">
              <span className="text-yellow-400 flex-shrink-0 mt-0.5">💡</span>
              <span>{highlightBubble}</span>
              <button type="button" onClick={() => setHighlightBubble(null)} className="ml-auto text-yellow-400/60 hover:text-yellow-400 flex-shrink-0">✕</button>
            </div>
          )}
          {/* Tab switcher */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveTab("meddpicc")}
              className={cn("flex-1 py-2.5 text-xs font-medium transition-colors",
                activeTab === "meddpicc" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"
              )}
            >
              MEDDPICC 详细评分
            </button>
            <button
              onClick={() => setActiveTab("trend")}
              className={cn("flex-1 py-2.5 text-xs font-medium transition-colors flex items-center justify-center gap-1.5",
                activeTab === "trend" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <TrendingUp className="w-3 h-3" />
              变化趋势
            </button>
            <button
              onClick={() => setActiveTab("contacts")}
              className={cn("flex-1 py-2.5 text-xs font-medium transition-colors flex items-center justify-center gap-1.5",
                activeTab === "contacts" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <UserCheck className="w-3 h-3" />
              关键人图谱
              {contacts.length > 0 && (
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                  activeTab === "contacts" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                )}>{contactedCount}/{contacts.length}</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("fronts")}
              className={cn("flex-1 py-2.5 text-xs font-medium transition-colors flex items-center justify-center gap-1.5",
                activeTab === "fronts" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Swords className="w-3 h-3" />
              活跃战线
              {(opps as any[]).length > 0 && (
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                  activeTab === "fronts" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                )}>{(opps as any[]).filter((o: any) => o.status === '活跃').length}</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("winstrategy")}
              className={cn("flex-1 py-2.5 text-xs font-medium transition-colors flex items-center justify-center gap-1.5",
                activeTab === "winstrategy" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Trophy className="w-3 h-3" />
              Win Strategy
            </button>
            <button
              onClick={() => setActiveTab("spin")}
              className={cn("flex-1 py-2.5 text-xs font-medium transition-colors flex items-center justify-center gap-1.5",
                activeTab === "spin" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"
              )}
            >
              💬 SPIN
            </button>
            <button
              onClick={() => setActiveTab("metrics")}
              className={cn("flex-1 py-2.5 text-xs font-medium transition-colors flex items-center justify-center gap-1.5",
                activeTab === "metrics" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span title="量化客户现有安全运营成本，为方案提案提供 ROI 数字依据">📊 效能基线</span>
            </button>
          </div>

          {/* MEDDPICC tab - smart switch based on stage */}
          {(activeTab === "meddpicc") && (() => {
            const isOneToN = client.stage === '进入商机';
            if (isOneToN && oppMeddpiccList.length > 0) {
              // 进入商机阶段：商机 MEDDPICC 汇总矩阵
              const oppScoreKeys = ['metricsScore','economicBuyerScore','decisionCriteriaScore','decisionProcessScore','paperProcessScore','implicatePainScore','championScore','competitionScore'];
              const dimLabels = ['M','E','D','D2','P','I','C','C2'];
              const dimFull = ['Metrics','经济购买人','决策标准','决策流程','采购流程','痛点量化','Champion','竞争态势'];
              return (
                <div className="p-4 bg-muted/5">
                  <div className="mb-3 p-2.5 bg-primary/5 border border-primary/20 rounded-lg">
                    <div className="text-xs font-semibold text-primary mb-0.5">📊 商机 MEDDPICC 汇总矩阵</div>
                    <div className="text-[10px] text-muted-foreground">当前阶段（{client.stage}）已有商机级评分，下方显示每条商机的 8 维健康度。单独商机详细评分请到「活跃战线」点击蓝图查看。</div>
                  </div>
                  {/* Header */}
                  <div className="grid gap-1 mb-2" style={{ gridTemplateColumns: '1fr 44px repeat(8, 1fr)' }}>
                    <div className="text-[10px] text-muted-foreground font-medium">商机</div>
                    <div className="text-[10px] text-muted-foreground text-center">健康度</div>
                    {dimLabels.map((l, i) => (
                      <div key={l} className="text-[10px] text-muted-foreground text-center font-mono" title={dimFull[i]}>{l}</div>
                    ))}
                  </div>
                  {/* Rows */}
                  <div className="space-y-1.5">
                    {oppMeddpiccList.map((opp: any) => {
                      const m = opp.meddpicc;
                      const scores = m ? [m.metricsScore, m.economicBuyerScore, m.decisionCriteriaScore, m.decisionProcessScore, m.paperProcessScore, m.implicatePainScore, m.championScore, m.competitionScore] : Array(8).fill(0);
                      const total = scores.reduce((s: number, v: number) => s + (v ?? 0), 0);
                      const healthPct = Math.round((total / (8 * 4)) * 100);
                      const hasData = m && total > 0;
                      return (
                        <div key={opp.opportunityId} className="grid items-center gap-1 py-2 px-2 rounded-lg bg-muted/20 border border-border/30" style={{ gridTemplateColumns: '1fr 44px repeat(8, 1fr)' }}>
                          <div className="min-w-0">
                            <div className="text-[11px] font-medium truncate text-foreground">{opp.opportunityName}</div>
                            <div className="text-[9px] text-muted-foreground">{opp.stage}</div>
                          </div>
                          <div className={`text-xs font-bold text-center ${
                            !hasData ? 'text-muted-foreground/40' :
                            healthPct >= 60 ? 'text-green-400' : healthPct >= 35 ? 'text-yellow-400' : 'text-red-400'
                          }`}>{hasData ? `${healthPct}%` : '—'}</div>
                          {scores.map((score: number, idx: number) => {
                            const color = !hasData ? 'bg-muted/30' : score >= 3 ? 'bg-green-500' : score >= 2 ? 'bg-yellow-500' : score >= 1 ? 'bg-orange-500' : 'bg-red-500/50';
                            return (
                              <div key={idx} className="flex flex-col items-center gap-0.5">
                                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${color}`} style={{ width: hasData ? `${(score / 4) * 100}%` : '0%' }} />
                                </div>
                                <span className="text-[9px] text-muted-foreground">{hasData ? score : '—'}</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }
            // 0→1 阶段：手动评分界面
            return (
            <div className="p-4 bg-muted/5">
              {/* Stage-based MEDDPICC focus hint */}
              {(() => {
                const stageFocus: Record<string, { dims: string[]; hint: string }> = {
                  '建图': { dims: ['implicatePain', 'metrics'], hint: '建图阶段重点：优先确认客户痛点（I）和可量化目标（M）' },
                  '进门': { dims: ['implicatePain', 'economicBuyer'], hint: '进门阶段重点：确认痛点紧迫性（I）和接触预算决策人（E）' },
                  '定痛': { dims: ['implicatePain', 'metrics', 'champion'], hint: '定痛阶段重点：量化痛点价値（I+M），开始培育 Champion（C）' },
                  '找人': { dims: ['champion', 'economicBuyer', 'decisionProcess'], hint: '找人阶段重点：强化 Champion（C），理清决策流程（D）和预算决策人（E）' },
                  'Qualified': { dims: ['decisionCriteria', 'decisionProcess', 'competition'], hint: 'Qualified 阶段重点：影响评估标准（D），确认竞争态势（C2）' },
                  'POC': { dims: ['decisionCriteria', 'champion', 'competition'], hint: 'POC 阶段重点：确保评估标准对我方有利（D），竞品差异化（C2）和 Champion 推动（C）' },
                  '商务谈判': { dims: ['paperProcess', 'economicBuyer', 'champion'], hint: '商务谈判阶段重点：推进采购流程（P），维护高层关系（E）和 Champion 支持（C）' },
                };
                const focus = stageFocus[client.stage];
                if (!focus) return null;
                return (
                  <div className="mb-3 p-2.5 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-2">
                    <Target className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[10px] font-semibold text-yellow-400 mb-0.5">当前阶段关注点</div>
                      <div className="text-[10px] text-muted-foreground">{focus.hint}</div>
                    </div>
                  </div>
                );
              })()}
              <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <TermTooltip term="MEDDPICC" label="📊 MEDDPICC 国际标准评分" showIcon={true} className="text-xs font-semibold text-primary border-none" />
                </div>
                <div className="text-[10px] text-muted-foreground leading-relaxed">
                  按国际 MEDDPICC 方法论里程碑标准评分（0/25/50/75/100）。选择最符合当前状态的描述，添加备注后自动记录到作战日志。
                </div>
              </div>
              <div className="space-y-3">
                {MEDDPICC_DIMENSIONS.map((dim) => {
                  const currentScore: number = effectiveMeddpicc[dim.key] ?? 0;
                  const dimLogs = allLogs.filter((l: any) => l.dimension === dim.key);
                  const isExpanded = expandedDim === dim.key;
                  const selectedLevel = dim.levels.find(l => l.score === currentScore) || dim.levels[0];
                  const scoreColorClass = currentScore >= 75 ? "text-green-400" : currentScore >= 50 ? "text-yellow-400" : currentScore >= 25 ? "text-orange-400" : "text-red-400";
                  const nameKey = dim.code === "E" ? "economicBuyerName" : dim.code === "C1" ? "championName" : null;
                  const roleColorMap: Record<string, string> = { AD: "bg-amber-500/20 text-amber-400", SAM: "bg-cyan-500/20 text-cyan-400", SA: "bg-violet-500/20 text-violet-400", RSM: "bg-emerald-500/20 text-emerald-400" };
                  return (
                    <div key={dim.key} className="border border-border/50 rounded-xl overflow-hidden">
                      {/* Dimension header - click to expand */}
                      <button
                        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/20 transition-colors"
                        onClick={() => setExpandedDim(isExpanded ? null : dim.key)}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-[10px] font-bold text-primary">{dim.code}</span>
                          </div>
                          <div className="text-left">
                            <div className="text-xs font-medium text-foreground">{dim.chineseName}</div>
                            <div className="text-[10px] text-muted-foreground">{selectedLevel.label}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {dimLogs.length > 0 && <span className="text-[10px] text-muted-foreground">{dimLogs.length}条日志</span>}
                          <span className={cn("text-sm font-bold font-mono", scoreColorClass)}>{currentScore}</span>
                          <ChevronDown className={cn("w-3 h-3 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-border/40 p-3 space-y-3 bg-muted/5">
                          {/* Core question */}
                          <div className="text-[10px] text-primary/70 italic">{dim.question}</div>

                          {/* Name field for E and C1 */}
                          {nameKey && (
                            <input type="text" className="w-full bg-muted/30 border border-border rounded px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                              placeholder={dim.code === "C1" ? "Champion 姓名（内部推手）..." : "预算决策人姓名..."}
                              defaultValue={effectiveMeddpicc[nameKey] || ""}
                              onChange={(e) => setMeddpiccEdit((prev: any) => ({ ...prev, [nameKey]: e.target.value })) }
                              onBlur={() => updateMeddpicc.mutate({ clientId: client.id, ...meddpiccEdit })} />
                          )}

                          {/* Milestone step selector */}
                          <div className="space-y-1.5">
                            {dim.levels.map((level) => {
                              const isSelected = level.score === currentScore;
                              return (
                                <button key={level.score}
                                  onClick={() => {
                                    const updated = { ...meddpiccEdit, [dim.key]: level.score };
                                    setMeddpiccEdit(updated);
                                    updateMeddpicc.mutate({ clientId: client.id, ...updated });
                                  }}
                                  className={cn(
                                    "w-full text-left rounded-lg border px-3 py-2 transition-all",
                                    isSelected ? "border-primary/60 bg-primary/10 ring-1 ring-primary/30" : "border-border/50 bg-muted/10 hover:border-muted-foreground/40"
                                  )}
                                >
                                  <div className="flex items-start gap-2">
                                    <div className={cn("flex-shrink-0 w-8 h-5 rounded text-[10px] font-bold flex items-center justify-center mt-0.5",
                                      level.score >= 75 ? "bg-green-500/20 text-green-400" : level.score >= 50 ? "bg-yellow-500/20 text-yellow-400" : level.score >= 25 ? "bg-orange-500/20 text-orange-400" : "bg-muted text-muted-foreground"
                                    )}>{level.score}</div>
                                    <div className="flex-1 min-w-0">
                                      <div className={cn("text-xs font-medium", isSelected ? "text-primary" : "text-foreground")}>{level.label}</div>
                                      <div className="text-[10px] text-muted-foreground mt-0.5">{level.description}</div>
                                      {isSelected && <div className="text-[10px] text-primary/60 mt-1">📎 证据要求：{level.evidence}</div>}
                                    </div>
                                    {isSelected && <div className="w-3 h-3 rounded-full bg-primary flex-shrink-0 mt-1" />}
                                  </div>
                                </button>
                              );
                            })}
                          </div>

                          {/* Append log entry */}
                          <div className="space-y-1.5 pt-1 border-t border-border/40">
                            <div className="text-[10px] text-muted-foreground font-medium">添加作战日志记录</div>
                            <Textarea
                              className="text-xs h-14 resize-none"
                              placeholder="记录关键信息、会议结论、证据来源..."
                              value={logNote[dim.key] || ""}
                              onChange={(e) => setLogNote(prev => ({ ...prev, [dim.key]: e.target.value }))}
                            />
                            <Button size="sm" className="h-7 text-xs w-full" variant="outline"
                              disabled={!logNote[dim.key]?.trim() || addLog.isPending}
                              onClick={() => {
                                if (!logNote[dim.key]?.trim()) return;
                                addLog.mutate({
                                  clientId: client.id,
                                  dimension: dim.key,
                                  score: currentScore,
                                  note: logNote[dim.key].trim(),
                                  authorRole: role as "AD" | "SAM" | "SA" | "RSM",
                                }, {
                                  onSuccess: () => {
                                    setLogNote(prev => ({ ...prev, [dim.key]: "" }));
                                    toast.success("日志已记录");
                                  }
                                });
                              }}
                            >记录到日志</Button>
                          </div>

                          {/* Log timeline */}
                          {dimLogs.length > 0 && (
                            <div className="space-y-1.5 pt-1 border-t border-border/40">
                              <div className="text-[10px] text-muted-foreground font-medium">作战日志时间轴</div>
                              {dimLogs.map((log: any) => (
                                <div key={log.id} className="flex gap-2 text-[10px]">
                                  <div className="flex-shrink-0 flex flex-col items-center">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary/60 mt-1" />
                                    <div className="w-px flex-1 bg-border/40 mt-1" />
                                  </div>
                                  <div className="flex-1 pb-2">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                      <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold", roleColorMap[log.authorRole] || "bg-muted text-muted-foreground")}>{log.authorRole}</span>
                                      <span className={cn("font-mono font-bold", log.score >= 75 ? "text-green-400" : log.score >= 50 ? "text-yellow-400" : log.score >= 25 ? "text-orange-400" : "text-muted-foreground")}>{log.score}分</span>
                                      <span className="text-muted-foreground">{new Date(log.createdAt).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                                    </div>
                                    <div className="text-foreground/80 leading-relaxed">{log.note}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            );
          })()}


          {/* SPIN提问库 tab */}
          {activeTab === "spin" && (() => {
            // 基于客户名称匹配预置SPIN问题库
            const spinLibrary: Record<string, { s: string[]; p: string[]; i: string[]; n: string[] }> = {
              "美的集团": {
               s: ["美的泰国工厂目前部署了哪些AI应用？72个AI应用的安全管控机制是什么？", "海外22个制造基地的安全架构是统一管理还是各地自建？", "美云智数平台目前承载了哪些核心业务数据？"],
               p: ["OT/IT融合后，工厂东西向流量的安全盲区是否已有系统性解决方案？", "多云AI基础设施（美擎AIGC）是否存在统一安全态势管理的缺口？", "泰国工厂的智能体（13个主要智能体）之间的身份认证和访问控制是如何实现的？"],
               i: ["如果一次工厂OT安全事件导致生产线停工，对美的海外营收（占比43%）的影响是多少？", "AI算力投入（3年600亿）如果缺乏统一的Token成本治理，预计每年的算力浪费有多大？", "在FCC/EU等监管压力下，海外工厂数据合规问题如果未解决，对美的出海战略的影响是什么？"],
                n: ["如果有一套方案能在3-5天内部署私有化大模型推理，同时降低AI总支出30-50%，美的的ROI预期是什么？", "如果AIStorm能帮助美的泰国工厂通过Real2Sim2Real解决多品种混产瓶颈，这对美的的战略价值如何量化？", "如果22个海外制造基地能统一接入一套安全态势管理平台，美的在合规审计和安全运营上的人力成本能降低多少？"]
              },
              "传音控股": {
               s: ["传音的SPIFFE/SPIRE标准MultiAgent身份认证体系目前处于什么建设阶段？", "数据主权区域中心计划覆盖哪些地区？非洲和东南亚的部署时间表是什么？", "传音与Google Cloud的深度合作在安全层面是否有商业产品集成需求？"],
               p: ["基于SPIFFE/SPIRE的开源实现是否存在企业级商业支持和SLA保障的缺口？", "分布式区域中心之间的东西向流量是否有统一的安全监控方案？", "非洲/东南亚基建薄弱区的网络连通性是否影响了安全系统的部署和运维？"],
               i: ["如果MultiAgent身份认证体系出现漏洞，对传音1.69亿部手机用户数据的影响是什么？", "在非洲/东南亚40%市占率的背景下，一次重大安全事件对品牌信任的损失如何量化？", "数据主权合规问题如果未解决，对传音进入欧盟市场的时间线有什么影响？"],
                n: ["如果Agent Trust Fabric能直接对接传音现有的SPIFFE/SPIRE架构，传音的集成成本和时间可以节省多少？", "卫星宽带+Agent安全的打包方案，对传音在非洲基建薄弱区的覆盖能力提升有多大？", "如果传音能率先在非洲市场建立'卫星宽带+端侧AI安全'的标准，这对传音的品牌溢价和竞争壁垒有什么价值？"]
              },
              "大疆创新": {
               s: ["大疆目前针对FCC Covered List的应对策略是什么？是否有第三方安全审计合作方？", "大疆企业级数据安全架构通过了哪些独立安全审计？审计结果是否对外公开？", "无人机在远海/雪山等无网区的超视距通信目前是如何解决的？"],
               p: ["FCC审查压力下，大疆的企业客户（政府/公共安全）对数据流向审计的需求有多迫切？", "现有的独立安全审计是否足以应对美国市场的监管要求？是否需要持续性的第三方监控？", "超视距通信的刚需场景（远海/雪山）目前是否有可靠的商业解决方案？"],
               i: ["如果无法有效应对FCC审查，大疆在企业级市场（政府/公共安全）的收入损失预计是多少？", "一次数据安全事件对大疆全球70%市占率的品牌信任影响如何量化？", "超视距通信问题如果无法解决，大疆在工业无人机（农业/测绘/应急）市场的增长天花板在哪里？"],
                n: ["如果NDR方案能提供持续性的数据流向审计报告，大疆向企业客户证明安全合规的效率能提升多少？", "千帆星座卫星宽带如果能解决超视距通信刚需，大疆工业无人机的可用场景能扩展多少？", "如果大疆能通过独立第三方安全认证重新进入政府采购名单，这对大疆企业级业务的营收增长意味着什么？"]
              },
              "荣耀终端": {
               s: ["荣耀脱离华为体系后，终端安全体系是完全自建还是有外部合作？", "AI助手Yoyo目前在EU AI Act合规方面的准备进展如何？由哪个团队主导？", "荣耀的大模型训练算力目前是自建还是云端？Token成本管理是否有系统性方案？"],
               p: ["独立运营后，荣耀的终端安全体系是否存在与华为时代不同的新缺口？", "EU AI Act分阶段合规要求（2025-2027年）对荣耀AI助手Yoyo的具体影响是什么？", "海外销量增长47%的背景下，安全合规体系是否能跟上国际化扩张的速度？"],
               i: ["如果EU AI Act合规问题未解决，荣耀在欧洲市场的销售禁令风险对五年100亿美元阿尔法战略的影响是什么？", "终端安全体系重建如果依赖自研，时间成本和人力投入是多少？与引入成熟商业方案相比如何？", "AI算力成本如果没有有效治理，荣耀大模型研发的ROI如何保障？"],
                n: ["如果Agent Trust Fabric能帮助Yoyo通过EU AI Act合规认证，荣耀进入欧洲市场的时间线能提前多少？", "RTX 6000D私有化推理一体机+Token ERP如果能降低AI总支出30-50%，对荣耀五年100亿美元投入的ROI改善有多大？", "如果荣耀能率先在AI终端生态中建立'安全即服务'的商业模式，这对荣耀IPO估值和投资者信心有什么影响？"]
              },
              "华大基因": {
               s: ["沙特Genalive私有数据中心目前的安全架构是什么？处理83家公立医院数据的合规证明机制如何？", "GeneT Agent智能体的身份管理和访问控制目前是如何实现的？", "华大基因在中东/东南亚扩张中，跨境基因数据合规的主要挑战是什么？"],
               p: ["沙特卫生部3年合同（93万次基因检测）是否要求第三方安全合规证明？现有方案是否满足要求？", "美国生物安全审查压力下，华大基因的供应链和数据流向是否有系统性的合规监控方案？", "GeneT Agent的多智能体协作是否存在身份认证和数据访问控制的安全缺口？"],
               i: ["如果沙特Genalive数据中心出现安全事件，对华大基因3年合同和中东扩张战略的影响是什么？", "美国生物安全审查如果升级，华大基因在全球100+国家业务的合规风险如何量化？", "跨境基因数据合规问题如果未解决，华大基因进入欧盟/日本等高价值市场的障碍有多大？"],
                n: ["如果CloudGuard能为Genalive数据中心提供持续性的云安全合规报告，华大基因向沙特卫生部的合规证明效率能提升多少？", "RTX 6000D私有化推理一体机（数据全程不出域）如果能满足生命科学合规要求，华大基因的数据主权成本能降低多少？", "如果华大基因能通过AIStorm的安全方案在中东建立'基因数据主权合规'的标杆案例，这对华大基因进入更多GCC国家市场的价值是什么？"]
              }
            };
            const spin = spinLibrary[client.name];
            const spinColors = { s: "text-blue-400 bg-blue-500/10 border-blue-500/20", p: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20", i: "text-orange-400 bg-orange-500/10 border-orange-500/20", n: "text-green-400 bg-green-500/10 border-green-500/20" };
            const spinLabels = { s: "S — Situation（现状问题）", p: "P — Problem（困难问题）", i: "I — Implication（影响问题）", n: "N — Need-Payoff（需求回报问题）" };
            const spinOwners = { s: "SAM 会前摸底", p: "SAM 初次接触", i: "AD C-Level 刺痛", n: "AD 高层会面收尾" };
            return (
              <div className="p-4 space-y-3">
                <div className="p-2.5 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="text-xs font-semibold text-primary mb-0.5">💬 SPIN 提问库</div>
                  <div className="text-[10px] text-muted-foreground">基于客户公开数据预置的顾问式提问话术。S/P 问题由 SAM 会前摸底，I/N 问题由 AD 在 C-Level 对话中主导。</div>
                </div>
                {spin ? (
                  (["s","p","i","n"] as const).map(type => (
                    <div key={type} className={cn("rounded-lg border p-3", spinColors[type])}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold">{spinLabels[type]}</span>
                        <span className="text-[10px] opacity-70 font-medium">{spinOwners[type]}</span>
                      </div>
                      <ul className="space-y-1.5">
                        {spin[type].map((q, idx) => (
                          <li key={idx} className="text-[11px] text-foreground/80 flex items-start gap-1.5">
                            <span className="opacity-50 flex-shrink-0 mt-0.5">{idx + 1}.</span>
                            <span>{q}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="text-sm mb-1">暂无预置 SPIN 问题库</div>
                    <div className="text-xs">SAM 到位后可基于真实接触录入定制化提问话术</div>
                  </div>
                )}
              </div>
            );
          })()}
          {/* 效能基线 tab */}
          {activeTab === "metrics" && <ClientMetricsTab clientId={client.id} />}
          {/* Trend Chart tab */}
          {activeTab === "trend" && (
            <div className="p-4 bg-muted/5">
              <div className="mb-3">
                <div className="text-xs font-semibold text-foreground mb-0.5">MEDDPICC 变化趋势（最近16周快照）</div>
                <div className="text-[10px] text-muted-foreground">每次保存MEDDPICC评分时自动记录快照</div>
              </div>
              {historySnapshots.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <TrendingUp className="w-8 h-8 mb-2 opacity-30" />
                  <div className="text-xs">暂无历史快照数据</div>
                  <div className="text-[10px] mt-1">修改MEDDPICC评分并保存后将自动记录</div>
                </div>
              ) : (
                <div style={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={historySnapshots.map((snap: any) => ({
                        date: new Date(snap.createdAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                        总分: snap.scores?.totalScore ?? 0,
                        M: snap.scores?.metricsScore ?? 0,
                        E: snap.scores?.economicBuyerScore ?? 0,
                        D1: snap.scores?.decisionCriteriaScore ?? 0,
                        D2: snap.scores?.decisionProcessScore ?? 0,
                        P: snap.scores?.paperProcessScore ?? 0,
                        I: snap.scores?.implicatePainScore ?? 0,
                        C1: snap.scores?.championScore ?? 0,
                        C2: snap.scores?.competitionScore ?? 0,
                      }))}
                      margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#6b7280' }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#6b7280' }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '11px' }}
                        labelStyle={{ color: '#9ca3af' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }} />
                      <Line type="monotone" dataKey="总分" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                      <Line type="monotone" dataKey="M" stroke="#22c55e" strokeWidth={1} dot={false} />
                      <Line type="monotone" dataKey="E" stroke="#ef4444" strokeWidth={1} dot={false} />
                      <Line type="monotone" dataKey="C1" stroke="#f59e0b" strokeWidth={1} dot={false} />
                      <Line type="monotone" dataKey="C2" stroke="#06b6d4" strokeWidth={1} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Key Contacts tab */}
          {activeTab === "contacts" && (
            <div className="p-4 bg-muted/5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-xs font-semibold text-foreground mb-1">建图进度</div>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${contactProgressPct}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      已接触 <span className="text-foreground font-mono">{contactedCount}</span> / <span className="font-mono">{contacts.length}</span> 人
                    </span>
                    {championCount > 0 && (
                      <span className="text-xs text-green-400 font-medium">{championCount} Champion</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 text-[10px] text-muted-foreground">
                  <span className="text-red-400">■ 决策者</span>
                  <span className="text-green-400">■ Champion</span>
                  <span className="text-blue-400">■ 影响者</span>
                </div>
              </div>
              <KeyContactsPanel clientId={client.id} clientName={client.name} />
            </div>
          )}

          {/* Active Fronts tab */}
          {activeTab === "fronts" && (
            <div className="p-4 bg-muted/5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-xs font-semibold text-foreground mb-0.5 flex items-center gap-1.5">
                    <Swords className="w-3.5 h-3.5 text-orange-400" />活跃战线 Active Fronts
                  </div>
                  <div className="text-[10px] text-muted-foreground">管理该客户下的多条并行商机，每条战线独立跟踪阶段、竞品和对接人</div>
                </div>
                {(opps as any[]).length > 0 && (
                  <div className="flex gap-2 text-[10px]">
                    <span className="text-green-400">{(opps as any[]).filter((o: any) => o.status === '活跃').length} 活跃</span>
                    <span className="text-cyan-400">{(opps as any[]).filter((o: any) => o.status === '赢单').length} 赢单</span>
                  </div>
                )}
              </div>
              <ActiveFrontsPanel clientId={client.id} focusOppId={focusOppId} />
            </div>
          )}

          {/* Win Strategy tab */}
          {activeTab === "winstrategy" && (
            <div className="p-4 bg-muted/5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-foreground mb-0.5 flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-yellow-400" />Win Strategy 赢单战略
                  </div>
                  <div className="text-[10px] text-muted-foreground">IBM Blue Sheet 风格的大客户打单战略规划，AI 辅助生成赢单建议</div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs gap-1.5"
                    onClick={() => setWsEdit(winStrategy ? { ...winStrategy } : { clientId: client.id, bizObjective: '', valueProposition: '', competitorSummary: '', winStrategy: '', keyMilestones: '', riskAndMitigation: '' })}
                  >
                    <Edit2 className="w-3 h-3" />
                    {winStrategy ? '编辑' : '新建'}
                  </Button>
                  <Button
                    size="sm"
                    className="text-xs gap-1.5 bg-[#00A8D6] hover:bg-[#0090b8]"
                    disabled={wsGenerating}
                    title="基于 MEDDPICC、竞品情报、效能数据，生成 IBM Blue Sheet 赢单策略"
                    onClick={() => {
                      setWsGenerating(true);
                      const meddpiccSummary = meddpicc ? `M:${meddpicc.metricsScore} E:${meddpicc.economicBuyerScore} D:${meddpicc.decisionCriteriaScore} I:${meddpicc.implicatePainScore} C:${meddpicc.championScore} C2:${meddpicc.competitionScore}` : '';
                      const contactsSummary = contacts.map((c: any) => `${c.name}(${c.title})`).join(', ');
                      generateWinStrategy.mutate({
                        clientId: client.id,
                        clientName: client.name,
                        stage: client.stage,
                        meddpiccSummary,
                        contactsSummary,
                        bizObjective: winStrategy?.bizObjective || '',
                        valueProposition: winStrategy?.valueProposition || '',
                        competitorSummary: winStrategy?.competitorSummary || '',
                      });
                    }}
                  >
                    {wsGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    AI 生成建议
                  </Button>
                </div>
              </div>

              {/* Edit form */}
              {wsEdit && (
                <div className="space-y-3 p-3 bg-card border border-border rounded-lg">
                  {([
                    { key: 'bizObjective', label: '客户业务目标', placeholder: '例：完成 PDPA 合规改造，降低安全事故风险' },
                    { key: 'valueProposition', label: '我方价値主张', placeholder: '例：本地化支持 + 业界唯一的 AI 安全能力' },
                    { key: 'competitorSummary', label: '竞争态势', placeholder: '例：主要竞品 QAX，客户对其本地化能力有顾虑' },
                    { key: 'winStrategy', label: '赢单关键因素', placeholder: '例：通过 Champion Ray 建立上层信任，强调合规属性' },
                    { key: 'keyMilestones', label: '关键里程碑', placeholder: '例：Q3末 POC，Q4初合同签订' },
                    { key: 'riskAndMitigation', label: '风险与应对', placeholder: '例：预算审批延迟风险，提前投入 CFO 层面的商业案例' },
                  ] as const).map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <label className="text-[10px] text-muted-foreground font-medium mb-1 block">{label}</label>
                      <textarea
                        className="w-full text-xs bg-muted/50 border border-border rounded px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                        rows={2}
                        placeholder={placeholder}
                        value={(wsEdit as any)[key] || ''}
                        onChange={e => setWsEdit({ ...wsEdit, [key]: e.target.value })}
                      />
                    </div>
                  ))}
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="ghost" className="text-xs" onClick={() => setWsEdit(null)}>取消</Button>
                    <Button size="sm" className="text-xs" onClick={() => saveWinStrategy.mutate({ clientId: client.id, ...wsEdit })}>保存</Button>
                  </div>
                </div>
              )}

              {/* Display */}
              {!wsEdit && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {([
                    { key: 'bizObjective', label: '客户业务目标', icon: '🎯' },
                    { key: 'valueProposition', label: '我方价値主张', icon: '✨' },
                    { key: 'competitorSummary', label: '竞争态势', icon: '⚔️' },
                    { key: 'winStrategy', label: '赢单关键因素', icon: '🏆' },
                    { key: 'keyMilestones', label: '关键里程碑', icon: '📅' },
                    { key: 'riskAndMitigation', label: '风险与应对', icon: '⚠️' },
                  ] as const).map(({ key, label, icon }) => (
                    <div key={key} className="p-3 bg-card border border-border rounded-lg">
                      <div className="text-[10px] text-muted-foreground font-medium mb-1">{icon} {label}</div>
                      <div className="text-xs text-foreground leading-relaxed">
                        {(winStrategy as any)?.[key] || <span className="text-muted-foreground/50 italic">暂未填写</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* AI Suggestion */}
              {winStrategy?.aiSuggestion && (
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="text-[10px] font-semibold text-primary mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" />
                    AI Win Strategy 建议
                  </div>
                  <div className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{winStrategy.aiSuggestion}</div>
                </div>
              )}
              {winStrategy?.aiSuggestion && (
                <WinStrategyExtras clientId={client.id} aiSuggestion={winStrategy.aiSuggestion} enabled={expanded && activeTab === "winstrategy"} stage={client.stage} />
              )}

              {!winStrategy && !wsEdit && (
                <div className="text-center py-8 text-muted-foreground">
                  <Trophy className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">点击「新建」填写打单战略，或直接点「AI 生成建议」</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>

    {/* AI Review Dialog */}
    <Dialog open={reviewOpen} onOpenChange={(o) => { if (!o) { setTimeout(() => { setReviewContent(""); setReviewLoading(false); setReviewSavedAt(null); }, 300); } setReviewOpen(o); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-purple-400">
            <Sparkles className="w-4 h-4" />
            {reviewType === "0to1" ? `🗺️ 0→1 阶段推进 Review · ${client.name}` : 
             reviewType === "1toN" ? `🎯 1→N 商机赢单 Review · ${client.name}` :
             reviewType === "buyingGroup" ? `👥 Buying Group 覆盖分析 · ${client.name}` :
             `📈 拜访趋势分析 · ${client.name}`}
          </DialogTitle>
        </DialogHeader>
        {reviewSavedAt && !reviewLoading && (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-md">
            <span className="text-green-400">✓ 已保存</span>
            <span>生成于 {reviewSavedAt.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
            <button type="button" onClick={() => loadHistoryReview(reviewType, reviewOppId ?? undefined)} className="ml-auto text-purple-400 hover:text-purple-300 underline">
              加载上次结果
            </button>
          </div>
        )}
        {reviewLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">AI 正在分析战局，请稍候...</p>
          </div>
        ) : (
          <div className="text-sm leading-relaxed">
            {highlightedSection && (
              <div className="mb-3 flex items-center gap-2 text-xs bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2">
            {/* Review 改进闭环：与上次对比的变化摘要条 */}
            {(() => {
              const delta = reviewDelta;
              if (!delta) return null;
              const dimLabels: Record<string, string> = {
                metricsScore: 'M', economicBuyerScore: 'E', decisionCriteriaScore: 'D1',
                decisionProcessScore: 'D2', paperProcessScore: 'P', implicatePainScore: 'I',
                championScore: 'C', competitionScore: 'C2',
              };
              const deltaItems = Object.entries(delta.meddpiccDelta || {}).map(([k, v]) => ({
                label: dimLabels[k] || k, value: v as number,
              }));
              return (
                <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] bg-blue-500/5 border border-blue-500/20 rounded-lg px-3 py-2">
                  <span className="text-blue-400 font-medium flex-shrink-0">📊 距上次 Review {delta.daysBetween}天</span>
                  {deltaItems.length > 0 && (
                    <span className="text-muted-foreground">MEDDPICC：{deltaItems.map(d => (
                      <span key={d.label} className={d.value > 0 ? 'text-green-400' : 'text-red-400'}>
                        {d.label}{d.value > 0 ? `↑${d.value}` : `↓${Math.abs(d.value)}`}{' '}
                      </span>
                    ))}</span>
                  )}
                  {delta.newContacts > 0 && <span className="text-cyan-400">新增关键人 {delta.newContacts}位</span>}
                  {delta.newVisits > 0 && <span className="text-purple-400">新增拜访 {delta.newVisits}次</span>}
                  {deltaItems.length === 0 && delta.newContacts === 0 && delta.newVisits === 0 && (
                    <span className="text-muted-foreground">暂无明显变化</span>
                  )}
                </div>
              );
            })()}
                <span className="text-yellow-400">🔍 已高亮对应数据字段</span>
                <button type="button" onClick={() => setHighlightedSection(null)} className="ml-auto text-muted-foreground hover:text-foreground">✕ 取消高亮</button>
              </div>
            )}
            {!reviewLoading && reviewContent && (reviewContent.includes("效能基线未填写") || reviewContent.includes("效能基线数据缺失")) && (
              <div className="mb-3 flex items-center gap-2 text-xs bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                <span className="text-amber-400">⚠️ 效能基线未填写，CoM Before State 量化依据缺失</span>
                <button
                  type="button"
                  onClick={() => { setReviewOpen(false); setActiveTab("metrics"); setTimeout(() => { const el = document.querySelector('[data-highlight="effectiveness-baseline"]'); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); (el as HTMLElement).classList.add('ring-2', 'ring-amber-400'); setTimeout(() => (el as HTMLElement).classList.remove('ring-2', 'ring-amber-400'), 3000); } }, 400); }}
                  className="ml-auto text-xs px-2 py-1 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors flex-shrink-0"
                >
                  → 去填写效能基线
                </button>
              </div>
            )}
            <ReactMarkdown
              components={{
                h1: ({children}) => <h1 className="text-lg font-bold text-purple-300 mt-4 mb-2 pb-1 border-b border-purple-500/30">{children}</h1>,
                h2: ({node, children, ...props}) => {
                  const text = String(children);
                  const sectionKey = text.includes("MEDDPICC") ? "meddpicc" :
                    text.includes("Champion") ? "champion" :
                    text.includes("Blue Sheet") || text.includes("战局") ? "blue-sheet" :
                    text.includes("关键人") || text.includes("Buying") ? "contacts" : null;
                  const isHighlighted = sectionKey && highlightedSection === sectionKey;
                  // Map section to quick fix action
                  const quickFixMap: Record<string, { label: string; action: () => void }> = {
                    "meddpicc": { label: "→ 去修正评分", action: () => { setHighlightedSection(null); setReviewOpen(false); setTimeout(() => { setActiveTab("meddpicc"); setExpanded(true); setHighlightTarget("meddpicc-notes"); setHighlightBubble("请补充评分依据（备注字段）"); toast("请核实并修正对应维度的评分依据", { icon: "📊" }); }, 200); } },
                    "champion": { label: "→ 去修正Champion", action: () => { setHighlightedSection(null); setReviewOpen(false); setTimeout(() => { setActiveTab("contacts"); setExpanded(true); toast("请在关键人中更新 Champion 三维评分和非正式接触记录", { icon: "👤" }); }, 200); } },
                    "blue-sheet": { label: "→ 去填写Blue Sheet", action: () => { setHighlightedSection(null); setReviewOpen(false); setTimeout(() => { setActiveTab("winstrategy"); setExpanded(true); toast("请补充 Blue Sheet 战略信息", { icon: "📋" }); }, 200); } },
                    "contacts": { label: "→ 去更新关键人", action: () => { setHighlightedSection(null); setReviewOpen(false); setTimeout(() => { setActiveTab("contacts"); setExpanded(true); toast("请补充关键人覆盖和关系深度信息", { icon: "👥" }); }, 200); } },
                  };
                  const quickFix = sectionKey ? quickFixMap[sectionKey] : null;
                  return (
                    <div className={`flex items-center gap-2 mt-4 mb-2 px-2 py-1 rounded transition-all ${isHighlighted ? "bg-yellow-500/20 border border-yellow-500/40" : ""}`} id={sectionKey || undefined}>
                      <h2 className={`text-base font-semibold flex-1 ${isHighlighted ? "text-yellow-300" : "text-purple-200"}`}>{children}</h2>
                      {isHighlighted && quickFix && (
                        <button type="button"
                          onClick={quickFix.action}
                          className="text-[10px] px-2 py-1 rounded bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 text-yellow-300 flex-shrink-0 transition-colors font-medium">
                          {quickFix.label}
                        </button>
                      )}
                    </div>
                  );
                },
                h3: ({children}) => <h3 className="text-sm font-semibold text-blue-300 mt-3 mb-1">{children}</h3>,
                p: ({children}) => {
                  const text = String(children);
                  const isWarning = text.includes("⚠️") || text.includes("📭");
                  if (isWarning) {
                    const highlightKey = getHighlightKey(text);
                    return (
                      <p
                        className={`text-foreground/90 mb-2 leading-relaxed cursor-pointer rounded px-2 py-1 transition-all ${highlightKey ? "hover:bg-yellow-500/10 hover:border hover:border-yellow-500/30 border border-transparent" : ""}`}
                        onClick={() => {
                          if (highlightKey) {
                            setHighlightedSection(highlightKey);
                            const el = document.getElementById(highlightKey);
                            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                          }
                        }}
                        title={highlightKey ? "点击高亮对应数据字段" : undefined}
                      >
                        {children}
                        {highlightKey && <span className="ml-1 text-[10px] text-yellow-500/70">↑ 点击定位</span>}
                      </p>
                    );
                  }
                  return <p className="text-foreground/90 mb-2 leading-relaxed">{children}</p>;
                },
                ul: ({children}) => <ul className="list-none space-y-1 mb-3">{children}</ul>,
                ol: ({children}) => <ol className="list-decimal list-inside space-y-1 mb-3 text-foreground/90">{children}</ol>,
                li: ({children}) => {
                  const text = String(children);
                  const isWarning = text.includes("⚠️") || text.includes("📭");
                  const highlightKey = isWarning ? getHighlightKey(text) : null;
                  return (
                    <li
                      className={`flex items-start gap-2 text-foreground/85 ${highlightKey ? "cursor-pointer hover:bg-yellow-500/10 rounded px-1 transition-all" : ""}`}
                      onClick={() => {
                        if (highlightKey) {
                          setHighlightedSection(highlightKey);
                          const el = document.getElementById(highlightKey);
                          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                        }
                      }}
                    >
                      <span className={`mt-0.5 flex-shrink-0 ${isWarning ? "text-yellow-400" : "text-purple-400"}`}>▸</span>
                      <span>{children}{highlightKey && <span className="ml-1 text-[10px] text-yellow-500/70">↑ 点击定位</span>}</span>
                    </li>
                  );
                },
                strong: ({children}) => <strong className="text-yellow-300 font-semibold">{children}</strong>,
                em: ({children}) => <em className="text-blue-300 not-italic font-medium">{children}</em>,
                blockquote: ({children}) => <blockquote className="border-l-2 border-purple-500 pl-3 my-2 text-muted-foreground italic">{children}</blockquote>,
                code: ({children}) => <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono text-green-300">{children}</code>,
                hr: () => <hr className="border-border/50 my-3" />,
              }}
            >
              {reviewContent || "暂无内容"}
            </ReactMarkdown>
          </div>
        )}
        {!reviewLoading && reviewContent && (
          <div className="flex justify-end pt-2 border-t border-border/50">
            <button
              type="button"
              onClick={() => { const plain = reviewContent.replace(/#{1,6}\s/g, '').replace(/\*\*/g, '').replace(/\*/g, '').replace(/^[-•▸]\s/gm, '').replace(/`/g, ''); navigator.clipboard.writeText(plain); toast.success("已复制（纯文本）"); }}
              className="text-xs px-3 py-1.5 rounded border border-border hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
            >
              📋 复制全文
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
    {/* AD 问询问题 Dialog */}
    <Dialog open={adInquiryOpen} onOpenChange={(o) => { setAdInquiryOpen(o); if (!o) setAdInquiryNotes(""); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-400">
            🔍 AD 问询问题 — {client.name}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {adInquiryLoading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              AI 正在生成问询问题...
            </div>
          ) : (
            <div className="space-y-3">
              {(() => {
                const lines = adInquiryContent.split("\n").filter(l => l.trim());
                let qNum = 0;
                return lines.map((line, idx) => {
                  const isQ = /^问题\d+[:：]/.test(line.trim());
                  const isNote = line.includes("如果SAM答不出") || line.startsWith("附：");
                  if (isQ) {
                    qNum++;
                    const qText = line.replace(/^问题\d+[:：]\s*/, "");
                    const dimMatch = qText.match(/（考察维度：([^）]+)）/);
                    const cleanQ = qText.replace(/（考察维度：[^）]+）/, "").trim();
                    return (
                      <div key={idx} className="border border-orange-500/20 rounded-lg p-3 bg-orange-500/5 group">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <span className="text-[10px] text-orange-400 font-medium">问题 {qNum}</span>
                            {dimMatch && <span className="text-[10px] text-muted-foreground ml-2">考察：{dimMatch[1]}</span>}
                            <p className="text-sm text-foreground mt-1">{cleanQ}</p>
                          </div>
                          <button type="button"
                            onClick={() => { navigator.clipboard.writeText(cleanQ); toast.success("已复制"); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] px-2 py-1 rounded border border-border hover:bg-muted/50 text-muted-foreground flex-shrink-0">
                            复制
                          </button>
                        </div>
                      </div>
                    );
                  }
                  if (isNote) {
                    return (
                      <div key={idx} className="border border-yellow-500/20 rounded-lg p-3 bg-yellow-500/5">
                        <p className="text-xs text-yellow-400/80">{line.replace(/^附：/, "")}</p>
                      </div>
                    );
                  }
                  return line.trim() ? <p key={idx} className="text-xs text-muted-foreground">{line}</p> : null;
                });
              })()}
              <div className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-foreground">📝 SAM 回答记录 & AD 评估</label>
                  <span className="text-[10px] text-muted-foreground">仅本地，不上传</span>
                </div>
                <textarea
                  className="w-full text-xs bg-muted/30 border border-border rounded p-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                  rows={5}
                  placeholder={"记录 SAM 的回答情况...\n\n问题1 回答：\n评估：\n\n问题2 回答：\n评估：\n\n整体判断："}
                  value={adInquiryNotes}
                  onChange={e => setAdInquiryNotes(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
        {adInquiryContent && !adInquiryLoading && (
          <>
            {/* Coaching summary result */}
            {(coachingSummary || coachingSummaryLoading) && (
              <div className="border border-green-500/30 rounded-lg p-3 bg-green-500/5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-green-400">🎯 辅导建议</span>
                    {coachingSummaryStageLabel && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${adInquiryStageType === "0to1" ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" : "bg-blue-500/20 text-blue-300 border border-blue-500/30"}`}>
                        {coachingSummaryStageLabel}
                      </span>
                    )}
                    {coachingSummaryLoading && <div className="w-3 h-3 border border-green-400 border-t-transparent rounded-full animate-spin" />}
                  </div>
                  {coachingSummary && (client as any).assignedSamId && (
                    <button type="button"
                      onClick={handleDispatchToSam}
                      disabled={dispatchingToSam}
                      className="text-[10px] px-2 py-1 rounded border border-green-500/40 bg-green-500/15 hover:bg-green-500/25 text-green-400 flex-shrink-0 disabled:opacity-50 transition-colors">
                      {dispatchingToSam ? "下发中..." : "📤 下发给SAM"}
                    </button>
                  )}
                </div>
                {coachingSummary && (
                  <ReactMarkdown
                    components={{
                      p: ({children}) => <p className="text-xs text-foreground/90 mb-1">{children}</p>,
                      strong: ({children}) => <strong className="text-green-300 font-semibold">{children}</strong>,
                    }}
                  >{coachingSummary}</ReactMarkdown>
                )}
              </div>
            )}
            <div className="border-t border-border pt-3 flex justify-between items-center gap-2">
              <p className="text-xs text-muted-foreground flex-1">只有真正做过的人才能回答</p>
              <div className="flex gap-2 flex-wrap justify-end">
                {adInquiryNotes && (
                  <button type="button"
                    onClick={handleGenerateCoachingSummary}
                    disabled={coachingSummaryLoading}
                    className="text-xs px-3 py-1.5 rounded border border-green-500/30 bg-green-500/10 hover:bg-green-500/20 text-green-400 disabled:opacity-50">
                    {coachingSummaryLoading ? "生成中..." : "✨ 生成辅导建议"}
                  </button>
                )}
                {adInquiryNotes && (
                  <button type="button"
                    onClick={() => { navigator.clipboard.writeText(`【AD问询 - ${client.name}】\n\n${adInquiryContent}\n\n【SAM回答记录】\n${adInquiryNotes}${coachingSummary ? `\n\n【辅导建议】\n${coachingSummary}` : ""}`); toast.success("完整记录已复制"); }}
                    className="text-xs px-3 py-1.5 rounded border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary">
                    📋 复制完整记录
                  </button>
                )}
                <button type="button"
                  onClick={() => { navigator.clipboard.writeText(adInquiryContent); toast.success("问题已复制"); }}
                  className="text-xs px-3 py-1.5 rounded border border-border hover:bg-muted/50 text-muted-foreground">
                  📋 仅复制问题
                </button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
    {/* 下发辅导建议编辑弹窗 */}
    <Dialog open={dispatchEditOpen} onOpenChange={setDispatchEditOpen}>
      <DialogContent className="max-w-xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-400">
            📤 下发辅导建议给 {(client as any).assignedSamName}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg">
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${adInquiryStageType === "0to1" ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" : "bg-blue-500/20 text-blue-300 border border-blue-500/30"}`}>
              {coachingSummaryStageLabel || adInquiryStageType}
            </span>
            <span>客户：{client.name}</span>
            <span className="ml-auto">发送给：{(client as any).assignedSamName}</span>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">辅导建议内容（可编辑）</label>
            <textarea
              className="w-full text-xs bg-muted/30 border border-border rounded-lg p-3 resize-none focus:outline-none focus:ring-1 focus:ring-green-500/50 text-foreground placeholder:text-muted-foreground leading-relaxed"
              rows={12}
              value={dispatchEditContent}
              onChange={e => setDispatchEditContent(e.target.value)}
              placeholder="辅导建议内容..."
            />
            <p className="text-[10px] text-muted-foreground mt-1">SAM 将在「我的辅导任务」中看到这条待办，包含完整内容。</p>
          </div>
        </div>
        <div className="border-t border-border pt-3 flex justify-between items-center gap-2">
          <button type="button" onClick={() => setDispatchEditContent(coachingSummary)}
            className="text-xs px-3 py-1.5 rounded border border-border hover:bg-muted/50 text-muted-foreground">
            ↺ 恢复原始内容
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={() => setDispatchEditOpen(false)}
              className="text-xs px-3 py-1.5 rounded border border-border hover:bg-muted/50 text-muted-foreground">
              取消
            </button>
            <button type="button" onClick={handleConfirmDispatch} disabled={dispatchingToSam || !dispatchEditContent.trim()}
              className="text-xs px-4 py-1.5 rounded bg-green-600 hover:bg-green-700 text-white font-medium disabled:opacity-50 transition-colors">
              {dispatchingToSam ? "下发中..." : "✓ 确认下发"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

const EMPTY_FORM = { name: "", nameEn: "", industry: "", priority: "P1" as "P0"|"P1"|"P2", stage: "建图" as string, hookTopic: "", securityAngle: "", monitorKeywords: "" };

// WinStrategy 情报信号折叠面板 + 一键复制（独立组件，避免 hooks 违规）
function WinStrategyExtras({ clientId, aiSuggestion, enabled, stage }: { clientId: number; aiSuggestion: string; enabled: boolean; stage?: string }) {
  const { data: wsSignals } = trpc.intelligence.listByClient.useQuery({ clientId }, { enabled });
  const top3 = (wsSignals || []).slice(0, 3);
  const [sigOpen, setSigOpen] = useState(false);
  const [wsCopied, setWsCopied] = useState(false);
  const [extractOpen, setExtractOpen] = useState(false);
  const [extractedActions, setExtractedActions] = useState<Array<{ title: string; description: string; role: string; dueDays: number }>>([]);
  const [extractLoading, setExtractLoading] = useState(false);
  const [editableActions, setEditableActions] = useState<Array<{ title: string; description: string; role: string; dueDays: number }>>([]);
  const [createdTasks, setCreatedTasks] = useState<Array<{ title: string; role: string; dueDays: number }>>([]);
  const extractMut = trpc.winStrategyActions.extractActions.useMutation();
  const addTaskMut = trpc.pod.addTask.useMutation();
  const [historyOpen, setHistoryOpen] = useState(false);
  const { data: wsHistory = [] } = (trpc.winStrategy as any).getHistory.useQuery({ clientId }, { enabled });

  const handleExtract = async () => {
    setExtractLoading(true);
    setExtractOpen(true);
    setCreatedTasks([]);
    try {
      const res = await extractMut.mutateAsync({ clientId, aiSuggestion, stage: stage || '未知' });
      setExtractedActions(res.actions);
      setEditableActions(res.actions.map(a => ({ ...a })));
    } catch (e: any) {
      toast.error("提取失败：" + (e?.message || "未知错误"));
      setExtractOpen(false);
    } finally {
      setExtractLoading(false);
    }
  };

  const handleConfirmTasks = async () => {
    try {
      for (const action of editableActions) {
        const dueDate = new Date(Date.now() + action.dueDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        await addTaskMut.mutateAsync({
          clientId,
          assignedRole: (action.role as "AD" | "SAM" | "SA" | "RSM"),
          title: action.title,
          description: action.description,
          dueDate,
        });
      }
      toast.success(`已创建 ${editableActions.length} 条行动任务，可在 AI行动指令台查看`);
      setCreatedTasks(editableActions.map(a => ({ title: a.title, role: a.role, dueDays: a.dueDays })));
      setExtractOpen(false);
    } catch (e: any) {
      toast.error("创建任务失败：" + (e?.message || "未知错误"));
    }
  };

  return (
    <>
    <div className="space-y-2 mt-2">
      <div className="flex justify-end">
        <button type="button"
          onClick={() => {
            const plain = aiSuggestion.replace(/#{1,6}\s/g, '').replace(/\*\*/g, '').replace(/\*/g, '').replace(/^[-•]\s/gm, '').replace(/`/g, '');
            navigator.clipboard.writeText(plain);
            setWsCopied(true);
            setTimeout(() => setWsCopied(false), 2000);
          }}
          className="text-[10px] px-2 py-1 rounded border border-border hover:bg-muted/50 text-muted-foreground transition-colors"
        >
          {wsCopied ? "✓ 已复制" : "📋 复制策略"}
        </button>
      </div>
      {top3.length > 0 && (
        <div className="border border-border/40 rounded-lg overflow-hidden">
          <button type="button"
            onClick={() => setSigOpen(o => !o)}
            className="w-full flex items-center justify-between px-3 py-2 text-[10px] text-muted-foreground hover:bg-muted/30 transition-colors"
          >
            <span>📡 参考情报信号（最新 {top3.length} 条）</span>
            <span>{sigOpen ? "▲" : "▼"}</span>
          </button>
          {sigOpen && (
            <div className="px-3 pb-2 space-y-1.5 border-t border-border/30">
              {top3.map((sig: any) => (
                <div key={sig.id} className="text-[10px] bg-muted/20 rounded p-2">
                  <span className={`inline-block px-1 py-0.5 rounded text-[9px] font-medium mr-1.5 ${sig.urgency === 'high' ? 'bg-red-500/20 text-red-400' : sig.urgency === 'medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-muted text-muted-foreground'}`}>
                    {sig.signalType} / {sig.urgency}
                  </span>
                  <span className="text-foreground/80">{(sig.rawSignal || '').slice(0, 80)}{(sig.rawSignal || '').length > 80 ? '...' : ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
    {/* 一键转任务按钮 */}
    <div className="flex justify-end mt-1">
      <button type="button" onClick={handleExtract}
        className="text-[10px] px-2 py-1 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors">
        📋 一键转任务
      </button>
    </div>
    {/* 已创建任务卡片 */}
    {createdTasks.length > 0 && (
      <div className="mt-3 border border-cyan-500/20 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-cyan-500/5 border-b border-cyan-500/15">
          <span className="text-[10px] font-medium text-cyan-400">✓ 已创建 {createdTasks.length} 条行动任务</span>
          <a href="/action-command" className="text-[10px] text-primary hover:underline cursor-pointer">前往指令台查看 →</a>
        </div>
        <div className="divide-y divide-border/20">
          {createdTasks.map((task, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 text-[10px]">
              <span className="px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium flex-shrink-0">{task.role}</span>
              <span className="flex-1 text-foreground/80 truncate">{task.title}</span>
              <span className="text-muted-foreground flex-shrink-0">{task.dueDays}天内</span>
            </div>
          ))}
        </div>
      </div>
    )}
    {/* 一键转任务确认 Dialog */}
    <Dialog open={extractOpen} onOpenChange={setExtractOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-cyan-400 text-sm">📋 Win Strategy → 行动任务</DialogTitle>
        </DialogHeader>
        {extractLoading ? (
          <div className="flex items-center gap-2 py-6 justify-center text-muted-foreground text-xs">
            <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            AI 正在提取行动项...
          </div>
        ) : (
          <div className="space-y-3">
            {editableActions.map((action, idx) => (
              <div key={idx} className="p-3 bg-muted/20 rounded-lg border border-border/30 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">{idx + 1}</span>
                  <input type="text" value={action.title}
                    onChange={e => setEditableActions(prev => prev.map((a, i) => i === idx ? { ...a, title: e.target.value } : a))}
                    className="flex-1 text-xs bg-transparent border-b border-border/50 focus:border-primary outline-none py-0.5" />
                </div>
                <div className="text-[10px] text-muted-foreground">{action.description}</div>
                <div className="flex items-center gap-3 text-[10px]">
                  <select value={action.role}
                    onChange={e => setEditableActions(prev => prev.map((a, i) => i === idx ? { ...a, role: e.target.value } : a))}
                    className="bg-muted/30 border border-border/30 rounded px-1 py-0.5 text-[10px]">
                    {["AD","SAM","SA","RSM"].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <span className="text-muted-foreground">截止</span>
                  <input type="number" value={action.dueDays} min={1} max={90}
                    onChange={e => setEditableActions(prev => prev.map((a, i) => i === idx ? { ...a, dueDays: Number(e.target.value) } : a))}
                    className="w-12 bg-muted/30 border border-border/30 rounded px-1 py-0.5 text-[10px] text-center" />
                  <span className="text-muted-foreground">天内</span>
                </div>
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setExtractOpen(false)}
                className="text-xs px-3 py-1.5 rounded border border-border hover:bg-muted/50 text-muted-foreground">取消</button>
              <button type="button" onClick={handleConfirmTasks}
                className="text-xs px-3 py-1.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30">
                ✓ 确认创建 {editableActions.length} 条任务
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    {/* 版本历史折叠面板 */}
    {(wsHistory as any[]).length > 0 && (
      <div className="mt-3 border border-border/40 rounded-lg overflow-hidden">
        <button
          onClick={() => setHistoryOpen(h => !h)}
          className="flex items-center justify-between w-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <span>🕐</span>
            历史版本（{(wsHistory as any[]).length} 条）
          </span>
          <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", historyOpen && "rotate-180")} />
        </button>
        {historyOpen && (
          <div className="border-t border-border/30 divide-y divide-border/20 max-h-64 overflow-y-auto">
            {(wsHistory as any[]).map((h: any, i: number) => (
              <div key={h.id} className="px-3 py-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] text-muted-foreground">
                    版本 {(wsHistory as any[]).length - i} · {new Date(h.createdAt).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {h.stage && <span className="text-[10px] px-1 py-0.5 rounded bg-muted/40 text-muted-foreground/70">{h.stage}</span>}
                </div>
                <div className="text-xs text-muted-foreground/80 line-clamp-3 leading-relaxed">{h.aiSuggestion?.slice(0, 200)}...</div>
              </div>
            ))}
          </div>
        )}
      </div>
    )}
    </>
  );
}

export default function BattleMap() {
  const utils = trpc.useUtils();
  const { data: clients = [], isLoading } = trpc.clients.list.useQuery();
  const { data: currentUser } = trpc.emailAuth.me.useQuery();
  const isAD = !currentUser || currentUser.podRole === 'AD';

  const [showCreate, setShowCreate] = useState(false);
  // Single-client focus mode: ?clientId=xxx from dashboard navigation
  const [, navigate] = useLocation();
  const initialFocusId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("clientId");
    return id ? parseInt(id, 10) : null;
  }, []);
  const initialFocusOppId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("oppId");
    return id ? parseInt(id, 10) : null;
  }, []);
  const [focusClientId, setFocusClientId] = useState<number | null>(initialFocusId);

  const goToClient = useCallback((id: number, oppId?: number) => {
    setFocusClientId(id);
    const url = oppId ? `/battle-map?clientId=${id}&oppId=${oppId}` : `/battle-map?clientId=${id}`;
    window.history.pushState({}, "", url);
  }, []);

  const goToAllClients = useCallback(() => {
    setFocusClientId(null);
    window.history.replaceState({}, "", "/battle-map");
  }, []);

  const [editTarget, setEditTarget] = useState<(typeof clients)[0] | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<(typeof clients)[0] | null>(null);

  // SAM 筛选 + 阶段筛选 + 健康度筛选
  const [samFilter, setSamFilter] = useState<string>("all"); // "all" | samName | "__unassigned__"
  const [rsmFilter, setRsmFilter] = useState<string>("all"); // "all" | rsmName | "__unassigned__"
  const [stageFilter, setStageFilter] = useState<string>("all"); // "all" | "0to1" | "1toN"
  const [healthFilter, setHealthFilter] = useState<string>("all"); // "all" | "healthy" | "watch" | "risk"
  const { data: samUsers = [] } = trpc.clients.listSamUsers.useQuery();

  // All unique SAM names from clients
  const allSamNames = Array.from(new Set(clients.map(c => (c as any).assignedSamName).filter(Boolean))) as string[];
  // All unique RSM names from clients
  const allRsmNames = Array.from(new Set(clients.map(c => (c as any).assignedRsmName).filter(Boolean))) as string[];

  // Linkage: when RSM is selected, only show SAM names that appear on clients with that RSM
  const visibleSamNames = rsmFilter === "all"
    ? allSamNames
    : Array.from(new Set(
        clients
          .filter(c => (c as any).assignedRsmName === rsmFilter)
          .map(c => (c as any).assignedSamName)
          .filter(Boolean)
      )) as string[];

  // Linkage: when SAM is selected, only show RSM names that appear on clients with that SAM
  const visibleRsmNames = samFilter === "all"
    ? allRsmNames
    : Array.from(new Set(
        clients
          .filter(c => (c as any).assignedSamName === samFilter)
          .map(c => (c as any).assignedRsmName)
          .filter(Boolean)
      )) as string[];

  // If current samFilter is no longer in visibleSamNames after RSM change, reset it
  const effectiveSamFilter = (samFilter !== "all" && samFilter !== "__unassigned__" && !visibleSamNames.includes(samFilter))
    ? "all" : samFilter;
  const effectiveRsmFilter = (rsmFilter !== "all" && rsmFilter !== "__unassigned__" && !visibleRsmNames.includes(rsmFilter))
    ? "all" : rsmFilter;

  const filteredClients = clients.filter(c => {
    // SAM filter
    if (effectiveSamFilter === "__unassigned__" && (c as any).assignedSamName) return false;
    if (effectiveSamFilter !== "all" && effectiveSamFilter !== "__unassigned__" && (c as any).assignedSamName !== effectiveSamFilter) return false;
    // RSM filter
    if (effectiveRsmFilter === "__unassigned__" && (c as any).assignedRsmName) return false;
    if (effectiveRsmFilter !== "all" && effectiveRsmFilter !== "__unassigned__" && (c as any).assignedRsmName !== effectiveRsmFilter) return false;
    // Stage filter
    const ZERO_TO_ONE_STAGES = ["建图", "进门", "定痛", "找人"];
    const ONE_TO_N_STAGES = ["进入商机"];
    if (stageFilter === "0to1" && !ZERO_TO_ONE_STAGES.includes(c.stage)) return false;
    if (stageFilter === "1toN" && !ONE_TO_N_STAGES.includes(c.stage)) return false;
    // Health filter (based on meddpiccAvg)
    const avg = (c as any).meddpiccAvg ?? 0;
    if (healthFilter === "healthy" && avg < 60) return false;
    if (healthFilter === "watch" && (avg < 30 || avg >= 60)) return false;
    if (healthFilter === "risk" && avg >= 30) return false;
    return true;
  });

  const activeFilterCount = [samFilter !== "all", rsmFilter !== "all", stageFilter !== "all", healthFilter !== "all"].filter(Boolean).length;

  const clearAllFilters = () => { setSamFilter("all"); setRsmFilter("all"); setStageFilter("all"); setHealthFilter("all"); };

  // CSV Import state
  const [showImport, setShowImport] = useState(false);
  const [importStep, setImportStep] = useState<"upload" | "preview" | "done">("upload");
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<{ succeeded: number; total: number; results: any[] } | null>(null);

  const createMut = trpc.clients.create.useMutation({
    onSuccess: () => { utils.clients.list.invalidate(); setShowCreate(false); toast.success("客户已添加"); },
    onError: (e) => toast.error("添加失败：" + e.message),
  });
  const updateBasicMut = trpc.clients.update.useMutation({
    onSuccess: () => { utils.clients.list.invalidate(); setEditTarget(null); toast.success("客户信息已更新"); },
    onError: (e) => toast.error("更新失败：" + e.message),
  });
  const deleteMut = trpc.clients.delete.useMutation({
    onSuccess: () => { utils.clients.list.invalidate(); setDeleteTarget(null); toast.success("客户已删除"); },
    onError: (e) => toast.error("删除失败：" + e.message),
  });

  const importBatchMut = trpc.clients.importBatch.useMutation({
    onSuccess: (data) => {
      utils.clients.list.invalidate();
      setImportResult(data);
      setImportStep("done");
    },
    onError: (e) => toast.error("导入失败：" + e.message),
  });

  // CSV Template columns
  const CSV_TEMPLATE_HEADER = "客户名称,英文名称,行业,优先级(P0/P1/P2),当前阶段,敲门砖话题,安全切入点,情报监控关键词(英文分号分隔)";
  const CSV_TEMPLATE_EXAMPLE = "华为技术,Huawei Technologies,通信/5G基础设施,P0,建图,客户正在推进安全自动化,TrustOne EDR + NDR,Huawei 5G security NDR";
  function downloadTemplate() {
    const bom = "\uFEFF";
    const content = bom + CSV_TEMPLATE_HEADER + "\n" + CSV_TEMPLATE_EXAMPLE;
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "T100客户导入模板.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function parseCSV(text: string) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return { rows: [], errors: ["文件为空或无数据行"] };
    const rows: any[] = [];
    const errors: string[] = [];
    const STAGES = ["建图", "进门", "定痛", "找人", "进入商机"];
    // Skip header row (index 0)
    for (let i = 1; i < lines.length; i++) {
      // Simple CSV split (handles quoted fields)
      const cols = lines[i].split(",").map(c => c.trim().replace(/^"|"$/g, ""));
      const name = cols[0]?.trim();
      if (!name) { errors.push(`第 ${i + 1} 行：客户名称为空，已跳过`); continue; }
      const priority = ["P0", "P1", "P2"].includes(cols[3]?.toUpperCase()) ? cols[3].toUpperCase() as "P0"|"P1"|"P2" : "P1";
      const stage = STAGES.includes(cols[4]) ? cols[4] : "建图";
      const keywords = cols[7] ? cols[7].split(/[，,；;]+/).map(k => k.trim()).filter(Boolean) : [];
      rows.push({ name, nameEn: cols[1] || undefined, industry: cols[2] || undefined, priority, stage, hookTopic: cols[5] || undefined, securityAngle: cols[6] || undefined, monitorKeywords: keywords.length ? keywords : undefined });
    }
    return { rows, errors };
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { rows, errors } = parseCSV(text);
      setImportRows(rows);
      setImportErrors(errors);
      if (rows.length > 0) setImportStep("preview");
      else toast.error("未解析到有效客户行，请检查文件格式");
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  }

  function openImport() { setShowImport(true); setImportStep("upload"); setImportRows([]); setImportErrors([]); setImportResult(null); }

  function openCreate() { setForm(EMPTY_FORM); setShowCreate(true); }
  function openEdit(c: (typeof clients)[0]) {
    setForm({
      name: c.name, nameEn: c.nameEn ?? "", industry: c.industry ?? "",
      priority: c.priority, stage: c.stage,
      hookTopic: c.hookTopic ?? "", securityAngle: c.securityAngle ?? "",
      monitorKeywords: (c.monitorKeywords ?? []).join(", "),
    });
    setEditTarget(c);
  }

  const STAGES_LIST = ["建图", "进门", "定痛", "找人", "进入商机"];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">战场地图</h1>
          <p className="text-sm text-muted-foreground mt-1">{clients.length} 户战略客户 MEDDPICC 完成度可视化看板 · 实时更新 · 含关键人图谱</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {isAD && (
            <>
              <Button size="sm" variant="outline" onClick={openImport} className="gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                批量导入
              </Button>
              <Button size="sm" onClick={openCreate} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                新增客户
              </Button>
            </>
          )}
        </div>
      </div>

{isAD && (
      <div className="mb-4 p-3 rounded-xl bg-card border border-border space-y-2.5">
        {/* SAM 筛选行 */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider w-10 flex-shrink-0">SAM</span>
          <button onClick={() => setSamFilter("all")}
            className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors font-medium ${effectiveSamFilter === "all" ? "bg-[#00A8D6]/20 text-[#00A8D6] border-[#00A8D6]/40" : "bg-muted/20 text-muted-foreground border-border hover:border-[#00A8D6]/30 hover:text-[#00A8D6]"}`}>
            全部
          </button>
          {visibleSamNames.map(name => (
            <button key={name} onClick={() => setSamFilter(name)}
              className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors font-medium ${effectiveSamFilter === name ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/40" : "bg-muted/20 text-muted-foreground border-border hover:border-cyan-500/30 hover:text-cyan-400"}`}>
              {name}
            </button>
          ))}
          {allSamNames.filter(n => !visibleSamNames.includes(n)).map(name => (
            <button key={name} disabled
              className="text-xs px-2.5 py-0.5 rounded-full border font-medium opacity-25 cursor-not-allowed bg-muted/10 text-muted-foreground border-border"
              title={`选择的 RSM 没有与 ${name} 协作的客户`}>
              {name}
            </button>
          ))}
          {clients.filter(c => !(c as any).assignedSamName).length > 0 && (
            <button onClick={() => setSamFilter("__unassigned__")}
              className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors font-medium ${effectiveSamFilter === "__unassigned__" ? "bg-orange-500/20 text-orange-400 border-orange-500/40" : "bg-muted/20 text-muted-foreground border-border hover:border-orange-500/30 hover:text-orange-400"}`}>
              未分配
            </button>
          )}
          {rsmFilter !== "all" && visibleSamNames.length > 0 && (
            <span className="text-[10px] text-emerald-400/70 ml-1">← 已按 RSM 联动过滤</span>
          )}
        </div>
        {/* RSM 筛选行 */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider w-10 flex-shrink-0">RSM</span>
          <button onClick={() => setRsmFilter("all")}
            className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors font-medium ${effectiveRsmFilter === "all" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" : "bg-muted/20 text-muted-foreground border-border hover:border-emerald-500/30 hover:text-emerald-400"}`}>
            全部
          </button>
          {visibleRsmNames.map(name => (
            <button key={name} onClick={() => setRsmFilter(name)}
              className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors font-medium ${effectiveRsmFilter === name ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" : "bg-muted/20 text-muted-foreground border-border hover:border-emerald-500/30 hover:text-emerald-400"}`}>
              {name}
            </button>
          ))}
          {allRsmNames.filter(n => !visibleRsmNames.includes(n)).map(name => (
            <button key={name} disabled
              className="text-xs px-2.5 py-0.5 rounded-full border font-medium opacity-25 cursor-not-allowed bg-muted/10 text-muted-foreground border-border"
              title={`选择的 SAM 没有与 ${name} 协作的客户`}>
              {name}
            </button>
          ))}
          {allRsmNames.length === 0 && (
            <span className="text-[10px] text-muted-foreground/50">暂无 RSM 分配</span>
          )}
          {samFilter !== "all" && visibleRsmNames.length > 0 && (
            <span className="text-[10px] text-cyan-400/70 ml-1">← 已按 SAM 联动过滤</span>
          )}
        </div>
        {/* 阶段筛选行 */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider w-10 flex-shrink-0">阶段</span>
          {[
            { key: "all", label: "全部", color: "text-muted-foreground border-border", active: "bg-muted/40 text-foreground border-muted-foreground/40" },
            { key: "0to1", label: "0→1 开拓期", color: "hover:border-blue-500/30 hover:text-blue-400", active: "bg-blue-500/20 text-blue-400 border-blue-500/40" },
            { key: "1toN", label: "1→N 商机期", color: "hover:border-green-500/30 hover:text-green-400", active: "bg-green-500/20 text-green-400 border-green-500/40" },
          ].map(opt => (
            <button key={opt.key} onClick={() => setStageFilter(opt.key)}
              className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors font-medium ${stageFilter === opt.key ? opt.active : `bg-muted/20 text-muted-foreground border-border ${opt.color}`}`}>
              {opt.label}
            </button>
          ))}
        </div>
        {/* 健康度筛选行 */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider w-10 flex-shrink-0">健康</span>
          {[
            { key: "all", label: "全部", active: "bg-muted/40 text-foreground border-muted-foreground/40" },
            { key: "healthy", label: "✓ 健康 (≥60)", active: "bg-green-500/20 text-green-400 border-green-500/40", hover: "hover:border-green-500/30 hover:text-green-400" },
            { key: "watch", label: "⚠ 需关注 (30-59)", active: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40", hover: "hover:border-yellow-500/30 hover:text-yellow-400" },
            { key: "risk", label: "✗ 高风险 (<30)", active: "bg-red-500/20 text-red-400 border-red-500/40", hover: "hover:border-red-500/30 hover:text-red-400" },
          ].map(opt => (
            <button key={opt.key} onClick={() => setHealthFilter(opt.key)}
              className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors font-medium ${healthFilter === opt.key ? opt.active : `bg-muted/20 text-muted-foreground border-border ${(opt as any).hover || ""}`}`}>
              {opt.label}
            </button>
          ))}
        </div>
        {/* 筛选结果摘要 */}
        <div className="flex items-center justify-between pt-1 border-t border-border/50">
          <span className="text-xs text-muted-foreground">
            命中 <strong className="text-foreground">{filteredClients.length}</strong> / {clients.length} 个客户
            {activeFilterCount > 0 && <span className="ml-1 text-[#00A8D6]">（{activeFilterCount} 个筛选条件激活）</span>}
          </span>
          {activeFilterCount > 0 && (
            <button onClick={clearAllFilters}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              ✕ 清除全部筛选
            </button>
          )}
        </div>
      </div>
      )}

      {/* Sales pipeline steps */}
      <div className="mb-5 p-4 rounded-xl bg-card border border-border">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">销售流程进度</span>
          <span className="text-[10px] text-muted-foreground/60">点击阶段节点查看实操指南</span>
        </div>
        <SalesPipelineSteps />
      </div>

      {/* P0 unvisited alert banner */}

      {/* Client cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-card border border-border rounded-xl h-48 animate-pulse" />
          ))}
        </div>
      ) : (
        focusClientId ? (
          // ── Single-client focus mode ──────────────────────────────────────
          (() => {
            const focusClient = clients.find(c => c.id === focusClientId);
            if (!focusClient) return (
              <div className="text-center py-16 text-muted-foreground">
                <p className="text-sm">未找到该客户，可能已被删除。</p>
                <button
                  className="mt-3 text-xs text-primary hover:underline"
                  onClick={goToAllClients}
                >← 返回全部客户</button>
              </div>
            );
            return (
              <div>
                {/* Back button */}
                <button
                  className="mb-4 flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors group border border-primary/30 hover:border-primary/60 px-3 py-1.5 rounded-lg bg-primary/5 hover:bg-primary/10 w-fit"
                  onClick={goToAllClients}
                >
                  <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  返回全部客户
                </button>
                {/* Single client full-width card */}
                <div className="relative group">
                  <ClientCard
                    client={focusClient}
                    defaultExpanded={true}
                    initialTab={initialFocusOppId ? "fronts" : undefined}
                    focusOppId={initialFocusOppId}
                  />
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button
                      onClick={() => openEdit(focusClient)}
                      className="w-6 h-6 rounded bg-background/90 border border-border flex items-center justify-center hover:bg-primary/20 hover:border-primary/40 transition-colors"
                      title="编辑客户基本信息"
                    >
                      <Edit2 className="w-3 h-3 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(focusClient)}
                      className="w-6 h-6 rounded bg-background/90 border border-border flex items-center justify-center hover:bg-red-500/20 hover:border-red-500/40 transition-colors"
                    >
                      <Trash2 className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })()
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredClients.map(client => (
            <div key={client.id} id={`client-card-${client.id}`} className="relative group">
              <ClientCard
                client={client}
                onFocus={() => {
                  goToClient(client.id);
                }}
              />
              {/* Hover action buttons */}
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button
                  onClick={() => openEdit(client)}
                  className="w-6 h-6 rounded bg-background/90 border border-border flex items-center justify-center hover:bg-primary/20 hover:border-primary/40 transition-colors"
                  title="编辑客户基本信息"
                >
                  <Edit2 className="w-3 h-3 text-muted-foreground" />
                </button>
                <button
                  onClick={() => setDeleteTarget(client)}
                  className="w-6 h-6 rounded bg-background/90 border border-border flex items-center justify-center hover:bg-red-500/20 hover:border-red-500/40 transition-colors"
                  title="删除客户"
                >
                  <Trash2 className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
            </div>
          ))}
          {clients.length === 0 && (
            <div className="col-span-full">
              {/* 新用户引导卡片 */}
              <div className="border border-border/50 rounded-2xl p-8 bg-card/50 text-center space-y-6">
                <div>
                  <div className="text-3xl mb-2">🎯</div>
                  <h2 className="text-lg font-bold text-foreground">欢迎使用 AIStorm Command</h2>
                  <p className="text-sm text-muted-foreground mt-1">3步开始你的第一个大客户攻坚</p>
                </div>
                <div className="grid grid-cols-3 gap-4 text-left">
                  {/* Step 1 */}
                  <div className="p-4 bg-muted/20 border border-border/40 rounded-xl space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
                      <span className="text-sm font-semibold text-foreground">新增目标客户</span>
                    </div>
                    <p className="text-xs text-muted-foreground">录入客户名称、行业、优先级，建立客户档案</p>
                    <button type="button" onClick={openCreate}
                      className="w-full text-xs px-3 py-1.5 rounded-lg bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-colors font-medium">
                      + 新增客户
                    </button>
                  </div>
                  {/* Step 2 */}
                  <div className="p-4 bg-muted/20 border border-border/40 rounded-xl space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
                      <span className="text-sm font-semibold text-foreground">录入第一次拜访</span>
                    </div>
                    <p className="text-xs text-muted-foreground">录入接触记录，AI 自动生成会议纪要并更新 MEDDPICC</p>
                    <a href="/meeting-minutes"
                      className="block w-full text-xs px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors font-medium text-center">
                      前往拜访日志
                    </a>
                  </div>
                  {/* Step 3 */}
                  <div className="p-4 bg-muted/20 border border-border/40 rounded-xl space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
                      <span className="text-sm font-semibold text-foreground">获取 AI Review</span>
                    </div>
                    <p className="text-xs text-muted-foreground">AI 分析关系进度，给出阶段推进建议和下一步行动</p>
                    <a href="/quick-review"
                      className="block w-full text-xs px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 transition-colors font-medium text-center">
                      快速 Review
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新增 T100 战略客户</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>客户名称 <span className="text-red-400">*</span></Label>
              <Input placeholder="例：华为技术" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>英文名称</Label>
              <Input placeholder="例：Huawei Technologies" value={form.nameEn} onChange={e => setForm(f => ({ ...f, nameEn: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>行业</Label>
              <Input placeholder="例：通信/5G基础设施" value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>优先级</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v as "P0"|"P1"|"P2" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["P0","P1","P2"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>当前阶段</Label>
                <Select value={form.stage} onValueChange={v => setForm(f => ({ ...f, stage: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STAGES_LIST.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="pt-2 border-t border-border space-y-3">
              <p className="text-xs text-muted-foreground">AI 工作台关键字段（可后填，但填写后 AI 生成质量更高）</p>
              <div className="space-y-1.5">
                <Label>敲门砖话题 <span className="text-muted-foreground text-xs">— 切入客户的第一个话题</span></Label>
                <Textarea
                  placeholder="例：客户正在推进 AI 优先战略，切入话题：AI 如何将产品研发周期从 18 个月压缩到 2-3 个月"
                  className="text-xs h-16 resize-none"
                  value={form.hookTopic}
                  onChange={e => setForm(f => ({ ...f, hookTopic: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>安全切入点 <span className="text-muted-foreground text-xs">— 主推产品线</span></Label>
                <Textarea
                  placeholder="例：TrustOne EDR + 智能体安全管控平台"
                  className="text-xs h-14 resize-none"
                  value={form.securityAngle}
                  onChange={e => setForm(f => ({ ...f, securityAngle: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>情报监控关键词 <span className="text-muted-foreground text-xs">— 用英文逗号分隔</span></Label>
                <Input
                  placeholder="例：Huawei, 5G security, NDR"
                  value={form.monitorKeywords}
                  onChange={e => setForm(f => ({ ...f, monitorKeywords: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
            <Button
              disabled={!form.name.trim() || createMut.isPending}
              onClick={() => createMut.mutate({
                name: form.name.trim(),
                nameEn: form.nameEn || undefined,
                industry: form.industry || undefined,
                priority: form.priority,
                stage: form.stage as any,
                hookTopic: form.hookTopic || undefined,
                securityAngle: form.securityAngle || undefined,
                monitorKeywords: form.monitorKeywords ? form.monitorKeywords.split(",").map(k => k.trim()).filter(Boolean) : undefined,
              })}
            >
              {createMut.isPending ? "添加中…" : "确认添加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={open => { if (!open) setEditTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>编辑客户：{editTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>客户名称 <span className="text-red-400">*</span></Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>英文名称</Label>
              <Input value={form.nameEn} onChange={e => setForm(f => ({ ...f, nameEn: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>行业</Label>
              <Input value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>优先级</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v as "P0"|"P1"|"P2" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["P0","P1","P2"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>当前阶段</Label>
                <Select value={form.stage} onValueChange={v => setForm(f => ({ ...f, stage: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STAGES_LIST.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="pt-2 border-t border-border space-y-3">
              <p className="text-xs text-muted-foreground">AI 工作台关键字段</p>
              <div className="space-y-1.5">
                <Label>敲门砖话题</Label>
                <Textarea
                  className="text-xs h-16 resize-none"
                  value={form.hookTopic}
                  onChange={e => setForm(f => ({ ...f, hookTopic: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>安全切入点</Label>
                <Textarea
                  className="text-xs h-14 resize-none"
                  value={form.securityAngle}
                  onChange={e => setForm(f => ({ ...f, securityAngle: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>情报监控关键词 <span className="text-muted-foreground text-xs">— 用英文逗号分隔</span></Label>
                <Input
                  value={form.monitorKeywords}
                  onChange={e => setForm(f => ({ ...f, monitorKeywords: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>取消</Button>
            <Button
              disabled={!form.name.trim() || updateBasicMut.isPending}
              onClick={() => editTarget && updateBasicMut.mutate({
                id: editTarget.id,
                name: form.name.trim(),
                nameEn: form.nameEn || undefined,
                industry: form.industry || undefined,
                priority: form.priority,
                stage: form.stage as any,
                hookTopic: form.hookTopic || undefined,
                securityAngle: form.securityAngle || undefined,
                monitorKeywords: form.monitorKeywords ? form.monitorKeywords.split(",").map(k => k.trim()).filter(Boolean) : undefined,
              })}
            >
              {updateBasicMut.isPending ? "保存中…" : "保存修改"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-400">确认删除客户？</DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-muted-foreground space-y-2">
            <p>即将删除 <span className="text-foreground font-semibold">{deleteTarget?.name}</span> 及其全部关联数据：</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>MEDDPICC 评分与日志</li>
              <li>情报信号记录</li>
              <li>行动指令历史</li>
              <li>会后纪要 / 1-Pager / 弹药</li>
              <li>关键人图谱</li>
              <li>商机温度评分</li>
            </ul>
            <p className="text-red-400/80 font-medium">此操作不可撤销。</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>取消</Button>
            <Button
              variant="destructive"
              disabled={deleteMut.isPending}
              onClick={() => deleteTarget && deleteMut.mutate({ id: deleteTarget.id })}
            >
              {deleteMut.isPending ? "删除中…" : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <Dialog open={showImport} onOpenChange={open => { if (!open) setShowImport(false); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              {importStep === "upload" && "批量导入 T100 客户"}
              {importStep === "preview" && `预览导入数据（${importRows.length} 条）`}
              {importStep === "done" && "导入完成"}
            </DialogTitle>
          </DialogHeader>

          {/* Step 1: Upload */}
          {importStep === "upload" && (
            <div className="space-y-5 py-2">
              <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium text-foreground">使用步骤</p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>下载 CSV 模板，按格式填写客户信息</li>
                  <li>保存文件（UTF-8 编码，Excel 另存为 CSV UTF-8）</li>
                  <li>上传文件，预览确认后一键导入</li>
                </ol>
              </div>
              <div className="flex flex-col items-center gap-4">
                <Button variant="outline" onClick={downloadTemplate} className="gap-2 w-full">
                  <Download className="w-4 h-4" />
                  下载 CSV 模板
                </Button>
                <div className="w-full">
                  <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors">
                    <Upload className="w-6 h-6 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">点击上传 CSV 文件</span>
                    <span className="text-xs text-muted-foreground/60 mt-1">支持 .csv 格式，UTF-8 编码</span>
                    <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {importStep === "preview" && (
            <div className="flex flex-col gap-3 min-h-0 flex-1">
              {importErrors.length > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 space-y-1">
                  <p className="text-xs font-medium text-yellow-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {importErrors.length} 行已跳过</p>
                  {importErrors.map((e, i) => <p key={i} className="text-xs text-yellow-400/80">{e}</p>)}
                </div>
              )}
              <div className="overflow-auto flex-1 border border-border rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      {["客户名称","英文名称","行业","优先级","阶段","敲门砖","安全切入","监控关键词"].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.map((r, i) => (
                      <tr key={i} className="border-t border-border hover:bg-muted/20">
                        <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">{r.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.nameEn || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.industry || "—"}</td>
                        <td className="px-3 py-2"><span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold", r.priority === "P0" ? "bg-red-500/20 text-red-400" : r.priority === "P1" ? "bg-orange-500/20 text-orange-400" : "bg-muted text-muted-foreground")}>{r.priority}</span></td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{r.stage}</td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate">{r.hookTopic || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate">{r.securityAngle || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.monitorKeywords?.join(", ") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setImportStep("upload")}>重新上传</Button>
                <Button
                  disabled={importBatchMut.isPending}
                  onClick={() => importBatchMut.mutate({ clients: importRows })}
                >
                  {importBatchMut.isPending ? `导入中…` : `确认导入 ${importRows.length} 个客户`}
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Step 3: Done */}
          {importStep === "done" && importResult && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <CheckCircle2 className="w-8 h-8 text-green-400 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-foreground">导入完成</p>
                  <p className="text-sm text-muted-foreground">成功导入 <span className="text-green-400 font-bold">{importResult.succeeded}</span> / {importResult.total} 个客户，MEDDPICC 已自动初始化</p>
                </div>
              </div>
              {importResult.results.filter(r => !r.ok).length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-red-400">失败条目：</p>
                  {importResult.results.filter(r => !r.ok).map((r, i) => (
                    <p key={i} className="text-xs text-red-400/80">{r.name}：{r.error}</p>
                  ))}
                </div>
              )}
              <DialogFooter>
                <Button onClick={() => setShowImport(false)}>关闭</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── 效能基线录入组件 ──────────────────────────────────────────────────────────
function ClientMetricsTab({ clientId }: { clientId: number }) {
  const { data: metrics, refetch } = trpc.clientMetrics.get.useQuery({ clientId });
  const upsert = trpc.clientMetrics.upsert.useMutation({ onSuccess: () => { refetch(); toast.success("效能基线已保存"); } });
  const [form, setForm] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);

  const fields = [
    { key: "securityTeamSize", label: "安全团队人数", placeholder: "例如：5", type: "number", unit: "人" },
    { key: "mttr", label: "平均威胁响应时间 (MTTR)", placeholder: "例如：72", type: "number", unit: "小时" },
    { key: "annualComplianceCost", label: "年度合规成本", placeholder: "例如：200", type: "number", unit: "万元" },
    { key: "lastBreachYear", label: "最近安全事件年份", placeholder: "例如：2023", type: "number", unit: "年" },
    { key: "currentVendors", label: "现有安全厂商", placeholder: "例如：奇安信、深信服", type: "text", unit: "" },
    { key: "itBudgetRange", label: "IT 年度预算区间", placeholder: "例如：500-1000万", type: "text", unit: "" },
    { key: "additionalNotes", label: "补充说明", placeholder: "其他关键背景信息...", type: "textarea", unit: "" },
  ];

  const handleEdit = () => {
    const initial: Record<string, string> = {};
    fields.forEach(f => {
      const val = (metrics as any)?.[f.key];
      initial[f.key] = val != null ? String(val) : "";
    });
    setForm(initial);
    setEditing(true);
  };

  const handleSave = () => {
    const data: Record<string, unknown> = { clientId };
    fields.forEach(f => {
      const v = form[f.key];
      if (f.type === "number") {
        data[f.key] = v ? parseInt(v) : null;
      } else {
        data[f.key] = v || null;
      }
    });
    upsert.mutate(data as any);
    setEditing(false);
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-xs font-semibold text-foreground">客户效能基线</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">用于 Champion 弹药 ROI 测算和 AI 分析的量化数据</div>
        </div>
        {!editing && (
          <button onClick={handleEdit} className="text-[10px] px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
            {metrics ? "编辑" : "+ 录入"}
          </button>
        )}
      </div>

      {!editing ? (
        <div className="space-y-2">
          {fields.map(f => {
            const val = (metrics as any)?.[f.key];
            if (!val) return null;
            return (
              <div key={f.key} className="flex items-center justify-between py-1.5 border-b border-border/30">
                <span className="text-[11px] text-muted-foreground">{f.label}</span>
                <span className="text-[11px] font-medium text-foreground">{val}{f.unit ? ` ${f.unit}` : ""}</span>
              </div>
            );
          })}
          {!metrics && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <span className="text-2xl mb-2">📊</span>
              <div className="text-xs">暂无效能基线数据</div>
              <div className="text-[10px] mt-1 text-center">录入后 AI 可生成量化的痛点陈述和 ROI 测算</div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {fields.map(f => (
            <div key={f.key}>
              <label className="text-[10px] text-muted-foreground mb-1 block">{f.label}{f.unit ? ` (${f.unit})` : ""}</label>
              {f.type === "textarea" ? (
                <textarea
                  className="w-full text-xs bg-muted/30 border border-border/50 rounded px-2 py-1.5 resize-none h-16 focus:outline-none focus:border-primary/50"
                  placeholder={f.placeholder}
                  value={form[f.key] || ""}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                />
              ) : (
                <input
                  type={f.type}
                  className="w-full h-7 text-xs bg-muted/30 border border-border/50 rounded px-2 focus:outline-none focus:border-primary/50"
                  placeholder={f.placeholder}
                  value={form[f.key] || ""}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                />
              )}
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={upsert.isPending} className="flex-1 h-7 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50">
              {upsert.isPending ? "保存中..." : "保存"}
            </button>
            <button onClick={() => setEditing(false)} className="px-3 h-7 text-xs bg-muted text-muted-foreground rounded hover:bg-muted/80 transition-colors">
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
