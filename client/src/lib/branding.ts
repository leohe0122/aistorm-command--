import { useEffect } from "react";
import { DEFAULT_BRANDING, type Branding } from "@shared/branding";
import { DEFAULT_PRODUCT_CATALOG, type ProductCatalog } from "@shared/productCatalog";
import { trpc } from "@/lib/trpc";

export type ClientBranding = Branding & { logoUrl: string | null };

/** 本部署的品牌配置；加载完成前使用默认值，避免页面闪烁。 */
export function useBranding(): ClientBranding {
  const { data } = trpc.branding.get.useQuery(undefined, { staleTime: 5 * 60_000, retry: 1 });
  return data ?? { ...DEFAULT_BRANDING, logoUrl: null };
}

/** 本部署的产品线目录（需登录）。 */
export function useProductCatalog(): ProductCatalog {
  const { data } = trpc.branding.productCatalog.useQuery(undefined, { staleTime: 5 * 60_000 });
  return data ?? DEFAULT_PRODUCT_CATALOG;
}

/** 页面标题跟随系统名称。 */
export function useBrandTitle() {
  const { productName } = useBranding();
  useEffect(() => {
    document.title = productName;
  }, [productName]);
}
