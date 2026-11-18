import { cn } from "@/lib/utils";

// 客户标识：显示客户名缩写。不再内置任何客户的 Logo（迁出 Manus 时随旧客户一并放弃）。

const ACCENTS = [
  "bg-cyan-500/15 text-cyan-100",
  "bg-sky-500/20 text-sky-100",
  "bg-indigo-500/20 text-indigo-100",
  "bg-emerald-500/20 text-emerald-100",
  "bg-fuchsia-500/20 text-fuchsia-100",
  "bg-amber-500/20 text-amber-100",
];

export function clientInitials(clientName: string) {
  const words = clientName.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words.map(word => word[0]).join("") : clientName.slice(0, 2)).toUpperCase();
}

function accentFor(clientName: string) {
  let hash = 0;
  for (const char of clientName) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return ACCENTS[hash % ACCENTS.length];
}

export default function ClientBrandMark({ clientName, className }: { clientName: string; className?: string }) {
  return (
    <span
      className={cn("relative inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 shadow-sm", accentFor(clientName), className)}
      title={clientName}
    >
      <span aria-hidden="true" className="px-1 text-[9px] font-bold tracking-tight">{clientInitials(clientName)}</span>
    </span>
  );
}
