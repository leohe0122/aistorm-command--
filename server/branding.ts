// 读取本部署的品牌配置与产品线目录（system_config），未配置时使用 shared 中的默认值。
// 读取结果缓存 30 秒；保存后立即清缓存。

import {
  BRAND_LOGO_CONFIG_KEY,
  BRANDING_CONFIG_KEY,
  parseLogoDataUrl,
  resolveBranding,
  type Branding,
} from "@shared/branding";
import { PRODUCT_CATALOG_CONFIG_KEY, resolveProductCatalog, type ProductCatalog } from "@shared/productCatalog";
import { getSystemConfig } from "./db";

const TTL_MS = 30_000;
const cache = new Map<string, { at: number; value: unknown }>();

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

export function clearBrandingCache() {
  cache.clear();
}

function parseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getBranding(): Promise<Branding> {
  return cached(BRANDING_CONFIG_KEY, async () =>
    resolveBranding(parseJson(await getSystemConfig(BRANDING_CONFIG_KEY).catch(() => null))));
}

export function getProductCatalog(): Promise<ProductCatalog> {
  return cached(PRODUCT_CATALOG_CONFIG_KEY, async () =>
    resolveProductCatalog(parseJson(await getSystemConfig(PRODUCT_CATALOG_CONFIG_KEY).catch(() => null))));
}

/** 已上传的 Logo（二进制）；未上传或数据无效时返回 null。 */
export function getBrandLogo(): Promise<{ mimeType: string; data: Uint8Array } | null> {
  return cached(BRAND_LOGO_CONFIG_KEY, async () => {
    const raw = await getSystemConfig(BRAND_LOGO_CONFIG_KEY).catch(() => null);
    return raw ? parseLogoDataUrl(raw) : null;
  });
}
