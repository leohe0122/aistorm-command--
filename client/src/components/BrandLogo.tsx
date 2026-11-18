import { DEFAULT_BRANDING } from "@shared/branding";
import { cn } from "@/lib/utils";
import { useBranding } from "@/lib/branding";
import DefaultBrandMark from "./DefaultBrandMark";

// 品牌 Logo：已上传自定义 Logo 时显示图片；未上传且仍是默认品牌时显示内置图形；
// 其他公司未上传 Logo 时显示首字母方块 + 公司名，不借用默认品牌的图形。
export default function BrandLogo({ className, height = 32, showText = true }: { className?: string; height?: number; showText?: boolean }) {
  const { companyName, logoUrl } = useBranding();

  if (logoUrl) {
    return (
      <span className={cn("inline-flex items-center gap-2 flex-shrink-0", className)}>
        <img src={logoUrl} alt={companyName} style={{ height }} className="w-auto object-contain" />
        {showText && <span className="font-bold text-white tracking-tight" style={{ fontSize: height * 0.62 }}>{companyName}</span>}
      </span>
    );
  }
  if (companyName === DEFAULT_BRANDING.companyName) return <DefaultBrandMark className={className} height={height} showText={showText} />;
  return (
    <span className={cn("inline-flex items-center gap-2 flex-shrink-0", className)}>
      <span
        className="inline-flex items-center justify-center rounded-md font-bold text-white"
        style={{ width: height, height, fontSize: height * 0.5, background: "linear-gradient(135deg, #1B6FBF 0%, #00A8D6 100%)" }}
        aria-hidden="true"
      >
        {companyName.slice(0, 1).toUpperCase()}
      </span>
      {showText && <span className="font-bold text-white tracking-tight" style={{ fontSize: height * 0.62 }}>{companyName}</span>}
    </span>
  );
}
