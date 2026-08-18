import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
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
import { cn } from "@/lib/utils";
import {
  FileText, Upload, Trash2, Search, Plus, Bot, Wand2,
  FileDown, ChevronDown, ChevronUp, Copy, Check,
  ShoppingCart, X, Calculator, Package, Swords, Shield,
  Eye, Sparkles, ExternalLink, Loader2, Tag, FilePlus2, Files, Folder, FolderOpen, FolderPlus, Pencil
} from "lucide-react";
import { PRODUCT_LINE_GROUPS } from '../../../shared/productLines';
import { BookOpen, Star, TrendingUp } from "lucide-react";

// ─── 成功案例库 Tab ──────────────────────────────────────────────────────────
const INDUSTRY_OPTIONS = ["金融", "制造", "电信", "政府", "医疗", "科技", "零售", "能源", "教育", "其他"];
const CLIENT_SIZE_OPTIONS = ["大型企业", "中型企业", "小型企业", "政府机构"] as const;

type ParsedCase = {
  title: string; clientAlias: string; isConfidential: boolean;
  industry: string; clientSize: string; region: string;
  painPoint: string; solution: string; quantifiedResult: string;
  roiHighlight: string; fullContent: string;
  needsVerification: boolean;
  filename: string; status: 'pending' | 'parsing' | 'done' | 'error'; error?: string;
};

