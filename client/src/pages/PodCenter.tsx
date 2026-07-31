import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Users, Plus, CheckCircle2, Circle, MessageSquare, Clock, Zap, TrendingUp, AlertTriangle, ChevronRight, X, Trash2, LayoutGrid, List, Network, Target, BookOpen, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, useDroppable } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRole, PodRole } from "@/contexts/RoleContext";
import { TermTooltip } from "@/components/TermTooltip";

const roleColor: Record<string, string> = {
  AD: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  SAM: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  SA: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  RSM: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

const roleDesc: Record<string, { title: string; focus: string[]; rules: string[] }> = {
  AD: {
    title: "Account Director · 顶层破冰",
    focus: ["C-Level 关系建立", "预算决策人识别", "战略价值传递"],
    rules: ["SAM 提交1-Pager后方可请AD出场", "每次出场必须有明确的会议目标", "会后24小时内同步会面结果"],
  },
  SAM: {
    title: "Strategic Account Manager · 中枢操盘",
    focus: ["MEDDPICC 全要素推进", "Champion 培育", "Deal Review 主持"],
    rules: ["每周更新MEDDPICC状态", "每月至少次Deal Review", "情报信号48小时内录入"],
  },
  SA: {
    title: "Solution Architect · 技术定标",
    focus: ["技术方案定制", "POC 设计与执行", "竞品技术对标"],
    rules: ["POC前完成技术需求确认", "为Champion提供技术弹药", "参与SPIN I/N环节"],
  },
  RSM: {
    title: "Regional Sales Mgr · 属地辅攻",
    focus: ["属地化招投标支持", "商务渠道打通", "属地关系协同"],
    rules: ["专项业绩100%复算给对应省办", "属地招投标信息48小时内同步", "与SAM保持每周同步"],
  },
};

// 术语对应表：将角色/术语映射到 TermTooltip term
const TERM_MAP: Record<string, string> = {
  "MEDDPICC": "MEDDPICC",
  "Champion": "Champion",
  "Deal Review": "Deal Review",
  "POC": "POC",
  "1-Pager": "1-Pager",
  "AD": "AD",
  "SAM": "SAM",
  "SA": "SA",
  "RSM": "RSM",
};

function AddTaskForm({ clientId, role, onSuccess }: { clientId: number; role: PodRole; onSuccess: () => void }) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");

  const { data: clients = [] } = trpc.clients.list.useQuery();
  const [selectedClientId, setSelectedClientId] = useState(clientId);

    const create = trpc.pod.addTask.useMutation({
    onSuccess: () => { onSuccess(); setTitle(""); setNotes(""); setDueDate(""); toast.success("任务已添加"); }
  });

  return (
    <div className="space-y-2 p-3 bg-muted/20 rounded-lg border border-border">
      <Select value={String(selectedClientId)} onValueChange={(v) => setSelectedClientId(Number(v))}>
        <SelectTrigger className="h-7 text-xs">
          <SelectValue placeholder="选择客户" />
        </SelectTrigger>
        <SelectContent>
          {clients.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Input className="h-7 text-xs" placeholder="任务标题..." value={title} onChange={e => setTitle(e.target.value)} />
      <Textarea className="h-12 text-xs resize-none" placeholder="备注..." value={notes} onChange={e => setNotes(e.target.value)} />
      <Input type="date" className="h-7 text-xs" value={dueDate} onChange={e => setDueDate(e.target.value)} />
      <Button
        size="sm" className="w-full h-7 text-xs"
        disabled={!title.trim() || create.isPending}
        onClick={() => create.mutate({ clientId: selectedClientId, assignedRole: role, title, description: notes || undefined, dueDate: dueDate || undefined })}
      >
        添加任务
      </Button>
    </div>
  );
}

// ── Kanban Components ──────────────────────────────────────────────────────
function KanbanCard({ task, clientName, onDelete }: { task: any; clientName?: string; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 } : undefined;
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.taskStatus !== 'done';
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "p-2.5 rounded-lg border bg-card cursor-grab active:cursor-grabbing select-none",
        isDragging ? "opacity-50 shadow-lg border-primary/50" : "border-border hover:border-muted-foreground/40",
        task.taskStatus === 'done' && "opacity-60"
      )}
    >
      <div className="flex items-start justify-between gap-1.5 mb-1">
        <div className="flex items-center gap-1 flex-wrap">
          {clientName && <span className="text-[10px] font-medium text-primary">{clientName}</span>}
          {task.opportunityName && (
            <span className="inline-flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Target className="w-2.5 h-2.5" />{task.opportunityName}
            </span>
          )}
          {task.taskType === 'internal_resource' && (
            <span className="inline-flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">
              <Network className="w-2.5 h-2.5" />对内协调
            </span>
          )}
          {isOverdue && <span className="text-[10px] text-red-400 flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />逾期</span>}
        </div>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-muted-foreground/30 hover:text-red-400 transition-colors flex-shrink-0">
          <X className="w-3 h-3" />
        </button>
      </div>
      <div className="text-xs font-medium text-foreground leading-snug">{task.title}</div>
      {task.description && <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{task.description}</div>}
      {task.dueDate && !isOverdue && (
        <div className="text-[10px] text-muted-foreground mt-1">{new Date(task.dueDate).toLocaleDateString('zh-CN')}</div>
      )}
    </div>
  );
}

