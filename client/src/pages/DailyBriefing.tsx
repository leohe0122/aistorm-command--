import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Bell, CheckCircle2, RefreshCw, Save, Info, Send,
  ToggleLeft, ToggleRight, Clock, Webhook
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function DailyBriefing() {
  const [webhook, setWebhook] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const { data: configs = [], isLoading, refetch } = trpc.systemConfig.getAll.useQuery();

  const setConfig = trpc.systemConfig.set.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  // Load configs when available
  useEffect(() => {
    if (configs.length > 0) {
      const webhookConfig = configs.find((c: { configKey: string; configValue: string | null }) => c.configKey === "feishu_daily_briefing_webhook");
      const enabledConfig = configs.find((c: { configKey: string; configValue: string | null }) => c.configKey === "feishu_daily_briefing_enabled");
      if (webhookConfig?.configValue) setWebhook(webhookConfig.configValue);
      if (enabledConfig) setEnabled(enabledConfig.configValue !== "false");
    }
  }, [configs]);

  const handleSave = async () => {
    if (!webhook.trim()) {
      toast.error("请填写飞书 Webhook 地址");
      return;
    }
    if (!webhook.startsWith("https://open.feishu.cn/open-apis/bot/v2/hook/")) {
      toast.error("Webhook 地址格式不正确，应以 https://open.feishu.cn/open-apis/bot/v2/hook/ 开头");
      return;
    }
    setSaving(true);
    try {
      await setConfig.mutateAsync({ key: "feishu_daily_briefing_webhook", value: webhook.trim() });
      await setConfig.mutateAsync({ key: "feishu_daily_briefing_enabled", value: enabled ? "true" : "false" });
      toast.success("配置已保存");
    } catch (e) {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!webhook.trim()) {
      toast.error("请先填写并保存 Webhook 地址");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(webhook.trim(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          msg_type: "text",
          content: {
            text: "🔔 T100 AI作战指挥系统 · 每日简报测试消息\n\n✅ Webhook 配置正确，每日简报将在每天 08:00（北京时间）自动推送。",
          },
        }),
      });
      const data = await res.json();
      if (res.ok && data.StatusCode === 0) {
        setTestResult({ ok: true, message: "测试消息发送成功！请检查飞书群" });
        toast.success("测试消息已发送到飞书群");
      } else {
        setTestResult({ ok: false, message: `发送失败: ${JSON.stringify(data)}` });
        toast.error("发送失败，请检查 Webhook 地址");
      }
    } catch (e: any) {
      setTestResult({ ok: false, message: e.message || "网络错误" });
      toast.error("发送失败，请检查网络");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Bell className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">每日简报推送</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          配置飞书 Webhook，每天 08:00（北京时间）自动推送 T100 专项战情简报到飞书群
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Config Panel */}
        <div className="xl:col-span-1 space-y-4">
          {/* Webhook Config */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Webhook className="w-4 h-4 text-primary" />
              <div className="text-sm font-semibold text-foreground">飞书 Webhook 配置</div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Webhook 地址 *</label>
                <Input
                  value={webhook}
                  onChange={e => setWebhook(e.target.value)}
                  placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
                  className="text-xs h-8 font-mono"
                />
                <div className="text-[10px] text-muted-foreground mt-1">
                  在飞书群 → 设置 → 机器人 → 添加自定义机器人 → 获取 Webhook
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                <div>
                  <div className="text-xs font-medium text-foreground">启用每日推送</div>
                  <div className="text-[10px] text-muted-foreground">关闭后将停止自动推送</div>
                </div>
                <button
                  onClick={() => setEnabled(e => !e)}
                  className={cn("transition-colors", enabled ? "text-primary" : "text-muted-foreground")}
                >
                  {enabled ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                </button>
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1 gap-2"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {saving ? "保存中..." : "保存配置"}
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={handleTest}
                  disabled={testing || !webhook}
                >
                  {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  测试
                </Button>
              </div>

              {testResult && (
                <div className={cn(
                  "flex items-start gap-2 p-3 rounded-lg text-xs",
                  testResult.ok
                    ? "bg-green-500/10 border border-green-500/30 text-green-400"
                    : "bg-red-500/10 border border-red-500/30 text-red-400"
                )}>
                  <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  {testResult.message}
                </div>
              )}
            </div>
          </div>

          {/* Schedule Info */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="font-medium text-foreground">推送时间</div>
                <div>每天 <span className="text-primary font-mono">08:00</span>（北京时间 / SGT）</div>
                <div>即 UTC <span className="text-primary font-mono">00:00</span></div>
                <div className="mt-2 font-medium text-foreground">简报内容</div>
                <div>• 今日重点关注客户</div>
                <div>• 5户客户状态速览</div>
                <div>• AI 生成今日行动建议</div>
              </div>
            </div>
          </div>

          {/* How to get webhook */}
          <div className="bg-muted/20 border border-border rounded-xl p-3">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="font-medium text-foreground">如何获取飞书 Webhook</div>
                <div>1. 打开飞书目标群聊</div>
                <div>2. 点击右上角「设置」</div>
                <div>3. 选择「机器人」→「添加机器人」</div>
                <div>4. 选择「自定义机器人」</div>
                <div>5. 复制 Webhook 地址到上方</div>
              </div>
            </div>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="xl:col-span-2 space-y-4">
          {/* Briefing Preview */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-4 h-4 text-primary" />
              <div className="text-sm font-semibold text-foreground">简报示例预览</div>
              <div className="text-xs text-muted-foreground ml-auto">实际内容由 AI 根据当天数据生成</div>
            </div>

            <div className="bg-muted/20 rounded-xl p-4 border border-border font-mono text-xs text-foreground space-y-3">
              <div className="text-primary font-semibold text-sm">📊 T100专项每日战情简报 · 2026年7月24日 星期五</div>

              <div>
                <div className="text-muted-foreground mb-1">【今日重点关注】</div>
                <div>荣耀终端 EU AI Act 合规窗口期剩余 14 天，需本周完成 TrustOne 方案确认；大疆 FCC 审查进入关键阶段，建议 AD 今日跟进 Adam Welsh。</div>
              </div>

              <div>
                <div className="text-muted-foreground mb-1">【客户状态速览】</div>
                <div className="space-y-0.5">
                  <div>美的集团 | 建图 | MEDDPICC: 42 | 待办: 3 | 需补充 Economic Buyer</div>
                  <div>大疆创新 | 进门 | MEDDPICC: 58 | 待办: 2 | FCC 审查进展跟进</div>
                  <div>荣耀终端 | 定痛 | MEDDPICC: 71 | 待办: 4 | ⚡ 合规窗口期紧迫</div>
                  <div>传音控股 | 建图 | MEDDPICC: 35 | 待办: 1 | 需识别 Champion</div>
                  <div>华大基因 | 建图 | MEDDPICC: 29 | 待办: 2 | 沙特数据主权合规</div>
                </div>
              </div>

              <div>
                <div className="text-muted-foreground mb-1">【今日建议行动】</div>
                <div className="space-y-0.5">
                  <div>1. [AD] 联系荣耀李健，确认 TrustOne 方案 Demo 时间（本周五截止）</div>
                  <div>2. [SAM] 跟进大疆 Adam Welsh，了解 FCC 最新进展，准备数据安全自证材料</div>
                  <div>3. [SA] 为美的集团准备 OT/IT 融合安全方案 PPT，重点突出 NDR 价值</div>
                </div>
              </div>

              <div className="text-muted-foreground text-[10px] border-t border-border pt-2">
                🤖 由T100 AI作战指挥系统自动生成
              </div>
            </div>
          </div>

          {/* Current Config Status */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <div className="text-sm font-semibold text-foreground">当前配置状态</div>
            </div>

            {isLoading ? (
              <div className="text-xs text-muted-foreground">加载中...</div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2.5 bg-muted/10 rounded-lg">
                  <div className="text-xs text-muted-foreground">Webhook 状态</div>
                  <div className={cn("text-xs font-medium flex items-center gap-1.5",
                    webhook ? "text-green-400" : "text-red-400"
                  )}>
                    <div className={cn("w-1.5 h-1.5 rounded-full", webhook ? "bg-green-400" : "bg-red-400")} />
                    {webhook ? "已配置" : "未配置"}
                  </div>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-muted/10 rounded-lg">
                  <div className="text-xs text-muted-foreground">推送开关</div>
                  <div className={cn("text-xs font-medium flex items-center gap-1.5",
                    enabled ? "text-green-400" : "text-muted-foreground"
                  )}>
                    <div className={cn("w-1.5 h-1.5 rounded-full", enabled ? "bg-green-400" : "bg-muted-foreground")} />
                    {enabled ? "已启用" : "已停用"}
                  </div>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-muted/10 rounded-lg">
                  <div className="text-xs text-muted-foreground">下次推送</div>
                  <div className="text-xs text-foreground font-mono">
                    {enabled && webhook ? "明天 08:00（北京时间）" : "—"}
                  </div>
                </div>
                {webhook && (
                  <div className="flex items-center justify-between p-2.5 bg-muted/10 rounded-lg">
                    <div className="text-xs text-muted-foreground">Webhook 地址</div>
                    <div className="text-xs text-primary font-mono truncate max-w-48" title={webhook}>
                      {webhook.replace("https://open.feishu.cn/open-apis/bot/v2/hook/", ".../")}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
