# T100 专项 AI 作战指挥系统 TODO

## 数据库 & 后端
- [x] 设计并创建数据库 schema（clients, meddpicc, signals, actions, meetings, champions, pod_tasks, deal_reviews）
- [x] 创建 tRPC routers（clients, intelligence, actions, insights, champions, pod, meetings, prediction）
- [x] 种入5户客户初始数据（美的、大疆、荣耀、传音、华大基因）

## 前端核心布局
- [x] 设计深色专业风格主题（index.css）
- [x] CommandLayout 侧边栏导航（8个模块入口）
- [x] 角色切换器（AD / SAM / SA）
- [x] App.tsx 路由注册

## 功能模块
- [x] 战场地图：MEDDPICC 可视化看板（5户客户卡片 + 进度条 + 状态更新）
- [x] AI情报雷达：关键词配置 + 信号输入 + AI解读 + 触达建议
- [x] AI行动指令台：基于MEDDPICC状态由AI生成今日/本周行动清单
- [x] AI洞察生成：1-Pager 高层会面简报生成（LLM调用）
- [x] Champion弹药库：竞品对标/合规风险/ROI测算材料生成
- [x] POD协同中枢：AD/SAM/SA 三角色独立任务视图 + Deal Review记录
- [x] 会后纪要AI生成：输入关键信息点 → AI生成结构化纪要
- [x] 商机温度预测：MEDDPICC完成度 + 信号频率 → AI健康度评分 + 风险预警

## 测试
- [x] 数据库 CRUD 测试（12 tests passing）
- [x] LLM 调用 router 测试（mocked）

## 新增功能（Round 2）
- [x] 新增 key_contacts 数据库表（关键人图谱）
- [x] 新增 contacts tRPC router（list/create/update/delete）
- [x] 战场地图：客户卡片嵌入关键人图谱子模块（展示+编辑）
- [x] 战场地图：录入5家客户高管初始数据
- [x] AI情报雷达：模拟抓取外部新闻按钮（自动生成5条测试新闻+AI解读）
- [x] AI行动指令台：一键采纳并分配功能（分配给对应角色任务队列）
- [x] AI行动指令台：导出为PDF功能

## 新增功能（Round 3）
- [x] 商机温度预测：一键全部评分按钮（并行对5户客户调用LLM评分）
- [x] 商机温度预测：横向对比图（雷达图/柱状图，5户客户评分对比）
- [x] 战场地图：关键人图谱加关系状态标签（已接触/待接触/已拒绝）
- [x] 战场地图：关键人图谱建图进度统计（已接触N/总N人）
- [x] POD协同中枢：本周战报AI摘要（LLM汇总5户客户上周进展）
- [x] 本周战报：后端router支持生成战报摘要

## 新增功能（Round 4）
- [x] 战场地图：关键人图谱完整度预警（缺 Economic Buyer / Champion 时显示红色警告）
- [x] AI行动指令台：历史行动回顾标签页（已完成行动时间轴）
- [x] 会后纪要：一键发送飞书 Webhook
- [x] 销售易 CRM 集成：配置页面（client_id/secret/用户名/密码）
- [x] 销售易 CRM 集成：商机数据同步推送
- [x] 销售易 CRM 集成：关键人（联系人）数据同步推送

## 新增功能（Round 5）
- [x] 销售易 CRM 反向同步：从销售易拉取商机列表并展示
- [x] 销售易 CRM 反向同步：与本地 MEDDPICC 数据对比视图
- [x] 战场地图：MEDDPICC 变化趋势图（4周折线图，每户客户）
- [x] MEDDPICC 历史快照表（每次保存时记录分值快照）
- [x] 每日简报飞书推送：定时任务后端（每早8点 AI 汇总推送）
- [x] 每日简报飞书推送：前端配置页（Webhook URL + 开关）
- [x] 每日简报：Heartbeat cron 路由注册（/api/scheduled/daily-briefing）
- [x] systemConfig 数据库表 + tRPC router（读写系统配置）

