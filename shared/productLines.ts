/**
 * 亚信科技 + 亚信安全 产品线分类体系
 * Leo 定义的两大类产品线，用于武器库文档标签和 AI 洞察匹配
 */

export interface ProductLineItem {
  value: string;
  label: string;
  category: '亚信科技' | '亚信安全';
  description: string; // 用于 AI 识别的描述
}

export const PRODUCT_LINES: ProductLineItem[] = [
  // ── 亚信科技类（敲门砖热点类，需根据用户情况定制）──
  {
    value: '算力',
    label: '算力',
    category: '亚信科技',
    description: '算力基础设施、GPU算力、AI算力平台、算力调度',
  },
  {
    value: 'Token运营平台',
    label: 'Token 运营平台 / Token ERP',
    category: '亚信科技',
    description: 'Token运营、Token ERP、数字资产管理、Token经济',
  },
  {
    value: '物理AI',
    label: '物理 AI',
    category: '亚信科技',
    description: '物理AI、具身智能、机器人AI、工业AI、边缘AI',
  },
  {
    value: '卫星互联',
    label: '卫星互联',
    category: '亚信科技',
    description: '卫星通信、低轨卫星、星链、卫星互联网、天地一体',
  },

  // ── 亚信安全类（安全标品，可直接交付）──
  {
    value: 'AI XDR',
    label: 'AI XDR 平台',
    category: '亚信安全',
    description: 'XDR、扩展检测响应、威胁检测、安全运营、SIEM、SOC、AI安全平台、统一安全平台',
  },
  {
    value: 'TrustOne',
    label: 'TrustOne（办公网终端 AV/EDR/虚拟补丁）',
    category: '亚信安全',
    description: 'TrustOne、办公网、终端安全、AV、EDR、虚拟补丁、端点防护、杀毒、防病毒、终端检测响应',
  },
  {
    value: 'CloudGuard',
    label: 'CloudGuard（CWPP 数据中心/云主机 AV/EDR/虚拟补丁）',
    category: '亚信安全',
    description: 'CloudGuard、CWPP、云工作负载保护、数据中心、云主机、服务器安全、云安全、容器安全、虚拟化安全',
  },
  {
    value: 'NDR',
    label: 'NDR（ThreatTrace / ThreatShield / PhishShield）',
    category: '亚信安全',
    description: 'NDR、网络检测响应、ThreatTrace、ThreatShield、PhishShield、网络流量分析、钓鱼防护、网络威胁检测',
  },
  {
    value: '威胁情报',
    label: '威胁情报',
    category: '亚信安全',
    description: '威胁情报、IOC、TIP、情报平台、威胁数据、攻击指标、安全情报',
  },
  {
    value: 'AI智能体身份安全',
    label: 'AI 智能体身份安全',
    category: '亚信安全',
    description: 'AI智能体、身份安全、IAM、零信任身份、ZTNA、身份治理、AI Agent安全、MCP安全',
  },
  {
    value: '安全服务',
    label: '安全服务（EASM / 渗透测试 / 红队 / MDR）',
    category: '亚信安全',
    description: 'EASM、攻击面管理、渗透测试、红队、红蓝对抗、MDR、托管检测响应、安全服务、安全咨询',
  },
  {
    value: 'AI大模型防火墙',
    label: 'AI 大模型防火墙',
    category: '亚信安全',
    description: 'AI大模型防火墙、大模型安全、LLM安全、AI防火墙、大模型防护、AI应用安全、提示词注入防护、模型访问控制',
  },
  {
    value: 'OEM产品',
    label: 'OEM 产品',
    category: '亚信安全',
    description: 'OEM产品、贴牌产品、合作伙伴集成、OEM安全产品、合作方案',
  },
];

export const PRODUCT_LINE_VALUES = PRODUCT_LINES.map(p => p.value);

/** 按大类分组 */
export const PRODUCT_LINE_GROUPS = {
  '亚信科技': PRODUCT_LINES.filter(p => p.category === '亚信科技'),
  '亚信安全': PRODUCT_LINES.filter(p => p.category === '亚信安全'),
};

/** 生成 AI 识别用的产品线说明文本 */
export function getProductLinePrompt(): string {
  return PRODUCT_LINES.map(p =>
    `- ${p.value}（${p.category}）：${p.description}`
  ).join('\n');
}
