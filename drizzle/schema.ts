import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json,
  float,
  boolean,
  tinyint,
  decimal,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  podRole: mysqlEnum("podRole", ["AD", "SAM", "SA", "RSM"]).default("SAM").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 5户目标客户基本信息
 */
export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  nameEn: varchar("nameEn", { length: 100 }),
  industry: varchar("industry", { length: 100 }),
  stage: mysqlEnum("stage", ["建图", "进门", "定痛", "找人", "进入商机"]).default("建图").notNull(),
  priority: mysqlEnum("priority", ["P0", "P1", "P2"]).default("P1").notNull(),
  hookTopic: text("hookTopic"), // 敲门砖话题
  securityAngle: text("securityAngle"), // 安全切入点
  notes: text("notes"),
  monitorKeywords: json("monitorKeywords").$type<string[]>(),
  isTest: boolean("isTest").default(false),
  plannedFirstVisitDate: int("plannedFirstVisitDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  /** 当前阶段开始时间（每次阶段推进时更新）。用于计算阶段停留天数。 */
  stageChangedAt: timestamp("stageChangedAt").defaultNow().notNull(),
  /** P2d：客户关系滚动叙事（约200字，每次拜访后AI自动更新，记录态度趋势/MEDDPICC变化/未解决阻碍）*/
  relationshipNarrative: text("relationshipNarrative"),
  /** 负责 SAM 的 email_users.id（用于 AD Review SAM 和 SAM 能力画像） */
  assignedSamId: int("assignedSamId"),
  /** 负责 SAM 的姓名（冗余字段，避免 JOIN，快速展示用） */
  assignedSamName: varchar("assignedSamName", { length: 100 }),
  /** 负责 RSM 的 email_users.id（属地销售） */
  assignedRsmId: int("assignedRsmId"),
  /** 负责 RSM 的姓名（冗余字段） */
  assignedRsmName: varchar("assignedRsmName", { length: 100 }),
});

/**
 * AI Review 持久化记录（SAM 自 Review 结果存档，供 AD 查阅）
 */