## 新增功能（Round 6）
- [x] 武器库（Arsenal）数据库 schema：3张表（arsenal_weapons/arsenal_attachments/arsenal_pricing）
- [x] 武器库后端 tRPC router：CRUD + S3文档上传 + 报价管理
- [x] 武器库前端页面：5分类标签页（产品/方案/弹药/话术/报价单）+ 武器卡片 + 文档上传 + 报价视图
- [x] 预置17件武器（产品类5/方案类3/弹药类4/话术类4/报价单类1）
- [x] 预置9条报价层级（AIStorm全线产品定价）
- [x] 五家目标客户 35+位关键决策人写入数据库
- [x] 亚信安全标注0号演示客户（智谱科技攻单场景）
- [x] 全系统 MEDDPICC 术语 Tooltip 标注
- [x] EMT彩排：修复商机温度预测 React Hooks 违规 Bug

## 武器库重构（Round 7）
- [x] 精读 AIStorm ListPrice 所有子表，提取真实美金价格
- [x] 数据库：新增 product_docs 表（文档仓库）、arsenal_generated 表（AI生成记录）、quote_items/quotes 表（报价单）
- [x] 后端：产品文档 S3 上传/列表/删除接口
- [x] 后端：AI生成工作台接口（读取已上传文档内容 → LLM生成定制方案/弹药/话术）
- [x] 后端：报价单接口（ListPrice数据查询 + 折扣计算 + 生成报价单）
- [x] 前端：产品类 → 文档仓库（上传/预览/删除）
- [x] 前端：方案/弹药/话术类 → AI生成工作台（需求输入 + 文档选择 + AI生成 + 历史记录）
- [x] 前端：报价单 → 报价工具（产品搜索 + 数量 + 折扣 + 自动计算 + 导出）
- [x] 写入真实 ListPrice 数据（美金）

## 连续迭代（Round 8）
- [x] MEDDPICC国际标准打分（阶梯选择器 0/25/50/75/100）
- [x] MEDDPICC 追加式作战日志（每条记录含角色+时间戳）
- [x] 战场地图 AI建议按鈕（综合武器库+情报信号+MEDDPICC薄弱维度）
- [x] 情报→行动指令联动（修复信号原文传入AI prompt bug）
- [x] Champion弹药库知识优先级（武器库文档>通用知识，标注来源）
- [x] 会后纪要→MEDDPICC同步（AI建议面板+一键同步到战场地图）
- [x] 修复 MeetingMinutes.tsx TypeScript 错误（3个）
- [x] 商机温度预测（Step 12）验证通过

## 客户管理功能（Round 9）
- [x] 后端：db.ts 新增 insertClient / deleteClientCascade 函数（级联删除所有关联数据）
- [x] 后端：routers.ts 新增 clients.create / clients.delete 接口
- [x] 前端：战场地图顶部新增「+ 新增客户」按鈕和「管理客户」入口
- [x] 前端：新增客户弹窗（名称/英文名/行业/优先级/阶段）
- [x] 前端：编辑客户弹窗（可修改所有基本信息字段）
- [x] 前端：删除客户确认弹窗（含级联删除警告）

## 新客户功能对齐（Round 10）
- [x] 后端：clients.create 后自动 insert 空 MEDDPICC 记录（保证 meddpicc.get 不返回 undefined）
- [x] 后端：clients.create 接受 hookTopic / securityAngle / monitorKeywords 字段
- [x] 前端：新增客户弹窗第二步展开“敲门砖 / 安全切入 / 监控关键词”输入框
- [x] 前端：编辑客户弹窗支持修改 hookTopic / securityAngle / monitorKeywords

## CSV 批量导入客户（Round 11）
- [x] 后端：clients.importBatch 接口（接收客户数组，批量 insert + 自动初始化 MEDDPICC）
- [x] 前端：战场地图「批量导入」按鈕
- [x] 前端：CSV 模板下载（含列说明注释行）
- [x] 前端：文件上传 → 客户端 CSV 解析 → 预览表格（含错误行高亮）
- [x] 前端：确认导入 → 调用 importBatch → 刷新客户列表

