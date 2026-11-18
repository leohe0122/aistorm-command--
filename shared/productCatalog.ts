// 产品线目录：武器库的产品线文件夹、文档上传时的 AI 归类都以它为准。
// 每个部署可在“系统设置 → 品牌与产品线”中修改（保存在 system_config 的 product_catalog）；
// 这里的默认值是 AIStorm 的产品线。文档按 value 归档，已有文档的产品线 value 不应随意改名。

export type ProductLine = {
  /** 归档键：写入 product_docs.productLine，改名会让已归档文档找不到所属产品线 */
  value: string;
  /** 显示名称 */
  label: string;
  /** 所属分组（文件夹网格按分组展示） */
  group: string;
  /** 文件夹图标（一个 emoji） */
  icon: string;
  /** 文件夹上的一句话说明 */
  summary: string;
  /** 供 AI 归类文档用的关键词描述 */
  description: string;
};

export type ProductGroup = { name: string; subtitle: string };
export type ProductCatalog = { groups: ProductGroup[]; lines: ProductLine[] };

export const PRODUCT_CATALOG_CONFIG_KEY = "product_catalog";

export const DEFAULT_PRODUCT_CATALOG: ProductCatalog = {
  groups: [
    { name: "亚信科技", subtitle: "热点敲门砖产品线（定制化方案）" },
    { name: "亚信安全", subtitle: "安全标品（可直接交付）" },
    { name: "其他", subtitle: "参考资料库" },
  ],
  lines: [
    { value: "算力", label: "算力", group: "亚信科技", icon: "⚡", summary: "AI算力基础设施、GPU集群、算力租赁", description: "算力基础设施、GPU算力、AI算力平台、算力调度" },
    { value: "Token运营平台", label: "Token 运营平台", group: "亚信科技", icon: "🪙", summary: "Token ERP、数字资产运营管理", description: "Token运营、Token ERP、数字资产管理、Token经济" },
    { value: "物理AI", label: "物理 AI", group: "亚信科技", icon: "🤖", summary: "具身智能、机器人、物理世界AI应用", description: "物理AI、具身智能、机器人AI、工业AI、边缘AI" },
    { value: "卫星互联", label: "卫星互联", group: "亚信科技", icon: "🛰️", summary: "卫星通信、低轨卫星网络、天地一体", description: "卫星通信、低轨卫星、星链、卫星互联网、天地一体" },
    { value: "AI XDR", label: "AI XDR 平台", group: "亚信安全", icon: "🏛️", summary: "跨层威胁检测响应、AI驱动XDR平台", description: "XDR、扩展检测响应、威胁检测、安全运营、SIEM、SOC、AI安全平台、统一安全平台" },
    { value: "TrustOne", label: "TrustOne", group: "亚信安全", icon: "🛡️", summary: "办公网终端 AV / EDR / 虚拟补丁", description: "TrustOne、办公网、终端安全、AV、EDR、虚拟补丁、端点防护、杀毒、防病毒、终端检测响应" },
    { value: "CloudGuard", label: "CloudGuard", group: "亚信安全", icon: "☁️", summary: "CWPP 数据中心及云主机安全防护", description: "CloudGuard、CWPP、云工作负载保护、数据中心、云主机、服务器安全、云安全、容器安全、虚拟化安全" },
    { value: "NDR", label: "NDR 系列", group: "亚信安全", icon: "🌐", summary: "ThreatTrace / ThreatShield / PhishShield", description: "NDR、网络检测响应、ThreatTrace、ThreatShield、PhishShield、网络流量分析、钓鱼防护、网络威胁检测" },
    { value: "威胁情报", label: "威胁情报", group: "亚信安全", icon: "🔍", summary: "威胁情报平台、IOC、APT追踪", description: "威胁情报、IOC、TIP、情报平台、威胁数据、攻击指标、安全情报" },
    { value: "AI智能体身份安全", label: "AI 智能体身份安全", group: "亚信安全", icon: "🔐", summary: "AI Agent身份认证、零信任访问控制", description: "AI智能体、身份安全、IAM、零信任身份、ZTNA、身份治理、AI Agent安全、MCP安全" },
    { value: "安全服务", label: "安全服务", group: "亚信安全", icon: "🎯", summary: "EASM / 渗透测试 / 红队 / MDR", description: "EASM、攻击面管理、渗透测试、红队、红蓝对抗、MDR、托管检测响应、安全服务、安全咨询" },
    { value: "AI大模型防火墙", label: "AI 大模型防火墙", group: "亚信安全", icon: "🔥", summary: "大模型安全、LLM防护、提示词注入防御", description: "AI大模型防火墙、大模型安全、LLM安全、AI防火墙、大模型防护、AI应用安全、提示词注入防护、模型访问控制" },
    { value: "OEM产品", label: "OEM 产品", group: "亚信安全", icon: "🏷️", summary: "OEM合作产品、贴牌安全产品、合作伙伴集成方案", description: "OEM产品、贴牌产品、合作伙伴集成、OEM安全产品、合作方案" },
    { value: "其他参考资料", label: "其他参考资料", group: "其他", icon: "📚", summary: "竞品分析 / 行业报告 / 客户案例", description: "竞品分析 / 行业报告 / 客户案例" },
  ],
};

const MAX_LINES = 60;
const MAX_GROUPS = 12;
const str = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/** 校验并规范化产品线目录；返回问题列表（为空表示可保存）。 */
export function validateProductCatalog(input: unknown): { catalog: ProductCatalog; problems: string[] } {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const problems: string[] = [];
  const groups: ProductGroup[] = (Array.isArray(raw.groups) ? raw.groups : []).slice(0, MAX_GROUPS)
    .map(group => ({ name: str((group as any)?.name, 30), subtitle: str((group as any)?.subtitle, 60) }))
    .filter(group => group.name);
  const groupNames = new Set(groups.map(group => group.name));
  if (groups.length === 0) problems.push("至少需要一个分组");
  if (groupNames.size !== groups.length) problems.push("分组名称不能重复");

  const lines: ProductLine[] = [];
  const values = new Set<string>();
  for (const item of (Array.isArray(raw.lines) ? raw.lines : []).slice(0, MAX_LINES)) {
    const line: ProductLine = {
      value: str((item as any)?.value, 100),
      label: str((item as any)?.label, 60),
      group: str((item as any)?.group, 30),
      icon: str((item as any)?.icon, 8) || "📁",
      summary: str((item as any)?.summary, 80),
      description: str((item as any)?.description, 300),
    };
    if (!line.value || !line.label) { problems.push("每条产品线都需要归档键和显示名称"); continue; }
    if (values.has(line.value)) problems.push(`产品线归档键重复：${line.value}`);
    if (!groupNames.has(line.group)) problems.push(`产品线「${line.label}」的分组「${line.group}」不存在`);
    values.add(line.value);
    lines.push({ ...line, description: line.description || line.summary || line.label });
  }
  if (lines.length === 0) problems.push("至少需要一条产品线");
  return { catalog: { groups, lines }, problems };
}

/** 已保存的目录无效时回退默认值，保证页面与 AI 归类始终可用。 */
export function resolveProductCatalog(saved: unknown): ProductCatalog {
  if (!saved) return DEFAULT_PRODUCT_CATALOG;
  const { catalog, problems } = validateProductCatalog(saved);
  return problems.length ? DEFAULT_PRODUCT_CATALOG : catalog;
}

/** 生成 AI 识别用的产品线说明文本。 */
export function productLinePrompt(catalog: ProductCatalog): string {
  return catalog.lines.map(line => `- ${line.value}（${line.group}）：${line.description}`).join("\n");
}
