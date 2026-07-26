/**
 * SalesPipelineSteps — 销售流程可视化步骤条
 *
 * 展示客户关系5步漏斗：建图 → 进门 → 定痛 → 找人 → 进入商机
 * 点击任意节点可展开该阶段的实操指南。
 * currentStage 高亮当前所在阶段，已完成阶段显示勾选状态。
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, CheckCircle2, Target, Users, Search, Zap, FlaskConical, Handshake, Map } from "lucide-react";

export const STAGE_GUIDES: Record<string, {
  icon: React.ReactNode;
  color: string;
  activeColor: string;
  doneColor: string;
  connectorColor: string;
  shortDesc: string;
  goal: string;
  keyActions: string[];
  deliverable: string;
  warning: string;
}> = {
  "建图": {
    icon: <Map className="w-4 h-4" />,
    color: "bg-muted/50 text-muted-foreground border-muted",
    activeColor: "bg-slate-500/20 text-slate-300 border-slate-500/50 ring-2 ring-slate-500/30",
    doneColor: "bg-slate-500/10 text-slate-400 border-slate-500/30",
    connectorColor: "bg-slate-500/30",
    shortDesc: "摸清客户地图",
    goal: "在不接触客户的情况下，通过公开信息和内部情报，绘制出客户的组织架构、决策链和关键人物关系图。",
    keyActions: [
      "通过 LinkedIn、官网、年报识别 C-Suite 和信息安全负责人",
      "在战场地图中录入关键人图谱（职位/影响力/关系状态）",
      "配置情报监控关键词，开启 AI 信号监控",
      "初步判断客户所在行业的安全痛点方向",
    ],
    deliverable: "完整的关键人图谱（含 Economic Buyer 候选人和 Champion 候选人）",
    warning: "不要急于联系客户，建图不充分就进门等于盲目拜访，浪费信任额度。",
  },
  "进门": {
    icon: <Target className="w-4 h-4" />,
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    activeColor: "bg-blue-500/30 text-blue-300 border-blue-500/60 ring-2 ring-blue-500/30",
    doneColor: "bg-blue-500/10 text-blue-400/70 border-blue-500/20",
    connectorColor: "bg-blue-500/40",
    shortDesc: "找到敲门砖",
    goal: "找到一个对客户有真实价值的话题，完成第一次有质量的会面，让客户愿意深入交流。",
    keyActions: [
      "基于 AI 洞察简报，确定敲门砖话题（行业趋势/合规风险/竞品动态）",
      "通过 AD 的高层关系或行业活动建立初步联系",
      "第一次会面以「分享」为主，不推产品，建立信任",
      "会后在拜访作战日志中记录关键信息点，更新 MEDDPICC",
    ],
    deliverable: "完成首次拜访，客户同意安排下一次深入交流",
    warning: "进门话题必须对客户有价值，不能以推销为目的，否则会被列入黑名单。",
  },
  "定痛": {
    icon: <Search className="w-4 h-4" />,
    color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    activeColor: "bg-yellow-500/30 text-yellow-300 border-yellow-500/60 ring-2 ring-yellow-500/30",
    doneColor: "bg-yellow-500/10 text-yellow-400/70 border-yellow-500/20",
    connectorColor: "bg-yellow-500/40",
    shortDesc: "量化客户痛点",
    goal: "通过深度拜访，挖掘并量化客户的核心安全痛点，让客户亲口承认痛点的严重性和紧迫性。",
    keyActions: [
      "用开放式问题引导客户描述现有安全挑战（「您目前最担心的安全风险是什么？」）",
      "将痛点量化：损失多少钱、影响多少业务、面临什么合规压力",
      "在拜访作战日志中记录，AI 自动提炼 MEDDPICC I 维度线索",
      "确认安全切入点，更新战场地图中的「安全切入点」字段",
    ],
    deliverable: "客户认可的量化痛点描述，MEDDPICC I 维度得分 ≥ 50",
    warning: "痛点必须由客户自己说出来，SAM 说的不算。没有量化的痛点无法支撑预算申请。",
  },
  "找人": {
    icon: <Users className="w-4 h-4" />,
    color: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    activeColor: "bg-orange-500/30 text-orange-300 border-orange-500/60 ring-2 ring-orange-500/30",
    doneColor: "bg-orange-500/10 text-orange-400/70 border-orange-500/20",
    connectorColor: "bg-orange-500/40",
    shortDesc: "识别并培养 Champion",
    goal: "找到并培养内部 Champion，同时接触到有预算决策权的 Economic Buyer，建立多线联系。",
    keyActions: [
      "识别 Champion 候选人：有影响力、认可我们价值、有动机推动",
      "为 Champion 提供弹药（ROI 测算、竞品对比、合规风险报告）",
      "通过 Champion 了解内部决策流程和预算节奏",
      "AD 负责建立与 Economic Buyer 的直接对话",
    ],
    deliverable: "确认 Champion（MEDDPICC C 维度 ≥ 50）并完成与 Economic Buyer 的首次接触",
    warning: "Champion 不等于联系人，必须是有影响力且真正支持我们的人。没有 Champion 就没有内部推力。",
  },
  "进入商机": {
    icon: <Zap className="w-4 h-4" />,
    color: "bg-primary/20 text-primary border-primary/30",
    activeColor: "bg-primary/30 text-primary border-primary/60 ring-2 ring-primary/30",
    doneColor: "bg-primary/10 text-primary/70 border-primary/20",
    connectorColor: "bg-primary/40",
    shortDesc: "商机开启",
    goal: "客户已有明确需求信号，商机正式开启。开始进行深度需求挖掘、技术验证和方案设计。",
    keyActions: [
      "在活跃战线中创建商机，选择对应产品线",
      "填写 IBM Blue Sheet：业务目标、价值主张、赢单策略",
      "对每条商机独立打 MEDDPICC 分数，确认薄弱维度",
      "在 POD 协同中枢分配各角色任务",
    ],
    deliverable: "商机已建立， Blue Sheet 已填写，MEDDPICC 初始评分完成",
    warning: "进入商机后商机阶段独立追踪，每条商机有自己的 MEDDPICC 健康度和 Blue Sheet。",
  },
  "商务谈判": {
    icon: <Handshake className="w-4 h-4" />,
    color: "bg-primary/20 text-primary border-primary/30",
    activeColor: "bg-primary/30 text-primary border-primary/60 ring-2 ring-primary/30",
    doneColor: "bg-primary/10 text-primary/70 border-primary/20",
    connectorColor: "bg-primary/40",
    shortDesc: "谈判与签约",
    goal: "在保护合理利润空间的前提下，完成价格、合同条款、交付计划的谈判，推动合同签署。",
    keyActions: [
      "通过 Champion 了解客户的预算上限和谈判底线",
      "使用武器库报价工具生成正式报价单",
      "设定折扣底线，避免无原则让步",
      "推动 Economic Buyer 在合同上签字",
    ],
    deliverable: "已签署的合同和采购订单",
    warning: "不要在没有明确换取条件的情况下主动降价，每次让步都要换取对等的承诺（如缩短付款周期、扩大采购规模）。",
  },
};

const STAGES_ORDER = ["建图", "进门", "定痛", "找人", "进入商机"];

interface SalesPipelineStepsProps {
  currentStage?: string;
  className?: string;
}

export default function SalesPipelineSteps({ currentStage, className }: SalesPipelineStepsProps) {
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  const currentIndex = STAGES_ORDER.indexOf(currentStage || "");

  const handleToggle = (stage: string) => {
    setExpandedStage(prev => prev === stage ? null : stage);
  };

  return (
    <div className={cn("w-full", className)}>
      {/* Step nodes row */}
      <div className="flex items-center w-full overflow-x-auto pb-1 gap-0">
        {STAGES_ORDER.map((stage, idx) => {
          const guide = STAGE_GUIDES[stage];
          const isCurrent = stage === currentStage;
          const isDone = currentIndex > idx;
          const isExpanded = expandedStage === stage;

          let nodeClass = guide.color;
          if (isCurrent) nodeClass = guide.activeColor;
          else if (isDone) nodeClass = guide.doneColor;

          return (
            <div key={stage} className="flex items-center flex-shrink-0">
              {/* Node button */}
              <button
                onClick={() => handleToggle(stage)}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-lg border transition-all duration-200",
                  "hover:scale-105 active:scale-95 min-w-[72px]",
                  nodeClass,
                  isExpanded && "shadow-lg"
                )}
              >
                <div className="flex items-center gap-1">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                  ) : (
                    <span className={cn("flex-shrink-0", isCurrent ? "text-current" : "text-muted-foreground/60")}>
                      {guide.icon}
                    </span>
                  )}
                  <span className="text-xs font-semibold whitespace-nowrap">{stage}</span>
                  {isExpanded ? (
                    <ChevronUp className="w-3 h-3 opacity-60 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-3 h-3 opacity-60 flex-shrink-0" />
                  )}
                </div>
                <span className="text-[10px] opacity-70 whitespace-nowrap leading-tight">{guide.shortDesc}</span>
              </button>

              {/* Connector line */}
              {idx < STAGES_ORDER.length - 1 && (
                <div className={cn(
                  "h-0.5 w-4 flex-shrink-0 mx-0.5 rounded-full transition-colors",
                  isDone ? "bg-green-500/40" : "bg-border/50"
                )} />
              )}
            </div>
          );
        })}
      </div>

      {/* Expanded guide panel */}
      {expandedStage && STAGE_GUIDES[expandedStage] && (() => {
        const guide = STAGE_GUIDES[expandedStage];
        const stageIdx = STAGES_ORDER.indexOf(expandedStage);
        const isCurrent = expandedStage === currentStage;
        const isDone = currentIndex > stageIdx;

        return (
          <div className={cn(
            "mt-3 rounded-lg border p-4 text-sm transition-all",
            isCurrent
              ? "bg-primary/5 border-primary/20"
              : isDone
                ? "bg-green-500/5 border-green-500/20"
                : "bg-muted/10 border-border"
          )}>
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
              <span className={cn("flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-semibold", guide.color)}>
                {guide.icon}
                {expandedStage}
              </span>
              {isCurrent && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">当前阶段</span>
              )}
              {isDone && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />已完成
                </span>
              )}
            </div>

            {/* Goal */}
            <div className="mb-3">
              <div className="text-xs font-semibold text-foreground mb-1">🎯 阶段目标</div>
              <div className="text-xs text-foreground/80 leading-relaxed">{guide.goal}</div>
            </div>

            {/* Key actions */}
            <div className="mb-3">
              <div className="text-xs font-semibold text-foreground mb-1.5">⚡ 关键行动</div>
              <ul className="space-y-1">
                {guide.keyActions.map((action, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                    <span className="text-primary/60 font-mono mt-0.5 flex-shrink-0">{i + 1}.</span>
                    <span className="leading-relaxed">{action}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Deliverable */}
            <div className="mb-3 p-2 rounded bg-green-500/5 border border-green-500/20">
              <div className="text-xs font-semibold text-green-400 mb-0.5">✅ 阶段交付物</div>
              <div className="text-xs text-foreground/80">{guide.deliverable}</div>
            </div>

            {/* Warning */}
            <div className="p-2 rounded bg-amber-500/5 border border-amber-500/20">
              <div className="text-xs font-semibold text-amber-400 mb-0.5">⚠️ 常见陷阱</div>
              <div className="text-xs text-foreground/80">{guide.warning}</div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
