# T100 专项 AI 作战指挥系统 TODO

## Demo.html 截图逐页校对（历史归档，旧 Demo 已下线）
- [x] Slide 1：登录界面 ✅
- [x] Slide 2：管理困境信息图 ✅
- [x] Slide 3：7大方法论体系 + 战场地图拼接 ✅
- [x] Slide 4：建图阶段 ✅（用户确认）
- [x] Slide 5：进门阶段 ✅（用户确认）
- [x] Slide 6：定痛阶段 ✅（用户确认）
- [x] Slide 7：找人阶段 ✅（用户确认）
- [x] Slide 8：进入商机（框架切换）✅ + 阶段门控逻辑旁白
- [x] Slide 9：多条并行战线 MEDDPICC 矩阵 ✅ + 客户级汇总分聚合逻辑旁白
- [x] Slide 10：Blue Sheet 作战蓝图 ✅
- [x] Slide 11：MEDDPICC 维度细节 ✅
- [x] Slide 12：1→N AI Review ✅
- [x] Slide 13：SPIN 提问框架 ✅ + 解决问题和数据来源旁白
- [x] Slide 14：拜访作战日志 ✅
- [x] Slide 15：AI 分析结果 ✅
- [x] Slide 16：AI 洞察简报 ✅
- [x] Slide 17：快速 Review ✅
- [x] Slide 18：AI 行动指令台 ✅
- [x] Slide 19：客户情报雷达 ✅
- [x] Slide 20：武器库 Arsenal ✅
- [x] Slide 21：效能基线 ✅ + 解决问题和数据来源旁白
- [x] Slide 22：AD 指挥台全局视图 ✅
- [x] Slide 23：全局 Review ✅
- [x] Slide 24：SAM 教练 Review（数据）✅
- [x] Slide 25：SAM 教练 Review（AI 建议）✅
- [x] Slide 26：POD 协同中枢 ✅
- [x] Slide 27：四种角色（团队成员管理页）✅ + 权限隔离价值旁白
- [x] Slide 28：系统设置四图拼接 ✅ + 四项能力业务原因旁白
- [x] Slide 29：总结页 ✅

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
- [x] 后端：dashboard.summary新增decisionLayerCoverage聚合数据（各客户C-Level角色覆盖情况）
- [x] 前端：AD指挥台新增"决策层覆盖率"面板（全局C-Level触达率统计，按客户展示覆盖缺口）
- [x] 系统设置：预置港澳+东南亚合规政策RSS源（PDPC Singapore/PDPA Thailand/PDPA Malaysia/PCPD HK/GPDP Macau/CSA Singapore/Google News合规动态）
- [x] 情报雷达：新增"合规政策"信号类型（紫色标签，Shield图标），合规政策RSS自动归类

## Round 46 — 拜访日志删除功能（2026-07-27）
- [x] 后端：meetings.delete 接口（按 id 删除）
- [x] 前端：拜访日志历史列表每条记录右侧加删除按钮（垃圾桶图标），点击弹出确认对话框后删除

## Round 47 — 数据清理三项功能（2026-07-27）
- [x] 情报信号：后端 intelligence.delete 接口 + 前端历史列表单条删除按钮（垃圾桶图标+确认弹窗）
- [x] 关键人新增表单：补全 buyingRole 字段（Buying Group 角色选择器，默认"未知"）
- [x] 拜访日志：历史列表顶部全选复选框 + 批量删除按钮（后端 meetings.deleteBatch 接口）

## Round 48 — 批量删除扩展 + 拜访日志编辑（2026-07-27）
- [x] 后端：contacts.deleteBatch 接口（关键人批量删除）
- [x] 后端：intelligence.deleteBatch 接口（情报信号批量删除）
- [x] 后端：meetings.update 接口（拜访日志编辑，支持修改日期/类型/参会人/要点）
- [x] 前端：战场地图关键人列表顶部全选+批量删除（复选框+确认弹窗）
- [x] 前端：情报雷达历史信号列表顶部全选+批量删除（复选框+确认弹窗）
- [x] 前端：拜访日志每条记录添加铅笔编辑按钮，弹出编辑表单（日期/类型/参会人/要点）

## Round 49 — 武器库文档上传修复（2026-07-27）
- [x] 后端：新增 productDocs.getUploadUrl 预签名接口，支持任意大小文件
- [x] 后端：新增 productDocs.confirmUpload 接口，前端上传完成后写入数据库
- [x] 前端：Arsenal.tsx 改为前端直接 PUT 到 S3（三步流程：获取URL→直传→确认）
- [x] 前端：支持 PDF/PPT/PPTX/DOC/DOCX/XLS/XLSX/MP4/MOV/AVI，移除文件大小限制

## Round 50 — 武器库三项增强（2026-07-27）
- [x] 后端：productDocs.extractSummary 接口（AI 提取文档摘要和关键卖点）
- [x] 前端：上传进度条（XMLHttpRequest + onprogress，显示百分比）
- [x] 前端：PDF 在线预览（iframe Dialog，支持新窗口打开）
- [x] 前端：AI 摘要展示（上传完成后自动触发，卡片内显示摘要+关键卖点；手动触发按钮）

## Round 45 — 情报雷达RSS分离修复（2026-07-27）
- [x] 修复：合规政策RSS源（菲律宾NPC等）被混入客户专属新闻流 → fetchNews路由跳过tags含"合规政策"的RSS源
- [x] 新增：rss.fetchComplianceNews专用路由，只抓取tags含"合规政策"的RSS源
- [x] 前端：情报雷达底部新增"港澳+东南亚合规政策动态"折叠面板（紫色主题，Shield图标，可展开/收起，支持"用作信号"）
- [x] 客户专属新闻（外部新闻Tab）现在只显示Google News搜索结果，不再混入合规政策RSS

## AI 能力提升路线图（P0→P2→P1）
- [x] P0：AI洞察打通信息孤岛——自动拼装客户战况快照（阶段+拜访摘要+MEDDPICC薄弱项+情报信号）
- [x] P2a：数据库新增stage_entered_at字段（已有stageChangedAt，P2a已存在）（商机表）+ days_in_stage计算
- [x] P2b：关键人新增Champion三维评分字段（Access/Will/Credibility各1-3分）
- [x] P2c：关键人新增关系边字段（引荐路径 from→to）
- [x] P2d：客户档案新增relationship_narrative字段（200字滚动叙事）
- [x] P1a：0→1 Review功能（AD指挥台/战场地图）
- [x] P1b：1→N Review功能（MEDDPICC健康雷达+Blue Sheet战局判断+AI质疑层）
- [x] P1c：Buying Group覆盖分析（权力路径+Champion→EB路径完整性）
- [x] P1d：跨拜访趋势分析（滚动叙事架构+下次拜访建议）

## Round 54 - 模拟数据 + AI Review排版优化
- [x] 生成3个模拟客户测试数据（含关键人/拜访记录/MEDDPICC/商机）
- [x] 优化AI Review前端Markdown渲染排版（更具可读性）
- [x] P1e：情报自动关联推送（规则初筛+AI精判双层架构）

## Round 55 — 五入口 Review 体系完整实现

### L2：SAM 自 Review 结果持久化
- [x] 数据库：新增 ai_reviews 表（clientId/opportunityId/reviewType/content/createdBy/createdAt）
- [x] 后端：insights.saveReview 接口（保存 Review 结果）
- [x] 后端：insights.getLatestReviews 接口（按 clientId 返回各类型最新 Review）
- [x] 前端：Review 生成后自动保存到数据库
- [x] 前端：Dialog 显示生成时间戳 + "加载上次结果"按钮 + "复制全文"按钮

### 客户归属 SAM 字段
- [x] 数据库：clients 表新增 assignedSamId/assignedSamName 字段
- [x] 后端：clients.assignSam 接口（分配/取消分配 SAM）
- [x] 后端：clients.listSamUsers 接口（获取用户列表）
- [x] 前端：战场地图客户卡片显示负责 SAM 姓名，支持下拉分配

### AD 指挥台全局 Review（第五入口）
- [x] 后端：insights.globalReview 接口（全量数据聚合 + AI 五维分析）
- [x] 前端：AD 指挥台新增"🌐 全局 Review"按钮和 Dialog（ReactMarkdown 渲染 + 复制全文）

## Round 56 — AD Review SAM 教练视角 + SAM 筛选 + 全局 Review 图表

### Mock 数据生成
- [x] 为现有客户分配 SAM（使用系统中已有的用户账号）
- [x] 确保每个 SAM 至少负责 2-3 个客户，数据分布合理
- [x] 创建 TDH/Vivian Lu/Henry 三个 SAM 用户
- [x] 分配客户归属（TDH→5个国内客户，Vivian→香港电讯，Henry→星展银行/马来西亚石油/泰国中央百货）

### 战场地图 SAM 筛选
- [x] 战场地图顶部新增 SAM 筛选下拉（"全部 SAM" + 各 SAM 姓名）
- [x] 筛选后只显示该 SAM 负责的客户卡片
- [x] 筛选状态持久化（切换 Tab 不丢失）
- [x] 战场地图顶部新增 SAM 筛选 pill 按钮（全部/TDH/Vivian Lu/Henry/未分配）
- [x] 筛选后只显示对应 SAM 的客户卡片

### AD Review SAM 教练视角（第三/四入口）
- [x] 后端：insights.samCoachReview 接口（跨商机聚合分析单个 SAM 的能力模式）
- [x] 后端分析维度：MEDDPICC 各维度均分、阶段推进速度、Champion 找人质量、赢单率 vs 团队基准
- [x] 前端：AD 指挥台新增"SAM 教练 Review"入口（按 SAM 选择 + 生成报告）
- [x] 前端：教练 Review 结果包含 SAM 能力雷达图 + AI 文字诊断 + 辅导建议
- [x] 后端：insights.samCoachReview 接口（MEDDPICC均分/赢单率/Champion质量/拜访频率聚合分析）
- [x] 前端：AD 指挥台新增"👨‍🏫 SAM 教练 Review"按钮 + SAM 选择器下拉
- [x] 前端：教练 Review Dialog 含能力摘要卡片 + MEDDPICC 雷达图 + 维度进度条 + AI 诊断报告

