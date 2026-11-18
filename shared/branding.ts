// 品牌配置：每个部署（每家公司）可在“系统设置 → 品牌与产品线”中修改，保存在 system_config。
// 这里的默认值是 AIStorm 自己的口径；代码其他地方不得再写死公司名、产品名或联系人（见 server/branding.test.ts）。

export type Branding = {
  /** 我方公司名，用于登录页、页脚和 AI 提示词中的“我方” */
  companyName: string;
  /** 系统名称，用于页面标题、飞书消息、PWA 名称 */
  productName: string;
  /** 我方产品品牌（AI 提示词中“我方对应产品”的默认说法） */
  vendorName: string;
  /** 重点客户专项的名称（如“T100”），用于专项相关的标题与简报 */
  programName: string;
  /** 账号问题的联系人（登录页、飞书通知中“如有问题请联系 …”） */
  adminContact: string;
};

export const DEFAULT_BRANDING: Branding = {
  companyName: "AIStorm",
  productName: "AIStorm Command",
  vendorName: "亚信安全",
  programName: "T100",
  adminContact: "Leo",
};

export const BRANDING_CONFIG_KEY = "branding";
export const BRAND_LOGO_CONFIG_KEY = "brand_logo";
export const BRAND_LOGO_MAX_BYTES = 256 * 1024;
export const BRAND_LOGO_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

const LIMITS: Record<keyof Branding, number> = {
  companyName: 40,
  productName: 60,
  vendorName: 40,
  programName: 20,
  adminContact: 40,
};

/** 以默认值为底合并已保存的配置：未填、类型不对或过长的字段一律回退默认值。 */
export function resolveBranding(saved: unknown): Branding {
  const source = saved && typeof saved === "object" ? (saved as Record<string, unknown>) : {};
  const result = { ...DEFAULT_BRANDING };
  for (const key of Object.keys(LIMITS) as (keyof Branding)[]) {
    const value = source[key];
    if (typeof value === "string" && value.trim() && value.trim().length <= LIMITS[key]) result[key] = value.trim();
  }
  return result;
}

export function brandingFieldLimit(key: keyof Branding): number {
  return LIMITS[key];
}

/** 解析 data URL 形式的 Logo，校验类型与大小；不合法时返回 null。SVG 不接受（可内嵌脚本）。 */
export function parseLogoDataUrl(dataUrl: string): { mimeType: (typeof BRAND_LOGO_MIME_TYPES)[number]; data: Uint8Array } | null {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!match) return null;
  const mimeType = match[1] as (typeof BRAND_LOGO_MIME_TYPES)[number];
  const binary = typeof atob === "function" ? atob(match[2]) : Buffer.from(match[2], "base64").toString("binary");
  if (binary.length === 0 || binary.length > BRAND_LOGO_MAX_BYTES) return null;
  const data = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) data[i] = binary.charCodeAt(i);
  return { mimeType, data };
}

/**
 * 提示词与消息模板中的品牌占位符，如 {{brand.companyName}}。
 * 服务端在调用模型前统一替换（server/_core/llm.ts），模板里不再写死公司名。
 */
export const BRAND_TOKEN = (key: keyof Branding) => `{{brand.${key}}}`;

export function applyBrandTokens(text: string, branding: Branding): string {
  if (!text.includes("{{brand.")) return text;
  return text.replace(/\{\{brand\.(companyName|productName|vendorName|programName|adminContact)\}\}/g, (_, key: keyof Branding) => branding[key]);
}
