import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

interface ClientSelectorProps {
  selectedId: number | null;
  onSelect: (id: number) => void;
  className?: string;
}

const stageColors: Record<string, string> = {
  "建图": "text-muted-foreground",
  "进门": "text-blue-400",
  "定痛": "text-yellow-400",
  "找人": "text-orange-400",
  "进入商机": "text-primary",
};

const priorityBadge: Record<string, string> = {
  "P0": "bg-red-500/20 text-red-400 border-red-500/30",
  "P1": "bg-orange-500/20 text-orange-400 border-orange-500/30",
  "P2": "bg-muted text-muted-foreground border-border",
};

export default function ClientSelector({ selectedId, onSelect, className }: ClientSelectorProps) {
  const { data: clients = [] } = trpc.clients.list.useQuery();

  return (
    <div className={cn("flex gap-2 flex-wrap", className)}>
      {clients.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all",
            selectedId === c.id
              ? "bg-primary/15 border-primary/40 text-foreground"
              : "bg-card border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground"
          )}
        >
          <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded border", priorityBadge[c.priority])}>
            {c.priority}
          </span>
          <span className="font-medium">{c.name}</span>
          <span className={cn("text-xs", stageColors[c.stage])}>{c.stage}</span>
        </button>
      ))}
    </div>
  );
}