### AD 全局 Review 图表可视化
- [x] 漏斗健康度：各阶段客户数量横向条形图
- [x] 资源优先级：P0/P1/P2 客户 MEDDPICC 均分气泡图或散点图
- [x] MEDDPICC 团队均分：8维度雷达图（显示团队系统性短板）
- [x] 全局 Review Dialog 中图表与 AI 文字分析并排展示
- [x] 漏斗健康度：各阶段横向条形图（彩色分阶段）
- [x] 资源优先级：P0/P1/P2 MEDDPICC 均分对比柱状图
- [x] MEDDPICC 团队均分：8维度雷达图
- [x] 全局 Review Dialog 图表 + AI 分析并排展示（宽屏 max-w-5xl）

### SAM 用户管理（增删改停用）
- [x] 后端：clients.createSamUser 接口（创建新 SAM/RSM 用户）
- [x] 后端：clients.updateSamUser 接口（改名/改角色/停用）
- [x] 后端：clients.deleteSamUser 接口（删除用户，自动清空其名下客户归属）
- [x] 前端：系统设置中新增"团队成员管理"页面（列表 + 增删改停用）
- [x] 前端：删除/停用 SAM 时，弹出"客户重新分配"对话框，批量将其名下客户转移给其他 SAM
- [x] 前端：SAM 姓名支持在管理页面直接修改（支持 TDH → 真实姓名的更名场景）
- [x] 后端：admin.createMember / updateMember / deleteMember / getMemberClients 接口
- [x] 前端：侧边栏新增"团队成员管理"页面（/team 路由）
- [x] 前端：支持增删改停用，删除时弹出客户归属重分配对话框
- [x] 前端：改名时自动同步更新 clients.assignedSamName（后端同步）

## Round 57 — RSM 字段 + 辅导建议下发 + 组合筛选

### RSM 字段展示与分配
- [x] 数据库：clients 表新增 assignedRsmId/assignedRsmName 字段
- [x] 后端：clients.assignRsm 接口（分配/取消分配 RSM）
- [x] 后端：clients.list 返回 assignedRsmName 字段
- [x] 前端：客户卡片展示负责 RSM，支持下拉分配（仅显示 RSM 角色用户）
- [x] 前端：战场地图支持按 RSM 筛选（与 SAM 筛选并列）
- [x] 数据库：clients 表新增 assignedRsmId/assignedRsmName 字段
- [x] 后端：clients.assignRsm 接口（分配/取消分配 RSM）
- [x] 前端：客户卡片展示负责 RSM，支持下拉分配（仅显示 RSM 角色用户）
- [x] 前端：RSM 分配与 SAM 分配并列显示在客户卡片

### AD 教练辅导建议下发
- [x] 数据库：coaching_actions 表（coachingId/clientId/samId/title/description/dueDate/isCompleted/createdBy/createdAt）
- [x] 后端：insights.createCoachingActions 接口（从教练 Review 中提取并保存 Action Items）
- [x] 后端：insights.listCoachingActions 接口（SAM 查询自己的辅导 Action Items）
- [x] 后端：insights.completeCoachingAction 接口（SAM 标记完成）
- [x] 前端：AD 教练 Review Dialog 底部新增"📋 下发辅导建议"按钮
- [x] 前端：下发后弹出 Action Items 编辑确认框（可调整标题/截止日期）
- [x] 前端：SAM 视图（战场地图/POD中枢）可见来自 AD 的辅导 Action Items
- [x] 数据库：coaching_actions 表创建完成
- [x] 后端：insights.createCoachingActions / listCoachingActions / listAllCoachingActions / completeCoachingAction / deleteCoachingAction 接口
- [x] 前端：AD 教练 Review Dialog 底部"📋 下发辅导建议"按钮
- [x] 前端：下发确认 Dialog（可编辑标题/描述/截止日期，支持增删）

### 战场地图组合筛选
- [x] 阶段筛选：0→1（建图/进门/定痛/找人）vs 1→N（进入商机）
- [x] 健康度筛选：健康（MEDDPICC均分≥60）/ 需关注（30-60）/ 高风险（<30）
- [x] 组合筛选：SAM × 阶段 × 健康度三维组合，实时显示命中数量
- [x] 筛选状态显示：当前激活的筛选条件 badge 展示，一键清除
- [x] 阶段筛选：0→1（建图/进门/定痛/找人）vs 1→N（进入商机）
- [x] 健康度筛选：健康(≥60) / 需关注(30-59) / 高风险(<30)
- [x] 组合筛选：SAM × 阶段 × 健康度三维组合，实时显示命中数量
- [x] 筛选状态：激活数量显示 + 一键清除全部筛选

## Round 58 — SAM 待办辅导建议 + 灵活角色分配 + AD 辅导跟进面板

### 角色分配逻辑优化（同一成员可在不同客户上担任不同角色）
- [x] 数据库：clients 表新增 assignedSamRole 字段（该客户上的 SAM 角色：SAM/RSM）
- [x] 后端：clients.assignSam 接口支持传入 role 参数（SAM 或 RSM）
- [x] 前端：客户分配下拉支持为每个成员选择"以 SAM 身份"或"以 RSM 身份"分配
- [x] 前端：客户卡片展示实际分配角色（而非固定显示 podRole）
- [x] 前端：RSM 分配下拉改为显示所有活跃用户（含 SAM/RSM/AD 角色标签），支持 Vivian/Henry 在国内客户上担任 RSM

### SAM 工作台待办辅导建议模块
- [x] 前端：SAM 工作台（POD 中枢或专属页面）新增"📋 待办辅导建议"卡片
- [x] 前端：展示 AD 下发的所有 Action Items（标题/描述/截止日期/下发时间/下发人）
- [x] 前端：SAM 可标记每条 Action Item 为已完成（带完成时间）
- [x] 前端：已完成和未完成分区展示，未完成优先显示
- [x] 前端：POD 中枢底部新增"📋 待办辅导建议"卡片
- [x] 前端：展示 AD 下发的 Action Items（标题/描述/截止日期/下发人/下发时间）
- [x] 前端：SAM 可点击圆圈标记完成（带完成时间），或点击"查看详情"弹窗
- [x] 前端：待完成/已完成分区展示，超期高亮红色

### AD 教练 Review 辅导跟进面板
- [x] 前端：AD 指挥台新增"辅导跟进"Tab 或独立面板
- [x] 前端：按 SAM 分组展示所有下发的 Action Items
- [x] 前端：每条 Action Item 显示状态（待完成/已完成）、完成时间、是否超期
- [x] 前端：整体进度统计（各 SAM 完成率 + 超期数量）
- [x] 前端：AD 指挥台底部新增"辅导跟进面板"
- [x] 前端：按 SAM 分组展示所有 Action Items，含进度条（完成率）
- [x] 前端：每条 Action Item 显示状态/完成时间/超期警告
- [x] 前端：顶部整体统计（总计/完成/超期/整体完成率进度条）

## Round 59 — 权限架构 + 团队管理客户分配 + 武器库技术方案

### 权限架构（角色隔离）
- [x] 后端：clients.list 按登录角色过滤（AD=全部，SA=全部只读，SAM/RSM=assignedSamId=自己 OR assignedRsmId=自己）
- [x] 前端：侧边栏按角色隐藏 AD 专属入口（AD 指挥台、系统设置、团队成员管理、用户管理）
- [x] 前端：战场地图"新增客户"按钮仅 AD 可见
- [x] 前端：战场地图 SAM/RSM 筛选行仅 AD 可见
- [x] 前端：战场地图移除客户卡片上的 SAM/RSM 分配下拉（改到团队管理）

### 团队管理升级（客户分配视图）
- [x] 前端：团队成员管理新增"客户分配"Tab
- [x] 前端：选择成员后显示其当前负责的客户列表（SAM 身份 + RSM 身份分开展示）
- [x] 前端：支持在此视图中为客户分配/更换 SAM 和 RSM

### 武器库优化（技术方案生成入口）
- [x] 前端：武器库已有"方案类"（技术方案）选项，覆盖 SA 使用场景，无需额外入口
- [x] 后端：arsenal.generateContent 接口已支持方案类生成

## AI 能力升级（Round 60）
- [x] 修正功能8：敲门砖建议读取4类数据源（本次摘要+情报信号+行业阶段+武器库文档）
- [x] 修正功能4：拜访趋势分析改用滚动叙事架构（前N-2次压缩+最近2次完整日志）
- [x] 修正功能10：Champion弹药读取武器库相关文档摘要+效能基线数据
- [x] 数据模型：拜访日志表新增 contactType/initiatedBy/entrySource 字段
- [x] 数据模型：关键人表新增 informalContactCount/customerInitiatedCount/hasWhatsapp/hasFeishu/lastInformalContact 字段
- [x] 数据模型：新增 client_metrics 表（效能基线）
- [x] 前端：拜访录入表单新增接触类型选择（5项快速录入最小集）
- [x] 前端：客户详情页新增效能基线录入区
  - [x] 前端：Champion三维评分加入非正式接触校验逻辑

## P1 阶段（Round 61）
### 飞书机器人接入
- [x] 后端：新增 /api/feishu/webhook 接收飞书消息机器人事件
- [x] 后端：AI 解析自然语言消息，提取客户名/接触类型/关键信息
- [x] 后端：推送飞书确认卡片（交互式卡片，SAM 点击确认后写入数据库）
- [x] 前端：系统设置中新增飞书机器人配置入口（App ID/Secret）

## 新增功能（2026-08-02）
  - [x] 隐藏登录页「注册账号」Tab，改为管理员开通提示
  - [x] 后端：emailUsers 表新增 lastLoginAt 字段，登录时记录
  - [x] 后端：SAM 自助修改密码接口（emailAuth.changePassword）
  - [x] 后端：批量重新分配客户接口（admin.bulkReassignClients）
  - [x] 前端：团队成员管理表格新增「最后登录」列
  - [x] 前端：批量重新分配客户 UI（选择源SAM + 目标SAM）
  - [x] 前端：SAM 个人资料页/侧边栏底部新增「修改密码」入口
