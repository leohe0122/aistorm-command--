import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Copy, Plus, Trash2, Ban, ExternalLink, Shield, Eye, Clock, Download, Send, FileText, CreditCard, X } from "lucide-react";

// ── Share message dialog ──────────────────────────────────────────────────────
function ShareDialog({ recipientName, demoUrl, onClose }: {
  recipientName: string;
  demoUrl: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const message = `${recipientName}，你好！

这是 AIStorm Command 系统的演示链接，供您参考：

🎬 演示视频（含语音讲解，约 5 分钟）：
${demoUrl}

如需了解更多或安排现场演示，欢迎随时联系。`;

  const handleCopy = () => {
    navigator.clipboard.writeText(message).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-purple-400" />
            <span className="font-semibold text-sm text-foreground">分发消息已就绪</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-muted-foreground">复制以下内容，通过微信 / 邮件 / WhatsApp 发送给对方：</p>
          <div className="bg-background border border-border rounded-lg p-4 text-sm text-foreground whitespace-pre-wrap leading-relaxed font-mono text-xs">
            {message}
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={onClose}>关闭</Button>
            <Button size="sm" onClick={handleCopy} className="gap-1.5">
              <Copy className="w-3.5 h-3.5" />
              {copied ? "已复制 ✓" : "一键复制"}
            </Button>
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
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [shareInfo, setShareInfo] = useState<{ name: string; url: string } | null>(null);

  const { data: tokens, refetch } = trpc.demoAccess.listTokens.useQuery();
  const createMut = trpc.demoAccess.createToken.useMutation({
    onSuccess: (data) => {
      const recipientName = form.recipientName;
      setForm({ recipientName: "", recipientEmail: "", note: "", expiresInDays: "" });
      setShowCreate(false);
      refetch();
      // Show share dialog
      setShareInfo({ name: recipientName, url: data.url });
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

  const downloadPdf = async (recipientName: string, type: "cards" | "manual", key: string) => {
    setDownloadingId(key);
    try {
      const url = `/api/download-pdf/${type}?name=${encodeURIComponent(recipientName)}`;
      const resp = await fetch(url);
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
      setDownloadingId(null);
    }
  };

  const copyLink = (token: string, id: number) => {
    const url = `https://command.aistorm.com/demo.html?token=${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      toast.success("链接已复制");
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const openShareDialog = (token: string, recipientName: string) => {
    const url = `https://command.aistorm.com/demo.html?token=${token}`;
    setShareInfo({ name: recipientName, url });
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Share dialog */}
      {shareInfo && (
        <ShareDialog
          recipientName={shareInfo.name}
          demoUrl={shareInfo.url}
          onClose={() => setShareInfo(null)}
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
              <p className="text-xs text-muted-foreground">生成带鉴权的演示链接，追踪访问记录，下载定制水印培训包</p>
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
                            最后访问：{new Date(t.lastAccessAt).toLocaleString('zh-CN')}
                            {t.lastAccessIp && ` (${t.lastAccessIp})`}
                          </span>
                        )}
                        {t.expiresAt && (
                          <span>
                            {isExpired ? "已于" : "有效至"} {new Date(t.expiresAt).toLocaleDateString('zh-CN')}
                          </span>
                        )}
                        <span>创建于 {new Date(t.createdAt).toLocaleDateString('zh-CN')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {t.isActive && !isExpired && (
                        <>
                          {/* Copy demo link */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="复制 Demo 链接"
                            onClick={() => copyLink(t.token, t.id)}
                          >
                            <Copy className={`w-3.5 h-3.5 ${copiedId === t.id ? "text-green-400" : ""}`} />
                          </Button>
                          {/* Open demo */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="在新标签打开 Demo"
                            onClick={() => window.open(`https://command.aistorm.com/demo.html?token=${t.token}`, '_blank')}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                          {/* Share message */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-purple-400 hover:text-purple-300"
                            title="生成分发消息（可复制发给对方）"
                            onClick={() => openShareDialog(t.token, t.recipientName)}
                          >
                            <Send className="w-3.5 h-3.5" />
                          </Button>
                          {/* Download cards PDF */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-blue-400 hover:text-blue-300"
                            title="下载快速开始卡片（带水印）"
                            disabled={downloadingId === `cards-${t.id}`}
                            onClick={() => downloadPdf(t.recipientName, "cards", `cards-${t.id}`)}
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                          </Button>
                          {/* Download manual PDF */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-cyan-400 hover:text-cyan-300"
                            title="下载操作手册（带水印）"
                            disabled={downloadingId === `manual-${t.id}`}
                            onClick={() => downloadPdf(t.recipientName, "manual", `manual-${t.id}`)}
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </Button>
                          {/* Revoke */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-orange-400 hover:text-orange-300"
                            title="撤销链接"
                            onClick={() => revokeMut.mutate({ id: t.id })}
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-400 hover:text-red-300"
                        title="删除记录"
                        onClick={() => deleteMut.mutate({ id: t.id })}
                      >
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
