/**
 * AIStorm Command — OT/EMT Demo 数据增强脚本 v2
 * 使用 Leo 和 Henry 的真实账号，不创建 Demo 账号
 */

import mysql from 'mysql2/promise';
const conn = await mysql.createConnection(process.env.DATABASE_URL);

const DBS = 180002;
const PET = 180003;
const CEN = 180004;

async function run(sql, vals = []) {
  try {
    const [r] = await conn.execute(sql, vals);
    return r;
  } catch (e) {
    console.log(`⚠️  SQL error: ${e.message.slice(0, 100)}`);
    return null;
  }
}

async function upsertUser(email, name, podRole, role = 'user') {
  const hash = '$2b$10$FsWQh2LEWYoRjWxs4zL.3.4poYaHlq5ufSAHeAUrgkA0zXl865B0.';
  await run(
    `INSERT INTO email_users (email,passwordHash,name,role,podRole,isActive,createdAt,updatedAt)
     VALUES (?,?,?,?,?,1,NOW(),NOW())
     ON DUPLICATE KEY UPDATE name=VALUES(name), podRole=VALUES(podRole), role=VALUES(role)`,
    [email, hash, name, role, podRole]
  );
  const [rows] = await conn.execute('SELECT id FROM email_users WHERE email=?', [email]);
  console.log(`✅ user: ${name} (${podRole}) id=${rows[0]?.id}`);
  return rows[0]?.id;
}

console.log('\n── STEP 1: 查询 Leo 和 Henry 的真实账号 ──');
const [[leoRows]] = await conn.execute("SELECT id, name FROM email_users WHERE email='leo.he@aistorm.com'");
const [[henryRows]] = await conn.execute("SELECT id, name FROM email_users WHERE email='henry.sin@aistorm.com'");

if (!leoRows || !henryRows) {
  console.error('❌ Leo 或 Henry 账号不存在，请先创建账号');
  process.exit(1);
}

const adId   = leoRows.id;
const adName = leoRows.name;
const samId  = henryRows.id;
const samName = henryRows.name;
console.log(`✅ Leo: id=${adId} name=${adName}`);
console.log(`✅ Henry: id=${samId} name=${samName}`);

console.log('\n── STEP 2: 创建 SA/RSM Demo 账号 ──');
const saId  = await upsertUser('sa@demo.aistorm.com',  '王建国', 'SA',  'user');
const rsmId = await upsertUser('rsm@demo.aistorm.com', '陈志远', 'RSM', 'user');

console.log('\n── STEP 3: 更新客户信息 ──');

await run(
  `UPDATE clients SET stage='找人', priority='P0',
    assignedSamId=?, assignedSamName=?,
    assignedRsmId=?, assignedRsmName='陈志远',
    notes='MAS TRM 2.0合规升级项目，现有CrowdStrike方案告警噪音高、响应慢，预算$450K SGD待批。CISO Kevin Lim来自渣打，有AI安全平台经验。',
    relationshipNarrative='SAM自4月起接触星展银行，主要接触人为IT安全架构师James Wong，James对AIStorm方案评价正面并愿意内部推动。CISO Kevin Lim见过一次，态度中立。核心风险：Kevin作为经济决策人接触深度不足，James的Champion地位虽受到鼓励，但Political Will尚未通过非正式接触验证，仅限于会议室表态。下一步关键动作：争取与Kevin的非正式接触，验证其真实决策意向。',
    updatedAt=NOW() WHERE id=?`,
  [samId, samName, rsmId, DBS]
);
console.log('✅ 星展银行 updated');

await run(
  `UPDATE clients SET stage='进入商机', priority='P0',
    assignedSamId=?, assignedSamName=?,
    assignedRsmId=?, assignedRsmName='陈志远',
    notes='OT安全平台项目，$800K USD预算已批，Petronas 2025年Top3安全优先项。竞品Claroty和Dragos均在评估。CloudGuard+NDR组合方案已完成初步提案，7月底截止。',
    relationshipNarrative='Petronas OT安全项目进入实质评估阶段。Champion Farid Hassan（高级安全工程师）是内部最有力的推手，非正式接触5次，在Ahmad Razif（CIO）面前多次力荐AIStorm。技术评估结果AIStorm全面领先Claroty和Dragos，本地化支持是关键优势。当前最大风险：采购经理Zainab Ibrahim已要求合同条款讨论，但Paper Process正式流程尚未启动，7月底截止压力大。竞品Claroty正在做价格反扑。',
    updatedAt=NOW() WHERE id=?`,
  [samId, samName, rsmId, PET]
);
console.log('✅ 马来西亚国家石油公司 updated');