## 导航重构与拜访作战日志（Round 12）
- [x] 导航：按新顺序重排侧边栏（战场地图→情报雷达→AI洞察简报→拜访作战日志→行动指令台→POD中枢→Champion弹药库→武器库→商机健康度）
- [x] 导航：重命名"会后纪要生成"→"拜访作战日志"、"商机温度预测"→"商机健康度"、"AI情报雷达"→"客户情报雷达"、"AI洞察生成 1-Pager简报"→"AI洞察简报"
- [x] 拜访作战日志：支持粘贴大段文字（飞书妙记）或上传 TXT/MD 文件
- [x] 拜访作战日志：AI 解析提炼 MEDDPICC 各维度线索、敲门砖建议、安全切入点建议、关键人识别
- [x] 拜访作战日志：以"建议卡片"形式呈现 AI 解析结果，SAM 逐条确认/修改
- [x] 拜访作战日志：一键同步确认项到战场地图（更新 MEDDPICC + hookTopic + securityAngle）
- [x] 拜访作战日志：历史拜访记录按客户归档，形成作战时间线

## AI洞察简报战略建议摘要（Round 13）
- [x] 后端：onePager.generate 新增第二路 AI 调用，结构化提炼 hookTopic + securityAngle
- [x] 前端：简报结果区新增「战略建议摘要」高亮卡片（敲门砖 + 安全切入点各一行，含一键复制）
- [x] 前端：标注"基于公开情报的初始建议，拜访后请及时更新"

## 战略建议三项升级（Round 14）
- [x] 后端：insights.applyStrategy 接口（直接更新客户 hookTopic/securityAngle）
- [x] 后端：insights.generate 返回 hookTopicBasis/securityAngleBasis（依据说明）
- [x] 后端：meetings.generate 已返回 hookTopicSuggestion/securityAngleSuggestion，无需扩展
- [x] 前端：AI洞察简报摘要卡片"一键复制"→"一键应用"，点击直接写入战场地图
- [x] 前端：拜访作战日志提交后弹出"AI复盘建议"弹窗，展示重新提炼的建议，一键更新客户档案
- [x] 前端：敲门砖/安全切入点旁增加"查看依据"悬浮提示（Tooltip展示AI参考的具体对话内容）

## 战场地图拜访统计显示（Round 15）
- [x] 后端：clients.list 附带每个客户的拜访次数（visitCount）和最近拜访日期（lastVisitDate）
- [x] 前端：客户卡片显示拜访次数和最近拜访日期（零拜访时显示"未拜访"提示）

## P0提醒横幅与拜访频率健康度（Round 16）
- [x] 前端：战场地图顶部P0未拜访提醒横幅（显示未拜访 P0 客户数量，点击可快速跳转）
- [x] 后端：商机健康度评分增加拜访频率维度（超 30 天未拜访扣分，从未拜访扣更多）
- [x] 前端：商机健康度结果中展示拜访频率维度评分和说明

## 拜访计划与POD自动化（Round 17）
- [x] 清理信号维度残留（图表Bar、文案、前端si gnalCount/recentSignalTypes参数）
- [x] 数据库：clients表新增plannedFirstVisitDate字段
- [x] 后端：clients.update支持plannedFirstVisitDate字段
- [x] 前端：快速编辑面板增加"计划首次拜访日期"日期选择器
- [x] 前端：P0提醒横幅升级为"距计划拜访还有N天"倒计时（已设置日期时）
- [x] 前端：AI行动指令台对超30天未拜访客户自动追加"安排拜访"POD任务建议

## 交互增强（Round 18）
- [x] 销售阶段术语Tooltip：建图/进门/定痛/找人等专业术语鼠标悬浮显示解释
- [x] 四步流程可视化步骤条：战场地图顶部展示建图→进门→定痛→找人流程，点击节点展开实操指南
- [x] 敲门砖话题一键复制与收藏：快速编辑面板和客户卡片中的敲门砖话题支持一键复制，收藏的话术保存到本地

## 邮箱登录认证（Round 19）
- [x] 数据库：新增 email_users 表（邮箱/密码哈希/姓名/角色/状态）
- [x] 数据库：新增 email_sessions 表（token/userId/过期时间）
- [x] 后端：注册接口（仅允许 @aistorm.com 邮箱）
- [x] 后端：登录接口（验证密码，签发 session token）
- [x] 后端：登出接口
- [x] 后端：会话验证中间件（兼容邮箱会话）
- [x] 前端：登录/注册页面（/login 路由）
- [x] 前端：保护路由（未登录跳转 /login）
- [x] 前端：替换顶部 Manus OAuth 登录入口为邮箱用户信息

