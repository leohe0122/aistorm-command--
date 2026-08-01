/**
 * MEDDPICC 国际标准打分阶梯
 * 每个维度 5 个里程碑，对应 0 / 25 / 50 / 75 / 100 分
 * SAM 选择最符合当前客户状态的描述，系统自动换算分数
 */

export interface MeddpiccLevel {
  score: 0 | 25 | 50 | 75 | 100;
  label: string;       // 简短标签
  description: string; // 完整状态描述（SAM 用来对照）
  evidence: string;    // 需要有什么证据才能选这一级
}

export interface MeddpiccDimension {
  key: string;
  code: string;        // M / E / D1 / D2 / P / I / C1 / C2
  fullName: string;
  chineseName: string;
  question: string;    // 核心判断问题
  levels: MeddpiccLevel[];
}

export const MEDDPICC_DIMENSIONS: MeddpiccDimension[] = [
  {
    key: "metricsScore",
    code: "M",
    fullName: "Metrics",
    chineseName: "可量化价值",
    question: "客户能用具体数字衡量我们方案带来的价值吗？",
    levels: [
      {
        score: 0,
        label: "未识别痛点",
        description: "尚未识别出客户的业务痛点，或客户不认为存在问题",
        evidence: "无任何痛点讨论记录",
      },
      {
        score: 25,
        label: "痛点口头确认",
        description: "客户口头提到了痛点，但尚未量化，无具体数字",
        evidence: "会议纪要中有客户提及痛点的记录",
      },
      {
        score: 50,
        label: "痛点已量化",
        description: "痛点已用具体数字描述（如：每年安全事件响应耗时 500 小时，合规罚款风险 100 万港元）",
        evidence: "有量化数据的书面记录或客户确认邮件",
      },
      {
        score: 75,
        label: "ROI 方案已提交",
        description: "我方已向客户提交包含 ROI 测算的方案，客户正在评估",
        evidence: "ROI 方案文档已发送给客户，有回执或确认",
      },
      {
        score: 100,
        label: "客户认可并引用",
        description: "客户在内部会议或与我方沟通中主动引用我们的 ROI 数据，认可价值",
        evidence: "客户邮件/会议记录中有主动引用 ROI 数据的证据",
      },
    ],
  },
  {
    key: "economicBuyerScore",
    code: "E",
    fullName: "Economic Buyer",
    chineseName: "预算决策人",
    question: "我们是否已经接触到有权批准这笔预算的人？",
    levels: [
      {
        score: 0,
        label: "不知道谁有权",
        description: "尚不清楚谁是最终有预算签字权的人",
        evidence: "无任何关于 EB 的信息",
      },
      {
        score: 25,
        label: "已识别但未接触",
        description: "已通过调研或内部人员确认了 EB 的姓名和职位，但尚未有任何直接接触",
        evidence: "有 EB 姓名、职位的记录，来源可靠",
      },
      {
        score: 50,
        label: "已有一次会面",
        description: "与 EB 已有过至少一次正式或非正式会面，EB 知道我们的存在",
        evidence: "会议纪要或邮件往来记录，EB 参与其中",
      },
      {
        score: 75,
        label: "建立定期沟通",
        description: "与 EB 建立了定期沟通机制，EB 愿意花时间与我们深入交流",
        evidence: "有定期会议安排，EB 主动参与或回复",
      },
      {
        score: 100,
        label: "EB 主动支持",
        description: "EB 明确表态支持我们的方案，或主动在内部推动采购",
        evidence: "EB 书面或当面表达支持，或有内部推动的具体行动",
      },
    ],
  },
  {
    key: "decisionCriteriaScore",
    code: "D1",
    fullName: "Decision Criteria",
    chineseName: "决策标准",
    question: "我们是否了解并影响了客户的供应商评选标准？",
    levels: [
      {
        score: 0,
        label: "不知道标准",
        description: "不清楚客户用什么标准选择供应商",
        evidence: "无任何关于评选标准的信息",
      },
      {
        score: 25,
        label: "知道部分标准",
        description: "了解到部分评选标准（如价格、本地化支持），但不完整",
        evidence: "有部分标准的记录，来源为客户或内部人员",
      },
      {
        score: 50,
        label: "全部标准已知",
        description: "已掌握客户的完整评选标准，包括技术、商务、合规等各维度",
        evidence: "完整的评选标准清单，来源可靠",
      },
      {
        score: 75,
        label: "我们影响了标准",
        description: "我们通过技术交流、白皮书等方式，成功将我们的优势纳入客户的评选标准",
        evidence: "客户更新了评选标准，新增了我们擅长的条款",
      },
      {
        score: 100,
        label: "标准向我们倾斜",
        description: "评选标准明显向我们的产品优势倾斜，竞争对手难以满足",
        evidence: "标准文件中有明显偏向我们的条款，客户确认",
      },
    ],
  },
  {
    key: "decisionProcessScore",
    code: "D2",
    fullName: "Decision Process",
    chineseName: "决策流程",
    question: "我们是否清楚从现在到签约需要经过哪些步骤？",
    levels: [
      {
        score: 0,
        label: "不清楚流程",
        description: "不了解客户内部的采购决策流程",
        evidence: "无任何关于决策流程的信息",
      },
      {
        score: 25,
        label: "知道大致步骤",
        description: "大致了解决策流程（如需要 IT 评估、CFO 审批），但细节不清楚",
        evidence: "有大致流程描述，来源为客户或内部人员",
      },
      {
        score: 50,
        label: "完整流程已确认",
        description: "完整的决策流程已确认，包括每个步骤的负责人、预计时间",
        evidence: "有详细的流程图或步骤清单，客户确认",
      },
      {
        score: 75,
        label: "关键节点已布局",
        description: "在每个关键决策节点都有我们的支持者或信息来源，能提前感知进展",
        evidence: "每个节点都有联系人，能获取内部进展信息",
      },
      {
        score: 100,
        label: "流程按计划推进",
        description: "采购流程正在按我们预期的时间线推进，无重大阻碍",
        evidence: "流程里程碑按时完成，有书面确认",
      },
    ],
  },
  {
    key: "paperProcessScore",
    code: "P",
    fullName: "Paper Process",
    chineseName: "合同流程",
    question: "我们是否了解合同签署所需的行政流程和时间？",
    levels: [
      {
        score: 0,
        label: "不了解合同流程",
        description: "不清楚客户的合同审批和签署流程",
        evidence: "无任何关于合同流程的信息",
      },
      {
        score: 25,
        label: "知道需要招标",
        description: "知道该项目需要经过招标流程，但具体要求不清楚",
        evidence: "有招标要求的基本信息",
      },
      {
        score: 50,
        label: "招标要求已确认",
        description: "招标的具体要求已确认，包括资质要求、时间节点、评分标准",
        evidence: "有招标文件或官方通知",
      },
      {
        score: 75,
        label: "法务流程已启动",
        description: "合同法务审核流程已启动，双方法务团队已开始沟通",
        evidence: "有法务沟通记录，合同草稿已在流转",
      },
      {
        score: 100,
        label: "合同草稿审核中",
        description: "合同草稿已完成主要条款谈判，正在最终审批流程中",
        evidence: "合同草稿已定稿，等待签字",
      },
    ],
  },
  {
    key: "implicatePainScore",
    code: "I",
    fullName: "Implicate Pain",
    chineseName: "痛点识别",
    question: "客户的痛点是否足够紧迫，必须现在解决？",
    levels: [
      {
        score: 0,
        label: "无明显痛点",
        description: "客户目前没有感受到明显的业务痛点或安全风险",
        evidence: "客户表示现状可以接受，无紧迫需求",
      },
      {
        score: 25,
        label: "客户感知到痛",
        description: "客户意识到存在问题，但尚未感到紧迫，可以暂时搁置",
        evidence: "客户提到了问题，但没有明确的解决时间表",
      },
      {
        score: 50,
        label: "痛点已量化损失",
        description: "痛点已用具体损失数字描述（合规罚款、数据泄露损失、运营成本等）",
        evidence: "有量化的潜在损失数据，客户认可",
      },
      {
        score: 75,
        label: "客户主动要解决",
        description: "客户主动提出要解决这个问题，并询问解决方案",
        evidence: "客户主动发起需求讨论，有明确的解决意愿",
      },
      {
        score: 100,
        label: "紧迫性已确认",
        description: "客户有明确的截止时间（合规期限、董事会要求等），必须在规定时间内解决",
        evidence: "有明确的截止日期，客户表达了强烈的紧迫感",
      },
    ],
  },
  {
    key: "championScore",
    code: "C1",
    fullName: "Champion",
    chineseName: "内部推手",
    question: "客户内部是否有人在主动为我们的方案发声？",
    levels: [
      {
        score: 0,
        label: "无内部支持者",
        description: "客户内部没有任何人支持我们的方案",
        evidence: "所有接触的人都持中立或负面态度",
      },
      {
        score: 25,
        label: "有潜在支持者",
        description: "有一位客户内部人员对我们的方案表现出兴趣，但尚未明确支持",
        evidence: "该人员积极参与讨论，提出建设性问题",
      },
      {
        score: 50,
        label: "Champion 已确认",
        description: "已确认一位 Champion，他/她明确表示支持我们的方案",
        evidence: "Champion 明确表态，愿意在内部推动",
      },
      {
        score: 75,
        label: "Champion 积极推动",
        description: "Champion 在内部主动安排会议、协调资源，帮助我们推进",
        evidence: "Champion 主动帮助安排内部会议或提供内部信息",
      },
      {
        score: 100,
        label: "Champion 内部发声",
        description: "Champion 在没有我们在场的情况下，在内部会议上主动为我们的方案辩护",
        evidence: "有证据显示 Champion 在内部会议上推荐了我们的方案",
      },
    ],
  },
  {
    key: "competitionScore",
    code: "C2",
    fullName: "Competition",
    chineseName: "竞争态势",
    question: "我们相对于竞争对手的优势是否明确？",
    levels: [
      {
        score: 0,
        label: "不知道竞品",
        description: "不清楚客户还在评估哪些竞争对手",
        evidence: "无任何竞品信息",
      },
      {
        score: 25,
        label: "知道竞品存在",
        description: "知道有竞争对手参与，但不了解具体是谁以及他们的方案",
        evidence: "客户或内部人员提到有其他供应商在评估",
      },
      {
        score: 50,
        label: "竞品已对标分析",
        description: "已完成主要竞争对手的对标分析，清楚我们的差异化优势和劣势",
        evidence: "有完整的竞品对标文档",
      },
      {
        score: 75,
        label: "我们有明确优势",
        description: "在客户最关注的评选标准上，我们明显优于竞争对手",
        evidence: "客户反馈或内部人员确认我们在关键维度领先",
      },
      {
        score: 100,
        label: "客户倾向选择我们",
        description: "客户明确表示倾向选择我们，或内部信息显示我们是首选",
        evidence: "客户明确表态，或 Champion 透露我们是首选",
      },
    ],
  },
];

/** 根据 key 获取维度定义 */
export function getDimension(key: string): MeddpiccDimension | undefined {
  return MEDDPICC_DIMENSIONS.find(d => d.key === key);
}

/** 根据分数获取对应的 level */
export function getLevelByScore(dimension: MeddpiccDimension, score: number): MeddpiccLevel {
  // 找最接近的阶梯分数
  const rounded = Math.round(score / 25) * 25;
  const clamped = Math.max(0, Math.min(100, rounded)) as 0 | 25 | 50 | 75 | 100;
  return dimension.levels.find(l => l.score === clamped) || dimension.levels[0];
}
