import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Swords, Plus, Trash2, Edit2, Save, X, Sparkles, Shield, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";

const COMPETITOR_TYPES = ["直接竞品", "替代方案", "内部自研", "其他"] as const;

export default function KillSheetsTab() {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [form, setForm] = useState({
    competitorName: "",
    competitorType: "直接竞品" as string,
    ourProduct: "",
    clientId: "" as string | number,
    weaknessesText: "",
    ourAdvantages: "",
    keyDiffs: "",
    battleNotes: "",
  });
  const [editData, setEditData] = useState<any>({});

  const utils = trpc.useUtils();
  const { data: killSheets = [], isLoading } = trpc.killSheets.list.useQuery();
  const { data: clients = [] } = trpc.clients.list.useQuery();

  const createMut = trpc.killSheets.create.useMutation({
    onSuccess: () => {
      utils.killSheets.list.invalidate();
      toast.success("阻击包已创建");
      setShowAdd(false);
      setForm({ competitorName: "", competitorType: "直接竞品", ourProduct: "", clientId: "", weaknessesText: "", ourAdvantages: "", keyDiffs: "", battleNotes: "" });
    },
    onError: (e) => toast.error("创建失败: " + e.message),
  });

  const updateMut = trpc.killSheets.update.useMutation({
    onSuccess: () => {
      utils.killSheets.list.invalidate();
      toast.success("已更新");
      setEditingId(null);
      setEditData({});
    },
    onError: (e) => toast.error("更新失败: " + e.message),
  });

  const deleteMut = trpc.killSheets.delete.useMutation({
    onSuccess: () => { utils.killSheets.list.invalidate(); toast.success("已删除"); },
    onError: (e) => toast.error("删除失败: " + e.message),
  });

  const generateMut = trpc.killSheets.generateTalk.useMutation({
    onSuccess: (data, vars) => {
      utils.killSheets.list.invalidate();
      toast.success("AI 差异化话术已生成");
      setGeneratingId(null);
      setExpandedId(vars.id);
    },
    onError: (e) => { toast.error("生成失败: " + e.message); setGeneratingId(null); },
  });

  const handleCopy = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-16">
      <Spinner className="w-6 h-6" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Swords className="w-4 h-4 text-orange-400" />
            竞品阻击包 Kill Sheets
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            针对每个竞品建立差异化话术库，AI 识别拜访日志中的竞品后自动推送阻击弹药
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowAdd(true)}>
          <Plus className="w-3.5 h-3.5" />
          新建阻击包
        </Button>
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="bg-muted/10 border border-primary/20 rounded-xl p-4 space-y-3">
          <div className="text-sm font-medium text-primary flex items-center gap-1.5">
            <Shield className="w-4 h-4" />
            新建竞品阻击包
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">竞品名称 *</label>
              <Input placeholder="如：QAX / Palo Alto / CrowdStrike" value={form.competitorName}
                onChange={(e) => setForm({ ...form, competitorName: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">竞品类型</label>
              <Select value={form.competitorType} onValueChange={(v) => setForm({ ...form, competitorType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{COMPETITOR_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">我方产品</label>
              <Input placeholder="如：Deep Discovery Inspector" value={form.ourProduct}
                onChange={(e) => setForm({ ...form, ourProduct: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">关联客户（可选）</label>
              <Select value={String(form.clientId)} onValueChange={(v) => setForm({ ...form, clientId: v === "none" ? "" : Number(v) })}>
                <SelectTrigger><SelectValue placeholder="通用阻击包" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">通用阻击包</SelectItem>
                  {(clients as any[]).map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">竞品弱点</label>
            <Textarea placeholder="竞品的主要弱点、痛点、已知问题..." className="h-16 resize-none text-sm"
              value={form.weaknessesText} onChange={(e) => setForm({ ...form, weaknessesText: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">我方优势</label>
            <Textarea placeholder="AIStorm/亚信安全的核心差异化优势..." className="h-16 resize-none text-sm"
              value={form.ourAdvantages} onChange={(e) => setForm({ ...form, ourAdvantages: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">关键差异点（每行一条）</label>
            <Textarea placeholder="本地化服务支持&#10;更低 TCO&#10;AI 原生检测引擎" className="h-16 resize-none text-sm"
              value={form.keyDiffs} onChange={(e) => setForm({ ...form, keyDiffs: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">作战备注</label>
            <Textarea placeholder="历史交锋经验、注意事项..." className="h-12 resize-none text-sm"
              value={form.battleNotes} onChange={(e) => setForm({ ...form, battleNotes: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={!form.competitorName || createMut.isPending}
              onClick={() => createMut.mutate({ ...form, clientId: form.clientId ? Number(form.clientId) : undefined, weaknesses: undefined })}>
              {createMut.isPending ? <Spinner className="w-3 h-3 mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
              创建
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>取消</Button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {(killSheets as any[]).length === 0 && !showAdd && (
        <div className="text-center py-12 border border-dashed border-border rounded-xl">
          <Swords className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm text-muted-foreground">暂无竞品阻击包</p>
          <p className="text-xs text-muted-foreground mt-1">针对每个竞品建立差异化话术，在拜访日志中识别竞品时自动推送</p>
        </div>
      )}

      {/* Kill Sheets List */}
      <div className="space-y-3">
        {(killSheets as any[]).map((ks: any) => {
          const isExpanded = expandedId === ks.id;
          const isEditing = editingId === ks.id;
          const clientName = (clients as any[]).find((c: any) => c.id === ks.clientId)?.name;

          return (
            <div key={ks.id} className="bg-card border border-border rounded-xl overflow-hidden">
              {/* Card Header */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <Swords className="w-4 h-4 text-orange-400" />
                        {ks.competitorName}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{ks.competitorType}</Badge>
                      {ks.ourProduct && (
                        <span className="text-xs text-cyan-400 flex items-center gap-1">
                          <Shield className="w-3 h-3" />{ks.ourProduct}
                        </span>
                      )}
                      {clientName && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
                          {clientName}
                        </Badge>
                      )}
                      {!ks.clientId && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">通用</Badge>
                      )}
                    </div>
                    {ks.keyDiffs && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {ks.keyDiffs.split("\n").filter(Boolean).slice(0, 3).map((d: string, i: number) => (
                          <span key={i} className="text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 px-1.5 py-0.5 rounded">
                            {d}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-primary hover:text-primary"
                      disabled={generatingId === ks.id}
                      onClick={() => { setGeneratingId(ks.id); generateMut.mutate({ id: ks.id }); }}>
                      {generatingId === ks.id ? <Spinner className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                      AI 生成话术
                    </Button>
                    <button onClick={() => setExpandedId(isExpanded ? null : ks.id)}
                      className="text-muted-foreground hover:text-foreground p-1 transition-colors">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button onClick={() => { setEditingId(ks.id); setEditData({ ...ks }); }}
                      className="text-muted-foreground hover:text-foreground p-1 transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteMut.mutate({ id: ks.id })}
                      className="text-muted-foreground hover:text-red-400 p-1 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded Detail */}
              {isExpanded && !isEditing && (
                <div className="border-t border-border bg-muted/5 p-4 space-y-3">
                  {ks.weaknesses && (
                    <div>
                      <div className="text-xs font-medium text-orange-400 mb-1 flex items-center gap-1">
                        <Swords className="w-3 h-3" /> 竞品弱点
                      </div>
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">{ks.weaknesses}</p>
                    </div>
                  )}
                  {ks.ourAdvantages && (
                    <div>
                      <div className="text-xs font-medium text-green-400 mb-1 flex items-center gap-1">
                        <Shield className="w-3 h-3" /> 我方优势
                      </div>
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">{ks.ourAdvantages}</p>
                    </div>
                  )}
                  {ks.battleNotes && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">作战备注</div>
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">{ks.battleNotes}</p>
                    </div>
                  )}
                  {ks.aiGeneratedTalk && (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-medium text-primary flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" /> AI 差异化话术
                        </div>
                        <button onClick={() => handleCopy(ks.aiGeneratedTalk, ks.id)}
                          className="text-muted-foreground hover:text-foreground transition-colors p-1">
                          {copiedId === ks.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <div className="text-xs prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown>{ks.aiGeneratedTalk}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Edit Form */}
              {isEditing && (
                <div className="border-t border-border bg-muted/5 p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">竞品名称</label>
                      <Input value={editData.competitorName || ""} onChange={(e) => setEditData({ ...editData, competitorName: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">我方产品</label>
                      <Input value={editData.ourProduct || ""} onChange={(e) => setEditData({ ...editData, ourProduct: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">竞品弱点</label>
                    <Textarea className="h-16 resize-none text-sm" value={editData.weaknesses || ""}
                      onChange={(e) => setEditData({ ...editData, weaknesses: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">我方优势</label>
                    <Textarea className="h-16 resize-none text-sm" value={editData.ourAdvantages || ""}
                      onChange={(e) => setEditData({ ...editData, ourAdvantages: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">关键差异点</label>
                    <Textarea className="h-16 resize-none text-sm" value={editData.keyDiffs || ""}
                      onChange={(e) => setEditData({ ...editData, keyDiffs: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">作战备注</label>
                    <Textarea className="h-12 resize-none text-sm" value={editData.battleNotes || ""}
                      onChange={(e) => setEditData({ ...editData, battleNotes: e.target.value })} />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={updateMut.isPending}
                      onClick={() => updateMut.mutate({ id: ks.id, ...editData })}>
                      {updateMut.isPending ? <Spinner className="w-3 h-3 mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                      保存
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setEditData({}); }}>取消</Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