## 品牌重设计（Round 20）
- [x] 处理 Logo 为透明背景 PNG 并上传 CDN
- [x] 系统更名为 AIStorm Command（标题、侧边栏、登录页、浏览器 tab）
- [x] 全局 CSS 色彩变量更新为 AIStorm 品牌色系（深海蓝+青蓝+绿）
- [x] 重设计侧边栏：新 Logo、新色系、新名称
- [x] 重设计登录页：新 Logo、新色系、新名称
- [x] VITE_APP_TITLE 为内置字段，已通过 index.html 和页面直接更新

## Round 21 - 品牌微调 + 用户管理
- [x] 调亮侧边栏和登录页 Logo 文字颜色（透明度提升）
- [x] 新增管理员用户管理页面（查看所有用户、禁用/启用、修改 POD 角色）
- [x] 后端：新增 admin.listUsers / admin.toggleUser / admin.updateUserRole 接口

## Round 22 - 四项核心升级（HKT 灯塔客户场景）

### 1. 客户模型升级：活跃战线 Active Fronts
- [x] 数据库：新增 opportunities 表（子商机，含 clientId/name/stage/status/competitorName/notes）
- [x] 后端：opportunities tRPC router（list/create/update/delete）
- [x] 前端：战场地图客户卡片新增「活跃战线」 Tab，展示子商机列表（阶段/状态/竞品/对接人/预估金额）
- [x] 前端：子商机快速编辑（新增/编辑/删除）

### 2. 竞品阻击包 Kill Sheets
- [x] 数据库：新增 kill_sheets 表（竞品名/产品线/差异化要点/AI生成内容），并扩展新字段（ourAdvantages/keyDiffs/battleNotes/aiGeneratedTalk/clientId/competitorType）
- [x] 后端：kill_sheets tRPC router（list/create/update/delete/generateTalk）
- [x] 前端：武器库新增「竞品阻击包」标签页（Kill Sheets 列表 + AI 生成差异化话术卡）

### 3. 关键人图谱 AI 突破建议
- [x] 数据库：key_contacts 表新增 reportingTo/persona/breakthroughTip 字段
- [x] 后端：contacts.analyzeChain 接口（AI 分析汇报链路，生成关键人突破建议）
- [x] 前端：关键人图谱 Tab 新增「AI 关键人突破建议」按鈕，展示汇报链路 + 逐人快速认知对齐话术

### 4. POD 内部资源协调指令
- [x] 后端：actions.generateInternalCoord 接口（AI 生成对内协调任务）
- [x] 前端：AI 行动指令台新增「对内资源协调」按鈕，支持输入背景信息生成对内协调任务
- [x] 前端：对内协调任务卡片显示紫色「对内协调」标签，区分对外销售动作
- [x] 前端：任务采纳后自动流转到 POD 协同中枢

## Round 23 - 三项功能升级

### 1. 拜访日志竞品识别 + Kill Sheet 联动
- [x] 后端：meetings.generate AI prompt 增加竞品识别，返回 detectedCompetitors 字段
- [x] 后端：killSheets.listByCompetitors 接口（按竞品名数组模糊匹配返回 Kill Sheets）
- [x] 前端：拜访作战日志解析结果区域，若识别到竞品，自动查询并展示对应 Kill Sheet 话术卡片

### 2. 活跃战线商机总览看板
- [x] 前端：ActiveFrontsPanel 顶部增加总览数据看板（并行战线数/活跃商机数/预估总金额/各阶段分布徽章）

### 3. POD 协同中枢拖拽看板
- [x] 后端：pod_tasks 表新增 taskStatus 字段（pending/in_progress/done），并新增 updateTaskStatus 接口
- [x] 前端：POD 协同中枢增加「看板视图」切换（列表/看板图标），三列（待处理/进行中/已完成），支持拖拽更改任务状态