await run(
  `UPDATE clients SET stage='进门', priority='P1',
    assignedSamId=?, assignedSamName=?,
    assignedRsmId=?, assignedRsmName='陈志远',
    notes='PDPA合规驱动，竞争对手Big C被罚款300万泰铢触发内部警觉。集团422个POS终端零EDR保护。CTO Somchai保守，DPO Pranee是主动推动者。',
    relationshipNarrative='DPO Pranee Charoenwong因Big C罚款事件主动联系AIStorm，是我方目前唯一的内部接触点。IT安全经理Nattapong技术上认可TrustOne方案。CTO Somchai（真正的经济决策人）尚未接触，对安全预算历来保守。当前阶段关键任务：通过Pranee争取与Somchai的会面，用Big C罚款案例量化中央百货的潜在风险金额，作为进一步推进的敲门砖。',
    updatedAt=NOW() WHERE id=?`,
  [samId, samName, rsmId, CEN]
);
console.log('✅ 泰国中央百货集团 updated');

console.log('\n── STEP 4: 更新 MEDDPICC ──');

await run(`UPDATE meddpicc SET
  metricsScore=45, metricsNotes='POC数据显示MTTR可从4.2h降至42min，但客户尚未正式确认ROI数字。预算$450K待Sarah Chen批准，EB层ROI认可还未完成。',
  economicBuyerScore=25, economicBuyerName='Sarah Chen（CFO）/ Kevin Lim（CISO）',
  economicBuyerNotes='Kevin Lim是技术决策人，态度中立偏正面，见过2次。真正拍板预算的Sarah Chen CFO尚未接触——这是最大的EB空白。',
  decisionCriteriaScore=50, decisionCriteriaNotes='评标标准已知（AI检测能力、响应时间、MAS合规覆盖），但AIStorm参与标准塑造不足，CrowdStrike在品牌和本地关系上仍有优势。',
  decisionProcessScore=30, decisionProcessNotes='流程框架已了解：技术评估→CISO推荐→CFO审批。但具体时间线、各环节负责人、审批周期均不清晰。',
  paperProcessScore=0, paperProcessNotes='⚠️ 完全空白。Procurement team尚未介入，合同模板、法务审查、采购流程完全未启动。一旦技术评估通过，流程延误风险极高。',
  implicatePainScore=75, implicatePainNotes='MAS TRM 2.0合规截止年底，痛点明确。现有CrowdStrike误报率60%导致SOC团队严重告警疲劳，已有一次真实威胁被淹没在噪音中。',
  championScore=40, championName='James Wong（IT安全架构师）',
  championNotes='会议室接触3次，态度积极，表示愿意内部推动。但非正式接触次数为0——所有接触均为正式会议，Political Will尚未通过私下沟通验证。这是Champion真实性的核心疑问。',
  competitionScore=75, competitionNotes='CrowdStrike是主要竞品，本地合作伙伴关系强，Kevin之前公司用过。AIStorm技术优势明显，但品牌认知度不足，需要强化案例背书。',
  updatedAt=NOW() WHERE clientId=?`, [DBS]);
console.log('✅ DBS MEDDPICC updated');

