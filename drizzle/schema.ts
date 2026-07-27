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
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

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
  signalType: mysqlEnum("signalType", ["人事变动", "业务扩张", "合规事件", "招聘信号", "技术公告", "其他"]).notNull(),
  aiInterpretation: text("aiInterpretation"), // AI解读
  aiRecommendation: text("aiRecommendation"), // AI触达建议
  urgency: mysqlEnum("urgency", ["高", "中", "低"]).default("中").notNull(),
  isProcessed: boolean("isProcessed").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
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
});

export type PodTask = typeof podTasks.$inferSelect;
export type InsertPodTask = typeof podTasks.$inferInsert;

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
  influence: mysqlEnum("influence", ["决策者", "影响者", "Champion候选", "技术评估者", "信息来源"]).default("影响者"),
  relationship: mysqlEnum("relationship", ["待接触", "已识别", "初步接触", "已接触", "建立关系", "Champion", "已拒绝"]).default("待接触"),
  linkedinUrl: varchar("linkedinUrl", { length: 300 }),
  email: varchar("email", { length: 200 }),
  notes: text("notes"),
  reportingTo: varchar("reportingTo", { length: 100 }),      // 汇报上级姓名（用于构建汇报链路）
  stance: mysqlEnum("stance", ["支持", "中立", "反对", "未知"]).default("未知"), // 对项目的立场
  persona: text("persona"),                                  // AI 生成的人物画像摘要
  breakthroughTip: text("breakthroughTip"),                  // AI 生成的突破建议话术
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
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
  targetContact: varchar("targetContact", { length: 100 }),  // 目标联系人
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  /** 当前商机子阶段开始时间（每次阶段推进时更新）。用于计算商机停滞天数。 */
  stageChangedAt: timestamp("stageChangedAt").defaultNow().notNull(),
});
export type Opportunity = typeof opportunities.$inferSelect;
export type InsertOpportunity = typeof opportunities.$inferInsert;

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