### 关系深度矩阵
- [x] 前端：关键人卡片展示非正式接触次数/客户主动发起次数/渠道标签
- [x] 前端：客户主动发起信号用特殊颜色高亮（⭐ 标识）
- [x] 前端：关键人列表新增快速更新非正式接触数据的入口
### AD 数据缺口可视化
- [x] 后端：新增 insights.dataGapReport 接口（统计各客户缺失的关键数据维度）
- [x] 前端：AD 指挥台新增"数据健康度"面板，展示哪些客户缺少关键数据
- [x] 前端：系统设置中新增飞书机器人配置入口（App ID/Secret）（已通过环境变量注入，无需UI配置）
- [x] 为现有客户分配 SAM（使用系统中已有的用户账号）
- [x] 确保每个 SAM 至少负责 2-3 个客户，数据分布合理
- [x] 战场地图顶部新增 SAM 筛选下拉（"全部 SAM" + 各 SAM 姓名）
- [x] 筛选后只显示该 SAM 负责的客户卡片
- [x] 筛选状态持久化（切换 Tab 不丢失）
- [x] 后端：insights.samCoachReview 接口（跨商机聚合分析单个 SAM 的能力模式）
- [x] 后端分析维度：MEDDPICC 各维度均分、阶段推进速度、Champion 找人质量、赢单率 vs 团队基准
- [x] 前端：AD 指挥台新增"SAM 教练 Review"入口（按 SAM 选择 + 生成报告）
- [x] 前端：教练 Review 结果包含 SAM 能力雷达图 + AI 文字诊断 + 辅导建议
- [x] 漏斗健康度：各阶段客户数量横向条形图
- [x] 资源优先级：P0/P1/P2 客户 MEDDPICC 均分气泡图或散点图
- [x] MEDDPICC 团队均分：8维度雷达图（显示团队系统性短板）
- [x] 全局 Review Dialog 中图表与 AI 文字分析并排展示
- [x] 后端：clients.createSamUser 接口（创建新 SAM/RSM 用户）
- [x] 后端：clients.updateSamUser 接口（改名/改角色/停用）
- [x] 后端：clients.deleteSamUser 接口（删除用户，自动清空其名下客户归属）
- [x] 前端：系统设置中新增"团队成员管理"页面（列表 + 增删改停用）
- [x] 前端：删除/停用 SAM 时，弹出"客户重新分配"对话框，批量将其名下客户转移给其他 SAM
- [x] 前端：SAM 姓名支持在管理页面直接修改（支持 TDH → 真实姓名的更名场景）
- [x] 数据库：clients 表新增 assignedRsmId/assignedRsmName 字段
- [x] 后端：clients.assignRsm 接口（分配/取消分配 RSM）
- [x] 后端：clients.list 返回 assignedRsmName 字段
- [x] 前端：客户卡片展示负责 RSM，支持下拉分配（仅显示 RSM 角色用户）
- [x] 前端：战场地图支持按 RSM 筛选（与 SAM 筛选并列）
- [x] 数据库：coaching_actions 表（coachingId/clientId/samId/title/description/dueDate/isCompleted/createdBy/createdAt）
- [x] 后端：insights.createCoachingActions 接口（从教练 Review 中提取并保存 Action Items）
- [x] 后端：insights.listCoachingActions 接口（SAM 查询自己的辅导 Action Items）
- [x] 后端：insights.completeCoachingAction 接口（SAM 标记完成）
- [x] 前端：AD 教练 Review Dialog 底部新增"📋 下发辅导建议"按钮
- [x] 前端：下发后弹出 Action Items 编辑确认框（可调整标题/截止日期）
- [x] 前端：SAM 视图（战场地图/POD中枢）可见来自 AD 的辅导 Action Items
- [x] 阶段筛选：0→1（建图/进门/定痛/找人）vs 1→N（进入商机）
- [x] 健康度筛选：健康（MEDDPICC均分≥60）/ 需关注（30-60）/ 高风险（<30）
- [x] 组合筛选：SAM × 阶段 × 健康度三维组合，实时显示命中数量
- [x] 筛选状态显示：当前激活的筛选条件 badge 展示，一键清除
- [x] 数据库：clients 表新增 assignedSamRole 字段（该客户上的 SAM 角色：SAM/RSM）（通过 RSM 字段实现）
- [x] 后端：clients.assignSam 接口支持传入 role 参数（SAM 或 RSM）（通过独立 assignSam/assignRsm 接口实现）
- [x] 前端：客户分配下拉支持为每个成员选择"以 SAM 身份"或"以 RSM 身份"分配（团队管理分配 Tab 实现）
- [x] 前端：客户卡片展示实际分配角色（而非固定显示 podRole）（卡片展示 SAM/RSM 字段）
- [x] 前端：SAM 工作台（POD 中枢或专属页面）新增"📋 待办辅导建议"卡片
- [x] 前端：展示 AD 下发的所有 Action Items（标题/描述/截止日期/下发时间/下发人）
- [x] 前端：SAM 可标记每条 Action Item 为已完成（带完成时间）
- [x] 前端：已完成和未完成分区展示，未完成优先显示
- [x] 前端：AD 指挥台新增"辅导跟进"Tab 或独立面板
- [x] 前端：按 SAM 分组展示所有下发的 Action Items
- [x] 前端：每条 Action Item 显示状态（待完成/已完成）、完成时间、是否超期
- [x] 前端：整体进度统计（各 SAM 完成率 + 超期数量）

## AI 数据源精确性修复（Round 62）
- [x] 功能8修正：敲门砖建议的情报信号改为7天内过滤（原来取最新3条不管时效，现在先过滤7天内再取3条）
- [x] 功能3修正：Buying Group 分析 prompt 注入关系深度矩阵（非正式接触次数/客户主动发起次数/私信渠道/深度评级）

## 成功案例库（Round 63）
- [x] 数据库新增 case_studies 表（行业/规模/地区/痛点/方案/量化结果/ROI亮点/保密标记）
- [x] 后端 CRUD 接口（list/create/update/delete）
- [x] 功能8（敲门砖建议）注入同行业成功案例（最多2条），同行业情报信号兜底逻辑
- [x] 武器库页面新增"成功案例库"Tab（增删改查，行业筛选，保密标记）

## P2 体验完善（Round 64）
- [x] P2 QuickReview 历史记录入口：右侧折叠面板展示历史 Review 列表（按类型颜色标签，点击加载内容）
- [x] P2 每日简报个人推送：每日简报页面新增「立即生成并推送」按钮，AI 生成后同时推送到个人通知
- [x] P2 每日简报个人推送：后端 dailyBriefing.ts 在飞书推送成功后自动调用 notifyOwner 推送个人通知
- [x] P2 后端新增 insights.triggerDailyBriefing 接口（手动触发，生成简报并推送个人通知）

## Demo 保护与分发系统（Round 65）
- [x] 数据库新增 demo_tokens 表（token/recipientName/recipientEmail/note/isActive/expiresAt/accessCount/lastAccessAt/lastAccessIp/createdAt）
- [x] 后端 demoAccess tRPC router（listTokens/createToken/revokeToken/deleteToken，均为 adminProcedure）
- [x] Express GET /demo.html 路由升级为 token 验证（无 token→403，无效→403，过期→403，有效→注入水印信息并记录访问）
- [x] demo.html canvas 动态水印（读取 window.__DEMO_VIEWER__ 显示查看者姓名+邮箱+时间戳，半透明斜排）
- [x] DemoAccess.tsx 页面（AD 专用，生成/撤销/删除 token，查看访问次数和最后访问时间/IP）
- [x] App.tsx 注册 /demo-access 路由
- [x] CommandLayout.tsx 设置区新增「Demo 分发管理」导航入口（仅 admin 可见）
- [x] demo.html 精确截图替换（25 张 Mulerun 精确截图 base64 嵌入，覆盖 slide-01/04-27）

## 产品覆盖度看板（Round 67）
- [x] 数据库：新增 products 配置表 + opportunities.productId 外键字段
- [x] 后端：products CRUD router（list/listActive/create/update/delete）
- [x] 后端：products.clientCoverage 查询接口（按客户聚合商机产品覆盖状态）
- [x] 系统设置：新增「产品管理」标签页（增删改启停 8 个产品）
- [x] 客户详情页：expanded 面板顶部加产品覆盖状态栏（已签约/跟进中/未覆盖三色标签）
- [x] 商机编辑/新增表单：加「关联产品」下拉框
- [x] 初始化 8 个产品数据（TrustOne/CloudGuard/ThreatTrace/PhishShield/ThreatShield/AI XDR/威胁情报/智能体身份安全）

## 培训包动态水印下载（Round 66）
- [x] 后端 GET /api/download-pdf/:type 接口（cards/manual，验证 admin session，用 pdf-lib 动态叠加斜排半透明水印）
- [x] 原始 PDF 上传到 webdev 静态存储（cards: main_fa5b30eb.pdf，manual: main_732bfb87.pdf）
- [x] DemoAccess 页面每条 token 记录旁新增「下载卡片」按钮（蓝色下载图标），点击下载带接收人姓名水印的 PDF

## AI 创新产品说明书（亚信 2026 年中大会 Workshop）
- [x] 解析 Workshop 提交模板的字段、评分要求与格式约束
- [x] 基于 AIStorm Command 已实现能力撰写产品说明书，明确现状与规划边界
- [x] 生成并核验可编辑的 DOCX 提交文件

## AI 创新产品说明书 Demo 演示
- [x] 设计 5—10 分钟真实操作演示主线，避免功能堆砌
- [x] 编写逐分钟操作分镜、口播与真实数据展示口径
- [x] 整理录屏前数据准备、界面状态和妙记提交清单

## Workshop Demo 测试数据清理
- [x] 导出删除前客户与关联经营数据核对清单
- [x] 删除马来西亚国家石油公司和泰国中央百货集团及其关联测试数据
- [x] 保留香港电讯全部经营数据；其他客户仅保留基本信息与关键人图谱
- [x] 验证清理后的客户、关键人和系统页面展示范围

## 香港电讯产品覆盖度
- [x] 盘点香港电讯现有商机与产品关联状态
- [x] 将 Darktrace 替代方案关联 ThreatTrace
- [x] 从武器库确认 AI Pentest 的正式产品归属后完成关联
- [x] 验证客户详情的产品覆盖状态栏（3 项活跃产品关联符合前端跟进中判定）
- [x] 移除非核心产品的 Mobile Security Platform 测试商机及关联记录

## 香港电讯 AI Pentest 产品归属
- [x] 核对武器库 HKT Pentest 专项文档与“安全服务”产品线归属
- [x] 将 AI Pentest AI 渗透测试商机关联到安全服务产品线
- [x] 复核香港电讯产品覆盖聚合包含安全服务
- [x] 在产品配置中新增“安全服务 / Security Services”，以承载渗透测试等服务型商机