await run(`UPDATE meddpicc SET
  metricsScore=75, metricsNotes='OT安全ROI已量化：3个工厂ICS系统零监控，一次APT攻击导致停产4小时，直接损失预估$3.2M USD。AIStorm CloudGuard+NDR可将检出率从0提升至95%+。Ahmad Razif已认可这套价值数字。',
  economicBuyerScore=75, economicBuyerName='Ahmad Razif（Group CIO）',
  economicBuyerNotes='Ahmad已正式批准$800K预算，是本项目的强力支持者。曾在会议上公开表示"OT安全是今年必须解决的问题"。Champion Farid是他的直系下属，信任度高。',
  decisionCriteriaScore=75, decisionCriteriaNotes='评标标准已基本由我方参与塑造：OT专用检测能力、Purdue模型合规支持、马来西亚本地团队、NACSA认证。这三条都是AIStorm的优势。',
  decisionProcessScore=50, decisionProcessNotes='流程清晰：技术评估（完成）→CIO审批（获批）→采购招标（进行中）→合同签署。当前卡在采购招标环节，Zainab主导。',
  paperProcessScore=50, paperProcessNotes='⚠️ 风险点：采购流程正式启动，但Zainab对合同条款有疑虑（付款条件、SLA罚款条款）。Claroty已提交了更宽松的合同版本，我们需要做出回应。7月底截止，时间紧张。',
  implicatePainScore=100, implicatePainNotes='痛点验证最充分：已发生真实OT安全事件，NACSA已介入调查，马来西亚政府对关键基础设施安全有强制合规要求。Ahmad将此列为Top3战略优先项，没有拖延的理由。',
  championScore=75, championName='Farid Hassan（高级安全工程师）',
  championNotes='最有力的Champion：非正式接触5次（饭局3次、工厂参观2次），在Ahmad面前多次力推AIStorm，已帮助起草内部立项报告。三维评分：触达EB能力3/Political Will 3/可信度3。',
  competitionScore=50, competitionNotes='Claroty是OT安全专业厂商，品牌知名度高，正在做价格反扑（据悉降价15%）。Dragos技术强但价格最高。AIStorm优势：价格最优+本地化支持+CloudGuard与OT的集成能力。',
  updatedAt=NOW() WHERE clientId=?`, [PET]);
console.log('✅ Petronas MEDDPICC updated');

await run(`UPDATE meddpicc SET
  metricsScore=25, metricsNotes='仅有Big C罚款300万泰铢作为外部参考数字。集团422个POS终端，行业平均每起勒索攻击损失250万泰铢，但客户侧尚未确认自身量化数字。',
  economicBuyerScore=0, economicBuyerName='Somchai Pattana（CTO）',
  economicBuyerNotes='⚠️ 尚未接触。是最大的未知量。Pranee说他对安全预算历来保守，"只要不出事就不花钱"。必须通过量化数据和Pranee的引荐争取会面。',
  decisionCriteriaScore=25, decisionCriteriaNotes='Pranee提到CTO最关心的是：①不影响POS系统性能；②PDPA合规证明；③价格。',
  decisionProcessScore=0, decisionProcessNotes='完全未知。集团级采购流程、审批权限、时间线均不了解。',
  paperProcessScore=0, paperProcessNotes='完全未知。',
  implicatePainScore=50, implicatePainNotes='Big C案例触发了内部警觉，痛点真实存在，但尚未向CTO层量化。Nattapong透露上个月有一台POS被勒索软件感染，靠断网处理，未上报——这是关键的量化突破口。',
  championScore=25, championName='Pranee Charoenwong（DPO）',
  championNotes='有推动意愿，但影响力有限。非正式接触1次（AIStorm PDPA研讨会）。三维评分：触达EB能力1/Political Will 2/可信度2——典型的弱Champion，需要帮她构建向CTO汇报的弹药。',
  competitionScore=25, competitionNotes='竞品动态不明。可能处于市场空白阶段。本地泰国IT厂商有价格优势，需要用专业性和PDPA合规专长来建立差异化。',
  updatedAt=NOW() WHERE clientId=?`, [CEN]);
console.log('✅ Central MEDDPICC updated');

console.log('\n── STEP 5: 关键人（清空重建） ──');
for (const cid of [DBS, PET, CEN]) {
  await run('DELETE FROM key_contacts WHERE clientId=?', [cid]);
}
console.log('🗑️  旧关键人数据已清空');

