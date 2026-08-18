import { cn } from "@/lib/utils";

export function AIConfidenceBar({ signalDimensions, className }: { signalDimensions: number; className?: string }) {
  const normalized = Math.max(0, Math.min(signalDimensions, 8));
  const percent = Math.max(12, Math.round((normalized / 8) * 100));
  const tone = normalized >= 6
    ? { label: "高置信", bar: "bg-emerald-400", text: "text-emerald-300" }
    : normalized >= 3
      ? { label: "中置信", bar: "bg-amber-400", text: "text-amber-300" }
      : { label: "低置信", bar: "bg-rose-400", text: "text-rose-300" };

  return (
    <div className={cn("mt-2 flex items-center gap-2", className)} title={`基于 ${normalized} 个信号维度`}> 
      <div className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-white/10">
        <div className={cn("h-full rounded-full transition-all", tone.bar)} style={{ width: `${percent}%` }} />
      </div>
      <span className={cn("whitespace-nowrap text-[10px] font-medium", tone.text)}>{tone.label} · {normalized} 个信号维度</span>
    </div>
  );
}