function CaseStudiesTab() {
  const utils = trpc.useUtils();
  const { data: cases = [], isLoading } = trpc.caseStudies.list.useQuery();
  const createMut = trpc.caseStudies.create.useMutation({
    onSuccess: () => { utils.caseStudies.list.invalidate(); toast.success("案例已添加"); setShowForm(false); resetForm(); },
    onError: () => toast.error("添加失败"),
  });
  const parseFromDocMut = trpc.caseStudies.parseFromDoc.useMutation();
  const updateMut = trpc.caseStudies.update.useMutation({
    onSuccess: () => { utils.caseStudies.list.invalidate(); toast.success("案例已更新"); setEditingId(null); },
    onError: () => toast.error("更新失败"),
  });
  const deleteMut = trpc.caseStudies.delete.useMutation({
    onSuccess: () => { utils.caseStudies.list.invalidate(); toast.success("案例已删除"); },
  });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filterIndustry, setFilterIndustry] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchFileInputRef = useRef<HTMLInputElement>(null);
  const [batchItems, setBatchItems] = useState<ParsedCase[]>([]);
  const [showBatchReview, setShowBatchReview] = useState(false);
  const [batchSaving, setBatchSaving] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [form, setForm] = useState({
    title: "", clientAlias: "", isConfidential: false,
    industry: "", clientSize: "大型企业" as typeof CLIENT_SIZE_OPTIONS[number],
    region: "", productLines: [] as string[],
    painPoint: "", solution: "", quantifiedResult: "", roiHighlight: "", fullContent: "",
  });
  const resetForm = () => setForm({ title: "", clientAlias: "", isConfidential: false, industry: "", clientSize: "大型企业", region: "", productLines: [], painPoint: "", solution: "", quantifiedResult: "", roiHighlight: "", fullContent: "" });
  const startEdit = (c: any) => {
    setEditingId(c.id);
    setForm({ title: c.title || "", clientAlias: c.clientAlias || "", isConfidential: c.isConfidential || false, industry: c.industry || "", clientSize: c.clientSize || "大型企业", region: c.region || "", productLines: c.productLines || [], painPoint: c.painPoint || "", solution: c.solution || "", quantifiedResult: c.quantifiedResult || "", roiHighlight: c.roiHighlight || "", fullContent: c.fullContent || "" });
  };
  const handleSubmit = () => {
    if (!form.title || !form.painPoint || !form.solution) { toast.error("请填写标题、核心痛点和解决方案"); return; }
    const payload = { ...form, productLines: form.productLines.length > 0 ? form.productLines : undefined };
    if (editingId) { updateMut.mutate({ id: editingId, ...payload }); }
    else { createMut.mutate(payload); }
  };
  const filtered = filterIndustry ? cases.filter((c: any) => c.industry === filterIndustry) : cases;

  const handleDocUpload = async (file: File) => {
    setUploading(true);
    try {
      // Step 1: Upload file and extract text via existing endpoint
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload-doc", { method: "POST", body: formData });
      if (!res.ok) throw new Error("上传失败");
      const { extractedText, fileUrl } = await res.json();
      if (!extractedText) { toast.error("无法提取文档文字，请检查文件格式"); setUploading(false); return; }
      // Step 2: AI parse structured fields
      toast.info("AI 正在解析案例内容...");
      const parsed = await parseFromDocMut.mutateAsync({ extractedText, filename: file.name });
      // Step 3: Pre-fill form
      setForm(f => ({
        ...f,
        title: parsed.title || f.title,
        clientAlias: parsed.clientAlias || f.clientAlias,
        isConfidential: parsed.isConfidential ?? f.isConfidential,
        industry: parsed.industry || f.industry,
        clientSize: (parsed.clientSize as any) || f.clientSize,
        region: parsed.region || f.region,
        painPoint: parsed.painPoint || f.painPoint,
        solution: parsed.solution || f.solution,
        quantifiedResult: parsed.quantifiedResult || f.quantifiedResult,
        roiHighlight: parsed.roiHighlight || f.roiHighlight,
        fullContent: extractedText.slice(0, 5000),
      }));
      setShowForm(true);
      setEditingId(null);
      if ((parsed as any).needsVerification) {
        toast.warning("AI 解析完成。量化结果/ROI 使用了行业基准估算（标注「待核实」），请核实后保存");
      } else {
        toast.success("AI 解析完成，请核对后保存");
      }
    } catch (e: any) {
      toast.error("解析失败：" + (e.message || "未知错误"));
    } finally {
      setUploading(false);
    }
  };

  const handleBatchUpload = async (files: FileList) => {
    const fileArr = Array.from(files);
    if (fileArr.length === 0) return;
    // Initialize items with 'pending' status
    const initial: ParsedCase[] = fileArr.map(f => ({
      title: f.name.replace(/\.[^.]+$/, ''), clientAlias: '', isConfidential: false,
      industry: '', clientSize: '大型企业', region: '', painPoint: '', solution: '',
      quantifiedResult: '', roiHighlight: '', fullContent: '', needsVerification: false,
      filename: f.name, status: 'pending',
    }));
    setBatchItems(initial);
    setShowBatchReview(true);
    setExpandedIdx(null);
    // Process files sequentially to avoid rate limits
    for (let i = 0; i < fileArr.length; i++) {
      setBatchItems(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'parsing' } : item));
      try {
        const formData = new FormData();
        formData.append("file", fileArr[i]);
        const res = await fetch("/api/upload-doc", { method: "POST", body: formData });
        if (!res.ok) throw new Error("上传失败");
        const { extractedText } = await res.json();
        if (!extractedText) throw new Error("无法提取文字");
        const parsed = await parseFromDocMut.mutateAsync({ extractedText, filename: fileArr[i].name });
        setBatchItems(prev => prev.map((item, idx) => idx === i ? {
          ...item,
          title: parsed.title || item.title,
          clientAlias: parsed.clientAlias || '',
          isConfidential: parsed.isConfidential ?? false,
          industry: parsed.industry || '',
          clientSize: parsed.clientSize || '大型企业',
          region: parsed.region || '',
          painPoint: parsed.painPoint || '',
          solution: parsed.solution || '',
          quantifiedResult: parsed.quantifiedResult || '',
          roiHighlight: parsed.roiHighlight || '',
          fullContent: extractedText.slice(0, 5000),
          needsVerification: (parsed as any).needsVerification ?? false,
          status: 'done',
        } : item));
      } catch (e: any) {
        setBatchItems(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'error', error: e.message } : item));
      }
    }
    toast.success(`${fileArr.length} 个文件解析完成，请逐条核对后批量保存`);
  };

  const handleBatchSave = async () => {
    const toSave = batchItems.filter(item => item.status === 'done' && item.title && item.painPoint && item.solution);
    if (toSave.length === 0) { toast.error("没有可保存的案例（请确保标题、痛点、方案已填写）"); return; }
    setBatchSaving(true);
    let saved = 0;
    for (const item of toSave) {
      try {
        await createMut.mutateAsync({ title: item.title, clientAlias: item.clientAlias || undefined, isConfidential: item.isConfidential, industry: item.industry || undefined, clientSize: item.clientSize as any || undefined, region: item.region || undefined, painPoint: item.painPoint, solution: item.solution, quantifiedResult: item.quantifiedResult || undefined, roiHighlight: item.roiHighlight || undefined, fullContent: item.fullContent || undefined });
        saved++;
      } catch { /* skip failed */ }
    }
    await utils.caseStudies.list.invalidate();
    setBatchSaving(false);
    setShowBatchReview(false);
    setBatchItems([]);
    toast.success(`已保存 ${saved} / ${toSave.length} 个案例`);
  };

  const updateBatchItem = (idx: number, field: string, value: any) => {
    setBatchItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  return (
    <div className="space-y-4">
      {/* Batch Review Modal */}
      {showBatchReview && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
              <div>
                <h2 className="font-semibold text-base">批量案例预览确认</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  共 {batchItems.length} 个文件 · 已解析 {batchItems.filter(i => i.status === 'done').length} 个 · 解析中 {batchItems.filter(i => i.status === 'parsing').length} 个
                  {batchItems.some(i => i.needsVerification) && <span className="text-yellow-400 ml-2">⚠️ {batchItems.filter(i => i.needsVerification).length} 个含行业基准估算，待核实</span>}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => { setShowBatchReview(false); setBatchItems([]); }}><X className="h-4 w-4" /></Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {batchItems.map((item, idx) => (
                <div key={idx} className={`border rounded-lg overflow-hidden transition-colors ${item.status === 'error' ? 'border-red-500/30 bg-red-500/5' : item.needsVerification ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-border bg-card'}`}>
                  {/* Summary row */}
                  <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}>
                    <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                      {item.status === 'parsing' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                      {item.status === 'done' && <span className="text-green-400 text-sm">✓</span>}
                      {item.status === 'error' && <span className="text-red-400 text-sm">✗</span>}
                      {item.status === 'pending' && <span className="text-muted-foreground text-sm">○</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{item.title || item.filename}</span>
                        {item.industry && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">{item.industry}</span>}
                        {item.needsVerification && <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">⚠️ 待核实</span>}
                        {item.status === 'error' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">解析失败</span>}
                      </div>
                      {item.status === 'done' && <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.painPoint}</p>}
                      {item.status === 'error' && <p className="text-xs text-red-400 mt-0.5">{item.error}</p>}
                    </div>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform ${expandedIdx === idx ? 'rotate-180' : ''}`} />
                  </div>
                  {/* Expanded edit form */}
                  {expandedIdx === idx && item.status === 'done' && (
                    <div className="px-4 pb-4 border-t border-border/50 pt-3 grid grid-cols-2 gap-2">
                      <div className="col-span-2"><label className="text-xs text-muted-foreground">案例标题</label><Input className="mt-1 h-7 text-xs" value={item.title} onChange={e => updateBatchItem(idx, 'title', e.target.value)} /></div>
                      <div><label className="text-xs text-muted-foreground">客户别名</label><Input className="mt-1 h-7 text-xs" value={item.clientAlias} onChange={e => updateBatchItem(idx, 'clientAlias', e.target.value)} /></div>
                      <div><label className="text-xs text-muted-foreground">行业</label>
                        <Select value={item.industry || "none"} onValueChange={v => updateBatchItem(idx, 'industry', v === "none" ? "" : v)}>
                          <SelectTrigger className="mt-1 h-7 text-xs"><SelectValue placeholder="选择行业" /></SelectTrigger>
                          <SelectContent>{INDUSTRY_OPTIONS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div><label className="text-xs text-muted-foreground">客户规模</label>
                        <Select value={item.clientSize} onValueChange={v => updateBatchItem(idx, 'clientSize', v)}>
                          <SelectTrigger className="mt-1 h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{CLIENT_SIZE_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div><label className="text-xs text-muted-foreground">地区</label><Input className="mt-1 h-7 text-xs" value={item.region} onChange={e => updateBatchItem(idx, 'region', e.target.value)} /></div>
                      <div className="col-span-2"><label className="text-xs text-muted-foreground">核心痛点</label><Textarea className="mt-1 text-xs h-12 resize-none" value={item.painPoint} onChange={e => updateBatchItem(idx, 'painPoint', e.target.value)} /></div>
                      <div className="col-span-2"><label className="text-xs text-muted-foreground">解决方案</label><Textarea className="mt-1 text-xs h-12 resize-none" value={item.solution} onChange={e => updateBatchItem(idx, 'solution', e.target.value)} /></div>
                      <div className="col-span-2"><label className={`text-xs flex items-center gap-1 ${item.quantifiedResult?.includes('[行业基准估算') ? 'text-yellow-400' : 'text-muted-foreground'}`}><TrendingUp className="h-3 w-3" /> 量化结果{item.quantifiedResult?.includes('[行业基准估算') ? ' ⚠️ 待核实' : ''}</label><Textarea className="mt-1 text-xs h-12 resize-none" value={item.quantifiedResult} onChange={e => updateBatchItem(idx, 'quantifiedResult', e.target.value)} /></div>
                      <div className="col-span-2"><label className={`text-xs flex items-center gap-1 ${item.roiHighlight?.includes('[行业基准估算') ? 'text-yellow-400' : 'text-muted-foreground'}`}><Star className="h-3 w-3" /> ROI 亮点{item.roiHighlight?.includes('[行业基准估算') ? ' ⚠️ 待核实' : ''}</label><Input className="mt-1 h-7 text-xs" value={item.roiHighlight} onChange={e => updateBatchItem(idx, 'roiHighlight', e.target.value)} /></div>
                      <div className="col-span-2 flex items-center gap-2"><input type="checkbox" checked={item.isConfidential} onChange={e => updateBatchItem(idx, 'isConfidential', e.target.checked)} className="w-3.5 h-3.5" /><label className="text-xs text-muted-foreground cursor-pointer">保密案例</label></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between px-5 py-4 border-t border-border flex-shrink-0">
              <span className="text-xs text-muted-foreground">{batchItems.filter(i => i.status === 'done').length} 个案例可保存</span>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => { setShowBatchReview(false); setBatchItems([]); }}>取消</Button>
                <Button size="sm" onClick={handleBatchSave} disabled={batchSaving || batchItems.some(i => i.status === 'parsing')} className="gap-1.5">
                  {batchSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {batchSaving ? "保存中..." : `全部保存（${batchItems.filter(i => i.status === 'done').length} 个）`}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" /> 成功案例库</h2>
          <p className="text-xs text-muted-foreground mt-0.5">结构化存储成功案例，AI 生成敲门砖建议时自动引用同行业案例数据</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.txt" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) { handleDocUpload(f); e.target.value = ""; } }} />
          <input ref={batchFileInputRef} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.txt" multiple className="hidden"
            onChange={e => { if (e.target.files && e.target.files.length > 0) { handleBatchUpload(e.target.files); e.target.value = ""; } }} />
          <Button size="sm" variant="outline" onClick={() => batchFileInputRef.current?.click()} className="gap-1.5">
            <Upload className="h-4 w-4" /> 批量上传
          </Button>
          <Button size="sm" onClick={() => { setShowForm(true); setEditingId(null); resetForm(); }} className="gap-1.5"><Plus className="h-4 w-4" /> 手动添加</Button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Select value={filterIndustry || "all"} onValueChange={v => setFilterIndustry(v === "all" ? "" : v)}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="全部行业" /></SelectTrigger>
          <SelectContent><SelectItem value="all">全部行业</SelectItem>{INDUSTRY_OPTIONS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filtered.length} 个案例</span>
      </div>
      {(showForm || editingId !== null) && (
        <div className="border border-primary/30 rounded-lg p-4 bg-primary/5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-primary">{editingId ? "编辑案例" : "添加新案例"}</h3>
            {!editingId && <span className="text-xs text-muted-foreground">💡 可点击「上传案例文档」让 AI 自动填写</span>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="text-xs text-muted-foreground">案例标题 *</label><Input className="mt-1 h-8 text-sm" placeholder="如：某大型银行威胁检测响应优化项目" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div><label className="text-xs text-muted-foreground">客户别名（对外展示）</label><Input className="mt-1 h-8 text-sm" placeholder="如：华南某股份制银行" value={form.clientAlias} onChange={e => setForm(f => ({ ...f, clientAlias: e.target.value }))} /></div>
            <div><label className="text-xs text-muted-foreground">行业</label><Select value={form.industry || "none"} onValueChange={v => setForm(f => ({ ...f, industry: v === "none" ? "" : v }))}><SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="选择行业" /></SelectTrigger><SelectContent>{INDUSTRY_OPTIONS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent></Select></div>
            <div><label className="text-xs text-muted-foreground">客户规模</label><Select value={form.clientSize} onValueChange={v => setForm(f => ({ ...f, clientSize: v as any }))}><SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger><SelectContent>{CLIENT_SIZE_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
            <div><label className="text-xs text-muted-foreground">地区</label><Input className="mt-1 h-8 text-sm" placeholder="如：华南、东南亚、港澳" value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))} /></div>
            <div className="col-span-2"><label className="text-xs text-muted-foreground">核心痛点 * <span className="text-muted-foreground/60">（AI 用于匹配相似客户）</span></label><Textarea className="mt-1 text-sm h-16 resize-none" placeholder="客户面临的核心安全挑战，1-2句话" value={form.painPoint} onChange={e => setForm(f => ({ ...f, painPoint: e.target.value }))} /></div>
            <div className="col-span-2"><label className="text-xs text-muted-foreground">解决方案摘要 *</label><Textarea className="mt-1 text-sm h-16 resize-none" placeholder="我们提供了什么方案，核心功能是什么" value={form.solution} onChange={e => setForm(f => ({ ...f, solution: e.target.value }))} /></div>
            <div className="col-span-2"><label className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3 text-green-400" /> 量化结果 <span className="text-muted-foreground/60">（Champion 弹药的核心素材）</span></label><Textarea className="mt-1 text-sm h-14 resize-none" placeholder="如：MTTR 从4小时降至15分钟，节省安全人力成本30%，合规审计时间缩短60%" value={form.quantifiedResult} onChange={e => setForm(f => ({ ...f, quantifiedResult: e.target.value }))} /></div>
            <div className="col-span-2"><label className="text-xs text-muted-foreground flex items-center gap-1"><Star className="h-3 w-3 text-yellow-400" /> ROI 亮点一句话</label><Input className="mt-1 h-8 text-sm" placeholder="如：18个月 ROI 达240%，年化节省 $120K" value={form.roiHighlight} onChange={e => setForm(f => ({ ...f, roiHighlight: e.target.value }))} /></div>
            <div className="col-span-2 flex items-center gap-2"><input type="checkbox" id="isConfidential" checked={form.isConfidential} onChange={e => setForm(f => ({ ...f, isConfidential: e.target.checked }))} className="w-3.5 h-3.5" /><label htmlFor="isConfidential" className="text-xs text-muted-foreground cursor-pointer">保密案例（对外展示时隐藏客户名称）</label></div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending} className="gap-1">{(createMut.isPending || updateMut.isPending) ? <Loader2 className="h-3 w-3 animate-spin" /> : null}{editingId ? "保存修改" : "添加案例"}</Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }}>取消</Button>
          </div>
        </div>
      )}
      {isLoading ? <div className="text-center py-8 text-muted-foreground text-sm">加载中...</div> : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground"><BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">暂无成功案例</p><p className="text-xs mt-1">添加国内外成功案例后，AI 生成敲门砖建议时会自动引用同行业案例数据</p></div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((c: any) => (
            <div key={c.id} className="border border-border rounded-lg p-4 bg-card hover:border-primary/30 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{c.title}</span>
                    {c.industry && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">{c.industry}</span>}
                    {c.clientSize && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">{c.clientSize}</span>}
                    {c.region && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">{c.region}</span>}
                    {c.isConfidential && <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">🔒 保密</span>}
                  </div>
                  {c.clientAlias && <p className="text-xs text-muted-foreground mt-0.5">客户：{c.clientAlias}</p>}
                  <p className="text-xs text-muted-foreground mt-1.5"><span className="text-foreground/70 font-medium">痛点：</span>{c.painPoint}</p>
                  <p className="text-xs text-muted-foreground mt-1"><span className="text-foreground/70 font-medium">方案：</span>{c.solution}</p>
                  {c.quantifiedResult && (
                    <p className={`text-xs mt-1.5 flex items-center gap-1 ${c.quantifiedResult.includes('[行业基准估算') ? 'text-yellow-500/80' : 'text-green-400'}`}>
                      <TrendingUp className="h-3 w-3 flex-shrink-0" />{c.quantifiedResult}
                    </p>
                  )}
                  {c.roiHighlight && (
                    <p className={`text-xs mt-0.5 flex items-center gap-1 ${c.roiHighlight.includes('[行业基准估算') ? 'text-yellow-500/80' : 'text-yellow-400'}`}>
                      <Star className="h-3 w-3 flex-shrink-0" />{c.roiHighlight}
                    </p>
                  )}
                  {!c.quantifiedResult && !c.roiHighlight && (
                    <p className="text-xs mt-1.5 text-muted-foreground/50 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />暂无量化数据
                    </p>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => startEdit(c)}>编辑</Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-red-400 hover:text-red-300" onClick={() => deleteMut.mutate({ id: c.id })}>删除</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
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
  const [activeSubfolderId, setActiveSubfolderId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadDialog, setUploadDialog] = useState(false);
  const [uploadForm, setUploadForm] = useState({ title: "", description: "" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchFileInputRef = useRef<HTMLInputElement>(null);
  const [batchDialog, setBatchDialog] = useState(false);
  const [batchItems, setBatchItems] = useState<Array<{
    id: string; file: File; title: string; status: "pending" | "uploading" | "done" | "error"; progress: number; error?: string;
  }>>([]);
  const [batchUploading, setBatchUploading] = useState(false);
  const [noteDialog, setNoteDialog] = useState(false);
  const [noteForm, setNoteForm] = useState({ title: "", description: "", content: "" });
  const [folderDialog, setFolderDialog] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [draggingDocId, setDraggingDocId] = useState<number | null>(null);
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: docs = [], refetch } = trpc.productDocs.list.useQuery(undefined);
  const foldersQuery = trpc.productDocs.listFolders.useQuery(activeFolder ? { productLine: activeFolder } : undefined);
  const subfolders = (foldersQuery.data || []) as Array<{ id: number; name: string; productLine: string }>;

  const deleteMut = trpc.productDocs.delete.useMutation({
    onSuccess: () => { toast.success("已删除"); refetch(); },
    onError: (e: any) => toast.error("删除失败: " + e.message),
  });
  const updateProductLineMut = trpc.productDocs.updateProductLine.useMutation({
    onSuccess: () => { toast.success("已移动"); refetch(); },
    onError: (e: any) => toast.error("移动失败: " + e.message),
  });
  const createFolderMut = trpc.productDocs.createFolder.useMutation({
    onSuccess: () => { toast.success("子文件夹已创建"); foldersQuery.refetch(); setFolderName(""); setFolderDialog(false); },
    onError: (e: any) => toast.error("创建文件夹失败: " + e.message),
  });
  const renameFolderMut = trpc.productDocs.renameFolder.useMutation({
    onSuccess: () => { toast.success("文件夹已重命名"); foldersQuery.refetch(); },
    onError: (e: any) => toast.error("重命名失败: " + e.message),
  });
  const deleteFolderMut = trpc.productDocs.deleteFolder.useMutation({
    onSuccess: () => { toast.success("文件夹已删除"); foldersQuery.refetch(); },
    onError: (e: any) => toast.error("删除文件夹失败: " + e.message),
  });
  const moveToFolderMut = trpc.productDocs.moveToFolder.useMutation({
    onSuccess: () => { toast.success("文档已归档"); refetch(); foldersQuery.refetch(); },
    onError: (e: any) => toast.error("移动失败: " + e.message),
  });
  const getSignedUrlMut = trpc.productDocs.getSignedUrl.useMutation({
    onSuccess: (data: any) => {
      setPreviewUrl(`https://docs.google.com/viewer?url=${encodeURIComponent(data.url)}&embedded=true`);
      setPreviewLoading(false);
    },
    onError: () => { toast.error("无法加载预览"); setPreviewLoading(false); setPreviewOpen(false); },
  });
  const confirmUploadMut = trpc.productDocs.confirmUpload.useMutation();
  const createNoteMut = trpc.productDocs.createNote.useMutation({
    onSuccess: () => {
      toast.success("知识文档已创建，现可被 AI 引用");
      refetch(); setNoteForm({ title: "", description: "", content: "" }); setNoteDialog(false);
    },
    onError: (e: any) => toast.error("创建失败: " + e.message),
  });

  const handlePreview = (doc: any) => {
    setPreviewDoc(doc); setPreviewUrl(null); setPreviewOpen(true);
    if (doc.mimeType === "text/markdown" || doc.mimeType === "text/plain") {
      setPreviewLoading(false);
      return;
    }
    setPreviewLoading(true);
    getSignedUrlMut.mutate({ fileKey: doc.fileKey });
  };
  const handleDelete = (id: number) => { if (confirm("确认删除此文档？")) deleteMut.mutate({ id }); };

  const uploadOneFile = (file: File, title: string, description = "", onProgress?: (progress: number) => void) => new Promise<void>((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress?.(Math.round(e.loaded / e.total * 100)); };
    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const { fileKey, fileUrl, extractedText } = JSON.parse(xhr.responseText);
          await confirmUploadMut.mutateAsync({
            title, description: description || undefined,
            productLine: activeFolder || undefined, folderId: activeSubfolderId, filename: file.name,
            mimeType: file.type || "application/octet-stream",
            fileKey, fileUrl, fileSize: file.size, extractedText: extractedText || undefined,
          });
          resolve();
        } catch (err: any) { reject(err); }
      } else {
        try { const e = JSON.parse(xhr.responseText); reject(new Error(e.error || xhr.statusText)); }
        catch { reject(new Error(xhr.statusText)); }
      }
    };
    xhr.onerror = () => reject(new Error("网络错误"));
    xhr.open("POST", "/api/upload-doc");
    xhr.send(formData);
  });

  const handleUpload = async () => {
    if (!selectedFile || !uploadForm.title || !activeFolder) return;
    setUploading(true); setUploadProgress(0);
    try {
      await uploadOneFile(selectedFile, uploadForm.title, uploadForm.description, setUploadProgress);
      toast.success("上传成功，文档已归入「" + (FOLDER_DEFS.find(f => f.productLine === activeFolder)?.label || activeFolder) + "」");
      await refetch(); setSelectedFile(null); setUploadForm({ title: "", description: "" }); setUploadDialog(false);
    } catch (err: any) {
      toast.error("上传失败: " + (err.message || "未知错误"));
    } finally {
      setUploading(false); setUploadProgress(0);
    }
  };

  const handleBatchFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next = Array.from(files).map(file => ({
      id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
      file,
      title: file.name.replace(/\.[^.]+$/, ""),
      status: "pending" as const,
      progress: 0,
    }));
    setBatchItems(next);
  };

  const handleBatchUpload = async () => {
    const pending = batchItems.filter(item => item.status !== "done");
    if (!pending.length || !activeFolder) return;
    setBatchUploading(true);
    for (const item of pending) {
      setBatchItems(current => current.map(v => v.id === item.id ? { ...v, status: "uploading", progress: 0, error: undefined } : v));
      try {
        await uploadOneFile(item.file, item.title || item.file.name.replace(/\.[^.]+$/, ""), "", progress => {
          setBatchItems(current => current.map(v => v.id === item.id ? { ...v, progress } : v));
        });
        setBatchItems(current => current.map(v => v.id === item.id ? { ...v, status: "done", progress: 100 } : v));
      } catch (err: any) {
        setBatchItems(current => current.map(v => v.id === item.id ? { ...v, status: "error", error: err.message || "上传失败" } : v));
      }
    }
    await refetch();
    setBatchUploading(false);
  };

  const handleCreateNote = () => {
    if (!activeFolder || !noteForm.title.trim() || !noteForm.content.trim()) return;
    createNoteMut.mutate({
      title: noteForm.title.trim(),
      description: noteForm.description.trim() || undefined,
      productLine: activeFolder,
      folderId: activeSubfolderId,
      content: noteForm.content.trim(),
    });
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
  const folderDocs = activeFolder ? (docsByLine[activeFolder] || []) : [];
  const currentSubfolder = activeSubfolderId === null ? null : subfolders.find(folder => folder.id === activeSubfolderId) || null;
  const visibleDocs = folderDocs.filter((doc: any) => {
    const inCurrentFolder = activeSubfolderId === null ? !doc.folderId : doc.folderId === activeSubfolderId;
    return inCurrentFolder && (!search || doc.title.toLowerCase().includes(search.toLowerCase()));
  });
  const getFolderDocCount = (folderId: number) => folderDocs.filter((doc: any) => doc.folderId === folderId).length;
  const handleCreateFolder = () => {
    if (!activeFolder || !folderName.trim()) return;
    createFolderMut.mutate({ productLine: activeFolder, name: folderName.trim() });
  };
  const handleRenameFolder = (folder: { id: number; name: string }) => {
    const name = window.prompt("请输入新的文件夹名称", folder.name)?.trim();
    if (name && name !== folder.name) renameFolderMut.mutate({ id: folder.id, name });
  };
  const handleDeleteFolder = (folder: { id: number; name: string }) => {
    if (window.confirm(`确认删除文件夹「${folder.name}」？仅空文件夹可以删除。`)) deleteFolderMut.mutate({ id: folder.id });
  };
  const handleMoveDoc = (docId: number, value: string) => {
    if (value === "root") { moveToFolderMut.mutate({ id: docId, folderId: null }); return; }
    if (value.startsWith("subfolder:")) { moveToFolderMut.mutate({ id: docId, folderId: Number(value.slice(10)) }); return; }
    if (value.startsWith("line:")) updateProductLineMut.mutate({ id: docId, productLine: value.slice(5) });
  };

  // ── 二级文档列表视图 ──
  if (activeFolder && activeFolderDef) {
    return (
      <div className="space-y-4">
        {/* 面包屑导航 */}
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => { setActiveFolder(null); setActiveSubfolderId(null); setSearch(""); }}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown className="h-4 w-4 rotate-90" /> 武器库
          </button>
          <span className="text-muted-foreground">/</span>
          <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${activeFolderDef.badge}`}>
            {activeFolderDef.icon} {activeFolderDef.label}
          </span>
          {currentSubfolder && <>
            <span className="text-muted-foreground">/</span>
            <button type="button" onClick={() => setActiveSubfolderId(null)} className="flex items-center gap-1 text-sm font-medium hover:text-primary transition-colors">
              <FolderOpen className="h-4 w-4 text-amber-500" /> {currentSubfolder.name}
            </button>
          </>}
        </div>

        {/* 工具栏 */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="搜索文档..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {activeSubfolderId === null && <Button type="button" variant="outline" onClick={() => setFolderDialog(true)} className="gap-2 flex-shrink-0">
            <FolderPlus className="h-4 w-4" /> 新建文件夹
          </Button>}
          <Button type="button" variant="outline" onClick={() => setNoteDialog(true)} className="gap-2 flex-shrink-0">
            <FilePlus2 className="h-4 w-4" /> 新建文档
          </Button>
          <Button type="button" variant="outline" onClick={() => setBatchDialog(true)} className="gap-2 flex-shrink-0">
            <Files className="h-4 w-4" /> 批量上传
          </Button>
          <Button type="button" onClick={() => setUploadDialog(true)} className="gap-2 flex-shrink-0">
            <Upload className="h-4 w-4" /> 上传文档
          </Button>
        </div>

        {/* 子文件夹：文档可拖拽到任一资料包完成归档 */}
        {activeSubfolderId === null && subfolders.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {subfolders.map(folder => (
              <div key={folder.id} role="button" tabIndex={0}
                onClick={() => setActiveSubfolderId(folder.id)}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") setActiveSubfolderId(folder.id); }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); if (draggingDocId !== null) moveToFolderMut.mutate({ id: draggingDocId, folderId: folder.id }); setDraggingDocId(null); }}
                className="group relative cursor-pointer rounded-xl border border-amber-500/25 bg-amber-500/[0.04] p-4 text-left transition-colors hover:border-amber-500/60 hover:bg-amber-500/[0.08] focus:outline-none focus:ring-2 focus:ring-primary">
                <Folder className="h-8 w-8 text-amber-500" />
                <p className="mt-2 truncate text-sm font-semibold">{folder.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{getFolderDocCount(folder.id)} 份文档 · 拖入归档</p>
                <div className="absolute right-2 top-2 hidden gap-1 group-hover:flex">
                  <button type="button" title="重命名" onClick={e => { e.stopPropagation(); handleRenameFolder(folder); }} className="rounded p-1 text-muted-foreground hover:bg-background hover:text-primary"><Pencil className="h-3.5 w-3.5" /></button>
                  <button type="button" title="删除空文件夹" onClick={e => { e.stopPropagation(); handleDeleteFolder(folder); }} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 当前目录的文档列表 */}
        {visibleDocs.length === 0 ? (
          <div className={`flex flex-col items-center py-16 rounded-2xl border-2 border-dashed bg-gradient-to-br ${activeFolderDef.color} ${activeFolderDef.border} gap-3`}>
            <span className="text-5xl">{activeFolderDef.icon}</span>
            <p className="text-sm text-muted-foreground">{currentSubfolder ? `「${currentSubfolder.name}」暂无文档` : "产品线根目录暂无文档"}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => setUploadDialog(true)} className="gap-1.5">
              <Upload className="h-3.5 w-3.5" /> 上传第一份文档
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleDocs.map((doc: any) => (
              <div key={doc.id} draggable onDragStart={() => setDraggingDocId(doc.id)} onDragEnd={() => setDraggingDocId(null)} className="group flex cursor-grab items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card hover:bg-accent/20 transition-colors active:cursor-grabbing">
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
                  <Select onValueChange={v => handleMoveDoc(doc.id, v)}>
                    <SelectTrigger className="h-7 text-xs w-auto gap-1 px-2 border-dashed opacity-0 group-hover:opacity-100 transition-opacity">
                      <Tag className="h-3 w-3" /> 移动到
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>当前产品线</SelectLabel>
                        <SelectItem value="root">产品线根目录</SelectItem>
                        {subfolders.map(folder => <SelectItem key={folder.id} value={`subfolder:${folder.id}`}>📁 {folder.name}</SelectItem>)}
                      </SelectGroup>
                      {["亚信科技", "亚信安全", "其他"].map(group => (
                        <SelectGroup key={group}>
                          <SelectLabel>{group}</SelectLabel>
                          {FOLDER_DEFS.filter(f => f.group === group && f.productLine !== activeFolder).map(f => (
                            <SelectItem key={f.productLine} value={`line:${f.productLine}`}>
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

        {/* 新建子文件夹 Dialog */}
        <Dialog open={folderDialog} onOpenChange={open => { setFolderDialog(open); if (!open) setFolderName(""); }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><FolderPlus className="h-5 w-5 text-amber-500" /> 新建「{activeFolderDef.label}」资料文件夹</DialogTitle></DialogHeader>
            <div className="space-y-2">
              <label className="text-sm font-medium">文件夹名称 *</label>
              <Input autoFocus value={folderName} onChange={e => setFolderName(e.target.value)} placeholder="例：AI Pentest 产品与客户资料包" onKeyDown={e => { if (e.key === "Enter") handleCreateFolder(); }} />
              <p className="text-xs text-muted-foreground">文件夹用于归档同一主题的多份资料。创建后可直接在里面批量上传、新建文档，或从根目录拖拽已有文档进入。</p>
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setFolderDialog(false)}>取消</Button><Button type="button" disabled={!folderName.trim() || createFolderMut.isPending} onClick={handleCreateFolder} className="gap-2"><FolderPlus className="h-4 w-4" /> 创建文件夹</Button></DialogFooter>
          </DialogContent>
        </Dialog>

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
                      <p>PDF / PPT / DOC / Excel / TXT / Markdown / MP4，不限大小</p>
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.pptx,.ppt,.docx,.doc,.xls,.xlsx,.txt,.md,.markdown,.mp4,.mov,.avi" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
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

        {/* 批量上传 Dialog */}
        <Dialog open={batchDialog} onOpenChange={open => { setBatchDialog(open); if (!open && !batchUploading) setBatchItems([]); }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Files className="h-5 w-5 text-primary" /> 批量上传到「{activeFolderDef.label}」</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="border-2 border-dashed rounded-lg p-5 text-center cursor-pointer hover:border-primary/50 transition-colors" onClick={() => batchFileInputRef.current?.click()}>
                <Files className="h-7 w-7 mx-auto mb-2 text-primary/70" />
                <p className="text-sm font-medium">选择多个产品资料文件</p>
                <p className="text-xs text-muted-foreground mt-1">将按文件名自动生成标题；支持 PDF、PPT、Word、Excel、TXT 和 Markdown</p>
                <input ref={batchFileInputRef} type="file" multiple className="hidden" accept=".pdf,.pptx,.ppt,.docx,.doc,.xls,.xlsx,.txt,.md,.markdown,.mp4,.mov,.avi" onChange={e => { handleBatchFilesSelected(e.target.files); e.target.value = ""; }} />
              </div>
              {batchItems.length > 0 && (
                <div className="max-h-[320px] overflow-y-auto rounded-lg border divide-y">
                  {batchItems.map(item => (
                    <div key={item.id} className="px-3 py-2.5 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                        <Input value={item.title} disabled={batchUploading} onChange={e => setBatchItems(current => current.map(v => v.id === item.id ? { ...v, title: e.target.value } : v))} className="h-7 text-xs" />
                        <span className={cn("text-[10px] flex-shrink-0", item.status === "done" ? "text-green-500" : item.status === "error" ? "text-destructive" : item.status === "uploading" ? "text-primary" : "text-muted-foreground")}>{item.status === "done" ? "已完成" : item.status === "error" ? "失败" : item.status === "uploading" ? `${item.progress}%` : formatSize(item.file.size)}</span>
                      </div>
                      {item.status === "uploading" && <div className="h-1 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${item.progress}%` }} /></div>}
                      {item.error && <p className="pl-6 text-[10px] text-destructive">{item.error}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={batchUploading} onClick={() => setBatchDialog(false)}>取消</Button>
              <Button type="button" disabled={batchUploading || batchItems.length === 0} onClick={handleBatchUpload} className="gap-2">
                {batchUploading ? <Spinner className="h-4 w-4" /> : <Files className="h-4 w-4" />}
                {batchUploading ? "正在逐份上传" : `上传 ${batchItems.length} 份文档`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 系统内新建知识文档 Dialog */}
        <Dialog open={noteDialog} onOpenChange={open => { setNoteDialog(open); if (!open) setNoteForm({ title: "", description: "", content: "" }); }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><FilePlus2 className="h-5 w-5 text-primary" /> 新建「{activeFolderDef.label}」知识文档</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div><label className="text-sm font-medium">文档标题 *</label><Input className="mt-1" value={noteForm.title} onChange={e => setNoteForm(current => ({ ...current, title: e.target.value }))} placeholder="例：AI Pentest 客户价值与适用场景" /></div>
              <div><label className="text-sm font-medium">摘要（可选）</label><Input className="mt-1" value={noteForm.description} onChange={e => setNoteForm(current => ({ ...current, description: e.target.value }))} placeholder="用于列表检索和快速判断的简短说明" /></div>
              <div><label className="text-sm font-medium">正文 *</label><Textarea className="mt-1 min-h-[280px] font-mono text-xs leading-6" value={noteForm.content} onChange={e => setNoteForm(current => ({ ...current, content: e.target.value }))} placeholder={'支持 Markdown。建议写明：\n# 产品定位\n## 适用场景\n## 核心能力\n## 客户价值\n## 竞品与限制'} /></div>
              <p className="text-xs text-muted-foreground">保存后系统会生成 Markdown 原文件并写入知识库；内容可直接被武器库 AI 生成工作台引用。</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNoteDialog(false)}>取消</Button>
              <Button type="button" disabled={createNoteMut.isPending || !noteForm.title.trim() || !noteForm.content.trim()} onClick={handleCreateNote} className="gap-2">
                {createNoteMut.isPending ? <Spinner className="h-4 w-4" /> : <FilePlus2 className="h-4 w-4" />}{createNoteMut.isPending ? "保存中" : "保存为知识文档"}
              </Button>
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
              {previewDoc && (previewDoc.mimeType === "text/markdown" || previewDoc.mimeType === "text/plain") && (
                <div className="h-full overflow-y-auto px-6 py-5 prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{previewDoc.extractedText || "文档正文为空"}</ReactMarkdown>
                </div>
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

type WeaponContext = { clientId?: number; opportunityId?: number; clientName?: string; opportunityName?: string; stage?: string; product?: string; competitor?: string; focus?: string };

function AIArsenalTab({ weaponContext }: { weaponContext?: WeaponContext }) {
  const [category, setCategory] = useState<"方案类" | "弹药类" | "话术类">("方案类");
  const [prompt, setPrompt] = useState("");
  const [selectedDocIds, setSelectedDocIds] = useState<number[]>([]);
  const [targetContact, setTargetContact] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ id: number; content: string; title: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [hydratedContextKey, setHydratedContextKey] = useState("");
  const [feedbackById, setFeedbackById] = useState<Record<number, string>>({});
  const [selectedClientId, setSelectedClientId] = useState<number | undefined>(weaponContext?.clientId);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<number | undefined>(weaponContext?.opportunityId);

  const { data: docs = [] } = trpc.productDocs.list.useQuery(undefined);
  const { data: clients = [] } = trpc.clients.list.useQuery();
  const { data: opportunities = [] } = trpc.opportunities.listByClient.useQuery({ clientId: selectedClientId || 0 }, { enabled: Boolean(selectedClientId) });
  const { data: history = [], refetch: refetchHistory } = trpc.arsenalAI.list.useQuery(selectedOpportunityId ? { clientId: selectedClientId, opportunityId: selectedOpportunityId } : selectedClientId ? { clientId: selectedClientId } : undefined);
  const generateMut = trpc.arsenalAI.generate.useMutation({
    onSuccess: (data) => { setResult(data); refetchHistory(); },
    onError: (e) => toast.error("生成失败: " + e.message),
  });
  const deleteMut = trpc.arsenalAI.delete.useMutation({
    onSuccess: () => { toast.success("已删除"); refetchHistory(); },
  });
  const outcomeMut = trpc.arsenalAI.updateOutcome.useMutation({
    onSuccess: () => { toast.success("已记录采用状态与客户反馈；下次生成仅将其作为待验证参考"); refetchHistory(); },
    onError: (error) => toast.error(`更新方案处置记录失败：${error.message}`),
  });

  const contextKey = [weaponContext?.clientId, weaponContext?.opportunityId, weaponContext?.opportunityName, weaponContext?.stage, weaponContext?.product, weaponContext?.competitor, weaponContext?.focus].filter(Boolean).join("|");
  useEffect(() => {
    if (!contextKey || hydratedContextKey === contextKey) return;
    const details = [
      weaponContext?.clientName ? `客户：${weaponContext.clientName}` : "",
      weaponContext?.opportunityName ? `商机：${weaponContext.opportunityName}` : "",
      weaponContext?.stage ? `当前阶段：${weaponContext.stage}` : "",
      weaponContext?.product ? `关联产品：${weaponContext.product}` : "",
      weaponContext?.competitor ? `已确认竞品：${weaponContext.competitor}` : "",
      weaponContext?.focus ? `当前需要补强的赢单证据：${weaponContext.focus}` : "",
    ].filter(Boolean).join("\n");
    setPrompt(`${details}\n\n请基于以上已入库商机事实，生成可供负责人审核的${weaponContext?.competitor ? "竞争材料或差异化方案" : "方案材料"}。请将未确认事项明确标为待验证假设，不要编造客户承诺或数据。`);
    if (weaponContext?.competitor) setCategory("弹药类");
    setHydratedContextKey(contextKey);
  }, [contextKey, hydratedContextKey, weaponContext]);

  const handleGenerate = async () => {
    if (!prompt.trim()) { toast.error("请描述你的需求"); return; }
    setGenerating(true); setResult(null);
    try {
      const linkedOpportunity = (opportunities as any[]).find((item: any) => item.id === selectedOpportunityId);
      await generateMut.mutateAsync({ category, prompt: prompt.trim(), docIds: selectedDocIds.length > 0 ? selectedDocIds : undefined, clientId: selectedClientId, opportunityId: selectedOpportunityId, targetContact: targetContact || undefined, title: linkedOpportunity ? `${(clients as any[]).find((item: any) => item.id === selectedClientId)?.name || "客户"} · ${linkedOpportunity.name} · ${category}` : undefined });
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
        {weaponContext?.opportunityName && <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/[0.06] p-3"><div className="flex items-center gap-2 text-xs font-semibold text-cyan-100"><Sparkles className="h-3.5 w-3.5" />来自商机作战室的上下文</div><p className="mt-1 text-[11px] leading-5 text-slate-300">{weaponContext.clientName} · {weaponContext.opportunityName}{weaponContext.stage ? ` · ${weaponContext.stage}` : ""}</p><p className="mt-1 text-[10px] leading-4 text-slate-500">已预填当前作战事实；请在生成前审阅并补充需求，AI 不会把未确认信息写成客户结论。</p></div>}
        <div className="grid gap-3 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.03] p-3 sm:grid-cols-2"><div><label className="mb-1 block text-xs font-medium">关联客户（可选）</label><Select value={selectedClientId ? String(selectedClientId) : "none"} onValueChange={value => { const nextClientId = value === "none" ? undefined : Number(value); setSelectedClientId(nextClientId); setSelectedOpportunityId(undefined); }}><SelectTrigger className="h-9 text-xs"><SelectValue placeholder="不关联客户" /></SelectTrigger><SelectContent><SelectItem value="none">不关联客户</SelectItem>{(clients as any[]).map((item: any) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select></div><div><label className="mb-1 block text-xs font-medium">关联商机（可选）</label><Select value={selectedOpportunityId ? String(selectedOpportunityId) : "none"} disabled={!selectedClientId} onValueChange={value => setSelectedOpportunityId(value === "none" ? undefined : Number(value))}><SelectTrigger className="h-9 text-xs"><SelectValue placeholder={selectedClientId ? "选择商机" : "请先选择客户"} /></SelectTrigger><SelectContent><SelectItem value="none">不关联商机</SelectItem>{(opportunities as any[]).map((item: any) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select></div><p className="sm:col-span-2 text-[10px] leading-4 text-slate-500">关联商机后，历史材料按该商机筛选；下一次生成只参考人工标记的采用状态和客户反馈，并始终标为待验证上下文。</p></div>
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
                  <div key={h.id} className="p-3 hover:bg-muted/30 group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs shrink-0">{h.category}</Badge>
                        <span className="text-sm truncate">{h.title}</span>
                        <Badge variant={h.adoptionStatus === "已采用" ? "default" : h.adoptionStatus === "未采用" ? "secondary" : "outline"} className="text-[10px] shrink-0">{h.adoptionStatus || "待确认"}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{h.prompt}</p>
                      {h.opportunityId && <p className="mt-1 text-[10px] text-primary/80">商机 #{h.opportunityId} · 此处置记录仅供后续方案待验证参考</p>}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button onClick={() => setResult({ id: h.id, content: h.generatedContent, title: h.title })} className="text-xs text-primary hover:underline">查看</button>
                      <Select value={h.adoptionStatus || "待确认"} onValueChange={value => outcomeMut.mutate({ id: h.id, adoptionStatus: value as "待确认" | "已采用" | "未采用", customerFeedback: feedbackById[h.id] ?? h.customerFeedback ?? undefined })}><SelectTrigger className="h-7 w-24 text-[10px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="待确认">待确认</SelectItem><SelectItem value="已采用">已采用</SelectItem><SelectItem value="未采用">未采用</SelectItem></SelectContent></Select>
                      <Input value={feedbackById[h.id] ?? h.customerFeedback ?? ""} onChange={event => setFeedbackById(prev => ({ ...prev, [h.id]: event.target.value }))} onBlur={() => { const feedback = feedbackById[h.id]; if (feedback !== undefined && feedback !== (h.customerFeedback || "")) outcomeMut.mutate({ id: h.id, adoptionStatus: h.adoptionStatus || "待确认", customerFeedback: feedback }); }} placeholder="客户反馈（可选）" className="h-7 min-w-40 flex-1 text-[10px]" />
                      <button onClick={() => deleteMut.mutate({ id: h.id })} className="text-muted-foreground hover:text-destructive p-1">
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
  const [location] = useLocation();
  const params = new URLSearchParams(location.split("?")[1] || "");
  const contextClientId = Number(params.get("clientId"));
  const weaponContext: WeaponContext | undefined = Number.isFinite(contextClientId) && contextClientId > 0 ? {
    clientId: contextClientId,
    opportunityId: Number(params.get("opportunityId")) || undefined,
    clientName: params.get("clientName") || undefined,
    opportunityName: params.get("opportunity") || undefined,
    stage: params.get("stage") || undefined,
    product: params.get("product") || undefined,
    competitor: params.get("competitor") || undefined,
    focus: params.get("focus") || undefined,
  } : undefined;
  const initialTab = params.get("tab") === "ai" ? "ai" : "docs";
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">武器库</h1>
        <p className="text-muted-foreground text-sm mt-1">产品文档管理 · 成功案例库 · 上下文化 AI 方案定制 · 智能报价工具</p>
      </div>
      <Tabs key={initialTab} defaultValue={initialTab} className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full max-w-4xl">
          <TabsTrigger value="docs" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" /> 产品文档</TabsTrigger>
          <TabsTrigger value="cases" className="gap-1.5 text-xs"><BookOpen className="h-3.5 w-3.5" /> 成功案例库</TabsTrigger>
          <TabsTrigger value="ai" className="gap-1.5 text-xs"><Bot className="h-3.5 w-3.5" /> AI方案定制</TabsTrigger>
          <TabsTrigger value="quote" className="gap-1.5 text-xs"><Calculator className="h-3.5 w-3.5" /> 报价工具</TabsTrigger>
        </TabsList>
        <TabsContent value="docs"><ProductDocsTab /></TabsContent>
        <TabsContent value="cases"><CaseStudiesTab /></TabsContent>
        <TabsContent value="ai"><AIArsenalTab weaponContext={weaponContext} /></TabsContent>
        <TabsContent value="quote"><QuoteToolTab /></TabsContent>
      </Tabs>
    </div>
  );
}