const contacts = [
  { clientId: DBS, name: 'Kevin Lim', title: 'CISO', department: 'Information Security', buyingRole: '技术决策人', relationship: '已接触', stance: '中立', informalContactCount: 1, customerInitiatedCount: 0, hasWhatsapp: 1, hasWeChat: 0, reportingTo: 'Group CTO', notes: '来自渣打银行，主导过XDR全行部署。技术判断力强，对AI安全平台有真实经验。目前态度中立，等待POC结果和Sarah Chen的预算批准。见过2次正式会面。' },
  { clientId: DBS, name: 'James Wong', title: 'IT安全架构师', department: 'IT Security', buyingRole: 'Champion', relationship: '已接触', stance: '支持', championAccessToPower: 1, championPoliticalWill: 2, championCredibility: 1, informalContactCount: 0, customerInitiatedCount: 0, hasWhatsapp: 1, hasWeChat: 0, reportingTo: 'Kevin Lim', notes: '⚠️ Champion待验证：会议室接触3次，态度积极，表示愿意内部推动。但所有接触均为正式会议场合，Political Will=2但非正式接触次数=0，Champion真实性存疑。' },
  { clientId: DBS, name: 'Sarah Chen', title: 'CFO', department: 'Finance', buyingRole: '经济决策人', relationship: '待接触', stance: '未知', informalContactCount: 0, customerInitiatedCount: 0, reportingTo: 'Group CEO', notes: '真正的预算拍板人，$450K需要她最终审批。Kevin说她对ROI数字感兴趣。目前完全未接触——这是最大的风险敞口。' },
  { clientId: DBS, name: 'Michael Tan', title: 'VP Technology Risk', department: 'Risk Management', buyingRole: '影响者', relationship: '已接触', stance: '中立', informalContactCount: 0, customerInitiatedCount: 0, reportingTo: 'CRO', notes: '对合规认证和SLA条款有顾虑，认为价格偏高。需要持续维护，避免转变为阻碍者。' },
  { clientId: PET, name: 'Ahmad Razif', title: 'Group CIO', department: 'ICT', buyingRole: '经济决策人', relationship: '建立关系', stance: '支持', informalContactCount: 2, customerInitiatedCount: 1, hasWhatsapp: 1, reportingTo: 'Group CEO', notes: '$800K预算已批，将OT安全列为Top3战略优先项。在会议上公开支持AIStorm方案。' },
  { clientId: PET, name: 'Nurul Huda', title: 'Head of OT Security', department: 'Cybersecurity', buyingRole: '技术决策人', relationship: '建立关系', stance: '支持', informalContactCount: 2, customerInitiatedCount: 0, hasWhatsapp: 1, reportingTo: 'Ahmad Razif', notes: '主导技术评估，对CloudGuard+NDR组合方案评价正面。' },
  { clientId: PET, name: 'Farid Hassan', title: '高级安全工程师', department: 'OT/ICS Security', buyingRole: 'Champion', relationship: 'Champion', stance: '支持', championAccessToPower: 3, championPoliticalWill: 3, championCredibility: 3, informalContactCount: 5, customerInitiatedCount: 3, hasWhatsapp: 1, hasWeChat: 0, reportingTo: 'Nurul Huda', notes: '综合评分9/9——强Champion。饭局3次、工厂参观2次。已帮助起草内部立项报告，在Ahmad面前多次力推AIStorm。' },
  { clientId: PET, name: 'Zainab Ibrahim', title: '采购经理', department: 'Procurement', buyingRole: '影响者', relationship: '已接触', stance: '中立', informalContactCount: 0, customerInitiatedCount: 0, reportingTo: 'CFO', notes: '⚠️ 采购流程关键守门人。对付款条件（要求Net 60）和SLA罚款条款有异议。Claroty已提交更宽松的合同版本施压。' },
  { clientId: CEN, name: 'Somchai Pattana', title: 'CTO', department: 'Technology', buyingRole: '经济决策人', relationship: '待接触', stance: '未知', informalContactCount: 0, customerInitiatedCount: 0, reportingTo: 'Group CEO', notes: '安全预算保守，历来"不出事不花钱"。必须用量化的罚款风险数字打动他。' },
  { clientId: CEN, name: 'Pranee Charoenwong', title: 'Data Privacy Officer', department: 'Legal & Compliance', buyingRole: 'Champion', relationship: '已接触', stance: '支持', championAccessToPower: 1, championPoliticalWill: 2, championCredibility: 2, informalContactCount: 1, customerInitiatedCount: 1, hasWhatsapp: 1, reportingTo: 'General Counsel', notes: '主动联系者，Big C罚款事件推动她行动。影响力有限（综合评分5/9，弱Champion），是我们目前唯一的内部线人。' },
  { clientId: CEN, name: 'Nattapong Siri', title: 'IT安全经理', department: 'IT', buyingRole: '技术决策人', relationship: '已接触', stance: '中立', informalContactCount: 0, customerInitiatedCount: 0, reportingTo: 'Somchai Pattana', notes: '技术上认可TrustOne方案，但决策权在CTO。透露上月有一台POS被勒索软件感染，靠断网处理，未上报。' },
];

