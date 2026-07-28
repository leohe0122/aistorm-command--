import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const DBS=180002, PET=180003, CEN=180004;

// MEDDPICC
for(const [cid,m,eb,dc,dp,pp,ip,ch,co] of [[DBS,50,25,50,25,0,75,50,75],[PET,75,75,75,50,50,100,75,50],[CEN,25,0,25,0,0,50,25,25]]) {
  try { await conn.execute(`INSERT IGNORE INTO meddpicc (clientId,metricsScore,economicBuyerScore,decisionCriteriaScore,decisionProcessScore,paperProcessScore,implicatePainScore,championScore,competitionScore,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,NOW(),NOW())`,[cid,m,eb,dc,dp,pp,ip,ch,co]); console.log('meddpicc '+cid); } catch(e){console.log('skip meddpicc '+cid+': '+e.message);}
}

// Key contacts
const contacts = [
  [DBS,'Kevin Lim','CISO','Information Security','技术决策人','已接触','中立',null],
  [DBS,'Sarah Chen','Head of Digital Banking','Digital Transformation','经济决策人','待接触','未知',null],
  [DBS,'James Wong','Senior Security Architect','IT Security','Champion','已接触','支持','Kevin Lim'],
  [DBS,'Michael Tan','VP Technology Risk','Risk Management','阻碍者','已接触','抵触',null],
  [PET,'Ahmad Razif','Group CIO','ICT','经济决策人','已接触','支持',null],
  [PET,'Nurul Huda','Head of OT Security','Cybersecurity','技术决策人','已接触','支持','Ahmad Razif'],
  [PET,'Farid Hassan','Senior Security Engineer','OT/ICS Security','Champion','已接触','强力支持','Nurul Huda'],
  [PET,'Zainab Ibrahim','Procurement Manager','Procurement','采购负责人','已接触','中立',null],
  [CEN,'Somchai Pattana','CTO','Technology','经济决策人','待接触','未知',null],
  [CEN,'Nattapong Siri','IT Security Manager','IT','技术决策人','已接触','中立','Somchai Pattana'],
  [CEN,'Pranee Charoenwong','Data Privacy Officer','Legal & Compliance','Champion','已接触','支持',null],
];
for(const [cid,name,title,dept,role,rel,stance,rto] of contacts) {
  try { await conn.execute(`INSERT INTO key_contacts (clientId,name,title,department,buyingRole,relationship,stance,reportingTo,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,NOW(),NOW())`,[cid,name,title,dept,role,rel,stance,rto]); console.log('contact '+name); } catch(e){console.log('skip '+name+': '+e.message);}
}

// Meetings
const meetings = [
  [DBS,'2025-04-15','拜访','Kevin Lim, James Wong','首次拜访，了解到DBS正在评估SOC升级方案，Kevin提到现有SIEM告警噪音太多，误报率高达60%。James对AI驱动的威胁检测很感兴趣，表示愿意安排POC。MAS合规要求是主要驱动力。'],
  [DBS,'2025-05-20','拜访','Kevin Lim, James Wong, Sarah Chen（短暂露面）','POC方案讨论，James已完成内部技术评估，认为AI XDR在检出率上有明显优势。Sarah Chen短暂出现，对ROI数据感兴趣，Kevin说Sarah是最终预算审批人。Michael Tan提出合规认证问题，需要提供MAS TRM指引的合规映射文档。'],
  [DBS,'2025-06-28','拜访','Kevin Lim, James Wong','POC结果汇报，AI XDR将误报率降低至15%，检出率提升至92%。Kevin表示技术层面满意，但需要Sarah Chen批准预算（约$450K）。James愿意帮安排与Sarah的会面。Michael Tan仍有顾虑，认为价格偏高。'],
  [PET,'2025-05-10','拜访','Ahmad Razif, Nurul Huda, Farid Hassan','深度技术交流，Farid演示了当前OT网络的安全盲区，有3个工厂的ICS系统完全没有网络监控。Ahmad明确表示这是集团2025年的Top 3安全优先项，预算已批准（$800K），正在评估3家供应商。Nurul要求提供Gartner评级和同行业案例。'],
  [PET,'2025-06-15','拜访','Nurul Huda, Farid Hassan, Zainab Ibrahim','方案提案，Farid对CloudGuard+NDR组合方案非常认可，Zainab开始询问采购流程和合同条款。竞争对手是Claroty和Dragos，我们在价格上有优势，在本地化支持上也更强。需要在7月底前完成最终方案提交。'],
  [CEN,'2025-06-05','拜访','Nattapong Siri, Pranee Charoenwong','初次接触，Pranee主动联系，因为PDPA执法机构刚对竞争对手Big C开出300万泰铢罚款，引发内部警觉。Nattapong表示POS系统有400+台终端，目前没有EDR保护。CTO Somchai还未接触，Pranee说他对安全投资持保守态度，需要有力的ROI数据。'],
];
for(const [cid,date,type,att,kp] of meetings) {
  try { await conn.execute(`INSERT INTO meeting_minutes (clientId,meetingDate,meetingType,attendees,keyPoints,createdAt,updatedAt) VALUES (?,?,?,?,?,NOW(),NOW())`,[cid,date,type,att,kp]); console.log('meeting '+cid+' '+date); } catch(e){console.log('skip meeting: '+e.message);}
}

// Opportunity for Petronas
try { await conn.execute(`INSERT INTO opportunities (clientId,name,stage,status,estimatedValue,competitorName,notes,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,NOW(),NOW())`,[PET,'Petronas OT安全平台项目','技术验证','active',800000,'Claroty, Dragos','CloudGuard+NDR组合方案，7月底截止']); console.log('opp inserted'); } catch(e){console.log('skip opp: '+e.message);}

// Intelligence signals
const sigs = [
  [DBS,'人事变动','紧急','DBS Bank任命新任CISO Kevin Lim，来自渣打银行，有丰富的AI安全平台实施经验。据悉其在渣打主导了XDR平台的全行部署。','2025-06-01'],
  [PET,'合规事件','紧急','Petronas旗下炼油厂遭受疑似APT攻击，OT系统短暂中断4小时，马来西亚国家网络安全局（NACSA）已介入调查。','2025-06-20'],
  [CEN,'合规事件','高','PDPC泰国对Big C超市开出300万泰铢罚款，原因是客户数据泄露事件处理不当。这是PDPA实施以来最大单笔罚款。','2025-07-01'],
];
for(const [cid,type,urgency,raw,date] of sigs) {
  try { await conn.execute(`INSERT INTO intelligence_signals (clientId,signalType,urgency,rawSignal,createdAt,updatedAt) VALUES (?,?,?,?,?,NOW())`,[cid,type,urgency,raw,date]); console.log('signal '+cid); } catch(e){console.log('skip signal: '+e.message);}
}

await conn.end();
console.log('\n✅ Done!');
