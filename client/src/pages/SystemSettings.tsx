import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Settings, Rss, Database, Bell, Plus, Trash2, ToggleLeft, ToggleRight,
  CheckCircle2, XCircle, ExternalLink, Eye, EyeOff, RefreshCw, Send,
  Info, Upload, User, Briefcase, ArrowDownToLine, Download, Webhook, Clock, Save
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// ── RSS Sources Tab ─────────────────────────────────────────────────────────
function RssSourcesTab() {
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const { data: sources = [], refetch } = trpc.rss.listSources.useQuery();
  const addSource = trpc.rss.addSource.useMutation({ onSuccess: () => { refetch(); setShowForm(false); setNewName(""); setNewUrl(""); setNewDesc(""); toast.success("RSS 信息源已添加"); } });
  const toggleSource = trpc.rss.toggleSource.useMutation({ onSuccess: () => refetch() });
  const deleteSource = trpc.rss.deleteSource.useMutation({ onSuccess: () => { refetch(); toast.success("已删除"); } });

  const handleAdd = async () => {
    if (!newName.trim()) { toast.error("请填写信息源名称"); return; }
    if (!newUrl.trim()) { toast.error("请填写 RSS 链接"); return; }
    try { new URL(newUrl); } catch { toast.error("RSS 链接格式不正确"); return; }
    setAdding(true);
    try { await addSource.mutateAsync({ name: newName.trim(), url: newUrl.trim(), description: newDesc.trim() || undefined }); }
    finally { setAdding(false); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">自定义 RSS 信息源</h3>
          <p className="text-sm text-muted-foreground mt-1">
            添加第三方情报 RSS 链接，客户情报雷达将自动抓取并过滤相关新闻。
            未添加自定义源时，默认使用 Google News RSS。
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)} className="flex-shrink-0">
          <Plus className="w-4 h-4 mr-1.5" />
          添加信息源
        </Button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="border border-border rounded-lg p-4 space-y-3 bg-card/50">
          <div className="text-sm font-medium text-foreground">新增 RSS 信息源</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">信息源名称 *</label>
              <Input
                placeholder="例：LinkedIn 科技行业动态"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">RSS 链接 *</label>
              <Input
                placeholder="https://example.com/feed.rss"
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">描述（可选）</label>
            <Input
              placeholder="简短描述这个信息源的内容范围"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={handleAdd} disabled={adding}>
              {adding ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
              确认添加
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>取消</Button>
          </div>
        </div>
      )}

      {/* Default source notice */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
        <Rss className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
        <div>
          <div className="text-sm font-medium text-blue-300">默认信息源：Google News RSS</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            按客户名称自动搜索，无需配置，免费使用。添加自定义源后，两者同时生效。
          </div>
        </div>
        <div className="ml-auto flex-shrink-0">
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">已启用</span>
        </div>
      </div>

      {/* Custom sources list */}
      {sources.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <Rss className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <div className="text-sm">暂无自定义信息源</div>
          <div className="text-xs mt-1">点击「添加信息源」接入购买的第三方情报 RSS</div>
        </div>
      ) : (
        <div className="space-y-2">
          {sources.map((src: any) => (
            <div key={src.id} className={cn(
              "flex items-center gap-3 p-3 rounded-lg border transition-colors",
              src.isActive ? "border-border bg-card/30" : "border-border/50 bg-muted/10 opacity-60"
            )}>
              <Rss className={cn("w-4 h-4 flex-shrink-0", src.isActive ? "text-cyan-400" : "text-muted-foreground")} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{src.name}</div>
                <div className="text-xs text-muted-foreground truncate">{src.url}</div>
                {src.description && <div className="text-xs text-muted-foreground/70 mt-0.5">{src.description}</div>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={cn("text-xs px-2 py-0.5 rounded-full border",
                  src.isActive ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-muted/30 text-muted-foreground border-border"
                )}>
                  {src.isActive ? "启用" : "停用"}
                </span>
                <button
                  onClick={() => toggleSource.mutate({ id: src.id, isActive: !src.isActive })}
                  className="p-1.5 rounded hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
                  title={src.isActive ? "停用" : "启用"}
                >
                  {src.isActive ? <ToggleRight className="w-4 h-4 text-green-400" /> : <ToggleLeft className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => { if (confirm(`确认删除「${src.name}」？`)) deleteSource.mutate({ id: src.id }); }}
                  className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                  title="删除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Feishu Briefing Tab ─────────────────────────────────────────────────────
function FeishuBriefingTab() {
  const [webhook, setWebhook] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const { data: configs = [], isLoading, refetch } = trpc.systemConfig.getAll.useQuery();
  const setConfig = trpc.systemConfig.set.useMutation({ onSuccess: () => refetch() });

  useEffect(() => {
    if (configs.length > 0) {
      const wh = (configs as any[]).find(c => c.configKey === "feishu_daily_briefing_webhook");
      const en = (configs as any[]).find(c => c.configKey === "feishu_daily_briefing_enabled");
      if (wh?.configValue) setWebhook(wh.configValue);
      if (en) setEnabled(en.configValue !== "false");
    }
  }, [configs]);

  const handleSave = async () => {
    if (!webhook.trim()) { toast.error("请填写飞书 Webhook 地址"); return; }
    if (!webhook.startsWith("https://open.feishu.cn/open-apis/bot/v2/hook/")) {
      toast.error("Webhook 格式不正确，应以 https://open.feishu.cn/open-apis/bot/v2/hook/ 开头"); return;
    }
    setSaving(true);
    try {
      await setConfig.mutateAsync({ key: "feishu_daily_briefing_webhook", value: webhook.trim() });
      await setConfig.mutateAsync({ key: "feishu_daily_briefing_enabled", value: enabled ? "true" : "false" });
      toast.success("飞书推送配置已保存");
    } finally { setSaving(false); }
  };

  const handleTest = async () => {
    if (!webhook.trim()) { toast.error("请先填写 Webhook 地址"); return; }
    setTesting(true); setTestResult(null);
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ msg_type: "text", content: { text: "✅ AIStorm Command 飞书推送测试成功！" } }),
      });
      const data = await res.json();
      if (data.code === 0) { setTestResult({ ok: true, message: "推送成功！请检查飞书群消息。" }); }
      else { setTestResult({ ok: false, message: `推送失败：${data.msg || "未知错误"}` }); }
    } catch (e: any) {
      setTestResult({ ok: false, message: `网络错误：${e.message}` });
    } finally { setTesting(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-foreground">飞书每日战情简报</h3>
        <p className="text-sm text-muted-foreground mt-1">配置飞书群机器人 Webhook，每日自动推送战场动态摘要。</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Config panel */}
        <div className="space-y-4">
          <div className="p-4 rounded-lg border border-border bg-card/30 space-y-4">
            <div className="text-sm font-medium text-foreground flex items-center gap-2">
              <Webhook className="w-4 h-4 text-cyan-400" /> Webhook 配置
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">飞书群机器人 Webhook 地址</label>
              <Input
                placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
                value={webhook}
                onChange={e => setWebhook(e.target.value)}
                className="h-9 text-sm font-mono"
              />
              <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                <Info className="w-3 h-3" />
                飞书群 → 设置 → 机器人 → 添加自定义机器人 → 获取 Webhook
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-foreground">启用每日推送</div>
                <div className="text-xs text-muted-foreground">每天早 8:30 自动推送战情简报</div>
              </div>
              <button
                onClick={() => setEnabled(!enabled)}
                className={cn("w-10 h-5 rounded-full transition-colors relative", enabled ? "bg-cyan-500" : "bg-muted")}
              >
                <span className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm", enabled ? "translate-x-5" : "translate-x-0.5")} />
              </button>
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                保存配置
              </Button>
              <Button size="sm" variant="outline" onClick={handleTest} disabled={testing}>
                {testing ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
                发送测试
              </Button>
            </div>
            {testResult && (
              <div className={cn("flex items-center gap-2 text-sm p-2 rounded border", testResult.ok ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-400")}>
                {testResult.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                {testResult.message}
              </div>
            )}
          </div>
        </div>

        {/* Help panel */}
        <div className="space-y-3">
          <div className="p-4 rounded-lg border border-border bg-card/30">
            <div className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" /> 推送内容预览
            </div>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-start gap-2"><span className="text-cyan-400 font-mono">📊</span> 今日 Portfolio 健康度概览</div>
              <div className="flex items-start gap-2"><span className="text-cyan-400 font-mono">🔴</span> 高风险商机预警（MEDDPICC 低于阈值）</div>
              <div className="flex items-start gap-2"><span className="text-cyan-400 font-mono">📅</span> 本周待拜访 P0 客户提醒</div>
              <div className="flex items-start gap-2"><span className="text-cyan-400 font-mono">✅</span> POD 团队待办任务汇总</div>
            </div>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card/30">
            <div className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-400" /> 如何获取 Webhook
            </div>
            <ol className="space-y-1.5 text-xs text-muted-foreground list-decimal list-inside">
              <li>打开飞书，进入目标群聊</li>
              <li>点击右上角「设置」图标</li>
              <li>选择「群机器人」→「添加机器人」</li>
              <li>选择「自定义机器人」</li>
              <li>复制生成的 Webhook 地址</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── CRM Integration Tab ─────────────────────────────────────────────────────
function CrmIntegrationTab() {
  // Lazy import to avoid duplication — just re-render the existing page content
  // We embed the CrmIntegration page component directly
  const [config, setConfig] = useState({
    clientId: "", clientSecret: "", redirectUri: "https://api.xiaoshouyi.com", username: "", password: "",
  });
  const [showSecret, setShowSecret] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [session, setSession] = useState<{ accessToken: string; userId?: number } | null>(null);
  const [connecting, setConnecting] = useState(false);

  const connectCrm = trpc.crm.testConnection.useMutation({
    onSuccess: (data: any) => { setSession(data); toast.success("CRM 连接成功！"); },
    onError: (e: any) => toast.error(`连接失败：${e.message}`),
  });

  const handleConnect = async () => {
    if (!config.clientId || !config.clientSecret || !config.username || !config.password) {
      toast.error("请填写所有必填字段"); return;
    }
    setConnecting(true);
    try { await connectCrm.mutateAsync(config); } finally { setConnecting(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-foreground">销售易 CRM 集成</h3>
        <p className="text-sm text-muted-foreground mt-1">连接销售易 CRM，将商机和联系人数据双向同步。</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="p-4 rounded-lg border border-border bg-card/30 space-y-4">
          <div className="text-sm font-medium text-foreground flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-400" />
            API 连接配置
            {session && <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> 已连接</span>}
          </div>
          <div className="space-y-3">
            {[
              { label: "Client ID", key: "clientId", placeholder: "销售易应用 Client ID" },
              { label: "Redirect URI", key: "redirectUri", placeholder: "https://api.xiaoshouyi.com" },
              { label: "用户名", key: "username", placeholder: "销售易登录邮箱" },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-muted-foreground mb-1 block">{f.label}</label>
                <Input value={(config as any)[f.key]} onChange={e => setConfig(c => ({ ...c, [f.key]: e.target.value }))} placeholder={f.placeholder} className="h-8 text-sm" />
              </div>
            ))}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Client Secret</label>
              <div className="relative">
                <Input type={showSecret ? "text" : "password"} value={config.clientSecret} onChange={e => setConfig(c => ({ ...c, clientSecret: e.target.value }))} placeholder="销售易应用 Client Secret" className="h-8 text-sm pr-8" />
                <button onClick={() => setShowSecret(!showSecret)} className="absolute right-2 top-1.5 text-muted-foreground hover:text-foreground">
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">密码 + 安全令牌</label>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} value={config.password} onChange={e => setConfig(c => ({ ...c, password: e.target.value }))} placeholder="密码 + 8位安全令牌（直接拼接）" className="h-8 text-sm pr-8" />
                <button onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1.5 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <Button size="sm" onClick={handleConnect} disabled={connecting} className="w-full">
            {connecting ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Database className="w-3.5 h-3.5 mr-1.5" />}
            {session ? "重新连接" : "连接 CRM"}
          </Button>
        </div>

        <div className="p-4 rounded-lg border border-border bg-card/30 space-y-3">
          <div className="text-sm font-medium text-foreground flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-400" /> 获取 API 凭证
          </div>
          <ol className="space-y-2 text-xs text-muted-foreground list-decimal list-inside">
            <li>登录销售易管理后台</li>
            <li>进入「设置 → 应用管理 → 已连接的应用」</li>
            <li>创建或查看应用，获取 Client ID 和 Secret</li>
            <li>在「个人设置 → 我的安全令牌」重置获取 Token</li>
            <li>密码字段填写：登录密码 + 安全令牌（直接拼接，无分隔符）</li>
          </ol>
          <div className="pt-2">
            <a href="https://open.xiaoshouyi.com" target="_blank" rel="noopener noreferrer"
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
              <ExternalLink className="w-3 h-3" /> 销售易开发者文档
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Settings Page ──────────────────────────────────────────────────────
const TABS = [
  { id: "rss", label: "RSS 信息源", icon: Rss, desc: "自定义第三方情报 RSS" },
  { id: "feishu", label: "飞书推送", icon: Bell, desc: "每日战情简报" },
  { id: "crm", label: "CRM 集成", icon: Database, desc: "销售易数据同步" },
];

export default function SystemSettings() {
  const [activeTab, setActiveTab] = useState("rss");

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Page header */}
      <div className="px-6 pt-6 pb-4 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <Settings className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">系统设置</h1>
            <p className="text-xs text-muted-foreground">RSS 信息源 · 飞书推送 · CRM 集成</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left tab nav */}
        <div className="w-52 border-r border-border flex-shrink-0 p-3 space-y-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                activeTab === tab.id
                  ? "bg-cyan-500/10 border border-cyan-500/20 text-cyan-300"
                  : "hover:bg-white/5 text-muted-foreground hover:text-foreground border border-transparent"
              )}
            >
              <tab.icon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", activeTab === tab.id ? "text-cyan-400" : "")} />
              <div>
                <div className="text-sm font-medium">{tab.label}</div>
                <div className="text-xs opacity-70">{tab.desc}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "rss" && <RssSourcesTab />}
          {activeTab === "feishu" && <FeishuBriefingTab />}
          {activeTab === "crm" && <CrmIntegrationTab />}
        </div>
      </div>
    </div>
  );
}
