import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import {
  FileText, Upload, Trash2, Search, Plus, Bot, Wand2,
  FileDown, ChevronDown, ChevronUp, Copy, Check,
  ShoppingCart, X, Calculator, Package, Swords, Shield,
  Eye, Sparkles, ExternalLink, Loader2, Tag
} from "lucide-react";
import { PRODUCT_LINE_GROUPS } from '../../../shared/productLines';
import KillSheetsTab from "./KillSheetsTab";
import ChampionAmmo from "./ChampionAmmo";

// Wrapper to embed ChampionAmmo as a tab (no page-level padding)
function ChampionAmmoTab() {
  return <ChampionAmmo />;
}

// ─── 产品文档仓库 Tab ────────────────────────────────────────────────────────

// 产品线文件夹定义（专属图标+颜色+描述）
const FOLDER_DEFS = [
  // 亚信科技
  { productLine: "算力", label: "算力", group: "亚信科技", icon: "⚡", color: "from-amber-500/20 to-orange-500/10", border: "border-amber-500/30", badge: "bg-amber-500/20 text-amber-400", desc: "AI算力基础设施、GPU集群、算力租赁" },
  { productLine: "Token运营平台", label: "Token 运营平台", group: "亚信科技", icon: "🪙", color: "from-yellow-500/20 to-amber-500/10", border: "border-yellow-500/30", badge: "bg-yellow-500/20 text-yellow-400", desc: "Token ERP、数字资产运营管理" },
  { productLine: "物理AI", label: "物理 AI", group: "亚信科技", icon: "🤖", color: "from-blue-500/20 to-cyan-500/10", border: "border-blue-500/30", badge: "bg-blue-500/20 text-blue-400", desc: "具身智能、机器人、物理世界AI应用" },
  { productLine: "卫星互联", label: "卫星互联", group: "亚信科技", icon: "🛰️", color: "from-indigo-500/20 to-blue-500/10", border: "border-indigo-500/30", badge: "bg-indigo-500/20 text-indigo-400", desc: "卫星通信、低轨卫星网络、天地一体" },
  // 亚信安全
  { productLine: "AI XDR", label: "AI XDR 平台", group: "亚信安全", icon: "🏛️", color: "from-violet-500/20 to-purple-500/10", border: "border-violet-500/30", badge: "bg-violet-500/20 text-violet-400", desc: "跨层威胁检测响应、AI驱动XDR平台" },
  { productLine: "TrustOne", label: "TrustOne", group: "亚信安全", icon: "🛡️", color: "from-green-500/20 to-emerald-500/10", border: "border-green-500/30", badge: "bg-green-500/20 text-green-400", desc: "办公网终端 AV / EDR / 虚拟补丁" },
  { productLine: "CloudGuard", label: "CloudGuard", group: "亚信安全", icon: "☁️", color: "from-sky-500/20 to-blue-500/10", border: "border-sky-500/30", badge: "bg-sky-500/20 text-sky-400", desc: "CWPP 数据中心及云主机安全防护" },
  { productLine: "NDR", label: "NDR 系列", group: "亚信安全", icon: "🌐", color: "from-teal-500/20 to-cyan-500/10", border: "border-teal-500/30", badge: "bg-teal-500/20 text-teal-400", desc: "ThreatTrace / ThreatShield / PhishShield" },
  { productLine: "威胁情报", label: "威胁情报", group: "亚信安全", icon: "🔍", color: "from-red-500/20 to-rose-500/10", border: "border-red-500/30", badge: "bg-red-500/20 text-red-400", desc: "威胁情报平台、IOC、APT追踪" },
  { productLine: "AI智能体身份安全", label: "AI 智能体身份安全", group: "亚信安全", icon: "🔐", color: "from-pink-500/20 to-rose-500/10", border: "border-pink-500/30", badge: "bg-pink-500/20 text-pink-400", desc: "AI Agent身份认证、零信任访问控制" },
  { productLine: "安全服务", label: "安全服务", group: "亚信安全", icon: "🎯", color: "from-orange-500/20 to-red-500/10", border: "border-orange-500/30", badge: "bg-orange-500/20 text-orange-400", desc: "EASM / 渗透测试 / 红队 / MDR" },
  { productLine: "AI大模型防火墙", label: "AI 大模型防火墙", group: "亚信安全", icon: "🔥", color: "from-red-600/20 to-orange-500/10", border: "border-red-600/30", badge: "bg-red-600/20 text-red-400", desc: "大模型安全、LLM防护、提示词注入防御" },
  // 其他
  { productLine: "OEM产品", label: "OEM 产品", group: "亚信安全", icon: "🏷️", color: "from-cyan-500/20 to-teal-500/10", border: "border-cyan-500/30", badge: "bg-cyan-500/20 text-cyan-400", desc: "OEM合作产品、贴牌安全产品、合作伙伴集成方案" },
  // 其他
  { productLine: "其他参考资料", label: "其他参考资料", group: "其他", icon: "📚", color: "from-slate-500/20 to-gray-500/10", border: "border-slate-500/30", badge: "bg-slate-500/20 text-slate-400", desc: "竞品分析 / 行业报告 / 客户案例" },
];