### 4. HKT 关键人录入
- [x] 录入 Ronald TK Lau（VP, Technical Services & Operations, IT）到 HKT 客户关键人图谱（客户 ID: 150001）
- [x] 录入 Ray KW Fung（Assistant Vice President, IT）到 HKT 客户关键人图谱，汇报关系指向 Ronald

## Round 24 - 系统整体升级重组

### 1. AD 指挥台（新增首页）
- [x] 数据库：无需新表，后端新增 dashboard.summary 聚合接口（客户阶段分布、MEDDPICC健康度、本周拜访统计、高风险预警、POD任务概览）
- [x] 前端：新增 /dashboard 页面，作为 AD 登录后的首页
- [x] 前端：阶段漏斗图（各阶段客户数量）
- [x] 前端：MEDDPICC 健康度矩阵（所有客户横向对比）
- [x] 前端：高风险预警列表（分数低于阈値 + 超30天未拜访的P0客户）
- [x] 前端：本周拜访 vs 计划拜访统计
- [x] 前端：POD 团队任务概览（各角色待处理数量）

### 2. Win Strategy Tab（战场地图客户卡片新增）
- [x] 数据库：新增 win_strategies 表（clientId/bizObjective/valueProposition/competitorSummary/winStrategy/aiSuggestion）
- [x] 数据库：key_contacts 表新增 stance 字段（支持/中立/反对/未知）
- [x] 后端：winStrategy tRPC router（get/upsert/generateAI）
- [x] 后端：contacts.update 支持 stance 字段
- [x] 前端：战场地图客户卡片新增 "Win Strategy" Tab（第6个Tab）
- [x] 前端：Win Strategy Tab 包含：客户业务目标/价値主张/竞争态势/AI生成Win Strategy建议/赢单关键因素/里程碑/风险应对
- [x] 前端：关键人图谱每个人增加立场标注（支持🟢/中立🟡/反对🔴/未知⚪），支持一键切换
- [x] 前端：四步阶段与MEDDPICC薄弱维度联动提示（不同阶段高亮对应缺口）

### 3. 导航重组
- [x] 前端：Champion弹药库已合并到武器库（新增"Champion弹药库"Tab，武器库共5个Tab）（新增"Champion弹药"Tab，原页面保留功能）
- [x] 前端：CRM集成和飞书推送已在设置区，不占用主导航（新增 /settings 页面）
- [x] 前端：导航重组：主导航9个，设置区3个（指挥台/战场地图/情报雷达/拜访日志/行动指令台/POD协同/武器库/商机健康度）
- [x] 前端：AD指挥台作为默认首页，登录后直接进入Portfolio Review看板，SAM/SA 登录后进入战场地图

## Round 25 — 商机级 IBM Blue Sheet + MEDDPICC 评分体系

- [x] Schema：新增 opportunity_meddpicc 表（8维评分，关联 opportunityId）
- [x] Schema：opportunities 表新增 Blue Sheet 字段（bizObjective/valueProposition/champion/competitorSummary/winStrategy/keyMilestones/riskAndMitigation）
- [x] 后端：opportunities.getMeddpicc / upsertMeddpicc 路由
- [x] 后端：opportunities.updateBlueSheet 路由（更新 Blue Sheet 字段）
- [x] 前端：活跃战线商机列表点击展开，显示 Blue Sheet + MEDDPICC 评分面板
- [x] 前端：MEDDPICC 8维评分选项制（0/25/50/75/100），显示进度条和薄弱维度高亮
- [x] 前端：Blue Sheet 字段编辑（业务目标/价值主张/Champion/竞品/赢单策略/里程碑/风险）
- [x] AD 指挥台：MEDDPICC 矩阵改为按商机维度聚合（显示每个商机的薄弱维度）
- [x] 数据：录入 HKT 6条商机的 MEDDPICC 分数和 Blue Sheet 数据

## Round 26 — 商机 MEDDPICC 选项制 + 智能聚合
- [x] 商机 MEDDPICC 改为选项制打分（0/25/50/75/100 五级，与客户级统一标准）
- [x] 客户整体 MEDDPICC 智能聚合：建图/进门 → 手动评分；定痛及以后 → 自动聚合商机均值
- [x] 客户卡片圆形分数显示修复（HKT 显示聚合均值 ~48%）