## HKT EDR 与 Virtual Patch 最新经营进展
- [x] 核对 EDR、Virtual Patch 现有商机、关键人和经营记录
- [x] 写入内部汇报、竞争结果、年度金额与关键人意见
- [x] 记录 Felix 异议及 Marcos—Felix 关系风险，更新 Buying Group 与赢单行动
- [x] 验证 HKT 商机数据和下一步行动在 Command 中可见
- [x] 更新 EDR、Virtual Patch 的 MEDDPICC 行为证据与决策风险说明
- [x] 删除过期的 HKT 测试行动项，并建立基于真实进展的行动任务

## HKT 关键人图谱补全
- [x] 逐项核对 Marcos、Ronald、Benny、Adrian、Ryan、Ray 与现有图谱
- [x] 新增 Felix（CISO）与 Susanna（CEO）并建立汇报关系
- [x] 补足关键人角色、立场、组织关系与 Marcos—Felix 风险说明
- [x] Tracy、Ray 与最终用户部门代表不作为 7 人关键人图谱节点；Ryan Lam LH 作为唯一 Ryan 节点
- [x] 验证 HKT 关键人图谱完整性与汇报链路展示

## HKT 关键人图谱七人纠正
- [x] 移除误建的 Ray 与 Tracy 独立关键人节点
- [x] 保留 Susanna、Marcos、Felix、Ronald、Benny、Adrian、Ryan 共 7 个节点
- [x] 验证商机经营信息仍保留 Ray 与 Tracy 提供的推进事实

## 武器库知识文档工作流
- [x] 核对现有单文件上传、产品文档和 AI 摘要实现
- [x] 支持在系统内新建可编辑知识文档
- [x] 支持一次选择多个文件并展示逐文件上传状态
- [x] 验证新建文档与批量上传后的武器库检索、预览和 AI 调用（类型检查与 14 项单测通过）

## 武器库新建知识文档存储错误
- [x] 定位生产环境新建文档的对象存储失败根因（对象路径包含中文，预签名接口仅接受 ASCII）
- [x] 修复知识文档的存储与产品文档索引写入（展示标题保留中文，存储键改为 ASCII）
- [x] 验证生产环境新建、预览和 AI 引用链路（用户已完成生产验证确认）
- [x] 确保新建知识文档的对象存储键仅使用 ASCII 字符，不包含中文标题

## 武器库文档子文件夹与归档
- [x] 支持新建、重命名和删除产品文档子文件夹
- [x] 支持在指定子文件夹内批量上传文件或新建知识文档
- [x] 支持将已上传文档拖拽或通过菜单移动到目标子文件夹
- [x] 验证文件夹归档后仍可预览、检索和供 AI 选择引用（用户已完成生产验证确认）

## 武器库登录态生产验收
- [x] 在登录态验证中文知识文档创建成功并可预览（用户已完成生产验证确认）
- [x] 在登录态验证新建文件夹、拖拽/菜单移动及文件夹内批量上传（用户已完成生产验证确认）
- [x] 在登录态验证已归档文档可被 AI 选择与引用（用户已完成生产验证确认）

## 客户作战台与商机作战室架构重构
- [x] 审计现有客户详情、商机组件、路由和数据依赖
- [x] 编制客户级与商机级信息边界、导航和迁移蓝图
- [x] 与用户确认架构蓝图和分阶段验收标准
- [x] 建设客户作战台：客户级概览、关键人、产品覆盖和关系态势
- [x] 建设独立商机作战室及全屏进入、返回路径
- [x] 迁移 MEDDPICC、Blue Sheet、Win Strategy、SPIN、AI Review 和行动工作流
- [x] 完成数据、权限、交互和回归测试
- [x] 明确方法论证据和 AI 判断只在商机上下文呈现，避免与客户级经营视图混排
- [x] 为每个客户级与商机级关键流程实现“AI 依据—判断—行动”可解释输出
- [x] 以 HKT EDR 验证 AI 原生流程在 Demo 中可被完整讲清
- [x] 排查并修复生产构建未包含独立客户与商机作战室路由的问题

## 旧版活跃战线模块精简
- [x] 审计战场地图“活跃战线”与新版客户/商机视图的全部重叠区域（生产验收通过）
- [x] 移除旧版客户展开态及商机详细清单，不保留兼容层（生产验收通过）
- [x] 移除旧版 MEDDPICC、Win Strategy、SPIN、效能基线等混合标签入口（生产验收通过）
- [x] 验证战场地图到客户作战台及商机作战室的新版导航回归（HKT 生产路径通过）

## 旧版客户展开深链接清除
- [x] 定位并移除 `/battle-map?clientId=...` 触发旧版客户展开态的路由分支
- [x] 移除遗留查询参数兼容分支；战场地图仅保留新版客户发现入口
- [x] 在生产环境验证旧链接不再展示混合详情页面

## 0→1 客户作战台与商机升级路径重新定义
- [x] 审计现有客户作战台对 0→1 阶段、客户级 MEDDPICC、Buying Group 与 SPIN 的覆盖缺口
- [x] 定义客户作战台的 0→1 阶段门控、必需证据与 AI 判断—行动结构
- [x] 定义从客户作战台创建并进入商机作战室的丝滑升级体验
- [x] 按确认的新方法论重构客户作战台和战场地图导航

## 已确认的 0→1 客户作战台落地
- [x] 实现“系统标准动作 + SAM 自定义任务”的阶段任务中心
- [x] 将客户级 MEDDPICC 改为证据语言与行为记录，不显示完成度或赢单得分
- [x] 使用可追溯行为事实实现“申请开商机”门控，禁止以主观兴趣判断放行
- [x] 进入商机后将客户作战台收敛为关系资产与商机入口，不再显示 0→1 发现工作区

## 购买信号门控重构
- [x] 将开商机门控改为意向主体、决策链触达与触发事件三项客户端事实
- [x] 为每项购买信号采集谁、何时、客户原话或外部事件等可追溯证据
- [x] 将三项购买信号事实快照带入商机作战室首屏，不携带产品方案假设
- [x] 完成测试与生产验收后同步最终代码至 GitHub main 分支供外部审核

## 战场地图发现层收敛
- [x] 将战场地图客户卡片精简为名称、阶段、负责人、最近触达、风险提示与客户作战台入口
- [x] 移除战场地图卡片中的 MEDDPICC、双阶段进度、AI Review、关键人和商机细节

## 前端版本刷新修复
- [x] 修复服务工作线程的静态缓存版本策略，确保发布后不再持续加载旧版界面

## 购买信号门控代码审阅修复
- [x] 实现高层直入商机的 AD 确认路径，要求两次高层拜访证据且不作为自动放行后门
- [x] 统一 `entryEvidenceSnapshot` 的 schema 类型与路由实际写入内容
- [x] 将决策链购买信号改为关联已入库关键人，消除姓名完全匹配导致的假阴性

## HKT 最新经营同步
- [x] 提取 SE 附件与 Vivian 周报中的新增 HKT 事实并与现有记录去重
- [x] 更新 Marcos 高层路径、Felix 风险化解与 David 备选牵线策略
- [x] 更新 Ray 预算上报、Jason B case 流程与采购衔接行动
- [x] 验证 HKT EDR 作战室中的经营纪要和行动闭环展示

## 高层直入拜访证据预检
- [x] 在选择拜访记录前显示所选高层姓名是否被记录检测到
- [x] 改进服务端高层拜访证据失败提示，列出实际有效与无效的记录
- [x] 完成回归测试并同步 GitHub 审阅修复版本

## AI 原生 AD 指挥台重构
- [x] 审计现有 AD 指挥台的全局 Review、客户分析、SAM 教练与行动任务数据契约
- [x] 定义首屏 AI 今日指令、异常预警和挂起确认的事实来源、判断与人类控制准则
- [x] 实现 AI 建议的持久化确认、跳过及 AD 作战任务闭环
- [x] 重构 AD 首屏，数据图表与 SAM 教练降级为按需展开的次级视图
- [x] 验证 0→1/1→N 客户卡片 AI 单句结论、SAM 能力预警和 GitHub 同步
- [x] 对事实不足客户显示“数据不足，暂不判断”，仅将有真实行动或证据的事项升级为 AD 指令

## 移除客户优先级标签
- [x] 审计并移除 AD 指挥台、战场地图和客户作战台中的 P0/P1/P2 客户标签
- [x] 将 AI 指挥建议从客户优先级排序改为事实、风险强度、行动时限和阶段排序
- [x] 验证客户列表与 AI 指令不再显示或依赖 P0/P1/P2

## 下线重构前旧 Demo
- [x] 移除旧 demo.html、旧 Demo 分发入口与演示访问管理页面
- [x] 清理旧 Demo 专属截图、音频和令牌分发代码，不影响真实系统数据
- [x] 验证旧 Demo URL 不再提供重构前的误导性内容（生产返回 410 下线响应）
- [x] 移除全部左侧导航、系统设置和页面内的 Demo 分发/管理按钮与路由
- [x] 移除 Demo 令牌数据库调用与相关后端接口，保留非 Demo 的真实系统功能
- [x] 清理项目根目录遗留的旧 Demo 生成、截图替换与演示重建脚本；后续不再执行任何 Demo 操作

## LLM 原生 AD 指挥研判
- [x] 审计规则建议、全局 Review 和 SAM 教练 LLM 逻辑的可复用边界
- [x] 对新生成的客户级与商机级建议调用 LLM，输出方法论判断和 AD 具体动作
- [x] 每周接入一次全局战场研判与 AD 本周三件行动
- [x] 为 SAM 教练卡增加按需生成、非持久化的 LLM 教练分析
- [x] 完成成本控制、回归测试、生产验收与 GitHub 同步

## 全局研判导航语义修复
- [x] 将“本周全局战场研判”卡片与单一客户解绑，并跳转战场地图

## 生产部署启动诊断
- [x] 增加不依赖数据库的 `/__startup` 启动探针与最早期启动环境日志
- [x] 在生产启动脚本显式校验 `dist/` 构建产物存在
- [x] 触发完整构建—部署并根据启动探针恢复生产域名（生产 dashboard 与 AD 指挥接口已恢复 200）

## LLM 原生全量战场研判升级
- [x] 审计原生快照所需的客户、拜访、购买信号、MEDDPICC 与商机事实数据
- [x] 实现 `adNativeAnalysis` 全量战场快照、结构化 LLM 输出与事实校验
- [x] 将 AD 刷新改为周度/重大事实增量触发的 LLM 主引擎，规则仅作失败兜底
- [x] 展示可折叠全局战场判断条及 AI 原生/规则来源徽章
- [x] 完成双轨观察、成本控制、生产验收与 GitHub 同步

