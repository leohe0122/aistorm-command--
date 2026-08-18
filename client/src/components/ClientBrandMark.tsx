import { cn } from "@/lib/utils";

const CLIENT_BRANDS: Record<string, { src: string; fallback: string; accent: string }> = {
  "美的集团": { src: "/manus-storage/midea_681e18f5.png", fallback: "M", accent: "bg-sky-500/20 text-sky-100" },
  "大疆创新": { src: "/manus-storage/dji_47b90e16.png", fallback: "DJ", accent: "bg-slate-400/20 text-slate-100" },
  "荣耀终端": { src: "/manus-storage/honor_35e99d25.png", fallback: "H", accent: "bg-indigo-500/20 text-indigo-100" },
  "传音控股": { src: "/manus-storage/transsion_ec60ada0.png", fallback: "T", accent: "bg-emerald-500/20 text-emerald-100" },
  "华大基因": { src: "/manus-storage/bgi_fbe4a400.png", fallback: "BG", accent: "bg-blue-500/20 text-blue-100" },
  "香港电讯": { src: "/manus-storage/hkt_ad77968c.png", fallback: "HKT", accent: "bg-fuchsia-500/20 text-fuchsia-100" },
  "星展银行": { src: "/manus-storage/dbs_acd3aad4.png", fallback: "DBS", accent: "bg-red-500/20 text-red-100" },
};

function initials(clientName: string) {
  const words = clientName.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words.map(word => word[0]).join("") : clientName.slice(0, 2)).toUpperCase();
}

export default function ClientBrandMark({ clientName, className }: { clientName: string; className?: string }) {
  const brand = CLIENT_BRANDS[clientName];
  const fallback = brand?.fallback ?? initials(clientName);

  return (
    <span
      className={cn("relative inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 shadow-sm", brand?.accent ?? "bg-cyan-500/15 text-cyan-100", className)}
      title={`${clientName} 品牌标识`}
    >
      <span aria-hidden="true" className="px-1 text-[9px] font-bold tracking-tight">{fallback}</span>
      {brand && (
        <img
          src={brand.src}
          alt={`${clientName} Logo`}
          className="absolute inset-0 z-10 h-full w-full bg-white object-contain p-0.5"
          onError={event => event.currentTarget.classList.add("hidden")}
        />
      )}
    </span>
  );
}