function KanbanColumn({ id, label, color, tasks, clients, onDelete }: {
  id: string; label: string; color: string;
  tasks: any[]; clients: any[]; onDelete: (id: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={cn("flex-1 min-w-0 rounded-lg border p-2 transition-colors", isOver ? "border-primary/50 bg-primary/5" : "border-border bg-muted/10")}>
      <div className="flex items-center gap-1.5 mb-2">
        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", color)}>{label}</span>
        <span className="text-[10px] text-muted-foreground">{tasks.length}</span>
      </div>
      <div className="space-y-2 min-h-[60px]">
        {tasks.map(task => (
          <KanbanCard
            key={task.id}
            task={task}
            clientName={clients.find((c: any) => c.id === task.clientId)?.name}
            onDelete={() => onDelete(task.id)}
          />
        ))}
        {tasks.length === 0 && (
          <div className="text-center py-4 text-[10px] text-muted-foreground/40">拖拽到此</div>
        )}
      </div>
    </div>
  );
}

function RoleView({ viewRole, filterOppId }: { viewRole: PodRole; filterOppId?: number }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const { data: clients = [] } = trpc.clients.list.useQuery();
  const { data: tasks = [], refetch } = trpc.pod.listByRole.useQuery({ role: viewRole });
  const utils = trpc.useUtils();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const updateStatus = trpc.pod.updateTaskStatus.useMutation({
    onSuccess: () => { refetch(); utils.pod.listByRole.invalidate(); },
    onError: () => toast.error('状态更新失败'),
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const newStatus = over.id as 'pending' | 'in_progress' | 'done';
    const validStatuses = ['pending', 'in_progress', 'done'];
    if (!validStatuses.includes(newStatus)) return;
    updateStatus.mutate({ id: Number(active.id), taskStatus: newStatus });
  };

  const deleteOne = trpc.pod.deleteOne.useMutation({
    onSuccess: () => { refetch(); toast.success("任务已删除"); },
    onError: () => toast.error("删除失败，请重试"),
  });
  const clearCompleted = trpc.pod.clearCompleted.useMutation({
    onSuccess: () => { refetch(); toast.success("已清空所有已完成任务"); },
    onError: () => toast.error("清空失败，请重试"),
  });
  const clearByRole = trpc.pod.clearByRole.useMutation({
    onSuccess: () => { refetch(); toast.success(`已清空该角色所有任务`); },
    onError: () => toast.error("清空失败，请重试"),
  });
  const complete = trpc.pod.complete.useMutation({
    onSuccess: () => {
      refetch();
      utils.pod.listByRole.invalidate();
      utils.actions.listByClient.invalidate();
      utils.actions.listByRole.invalidate();
      toast.success("任务已完成！对应行动指令已移入历史记录");
    }
  });

  const pendingTasks = tasks.filter(t => !t.isCompleted && (!filterOppId || (t as any).opportunityId === filterOppId));
  const completedTasks = tasks.filter(t => t.isCompleted && (!filterOppId || (t as any).opportunityId === filterOppId));

  const info = roleDesc[viewRole];

  return (
    <div className="space-y-4">
      {/* Role Header */}
      <div className={cn("rounded-xl border p-4", roleColor[viewRole].replace("text-", "border-").replace("bg-", "border-"))}>
        <div className="flex items-center gap-2 mb-2">
          <TermTooltip term={viewRole as any} label={viewRole} showIcon={false}
            className={cn("text-sm font-bold px-2 py-1 rounded border", roleColor[viewRole])} />
          <span className="text-sm font-semibold text-foreground">{info.title}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {info.focus.map((f, i) => {
            // 检查是否包含可解释的术语
            const termKey = Object.keys(TERM_MAP).find(k => f.includes(k));
            return (
              <div key={i} className="text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1 text-center">
                {termKey ? (
                  <TermTooltip term={TERM_MAP[termKey] as any} label={f} showIcon={true} className="border-none text-muted-foreground" />
                ) : f}
              </div>
            );
          })}
        </div>
        <div className="space-y-1">
          {info.rules.map((r, i) => {
            // 将规则中的术语替换为 tooltip
            const termKey = Object.keys(TERM_MAP).find(k => r.includes(k));
            return (
              <div key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                <span className="text-primary mt-0.5">•</span>
                {termKey ? (
                  <span>
                    {r.split(termKey)[0]}
                    <TermTooltip term={TERM_MAP[termKey] as any} label={termKey} showIcon={true} className="border-dashed border-muted-foreground/40 text-muted-foreground" />
                    {r.split(termKey)[1]}
                  </span>
                ) : r}
              </div>
            );
          })}
        </div>
      </div>

      {/* Task Queue */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-foreground">
            任务队列
            <span className="ml-2 text-xs text-muted-foreground">({pendingTasks.length} 待完成)</span>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center border border-border rounded-md overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={cn("p-1 transition-colors", viewMode === 'list' ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground")}
                title="列表视图"
              ><List className="w-3 h-3" /></button>
              <button
                onClick={() => setViewMode('kanban')}
                className={cn("p-1 transition-colors", viewMode === 'kanban' ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground")}
                title="看板视图"
              ><LayoutGrid className="w-3 h-3" /></button>
            </div>
            {completedTasks.length > 0 && (
              <button
                onClick={() => clearCompleted.mutate()}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-400 transition-colors"
                title="清空已完成任务"
              >
                <Trash2 className="w-3 h-3" />清空已完成
              </button>
            )}
            {(pendingTasks.length > 0 || completedTasks.length > 0) && (
              <button
                onClick={() => {
                  if (confirm(`确定清空 ${viewRole} 角色的所有任务（含待完成）？`)) {
                    clearByRole.mutate({ role: viewRole as any });
                  }
                }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-400 transition-colors"
                title="清空此角色全部任务"
              >
                <Trash2 className="w-3 h-3" />清空全部
              </button>
            )}
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <Plus className="w-3 h-3" />
              添加任务
            </button>
          </div>
        </div>

        {showAddForm && (
          <div className="mb-3">
            <AddTaskForm clientId={clients[0]?.id || 1} role={viewRole} onSuccess={() => { refetch(); setShowAddForm(false); }} />
          </div>
        )}

        {viewMode === 'kanban' ? (
          /* ── Kanban Board View ── */
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="flex gap-2">
              <KanbanColumn
                id="pending"
                label="待处理"
                color="bg-yellow-500/10 text-yellow-400"
                tasks={tasks.filter((t: any) => !t.taskStatus || t.taskStatus === 'pending')}
                clients={clients}
                onDelete={(id) => deleteOne.mutate({ id })}
              />
              <KanbanColumn
                id="in_progress"
                label="进行中"
                color="bg-blue-500/10 text-blue-400"
                tasks={tasks.filter((t: any) => t.taskStatus === 'in_progress')}
                clients={clients}
                onDelete={(id) => deleteOne.mutate({ id })}
              />
              <KanbanColumn
                id="done"
                label="已完成"
                color="bg-green-500/10 text-green-400"
                tasks={tasks.filter((t: any) => t.taskStatus === 'done' || t.isCompleted)}
                clients={clients}
                onDelete={(id) => deleteOne.mutate({ id })}
              />
            </div>
          </DndContext>
        ) : (
          /* ── List View ── */
          <>
            {pendingTasks.length === 0 && !showAddForm ? (
              <div className="text-center py-6 text-muted-foreground">
                <CheckCircle2 className="w-6 h-6 mx-auto mb-1 opacity-30" />
                <div className="text-xs">暂无待完成任务</div>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingTasks.map((task: any) => {
                  const clientName = clients.find(c => c.id === task.clientId)?.name;
                  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
                  return (
                    <div key={task.id} className="flex items-start gap-2 p-2.5 rounded-lg border border-border hover:border-muted-foreground/50 transition-colors">
                      <button onClick={() => complete.mutate({ id: task.id })} className="mt-0.5 text-muted-foreground hover:text-green-400 transition-colors flex-shrink-0">
                        <Circle className="w-4 h-4" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium text-primary">{clientName}</span>
                          {/* Opportunity name */}
                          {(task as any).opportunityName && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                              <Target className="w-2.5 h-2.5" />{(task as any).opportunityName}
                            </span>
                          )}
                          {/* Source label */}
                          {task.sourceActionId != null ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              ⚡ 行动指令
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
                              ⚠️ 风险预警
                            </span>
                          )}
                          {(task as any).taskType === 'internal_resource' && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">
                              <Network className="w-2.5 h-2.5" />对内协调
                            </span>
                          )}
                          {isOverdue && <span className="text-xs text-red-400 flex items-center gap-0.5"><Clock className="w-3 h-3" />逾期</span>}
                          {task.dueDate && !isOverdue && (
                            <span className="text-xs text-muted-foreground">{new Date(task.dueDate).toLocaleDateString("zh-CN")}</span>
                          )}
                        </div>
                        <div className="text-sm text-foreground mt-0.5">{task.title}</div>
                        {task.notes && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.notes}</div>}
                      </div>
                      <button
                        onClick={() => deleteOne.mutate({ id: task.id })}
                        className="flex-shrink-0 mt-0.5 text-muted-foreground/30 hover:text-red-400 transition-colors"
                        title="删除此任务"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {completedTasks.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <div className="text-xs text-muted-foreground mb-2">已完成 ({completedTasks.length})</div>
                {completedTasks.slice(0, 3).map((task: any) => {
                  const clientName = clients.find(c => c.id === task.clientId)?.name;
                  return (
                    <div key={task.id} className="flex items-center gap-2 py-1.5 opacity-50">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      <span className="text-xs text-primary">{clientName}</span>
                      <span className="text-xs text-muted-foreground line-through">{task.title}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function DealReviewSection() {
  const [showForm, setShowForm] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [content, setContent] = useState("");
  const [nextSteps, setNextSteps] = useState("");

  const { data: clients = [] } = trpc.clients.list.useQuery();
  const { data: reviews = [], refetch } = trpc.pod.listDealReviews.useQuery();

  const create = trpc.pod.addDealReview.useMutation({
    onSuccess: () => {
      refetch();
      setContent("");
      setNextSteps("");
      setShowForm(false);
      toast.success("Deal Review已记录");
    }
  });

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <div className="text-sm font-semibold text-foreground">Deal Review 记录</div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          <Plus className="w-3 h-3" />
          新增记录
        </button>
      </div>

      {showForm && (
        <div className="mb-4 space-y-2 p-3 bg-muted/20 rounded-lg border border-border">
          <Select value={selectedClientId ? String(selectedClientId) : ""} onValueChange={(v) => setSelectedClientId(Number(v))}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="选择客户" />
            </SelectTrigger>
            <SelectContent>
              {clients.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Textarea className="h-20 text-xs resize-none" placeholder="Review内容：当前状态、风险点、讨论结论..." value={content} onChange={e => setContent(e.target.value)} />
          <Textarea className="h-16 text-xs resize-none" placeholder="Next Steps（每行一条）..." value={nextSteps} onChange={e => setNextSteps(e.target.value)} />
          <Button
            size="sm" className="w-full h-7 text-xs"
            disabled={!selectedClientId || !content.trim() || create.isPending}
            onClick={() => create.mutate({ clientId: selectedClientId!, content, nextSteps: nextSteps || undefined, reviewDate: new Date().toISOString() })}
          >
            保存记录
          </Button>
        </div>
      )}

      <div className="space-y-3 max-h-64 overflow-y-auto">
        {reviews.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <div className="text-xs">暂无Deal Review记录</div>
          </div>
        ) : reviews.map((review: any) => {
          const clientName = clients.find(c => c.id === review.clientId)?.name;
          return (
            <div key={review.id} className="border border-border rounded-lg p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-primary">{clientName}</span>
                <span className="text-xs text-muted-foreground">{new Date(review.reviewDate).toLocaleDateString("zh-CN")}</span>
              </div>
              <div className="text-xs text-foreground mb-2 line-clamp-3">{review.content}</div>
              {review.nextSteps && (
                <div className="text-xs text-primary/80 bg-primary/5 rounded p-2 border border-primary/15">
                  <span className="font-medium">Next Steps: </span>{review.nextSteps}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PodCenter() {
  const { role } = useRole();
  const [location] = useLocation();

  // 当前登录用户信息（用于查询自己的辅导建议）
  const { data: me } = trpc.auth.me.useQuery();

  // Parse oppId/oppName from URL query params for red-dot jump filter
  const urlParams = useMemo(() => {
    const search = window.location.search;
    const params = new URLSearchParams(search);
    const oppId = params.get('oppId') ? Number(params.get('oppId')) : null;
    const oppName = params.get('oppName') ? decodeURIComponent(params.get('oppName')!) : null;
    return { oppId, oppName };
  }, [location]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">POD协同中枢</h1>
        </div>
        <p className="text-sm text-muted-foreground">AD / SAM / SA / RSM 四角色独立视图 · 任务队列 · Deal Review 记录</p>
      </div>

      {/* Opportunity filter banner when jumped from MEDDPICC matrix red dot */}
      {urlParams.oppId && (
        <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-sm text-cyan-400">
          <Target className="w-4 h-4 flex-shrink-0" />
          <span>正在显示商机「<strong>{urlParams.oppName}</strong>」的相关任务</span>
          <button
            className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => window.history.replaceState(null, '', '/pod-center')}
          >清除筛选 ×</button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
        {/* AD View */}
        <div className={cn("transition-all", role === "AD" ? "ring-1 ring-amber-500/30 rounded-xl" : "")}>
          <RoleView viewRole="AD" filterOppId={urlParams.oppId ?? undefined} />
        </div>

        {/* SAM View */}
        <div className={cn("transition-all", role === "SAM" ? "ring-1 ring-cyan-500/30 rounded-xl" : "")}>
          <RoleView viewRole="SAM" filterOppId={urlParams.oppId ?? undefined} />
        </div>

        {/* SA View */}
        <div className={cn("transition-all", role === "SA" ? "ring-1 ring-violet-500/30 rounded-xl" : "")}>
          <RoleView viewRole="SA" filterOppId={urlParams.oppId ?? undefined} />
        </div>
        {/* RSM View */}
        <div className={cn("transition-all", role === "RSM" ? "ring-1 ring-emerald-500/30 rounded-xl" : "")}>
          <RoleView viewRole="RSM" filterOppId={urlParams.oppId ?? undefined} />
        </div>
      </div>

      {/* Deal Review */}
      <div className="mt-5">
        <DealReviewSection />
      </div>

      {/* Weekly Battle Report */}
      <div className="mt-5">
        <WeeklyReportSection />
      </div>

      {/* SAM 待办辅导建议 */}
      <div className="mt-5">
        <CoachingActionsSection currentUserId={me?.id} currentUserName={me?.name ?? undefined} />
      </div>
    </div>
  );
}

function CoachingActionsSection({ currentUserId, currentUserName }: { currentUserId?: number; currentUserName?: string }) {
  const utils = trpc.useUtils();
  const [detailItem, setDetailItem] = useState<any>(null);

  // 如果有当前用户 ID，查询该用户的辅导建议；否则查询全部（AD 视角）
  const { data: myActions = [], isLoading } = trpc.insights.listCoachingActions.useQuery(
    { samId: currentUserId ?? 0 },
    { enabled: !!currentUserId }
  );

  const completeMut = trpc.insights.completeCoachingAction.useMutation({
    onSuccess: () => {
      utils.insights.listCoachingActions.invalidate();
      toast.success("已标记完成 ✓");
    },
    onError: (e) => toast.error("操作失败：" + e.message),
  });

  const feedbackMut = trpc.insights.submitCoachingFeedback.useMutation({
    onSuccess: () => {
      utils.insights.listCoachingActions.invalidate();
      toast.success("反馈已提交 ✓");
    },
    onError: (e) => toast.error("提交失败：" + e.message),
  });

  const [feedbackInputs, setFeedbackInputs] = useState<Record<number, string>>({});
  const [expandedFeedback, setExpandedFeedback] = useState<Record<number, boolean>>({});

  const pending = myActions.filter((a: any) => !a.isCompleted);
  const completed = myActions.filter((a: any) => a.isCompleted);

  if (!currentUserId) return null;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <h3 className="font-semibold text-sm text-foreground">📋 待办辅导建议</h3>
            <span className="text-[10px] text-muted-foreground font-normal">来自 AD 的辅导 Action Items</span>
          </div>
          {pending.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 font-medium">
              {pending.length} 条待完成
            </span>
          )}
        </div>
      </div>
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            加载中...
          </div>
        ) : myActions.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">暂无辅导建议，AD 下发后将在此显示</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 待完成 */}
            {pending.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">待完成 ({pending.length})</div>
                {pending.map((action: any) => (
                  <div key={action.id} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-emerald-500/30 transition-colors group bg-muted/10">
                    <button
                      type="button"
                      onClick={() => completeMut.mutate({ id: action.id })}
                      disabled={completeMut.isPending}
                      className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 border-muted-foreground/40 hover:border-emerald-400 hover:bg-emerald-400/10 transition-colors"
                      title="标记为已完成"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-foreground leading-tight">{action.title}</p>
                        {action.dueDate && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 font-medium ${new Date(action.dueDate) < new Date() ? 'bg-red-500/20 text-red-400' : 'bg-muted/40 text-muted-foreground'}`}>
                            {new Date(action.dueDate) < new Date() ? '⚠ 已超期' : ''}
                            {new Date(action.dueDate).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}
                          </span>
                        )}
                      </div>
                      {action.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{action.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground/60">
                          {action.createdBy ? `由 ${action.createdBy} 下发` : ''}
                          · {new Date(action.createdAt).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}
                        </span>
                        {action.description && (
                          <button type="button" onClick={() => setDetailItem(action)}
                            className="text-[10px] text-primary/60 hover:text-primary transition-colors">
                            查看详情
                          </button>
                        )}
                        <button type="button"
                          onClick={() => setExpandedFeedback(prev => ({ ...prev, [action.id]: !prev[action.id] }))}
                          className="text-[10px] text-emerald-400/70 hover:text-emerald-400 transition-colors ml-auto">
                          {expandedFeedback[action.id] ? "收起反馈" : "✏️ 填写反馈"}
                        </button>
                      </div>
                      {expandedFeedback[action.id] && (
                        <div className="mt-2 space-y-1.5">
                          <textarea
                            className="w-full text-xs bg-muted/30 border border-border rounded p-2 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500/50 text-foreground placeholder:text-muted-foreground"
                            rows={3}
                            placeholder="简短描述执行情况（如：已与张总约好下周见面，确认了预算意向...）"
                            value={feedbackInputs[action.id] || ""}
                            onChange={e => setFeedbackInputs(prev => ({ ...prev, [action.id]: e.target.value }))}
                          />
                          <div className="flex gap-2">
                            <button type="button"
                              onClick={() => { if (feedbackInputs[action.id]?.trim()) feedbackMut.mutate({ id: action.id, feedback: feedbackInputs[action.id], markCompleted: false }); }}
                              disabled={feedbackMut.isPending || !feedbackInputs[action.id]?.trim()}
                              className="text-[10px] px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 disabled:opacity-50">
                              保存反馈
                            </button>
                            <button type="button"
                              onClick={() => { feedbackMut.mutate({ id: action.id, feedback: feedbackInputs[action.id] || "", markCompleted: true }); }}
                              disabled={feedbackMut.isPending}
                              className="text-[10px] px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50">
                              ✓ 标记完成
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* 已完成 */}
            {completed.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">已完成 ({completed.length})</div>
                {completed.map((action: any) => (
                  <div key={action.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-muted/5 opacity-60">
                    <CheckCircle2 className="mt-0.5 flex-shrink-0 w-4 h-4 text-green-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground/70 line-through leading-tight">{action.title}</p>
                      <span className="text-[10px] text-muted-foreground/50">
                        完成于 {action.completedAt ? new Date(action.completedAt).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }) : '—'}
                      </span>
                      {action.executionFeedback && (
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5 italic">反馈：{action.executionFeedback}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 详情 Dialog */}
      <Dialog open={!!detailItem} onOpenChange={(o) => { if (!o) setDetailItem(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-emerald-400 flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              辅导建议详情
            </DialogTitle>
          </DialogHeader>
          {detailItem && (
            <div className="space-y-3">
              <div>
                <div className="text-xs text-muted-foreground mb-1">建议标题</div>
                <p className="text-sm font-medium text-foreground">{detailItem.title}</p>
              </div>
              {detailItem.description && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">具体内容</div>
                  <p className="text-sm text-foreground/80 leading-relaxed">{detailItem.description}</p>
                </div>
              )}
              <div className="flex items-center gap-4 pt-2 border-t border-border/50 text-xs text-muted-foreground">
                {detailItem.dueDate && <span>截止：{new Date(detailItem.dueDate).toLocaleDateString("zh-CN")}</span>}
                {detailItem.createdBy && <span>下发人：{detailItem.createdBy}</span>}
                <span>下发时间：{new Date(detailItem.createdAt).toLocaleDateString("zh-CN")}</span>
              </div>
              {!detailItem.isCompleted && (
                <button type="button"
                  onClick={() => { completeMut.mutate({ id: detailItem.id }); setDetailItem(null); }}
                  className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors">
                  ✓ 标记为已完成
                </button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WeeklyReportSection() {
  const [summary, setSummary] = useState<string | null>(null);
  const [stats, setStats] = useState<{ signals: number; completed: number; pending: number } | null>(null);

  const generate = trpc.pod.weeklyReport.useMutation({
    onSuccess: (data) => {
      setSummary(data.summary);
      if ('stats' in data) setStats(data.stats as any);
      toast.success("本周战报已生成");
    },
    onError: () => toast.error("战报生成失败，请重试"),
  });

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">本周战报</h2>
            <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">总经理视角 · AI生成</span>
          </div>
          <Button
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
          >
            <Zap className="w-3 h-3" />
            {generate.isPending ? "生成中...稍等" : "生成本周战报"}
          </Button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
          <div className="p-3 text-center">
            <div className="text-lg font-bold text-primary font-mono">{stats.signals}</div>
            <div className="text-[10px] text-muted-foreground">情报信号</div>
          </div>
          <div className="p-3 text-center">
            <div className="text-lg font-bold text-green-400 font-mono">{stats.completed}</div>
            <div className="text-[10px] text-muted-foreground">完成行动</div>
          </div>
          <div className="p-3 text-center">
            <div className="text-lg font-bold text-yellow-400 font-mono">{stats.pending}</div>
            <div className="text-[10px] text-muted-foreground">待处理任务</div>
          </div>
        </div>
      )}

      <div className="p-4">
        {generate.isPending ? (
          <div className="flex items-center gap-3 py-4">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <span className="text-sm text-muted-foreground">AI 正在分析战场数据，生成本周战报...</span>
          </div>
        ) : summary ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-sm text-foreground leading-relaxed">{summary}</p>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground pt-1 border-t border-border/50">
              <AlertTriangle className="w-3 h-3" />
              <span>AI生成内容仅供参考，请总经理审核后使用</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <TrendingUp className="w-8 h-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">点击“生成本周战报”，AI 将自动分析 5 户客户数据</p>
            <p className="text-xs text-muted-foreground/70 mt-1">包含情报信号、完成行动、MEDDPICC 变化和风险提示</p>
          </div>
        )}
      </div>
    </div>
  );
}