## 后续功能与导航收敛队列（在原生研判完成后执行）
- [x] 将 ActionCommand 的行动建议并入客户作战台任务区域并移除独立入口
- [x] 删除 QuickReview 独立入口，将其 0→1/1→N Review 能力并入客户/商机作战台
- [x] 将 AIInsights 重定位为客户作战台内的“拜访前洞察”入口并移除主导航
- [x] 将 OpportunityPrediction 降级为商机作战室内的 AI 预测展开区域
- [x] 将 IntelRadar 缩减为客户作战台内的外部事件信号，RSS 整合进 DailyBriefing
- [x] 在商机作战室加入“生成武器”直达 Arsenal 的入口
- [x] 将 CRM 集成降级至系统设置，将 POD 中枢降为次级任务汇总入口
- [x] 收敛主导航至 AD 指挥台、战场地图、拜访作战日志、POD 协同、武器库和每日情报简报

## Command 2.0 升级（v2.0）
- [x] 审计现有原生研判、Review、方法论字段和 HKT 真实数据的差距，锁定第一批可交付边界
- [x] 新建统一销售方法论层，并让全部关键服务端 LLM 调用使用同一系统提示词与事实约束
- [x] 扩展全量战场原生研判：以 Win 公式、Account Map 与 Deal Map 识别风险，规则仅作失败兜底
- [x] 改写 0→1 Review、1→N Deal Review、SAM 教练、规则兜底研判与 MEDDPICC 真实性提示
- [x] 建立 Account Map、关系覆盖、3 Why、Pain & Metrics、竞争态势、Go/No-Go 数据模型及接口
- [x] 在客户作战台与商机作战室呈现 Account Map、覆盖矩阵、3 Why、商业价值和 Go/No-Go
- [x] 校准 Command 2.0 六项导航语义、完成 HKT 真实事实验收、生产发布与 GitHub 同步
- [x] 将 SALES_METHODOLOGY_SYSTEM_PROMPT 注入 routers.ts 中全部 LLM 调用点（31 处），消除独立 prompt 的事实约束不一致
- [x] 为高频场景（拜访前洞察、会议纪要解析、0→1 Review、1→N Review、Win Strategy）追加 Account/Deal Map 诊断层上下文注入
- [x] 为高频场景（拜访前洞察、会议纪要解析、0→1 Review、1→N Review、Win Strategy）追加 Account/Deal Map 诊断层上下文注入
- [x] 修复 Deal Health 硬编码 null：在原生快照和 1→N Review 中实际计算 11 维加权分数
- [x] 事件驱动自动刷新：拜访日志提交、购买信号录入、Go/No-Go 保存、MEDDPICC 变化后非阻塞触发单客户原生研判
- [x] 拜访前洞察注入 6 张表上下文：3 Why、Pain 年度价值、Go/No-Go 门控状态和最弱门控
- [x] MEDDPICC 录入时的 AI 证据挑战：Champion/EB ≥75 时 LLM 验证并返回挑战结论
- [x] Challenger Reframe 由 LLM 检测替换关键词匹配

## Command 3.0 角色原生化
- [x] 1-A SAM 拜访后结论卡：LLM 同步分析 Win 进展/MEDDPICC 建议/下次优先/风险预警，前端弹窗可采纳
- [x] 1-B SAM 首页分支渲染：按 podRole 显示"我的战场快照"而非 AD 看板
- [x] 1-C SAM AI Coach 自检：客户作战台内按需生成 3 个自我检测问题
- [x] 2-A/2-B SA 技术定标工作台：sa.getTechReadiness 接口 + PodCenter SA 角色视图
- [x] 3-A/3-B RSM 属地工作台：rsm.getLocalActionPlan 接口 + PodCenter RSM 角色视图
- [x] 4-A 商机作战室调兵入场：按阶段自动推荐 SA/RSM/SAM 介入并一键创建角色任务
- [x] 4-B Deal Review 后角色分工确认：LLM 提取分角色行动并创建 actionItems
- [x] 数据库迁移：meetingMinutes.aiPostAnalysis / opportunities.assignedSaId+Name / actionItems.sourceReviewId

## Command 3.0 Deal Review 行动闭环强化
- [x] 用 JSON Schema 结构化输出替代 1→N Review 的 Markdown 正则角色行动解析
- [x] 在商机作战室明确展示本次 Review 创建的角色任务数量与失败原因

## 运行时缺陷修复
- [x] 修复 SAM AI 自检 mutation 的 `require is not defined` ESM 运行时异常，并完成回归与生产验证

## 角色原生化后续边界（已确认）
- [x] 为 SA 与 RSM 建设主动式角色首页，优先呈现本周需其介入的商机与 AI 任务，而非仅增加 POD 被动过滤
- [x] 将 SAM AI 自检转化为带字段指向和来源要求的事实补录引导；不把 SAM 主观回答直接写入 Review 事实层

## Review→行动→复盘闭环增强
- [x] 将 1→N Deal Review 扩展为 AD/SAM/SA/RSM 四角色 JSON Schema 行动，并可靠创建对应 POD 任务
- [x] 为 POD 任务呈现来源 Review 链接和对应事实片段，确保行动可追溯
- [x] 在后续 Deal Review 中计算并呈现上次 Review 任务的闭环率，而不增加低价值状态时间线

## Review→行动→复盘闭环增强
- [x] 将 1→N Deal Review 扩展为 AD/SAM/SA/RSM 四角色 JSON Schema 行动，并可靠创建对应 POD 任务
- [x] 为 POD 任务呈现来源 Review 链接和对应事实片段，确保行动可追溯
- [x] 在后续 Deal Review 中计算并呈现上次 Review 任务的闭环率，而不增加低价值状态时间线

## 武器库作战上下文整合
- [x] 为 AI 方案定制注入 SALES_METHODOLOGY_SYSTEM_PROMPT 与可选商机的 Deal Map 事实上下文
- [x] 在商机作战室嵌入 Champion 突破话术与轻量竞品对比卡
- [x] 将武器库导航收敛为仓库型能力，并完成回归、生产验证与 GitHub 同步

## 商机作战材料闭环
- [x] 将已入库 Kill Sheet 的竞品反制动作转为经人工确认、可选择责任角色的 POD 任务
- [x] 为方案生成记录提供商机筛选、采用状态与客户反馈，并将人工确认处置作为下一次生成的待验证上下文
- [x] 完成类型检查、64 项回归测试与生产构建验证

## 运行环境恢复
- [x] 重启无响应的开发服务器，验证预览恢复，并提供 GitHub 验证地址与最新提交

## 产品化升级第四轮
- [x] 更新 AD 角色定义、登录页 Slogan 与产品化标签
- [x] 在全局导航加入 AI 状态栏，并为 AI 判断增加可解释的置信度指示器
- [x] 升级登录页为低干扰战情室视觉，并保持 AIStorm 深海军蓝品牌层次
- [x] 校准武器库入口说明与商机作战室的 Champion/Kill Sheet 上下文入口
- [x] 完善竞品反制转 POD 的来源类型、默认责任角色与跳转确认
- [x] 在任务列表与分析视图呈现来源 Review 链接和本周/月 Review 闭环率
- [x] 完成回归、生产验证与 GitHub 同步

## 审核发现修复
- [x] 实现商机 ActionWorkspace 的 deployRecs：基于阶段、MEDDPICC、SA 分配与属地资源产生可解释建议并确认创建任务
- [x] 以测试和界面核验 AI 指挥台中的周/月 Review 闭环率指标卡真实呈现
- [x] 完成回归、生产验证与 GitHub 同步

## 武器库边界纠正
- [x] 从 Arsenal 主 Tab 与内容装配彻底移除 Champion 弹药和竞品 Kill Sheet，仅保留商机作战室行动区入口

## Claude 审核建议最终验收
- [x] 截图核验 Arsenal 仅显示产品文档、成功案例库、AI方案定制、报价工具四个 Tab
- [x] 验证 ActionWorkspace 的 deployRecs 不再为空数组，并覆盖 Champion、Economic Buyer、POC/SA 与属地 RSM 事实规则
- [x] 验证 AI 指挥台 Analytics 同时呈现本周与本月 Review 闭环率及低于 60% 预警

## 审核文字残留修复
- [x] 将武器库导航描述从“产品文档·AI方案·竞品阻击包”更新为“产品文档·AI方案·报价工具”

## 商机内嵌 AI 作战材料生成
- [x] 在 OpportunityRoom actions 区提供方案类、弹药类、话术类的 AI 材料生成入口并自动传入客户和商机 ID
- [x] 在商机内展示生成内容，并支持保存到武器库历史和经人工确认转为 SAM POD 任务
- [x] 在武器库 AI 方案定制页说明商机作战室为上下文感知的优先入口
- [x] 完成回归、生产验证与 GitHub 同步

## AI 作战材料入口最终分层
- [x] 从 Arsenal 移除 AI 方案定制 Tab，使武器库仅保留产品文档、成功案例库和报价工具
- [x] 在 ClientWorkstation 嵌入 0→1 敲门材料生成，自动传入 clientId 而不传 opportunityId
- [x] 保持 OpportunityRoom actions 中的 1→N 赢单材料生成，自动传入 clientId 与 opportunityId 并可转 POD
- [x] 完成登录态截图核验、回归、生产验证与 GitHub 同步
- [x] 防止浏览器自动翻译改写 React DOM，修复登录后客户作战台的 removeChild 异常

## 战场地图阶段条与客户品牌标识
- [x] 为“建图”阶段提供与其他阶段同等清晰的专属颜色和选中状态
- [x] 支持点击销售阶段节点后筛选显示该阶段客户，并提供返回全部客户的明确入口
- [x] 在客户名称旁显示可信的企业 Logo，缺失资产时回退为统一首字母徽标
- [x] 完成阶段筛选与客户品牌标识的回归、截图核验、发布与 GitHub 同步

> 生产核验记录：新版脚本已激活。点击“建图”后显示“当前筛选：建图”，客户命中数从 7/7 正确变为 6/7，进入商机的香港电讯被排除。
- [x] 更新 PWA 缓存版本，确保生产浏览器加载最新阶段筛选脚本

## 开商机门控前端异常
- [x] 禁止战场地图直接将客户阶段修改为“进入商机”，避免触发已知的门控 API 异常
- [x] 在阶段编辑入口引导用户使用“申请开商机”，保留 0→1 客观证据快照；仅 AD 确认的高层直入可作为例外
- [x] 增加门控前端回归测试并完成登录态流程核验、发布与 GitHub 同步

