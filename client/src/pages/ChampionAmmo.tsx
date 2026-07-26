import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Shield, Sparkles, ChevronDown, ChevronUp, Download, BarChart2, AlertTriangle, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ClientSelector from "@/components/ClientSelector";
import { Streamdown } from "streamdown";
import { TermTooltip } from "@/components/TermTooltip";

const AMMO_TYPES = [
  { value: "竞品对标", label: "竞品对标", icon: BarChart2, desc: "帮Champion在内部说明为何选AIStorm" },
  { value: "合规风险量化", label: "合规风险量化", icon: AlertTriangle, desc: "量化不行动的合规代价" },
  { value: "ROI测算", label: "ROI测算", icon: DollarSign, desc: "为预算申请提供数据支撑" },
] as const;

const ammoTypeColor: Record<string, string> = {
  "竞品对标": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "合规风险量化": "bg-red-500/20 text-red-400 border-red-500/30",
  "ROI测算": "bg-green-500/20 text-green-400 border-green-500/30",
};

export default function ChampionAmmo() {
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [championName, setChampionName] = useState("");
  const [ammoType, setAmmoType] = useState<"竞品对标" | "合规风险量化" | "ROI测算">("竞品对标");
  const [generating, setGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: clients = [] } = trpc.clients.list.useQuery();
  const { data: ammoList = [], refetch } = trpc.champion.listByClient.useQuery(
    { clientId: selectedClientId! },
    { enabled: !!selectedClientId }
  );

  const selectedClient = clients.find(c => c.id === selectedClientId);
  const { data: meddpicc } = trpc.meddpicc.get.useQuery(
    { clientId: selectedClientId! },
    { enabled: !!selectedClientId }
  );

  const generate = trpc.champion.generate.useMutation({
    onSuccess: (data) => {
      refetch();
      setExpandedId(data.id);
      toast.success("弹药材料已生成");
      setGenerating(false);
    },
    onError: () => {
      toast.error("生成失败，请重试");
      setGenerating(false);
    },
  });

  const handleGenerate = () => {
    if (!selectedClientId || !championName.trim()) {
      toast.error("请选择客户并填写Champion姓名");
      return;
    }
    setGenerating(true);
    generate.mutate({
      clientId: selectedClientId,
      clientName: selectedClient?.name || "",
      industry: selectedClient?.industry || undefined,
      securityAngle: selectedClient?.securityAngle || undefined,
      notes: selectedClient?.notes || undefined,
      championName,
      ammoType,
    });
  };

  const handleDownload = (content: string, type: string, clientName: string) => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Champion弹药_${clientName}_${type}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">
            <TermTooltip term="Champion" label="Champion" showIcon={false} className="text-foreground border-none font-bold text-xl" />
            弹药库
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          为内部推动者持续生成汇报材料，让 
          <TermTooltip term="Champion" label="Champion" showIcon={true} className="text-muted-foreground" />
           在内部越来越有话语权
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Generator */}
        <div className="xl:col-span-1 space-y-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-sm font-semibold text-foreground mb-4">生成弹药材料</div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">目标客户</label>
                <ClientSelector selectedId={selectedClientId} onSelect={setSelectedClientId} className="flex-col" />
              </div>

              {selectedClient && meddpicc?.championName && (
                <div className="p-2 bg-muted/30 rounded-lg">
                  <div className="text-xs text-muted-foreground">已识别Champion：<span className="text-primary">{meddpicc.championName}</span></div>
                </div>
              )}

              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Champion姓名 *</label>
                <Input
                  className="h-8 text-sm"
                  placeholder={meddpicc?.championName || "输入Champion姓名"}
                  value={championName}
                  onChange={(e) => setChampionName(e.target.value)}
                  onFocus={() => { if (!championName && meddpicc?.championName) setChampionName(meddpicc.championName); }}
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">弹药类型</label>
                <div className="space-y-2">
                  {AMMO_TYPES.map((type) => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.value}
                        onClick={() => setAmmoType(type.value)}
                        className={cn(
                          "w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all",
                          ammoType === type.value
                            ? "border-primary/40 bg-primary/10"
                            : "border-border hover:border-muted-foreground/50"
                        )}
                      >
                        <Icon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", ammoType === type.value ? "text-primary" : "text-muted-foreground")} />
                        <div>
                          <div className={cn("text-sm font-medium", ammoType === type.value ? "text-foreground" : "text-muted-foreground")}>{type.label}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{type.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button
                className="w-full gap-2"
                onClick={handleGenerate}
                disabled={!selectedClientId || !championName.trim() || generating}
              >
                <Sparkles className="w-4 h-4" />
                {generating ? "AI生成中..." : "生成弹药材料"}
              </Button>
            </div>
          </div>
        </div>

        {/* Ammo Library */}
        <div className="xl:col-span-2">
          {!selectedClientId ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <Shield className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
              <div className="text-sm text-muted-foreground">选择客户后查看Champion弹药库</div>
            </div>
          ) : ammoList.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <Sparkles className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
              <div className="text-sm text-muted-foreground mb-1">弹药库为空</div>
              <div className="text-xs text-muted-foreground">为Champion生成内部汇报材料</div>
            </div>
          ) : (
            <div className="space-y-3">
              {ammoList.map((ammo) => (
                <div key={ammo.id} className="bg-card border border-border rounded-xl overflow-hidden">
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/20 transition-colors"
                    onClick={() => setExpandedId(expandedId === ammo.id ? null : ammo.id)}
                  >
                    <div className="flex items-center gap-3">
                      <span className={cn("text-xs px-2 py-1 rounded border font-medium", ammoTypeColor[ammo.ammoType])}>
                        {ammo.ammoType}
                      </span>
                      <div>
                        <div className="font-medium text-foreground">Champion: {ammo.championName}</div>
                        <div className="text-xs text-muted-foreground">{new Date(ammo.createdAt).toLocaleDateString("zh-CN")} 生成</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(ammo.content, ammo.ammoType, selectedClient?.name || "");
                        }}
                        className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      {expandedId === ammo.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>
                  {expandedId === ammo.id && (
                    <div className="border-t border-border p-4 bg-muted/5">
                      <div className="prose prose-sm prose-invert max-w-none">
                        <Streamdown>{ammo.content}</Streamdown>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
