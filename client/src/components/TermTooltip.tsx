/**
 * TermTooltip — 专业术语对位标注组件
 *
 * 用法：
 *   <TermTooltip term="MEDDPICC" />          → 显示带下划线的术语 + 悬停解释
 *   <TermTooltip term="Champion" inline />   → 行内模式（不换行）
 *   <TermTooltip term="Economic Buyer" label="预算决策人" /> → 自定义显示文字
 */

import { ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// ── 术语定义库 ────────────────────────────────────────────────────────────────
export const TERM_DEFINITIONS: Record<string, {
  full: string;       // 全称
  chinese: string;    // 中文名称
  definition: string; // 简明定义（1-2句）
  example?: string;   // 结合亚信安全/T100场景的举例
  question?: string;  // 判断是否完成的关键问题
}> = {
  // ── MEDDPICC 八要素 ──────────────────────────────────────────────────────
  "MEDDPICC": {
    full: "Metrics / Economic Buyer / Decision Criteria / Decision Process / Paper Process / Implicate Pain / Champion / Competition",
    chinese: "国际顶级销售资格认定方法论",
    definition: "由 PTC 公司发明的 B2B 大单销售框架，通过8个维度系统评估一个商机的真实成熟度，避免在不成熟的客户上浪费资源。分数越高代表商机越成熟、赢单概率越大。",
    example: "T100专项用 MEDDPICC 评估美的、大疆等5户客户，每个维度0-100分，总均分超过60分才建议投入重兵。",
    question: "这个商机值得我们全力投入吗？"
  },
  "Metrics": {
    full: "Metrics（可量化价值指标）",
    chinese: "M — 可量化的业务价值",
    definition: "客户能用具体数字衡量我们方案带来的价值。必须有明确的ROI、成本节省、风险降低等量化指标，否则客户无法向内部申请预算。",
    example: "亚信安全TrustOne方案：帮助客户减少80%的终端安全事件响应时间，节省3名安全运营人力，年节省成本约150万港元。",
    question: "客户能用具体数字说出我们方案的价值吗？"
  },
  "Economic Buyer": {
    full: "Economic Buyer（经济买家/预算决策人）",
    chinese: "E — 预算最终拍板人",
    definition: "有权签字批准这笔预算的人，不一定是日常对接的IT负责人。通常是CFO、CEO或业务线VP。没有接触到EB，商机随时可能被搁置。",
    example: "亚信安全的EB是马红军（CEO）或何政（董事长），而非IT部门负责人。AD的核心任务之一就是建立与EB的直接对话。",
    question: "我们是否已经见过有权批准这笔预算的人？"
  },
  "Decision Criteria": {
    full: "Decision Criteria（决策标准）",
    chinese: "D1 — 客户的评选标准",
    definition: "客户用什么标准来选择供应商？包括技术指标、合规要求、价格区间、本地化支持等。我们需要了解并影响这些标准，让标准向我们的优势倾斜。",
    example: "亚信安全评估东南亚安全合作伙伴时，关键标准包括：是否支持PDPA合规、是否有本地技术支持团队、是否有中国出海客户案例。",
    question: "我们知道客户用哪些标准做决定吗？我们的方案是否符合这些标准？"
  },
  "Decision Process": {
    full: "Decision Process（决策流程）",
    chinese: "D2 — 客户内部的决策路径",
    definition: "从技术评估到最终签约，客户内部需要经过哪些步骤、哪些部门审批？不了解流程就无法预测时间线，也无法在关键节点提前布局。",
    example: "亚信安全的采购决策：IT部门技术评估 → 信息安全委员会审核 → CFO预算审批 → CEO/董事长最终批准，通常需要8-12周。",
    question: "从现在到签约，客户内部还需要经过哪些步骤和审批？"
  },
  "Paper Process": {
    full: "Paper Process（合同/采购流程）",
    chinese: "P — 合同与采购的行政流程",
    definition: "合同如何起草、审核、签署？是否需要招标流程？是否有法务审核？这些行政步骤往往被低估，却是影响关单时间的重要因素。",
    example: "亚信安全作为上市公司，超过50万港元的采购需要董事会审批，并可能触发信息披露要求，需要提前6-8周启动法务流程。",
    question: "合同签署需要经过哪些行政程序？预计需要多长时间？"
  },
  "Implicate Pain": {
    full: "Implicate the Pain（痛点牵连/放大痛点）",
    chinese: "I — 痛点的量化与紧迫性",
    definition: "客户的业务痛点是否足够痛、足够急迫，以至于必须现在解决？需要帮助客户量化不解决这个问题的代价（合规罚款、数据泄露损失、竞争劣势等）。",
    example: "亚信安全海外分支机构若发生数据泄露，在新加坡PDPA下最高罚款100万新元，且需要72小时内向监管机构报告，业务中断损失更难以估量。",
    question: "如果客户不解决这个问题，会有什么具体的业务损失或合规风险？"
  },
  "Champion": {
    full: "Champion（内部支持者/内部推手）",
    chinese: "C1 — 客户内部的推动者",
    definition: "客户内部愿意为我们的方案积极推动、在内部会议上替我们说话的人。Champion不一定是最高层，但必须有影响力且真心认可我们的价值。没有Champion，大单几乎不可能成交。",
    example: "亚信安全内部，信息安全总监或CTO可能是潜在Champion——他们理解技术价值，且有动力推动安全升级来提升自己的影响力。",
    question: "客户内部有没有人会在我们不在场时主动为我们的方案发声？"
  },
  "Competition": {
    full: "Competition（竞争态势）",
    chinese: "C2 — 竞争对手分析",
    definition: "客户还在评估哪些竞争对手？我们相对于竞品的差异化优势是什么？是否有竞争对手已经建立了更深的关系？",
    example: "亚信安全在东南亚可能同时评估Palo Alto Networks、CrowdStrike和本地安全厂商。我们的差异化：中国出海场景的深度理解、中文支持、以及与亚信安全母公司的战略协同。",
    question: "客户还在看谁？我们凭什么赢？"
  },

  // ── 销售阶段 ──────────────────────────────────────────────────────────────
  "建图": {
    full: "建图阶段",
    chinese: "第1阶段：绘制客户地图",
    definition: "刚开始接触客户，主要任务是摸清客户的组织架构、关键人物、业务痛点和决策链。此阶段不急于推产品，重在建立信息优势。",
    example: "T100专项对传音控股处于建图阶段：已知CEO是竺兆江，但尚未识别信息安全负责人，需要通过LinkedIn和行业活动建立初步联系。",
    question: "我们是否已经画出了客户的完整决策地图？"
  },
  "进门": {
    full: "进门阶段",
    chinese: "第2阶段：建立初步接触",
    definition: "已经与客户建立了初步联系，有了对话机会。此阶段目标是找到敲门砖话题，完成第一次有价值的会面，让客户愿意继续深入交流。",
    example: "大疆创新处于进门阶段：已通过FCC审查话题建立联系，正在安排与Adam Welsh（法务合规VP）的正式会面。",
    question: "客户愿意给我们时间深入交流吗？"
  },
  "定痛": {
    full: "定痛阶段",
    chinese: "第3阶段：确认核心痛点",
    definition: "已经深入了解客户业务，能够清晰描述客户的核心痛点，并且客户也认可这个痛点的严重性和紧迫性。此阶段是从关系销售转向价值销售的关键转折点。",
    example: "荣耀终端处于定痛阶段：已确认EU AI Act合规是核心痛点，客户认可不合规的罚款风险（最高全球营收4%），正在评估解决方案。",
    question: "客户是否亲口承认了痛点的严重性，并表示需要解决？"
  },
  "找人": {
    full: "找人阶段",
    chinese: "第4阶段：识别并接触关键决策人",
    definition: "已经确认痛点，现在需要找到并接触真正有决策权的人（Economic Buyer）和内部推手（Champion）。没有 Champion，大单基本赢不了。",
    example: "美的集团处于找人阶段：已确认信息安全总监是关键局内人，正在开展深度拜访以建立 Champion 关系，并尝试通过他触达 CEO 层面。",
    question: "我们是否已经见过有预算决策权的人？内部是否有人愿意为我们背书？"
  },
  "进入商机": {
    full: "进入商机阶段",
    chinese: "第5阶段：商机开启",
    definition: "客户已有明确需求信号，商机正式开启。开始在活跃战线中创建具体商机，填写 Blue Sheet，对每条商机独立打 MEDDPICC 分数。",
    question: "商机已建立并开始追踪？每条商机的 MEDDPICC 健康度如何？"
  },
  "商务谈判": {
    full: "商务谈判阶段",
    chinese: "第7阶段：商务谈判与收尾",
    definition: "技术方案已确定，进入价格、合同条款、交付计划的谈判阶段。此阶段需要防止价格过度折让，并确保合同条款保护双方利益。",
    example: "向客户提交最终报价单，就折扣、付款方式、维保范围进行谈判，目标是在不损害关系的前提下保护合理利润空间。",
    question: "我们是否已经了解客户的预算上限和谈判底线？"
  },

  // ── 角色定义 ──────────────────────────────────────────────────────────────
  "AD": {
    full: "Account Director（客户总监）",
    chinese: "AD — 顶层破冰者",
    definition: "负责与客户高层（C-Suite）建立关系，打开局面，推动战略层面的对话。AD通常不参与技术细节，专注于商业价值和高层关系。",
    example: "在亚信安全项目中，AD的任务是与何政（董事长）或马红军（CEO）建立直接对话，传递AIStorm海外平台的战略价值。",
    question: "我们是否已经在C-Suite层面建立了信任关系？"
  },
  "SAM": {
    full: "Strategic Account Manager（战略客户经理）",
    chinese: "SAM — 中枢操盘手",
    definition: "负责整体商机推进，协调AD和SA的工作，管理客户关系的全生命周期，制定和执行销售策略。SAM是团队的核心枢纽。",
    example: "SAM需要每周更新亚信安全的MEDDPICC评分，协调AD安排高层拜访，推动SA完成技术方案，并跟踪所有待办事项。",
    question: "商机是否在按计划推进？下一个里程碑是什么？"
  },
  "SA": {
    full: "Solution Architect（解决方案架构师）",
    chinese: "SA — 技术定标者",
    definition: "负责技术方案设计、POC执行和技术评估，确保我们的方案在技术层面满足客户需求，并影响客户的技术决策标准。",
    example: "SA需要为亚信安全准备TrustOne在东南亚PDPA合规场景下的技术架构方案，并在POC中演示数据本地化能力。",
    question: "技术方案是否已经与客户的技术标准对齐？"
  },
  "RSM": {
    full: "Regional Sales Manager（区域省办销售经理）",
    chinese: "RSM — 属地辅攻者",
    definition: "负责属地化招投标支持与商务渠道打通，协助专项SAM完成客户总部关系建立，属地业绩100%复算给对应省办。",
    example: "广东办负责美的集团的属地招投标流程支持，深圳办负责传音、大疆、荣耀、华大基因的属地商务协同。",
    question: "属地招投标流程是否已经确认？属地关系人是否已与SAM对接？"
  },
  "POD": {
    full: "POD（作战小组）",
    chinese: "POD — 四角协同阵型",
    definition: "由AD+SAM+SA+省办（RSM）组成的最小作战单元，四角分工协作，共同推进一个大客户。POD模式来自特种部队概念，强调小团队高效协同。",
    example: "T100专项的POD：Leo（AD）负责顶层破冰，SAM负责日常推进，SA负责技术支撑，省办（RSM）负责属地商务协同，四人每周同步一次战情。",
    question: "四个角色是否都清楚自己本周的任务？"
  },

  // ── 其他专业术语 ──────────────────────────────────────────────────────────
  "1-Pager": {
    full: "1-Pager（一页纸简报）",
    chinese: "高层会面简报",
    definition: "专为高管会面准备的一页纸精华材料，用最简洁的语言说明：我们是谁、我们能解决什么问题、为什么是我们。高管时间宝贵，1-Pager是最有效的沟通工具。",
    example: "拜访亚信安全CEO马红军前，SAM需要用AI生成一份1-Pager：重点说明AIStorm如何帮助亚信安全产品快速进入东南亚市场。",
    question: "如果高管只有5分钟，这份材料能否让他立刻理解价值？"
  },
  "Champion弹药": {
    full: "Champion Ammunition（Champion弹药）",
    chinese: "内部推动材料",
    definition: "专门为客户内部的Champion准备的材料，帮助他在内部会议上说服同事和上级。包括竞品对标、合规风险量化、ROI测算等，让Champion有据可依地为我们发声。",
    example: "为亚信安全的信息安全总监准备：竞品对标（vs Palo Alto）、PDPA合规风险量化报告、TrustOne 3年ROI测算，让他在董事会上有数据支撑。",
    question: "我们的Champion在内部推动时，是否有足够的弹药来回应质疑？"
  },
  "Deal Review": {
    full: "Deal Review（商机评审）",
    chinese: "商机健康度评审",
    definition: "定期对商机进行系统性评估，检查MEDDPICC各要素的完成情况，识别风险和缺口，制定下一步行动计划。通常每两周进行一次。",
    question: "这个商机的最大风险是什么？我们下一步最关键的行动是什么？"
  },
  "T100": {
    full: "T100专项",
    chinese: "亚信安全海外T100重点客户专项",
    definition: "AIStorm海外营销平台针对港澳+东南亚市场的100家顶级目标客户专项计划，聚焦中国出海企业的网络安全需求，以AI驱动销售效率提升。",
    example: "当前T100专项聚焦5户核心客户：美的集团、大疆创新、荣耀终端、传音控股、华大基因，以及0号演示客户亚信安全。",
    question: "这家客户是否符合T100的目标画像？"
  },
  "PDPA": {
    full: "Personal Data Protection Act",
    chinese: "个人数据保护法（泰国/新加坡等东南亚国家）",
    definition: "东南亚各国的数据保护法规，类似欧盟GDPR。违规最高罚款数百万当地货币，且企业高管可能承担个人法律责任。中国出海企业必须合规。",
    question: "客户的数据处理是否符合当地PDPA要求？"
  },
  "EDR": {
    full: "Endpoint Detection and Response",
    chinese: "终端检测与响应",
    definition: "部署在电脑、手机等终端设备上的安全软件，能够实时检测恶意行为并自动响应。是企业网络安全的核心防线之一。亚信安全的核心产品之一。",
    question: "客户的终端设备是否已经部署了EDR保护？"
  },
  "XDR": {
    full: "Extended Detection and Response",
    chinese: "扩展检测与响应",
    definition: "在EDR基础上扩展到网络、云、邮件等多个安全层面的统一检测响应平台。能够关联分析跨层面的安全事件，提供更全面的威胁视角。",
    question: "客户是否需要跨终端、网络、云的统一安全视图？"
  },
  "TrustOne": {
    full: "TrustOne（亚信安全核心平台）",
    chinese: "亚信安全统一安全平台",
    definition: "亚信安全的旗舰产品，集成EDR、XDR、云安全、数据安全等能力的统一平台，特别适合中国出海企业在海外合规场景下的安全需求。",
    question: "TrustOne是否满足客户的合规和安全需求？"
  },
};

// ── 组件 ─────────────────────────────────────────────────────────────────────
interface TermTooltipProps {
  term: keyof typeof TERM_DEFINITIONS;
  label?: string;           // 自定义显示文字（默认用 term 本身）
  showIcon?: boolean;       // 是否显示 ? 图标（默认 true）
  className?: string;
  children?: ReactNode;     // 如果有 children，包裹 children 显示 tooltip
}

export function TermTooltip({
  term,
  label,
  showIcon = true,
  className,
  children,
}: TermTooltipProps) {
  const def = TERM_DEFINITIONS[term];
  if (!def) {
    return <span className={className}>{children ?? label ?? term}</span>;
  }

  const displayText = label ?? (children ? null : term);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-0.5 cursor-help border-b border-dashed border-muted-foreground/50 hover:border-primary/70 transition-colors",
            className
          )}
        >
          {children ?? displayText}
          {showIcon && (
            <HelpCircle className="w-3 h-3 text-muted-foreground/60 flex-shrink-0 ml-0.5" />
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-xs p-3 space-y-1.5 text-left"
      >
        <div className="font-semibold text-foreground text-xs leading-tight">
          {def.chinese}
        </div>
        <div className="text-[10px] text-muted-foreground font-mono leading-tight">
          {def.full}
        </div>
        <div className="text-xs text-foreground/90 leading-relaxed">
          {def.definition}
        </div>
        {def.example && (
          <div className="text-[10px] text-primary/80 leading-relaxed border-t border-border pt-1.5">
            <span className="font-medium">示例：</span>{def.example}
          </div>
        )}
        {def.question && (
          <div className="text-[10px] text-amber-400/90 leading-relaxed">
            <span className="font-medium">关键问题：</span>{def.question}
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * MeddpiccLabel — 专为 MEDDPICC 各字段标题设计的快捷组件
 * 用法：<MeddpiccLabel field="M" />
 */
const MEDDPICC_FIELDS = {
  M: { label: "M — Metrics", term: "Metrics" as const },
  E: { label: "E — Economic Buyer", term: "Economic Buyer" as const },
  D1: { label: "D — Decision Criteria", term: "Decision Criteria" as const },
  D2: { label: "D — Decision Process", term: "Decision Process" as const },
  P: { label: "P — Paper Process", term: "Paper Process" as const },
  I: { label: "I — Implicate Pain", term: "Implicate Pain" as const },
  C1: { label: "C — Champion", term: "Champion" as const },
  C2: { label: "C — Competition", term: "Competition" as const },
};

export function MeddpiccLabel({ field }: { field: keyof typeof MEDDPICC_FIELDS }) {
  const { label, term } = MEDDPICC_FIELDS[field];
  return (
    <TermTooltip term={term} label={label} showIcon={true} />
  );
}

export default TermTooltip;