## HKT 既有合作基础定位
- [x] 将 HKT 标注为既有深度合作基础上的战略扩展客户，而非普通从零拓客客户
- [x] 在 HKT 关系与门控引导中明确：除 Felix 外既有关键人关系稳固，亚信科技已有上亿元合作事实；Felix 是待验证的新增变量
- [x] 完成 HKT 定位与开商机异常修复的回归、登录态核验、发布与 GitHub 同步

## HKT Virtual Patch AI Review 回写
- [ ] 修复“生成 / 更新 AI Review”后没有可见结果或未回写当前商机的问题（真实验收发现旧部署仍写入空记录，待新版生产验证）
- [ ] 在生成中、成功、无足够事实与失败场景提供明确的状态与可操作反馈（待新版生产验证）
- [ ] 增加回归测试并完成 HKT Virtual Patch 的登录态生成流程核验、发布与 GitHub 同步
- [x] 在 LLM 响应归一化与 AI Review 持久化层拒绝空正文，并验证生产路由命中最新代码
- [ ] 升级 PWA 缓存版本并验证生产浏览器加载最新入口脚本，而非旧的 index-D6yz4Phs.js

## Command AI 原生交互重构（P0-P2）
- [x] 审计并复用 SALES_METHODOLOGY_SYSTEM_PROMPT、Account/Deal Map、MEDDPICC、3 Why、Go/No-Go 与 Deal Health 的现有数据契约
- [x] 建立统一的 AI 主动引导架构：AI 问题、SAM 自然语言回答、事实来源、置信度与人工确认状态可回溯
- [ ] P0：新增 meetings.extractFullSignals，以单次严格 JSON Schema LLM 调用提取 MEDDPICC、联系人、竞品、时间信号、3 Why、Win 因子警报和下一步动作
- [ ] P0：将拜访后界面改为“本次拜访收获”六区块确认卡，支持全部采纳、逐条确认和暂不处理，并只写入可追溯事实
- [ ] P1：客户作战台按数据充分度展示 AI 主动引导、弱 Win 因子与下一步问题，支持不暴露方法论字段名的顺序问答与自动事实沉淀
- [ ] P1：商机作战室 overview 展示 Win 公式实时仪表盘、每项事实依据、最高优先级风险与 AI 生成的补证问题
- [ ] P2：新增 opportunities.getStageGuidance，按阶段硬性证据要求识别缺口，并在推进商机阶段时弹出自然语言补录引导
- [ ] P2：实现自然语言回答到对应 MEDDPICC/Go-No-Go 事实字段的提取与人工确认，不允许无事实推断
- [ ] 为 P0-P2 覆盖严格 JSON、空数据“数据不足，暂不判断”、事实回溯、人工确认与阶段门控的单元/回归测试
- [ ] 完成 HKT 场景的登录态端到端核验、生产发布与 GitHub 同步

> 生产核验记录：已恢复登录态并确认 HKT 客户作战台渲染“AI 主动引导”面板，说明 AI 先读入库事实、一次只问一个最该验证的问题，且不要求先填写方法论表格；已触发“让 AI 开始引导”，继续等待模型返回下一问并核验确认边界。
> 兼容修复验收：版本 4e89d751 已触发 AI 主动引导，界面显示“正在分析中…”，此前立即出现的 reasoning 参数 400 暂未复现；继续等待模型返回结果。
> 部署核验：`fab2447c` 保存并显示部署成功后，两个生产域名的无缓存 `/__version` 仍返回旧标识 `20260819-ai-review-cache-headers-v2`。当前线上后端尚未切换至 reasoning 兼容代码，真实调用验收被部署实例阻塞。
> 最新部署核验：生产 `/__version` 已返回 `20260819-ai-guidance-reasoning-fallback-v1`，确认后端已切换至兼容修复；HKT 客户作战台已重新触发 AI 主动引导，当前显示分析中，等待单一下一问返回。
> 客户端缓存核验：版本 075d29ca 已以 `ai-guidance-client-v2` 注册新的 Service Worker；HKT 客户作战台已在新客户端再次触发 AI 主动引导，等待结果返回后确认旧 JSON 解析提示是否消失。
> reasoning 移除验收：版本 77c94171 已加载并触发 AI 主动引导。初次等待后仍显示“正在分析中…”，尚未出现下一问或错误；继续核验上游响应是否超时或被网关阻断。
> 内置 Forge 验收：版本 24871b1a 已触发 AI 主动引导，界面进入“正在分析中…”。等待模型返回单一下一问或明确的内置通道错误，验证外部 Provider 已被绕过。
> gpt-5 验收：版本 bd1f0faa 已载入并触发 AI 主动引导，当前进入“正在分析中…”。等待模型返回下一问，以核验高推理模型路径。
> 后端切换后验收：生产探针现确认 `builtin-gpt5-no-reasoning-json-guard` 已实际运行；HKT 客户作战台已在该后端重新触发 AI 主动引导，等待单一下一问结果。

## AI 主动引导模型参数兼容性
- [ ] 修复当前模型不支持 reasoning 参数导致 AI 主动引导返回 400 的问题
- [ ] 回归验证严格 JSON 引导输出、自然语言回答候选与明确的失败反馈
- [ ] 更新无缓存版本探针并确认生产后端实际切换到 AI 主动引导兼容修复版本
- [ ] 让 AI 主动引导绕过当前返回 502 HTML 的外部 OpenAI Provider，强制使用内置 Forge LLM 通道
- [ ] 从 AI 主动引导的提问与回答解释调用中直接移除 reasoning 参数，避免依赖提供商降级重试

## AI 主动引导模型升级
- [ ] 将 generateAIGuidance 与 interpretAnswer 升级为内置目录中可用的高推理模型；不使用不可用的模型 ID
- [ ] 保持 P0 拜访全量信号提取与其他严格 JSON 提取任务使用 gpt-5-mini
- [ ] 重新验证 AI 主动下一问不暴露 MEDDPICC、3 Why 等内部术语，且口语回答仅形成待确认事实候选

## AI 主动引导首屏收敛
- [ ] 首屏仅展示当前判断、唯一自然语言下一问和回答框，不渲染长篇客户事实摘要
- [ ] 将支持判断的事实依据迁移为可展开的简短证据区，并保留可回溯来源
- [ ] 重新验证 HKT 首屏不出现 MEDDPICC、3 Why 等内部术语，SAM 回答后仅形成待确认事实候选

## AI 引导请求稳定性
- [ ] 为 AI 主动引导增加生产 API 健康探针，区分网关/会话故障与模型生成故障
- [ ] 为 AI 主动引导增加有限超时与重试入口，避免按钮无限停留“分析中”
- [ ] 在 HKT 生产流程中验证单一问题、回答候选、确认边界和失败反馈均可见
- [ ] 健康探针自身挂起时独立超时并解除 UI 加载状态，不得阻塞 AI 引导重试

> 直接探测结论：内置 Forge 对 gpt-5 严格 JSON 请求返回 200，耗时约 1.9 秒；当前生产挂起来自前置受保护健康探针。将移除该前置检查，直接执行 AI 引导调用并保留 20 秒结果超时与重试反馈。

> 稳定性版本验收：生产 HKT 客户作战台已加载版本 34450c53，并触发带健康探针的“让 AI 开始引导”。当前按钮进入加载状态，等待 20 秒内返回问题或可见重试提示。
> 最新交互核验：页面刷新后 AI 引导仍处于初始状态，首次自动点击未进入生成流程；将用当前可见按钮重新触发，避免把浏览器定位问题误判为服务异常。
> 超时恢复验收：生产 HKT 页面在 20 秒内未获得模型结果后，明确显示“尚未写入任何事实”与“重新尝试”；按钮已解除加载状态。无限“分析中”问题已修复，仍需定位模型结果未在 20 秒内返回的原因。
> 直接调用版本验收：最新生产 HKT 页面已加载并重新点击“让 AI 开始引导”；等待界面进入生成状态或展示精炼下一问，避免因异步渲染瞬态误判点击未生效。

- [x] 已压缩 AI 主动引导客户事实快照并将 gpt-5 输出预算收敛至单一问题所需范围；生产 HKT 已在 12 秒窗口后返回针对 Marcos 的唯一可回答问题。
- [x] 验证 HKT 引导回答只生成待确认候选，未在 SAM 明确确认前写入任何事实：生产页面已显示“本次回答未形成可确认、可写入的客户事实”，未触发任何确认写入操作。
- [x] 已发布回答解释保护版本；HKT “数据不足”回答已在生产返回 candidateTarget=none 的不可写入结果。
> HKT 复测已提交“无可回溯客户原话”的真实数据不足回答；未点击任何“确认写入”操作，待检查解释结果。
- [x] 最终客户端兜底版本已在 HKT 生产页验证：回答解释异常时显示不可写入结果，不再向 SAM 暴露空数组访问错误。

- [x] 复核 AI 主动引导的模型目录与推理参数，移除不兼容 reasoning 配置。
- [x] 重写 AI 主动引导为“录入 SAM 已知事实”优先：首问聚焦最薄弱 Win 因子的人员、原话与已知分歧，而非要求执行销售动作。
- [x] 用 HKT 验证首问围绕 Felix、Marcos 或 Susanna 的 Power 事实，并验证回答只产生待确认候选：生产首问点名 Susanna、Marcos Chow、Felix；Marcos/Felix 原话仅以低置信候选呈现，未点击确认前零写入。
> 事实录入优先版本已在 HKT 生产页加载；当前客户关系背景含 Felix 新变量、Marcos 咖啡会面与 Susanna 未接触等 Power 线索，待触发首问。
> 本次触发后仍出现旧版“下一步由谁在什么时间推进”基础问题，尚不能通过 Power 首问验收；需先核对生产实例是否已切换到 fact-capture-priority-v1。
> 路由诊断完成：开发预览 `/__version` 已返回 `fact-capture-priority-v1`，但 `command.aistorm.com` 与项目默认托管域名仍返回旧的 `forge-isolated-gpt5-v2`；生产域名尚未切换，需在托管域名绑定/发布层处理。
> 生产部署成功后复核：`command.aistorm.com/__version` 已返回 `fact-capture-priority-v1` 与 `builtin-gpt5-no-reasoning-fact-capture-priority-v1`；可继续 HKT Power 首问验收。
> HKT 生产首问已不再要求执行销售动作，改为询问最能影响走向的高层之真实反应；但模型延迟后进入的基础引导尚未点名 Felix、Marcos 或 Susanna，尚不能完整通过验收。