for (const c of contacts) {
  const keys = Object.keys(c);
  const vals = Object.values(c);
  await run(
    `INSERT INTO key_contacts (${keys.join(',')},createdAt,updatedAt) VALUES (${keys.map(() => '?').join(',')},NOW(),NOW())`,
    vals
  );
  console.log(`✅ contact: ${c.name} (${c.buyingRole})`);
}

console.log('\n── STEP 6: 辅导建议（清空重建） ──');
await run(`DELETE FROM coaching_actions WHERE samId=? AND createdBy LIKE '%AD%'`, [samId]);

const actions = [
  { clientId: DBS, samId, samName, title: '星展银行：本月内完成James Wong的非正式接触验证', description: 'James Wong被标记为Champion，但所有3次接触均为正式会议，非正式接触次数=0，Political Will=2评分可能虚高。本月内需完成至少1次非正式接触。\n\n建议行动：\n① 以"AIStorm新加坡金融客户答谢晚宴"为由邀请James（8月中旬可安排）\n② 以MAS TRM 2.0合规研讨为由，邀请James参加我方组织的小型闭门交流\n③ 主动在LinkedIn互动，尝试建立工作外的话题连接\n\n完成后更新关键人档案的非正式接触记录，并重新评估Champion三维评分。', dueDate: new Date('2026-08-20'), isCompleted: false, createdBy: `${adName} (AD)` },
  { clientId: PET, samId, samName, title: 'Petronas：本周推动采购合同条款最终确认', description: 'P维度=50是当前最大风险。Zainab要求Net 60付款和SLA罚款条款，Claroty已提交更宽松版本施压。7月底截止，时间极紧。\n\n建议行动：\n① 本周内回复Zainab的合同条款：接受Net 45，SLA罚款条款提出反提案（罚款上限设为合同额2%）\n② 请Farid帮忙在Ahmad层面施加采购加速压力\n③ 准备一份本地化支持承诺书（马来西亚驻场工程师名单+响应时间SLA）', dueDate: new Date('2026-08-10'), isCompleted: false, createdBy: `${adName} (AD)` },
];

for (const a of actions) {
  const keys = Object.keys(a);
  const vals = Object.values(a);
  await run(`INSERT INTO coaching_actions (${keys.join(',')},createdAt,updatedAt) VALUES (${keys.map(() => '?').join(',')},NOW(),NOW())`, vals);
  console.log(`✅ coaching_action: ${a.title.slice(0, 40)}...`);
}

await conn.end();

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║         ✅ Demo 数据增强完成 v2                                ║
╠═══════════════════════════════════════════════════════════════╣
║  演示账号：                                                     ║
║    AD ：  leo.he@aistorm.com    (${adName})                    ║
║    SAM：  henry.sin@aistorm.com (${samName})                   ║
╠═══════════════════════════════════════════════════════════════╣
║  三个演示客户（均分配给 ${samName}）：                          ║
║    星展银行 (180002)        → 0→1，James Wong Champion警告     ║
║    马来西亚国家石油公司 (180003) → 1→N，P维度风险+竞品压力      ║
║    泰国中央百货 (180004)    → 0→1早期，EB未接触，弱Champion     ║
╚═══════════════════════════════════════════════════════════════╝
`);