function ProductDocsTab() {
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadDialog, setUploadDialog] = useState(false);
  const [uploadForm, setUploadForm] = useState({ title: "", description: "" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: docs = [], refetch } = trpc.productDocs.list.useQuery(undefined);

  const deleteMut = trpc.productDocs.delete.useMutation({
    onSuccess: () => { toast.success("已删除"); refetch(); },
    onError: (e: any) => toast.error("删除失败: " + e.message),
  });
  const updateProductLineMut = trpc.productDocs.updateProductLine.useMutation({
    onSuccess: () => { toast.success("已移动"); refetch(); },
    onError: (e: any) => toast.error("移动失败: " + e.message),
  });
  const getSignedUrlMut = trpc.productDocs.getSignedUrl.useMutation({
    onSuccess: (data: any) => {
      setPreviewUrl(`https://docs.google.com/viewer?url=${encodeURIComponent(data.url)}&embedded=true`);
      setPreviewLoading(false);
    },
    onError: () => { toast.error("无法加载预览"); setPreviewLoading(false); setPreviewOpen(false); },
  });
  const confirmUploadMut = trpc.productDocs.confirmUpload.useMutation({
    onSuccess: () => {
      toast.success("上传成功，文档已归入「" + (FOLDER_DEFS.find(f => f.productLine === activeFolder)?.label || activeFolder) + "」");
      refetch(); setSelectedFile(null); setUploadForm({ title: "", description: "" });
      setTimeout(() => setUploadDialog(false), 50);
    },
    onError: (e: any) => toast.error("上传失败: " + e.message),
  });

  const handlePreview = (doc: any) => {
    setPreviewDoc(doc); setPreviewUrl(null); setPreviewLoading(true); setPreviewOpen(true);
    getSignedUrlMut.mutate({ fileKey: doc.fileKey });
  };
  const handleDelete = (id: number) => { if (confirm("确认删除此文档？")) deleteMut.mutate({ id }); };

  const handleUpload = () => {
    if (!selectedFile || !uploadForm.title || !activeFolder) return;
    setUploading(true); setUploadProgress(0);
    const formData = new FormData();
    formData.append("file", selectedFile);
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = e => { if (e.lengthComputable) setUploadProgress(Math.round(e.loaded / e.total * 100)); };
    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const { fileKey, fileUrl, extractedText } = JSON.parse(xhr.responseText);
          await confirmUploadMut.mutateAsync({
            title: uploadForm.title, description: uploadForm.description || undefined,
            productLine: activeFolder, filename: selectedFile.name,
            mimeType: selectedFile.type || "application/octet-stream",
            fileKey, fileUrl, fileSize: selectedFile.size, extractedText: extractedText || undefined,
          });
        } catch (err: any) { toast.error("上传失败: " + (err.message || "未知错误")); }
      } else {
        try { const e = JSON.parse(xhr.responseText); toast.error("上传失败: " + (e.error || xhr.statusText)); }
        catch { toast.error("上传失败: " + xhr.statusText); }
      }
      setUploading(false); setUploadProgress(0);
    };
    xhr.onerror = () => { toast.error("网络错误"); setUploading(false); setUploadProgress(0); };
    xhr.open("POST", "/api/upload-doc");
    xhr.send(formData);
  };

  // 按产品线分组
  const docsByLine = (docs as any[]).reduce((acc: Record<string, any[]>, doc) => {
    const line = doc.productLine || "其他参考资料";
    if (!acc[line]) acc[line] = [];
    acc[line].push(doc);
    return acc;
  }, {});

  const getMimeIcon = (mime?: string) => {
    if (!mime) return "📄";
    if (mime.includes("pdf")) return "📕";
    if (mime.includes("word") || mime.includes("docx")) return "📘";
    if (mime.includes("presentation") || mime.includes("pptx")) return "📊";
    if (mime.includes("spreadsheet") || mime.includes("excel")) return "📗";
    if (mime.includes("video")) return "🎬";
    return "📄";
  };
  const formatSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + "KB";
    return (bytes / 1024 / 1024).toFixed(1) + "MB";
  };

  const activeFolderDef = FOLDER_DEFS.find(f => f.productLine === activeFolder);
  const folderDocs = activeFolder ? (docsByLine[activeFolder] || []).filter((d: any) =>
    !search || d.title.toLowerCase().includes(search.toLowerCase())
  ) : [];

  // ── 二级文档列表视图 ──
  if (activeFolder && activeFolderDef) {
    return (
      <div className="space-y-4">
        {/* 面包屑导航 */}
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => { setActiveFolder(null); setSearch(""); }}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown className="h-4 w-4 rotate-90" /> 武器库
          </button>
          <span className="text-muted-foreground">/</span>
          <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${activeFolderDef.badge}`}>
            {activeFolderDef.icon} {activeFolderDef.label}
          </span>
        </div>

        {/* 工具栏 */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="搜索文档..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Button type="button" onClick={() => setUploadDialog(true)} className="gap-2 flex-shrink-0">
            <Upload className="h-4 w-4" /> 上传文档
          </Button>
        </div>

        {/* 文档列表 */}
        {folderDocs.length === 0 ? (
          <div className={`flex flex-col items-center py-16 rounded-2xl border-2 border-dashed bg-gradient-to-br ${activeFolderDef.color} ${activeFolderDef.border} gap-3`}>
            <span className="text-5xl">{activeFolderDef.icon}</span>
            <p className="text-sm text-muted-foreground">此文件夹暂无文档</p>
            <Button type="button" variant="outline" size="sm" onClick={() => setUploadDialog(true)} className="gap-1.5">
              <Upload className="h-3.5 w-3.5" /> 上传第一份文档
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {folderDocs.map((doc: any) => (
              <div key={doc.id} className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card hover:bg-accent/20 transition-colors">
                <span className="text-xl flex-shrink-0">{getMimeIcon(doc.mimeType)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatSize(doc.fileSize)}{doc.extractedText ? " · ✨ 已学习" : ""}
                    {doc.description ? ` · ${doc.description.slice(0, 40)}...` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {/* 移动到... */}
                  <Select onValueChange={v => { if (v !== activeFolder) updateProductLineMut.mutate({ id: doc.id, productLine: v }); }}>
                    <SelectTrigger className="h-7 text-xs w-auto gap-1 px-2 border-dashed opacity-0 group-hover:opacity-100 transition-opacity">
                      <Tag className="h-3 w-3" /> 移动到
                    </SelectTrigger>
                    <SelectContent>
                      {["亚信科技", "亚信安全", "其他"].map(group => (
                        <SelectGroup key={group}>
                          <SelectLabel>{group}</SelectLabel>
                          {FOLDER_DEFS.filter(f => f.group === group && f.productLine !== activeFolder).map(f => (
                            <SelectItem key={f.productLine} value={f.productLine}>
                              {f.icon} {f.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* 预览 */}
                  <button type="button" onClick={() => handlePreview(doc)}
                    className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-all">
                    <Eye className="h-4 w-4" />
                  </button>
                  {/* 下载 */}
                  {doc.fileUrl && (
                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-all">
                      <FileDown className="h-4 w-4" />
                    </a>
                  )}
                  {/* 删除 */}
                  <button type="button" onClick={() => handleDelete(doc.id)}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 上传 Dialog */}
        <Dialog open={uploadDialog} onOpenChange={open => { setUploadDialog(open); if (!open) { setSelectedFile(null); setUploadForm({ title: "", description: "" }); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span>{activeFolderDef.icon}</span> 上传到「{activeFolderDef.label}」
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">文档标题 *</label>
                <Input className="mt-1" value={uploadForm.title} onChange={e => setUploadForm(f => ({ ...f, title: e.target.value }))} placeholder="例：TrustOne XDR 产品白皮书 v2.0" />
              </div>
              <div>
                <label className="text-sm font-medium">描述（可选）</label>
                <Textarea className="mt-1" rows={2} value={uploadForm.description} onChange={e => setUploadForm(f => ({ ...f, description: e.target.value }))} placeholder="简要描述文档内容..." />
              </div>
              <div>
                <label className="text-sm font-medium">选择文件 *</label>
                <div className="mt-1 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors" onClick={() => fileInputRef.current?.click()}>
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                      <button type="button" onClick={e => { e.stopPropagation(); setSelectedFile(null); }} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
                    </div>
                  ) : (
                    <div className="text-muted-foreground text-sm">
                      <Upload className="h-6 w-6 mx-auto mb-1 opacity-50" />
                      <p>PDF / PPT / DOC / Excel / MP4，不限大小</p>
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.pptx,.ppt,.docx,.doc,.xls,.xlsx,.mp4,.mov,.avi" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
              </div>
            </div>
            <DialogFooter className="flex-col gap-2">
              {uploading && (
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                  <div className="bg-primary h-1.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              )}
              <div className="flex gap-2 w-full justify-end">
                <Button type="button" variant="outline" onClick={() => setUploadDialog(false)}>取消</Button>
                <Button type="button" onClick={handleUpload} disabled={uploading || !selectedFile || !uploadForm.title} className="gap-2">
                  {uploading ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
                  {uploading ? `上传中 ${uploadProgress}%` : "上传"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 预览 Dialog */}
        <Dialog open={previewOpen} onOpenChange={open => {
          setPreviewOpen(open);
          if (!open) setTimeout(() => { setPreviewDoc(null); setPreviewUrl(null); setPreviewLoading(false); }, 300);
        }}>
          <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0">
            <DialogHeader className="px-4 pt-4 pb-2 flex-shrink-0 border-b">
              <DialogTitle className="flex items-center gap-2 text-sm">
                <Eye className="h-4 w-4" />
                <span className="truncate flex-1">{previewDoc?.title}</span>
                {previewDoc?.fileUrl && (
                  <a href={previewDoc.fileUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1 flex-shrink-0">
                    <ExternalLink className="h-3 w-3" /> 下载原文件
                  </a>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 relative">
              {previewLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">正在加载预览...</p>
                </div>
              )}
              {previewUrl && (
                <iframe src={previewUrl} className="w-full h-full border-0 rounded-b-lg" title={previewDoc?.title} onLoad={() => setPreviewLoading(false)} />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── 主视图：产品线文件夹网格 ──
  const groups = [
    { name: "亚信科技", subtitle: "热点敲门砖产品线（定制化方案）", folders: FOLDER_DEFS.filter(f => f.group === "亚信科技") },
    { name: "亚信安全", subtitle: "安全标品（可直接交付）", folders: FOLDER_DEFS.filter(f => f.group === "亚信安全") },
    { name: "其他", subtitle: "参考资料库", folders: FOLDER_DEFS.filter(f => f.group === "其他") },
  ];

  return (
    <div className="space-y-8">
      {groups.map(group => (
        <div key={group.name} className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">{group.name}</h3>
            <p className="text-xs text-muted-foreground">{group.subtitle}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {group.folders.map(folder => {
              const count = (docsByLine[folder.productLine] || []).length;
              return (
                <button
                  key={folder.productLine}
                  type="button"
                  onClick={() => setActiveFolder(folder.productLine)}
                  className={`relative flex flex-col items-start gap-2 p-4 rounded-2xl border bg-gradient-to-br ${folder.color} ${folder.border} hover:scale-[1.02] active:scale-[0.98] transition-transform text-left group`}
                >
                  {/* 文档数量角标 */}
                  {count > 0 && (
                    <span className={`absolute top-2.5 right-2.5 text-xs font-bold px-1.5 py-0.5 rounded-full ${folder.badge}`}>
                      {count}
                    </span>
                  )}
                  {/* 图标 */}
                  <span className="text-3xl">{folder.icon}</span>
                  {/* 标题 */}
                  <div>
                    <p className="text-sm font-semibold leading-tight">{folder.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">{folder.desc}</p>
                  </div>
                  {/* 空文件夹提示 */}
                  {count === 0 && (
                    <p className="text-xs text-muted-foreground/60 mt-auto">暂无文档</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
// ─── AI方案定制 Tab ──────────────────────────────────────────────────────────

function AIArsenalTab() {
  const [category, setCategory] = useState<"方案类" | "弹药类" | "话术类">("方案类");
  const [prompt, setPrompt] = useState("");
  const [selectedDocIds, setSelectedDocIds] = useState<number[]>([]);
  const [targetContact, setTargetContact] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ id: number; content: string; title: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { data: docs = [] } = trpc.productDocs.list.useQuery(undefined);
  const { data: history = [], refetch: refetchHistory } = trpc.arsenalAI.list.useQuery(undefined);
  const generateMut = trpc.arsenalAI.generate.useMutation({
    onSuccess: (data) => { setResult(data); refetchHistory(); },
    onError: (e) => toast.error("生成失败: " + e.message),
  });
  const deleteMut = trpc.arsenalAI.delete.useMutation({
    onSuccess: () => { toast.success("已删除"); refetchHistory(); },
  });

  const handleGenerate = async () => {
    if (!prompt.trim()) { toast.error("请描述你的需求"); return; }
    setGenerating(true); setResult(null);
    try {
      await generateMut.mutateAsync({ category, prompt: prompt.trim(), docIds: selectedDocIds.length > 0 ? selectedDocIds : undefined, targetContact: targetContact || undefined });
    } finally { setGenerating(false); }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.content);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const toggleDoc = (id: number) => setSelectedDocIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const categoryConfig: Record<string, { color: string; label: string; desc: string }> = {
    "方案类": { color: "bg-blue-500/10 text-blue-600 border-blue-200", label: "技术方案", desc: "生成面向客户的技术解决方案文档" },
    "弹药类": { color: "bg-orange-500/10 text-orange-600 border-orange-200", label: "竞争弹药", desc: "生成竞争差异化亮点与对比材料" },
    "话术类": { color: "bg-green-500/10 text-green-600 border-green-200", label: "销售话术", desc: "生成销售沟通话术与应对脚本" },
  };

  const placeholders: Record<string, string> = {
    "方案类": "例：我要给华大基因的IT总监写一份TrustOne XDR的技术方案，他们目前用的是传统防病毒，主要痛点是告警太多处理不过来...",
    "弹药类": "例：我在跟Palo Alto竞争，客户是金融行业，对方主打SASE，帮我生成对比弹药...",
    "话术类": "例：我要拜访某银行的安全负责人，他对预算比较敏感，帮我准备开场白和价值主张话术...",
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">输出类型</label>
          <div className="grid grid-cols-3 gap-2">
            {(["方案类", "弹药类", "话术类"] as const).map(cat => (
              <button key={cat} onClick={() => setCategory(cat)}
                className={`p-3 rounded-lg border text-sm font-medium transition-all text-left ${category === cat ? categoryConfig[cat].color + " border-current" : "border-border hover:border-muted-foreground"}`}>
                <div className="font-semibold">{categoryConfig[cat].label}</div>
                <div className="text-xs opacity-70 mt-0.5">{categoryConfig[cat].desc}</div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">需求描述 *</label>
          <Textarea rows={5} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder={placeholders[category]} />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">目标联系人（可选）</label>
          <Input value={targetContact} onChange={e => setTargetContact(e.target.value)} placeholder="例：IT总监 / 安全负责人 / CTO" />
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">
            参考产品文档（可选，{selectedDocIds.length > 0 ? `已选 ${selectedDocIds.length} 份` : "未选择则使用通用知识"}）
          </label>
          {(docs as any[]).length === 0 ? (
            <p className="text-xs text-muted-foreground">暂无文档，请先在"产品文档仓库"上传</p>
          ) : (
            <div className="space-y-1 max-h-36 overflow-y-auto border rounded-lg p-2">
              {(docs as any[]).map((doc) => (
                <label key={doc.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                  <input type="checkbox" checked={selectedDocIds.includes(doc.id)} onChange={() => toggleDoc(doc.id)} className="rounded" />
                  <span className="flex-1 truncate">{doc.title}</span>
                  {doc.productLine && <Badge variant="secondary" className="text-xs shrink-0">{doc.productLine}</Badge>}
                </label>
              ))}
            </div>
          )}
        </div>
        <Button onClick={handleGenerate} disabled={generating || !prompt.trim()} className="w-full gap-2" size="lg">
          {generating ? <Spinner className="h-4 w-4" /> : <Wand2 className="h-4 w-4" />}
          {generating ? "AI 生成中..." : "生成内容"}
        </Button>
      </div>

      <div className="space-y-4">
        {generating && (
          <div className="flex flex-col items-center justify-center h-64 gap-3 border rounded-lg bg-muted/30">
            <Spinner className="h-8 w-8 text-primary" />
            <p className="text-sm text-muted-foreground">AI 正在生成{categoryConfig[category].label}...</p>
          </div>
        )}
        {result && !generating && (
          <div className="border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium truncate">{result.title}</span>
                <Badge variant="outline" className="text-xs shrink-0">{category}</Badge>
              </div>
              <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors p-1 rounded shrink-0">
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                {copied ? "已复制" : "复制"}
              </button>
            </div>
            <div className="p-4 max-h-[500px] overflow-y-auto prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{result.content}</ReactMarkdown>
            </div>
          </div>
        )}
        {!result && !generating && (
          <div className="flex flex-col items-center justify-center h-64 gap-3 border rounded-lg border-dashed text-muted-foreground">
            <Bot className="h-12 w-12 opacity-20" />
            <p className="text-sm">填写需求后点击"生成内容"</p>
          </div>
        )}
        <div className="border rounded-lg overflow-hidden">
          <button onClick={() => setHistoryOpen(v => !v)} className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors text-sm font-medium">
            <span>历史生成记录（{(history as any[]).length}）</span>
            {historyOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {historyOpen && (
            <div className="divide-y max-h-64 overflow-y-auto">
              {(history as any[]).length === 0 ? (
                <p className="text-xs text-muted-foreground p-4 text-center">暂无历史记录</p>
              ) : (
                (history as any[]).map((h) => (
                  <div key={h.id} className="flex items-start justify-between p-3 hover:bg-muted/30 group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs shrink-0">{h.category}</Badge>
                        <span className="text-sm truncate">{h.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{h.prompt}</p>
                    </div>
                    <div className="flex items-center gap-1 ml-2 shrink-0">
                      <button onClick={() => setResult({ id: h.id, content: h.generatedContent, title: h.title })} className="text-xs text-primary hover:underline">查看</button>
                      <button onClick={() => deleteMut.mutate({ id: h.id })} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 报价工具 Tab ────────────────────────────────────────────────────────────

type CartItem = {
  id: string; productName: string; model?: string; unit?: string;
  listPriceUsd: number; quantity: number; discountPct: number; listpriceItemId?: number;
};

function QuoteToolTab() {
  const [keyword, setKeyword] = useState("");
  const [filterLine, setFilterLine] = useState<string>("all");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [quoteDialog, setQuoteDialog] = useState(false);
  const [quoteForm, setQuoteForm] = useState({ clientName: "", contactName: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  const { data: items = [] } = trpc.listprice.search.useQuery(
    { keyword: keyword || undefined, productLine: filterLine !== "all" ? filterLine : undefined },
    { keepPreviousData: true } as any
  );
  const { data: productLines = [] } = trpc.listprice.getProductLines.useQuery();
  const { data: quotes = [], refetch: refetchQuotes } = trpc.quotes.list.useQuery();
  const createQuoteMut = trpc.quotes.create.useMutation();
  const addItemMut = trpc.quotes.addItem.useMutation();

  const addToCart = (item: any) => {
    const existing = cartItems.find(c => c.listpriceItemId === item.id);
    if (existing) {
      setCartItems(prev => prev.map(c => c.listpriceItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCartItems(prev => [...prev, { id: `${item.id}-${Date.now()}`, productName: item.productName, model: item.model, unit: item.unit || "套", listPriceUsd: item.listPriceUsd, quantity: 1, discountPct: NaN, listpriceItemId: item.id }]);
    }
  };
  const removeFromCart = (id: string) => setCartItems(prev => prev.filter(c => c.id !== id));
  const updateCart = (id: string, field: "quantity" | "discountPct", value: number) => setCartItems(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));

  // 折扣逻辑：discountPct=40 → 40% off → 实际价格 = listPrice × (1-0.4) = listPrice × 60%
  const calcDiscounted = (listPrice: number, discountPct: number) => listPrice * (1 - discountPct / 100);
  const calcSubtotal = (item: CartItem) => calcDiscounted(item.listPriceUsd, item.discountPct) * item.quantity;
  const totalListPrice = cartItems.reduce((s, i) => s + i.listPriceUsd * i.quantity, 0);
  const totalDiscounted = cartItems.reduce((s, i) => s + calcSubtotal(i), 0);
  const totalSaving = totalListPrice - totalDiscounted;

  const handleSaveQuote = async () => {
    if (cartItems.length === 0) { toast.error("购物车为空"); return; }
    setSaving(true);
    try {
      const { id: quoteId } = await createQuoteMut.mutateAsync({ clientName: quoteForm.clientName || undefined, contactName: quoteForm.contactName || undefined, notes: quoteForm.notes || undefined });
      for (const item of cartItems) {
        await addItemMut.mutateAsync({ quoteId, listpriceItemId: item.listpriceItemId, productName: item.productName, model: item.model, unit: item.unit, quantity: item.quantity, listPriceUsd: item.listPriceUsd, discountPct: item.discountPct });
      }
      toast.success("报价单已保存"); setQuoteDialog(false); setCartItems([]); setQuoteForm({ clientName: "", contactName: "", notes: "" }); refetchQuotes();
    } catch (e: any) { toast.error("保存失败: " + e.message); } finally { setSaving(false); }
  };

  const fmtUsd = (v: number) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const productLineColors: Record<string, string> = {
    "TrustOne Suite": "bg-blue-500/10 text-blue-700",
    "CloudGuard Suite": "bg-purple-500/10 text-purple-700",
    "Virtual Patch Add-on": "bg-yellow-500/10 text-yellow-700",
    "NDR Hardware": "bg-gray-500/10 text-gray-700",
    "ThreatTrace Software": "bg-red-500/10 text-red-700",
    "ThreatTrace TI Subscription": "bg-orange-500/10 text-orange-700",
    "Security Services": "bg-green-500/10 text-green-700",
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="搜索产品名称、型号..." value={keyword} onChange={e => setKeyword(e.target.value)} />
          </div>
          <Select value={filterLine} onValueChange={setFilterLine}>
            <SelectTrigger className="w-48"><SelectValue placeholder="产品线" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部产品线</SelectItem>
              {(productLines as string[]).map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
          {(items as any[]).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <Package className="h-10 w-10 opacity-20" /><p className="text-sm">未找到匹配产品</p>
            </div>
          ) : (
            (items as any[]).map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-3 border rounded-lg hover:border-primary/40 transition-colors bg-card">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{item.productName}</span>
                    {item.productLine && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${productLineColors[item.productLine] || "bg-muted text-muted-foreground"}`}>{item.productLine}</span>
                    )}
                  </div>
                  {item.model && <p className="text-xs text-muted-foreground mt-0.5">型号: {item.model}</p>}
                  {item.specs && <p className="text-xs text-muted-foreground truncate">{item.specs}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-sm text-primary">{fmtUsd(item.listPriceUsd)}</p>
                  <p className="text-xs text-muted-foreground">/{item.unit || "套"} · {item.billingCycle || "一次性"}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => addToCart(item)} className="gap-1 shrink-0">
                  <Plus className="h-3 w-3" /> 加入
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/50 border-b">
            <div className="flex items-center gap-2"><ShoppingCart className="h-4 w-4" /><span className="text-sm font-medium">报价清单（{cartItems.length}）</span></div>
            {cartItems.length > 0 && <button onClick={() => setCartItems([])} className="text-xs text-muted-foreground hover:text-destructive">清空</button>}
          </div>
          {cartItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
              <ShoppingCart className="h-8 w-8 opacity-20" /><p className="text-xs">从左侧添加产品</p>
            </div>
          ) : (
            <div className="divide-y max-h-[400px] overflow-y-auto">
              {cartItems.map(item => (
                <div key={item.id} className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.productName}</p>
                      {item.model && <p className="text-xs text-muted-foreground">{item.model}</p>}
                    </div>
                    <button onClick={() => removeFromCart(item.id)} className="text-muted-foreground hover:text-destructive shrink-0"><X className="h-4 w-4" /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">数量</label>
                      <Input type="number" min={1} value={item.quantity} onChange={e => updateCart(item.id, "quantity", Math.max(1, parseInt(e.target.value) || 1))} className="h-7 text-sm mt-0.5" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">折扣 (% off)</label>
                      <Input type="number" min={0} max={100} value={isNaN(item.discountPct) || item.discountPct === 0 ? '' : item.discountPct} onChange={e => { const v = parseFloat(e.target.value); updateCart(item.id, "discountPct", isNaN(v) ? 0 : Math.min(100, Math.max(0, v))); }} className="h-7 text-sm mt-0.5" placeholder="输入折扣" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground line-through">{fmtUsd(item.listPriceUsd * item.quantity)}</span>
                    <span className="font-semibold text-primary">{fmtUsd(calcSubtotal(item))}</span>
                  </div>
                  {item.discountPct > 0 && !isNaN(item.discountPct) && (
                    <p className="text-xs text-green-600">{item.discountPct}% off → 实际单价 {fmtUsd(calcDiscounted(item.listPriceUsd, item.discountPct))}</p>
                  )}
                </div>
              ))}
            </div>
          )}
          {cartItems.length > 0 && (
            <div className="border-t p-3 space-y-1 bg-muted/20">
              <div className="flex justify-between text-xs text-muted-foreground"><span>List Price 合计</span><span>{fmtUsd(totalListPrice)}</span></div>
              {totalSaving > 0 && <div className="flex justify-between text-xs text-green-600"><span>节省</span><span>-{fmtUsd(totalSaving)}</span></div>}
              <div className="flex justify-between text-sm font-semibold pt-1 border-t"><span>报价总计</span><span className="text-primary">{fmtUsd(totalDiscounted)}</span></div>
            </div>
          )}
        </div>
        {cartItems.length > 0 && (
          <Button className="w-full gap-2" onClick={() => setQuoteDialog(true)}><Calculator className="h-4 w-4" /> 保存报价单</Button>
        )}

        <div className="border rounded-lg overflow-hidden">
          <button onClick={() => setShowSaved(v => !v)} className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors text-sm font-medium">
            <span>历史报价单（{(quotes as any[]).length}）</span>
            {showSaved ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showSaved && (
            <div className="divide-y max-h-48 overflow-y-auto">
              {(quotes as any[]).length === 0 ? (
                <p className="text-xs text-muted-foreground p-4 text-center">暂无报价单</p>
              ) : (
                (quotes as any[]).map((q) => (
                  <div key={q.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{q.quoteNumber}</span>
                      <Badge variant="outline" className="text-xs">{q.status || "草稿"}</Badge>
                    </div>
                    {q.clientName && <p className="text-xs text-muted-foreground mt-0.5">{q.clientName}</p>}
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-muted-foreground line-through">{fmtUsd(q.totalListPrice || 0)}</span>
                      <span className="font-semibold text-primary">{fmtUsd(q.totalDiscountedPrice || 0)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog open={quoteDialog} onOpenChange={setQuoteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>保存报价单</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm font-medium">客户名称</label><Input className="mt-1" value={quoteForm.clientName} onChange={e => setQuoteForm(f => ({ ...f, clientName: e.target.value }))} placeholder="例：华大基因" /></div>
            <div><label className="text-sm font-medium">联系人</label><Input className="mt-1" value={quoteForm.contactName} onChange={e => setQuoteForm(f => ({ ...f, contactName: e.target.value }))} placeholder="例：张总" /></div>
            <div><label className="text-sm font-medium">备注</label><Textarea className="mt-1" rows={2} value={quoteForm.notes} onChange={e => setQuoteForm(f => ({ ...f, notes: e.target.value }))} placeholder="报价备注..." /></div>
            <div className="border rounded-lg p-3 bg-muted/30 space-y-1">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">List Price</span><span>{fmtUsd(totalListPrice)}</span></div>
              <div className="flex justify-between text-sm font-semibold"><span>报价总计</span><span className="text-primary">{fmtUsd(totalDiscounted)}</span></div>
              <p className="text-xs text-muted-foreground">{cartItems.length} 个产品</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuoteDialog(false)}>取消</Button>
            <Button onClick={handleSaveQuote} disabled={saving} className="gap-2">
              {saving ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" />}
              {saving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── 主页面 ──────────────────────────────────────────────────────────────────

export default function Arsenal() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">武器库</h1>
        <p className="text-muted-foreground text-sm mt-1">产品文档管理 · AI方案定制 · 智能报价工具 · 竞品阻击包</p>
      </div>
      <Tabs defaultValue="docs" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full max-w-3xl">
          <TabsTrigger value="docs" className="gap-2"><FileText className="h-4 w-4" /> 产品文档仓库</TabsTrigger>
          <TabsTrigger value="ai" className="gap-2"><Bot className="h-4 w-4" /> AI方案定制</TabsTrigger>
          <TabsTrigger value="champion" className="gap-2"><Shield className="h-4 w-4" /> Champion弹药库</TabsTrigger>
          <TabsTrigger value="killsheets" className="gap-2"><Swords className="h-4 w-4" /> 竞品阻击包</TabsTrigger>
          <TabsTrigger value="quote" className="gap-2"><Calculator className="h-4 w-4" /> 报价工具</TabsTrigger>
        </TabsList>
        <TabsContent value="docs"><ProductDocsTab /></TabsContent>
        <TabsContent value="ai"><AIArsenalTab /></TabsContent>
        <TabsContent value="champion"><ChampionAmmoTab /></TabsContent>
        <TabsContent value="killsheets"><KillSheetsTab /></TabsContent>
        <TabsContent value="quote"><QuoteToolTab /></TabsContent>
      </Tabs>
    </div>
  );
}