- [x] 让基础引导从客户快照动态选取已入库的 Power 关键人，HKT 应优先点名 Felix、Marcos 或 Susanna，而不使用泛化的“高层”。
> 动态点名版本 `e8e58ca5` 已在 HKT 生产页面加载；待触发 AI 引导并验收首问输出。
> HKT 触发后仍显示旧版泛化基础问题，未点名已入库 Power 关键人；待核对生产前端缓存与基础引导参数传递，验收暂不通过。

- [x] 已升级服务工作线程缓存以强制生产前端加载动态点名基础引导脚本；HKT 首问已包含 Susanna、Marcos Chow、Felix，且仅要求复述已知原话或动作。
- [x] 在回答解释模型延迟时，从 SAM 原始回答生成标注“待确认”的关系事实候选，不自动写入任何字段。
> 待确认候选版本 `cc8c033c` 已在 HKT 生产页面加载；待重新触发 Power 首问并提交包含 Marcos、Felix 关系原话的自然语言回答。
> 已提交自然语言回答：Marcos 不反对年底签单，但要求先厘清 Felix 的安全架构与审批边界异议；未执行任何确认写入操作，待检查候选卡。
> HKT 回答后仍触发客户端 `candidateTarget=none` 兜底，未展示服务端原文候选；需让客户端错误兜底也保留 SAM 原文为低置信待确认候选，验收暂不通过。
> 客户端原文候选版本 `f092426f` 已在 HKT 生产页面加载；待重测自然语言回答并检查“确认写入事实”仅作为人工可选动作出现。
> 最新 HKT Power 首问已点名 Susanna、Marcos Chow、Felix；下一步提交同一关系事实以验证客户端候选卡。
> 最终验收通过：HKT 已显示“SAM 待确认原文”及“暂不写入 / 确认写入事实”两项人工操作。未点击确认按钮，事实层未发生写入。

- [x] 将客户端回答解释错误兜底升级为低置信待确认关系候选，保留 SAM 原文但不自动写入。
> Service Worker v3 已在 HKT 页面重新加载生效；当前页面可重新触发 AI 引导以验证动态关键人名称。
- [x] 在客户端回答解释报错时生成 candidateTarget=none 的待确认卡，保证不自动写入且不中断 SAM 的下一步引导。
- [x] 修复回答解释对空或非标准 LLM 响应访问 choices[0] 的异常，并降级为不写入的待确认结果。
- [x] 将首轮 AI 引导响应精简为当前判断、唯一问题与可追溯依据，并在 gpt-5 未及时返回时走保留事实约束的快速模型降级。
- [x] 将 AI 主动引导从通用完整方法论系统提示切换为专门的紧凑事实引导契约，降低 HKT 单一问题的推理延迟。
- [x] 为 AI 主动引导禁用长退避重试、施加 15 秒端到端截止时间，并在两级模型均不可用时返回不写入事实的基础引导问题。
- [x] 在前端 12 秒等待窗口展示事实安全的基础问题，让 SAM 可继续回答而不面对空超时状态。

> 精炼版本验收：生产 HKT 客户作战台已触发“让 AI 开始引导”，按钮进入加载状态；待模型返回后检查首屏是否只呈现当前判断与唯一问题。

## AI 主动引导生产后端切换
- [ ] 更新无缓存版本探针，确认生产服务实际运行内置 gpt-5 与 useBuiltin 代码
- [ ] 仅在探针确认切换后执行 HKT 的真实 AI 下一问与回答映射验收

## 本地服务重启核验
- [ ] 强制重启本地开发服务，确认其加载 Forge 配置隔离后的最新 AI 引导代码
- [ ] 对比本地预览与独立生产域名的版本探针，明确两者的切换状态

## 生产认证会话刷新
- [ ] 处理生产容器重建后的过期登录会话，确保 AI 主动引导请求不再因缺少 session cookie 被拒绝
- [ ] 在刷新会话后重新验证 HKT AI 主动引导的真实下一问、口语回答候选和确认边界

## 已授权的支持工单协作
- [ ] 公开分享当前任务链接并以英文提交给 Manus 支持团队
- [ ] 提交 HKT AI 引导 502、实例切换、会话失效的复现时间、访问地址与版本探针证据
- [ ] 明确要求支持团队使最新 checkpoint 的生产实例生效，而非审查应用功能逻辑

> 验证结论：版本 77c94171 已直接移除 reasoning 参数，但 HKT 真实调用仍收到 502 HTML。根因是当前数据库配置的外部 OpenAI Provider 不可用；AI 主动引导将改走项目内置 Forge 通道。
> 根因确认：`useBuiltin` 过去仍调用由 `ENV.forgeApiUrl` 解析的地址；该字段在存在 `OPENAI_API_KEY` 时优先指向 OpenAI，导致“内置”调用实际仍走外部 Provider。需直接使用 `BUILT_IN_FORGE_API_URL` 与 `BUILT_IN_FORGE_API_KEY`。
> 部署状态：版本 2cbfaf1d 已保存，但两个生产域名仍返回上一版 `builtin-gpt5-v1` 探针；待 `forge-isolated-gpt5-v2` 生效后再执行真实 HKT 引导，避免对旧后端做重复测试。
> 支持介入后：生产探针已确认返回 `forge-isolated-gpt5-v2`；已在 HKT 客户作战台重新触发 AI 主动引导，当前显示分析中，等待内置 Forge 的真实下一问。
> 当前观察：两次等待后页面仍保持“正在分析中…”，未出现下一问或失败提示。暂不重复触发请求，继续检查网关请求耗时、超时与响应处理链路。

## AI 引导响应类型与生产路由
- [ ] 修复 AI 引导 tRPC 请求返回 HTML 登录页或前端回退页而非 JSON 的问题
- [ ] 在客户端将非 JSON API 响应转换为明确的会话或服务路由错误提示，避免暴露 JSON 解析异常
- [ ] 完成 HKT AI 主动提问的登录态生产核验，确认不再出现 `Unexpected token '<'`
- [ ] 升级 PWA 缓存版本并强制生产浏览器加载最新 AI 引导客户端脚本

> 真实验收记录：已在生产 HKT Virtual Patch（商机 #5）确认点击后立刻显示“分析中…”，不再无反馈；继续等待模型返回，核验正文和回执是否写入。
> 新版生产验收：已在版本 f5ee1ddc 再次触发生成，页面显示“分析中…”。待请求完成后核对是否成功写入正文，或以明确错误结束且不新增空记录。
> 结果：请求完成后仍显示旧版“角色任务创建回执”与“尚未生成 AI Review”，说明生产后端尚未命中最新 review-one-to-n-v3-nonempty-guard；不得标记验收完成。

> 生产登录态核验：HKT 客户作战台已显示“客户关系背景”，包含既有上亿元合作基础、Felix 待验证变量和“不替代购买信号门控”说明；页面同时显示 HKT 已进入商机、交易推进在商机作战室维护。继续核验战场地图的直改拦截与受控跳转。
> 战场地图核验：HKT 卡片显示“进入商机”，且只提供“进入客户作战台”；继续通过其基础编辑弹窗确认不暴露直改阶段入口。

## 生产部署绑定刷新
- [ ] 通过编辑模式做不改变业务内容的最小改动并重新发布，刷新 command.aistorm.com 的生产部署绑定。
- [ ] 在重新发布后复测 HKT “让 AI 提取本次拜访收获”接口，确认不再返回 502 HTML。

## 可视化编辑重新发布核验
- [x] 核验客户作战台背景说明的可视化编辑是否仅为无业务影响的空白调整；未落盘，原文保持不变。
- [ ] 基于该最小改动创建新的生产 checkpoint，并复测 HKT AI 信号提取接口。
- [x] 可视化编辑未落盘，已为客户关系背景说明添加非视觉辅助标签以触发新的前端构建。
> 已进入 Manus 项目列表；正在切换到固定的 AIStorm Command 项目以查找编辑模式入口。

## P1 Win 公式仪表盘
- [x] 核对 `calculateWinFactors` 的输入契约、Deal Map 数据结构与商机 Overview 现有布局。
- [x] 在商机作战室 Overview 顶部显示 Pain / Power / Champion / Value / Control 五因子实时分数。
- [x] 高亮最弱因子；低于 50 分时提供事实补录方向，数据不足时明确显示“数据不足，暂无法计算”。
- [x] 已补充 Win 因子与工作流回归测试；生产桌面布局显示 5 张同排卡片，窄屏使用 2→3→5 列响应式网格且无固定宽度溢出。
- [x] 发布最新版本并同步 GitHub 供外部代码审核。
> HKT Virtual Patch 生产验收：Pain 75、Power 75、Champion 75、Value 75、Control 67；Control 以最低分高亮，页面显示 14 项事实依据且未输出低于 50 分的补录动作。

## AI 主动引导连续问答修复（2026-08-22）
- [x] 审计候选确认写入后的状态清理、事实刷新与重新提问链路，确认循环来自 interpretAnswer 与 fallback 的 nextQuestion 复读。
- [x] 回答解释成功后立即切换为不同的新问题；确认写入成功后清除旧候选并保留该新问题继续问答。
- [x] 增加重复问题防护，禁止模型结果与客户端 fallback 将新问题设置为刚确认的问题。
- [x] 已补充回归测试并在 Pentest 生产验证连续问答：E、C2、M 三类回答均生成不同候选与后续问题。
- [x] 将 interpretAnswer 改用 gpt-4o-mini 并移除 useBuiltin，避免 strict schema 结构化解读失败。
- [x] fallback 生成新的事实追问，不再把原问题原样作为 nextQuestion。
- [x] interpretAnswer 注入当前商机已有 MEDDPICC 证据维度，要求下一问优先覆盖尚未覆盖的事实。
- [x] 对照用户精确任务，将 fallback 追问统一为“客户原话、时间节点或明确动作”的自然语言问题。
- [x] 将已有证据上下文明确约束为“nextQuestion 必须针对评分为 0 的维度”，并保留不重复原问题保护。
- [x] 重新运行类型检查、完整回归测试与生产构建（19 个测试文件、85 项测试通过）。
- [x] 生产实例已加载更新版本，并在 Pentest 实测通过 gpt-4o-mini interpretAnswer 与确定性分类兜底。
- [x] 使用 Pentest 的 Susanna/Marcos/Felix 真实回答补齐 fallback：明确人物、签字权、支持/反对与权力关系会生成低置信待确认商机候选。
- [x] 确保明确的人名、最终签字人、立场与权力关系即使在模型异常时也生成低置信待确认商机候选，而非“数据不足”。

