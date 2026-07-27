import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  BookOpen, Sparkles, ChevronDown, ChevronUp, Download, Calendar,
  Send, CheckCircle2, TrendingUp, AlertCircle, Upload, FileText,
  Target, Shield, Clock, Users, Crosshair, Zap, Info, X
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ClientSelector from "@/components/ClientSelector";
import { Streamdown } from "streamdown";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Swords } from "lucide-react";
import ReactMarkdown from "react-markdown";

// Kill Sheet match panel shown when competitors are detected in meeting log
function KillSheetMatchPanel({ competitorNames }: { competitorNames: string[] }) {
  const { data: matchedSheets = [], isLoading } = trpc.killSheets.listByCompetitors.useQuery(
    { competitorNames },
    { enabled: competitorNames.length > 0 }
  );
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const handleCopy = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="mt-4 border border-red-500/30 rounded-lg bg-red-500/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Swords className="w-4 h-4 text-red-400" />
        <span className="text-sm font-semibold text-red-400">竞品阻击包自动匹配</span>
        <span className="text-xs text-muted-foreground">检测到竞品: {competitorNames.join(", ")}</span>
      </div>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">正在匹配竞品阻击包...</p>
      ) : matchedSheets.length === 0 ? (
        <div className="text-xs text-muted-foreground">
          <p>未找到匹配的竞品阻击包。</p>
          <p className="mt-1">建议前往「武器库 → 竞品阻击包」创建针对 {competitorNames.join(", ")} 的阻击包。</p>
        </div>
      ) : (
        <div className="space-y-3">
          {matchedSheets.map((ks) => (
            <div key={ks.id} className="border border-border rounded-lg bg-background/50 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded">vs {ks.competitorName}</span>
                  {ks.productLine && <span className="text-xs text-muted-foreground">{ks.productLine}</span>}
                </div>
                {ks.aiGeneratedTalk && (
                  <button
                    onClick={() => handleCopy(ks.aiGeneratedTalk!, ks.id)}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    {copiedId === ks.id ? <CheckCircle2 className="w-3 h-3 text-green-400" /> : <span>复制话术</span>}
                  </button>
                )}
              </div>
              {ks.aiGeneratedTalk ? (
                <div className="text-xs text-foreground prose prose-invert prose-xs max-w-none">
                  <ReactMarkdown>{ks.aiGeneratedTalk.slice(0, 600) + (ks.aiGeneratedTalk.length > 600 ? "\n\n...（点击武器库查看完整话术）" : "")}</ReactMarkdown>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  {ks.keyDiffs && <p className="mb-1"><span className="font-medium">关键差异：</span>{ks.keyDiffs}</p>}
                  {ks.ourAdvantages && <p><span className="font-medium">我方优势：</span>{ks.ourAdvantages}</p>}
                  {!ks.keyDiffs && !ks.ourAdvantages && <p>前往武器库生成 AI 差异化话术</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type MeddpiccSuggestion = {
  dim: string;
  label: string;
  suggestedScore: number;
  reason: string;
  confidence: string;
};

const VISIT_TYPES = ["首次拜访", "跟进拜访", "技术交流", "高层拜访", "演示/POC", "商务洽谈", "电话/视频会议", "其他"];

const dimToScoreField: Record<string, string> = {
  M: "metricsScore",
  E: "economicBuyerScore",
  D1: "decisionCriteriaScore",
  D2: "decisionProcessScore",
  P: "paperProcessScore",
  I: "implicatePainScore",
  C1: "championScore",
  C2: "competitionScore",
};

export default function MeetingMinutes() {
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [meetingDate, setMeetingDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [visitType, setVisitType] = useState("首次拜访");
  const [attendees, setAttendees] = useState("");
  const [keyPoints, setKeyPoints] = useState("");
  const [transcriptText, setTranscriptText] = useState("");
  const [transcriptMode, setTranscriptMode] = useState<"paste" | "file">("paste");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [feishuWebhook, setFeishuWebhook] = useState("");
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [sentIds, setSentIds] = useState<Set<number>>(new Set());
  const [meddpiccSuggestions, setMeddpiccSuggestions] = useState<MeddpiccSuggestion[]>([]);
  const [appliedDims, setAppliedDims] = useState<Set<string>>(new Set());
  const [latestMeetingId, setLatestMeetingId] = useState<number | null>(null);
  const [hookTopicSuggestion, setHookTopicSuggestion] = useState("");
  const [securityAngleSuggestion, setSecurityAngleSuggestion] = useState("");
  const [appliedHook, setAppliedHook] = useState(false);
  const [appliedSecurity, setAppliedSecurity] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [detectedCompetitors, setDetectedCompetitors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: clients = [] } = trpc.clients.list.useQuery();
  const { data: meetings = [], refetch } = trpc.meetings.listByClient.useQuery(
    { clientId: selectedClientId! },
    { enabled: !!selectedClientId }
  );
  const utils = trpc.useUtils();
  const selectedClient = clients.find((c) => c.id === selectedClientId);

  const updateMeddpicc = trpc.meddpicc.update.useMutation();
  const addMeddpiccLog = trpc.meddpicc.addLog.useMutation();
  const updateClient = trpc.clients.update.useMutation();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.match(/\.(txt|md|csv)$/i)) {
      toast.error("请上传 TXT 或 MD 格式的文本文件");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setTranscriptText(text);
      setUploadedFileName(file.name);
      toast.success(`已读取文件：${file.name}（${text.length} 字符）`);
    };
    reader.readAsText(file, "utf-8");
  };

  const handleApplySuggestion = async (s: MeddpiccSuggestion) => {
    if (!selectedClientId) return;
    const scoreField = dimToScoreField[s.dim];
    if (!scoreField) { toast.error(`未知维度: ${s.dim}`); return; }
    try {
      await updateMeddpicc.mutateAsync({ clientId: selectedClientId, [scoreField]: s.suggestedScore } as any);
      await addMeddpiccLog.mutateAsync({
        clientId: selectedClientId,
        dimension: s.dim,
        score: s.suggestedScore,
        note: `[来自拜访日志] ${s.reason}`,
        authorRole: "SAM",
      });
      setAppliedDims((prev) => { const next = new Set(Array.from(prev)); next.add(s.dim); return next; });
      utils.meddpicc.get.invalidate({ clientId: selectedClientId });
      toast.success(`${s.label} 已更新至 ${s.suggestedScore} 分`);
    } catch { toast.error("更新失败，请重试"); }
  };

  const handleApplyAll = async () => {
    const pending = meddpiccSuggestions.filter((s) => !appliedDims.has(s.dim));
    if (pending.length === 0) return;
    const results = await Promise.allSettled(pending.map(async (s) => {
      if (!selectedClientId) throw new Error("no client");
      const scoreField = dimToScoreField[s.dim];
      if (!scoreField) throw new Error(`未知维度: ${s.dim}`);
      await updateMeddpicc.mutateAsync({ clientId: selectedClientId, [scoreField]: s.suggestedScore } as any);
      await addMeddpiccLog.mutateAsync({
        clientId: selectedClientId,
        dimension: s.dim,
        score: s.suggestedScore,
        note: `[来自拜访日志] ${s.reason}`,
        authorRole: "SAM",
      });
      return s.dim;
    }));
    const succeeded = results.filter(r => r.status === "fulfilled").map(r => (r as PromiseFulfilledResult<string>).value);
    if (succeeded.length > 0) {
      setAppliedDims((prev) => { const next = new Set(Array.from(prev)); succeeded.forEach(d => next.add(d)); return next; });
      utils.meddpicc.get.invalidate({ clientId: selectedClientId! });
    }
    const failed = results.filter(r => r.status === "rejected").length;
    if (failed > 0) toast.error(`${failed} 条更新失败，其余 ${succeeded.length} 条已同步`);
    else toast.success(`已将 ${succeeded.length} 条 MEDDPICC 更新同步到战场地图`);
  };

  const handleApplyHookTopic = async () => {
    if (!selectedClientId || !hookTopicSuggestion) return;
    try {
      await updateClient.mutateAsync({ id: selectedClientId, hookTopic: hookTopicSuggestion });
      utils.clients.list.invalidate();
      setAppliedHook(true);
      toast.success("敲门砖话题已更新到战场地图");
    } catch { toast.error("更新失败"); }
  };

  const handleApplySecurityAngle = async () => {
    if (!selectedClientId || !securityAngleSuggestion) return;
    try {
      await updateClient.mutateAsync({ id: selectedClientId, securityAngle: securityAngleSuggestion });
      utils.clients.list.invalidate();
      setAppliedSecurity(true);
      toast.success("安全切入点已更新到战场地图");
    } catch { toast.error("更新失败"); }
  };

  const generate = trpc.meetings.generate.useMutation({
    onSuccess: (data) => {
      refetch();
      setExpandedId(data.id);
      setLatestMeetingId(data.id);
      setKeyPoints("");
      setTranscriptText("");
      setUploadedFileName("");
      setAppliedDims(new Set());
      setAppliedHook(false);
      setAppliedSecurity(false);
      if (data.meddpiccSuggestions?.length > 0) {
        setMeddpiccSuggestions(data.meddpiccSuggestions);
      } else {
        setMeddpiccSuggestions([]);
      }
      if (data.hookTopicSuggestion) setHookTopicSuggestion(data.hookTopicSuggestion);
      if (data.securityAngleSuggestion) setSecurityAngleSuggestion(data.securityAngleSuggestion);
      // Show review dialog if there are strategy suggestions
      if (data.hookTopicSuggestion || data.securityAngleSuggestion) {
        setShowReviewDialog(true);
      }
      if (data.detectedCompetitors?.length) {
        setDetectedCompetitors(data.detectedCompetitors);
      } else {
        setDetectedCompetitors([]);
      }
      const compMsg = data.detectedCompetitors?.length ? `，识别到竞品: ${data.detectedCompetitors.join(", ")}` : "";
      toast.success(`拜访日志已生成${data.meddpiccSuggestions?.length ? `，发现 ${data.meddpiccSuggestions.length} 条 MEDDPICC 更新建议` : ""}${compMsg}`);
      setGenerating(false);
    },
    onError: () => { toast.error("生成失败，请重试"); setGenerating(false); },
  });

  const handleGenerate = () => {
    if (!selectedClientId) { toast.error("请先选择客户"); return; }
    if (!keyPoints.trim() && !transcriptText.trim()) {
      toast.error("请输入会议要点或上传/粘贴飞书妙记文字");
      return;
    }
    setGenerating(true);
    generate.mutate({
      clientId: selectedClientId,
      clientName: selectedClient?.name || "",
      meetingDate,
      visitType,
      attendees: attendees || undefined,
      keyPoints: keyPoints || "（见上方妙记全文）",
      transcriptText: transcriptText || undefined,
    });
  };

  const handleSendFeishu = async (meeting: any) => {
    if (!feishuWebhook.trim()) { toast.error("请先填写飞书 Webhook 地址"); return; }
    if (!meeting.aiMinutes) { toast.error("该日志尚未生成"); return; }
    setSendingId(meeting.id);
    try {
      const dateStr = new Date(meeting.meetingDate).toLocaleDateString("zh-CN");
      const text = `📋 **${selectedClient?.name || ""} 拜访作战日志** | ${dateStr}\n\n${meeting.aiMinutes.slice(0, 2000)}${meeting.aiMinutes.length > 2000 ? "\n\n...（内容过长，已截断）" : ""}`;
      const res = await fetch(feishuWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ msg_type: "text", content: { text } }),
      });
      if (res.ok) {
        setSentIds((prev) => { const next = new Set(Array.from(prev)); next.add(meeting.id); return next; });
        toast.success("已发送到飞书群");
      } else { toast.error("发送失败，请检查 Webhook 地址"); }
    } catch { toast.error("发送失败，请检查网络"); } finally { setSendingId(null); }
  };

  const handleDownload = (content: string, date: string, clientName: string) => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `拜访日志_${clientName}_${date}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">拜访作战日志</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          每次拜访后录入，AI 解析提炼 MEDDPICC 线索、敲门砖建议、关键人信号，一键同步战场地图。<span className="text-primary font-medium">拜访是战场地图最重要的数据来源。</span>
        </p>
      </div>

      {/* Feishu Webhook */}
      <div className="mb-4 bg-card border border-border rounded-xl p-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground flex-shrink-0">
            <Send className="w-3.5 h-3.5 text-primary" />
            飞书 Webhook
          </div>
          <input
            type="url"
            placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
            value={feishuWebhook}
            onChange={(e) => setFeishuWebhook(e.target.value)}
            className="flex-1 bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
          />
          <div className="text-[10px] text-muted-foreground flex-shrink-0">填写后可一键发送到飞书群</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Input Panel */}
        <div className="xl:col-span-1 space-y-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-primary" />
              录入拜访信息
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">目标客户 *</label>
                <ClientSelector selectedId={selectedClientId} onSelect={setSelectedClientId} className="flex-col" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">拜访日期</label>
                  <Input type="date" className="h-8 text-sm" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">拜访类型</label>
                  <Select value={visitType} onValueChange={setVisitType}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VISIT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">参会人（可选）</label>
                <Input className="h-8 text-sm" placeholder="例如：张总（CTO）、Leo、SA 张三" value={attendees} onChange={(e) => setAttendees(e.target.value)} />
              </div>

              {/* Transcript Section */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-muted-foreground">飞书妙记 / 会议记录</label>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setTranscriptMode("paste")}
                      className={`text-[10px] px-2 py-0.5 rounded transition-colors ${transcriptMode === "paste" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                    >粘贴文字</button>
                    <button
                      onClick={() => setTranscriptMode("file")}
                      className={`text-[10px] px-2 py-0.5 rounded transition-colors ${transcriptMode === "file" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                    >上传文件</button>
                  </div>
                </div>
                {transcriptMode === "paste" ? (
                  <Textarea
                    className="resize-none h-28 text-sm"
                    placeholder="将飞书妙记导出的文字粘贴到这里（可选，有全文效果更好）..."
                    value={transcriptText}
                    onChange={(e) => setTranscriptText(e.target.value)}
                    disabled={!selectedClientId}
                  />
                ) : (
                  <div>
                    <input ref={fileInputRef} type="file" accept=".txt,.md,.csv" className="hidden" onChange={handleFileUpload} />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={!selectedClientId}
                      className="w-full h-16 border border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-50"
                    >
                      <Upload className="w-4 h-4" />
                      <span className="text-xs">{uploadedFileName || "点击上传 TXT / MD 文件"}</span>
                    </button>
                    {transcriptText && (
                      <div className="mt-1 text-[10px] text-green-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        已读取 {transcriptText.length} 字符
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">SAM 补充要点 *</label>
                <Textarea
                  className="resize-none h-28 text-sm"
                  placeholder={`输入碎片化要点（有妙记时可简短补充）...\n\n例如：\n- 客户对 FCC 合规压力很头疼\n- CTO 提到 Q4 有预算窗口\n- 竞品 PA 已在跟进`}
                  value={keyPoints}
                  onChange={(e) => setKeyPoints(e.target.value)}
                  disabled={!selectedClientId}
                />
              </div>

              <Button
                className="w-full gap-2"
                onClick={handleGenerate}
                disabled={!selectedClientId || (!keyPoints.trim() && !transcriptText.trim()) || generating}
              >
                <Sparkles className="w-4 h-4" />
                {generating ? "AI 解析中..." : "生成拜访作战日志"}
              </Button>

              {/* Progress indicator shown while generating */}
              {generating && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin flex-shrink-0" />
                    <span className="text-sm font-medium text-primary">AI 正在解析拜访记录</span>
                  </div>
                  <div className="space-y-1.5 pl-6">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      <span>生成结构化拜访纪要（约 20-40 秒）</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                      <span>提取 MEDDPICC 更新建议</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                      <span>识别竞品 & 生成策略建议</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground pl-6">请勿关闭页面，解析完成后自动展示结果</p>
                </div>
              )}
            </div>
          </div>

          {/* 48h Rule */}
          <div className="bg-card border border-amber-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <div className="text-xs font-semibold text-amber-400">48小时黄金规则</div>
            </div>
            <div className="text-xs text-muted-foreground leading-relaxed">
              每次客户拜访后必须在 <span className="text-amber-400 font-medium">48小时内</span> 完成日志录入，AI 解析结果同步至战场地图。延迟录入将导致商机信息失真，MEDDPICC 评估偏差。
            </div>
          </div>

          {/* Feishu Tip */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-3.5 h-3.5 text-primary" />
              <div className="text-xs font-semibold text-foreground">建议开启飞书妙记</div>
            </div>
            <div className="text-xs text-muted-foreground leading-relaxed">
              拜访时开启飞书会议并启用妙记，会后将妙记导出为文字版，粘贴或上传到此处。AI 将从完整对话中提炼更准确的 MEDDPICC 线索和战略建议。
            </div>
          </div>
        </div>

        {/* History Panel */}
        <div className="xl:col-span-2">
          {!selectedClientId ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <BookOpen className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
              <div className="text-sm text-muted-foreground">选择客户后查看拜访作战日志</div>
            </div>
          ) : meetings.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <Calendar className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
              <div className="text-sm text-muted-foreground mb-1">暂无拜访记录</div>
              <div className="text-xs text-muted-foreground">录入第一次拜访信息，AI 将开始构建这个客户的战场地图</div>
            </div>
          ) : (
            <div className="space-y-3">
              {meetings.map((meeting: any) => (
                <div key={meeting.id} className="bg-card border border-border rounded-xl overflow-hidden">
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/20 transition-colors"
                    onClick={() => setExpandedId(expandedId === meeting.id ? null : meeting.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0">
                        <Users className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="font-medium text-foreground flex items-center gap-2">
                          {new Date(meeting.meetingDate).toLocaleDateString("zh-CN")}
                          {meeting.visitType && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{meeting.visitType}</span>
                          )}
                        </div>
                        {meeting.attendees && (
                          <div className="text-xs text-muted-foreground">参会：{meeting.attendees}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {meeting.aiMinutes && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDownload(meeting.aiMinutes!, new Date(meeting.meetingDate).toLocaleDateString("zh-CN"), selectedClient?.name || ""); }}
                            className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                            title="下载 Markdown"
                          ><Download className="w-4 h-4" /></button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSendFeishu(meeting); }}
                            disabled={sendingId === meeting.id}
                            className={`p-1.5 rounded transition-colors ${sentIds.has(meeting.id) ? "text-green-400" : "text-muted-foreground hover:text-primary"}`}
                            title="发送到飞书"
                          >
                            {sentIds.has(meeting.id) ? <CheckCircle2 className="w-4 h-4" /> : sendingId === meeting.id ? <Send className="w-4 h-4 animate-pulse" /> : <Send className="w-4 h-4" />}
                          </button>
                        </>
                      )}
                      {expandedId === meeting.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {expandedId === meeting.id && (
                    <div className="border-t border-border">
                      {meeting.aiMinutes ? (
                        <div className="p-4 bg-muted/5">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="ai-badge">AI 拜访作战日志</span>
                          </div>
                          <div className="prose prose-sm prose-invert max-w-none">
                            <Streamdown>{meeting.aiMinutes}</Streamdown>
                          </div>

                          {/* Strategy Suggestions - hookTopic & securityAngle */}
                          {meeting.id === latestMeetingId && (hookTopicSuggestion || securityAngleSuggestion) && (
                            <div className="mt-4 border border-cyan-500/30 rounded-lg bg-cyan-500/5 p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <Target className="w-4 h-4 text-cyan-400" />
                                <span className="text-sm font-semibold text-cyan-400">战略建议</span>
                                <span className="text-xs text-muted-foreground">基于本次拜访内容提炼</span>
                              </div>
                              <div className="space-y-3">
                                {hookTopicSuggestion && (
                                  <div className={`p-3 rounded-lg border transition-all ${appliedHook ? "border-green-500/30 bg-green-500/5 opacity-70" : "border-border bg-muted/20"}`}>
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex-1">
                                        <div className="text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5">
                                          <Target className="w-3 h-3 text-cyan-400" />
                                          下次拜访敲门砖话题
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <button className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-cyan-400 transition-colors">
                                                  <Info className="w-3 h-3" />
                                                  查看依据
                                                </button>
                                              </TooltipTrigger>
                                              <TooltipContent side="top" className="max-w-xs text-xs">
                                                <p>基于本次拜访日志中识别的客户痛点和关注信号提炼</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        </div>
                                        <p className="text-sm text-foreground">{hookTopicSuggestion}</p>
                                      </div>
                                      {appliedHook ? (
                                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                                      ) : (
                                        <button onClick={handleApplyHookTopic} className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25 border border-cyan-500/30 transition-colors">
                                          <Zap className="w-3 h-3" />一键应用
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {securityAngleSuggestion && (
                                  <div className={`p-3 rounded-lg border transition-all ${appliedSecurity ? "border-green-500/30 bg-green-500/5 opacity-70" : "border-border bg-muted/20"}`}>
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex-1">
                                        <div className="text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5">
                                          <Shield className="w-3 h-3 text-violet-400" />
                                          安全切入点建议
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <button className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-violet-400 transition-colors">
                                                  <Info className="w-3 h-3" />
                                                  查看依据
                                                </button>
                                              </TooltipTrigger>
                                              <TooltipContent side="top" className="max-w-xs text-xs">
                                                <p>基于本次拜访中识别的客户痛点和亚信安全产品能力匹配提炼</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        </div>
                                        <p className="text-sm text-foreground">{securityAngleSuggestion}</p>
                                      </div>
                                      {appliedSecurity ? (
                                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                                      ) : (
                                        <button onClick={handleApplySecurityAngle} className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-violet-500/15 text-violet-400 hover:bg-violet-500/25 border border-violet-500/30 transition-colors">
                                          <Zap className="w-3 h-3" />一键应用
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Competitor Kill Sheet Panel */}
                          {meeting.id === latestMeetingId && detectedCompetitors.length > 0 && (
                            <KillSheetMatchPanel competitorNames={detectedCompetitors} />
                          )}

                          {/* MEDDPICC Suggestions */}
                          {meeting.id === latestMeetingId && meddpiccSuggestions.length > 0 && (
                            <div className="mt-4 border border-amber-500/30 rounded-lg bg-amber-500/5 p-4">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <TrendingUp className="w-4 h-4 text-amber-400" />
                                  <span className="text-sm font-semibold text-amber-400">MEDDPICC 更新建议</span>
                                  <span className="text-xs text-muted-foreground">AI 识别到 {meddpiccSuggestions.length} 个维度有进展</span>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-7 border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                                  onClick={handleApplyAll}
                                  disabled={meddpiccSuggestions.every((s) => appliedDims.has(s.dim))}
                                >
                                  一键全部同步
                                </Button>
                              </div>
                              <div className="space-y-2">
                                {meddpiccSuggestions.map((s) => (
                                  <div key={s.dim} className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${appliedDims.has(s.dim) ? "border-green-500/30 bg-green-500/5 opacity-70" : "border-border bg-muted/20"}`}>
                                    <div className="flex-shrink-0 mt-0.5">
                                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-bold">{s.dim}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm font-medium text-foreground">{s.label}</span>
                                        <span className="text-xs font-bold text-primary">→ {s.suggestedScore}分</span>
                                        <span className={`text-xs px-1.5 py-0.5 rounded ${s.confidence === "high" ? "bg-green-500/20 text-green-400" : s.confidence === "medium" ? "bg-amber-500/20 text-amber-400" : "bg-muted text-muted-foreground"}`}>
                                          {s.confidence === "high" ? "高置信" : s.confidence === "medium" ? "中置信" : "低置信（推断）"}
                                        </span>
                                      </div>
                                      <p className="text-xs text-muted-foreground">{s.reason}</p>
                                    </div>
                                    <div className="flex-shrink-0">
                                      {appliedDims.has(s.dim) ? (
                                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                                      ) : (
                                        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleApplySuggestion(s)}>同步</Button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                同步后将自动在战场地图对应维度的作战日志中追加记录
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-4">
                          <div className="text-xs text-muted-foreground mb-2">原始关键信息点</div>
                          <div className="text-sm text-foreground whitespace-pre-wrap">{meeting.keyPoints}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* AI 复盘建议弹窗 */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              AI 复盘建议
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              基于本次真实拜访内容，AI 重新提炼了以下战略建议，比初始猜测更准确。点击「一键应用」直接更新客户档案。
            </p>
            {hookTopicSuggestion && (
              <div className="p-4 rounded-lg border border-cyan-500/30 bg-cyan-500/5">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm font-semibold text-cyan-400">敲门砖话题（更新建议）</span>
                </div>
                <p className="text-sm text-foreground mb-3">{hookTopicSuggestion}</p>
                <button
                  onClick={() => { handleApplyHookTopic(); }}
                  disabled={appliedHook}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/40 transition-colors disabled:opacity-50"
                >
                  {appliedHook ? <><CheckCircle2 className="w-3.5 h-3.5" />已应用到战场地图</> : <><Zap className="w-3.5 h-3.5" />一键应用到战场地图</>}
                </button>
              </div>
            )}
            {securityAngleSuggestion && (
              <div className="p-4 rounded-lg border border-violet-500/30 bg-violet-500/5">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-violet-400" />
                  <span className="text-sm font-semibold text-violet-400">安全切入点（更新建议）</span>
                </div>
                <p className="text-sm text-foreground mb-3">{securityAngleSuggestion}</p>
                <button
                  onClick={() => { handleApplySecurityAngle(); }}
                  disabled={appliedSecurity}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 border border-violet-500/40 transition-colors disabled:opacity-50"
                >
                  {appliedSecurity ? <><CheckCircle2 className="w-3.5 h-3.5" />已应用到战场地图</> : <><Zap className="w-3.5 h-3.5" />一键应用到战场地图</>}
                </button>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              应用后将覆盖战场地图中该客户的现有值。你也可以稍后在拜访日志展开区查看并手动应用。
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
