import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Edit2, Save, X, ChevronDown, ChevronUp, Users, Plus, Trash2, UserCheck, TrendingUp, Sparkles, Upload, Download, AlertCircle, CheckCircle2, Calendar, MapPin, Swords, Target, Trophy, Loader2 } from "lucide-react";

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
const INFLUENCE_OPTIONS = ["决策者", "影响者", "Champion候选", "技术评估者", "信息来源"];
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
  "信息来源": "bg-muted text-muted-foreground border-border",
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
              <Textarea className="text-xs h-16 resize-none" placeholder="此商机解决客户什么核心业务问题？" value={blueSheet.bizObjective} onChange={e => setBlueSheet(p => ({ ...p, bizObjective: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] font-medium text-green-400 mb-1 block">我方价值主张</label>
              <Textarea className="text-xs h-16 resize-none" placeholder="针对此商机的差异化价值（量化）" value={blueSheet.valueProposition} onChange={e => setBlueSheet(p => ({ ...p, valueProposition: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-medium text-yellow-400 mb-1 block">Champion</label>
              <div className="flex gap-1.5">
                <Input className="h-7 text-xs flex-1" placeholder="Champion 姓名" value={blueSheet.champion} onChange={e => setBlueSheet(p => ({ ...p, champion: e.target.value }))} />
                <Select value={blueSheet.championStance} onValueChange={v => setBlueSheet(p => ({ ...p, championStance: v }))}>
                  <SelectTrigger className="h-7 text-xs w-20"><SelectValue /></SelectTrigger>
                  <SelectContent>{STANCE_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-medium text-orange-400 mb-1 block">竞争态势</label>
              <Input className="h-7 text-xs" placeholder="竞品名称及应对策略" value={blueSheet.blueSheetCompetitor} onChange={e => setBlueSheet(p => ({ ...p, blueSheetCompetitor: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-medium text-primary mb-1 block">赢单策略</label>
            <Textarea className="text-xs h-14 resize-none" placeholder="针对此商机的具体打法和差异化策略" value={blueSheet.winStrategy} onChange={e => setBlueSheet(p => ({ ...p, winStrategy: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-medium text-blue-400 mb-1 block">关键里程碑</label>
              <Textarea className="text-xs h-14 resize-none" placeholder="时间节点，每行一条" value={blueSheet.keyMilestones} onChange={e => setBlueSheet(p => ({ ...p, keyMilestones: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] font-medium text-red-400 mb-1 block">风险与应对</label>
              <Textarea className="text-xs h-14 resize-none" placeholder="主要风险及应对措施" value={blueSheet.riskAndMitigation} onChange={e => setBlueSheet(p => ({ ...p, riskAndMitigation: e.target.value }))} />
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

function ActiveFrontsPanel({ clientId }: { clientId: number }) {
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
        <div key={opp.id} className="bg-muted/20 rounded-lg border border-border/50 overflow-hidden">
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
  const [newContact, setNewContact] = useState({
    name: "", title: "", department: "", influence: "影响者", relationship: "未接触", email: "", linkedinUrl: "", notes: ""
  });
  const [editData, setEditData] = useState<any>({});

  const utils = trpc.useUtils();
  const { data: contacts = [], isLoading } = trpc.contacts.listByClient.useQuery({ clientId });

  const addContact = trpc.contacts.add.useMutation({
    onSuccess: () => {
      utils.contacts.listByClient.invalidate({ clientId });
      toast.success("关键人已添加");
      setShowAdd(false);
      setNewContact({ name: "", title: "", department: "", influence: "影响者", relationship: "未接触", email: "", linkedinUrl: "", notes: "" });
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
                  </div>
                  {contact.title && <div className="text-xs text-muted-foreground mt-0.5">{contact.title}{contact.department && ` · ${contact.department}`}</div>}
                  {contact.notes && <div className="text-xs text-muted-foreground/80 mt-1 line-clamp-2">{contact.notes}</div>}
                  {contact.email && <div className="text-xs text-primary/70 mt-0.5">{contact.email}</div>}
                  {/* Stance quick toggle */}
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
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => { setEditingId(contact.id); setEditData({}); }}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1">
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button onClick={() => deleteContact.mutate({ id: contact.id })}
                    className="text-muted-foreground hover:text-red-400 transition-colors p-1">
                    <Trash2 className="w-3 h-3" />
                  </button>
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
    </div>
  );
}

function ClientCard({ client }: { client: any }) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"meddpicc" | "contacts" | "trend" | "fronts" | "winstrategy">("meddpicc");
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [meddpiccEdit, setMeddpiccEdit] = useState<any>({});
  const [logNote, setLogNote] = useState<Record<string, string>>({});
  const [expandedDim, setExpandedDim] = useState<string | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestReasoning, setSuggestReasoning] = useState<string>('');
  const { role } = useRole();

  const utils = trpc.useUtils();
  const { data: meddpicc } = trpc.meddpicc.get.useQuery({ clientId: client.id });
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
    return meddpicc
      ? Math.round((meddpicc.metricsScore + meddpicc.economicBuyerScore + meddpicc.decisionCriteriaScore +
        meddpicc.decisionProcessScore + meddpicc.paperProcessScore + meddpicc.implicatePainScore +
        meddpicc.championScore + meddpicc.competitionScore) / 8)
      : 0;
  })();

  const handleSave = () => {
    if (Object.keys(editData).length > 0) updateClient.mutate({ id: client.id, ...editData });
    else setEditing(false);
  };

  const championCount = contacts.filter(c => c.relationship === "Champion" || c.influence === "Champion候选").length;
  const contactedCount = contacts.filter(c => c.relationship !== "待接触" && c.relationship !== null).length;
  const contactProgressPct = contacts.length > 0 ? Math.round((contactedCount / contacts.length) * 100) : 0;

  // 建图缺口预警
  const hasEconomicBuyer = contacts.some(c => c.influence === "决策者") || (meddpicc && (meddpicc as any).economicBuyerName);
  const hasChampion = contacts.some(c => c.relationship === "Champion" || c.influence === "Champion候选");
  const gapWarnings: string[] = [];
  if (!hasEconomicBuyer) gapWarnings.push("缺 Economic Buyer");
  if (!hasChampion) gapWarnings.push("缺 Champion");

  return (
    <div className={cn("bg-card border rounded-xl overflow-hidden transition-all", expanded ? "border-primary/30" : "border-border hover:border-muted-foreground/50")}>
      {/* Card Header */}
      <div className="p-4">
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
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {(['建图', '进门', '定痛', '找人', '进入商机'] as string[]).includes(client.stage) ? (
              <TermTooltip term={client.stage as any} label={client.stage} className={cn("text-xs px-2 py-1 rounded-md font-medium cursor-help", stageColor[client.stage])} />
            ) : (
              <span className={cn("text-xs px-2 py-1 rounded-md font-medium", stageColor[client.stage])}>{client.stage}</span>
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
          </div>
        </div>

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
          return meddpicc ? (
            <div className="mt-3 grid grid-cols-4 gap-x-4 gap-y-1.5">
              {MEDDPICC_ITEMS.map((item) => (
                <MeddpiccBar key={item.key} label={item.label} score={(meddpicc as any)[item.scoreKey]} fullLabel={item.label} />
              ))}
            </div>
          ) : null;
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
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? "收起详情" : "展开详情"}
          </button>
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
          </div>

          {/* MEDDPICC tab - smart switch based on stage */}
          {activeTab === "meddpicc" && (() => {
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
            return meddpicc ? (
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
                  const currentScore: number = (meddpicc as any)[dim.key] ?? 0;
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
                              defaultValue={(meddpicc as any)[nameKey] || ""}
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
            ) : null;
          })()}

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
              <ActiveFrontsPanel clientId={client.id} />
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
  );
}

const EMPTY_FORM = { name: "", nameEn: "", industry: "", priority: "P1" as "P0"|"P1"|"P2", stage: "建图" as string, hookTopic: "", securityAngle: "", monitorKeywords: "" };

export default function BattleMap() {
  const utils = trpc.useUtils();
  const { data: clients = [], isLoading } = trpc.clients.list.useQuery();

  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<(typeof clients)[0] | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<(typeof clients)[0] | null>(null);

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
          <Button size="sm" variant="outline" onClick={openImport} className="gap-1.5">
            <Upload className="w-3.5 h-3.5" />
            批量导入
          </Button>
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            新增客户
          </Button>
        </div>
      </div>

      {/* Sales pipeline steps */}
      <div className="mb-5 p-4 rounded-xl bg-card border border-border">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">销售流程进度</span>
          <span className="text-[10px] text-muted-foreground/60">点击阶段节点查看实操指南</span>
        </div>
        <SalesPipelineSteps />
      </div>

      {/* P0 unvisited alert banner */}
      {(() => {
        const p0Unvisited = clients.filter(c => c.priority === "P0" && (c as any).visitCount === 0 && !c.isTest);
        if (p0Unvisited.length === 0) return null;
        const now = Date.now();
        // Build per-client countdown info
        const clientInfos = p0Unvisited.map(c => {
          const planned = (c as any).plannedFirstVisitDate as number | null | undefined;
          if (planned) {
            const diffDays = Math.ceil((planned - now) / 86400000);
            return { c, diffDays };
          }
          return { c, diffDays: null };
        });
        // Determine banner color: red if any overdue, amber otherwise
        const hasOverdue = clientInfos.some(x => x.diffDays !== null && x.diffDays < 0);
        const bannerClass = hasOverdue
          ? "mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400"
          : "mb-4 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400";
        return (
          <div className={bannerClass}>
            <div className="flex items-start gap-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium mb-1">{p0Unvisited.length} 个 P0 客户尚未建立拜访记录</div>
                <div className="flex flex-wrap gap-2">
                  {clientInfos.map(({ c, diffDays }) => {
                    let label: string;
                    let labelClass: string;
                    if (diffDays === null) {
                      label = "未拜访";
                      labelClass = "text-xs text-amber-400/70";
                    } else if (diffDays > 0) {
                      label = `距计划拜访还有 ${diffDays} 天`;
                      labelClass = "text-xs text-cyan-400";
                    } else if (diffDays === 0) {
                      label = "计划拜访日就是今天";
                      labelClass = "text-xs text-orange-400 font-semibold";
                    } else {
                      label = `已超计划拜访日 ${Math.abs(diffDays)} 天`;
                      labelClass = "text-xs text-red-400 font-semibold";
                    }
                    return (
                      <button
                        key={c.id}
                        onClick={() => document.getElementById(`client-card-${c.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                        className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/20 hover:bg-black/30 transition-colors"
                      >
                        <span className="text-sm font-semibold underline underline-offset-2">{c.name}</span>
                        <span className={labelClass}>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <span className="ml-auto text-xs opacity-60 flex-shrink-0 mt-0.5">建议尽快安排首次拜访</span>
            </div>
          </div>
        );
      })()}

      {/* Client cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-card border border-border rounded-xl h-48 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {clients.map(client => (
            <div key={client.id} id={`client-card-${client.id}`} className="relative group">
              <ClientCard client={client} />
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
            <button
              onClick={openCreate}
              className="col-span-full flex flex-col items-center justify-center gap-3 py-16 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
            >
              <Plus className="w-8 h-8" />
              <span className="text-sm">点击添加第一个 T100 战略客户</span>
            </button>
          )}
        </div>
      )}

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