## AI 主动引导明确事实分类修复（2026-08-23）
- [x] 将“最终签字人、权力关系、支持/反对”稳定映射为 E 决策权待确认候选。
- [x] 将“替换美资产品、倾向我方”等客户偏好稳定映射为 D1/C2 待确认候选。
- [x] 将明确预算金额稳定映射为 M 商业价值待确认候选，不再判为数据不足。
- [x] 确认写入后刷新 MEDDPICC、Deal Map 与阶段证据，并确保下一问只针对尚未覆盖的维度。
- [x] 补充四条真实回答单元测试；类型检查、20 个测试文件共 89 项测试及生产构建通过。
- [x] Pentest 生产复验：决策权回答生成 E 候选、替换美资与倾向我方生成 C2 候选、250 万预算生成 M 候选，均未判为数据不足。
- [x] 将未覆盖维度判断升级为“评分为 0 或证据备注为空”，避免所有评分非零时下一问退回泛化动作问题。
- [x] 发布最终修复并同步 GitHub 审核版本（3304263c）。
> Pentest 生产复验基线（775dc2e6）：MEDDPICC 59%，Win 因子 Pain 75 / Power 50 / Champion 50 / Value 75 / Control 50；已触发新版 AI 主动引导，待验证 E、C2、M 三类真实回答候选和后续问题。
> 生产复验结果 1：Susanna 最终签字与 Marcos/Felix 权力关系已生成中置信 E 待确认候选；下一问已变化为 Felix 对当前方案的具体看法，未重复原题，也未判为“数据不足”。
> 生产复验结果 2：“替换美资产品、倾向我方”已生成中置信 C2 待确认候选；但当前商机 8 个评分均非零，零分维度列表为空，下一问退回泛化动作问题，后续需以证据备注完整度补充未覆盖判断。
> 生产复验结果 3：“预算大概 250 万人民币左右”已生成中置信 M 待确认候选，不再显示“数据不足”；最终版本已补充证据备注空缺判断，下一问将优先进入真实未覆盖维度。

## AI 主动引导质量回归（2026-08-23）
- [x] 修复服务要求已被提取为候选后仍被再次追问的问题。
- [x] 识别“没有了/尚未涉及”等穷尽回答，明确收束当前主题并转向其他真实证据缺口。
- [x] 将本次 HKT Dinner 连续问答纳入回归测试，验证不重复主题、不虚构事实且每次只问一个新的关键问题。
- [x] 将每轮后续问题统一改为完整商机诊断生成，并只把本轮未确认候选作为临时上下文传入，绝不写入事实层。
- [x] 更新生产版本探针标识并确认线上实例加载本轮 AI 引导质量修复（command.aistorm.com 返回 20260823-ai-guidance-diagnostic-followup-v1）。

## 商机阶段关联的 AI 主动引导（2026-08-23）
- [x] 修复进入“商务谈判”等阶段后，AI 仍以泛化 Win 因子问题覆盖阶段门控的问题。
- [x] 将当前阶段的未满足准入证据作为首要提问方向；仅在阶段门控满足后以 Win 因子排序下一问。
- [x] 为商务谈判阶段添加回归测试，确保优先询问竞品可防御性、商务/采购证据等阶段缺口，而非退回泛化高层态度问题。

## 阶段门控强制问题选择（2026-08-23）
- [x] 修复模型虽读取阶段门控提示、却仍生成泛化 Power 问题的缺陷。
- [x] 在服务端强制将未满足阶段门控的首问与后续问替换为对应门控问题，禁止跳题。
- [x] 用“准备推进至商务谈判”场景回归验证：首问只能是采购流程或竞争可防御性缺口。

## 完整阶段门控（2026-08-23）
- [x] 补全需求挖掘阶段的 I、M、C1 事实门控。
- [x] 补全技术验证阶段的 D1、C1、竞争初步态势门控。
- [x] 补全方案提案阶段的 E、D2、M、C1 事实门控。
- [x] 将商务谈判扩展为 P、E、竞争可防御性、C1 四项门控，并验证全部满足后才进入 Win 因子。

## 商机作战室系统化重构（2026-08-23）
- [x] 统一 P0 拜访日志与 AI 引导候选的事实写入目标，确保所有视图只读取 MEDDPICC、3 Why、竞争、Pain 与联系人事实层。
- [x] 新增阶段感知引导上下文构建器：阶段门控优先、Win 最弱因子次之、关键人物与本轮临时问答共同约束问题。
- [x] 重写 opportunityGuide，使其接收问答历史并在每轮基于完整商机状态重新生成问题。
- [x] 简化 interpretAnswer，只提取待确认事实候选，不再生成或决定下一问。
- [x] 重构 AIActiveGuidancePanel 连续问答状态机：解释回答后自动调用 opportunityGuide，保留人工确认后才写入的边界。
- [x] 将 OpportunityRoom 九个工作区收敛为战情总览、作战证据、3 Why、决策门控、行动任务五个工作区。
- [x] 将 MEDDPICC 与 Pain & Metrics 合并到作战证据，将精简 Blue Sheet 里程碑并入决策门控，不删除底层数据。
- [ ] 完成统一架构、阶段问题、无循环、五工作区与生产版本的完整回归验收。

## 系统化重构审核收尾（2026-08-23）
- [x] 前端 AI 引导直接传递当前商机阶段，移除“下一阶段再由服务端否定”的冗余逻辑。
- [x] 确定性事实分类仅在模型未产出有效候选时兜底，不覆盖模型已有高置信候选。
- [ ] 验证模型候选优先、异常兜底仍可生成 E/C2/M/P 候选，并完成生产 EDR 商务谈判场景验收。

## 完整商机诊断超时修复（2026-08-23）
- [x] 定位前端 12 秒等待窗口、服务端主模型/降级模型时限与商机快照体积的冲突。
- [x] 确保完整诊断在交互时限内返回阶段相关问题；失败时保持不生成替代问题、不写入事实。
- [x] 完成自动化回归与构建，并提供生产人工验收任务和准确 GitHub commit。
- [x] 将主动引导主模型改为 gpt-4o-mini 非内置通道，并把前端等待窗口调整为 20 秒，与服务端 15 秒总窗口留出余量。

## 阶段门控百分制与业务词汇修复（2026-08-23）
- [x] 将商机引导快照与阶段就绪检查的门控阈值统一从 2 修正为百分制 50，并保留证据长度要求。
- [x] 扩展时间触发事件词汇，使到期、不续签、续签、截止日期与推进时间可识别为决策流程事实。
- [x] 扩展主流安全竞品厂商词汇，使奇安信、CrowdStrike 等明确竞争回答可识别为 C2 事实。
- [x] 回归验证低于 50 分不穿透阶段门控，时间/P 与竞品/C2 回答不再被重复追问。

## 开发预览 AI 引导网络错误（2026-08-23）
- [x] 定位 `/clients/150001/opportunities/1` 调用 AI 引导 mutation 时的 `Failed to fetch` 根因：开发预览代理发生一次瞬时断连，应用服务未崩溃。
- [x] 恢复开发预览 API 可用性，确保当前未发布改动可由用户人工验收；外部预览域名复测 HTTP 200，5.26 秒返回阶段问题。
- [x] 验证修复过程不触发生产 checkpoint 或生产域名切换。

## AI 引导与阶段推进解耦（2026-08-23）
- [x] 移除 StageAdvanceGuidance 挂载时对 AI 引导阶段目标的反向覆盖。
- [x] 让 AIActiveGuidancePanel 始终直接使用 `opportunity.stage` 作为当前阶段上下文。
- [x] 将提示文案改为当前阶段门控引导，避免误导 SAM 提前准备下一个阶段。
- [x] 回归验证推进下拉选择不改变 AI 引导问题所属阶段。

## Claude AI 引导升级分支合并（2026-08-23）
- [x] 获取并审阅 `claude/guidance-upgrade` 中 `server/aiNativeGuidance.ts`、`server/routers.ts` 与 `shared/aiAnswerFacts.ts` 的差异。
- [x] 选择性合并商机阶段题库、追问备选与 history 感知门控，同时保留未确认候选不写入事实层、gpt-4o-mini 主路径、evidence.length ≥ 5 门控与模型有效候选优先边界。
- [x] 完成完整 Claude 设计的人工本地预览验收；用户已授权以最终自动化验证替代本轮额外预览，直接保存 checkpoint 并发布。

## Claude 完整 AI 引导设计移植（2026-08-23）
- [x] 移植 `ACCOUNT_REQUIREMENTS` 客户经营题库及 `buildAccountGuidancePromptSuffix`，并接入客户级 AI 引导快照。
- [x] 保留并完成 `STAGE_REQUIREMENTS` 的 followUp 追问链，供已回答主问题后的深挖使用。
- [x] 将商机阶段门控统一为 evidence.length ≥ 5 的信任 SAM 判定，并将本轮 history 作为临时覆盖而非事实写入。
- [x] 按信任 SAM 原则改写 `interpretAnswer`：除明确“不知道/没有”外，实质回答均应生成待确认候选。
- [x] 修复 Claude 分支可执行代码中的全角引号，并完成五项设计的类型检查、22 个测试文件共 108 项测试和生产构建。
- [x] 完成五项设计的人工本地预览验收；用户已授权以最终自动化验证替代本轮额外预览，直接保存 checkpoint 并发布。

## 需求挖掘触发事件门控（2026-08-23）
- [x] 在需求挖掘阶段补回 `gate_trigger`，优先验证客户为何必须现在行动。
- [x] 以到期、不续签、合规截止、安全事件、预算周期或高层指令等可追溯事实判定触发事件门控。
- [x] 验证临时回答仅推动下一道门控、不写入事实层，并更新 GitHub 审阅分支。

## 发布授权（2026-08-23）
- [x] 用户已授权：触发事件门控完成验证后，直接合并并推送 main，保存 checkpoint 更新正式版本。

## 完整 AI 引导版本标识（2026-08-23）
- [ ] 更新生产版本探针与 Service Worker 缓存标识，使人工验收可明确识别完整 AI 引导与触发事件门控版本。

## 未发布版本 GitHub 审阅（2026-08-23）
- [x] 将当前本地 AI 引导完整设计改动提交到独立审阅分支，不合并 main、不触发生产发布（d646463）。
- [x] 提供精确的 GitHub 分支与比较链接，供 Claude 审核当前代码基线。