## Round 27 — 阶段体系重构
- [x] 客户阶段重构为 5 步：建图→进门→定痛→找人→进入商机
- [x] 商机阶段改为国际标准：Qualified→Discovery→POC→Proposal→Negotiation→Closed Won/Lost
- [x] MEDDPICC Tab 以「进入商机」为分界点智能切换

## Round 28 — 商机阶段全中文化
- [x] 商机阶段统一中文：初步需求→需求挖掘→技术验证→方案提案→商务谈判→赢单/丢单
- [x] 更新所有相关文件（schema/routers/BattleMap/ADDashboard/SalesPipelineSteps/ClientSelector/OpportunityPrediction/TermTooltip）

## Round 29 — 情报雷达真实 RSS 集成
- [x] 移除模拟新闻抓取功能，清除数据库模拟情报数据
- [x] 情报雷达改为真实 Google News RSS 抓取（按客户名称自动搜索）
- [x] 新增「用作信号」按钮（一键将新闻填入分析框）
- [x] 新增 rss_sources 数据库表（自定义 RSS 信息源管理）
- [x] 后端：rss.listSources / addSource / toggleSource / deleteSource / fetchNews 路由

## Round 30 — 系统设置页面
- [x] 新增「系统设置」统一配置页面（/settings），含 RSS 信息源 / 飞书推送 / CRM 集成 三个 Tab
- [x] 导航精简：settingsNavItems 将 /crm 和 /daily-briefing 合并为单一「系统设置」入口
- [x] 情报雷达空状态文字「设置」改为可点击链接，直接跳转 /settings

## Round 31 — AI分析缓存 + HKT商机数据完善
- [x] AD指挥台：latestScore加载后自动展开AI分析面板（无需重新触发）
- [x] HKT商机数据：为6条并行商机补充标准子阶段名称（初步需求/需求挖掘/技术验证/方案提案/商务谈判）
- [x] 数据库初始化：创建所有缺失的核心表（clients/meddpicc/opportunities/pod_tasks等）
- [x] 种子数据：录入5户T100客户基础数据（HKT/美的/大疆/荣耀/传音）
- [x] 种子数据：为HKT录入6条并行商机（含标准子阶段+MEDDPICC评分+关键联系人）

## Round 32 — AD指挥台修复 + 客户全屏视图
- [x] 修复AD指挥台高风险预警区MEDDPICC重影叠加问题（全面检查重复渲染）
- [x] 客户卡片改为全屏单客户详情视图（点击卡片进入独立页面，不再下拉展开）

## Round 39 - OP2文档全面对齐优化
- [x] 阶段门控逻辑：建图/进门/定痛/找人四步，每步有明确完成标准，未达标显示警告并提示缺口
- [x] 5户大湾区客户数据完善：美的/传音/大疆/荣耀/华大基因的关键人图谱、敲门砖、安全切入点、SPIN提问库
- [x] SPIN提问库：在战场地图客户卡片中独立展示预置SPIN问题（S/P/I/N四类，基于客户公开数据）
- [x] 48小时纪要提醒架构：拜访后48h无日志则触发飞书提醒（架构支持，配置入口在系统设置）
- [x] 季度数据导出：AD指挥台一键导出健康度报告/商机漏斗/MEDDPICC矩阵（Markdown/CSV格式）

## Round 41 — 系统优化（2026-07-27）

- [x] MEDDPICC面板：无DB记录的客户点不开评分维度 → 已修复（effectiveMeddpicc默认全0，始终可展开编辑）
- [ ] AI解析速度慢：拜访日志4个AI调用串行执行，需改为并行（第1个完成后2/3/4同时发起）
- [ ] MEDDPICC建议持久化：AI生成的更新建议页面刷新后消失，需存入DB（meetingMinutes表加meddpiccSuggestions字段），历史记录里随时可采纳
- [ ] 演示视频制作暂停：脚本V5和素材已保留在/home/ubuntu/videos/aistorm-command-demo/，待系统稳定后继续
- [x] AI解析速度慢（已修复，见上方记录）
- [x] MEDDPICC建议持久化（已确认不需要，见上方记录）
- [x] 演示视频制作暂停（保留素材，待后续继续）
- [x] AI解析速度慢：拜访日志4个AI调用串行执行 → 已修复（第2/3/4个改为Promise.all并行，第2个从gpt-5降为gpt-4o-mini）
- [x] MEDDPICC建议持久化：确认不需要持久化，建议是一次性判断，SAM应在录入后立即采纳

