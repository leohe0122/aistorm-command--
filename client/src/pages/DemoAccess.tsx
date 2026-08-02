import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Copy, Plus, Trash2, Ban, ExternalLink, Shield, Eye, Clock, Download, FileText, CreditCard, X, Check } from "lucide-react";

// ── Token action dialog (link + PDF downloads) ───────────────────────────────
function TokenDialog({ recipientName, demoUrl, onClose }: {
  recipientName: string;
  demoUrl: string;
  onClose: () => void;
}) {
  const [linkCopied, setLinkCopied] = useState(false);
  const [downloading, setDownloading] = useState<"cards" | "manual" | null>(null);

  const copyLink = () => {
    navigator.clipboard.writeText(demoUrl).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  const downloadPdf = async (type: "cards" | "manual") => {
    setDownloading(type);
    try {
      const resp = await fetch(`/api/download-pdf/${type}?name=${encodeURIComponent(recipientName)}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = type === "cards"
        ? `AIStorm-Command-快速开始卡片-${recipientName}.pdf`
        : `AIStorm-Command-操作手册-${recipientName}.pdf`;
      a.click();
      URL.revokeObjectURL(objUrl);
      toast.success("PDF 已下载");
    } catch (e) {
      toast.error("下载失败", { description: String(e) });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <span className="font-semibold text-sm text-foreground">分发给：{recipientName}</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {/* Demo link */}
          <div>
            <div className="text-xs text-muted-foreground mb-2">演示链接（发给对方直接点击观看）</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground font-mono truncate">
                {demoUrl}
              </div>
              <Button size="sm" variant="outline" onClick={copyLink} className="gap-1.5 flex-shrink-0">
                {linkCopied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                {linkCopied ? "已复制" : "复制"}
              </Button>
            </div>
          </div>

          {/* PDF downloads */}
          <div>
            <div className="text-xs text-muted-foreground mb-2">培训文档（下载后通过微信/邮件发给对方）</div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 justify-start"
                disabled={downloading === "cards"}
                onClick={() => downloadPdf("cards")}
              >
                <CreditCard className="w-3.5 h-3.5 text-blue-400" />
                {downloading === "cards" ? "生成中..." : "快速开始卡片"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 justify-start"
                disabled={downloading === "manual"}
                onClick={() => downloadPdf("manual")}
              >
                <FileText className="w-3.5 h-3.5 text-cyan-400" />
                {downloading === "manual" ? "生成中..." : "操作手册"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">两份 PDF 均含「{recipientName}」水印，截图可溯源</p>
          </div>

          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={onClose}>完成</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DemoAccess() {
  const { user } = useAuth();
  const [form, setForm] = useState({ recipientName: "", recipientEmail: "", note: "", expiresInDays: "" });
  const [showCreate, setShowCreate] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [dialog, setDialog] = useState<{ name: string; url: string } | null>(null);

  const { data: tokens, refetch } = trpc.demoAccess.listTokens.useQuery();
  const createMut = trpc.demoAccess.createToken.useMutation({
    onSuccess: (data) => {
      const name = form.recipientName;
      setForm({ recipientName: "", recipientEmail: "", note: "", expiresInDays: "" });
      setShowCreate(false);
      refetch();
      setDialog({ name, url: data.url });
    },
    onError: (e) => toast.error("生成失败", { description: e.message }),
  });
  const revokeMut = trpc.demoAccess.revokeToken.useMutation({
    onSuccess: () => { toast.success("链接已撤销"); refetch(); },
  });
  const deleteMut = trpc.demoAccess.deleteToken.useMutation({
    onSuccess: () => { toast.success("记录已删除"); refetch(); },
  });

  if (!user || user.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Shield className="w-10 h-10 text-muted-foreground/40" />
        <div className="text-sm font-medium text-foreground">仅管理员可访问</div>
      </div>
    );
  }

  const copyLink = (token: string, id: number) => {
    const url = `https://command.aistorm.com/demo.html?token=${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      toast.success("链接已复制");
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {dialog && (
        <TokenDialog
          recipientName={dialog.name}
          demoUrl={dialog.url}
          onClose={() => setDialog(null)}
        />
      )}

      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <Shield className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Demo 分发管理</h1>
              <p className="text-xs text-muted-foreground">生成带鉴权的演示链接，下载定制水印培训包</p>
            </div>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            生成新链接
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Create form */}
        {showCreate && (
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <div className="text-sm font-medium text-foreground">生成新的演示访问链接</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">接收人姓名 *</label>
                <Input
                  placeholder="如：张总"
                  value={form.recipientName}
                  onChange={e => setForm(f => ({ ...f, recipientName: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">接收人邮箱（可选）</label>
                <Input
                  placeholder="用于水印溯源"
                  value={form.recipientEmail}
                  onChange={e => setForm(f => ({ ...f, recipientEmail: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">备注（可选）</label>
                <Input
                  placeholder="如：OT 演示 2026-08-05"
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">有效期（天，留空=永久）</label>
                <Input
                  placeholder="如：7"
                  type="number"
                  value={form.expiresInDays}
                  onChange={e => setForm(f => ({ ...f, expiresInDays: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>取消</Button>
              <Button
                size="sm"
                disabled={!form.recipientName || createMut.isPending}
                onClick={() => createMut.mutate({
                  recipientName: form.recipientName,
                  recipientEmail: form.recipientEmail || undefined,
                  note: form.note || undefined,
                  expiresInDays: form.expiresInDays ? parseInt(form.expiresInDays) : undefined,
                })}
              >
                {createMut.isPending ? "生成中..." : "生成链接"}
              </Button>
            </div>
          </div>
        )}

        {/* Token list */}
        {!tokens || tokens.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            暂无分发记录，点击「生成新链接」开始分发演示
          </div>
        ) : (
          <div className="space-y-2">
            {tokens.map(t => {
              const isExpired = t.expiresAt && new Date(t.expiresAt) < new Date();
              const statusColor = !t.isActive ? "text-red-400" : isExpired ? "text-orange-400" : "text-green-400";
              const statusLabel = !t.isActive ? "已撤销" : isExpired ? "已过期" : "有效";
              return (
                <div key={t.id} className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm text-foreground">{t.recipientName}</span>
                        {t.recipientEmail && (
                          <span className="text-xs text-muted-foreground">{t.recipientEmail}</span>
                        )}
                        <span className={`text-xs font-medium ${statusColor}`}>{statusLabel}</span>
                      </div>
                      {t.note && (
                        <div className="text-xs text-muted-foreground mb-2">{t.note}</div>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          访问 {t.accessCount} 次
                        </span>
                        {t.lastAccessAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            最后：{new Date(t.lastAccessAt).toLocaleString('zh-CN')}
                            {t.lastAccessIp && ` (${t.lastAccessIp})`}
                          </span>
                        )}
                        {t.expiresAt && (
                          <span>{isExpired ? "已于" : "至"} {new Date(t.expiresAt).toLocaleDateString('zh-CN')}</span>
                        )}
                        <span>{new Date(t.createdAt).toLocaleDateString('zh-CN')} 创建</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {t.isActive && !isExpired && (
                        <>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="复制链接"
                            onClick={() => copyLink(t.token, t.id)}>
                            <Copy className={`w-3.5 h-3.5 ${copiedId === t.id ? "text-green-400" : ""}`} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="打开 Demo"
                            onClick={() => window.open(`https://command.aistorm.com/demo.html?token=${t.token}`, '_blank')}>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="查看分发面板（链接 + PDF 下载）"
                            onClick={() => setDialog({ name: t.recipientName, url: `https://command.aistorm.com/demo.html?token=${t.token}` })}>
                            <Download className="w-3.5 h-3.5 text-blue-400" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-orange-400 hover:text-orange-300" title="撤销链接"
                            onClick={() => revokeMut.mutate({ id: t.id })}>
                            <Ban className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-300" title="删除记录"
                        onClick={() => deleteMut.mutate({ id: t.id })}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