export const aiReviews = mysqlTable("ai_reviews", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  opportunityId: int("opportunityId"),  // 仅 1→N Review 时填写
  reviewType: mysqlEnum("reviewType", ["0to1", "1toN", "buyingGroup", "visitTrend"]).notNull(),
  content: text("content").notNull(),   // AI 生成的 Markdown 内容
  createdBy: varchar("createdBy", { length: 100 }), // 触发者姓名
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AiReview = typeof aiReviews.$inferSelect;
export type InsertAiReview = typeof aiReviews.$inferInsert;

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

/**
 * 客户效能基线（Customer Effectiveness Baseline）
 * 用于效能显性化：量化痛点陈述、ROI测算、效能账本视图
 */
/**
 * AD 教练辅导建议 Action Items（AD 从教练 Review 中下发给 SAM 的具体辅导任务）
 */
export const coachingActions = mysqlTable("coaching_actions", {
  id: int("id").autoincrement().primaryKey(),
  samId: int("samId").notNull(),           // 被辅导的 SAM（email_users.id）
  samName: varchar("samName", { length: 100 }).notNull(),
  clientId: int("clientId"),               // 关联客户（可选，全局辅导时为 null）
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  dueDate: timestamp("dueDate"),
  isCompleted: boolean("isCompleted").default(false).notNull(),
  completedAt: timestamp("completedAt"),
  createdBy: varchar("createdBy", { length: 100 }), // AD 姓名
  executionFeedback: text("executionFeedback"),      // SAM 执行反馈
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CoachingAction = typeof coachingActions.$inferSelect;
export type InsertCoachingAction = typeof coachingActions.$inferInsert;

export const effectivenessBaselines = mysqlTable("effectiveness_baselines", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull().unique(),
  // 安全运营效率类
  currentMttr: varchar("currentMttr", { length: 50 }),          // 平均威胁响应时间（如"4小时"）
  currentDetectionRate: varchar("currentDetectionRate", { length: 50 }), // 已知威胁检出率（如"75%"）
  socHeadcount: int("socHeadcount"),                             // 安全运营人员数量
  falsePositiveRate: varchar("falsePositiveRate", { length: 50 }), // 误报率
  // 合规成本类
  complianceAuditDays: int("complianceAuditDays"),               // 每次合规审计准备天数
  complianceIncidentsPerYear: int("complianceIncidentsPerYear"), // 每年合规违规事件数
  // 业务影响类
  downtimeHoursPerYear: varchar("downtimeHoursPerYear", { length: 50 }), // 每年安全事件导致停机时长
  estimatedIncidentCost: varchar("estimatedIncidentCost", { length: 100 }), // 每次安全事件平均损失
  // 数据来源标记（每个字段的来源）
  dataSource: mysqlEnum("dataSource", ["客户提供", "行业基准", "AI估算", "混合"]).default("AI估算"),
  // AI生成的量化痛点陈述（约300字）
  quantifiedPainStatement: text("quantifiedPainStatement"),
  // AI生成的ROI摘要（约200字）
  roiSummary: text("roiSummary"),
  // 年化价值估算（字符串，如"$120K-$200K"）
  estimatedAnnualValue: varchar("estimatedAnnualValue", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type EffectivenessBaseline = typeof effectivenessBaselines.$inferSelect;
export type InsertEffectivenessBaseline = typeof effectivenessBaselines.$inferInsert;

/**
 * 成功案例库（Case Studies）
 * 结构化存储国内外成功案例，供 AI 生成敲门砖建议、Champion 弹药、1-Pager 时引用
 */
export const caseStudies = mysqlTable("case_studies", {
  id: int("id").autoincrement().primaryKey(),
  // 基本信息
  title: varchar("title", { length: 200 }).notNull(),           // 案例标题（如"某大型银行威胁检测响应优化"）
  clientAlias: varchar("clientAlias", { length: 100 }),         // 客户别名/匿名名称（如"华南某股份制银行"）
  isConfidential: boolean("isConfidential").default(false),     // 是否保密（保密时隐藏客户名）
  // 分类维度（用于精准匹配）
  industry: varchar("industry", { length: 100 }),               // 行业（金融/制造/电信/政府/医疗/科技/零售/其他）
  clientSize: mysqlEnum("clientSize", ["大型企业", "中型企业", "小型企业", "政府机构"]).default("大型企业"),
  region: varchar("region", { length: 100 }),                   // 地区（华南/华北/东南亚/港澳等）
  productLines: json("productLines").$type<string[]>(),         // 涉及产品线（如["TrustOne","云安全"]）
  // 痛点与解决方案
  painPoint: text("painPoint").notNull(),                       // 核心痛点（1-2句，用于 AI 匹配）
  solution: text("solution").notNull(),                         // 解决方案摘要
  // 量化结果（Champion 弹药的核心素材）
  quantifiedResult: text("quantifiedResult"),                   // 量化结果（如"MTTR 从4小时降至15分钟，节省人力成本30%"）
  roiHighlight: varchar("roiHighlight", { length: 200 }),       // ROI 亮点一句话（如"18个月 ROI 达240%"）
  // 全文内容
  fullContent: text("fullContent"),                             // 完整案例内容（Markdown，可选）
  extractedText: text("extractedText"),                         // 从上传文件提取的文字
  fileUrl: text("fileUrl"),                                     // 上传的案例文件 URL
  // 元数据
  tags: json("tags").$type<string[]>(),                         // 自定义标签
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CaseStudy = typeof caseStudies.$inferSelect;
export type InsertCaseStudy = typeof caseStudies.$inferInsert;

/**
 * MEDDPICC 各要素完成度
 */
export const meddpicc = mysqlTable("meddpicc", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  // M - Metrics 可量化价值
  metricsScore: int("metricsScore").default(0).notNull(), // 0-100
  metricsNotes: text("metricsNotes"),
  // E - Economic Buyer 预算决策人
  economicBuyerScore: int("economicBuyerScore").default(0).notNull(),
  economicBuyerName: varchar("economicBuyerName", { length: 100 }),
  economicBuyerNotes: text("economicBuyerNotes"),
  // D - Decision Criteria 决策标准
  decisionCriteriaScore: int("decisionCriteriaScore").default(0).notNull(),
  decisionCriteriaNotes: text("decisionCriteriaNotes"),
  // D2 - Decision Process 决策流程
  decisionProcessScore: int("decisionProcessScore").default(0).notNull(),
  decisionProcessNotes: text("decisionProcessNotes"),
  // P - Paper Process 采购流程
  paperProcessScore: int("paperProcessScore").default(0).notNull(),
  paperProcessNotes: text("paperProcessNotes"),
  // I - Implicate the Pain 痛点牵连
  implicatePainScore: int("implicatePainScore").default(0).notNull(),
  implicatePainNotes: text("implicatePainNotes"),
  // C - Champion 内部支持者
  championScore: int("championScore").default(0).notNull(),
  championName: varchar("championName", { length: 100 }),
  championNotes: text("championNotes"),
  // C2 - Competition 竞争态势
  competitionScore: int("competitionScore").default(0).notNull(),
  competitionNotes: text("competitionNotes"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Meddpicc = typeof meddpicc.$inferSelect;
export type InsertMeddpicc = typeof meddpicc.$inferInsert;

/**
 * 情报信号
 */
export const intelligenceSignals = mysqlTable("intelligence_signals", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  rawSignal: text("rawSignal").notNull(), // 原始信号文本
  signalType: mysqlEnum("signalType", ["人事变动", "业务扩张", "合规事件", "合规政策", "招聘信号", "技术公告", "其他"]).notNull(),
  aiInterpretation: text("aiInterpretation"), // AI解读
  aiRecommendation: text("aiRecommendation"), // AI触达建议
  urgency: mysqlEnum("urgency", ["高", "中", "低"]).default("中").notNull(),
  isProcessed: boolean("isProcessed").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  opportunityId: int("opportunityId"),  // 关联商机（可选，触发商机窗口提示）
  opportunityWindowNote: text("opportunityWindowNote"),  // AI生成的商机窗口说明
});

export type IntelligenceSignal = typeof intelligenceSignals.$inferSelect;
export type InsertIntelligenceSignal = typeof intelligenceSignals.$inferInsert;

/**
 * RSS 信息源管理（自定义第三方 RSS）
 */
export const rssSources = mysqlTable("rss_sources", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(), // 信息源名称
  url: text("url").notNull(), // RSS URL
  description: text("description"), // 描述
  tags: json("tags").$type<string[]>(), // 标签（如「竞品动态」「客户新闻」）
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RssSource = typeof rssSources.$inferSelect;
export type InsertRssSource = typeof rssSources.$inferInsert;

/**
 * AI行动指令
 */
export const actionItems = mysqlTable("action_items", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  title: text("title").notNull(),
  objective: text("objective"), // 行动目标
  suggestedScript: text("suggestedScript"), // 建议话术
  responsibleRole: mysqlEnum("responsibleRole", ["AD", "SAM", "SA", "RSM"]).notNull(),
  priority: mysqlEnum("priority", ["高", "中", "低"]).default("中").notNull(),
  timeframe: mysqlEnum("timeframe", ["今日", "本周", "本月"]).default("本周").notNull(),
  isCompleted: boolean("isCompleted").default(false).notNull(),
  completedAt: timestamp("completedAt"),
  aiGenerated: boolean("aiGenerated").default(true).notNull(),
  taskType: mysqlEnum("taskType", ["external_sales", "internal_resource"]).default("external_sales"), // 对外销售 vs 内部资源协调
  opportunityId: int("opportunityId"),  // 关联子商机（可选）
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  /** 来源于哪次 Deal Review（用于追溯） */
  sourceReviewId: int("sourceReviewId"),
});

export type ActionItem = typeof actionItems.$inferSelect;
export type InsertActionItem = typeof actionItems.$inferInsert;

/**
 * AI生成的1-Pager简报
 */
export const onePagers = mysqlTable("one_pagers", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  targetExecutive: varchar("targetExecutive", { length: 100 }).notNull(), // 目标高管
  targetTitle: varchar("targetTitle", { length: 100 }), // 职位
  content: text("content").notNull(), // AI生成的完整内容（Markdown）
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OnePager = typeof onePagers.$inferSelect;
export type InsertOnePager = typeof onePagers.$inferInsert;

/**
 * Champion弹药库材料
 */
export const championAmmo = mysqlTable("champion_ammo", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  championName: varchar("championName", { length: 100 }).notNull(),
  ammoType: mysqlEnum("ammoType", ["竞品对标", "合规风险量化", "ROI测算"]).notNull(),
  content: text("content").notNull(), // AI生成内容（Markdown）
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChampionAmmo = typeof championAmmo.$inferSelect;
export type InsertChampionAmmo = typeof championAmmo.$inferInsert;

/**
 * 会后纪要
 */
export const meetingMinutes = mysqlTable("meeting_minutes", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  meetingDate: timestamp("meetingDate").notNull(),
  visitType: varchar("visitType", { length: 50 }).default("拜访"), // 拜访类型
  attendees: text("attendees"), // 参会人
  keyPoints: text("keyPoints").notNull(), // 输入的关键信息点
  transcriptText: text("transcriptText"), // 飞书妙记/上传文字全文
  aiMinutes: text("aiMinutes"), // AI生成的结构化纪要
  nextSteps: text("nextSteps"), // Next Steps
  hookTopicSuggestion: text("hookTopicSuggestion"), // AI提炼的敲门砖建议
  securityAngleSuggestion: text("securityAngleSuggestion"), // AI提炼的安全切入建议
  responsiblePerson: varchar("responsiblePerson", { length: 100 }),
  dueDate: timestamp("dueDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  // 接触类型字段（非正式接触数据模型）
  contactType: mysqlEnum("contactType", ["formal_meeting", "dinner_meeting", "phone_call", "video_call", "instant_message", "event", "customer_initiated"]).default("formal_meeting"),
  initiatedBy: mysqlEnum("initiatedBy", ["sam", "customer", "mutual"]).default("sam"),
  entrySource: mysqlEnum("entrySource", ["manual", "feishu_miaoji", "whatsapp_quick", "feishu_bot"]).default("manual"),
  /** AI 拜访后结论卡（Win进展/MEDDPICC建议/下次优先/风险预警） */
  aiPostAnalysis: json("aiPostAnalysis").$type<{
    winProgress: string;
    meddpiccUpdates: Array<{ dim: string; label: string; suggestedScore: number; reason: string }>;
    nextMeetingPriority: string;
    riskWarning: string | null;
  }>(),
  /** AI 原生拜访解析：一次提取的全量信号；业务事实仅在 SAM 确认后写入目标表。 */
  aiFullSignals: json("aiFullSignals").$type<{
    version: string;
    generatedAt: string;
    meetingSummary: string;
    meddpiccUpdates: Array<{ dim: string; suggestedScore: number; evidence: string; confidence: string }>;
    contactDiscoveries: Array<{ name: string; title: string | null; buyingRole: string; attitude: string; evidence: string }>;
    competitorMentions: Array<{ competitorName: string; context: string; threatLevel: string }>;
    timeSignals: Array<{ type: string; description: string; date: string | null }>;
    threeWhyUpdates: { whyChange: string | null; whyNow: string | null; whyUs: string | null };
    winFactorAlerts: Array<{ factor: string; alert: string; severity: string }>;
    nextBestAction: string;
  }>(),
  /** 已被人工确认的全量信号项目键；仅用于 UI 回执，不能替代目标事实表。 */
  aiFullSignalsConfirmedKeys: json("aiFullSignalsConfirmedKeys").$type<string[]>(),
});

export type MeetingMinute = typeof meetingMinutes.$inferSelect;
export type InsertMeetingMinute = typeof meetingMinutes.$inferInsert;

/**
 * POD任务队列（角色专属）
 */
export const podTasks = mysqlTable("pod_tasks", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  assignedRole: mysqlEnum("assignedRole", ["AD", "SAM", "SA", "RSM"]).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: timestamp("dueDate"),
  isCompleted: boolean("isCompleted").default(false).notNull(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  sourceActionId: int("sourceActionId"),  // links back to action_items.id when adopted from action command
  priority: mysqlEnum("priority", ["高", "中", "低"]).default("中"),
  taskType: mysqlEnum("taskType", ["external_sales", "internal_resource"]).default("external_sales"), // 对外销售 vs 内部资源协调
  opportunityId: int("opportunityId"),  // 关联子商机（可选）
  taskStatus: mysqlEnum("taskStatus", ["pending", "in_progress", "done"]).default("pending").notNull(), // 看板状态
  /** 业务来源类型；用于区分人工任务、竞品反制与结构化 Review 行动。 */
  sourceType: varchar("sourceType", { length: 50 }),
  /** 任务由哪一条 AI Review 生成；仅记录可追溯来源，不替代完成状态。 */
  sourceReviewId: int("sourceReviewId"),
});

export type PodTask = typeof podTasks.$inferSelect;
export type InsertPodTask = typeof podTasks.$inferInsert;

/**
 * AD 指挥台 AI 作战建议。
 * 每条建议以已入库事实、方法论判断和建议行动组成；AD 必须明确确认或跳过，状态跨页面持久化。
 */
export const adCommandRecommendations = mysqlTable("ad_command_recommendations", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId"),
  opportunityId: int("opportunityId"),
  kind: mysqlEnum("kind", ["today_action", "anomaly", "pending_approval", "sam_coaching"]).notNull(),
  priority: mysqlEnum("priority", ["P0", "P1", "P2"]).default("P1").notNull(),
  title: varchar("title", { length: 240 }).notNull(),
  aiConclusion: text("aiConclusion").notNull(),
  facts: json("facts").$type<Array<{ label: string; value: string }>>().notNull(),
  methodology: varchar("methodology", { length: 160 }).notNull(),
  suggestedAction: text("suggestedAction").notNull(),
  assignedRole: mysqlEnum("assignedRole", ["AD", "SAM", "SA", "RSM"]).default("AD").notNull(),
  dueDate: timestamp("dueDate"),
  fingerprint: varchar("fingerprint", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["pending", "confirmed", "skipped", "completed"]).default("pending").notNull(),
  confirmedBy: varchar("confirmedBy", { length: 100 }),
  confirmedAt: timestamp("confirmedAt"),
  skipReason: text("skipReason"),
  podTaskId: int("podTaskId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AdCommandRecommendation = typeof adCommandRecommendations.$inferSelect;
export type InsertAdCommandRecommendation = typeof adCommandRecommendations.$inferInsert;

/**
 * MEDDPICC 作战日志（追加式时间轴，不覆盖）
 */
export const meddpiccLogs = mysqlTable("meddpicc_logs", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  dimension: varchar("dimension", { length: 50 }).notNull(), // e.g. "metricsScore"
  score: int("score").notNull(),
  note: text("note").notNull(),
  authorRole: mysqlEnum("authorRole", ["AD", "SAM", "SA", "RSM"]).notNull().default("SAM"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type MeddpiccLog = typeof meddpiccLogs.$inferSelect;
export type InsertMeddpiccLog = typeof meddpiccLogs.$inferInsert;

/**
 * 客户购买信号：进入商机的唯一门控证据。
 * 记录客户发生了什么，而不是销售完成了什么动作；三类信号跨产品通用。
 */
export const customerPurchaseSignals = mysqlTable("customer_purchase_signals", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  signalType: mysqlEnum("signalType", ["intent_subject", "decision_chain", "trigger_event"]).notNull(),
  subjectName: varchar("subjectName", { length: 150 }).notNull(),
  /** 决策链信号关联到关键人图谱，服务端以此校验角色，避免姓名文本匹配。 */
  subjectContactId: int("subjectContactId"),
  occurredAt: timestamp("occurredAt").notNull(),
  statement: text("statement").notNull(),
  sourceType: mysqlEnum("sourceType", ["meeting", "customer_message", "customer_email", "intelligence", "other_evidence"]).notNull(),
  sourceMeetingId: int("sourceMeetingId"),
  sourceReference: text("sourceReference"),
  createdBy: varchar("createdBy", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CustomerPurchaseSignal = typeof customerPurchaseSignals.$inferSelect;
export type InsertCustomerPurchaseSignal = typeof customerPurchaseSignals.$inferInsert;

/**
 * 商机温度预测记录
 */
export const opportunityScores = mysqlTable("opportunity_scores", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  overallScore: int("overallScore").notNull(), // 0-100
  meddpiccScore: int("meddpiccScore").notNull(),
  signalScore: int("signalScore").notNull(),
  visitFrequencyScore: int("visitFrequencyScore").default(0),
  riskLevel: mysqlEnum("riskLevel", ["高风险", "中风险", "低风险"]).notNull(),
  aiAnalysis: text("aiAnalysis"), // AI分析文本
  warnings: json("warnings").$type<string[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OpportunityScore = typeof opportunityScores.$inferSelect;
export type InsertOpportunityScore = typeof opportunityScores.$inferInsert;

/**
 * Deal Review 记录
 */
export const dealReviews = mysqlTable("deal_reviews", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  reviewDate: timestamp("reviewDate").notNull(),
  content: text("content").notNull(),
  nextSteps: text("nextSteps"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DealReview = typeof dealReviews.$inferSelect;
export type InsertDealReview = typeof dealReviews.$inferInsert;

/**
 * 关键人图谱（每户客户的高管/关键联系人）
 */
export const keyContacts = mysqlTable("key_contacts", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  title: varchar("title", { length: 150 }),           // 职位
  department: varchar("department", { length: 100 }), // 部门
  influence: mysqlEnum("influence", ["决策者", "影响者", "Champion候选", "技术评估者", "内部线人"]).default("影响者"),
  buyingRole: mysqlEnum("buyingRole", ["经济决策人", "技术决策人", "用户影响者", "阻碍者", "Champion", "内部线人", "未知"]).default("未知"),
  relationship: mysqlEnum("relationship", ["待接触", "已识别", "初步接触", "已接触", "建立关系", "Champion", "已拒绝"]).default("待接触"),
  linkedinUrl: varchar("linkedinUrl", { length: 300 }),
  email: varchar("email", { length: 200 }),
  notes: text("notes"),
  reportingTo: varchar("reportingTo", { length: 100 }),      // 汇报上级姓名（用于构建汇报链路）
  stance: mysqlEnum("stance", ["支持", "中立", "反对", "未知"]).default("未知"), // 对项目的立场
  persona: text("persona"),                                  // AI 生成的人物画像摘要
  breakthroughTip: text("breakthroughTip"),                  // AI 生成的突破建议话术
  // P2b：Champion 三维评分（仅对 Champion 角色有意义）
  championAccessToPower: int("championAccessToPower").default(0), // 能否触达EB并传递信息 1-3分
  championPoliticalWill: int("championPoliticalWill").default(0), // 是否真正愿意主动推动 1-3分
  championCredibility: int("championCredibility").default(0),     // 在决策层说话是否有分量 1-3分
  // P2c：关系边（引荐路径，JSON数组）[{"to":"李XX","type":"direct_report","strength":"high"}]
  relationshipEdges: json("relationshipEdges").$type<Array<{to: string; type: string; strength: string}>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  // 非正式接触数据（关系深度评估）
  informalContactCount: int("informalContactCount").default(0),     // 非正式接触次数
  customerInitiatedCount: int("customerInitiatedCount").default(0), // 客户主动发起次数
  hasWhatsapp: boolean("hasWhatsapp").default(false),               // 是否有 WhatsApp 渠道
  hasFeishu: boolean("hasFeishu").default(false),                   // 是否有飞书渠道（已废弃，保留兼容）
  hasWeChat: boolean("hasWeChat").default(false),                    // 是否有微信渠道（中国内地客户）
  lastInformalContact: timestamp("lastInformalContact"),            // 最近一次非正式接触日期
});

export type KeyContact = typeof keyContacts.$inferSelect;
export type InsertKeyContact = typeof keyContacts.$inferInsert;

/**
 * MEDDPICC历史快照（每次保存时记录，用于趋势图）
 */
export const meddpiccSnapshots = mysqlTable("meddpicc_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  scores: json("scores").$type<{
    metricsScore: number;
    economicBuyerScore: number;
    decisionCriteriaScore: number;
    decisionProcessScore: number;
    paperProcessScore: number;
    implicatePainScore: number;
    championScore: number;
    competitionScore: number;
    totalScore: number;
  }>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MeddpiccSnapshot = typeof meddpiccSnapshots.$inferSelect;
export type InsertMeddpiccSnapshot = typeof meddpiccSnapshots.$inferInsert;

/**
 * 系统配置（飞书Webhook等全局配置）
 */
export const systemConfig = mysqlTable("system_config", {
  id: int("id").autoincrement().primaryKey(),
  configKey: varchar("configKey", { length: 100 }).notNull().unique(),
  configValue: text("configValue"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SystemConfig = typeof systemConfig.$inferSelect;
export type InsertSystemConfig = typeof systemConfig.$inferInsert;

/**
 * 武器库（Arsenal）— 产品/方案/弹药/话术/报价
 */
export const arsenalWeapons = mysqlTable("arsenal_weapons", {
  id: int("id").autoincrement().primaryKey(),
  category: mysqlEnum("category", ["产品类", "方案类", "弹药类", "话术类", "报价单"]).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  subtitle: varchar("subtitle", { length: 300 }),           // 副标题/一句话定位
  tags: json("tags").$type<string[]>(),                      // 标签数组
  description: text("description"),                          // 详细描述
  usageScenario: text("usageScenario"),                       // 适用场景
  targetRole: mysqlEnum("targetRole", ["CEO", "CTO", "CFO", "董事长", "IT负责人", "安全负责人", "采购", "通用"]).default("通用"),
  listPrice: varchar("listPrice", { length: 200 }),           // 报价/定价
  currency: varchar("currency", { length: 20 }).default("CNY"),
  isDemo: boolean("isDemo").default(false).notNull(),         // 是否为演示数据
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ArsenalWeapon = typeof arsenalWeapons.$inferSelect;
export type InsertArsenalWeapon = typeof arsenalWeapons.$inferInsert;

/**
 * 武器库附件（支持上传文档）
 */
export const arsenalAttachments = mysqlTable("arsenal_attachments", {
  id: int("id").autoincrement().primaryKey(),
  weaponId: int("weaponId").notNull(),
  filename: varchar("filename", { length: 300 }).notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),     // S3 key
  fileUrl: varchar("fileUrl", { length: 500 }).notNull(),     // 访问URL
  mimeType: varchar("mimeType", { length: 100 }),
  fileSize: int("fileSize"),                                  // bytes
  uploadedBy: varchar("uploadedBy", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ArsenalAttachment = typeof arsenalAttachments.$inferSelect;
export type InsertArsenalAttachment = typeof arsenalAttachments.$inferInsert;

/**
 * 武器库报价单（独立报价条目，可关联武器）
 */
export const arsenalPricing = mysqlTable("arsenal_pricing", {
  id: int("id").autoincrement().primaryKey(),
  weaponId: int("weaponId").notNull(),
  pricingTier: varchar("pricingTier", { length: 100 }).notNull(), // 版本/规格名称
  listPrice: varchar("listPrice", { length: 200 }).notNull(),
  currency: varchar("currency", { length: 20 }).default("CNY"),
  billingCycle: mysqlEnum("billingCycle", ["一次性", "年费", "月费", "按量"]).default("年费"),
  minQty: int("minQty").default(1),
  notes: text("notes"),                                       // 报价备注/折扣说明
  isPublic: boolean("isPublic").default(false).notNull(),     // 是否对外公开
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ArsenalPricing = typeof arsenalPricing.$inferSelect;
export type InsertArsenalPricing = typeof arsenalPricing.$inferInsert;

/**
 * 产品文档仓库（武器库-产品类：直接上传原始文档）
 */
export const productDocs = mysqlTable("product_docs", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  productLine: varchar("productLine", { length: 100 }),  // 产品线：TrustOne/CloudGuard/NDR/ThreatTrace等
  folderId: int("folderId"), // 可选的自建子文件夹；为空时位于产品线根目录
  tags: json("tags").$type<string[]>(),
  filename: varchar("filename", { length: 300 }).notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 500 }).notNull(),
  mimeType: varchar("mimeType", { length: 100 }),
  fileSize: int("fileSize"),
  extractedText: text("extractedText"),  // 文档内容摘要（供AI读取）
  uploadedBy: varchar("uploadedBy", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ProductDoc = typeof productDocs.$inferSelect;
export type InsertProductDoc = typeof productDocs.$inferInsert;

/**
 * 武器库产品文档子文件夹。产品线是第一层固定目录，用户可在其下创建资料包文件夹。
 */
export const productDocFolders = mysqlTable("product_doc_folders", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  productLine: varchar("productLine", { length: 100 }).notNull(),
  createdBy: varchar("createdBy", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ProductDocFolder = typeof productDocFolders.$inferSelect;
export type InsertProductDocFolder = typeof productDocFolders.$inferInsert;

/**
 * AI生成记录（方案类/弹药类/话术类的生成历史）
 */
export const arsenalGenerated = mysqlTable("arsenal_generated", {
  id: int("id").autoincrement().primaryKey(),
  category: mysqlEnum("category", ["方案类", "弹药类", "话术类"]).notNull(),
  title: varchar("title", { length: 300 }).notNull(),
  prompt: text("prompt").notNull(),           // 销售输入的需求描述
  docIds: json("docIds").$type<number[]>(),   // 参考的产品文档ID列表
  generatedContent: text("generatedContent").notNull(),  // AI生成的内容
  clientId: int("clientId"),                 // 关联客户（可选）
  opportunityId: int("opportunityId"),       // 关联商机（可选）；方案仅在进入该商机时使用
  targetContact: varchar("targetContact", { length: 100 }),  // 目标联系人
  adoptionStatus: mysqlEnum("adoptionStatus", ["待确认", "已采用", "未采用"]).default("待确认").notNull(),
  customerFeedback: text("customerFeedback"), // 人工录入的客户反馈；作为下次生成的待验证上下文
  outcomeUpdatedAt: timestamp("outcomeUpdatedAt"),
  createdBy: varchar("createdBy", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ArsenalGenerated = typeof arsenalGenerated.$inferSelect;
export type InsertArsenalGenerated = typeof arsenalGenerated.$inferInsert;

/**
 * ListPrice 条目（从 Excel 导入的真实报价数据）
 */
export const listpriceItems = mysqlTable("listprice_items", {
  id: int("id").autoincrement().primaryKey(),
  productLine: varchar("productLine", { length: 100 }).notNull(),  // TrustOne/CloudGuard/NDR/ThreatTrace/Services
  productName: varchar("productName", { length: 200 }).notNull(),
  model: varchar("model", { length: 100 }),
  pid: varchar("pid", { length: 100 }),
  sku: varchar("sku", { length: 200 }),
  unit: varchar("unit", { length: 100 }),  // 计价单位：Device/Year, VM/Year, engagement等
  listPriceUsd: float("listPriceUsd").notNull(),
  tier1PriceUsd: float("tier1PriceUsd"),   // 65% off (Sales Manager Max)
  tier2PriceUsd: float("tier2PriceUsd"),   // 55% off
  tier3PriceUsd: float("tier3PriceUsd"),   // 45% off
  billingCycle: varchar("billingCycle", { length: 50 }).default("Annual"),
  specs: text("specs"),                    // 规格说明
  notes: text("notes"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ListpriceItem = typeof listpriceItems.$inferSelect;
export type InsertListpriceItem = typeof listpriceItems.$inferInsert;

/**
 * 报价单（销售生成的客户报价）
 */
export const quotes = mysqlTable("quotes", {
  id: int("id").autoincrement().primaryKey(),
  quoteNumber: varchar("quoteNumber", { length: 50 }).notNull(),  // 报价单号
  clientId: int("clientId"),
  clientName: varchar("clientName", { length: 200 }),
  contactName: varchar("contactName", { length: 100 }),
  validUntil: timestamp("validUntil"),
  currency: varchar("currency", { length: 10 }).default("USD").notNull(),
  totalListPrice: float("totalListPrice").default(0).notNull(),
  totalDiscountedPrice: float("totalDiscountedPrice").default(0).notNull(),
  notes: text("notes"),
  status: mysqlEnum("status", ["草稿", "已发送", "已接受", "已拒绝", "已过期"]).default("草稿").notNull(),
  createdBy: varchar("createdBy", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Quote = typeof quotes.$inferSelect;
export type InsertQuote = typeof quotes.$inferInsert;

/**
 * 报价单明细
 */
export const quoteItems = mysqlTable("quote_items", {
  id: int("id").autoincrement().primaryKey(),
  quoteId: int("quoteId").notNull(),
  listpriceItemId: int("listpriceItemId"),
  productName: varchar("productName", { length: 200 }).notNull(),
  model: varchar("model", { length: 100 }),
  unit: varchar("unit", { length: 100 }),
  quantity: int("quantity").default(1).notNull(),
  listPriceUsd: float("listPriceUsd").notNull(),
  discountPct: float("discountPct").default(0).notNull(),  // 折扣百分比 0-100
  discountedPriceUsd: float("discountedPriceUsd").notNull(),
  subtotalListPrice: float("subtotalListPrice").notNull(),
  subtotalDiscounted: float("subtotalDiscounted").notNull(),
  notes: text("notes"),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type QuoteItem = typeof quoteItems.$inferSelect;
export type InsertQuoteItem = typeof quoteItems.$inferInsert;

/**
 * 活跃战线：客户内多商机（Sub-Opportunity）并行管理
 */
export const opportunities = mysqlTable("opportunities", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  name: varchar("name", { length: 200 }).notNull(),          // 商机名称，如 "EDR 端点检测"
  productId: int("productId"),                               // 关联产品配置表（可选）
  stage: mysqlEnum("stage", ["初步需求", "需求挖掘", "技术验证", "方案提案", "商务谈判", "赢单", "丢单"]).default("初步需求").notNull(),
  status: mysqlEnum("status", ["活跃", "暂停", "赢单", "丢单"]).default("活跃").notNull(),
  competitorName: varchar("competitorName", { length: 200 }), // 主要竞品，如 "QAX"
  contactName: varchar("contactName", { length: 100 }),       // 客户侧对接人
  estimatedValue: varchar("estimatedValue", { length: 100 }), // 预估金额（字符串，如 "$50K"）
  expectedCloseDate: varchar("expectedCloseDate", { length: 50 }), // 预计结单，如 "Q4 2026"
  notes: text("notes"),
  // IBM Blue Sheet 字段（商机级别）
  bizObjective: text("bizObjective"),           // 客户业务目标（针对此商机）
  valueProposition: text("valueProposition"),   // 我方价值主张
  champion: varchar("champion", { length: 100 }), // Champion 姓名
  championStance: mysqlEnum("championStance", ["支持", "中立", "反对", "未知"]).default("未知"), // Champion 立场
  blueSheetCompetitor: text("blueSheetCompetitor"), // 竞争态势（针对此商机）
  winStrategy: text("winStrategy"),             // 赢单策略
  keyMilestones: text("keyMilestones"),         // 关键里程碑
  riskAndMitigation: text("riskAndMitigation"), // 风险与应对
  /** 从客户作战台申请开商机时固化的 0→1 客观行为证据；只读，不作为商机赢单评分。 */
  entryEvidenceSnapshot: json("entryEvidenceSnapshot").$type<{
    approvedAt: string;
    customerStage: string;
    gateChecks: Array<{ id: string; label: string; evidence: string; passed: boolean }>;
    purchaseSignals: Array<{
      type: string;
      label: string;
      subjectName: string;
      subjectContactId: number | null;
      occurredAt: string;
      statement: string;
      sourceType: string;
      sourceReference: string;
    }>;
    approval: {
      mode: "purchase_signals" | "exec_meeting";
      approvedBy?: { id: number; name: string; podRole: string };
      confirmation?: string;
      executiveContact?: { id: number; name: string; buyingRole: string | null };
      meetingEvidence?: Array<{ id: number; meetingDate: string; attendees: string | null }>;
    };
  }>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  /** 当前商机子阶段开始时间（每次阶段推进时更新）。用于计算商机停滞天数。 */
  stageChangedAt: timestamp("stageChangedAt").defaultNow().notNull(),
  /** 负责SA */
  assignedSaId: int("assignedSaId"),
  assignedSaName: varchar("assignedSaName", { length: 100 }),
});
export type Opportunity = typeof opportunities.$inferSelect;
export type InsertOpportunity = typeof opportunities.$inferInsert;

/**
 * 商机参与人：只记录与单一商机相关的客户人员及其项目角色。
 * 与客户级关键人图谱分离；角色为“无关”时，该人员不会进入任何商机 AI 引导问题。
 */
export const opportunityParticipants = mysqlTable("opportunity_participants", {
  id: int("id").autoincrement().primaryKey(),
  opportunityId: int("opportunityId").notNull(),
  clientId: int("clientId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  role: mysqlEnum("role", ["技术评估", "使用方", "决策人", "评审人", "签字人", "阻力", "无关"]).default("技术评估").notNull(),
  source: mysqlEnum("source", ["sam_input", "ai_extracted"]).default("sam_input").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type OpportunityParticipant = typeof opportunityParticipants.$inferSelect;
export type InsertOpportunityParticipant = typeof opportunityParticipants.$inferInsert;

/**
 * 商机级 MEDDPICC 评分（每条商机独立的 8 维评分）
 */
export const opportunityMeddpicc = mysqlTable("opportunity_meddpicc", {
  id: int("id").autoincrement().primaryKey(),
  opportunityId: int("opportunityId").notNull().unique(), // 一条商机一套评分
  clientId: int("clientId").notNull(),
  // M - Metrics 可量化价值
  metricsScore: int("metricsScore").default(0).notNull(),     // 0-4分
  metricsNotes: text("metricsNotes"),
  // E - Economic Buyer 预算决策人
  economicBuyerScore: int("economicBuyerScore").default(0).notNull(),
  economicBuyerNotes: text("economicBuyerNotes"),
  // D - Decision Criteria 决策标准
  decisionCriteriaScore: int("decisionCriteriaScore").default(0).notNull(),
  decisionCriteriaNotes: text("decisionCriteriaNotes"),
  // D2 - Decision Process 决策流程
  decisionProcessScore: int("decisionProcessScore").default(0).notNull(),
  decisionProcessNotes: text("decisionProcessNotes"),
  // P - Paper Process 采购流程
  paperProcessScore: int("paperProcessScore").default(0).notNull(),
  paperProcessNotes: text("paperProcessNotes"),
  // I - Implicate the Pain 痛点牵连
  implicatePainScore: int("implicatePainScore").default(0).notNull(),
  implicatePainNotes: text("implicatePainNotes"),
  // C - Champion 内部支持者
  championScore: int("championScore").default(0).notNull(),
  championNotes: text("championNotes"),
  // C2 - Competition 竞争态势
  competitionScore: int("competitionScore").default(0).notNull(),
  competitionNotes: text("competitionNotes"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type OpportunityMeddpicc = typeof opportunityMeddpicc.$inferSelect;
export type InsertOpportunityMeddpicc = typeof opportunityMeddpicc.$inferInsert;

/** Command 2.0：0→1 Account Map 的战略视图（每客户一条）。 */
export const accountOverview = mysqlTable("account_overview", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull().unique(),
  strategicFitScore: int("strategicFitScore"),
  potentialScore: int("potentialScore"),
  relationshipScore: int("relationshipScore"),
  whitespaceScore: int("whitespaceScore"),
  execPriorityScore: int("execPriorityScore"),
  strategy12m: text("strategy12m"),
  strategy24m: text("strategy24m"),
  strategy36m: text("strategy36m"),
  aiOpportunity: text("aiOpportunity"),
  cyberOpportunity: text("cyberOpportunity"),
  ictOpportunity: text("ictOpportunity"),
  triggerEvents: text("triggerEvents"),
  vendorVision: varchar("vendorVision", { length: 50 }),
  annualSuccessKPI: text("annualSuccessKPI"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AccountOverview = typeof accountOverview.$inferSelect;
export type InsertAccountOverview = typeof accountOverview.$inferInsert;

/** Command 2.0：客户多层关系覆盖（0→1 Account Map）。 */
export const relationshipCoverage = mysqlTable("relationship_coverage", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  coverageLevel: varchar("coverageLevel", { length: 100 }),
  targetPerson: varchar("targetPerson", { length: 100 }),
  ourCoverer: varchar("ourCoverer", { length: 100 }),
  strengthScore: int("strengthScore"),
  lastInteraction: timestamp("lastInteraction"),
  hasExecMeeting: boolean("hasExecMeeting").default(false),
  stance: varchar("stance", { length: 50 }),
  gapJudgment: varchar("gapJudgment", { length: 20 }),
  nextAction: text("nextAction"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type RelationshipCoverage = typeof relationshipCoverage.$inferSelect;
export type InsertRelationshipCoverage = typeof relationshipCoverage.$inferInsert;

/** Command 2.0：商机级三 Why 与 Challenger Reframe 事实（1→N Deal Map）。 */
export const threeWhy = mysqlTable("three_why", {
  id: int("id").autoincrement().primaryKey(),
  opportunityId: int("opportunityId").notNull().unique(),
  clientId: int("clientId").notNull(),
  whyChangeClaim: text("whyChangeClaim"),
  whyChangePain: text("whyChangePain"),
  whyChangeConsequence: text("whyChangeConsequence"),
  whyChangeEvidence: text("whyChangeEvidence"),
  whyChangeScore: int("whyChangeScore"),
  whyNowClaim: text("whyNowClaim"),
  whyNowTrigger: text("whyNowTrigger"),
  whyNowEvidence: text("whyNowEvidence"),
  whyNowScore: int("whyNowScore"),
  whyUsClaim: text("whyUsClaim"),
  whyUsDifferentiator: text("whyUsDifferentiator"),
  whyUsEvidence: text("whyUsEvidence"),
  whyUsScore: int("whyUsScore"),
  challengerTeach: text("challengerTeach"),
  challengerTailor: text("challengerTailor"),
  challengerControl: text("challengerControl"),
  reframeEvidence: text("reframeEvidence"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ThreeWhy = typeof threeWhy.$inferSelect;
export type InsertThreeWhy = typeof threeWhy.$inferInsert;

/** Command 2.0：商机痛点、量化基线与商业价值明细（1→N Deal Map）。 */
export const painMetrics = mysqlTable("pain_metrics", {
  id: int("id").autoincrement().primaryKey(),
  opportunityId: int("opportunityId").notNull(),
  clientId: int("clientId").notNull(),
  painType: varchar("painType", { length: 100 }),
  painStatement: text("painStatement"),
  affectedSponsor: varchar("affectedSponsor", { length: 100 }),
  currentBaseline: text("currentBaseline"),
  targetImprovement: text("targetImprovement"),
  valueLogic: text("valueLogic"),
  timeframe: varchar("timeframe", { length: 50 }),
  annualValue: int("annualValue"),
  confidence: decimal("confidence", { precision: 3, scale: 2 }),
  evidenceStrength: varchar("evidenceStrength", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PainMetric = typeof painMetrics.$inferSelect;
export type InsertPainMetric = typeof painMetrics.$inferInsert;

/** Command 2.0：商机竞争与 No Decision 地图（1→N Deal Map）。 */
export const competitionMap = mysqlTable("competition_map", {
  id: int("id").autoincrement().primaryKey(),
  opportunityId: int("opportunityId").notNull(),
  clientId: int("clientId").notNull(),
  competitorType: varchar("competitorType", { length: 100 }),
  controlPoints: text("controlPoints"),
  customerSupporter: varchar("customerSupporter", { length: 100 }),
  strengths: text("strengths"),
  weaknesses: text("weaknesses"),
  attackVector: text("attackVector"),
  counterAction: text("counterAction"),
  riskScore: int("riskScore"),
  owner: varchar("owner", { length: 100 }),
  nextStep: text("nextStep"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CompetitionMap = typeof competitionMap.$inferSelect;
export type InsertCompetitionMap = typeof competitionMap.$inferInsert;

/** Command 2.0：商机重资源投入 Go/No-Go 门控（1→N Deal Map）。 */
export const goNoGo = mysqlTable("go_no_go", {
  id: int("id").autoincrement().primaryKey(),
  opportunityId: int("opportunityId").notNull().unique(),
  gate1StrategicFit: int("gate1StrategicFit").default(0).notNull(),
  gate2PainVerified: int("gate2PainVerified").default(0).notNull(),
  gate3ChampionExists: int("gate3ChampionExists").default(0).notNull(),
  gate4EBClear: int("gate4EBClear").default(0).notNull(),
  gate5ValueQuantified: int("gate5ValueQuantified").default(0).notNull(),
  gate6CriteriaWinnable: int("gate6CriteriaWinnable").default(0).notNull(),
  gate7ProcessClear: int("gate7ProcessClear").default(0).notNull(),
  gate8CompDefensible: int("gate8CompDefensible").default(0).notNull(),
  gate9DeliveryOK: int("gate9DeliveryOK").default(0).notNull(),
  gate10ROIJustified: int("gate10ROIJustified").default(0).notNull(),
  managerOverride: varchar("managerOverride", { length: 20 }),
  overrideReason: text("overrideReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type GoNoGo = typeof goNoGo.$inferSelect;
export type InsertGoNoGo = typeof goNoGo.$inferInsert;

/**
 * 竞品阻击包（Kill Sheets）
 */
export const killSheets = mysqlTable("kill_sheets", {
  id: int("id").autoincrement().primaryKey(),
  competitorName: varchar("competitorName", { length: 100 }).notNull(), // 竞品名称，如 "QAX"
  productLine: varchar("productLine", { length: 200 }),                 // 竞品产品线，如 "EDR/XDR"
  ourProduct: varchar("ourProduct", { length: 200 }),                   // 我方对应产品
  competitorType: varchar("competitorType", { length: 50 }),           // 竞品类型：直接竞品/替代方案/内部自研/其他
  keyDifferentiators: json("keyDifferentiators").$type<string[]>(),     // 核心差异化要点
  weaknesses: json("weaknesses").$type<string[]>(),                     // 竞品弱点（JSON数组）
  weaknessesText: text("weaknessesText"),                               // 竞品弱点（自由文本）
  ourAdvantages: text("ourAdvantages"),                                 // 我方优势
  keyDiffs: text("keyDiffs"),                                           // 关键差异点（每行一条）
  battleNotes: text("battleNotes"),                                     // 作战备注
  aiContent: text("aiContent"),                                         // AI 生成的完整阻击话术（Markdown，旧字段）
  aiGeneratedTalk: text("aiGeneratedTalk"),                             // AI 生成的差异化话术（新字段）
  clientId: int("clientId"),                                            // 关联客户 ID
  sourceClientId: int("sourceClientId"),                                // 触发来源客户 ID（从拜访日志识别）
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type KillSheet = typeof killSheets.$inferSelect;
export type InsertKillSheet = typeof killSheets.$inferInsert;

/**
 * 邮箱用户表（仅允许 @aistorm.com 邮箱注册）
 */
export const emailUsers = mysqlTable("email_users", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  podRole: mysqlEnum("podRole", ["AD", "SAM", "SA", "RSM"]).default("SAM").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastLoginAt: timestamp("lastLoginAt"),
  lastLoginIp: varchar("lastLoginIp", { length: 45 }),
});
export type EmailUser = typeof emailUsers.$inferSelect;
export type InsertEmailUser = typeof emailUsers.$inferInsert;

/**
 * 邮箱登录会话表
 */
export const emailSessions = mysqlTable("email_sessions", {
  id: int("id").autoincrement().primaryKey(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  userId: int("userId").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type EmailSession = typeof emailSessions.$inferSelect;
export type InsertEmailSession = typeof emailSessions.$inferInsert;

/**
 * Win Strategy（IBM Blue Sheet 简化版）
 */
export const winStrategies = mysqlTable("win_strategies", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull().unique(),              // 一个客户一条记录
  bizObjective: text("bizObjective"),                        // 客户业务目标（CEO/CFO 级别）
  valueProposition: text("valueProposition"),                // 我们的价值主张（量化业务成果）
  competitorSummary: text("competitorSummary"),              // 竞争态势摘要
  winStrategy: text("winStrategy"),                          // 赢单策略（SAM 填写）
  keyMilestones: text("keyMilestones"),                      // 关键里程碑（每行一条）
  riskAndMitigation: text("riskAndMitigation"),              // 风险与应对
  aiSuggestion: text("aiSuggestion"),                        // AI 生成的 Win Strategy 建议
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type WinStrategy = typeof winStrategies.$inferSelect;
export type InsertWinStrategy = typeof winStrategies.$inferInsert;

/**
 * 客户效能基线数据（Metrics 结构化字段，用于 Champion 弹药 ROI 测算）
 */
export const clientMetrics = mysqlTable("client_metrics", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull().unique(),
  securityTeamSize: int("securityTeamSize"),                        // 安全团队人数
  mttr: int("mttr"),                                                // 平均威胁响应时间（小时）
  annualComplianceCost: int("annualComplianceCost"),                // 年度合规成本（万元）
  lastBreachYear: int("lastBreachYear"),                            // 最近一次安全事件年份
  currentVendors: text("currentVendors"),                           // 现有安全厂商（逗号分隔）
  contractRenewalDate: timestamp("contractRenewalDate"),            // 现有合同到期时间
  itBudgetRange: varchar("itBudgetRange", { length: 50 }),          // IT 年度预算区间（如 "500-1000万"）
  additionalNotes: text("additionalNotes"),                         // 补充说明
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ClientMetric = typeof clientMetrics.$inferSelect;
export type InsertClientMetric = typeof clientMetrics.$inferInsert;

/**
 * 飞书机器人待确认记录（持久化，避免 serverless 冷启动后内存丢失）
 */
export const feishuPendingRecords = mysqlTable("feishu_pending_records", {
  id: varchar("id", { length: 32 }).primaryKey(), // pendingId
  clientId: int("clientId").notNull(),
  clientName: varchar("clientName", { length: 100 }).notNull(),
  contactType: varchar("contactType", { length: 50 }).notNull(),
  initiatedBy: varchar("initiatedBy", { length: 20 }).notNull(),
  keyPoints: text("keyPoints").notNull(),
  attendees: varchar("attendees", { length: 200 }),
  openId: varchar("openId", { length: 100 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(), // 1小时后过期
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  rawText: text("rawText"), // 原始消息文本，用于修改时重新解析
  awaitingClient: tinyint("awaitingClient").default(0), // 1=等待SAM补充客户名
});
export type FeishuPendingRecord = typeof feishuPendingRecords.$inferSelect;
export type InsertFeishuPendingRecord = typeof feishuPendingRecords.$inferInsert;

/**
 * Win Strategy 版本历史（每次 AI 生成保留一条，不覆盖）
 */
export const winStrategyHistory = mysqlTable("win_strategy_history", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  opportunityId: int("opportunityId"),
  aiSuggestion: text("aiSuggestion").notNull(),
  stage: varchar("stage", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type WinStrategyHistory = typeof winStrategyHistory.$inferSelect;
export type InsertWinStrategyHistory = typeof winStrategyHistory.$inferInsert;

/**
 * 产品配置表 — 可配置的产品列表，用于产品覆盖度看板
 */
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),        // 中文名，如 "威胁情报"
  nameEn: varchar("nameEn", { length: 100 }),              // 英文名，如 "Threat Intelligence"
  shortCode: varchar("shortCode", { length: 20 }),         // 缩写，如 "TI"
  description: text("description"),
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: tinyint("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;