## Round 43 — Buying Group角色细化 + 情报信号商机关联（2026-07-27）
- [x] "信息来源"重命名为"内部线人"，区分与Champion的职能差异

## Round 42 — AD指挥台布局与业务异常检测优化（2026-07-27）
- [x] AD指挥台全屏布局重构：去掉max-w限制，改为5列grid，全宽展示
- [x] 1→N看板商机名称和阶段紧凑化：flex行内排列，阶段标签紧跟商机名
- [x] 0→1看板增加完整业务异常检测：无Champion/建图未拜访/汇报链路未摸清/失联/MEDDPICC滞后
- [x] 1→N看板增加完整业务异常检测：无行动分配/无拜访记录/无预算决策人/未填金额/无Champion/无关单日期/关单临近但阶段过早
- [x] 1→N看板增加关单日期、金额、Champion时间线信息显示
- [x] 后端新增关键人数量、最后拜访距今天数、POD任务关联等数据字段

## Round 43 — Buying Group角色细化 + 情报信号商机关联（2026-07-27）
- [x] 数据库：key_contacts表新增buyingRole字段（经济决策人/技术决策人/用户影响者/阻碍者/Champion/信息来源/未知）
- [x] 数据库：intelligence_signals表新增opportunityId和opportunityWindowNote字段
- [x] 后端：contacts.update/add支持buyingRole字段
- [x] 后端：intelligence.analyze支持opportunityId参数
- [x] 前端：关键人图谱编辑表单加Buying Group角色下拉
- [x] 前端：关键人卡片显示buyingRole彩色标签（阻碍者红色，经济决策人金色，Champion绿色等）
- [x] 前端：关键人Tab顶部Buying Group覆盖缺口分析（未覆盖经济决策人/技术决策人/Champion时显示警告）
- [x] 前端：情报雷达录入信号时可关联具体商机（下拉选择）
- [x] 前端：情报信号历史列表中已关联商机的信号显示"🎯商机窗口"标签

## Round 44 — 决策层覆盖率大盘 + 合规政策RSS（2026-07-27）
- [ ] 后端：dashboard.summary新增decisionLayerCoverage聚合数据（各客户C-Level角色覆盖情况）
- [ ] 前端：AD指挥台新增"决策层覆盖率"面板（全局C-Level触达率统计，按客户展示覆盖缺口）
- [ ] 系统设置：预置港澳+东南亚合规政策RSS源（PDPC Singapore/PDPA Thailand/PDPA Malaysia/PCPD HK/GPDP Macau/PDPA Indonesia/PDPA Philippines）
- [ ] 情报雷达：新增"合规政策"信号类型，合规政策RSS自动归类
- [x] 后端：dashboard.summary新增decisionLayerCoverage聚合数据（各客户C-Level角色覆盖情况）
- [x] 前端：AD指挥台新增"决策层覆盖率"面板（全局C-Level触达率统计，按客户展示覆盖缺口）
- [x] 系统设置：预置港澳+东南亚合规政策RSS源（PDPC Singapore/PDPA Thailand/PDPA Malaysia/PCPD HK/GPDP Macau/CSA Singapore/Google News合规动态）
- [x] 情报雷达：新增"合规政策"信号类型（紫色标签，Shield图标），合规政策RSS自动归类

## Round 44 — 决策层覆盖率大盘 + 合规政策RSS（2026-07-27）
- [ ] 后端：dashboard.summary新增decisionLayerCoverage聚合数据（各客户C-Level角色覆盖情况）
- [ ] 前端：AD指挥台新增"决策层覆盖率"面板（全局C-Level触达率统计，按客户展示覆盖缺口）
- [ ] 系统设置：预置东南亚合规政策RSS源（PDPC Singapore/PDPA Thailand/PDPA Malaysia/PCPD HK）
- [ ] 情报雷达：新增"合规政策"信号类型，合规政策RSS自动归类
