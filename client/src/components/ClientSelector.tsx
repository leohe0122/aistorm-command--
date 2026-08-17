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
          <span className="font-medium">{c.name}</span>
          <span className={cn("text-xs", stageColors[c.stage])}>{c.stage}</span>
        </button>
      ))}
    </div>
  );
}
