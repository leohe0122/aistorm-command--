import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Pencil, Trash2, Users, RefreshCw, AlertTriangle } from "lucide-react";

const POD_ROLE_COLORS: Record<string, string> = {
  AD: "bg-amber-500/20 text-amber-400 border-amber-500/40",
  SAM: "bg-cyan-500/20 text-cyan-400 border-cyan-500/40",
  SA: "bg-violet-500/20 text-violet-400 border-violet-500/40",
  RSM: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
};

const POD_ROLE_LABELS: Record<string, string> = {
  AD: "AD · 客户总监",
  SAM: "SAM · 战略客户经理",
  SA: "SA · 解决方案架构师",
  RSM: "RSM · 属地销售",
};

// ClientAssignRow: inline row for client assignment in team management
function ClientAssignRow({ client, members, onSuccess, showRsmMode }: {
  client: any;
  members: any[];
  onSuccess: () => void;
  showRsmMode?: boolean;
}) {
  const [editSam, setEditSam] = useState(false);
  const [editRsm, setEditRsm] = useState(false);
  const assignSamMut = trpc.clients.assignSam.useMutation({ onSuccess: () => { onSuccess(); setEditSam(false); } });
  const assignRsmMut = trpc.clients.assignRsm.useMutation({ onSuccess: () => { onSuccess(); setEditRsm(false); } });

  const priorityColors: Record<string, string> = {
    P0: "bg-red-500/20 text-red-400", P1: "bg-orange-500/20 text-orange-400", P2: "bg-blue-500/20 text-blue-400",
  };

  return (
    <tr className="border-b border-border/50 hover:bg-muted/10 transition-colors">
      <td className="px-4 py-2.5 font-medium text-foreground">{client.name}</td>
      <td className="px-4 py-2.5">
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${priorityColors[client.priority] || "bg-muted text-muted-foreground"}`}>{client.priority}</span>
      </td>
      <td className="px-4 py-2.5 text-xs text-muted-foreground">{client.stage}</td>
      <td className="px-4 py-2.5">
        {showRsmMode ? (
          // Show SAM info when in RSM mode
          <span className="text-xs text-muted-foreground">{client.assignedSamName || "—"}</span>
        ) : (
          // Show RSM info when in SAM mode
          editRsm ? (
            <select className="text-xs bg-card border border-border rounded px-2 py-1"
              defaultValue={client.assignedRsmId ?? ""}
              onChange={e => {
                const u = members.find((m: any) => m.id === parseInt(e.target.value));
                assignRsmMut.mutate({ clientId: client.id, rsmId: u?.id ?? null, rsmName: u?.name ?? null });
              }}>
              <option value="">— 取消分配</option>
              {members.filter((m: any) => m.isActive).map((m: any) => (
                <option key={m.id} value={m.id}>{m.name} ({m.podRole})</option>
              ))}
            </select>
          ) : (
            <button onClick={() => setEditRsm(true)} className="text-xs text-muted-foreground hover:text-[#00A8D6] transition-colors">
              {client.assignedRsmName || <span className="text-orange-400/70">未分配 RSM</span>}
            </button>
          )
        )}
      </td>
      <td className="px-4 py-2.5 text-right">
        {showRsmMode ? (
          // Change RSM
          editRsm ? (
            <select className="text-xs bg-card border border-border rounded px-2 py-1"
              defaultValue={client.assignedRsmId ?? ""}
              onChange={e => {
                const u = members.find((m: any) => m.id === parseInt(e.target.value));
                assignRsmMut.mutate({ clientId: client.id, rsmId: u?.id ?? null, rsmName: u?.name ?? null });
              }}>
              <option value="">— 取消分配</option>
              {members.filter((m: any) => m.isActive).map((m: any) => (
                <option key={m.id} value={m.id}>{m.name} ({m.podRole})</option>
              ))}
            </select>
          ) : (
            <button onClick={() => setEditRsm(true)} className="text-xs text-[#00A8D6] hover:underline">更换 RSM</button>
          )
        ) : (
          // Change SAM
          editSam ? (
            <select className="text-xs bg-card border border-border rounded px-2 py-1"
              defaultValue={client.assignedSamId ?? ""}
              onChange={e => {
                const u = members.find((m: any) => m.id === parseInt(e.target.value));
                assignSamMut.mutate({ clientId: client.id, samId: u?.id ?? null, samName: u?.name ?? null });
              }}>
              <option value="">— 取消分配</option>
              {members.filter((m: any) => m.isActive).map((m: any) => (
                <option key={m.id} value={m.id}>{m.name} ({m.podRole})</option>
              ))}
            </select>
          ) : (
            <button onClick={() => setEditSam(true)} className="text-xs text-[#00A8D6] hover:underline">更换 SAM</button>
          )
        )}
      </td>
    </tr>
  );
}

export default function TeamManagement() {
  const utils = trpc.useUtils();
  const { data: members = [], isLoading } = trpc.admin.listUsers.useQuery();
  const { data: allClients = [] } = trpc.clients.list.useQuery();
  const [activeTab, setActiveTab] = useState<"members" | "assignments">("members");
  const [assignmentMemberId, setAssignmentMemberId] = useState<number | null>(null);

  // ── Create ──────────────────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ email: "", name: "", podRole: "SAM" as "AD"|"SAM"|"SA"|"RSM", password: "" });
  const createMut = trpc.admin.createMember.useMutation({
    onSuccess: (data) => {
      toast.success(`成员 ${data.name} 已创建，初始密码：Aistorm2024!`);
      utils.admin.listUsers.invalidate();
      setShowCreate(false);
      setCreateForm({ email: "", name: "", podRole: "SAM", password: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  // ── Edit ─────────────────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editPodRole, setEditPodRole] = useState<"AD"|"SAM"|"SA"|"RSM">("SAM");
  const updateMut = trpc.admin.updateMember.useMutation({
    onSuccess: () => {
      toast.success("成员信息已更新");
      utils.admin.listUsers.invalidate();
      utils.clients.list.invalidate();
      setEditingId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  // ── Delete ───────────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [reassignToId, setReassignToId] = useState<string>("");
  const { data: targetClients = [] } = trpc.admin.getMemberClients.useQuery(
    { userId: deleteTarget?.id ?? 0 },
    { enabled: !!deleteTarget }
  );
  const deleteMut = trpc.admin.deleteMember.useMutation({
    onSuccess: () => {
      toast.success("成员已删除，客户归属已处理");
      utils.admin.listUsers.invalidate();
      utils.clients.list.invalidate();
      setDeleteTarget(null);
      setReassignToId("");
    },
    onError: (e) => toast.error(e.message),
  });

  // ── Toggle active ────────────────────────────────────────────────────────
  const toggleMut = trpc.admin.toggleUser.useMutation({
    onSuccess: () => { utils.admin.listUsers.invalidate(); toast.success("状态已更新"); },
    onError: (e) => toast.error(e.message),
  });

  const otherMembers = members.filter(m => m.id !== deleteTarget?.id);
  const reassignTarget = reassignToId ? members.find(m => m.id === parseInt(reassignToId)) : null;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-[#00A8D6]" />
            团队成员管理
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">管理 SAM / RSM / SA / AD 成员，支持增删改停用及客户归属重分配</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5 bg-[#00A8D6] hover:bg-[#0090b8] text-white">
          <UserPlus className="w-4 h-4" />
          新增成员
        </Button>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 p-1 rounded-lg bg-muted/30 border border-border w-fit">
        <button
          onClick={() => setActiveTab("members")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === "members" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          成员列表
        </button>
        <button
          onClick={() => setActiveTab("assignments")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === "assignments" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          客户分配
        </button>
      </div>

      {/* Member Table */}
      {activeTab === "members" && (
        isLoading ? (
        <div className="text-center py-12 text-muted-foreground">加载中...</div>
        ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">姓名</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">邮箱</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">角色</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">状态</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">加入时间</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">操作</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    {editingId === m.id ? (
                      <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-7 text-xs w-32" />
                    ) : (
                      <span className="font-medium text-foreground">{m.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{m.email}</td>
                  <td className="px-4 py-3">
                    {editingId === m.id ? (
                      <Select value={editPodRole} onValueChange={(v) => setEditPodRole(v as any)}>
                        <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["AD","SAM","SA","RSM"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${POD_ROLE_COLORS[m.podRole] || "bg-muted text-muted-foreground"}`}>
                        {m.podRole}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleMut.mutate({ userId: m.id, isActive: !m.isActive })}
                      className={`text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors ${m.isActive ? "bg-green-500/15 text-green-400 border-green-500/30 hover:bg-green-500/25" : "bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25"}`}
                    >
                      {m.isActive ? "活跃" : "已停用"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(m.createdAt).toLocaleDateString("zh-CN", { year: "numeric", month: "short", day: "numeric" })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {editingId === m.id ? (
                        <>
                          <Button size="sm" variant="default" className="h-7 text-xs px-2"
                            onClick={() => updateMut.mutate({ userId: m.id, name: editName, podRole: editPodRole })}
                            disabled={updateMut.isPending}>
                            {updateMut.isPending ? <RefreshCw className="w-3 h-3 animate-spin" /> : "保存"}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setEditingId(null)}>取消</Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:text-[#00A8D6]"
                            onClick={() => { setEditingId(m.id); setEditName(m.name); setEditPodRole(m.podRole as any); }}
                            title="编辑">
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:text-red-400"
                            onClick={() => setDeleteTarget({ id: m.id, name: m.name })}
                            title="删除">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )
      )}

      {/* Client Assignment View */}
      {activeTab === "assignments" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">选择成员查看其负责的客户，并在此调整 SAM / RSM 归属。</p>
          <div className="flex flex-wrap gap-2">
            {members.filter((m: any) => m.isActive).map((m: any) => (
              <button key={m.id}
                onClick={() => setAssignmentMemberId(assignmentMemberId === m.id ? null : m.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${assignmentMemberId === m.id ? "bg-[#00A8D6]/20 text-[#00A8D6] border-[#00A8D6]/40" : "bg-muted/20 text-muted-foreground border-border hover:border-[#00A8D6]/30 hover:text-foreground"}`}>
                <span className={`text-[10px] px-1 py-0.5 rounded font-bold ${POD_ROLE_COLORS[m.podRole] || "bg-muted text-muted-foreground"}`}>{m.podRole}</span>
                {m.name}
              </button>
            ))}
          </div>
          {assignmentMemberId && (() => {
            const asSam = allClients.filter((c: any) => (c as any).assignedSamId === assignmentMemberId);
            const asRsm = allClients.filter((c: any) => (c as any).assignedRsmId === assignmentMemberId);
            const unassigned = allClients.filter((c: any) => !(c as any).assignedSamId && !(c as any).assignedRsmId);
            return (
              <div className="space-y-4">
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="px-4 py-2.5 bg-cyan-500/10 border-b border-border">
                    <span className="text-xs font-semibold text-cyan-400">以 SAM 身份负责的客户 ({asSam.length})</span>
                  </div>
                  {asSam.length === 0 ? <div className="px-4 py-3 text-xs text-muted-foreground">暂无</div> : (
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-border bg-muted/20">
                        <th className="text-left px-4 py-2 text-xs text-muted-foreground">客户名称</th>
                        <th className="text-left px-4 py-2 text-xs text-muted-foreground">优先级</th>
                        <th className="text-left px-4 py-2 text-xs text-muted-foreground">阶段</th>
                        <th className="text-left px-4 py-2 text-xs text-muted-foreground">属地 RSM</th>
                        <th className="text-right px-4 py-2 text-xs text-muted-foreground">操作</th>
                      </tr></thead>
                      <tbody>{asSam.map((c: any) => <ClientAssignRow key={c.id} client={c} members={members} onSuccess={() => utils.clients.list.invalidate()} />)}</tbody>
                    </table>
                  )}
                </div>
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="px-4 py-2.5 bg-emerald-500/10 border-b border-border">
                    <span className="text-xs font-semibold text-emerald-400">以 RSM 身份协作的客户 ({asRsm.length})</span>
                  </div>
                  {asRsm.length === 0 ? <div className="px-4 py-3 text-xs text-muted-foreground">暂无</div> : (
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-border bg-muted/20">
                        <th className="text-left px-4 py-2 text-xs text-muted-foreground">客户名称</th>
                        <th className="text-left px-4 py-2 text-xs text-muted-foreground">优先级</th>
                        <th className="text-left px-4 py-2 text-xs text-muted-foreground">阶段</th>
                        <th className="text-left px-4 py-2 text-xs text-muted-foreground">主责 SAM</th>
                        <th className="text-right px-4 py-2 text-xs text-muted-foreground">操作</th>
                      </tr></thead>
                      <tbody>{asRsm.map((c: any) => <ClientAssignRow key={c.id} client={c} members={members} onSuccess={() => utils.clients.list.invalidate()} showRsmMode />)}</tbody>
                    </table>
                  )}
                </div>
                {unassigned.length > 0 && (
                  <div className="rounded-xl border border-orange-500/30 overflow-hidden">
                    <div className="px-4 py-2.5 bg-orange-500/10 border-b border-orange-500/20">
                      <span className="text-xs font-semibold text-orange-400">未分配任何成员的客户 ({unassigned.length})</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-border bg-muted/20">
                        <th className="text-left px-4 py-2 text-xs text-muted-foreground">客户名称</th>
                        <th className="text-left px-4 py-2 text-xs text-muted-foreground">优先级</th>
                        <th className="text-left px-4 py-2 text-xs text-muted-foreground">阶段</th>
                        <th className="text-right px-4 py-2 text-xs text-muted-foreground">分配</th>
                      </tr></thead>
                      <tbody>{unassigned.map((c: any) => <ClientAssignRow key={c.id} client={c} members={members} onSuccess={() => utils.clients.list.invalidate()} />)}</tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#00A8D6]">
              <UserPlus className="w-4 h-4" />
              新增团队成员
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">姓名 *</label>
              <Input placeholder="如：TDH / Vivian Lu / Henry" value={createForm.name}
                onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">公司邮箱 *</label>
              <Input placeholder="name@aistorm.com" value={createForm.email}
                onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">POD 角色 *</label>
              <Select value={createForm.podRole} onValueChange={(v) => setCreateForm(f => ({ ...f, podRole: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(POD_ROLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg">
              初始密码：<strong className="text-foreground">Aistorm2024!</strong>，成员首次登录后可自行修改
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>取消</Button>
            <Button size="sm" onClick={() => createMut.mutate(createForm)} disabled={!createForm.name || !createForm.email || createMut.isPending}
              className="bg-[#00A8D6] hover:bg-[#0090b8] text-white">
              {createMut.isPending ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : null}
              创建成员
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete / Reassign Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) { setDeleteTarget(null); setReassignToId(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-4 h-4" />
              删除成员：{deleteTarget?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {targetClients.length > 0 ? (
              <>
                <p className="text-sm text-foreground/80">
                  该成员名下有 <strong className="text-red-400">{targetClients.length} 个客户</strong>，删除前请选择客户归属处理方式：
                </p>
                <div className="bg-muted/30 rounded-lg p-3 space-y-1 max-h-32 overflow-y-auto">
                  {targetClients.map(c => (
                    <div key={c.id} className="flex items-center gap-2 text-xs">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${c.priority === 'P0' ? 'bg-red-500/20 text-red-400' : c.priority === 'P1' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-muted text-muted-foreground'}`}>{c.priority}</span>
                      <span className="text-foreground">{c.name}</span>
                      <span className="text-muted-foreground">· {c.stage}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">转移给（留空则清空归属）</label>
                  <Select value={reassignToId} onValueChange={setReassignToId}>
                    <SelectTrigger><SelectValue placeholder="— 清空归属（不转移）" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">— 清空归属（不转移）</SelectItem>
                      {otherMembers.filter(m => m.isActive).map(m => (
                        <SelectItem key={m.id} value={String(m.id)}>{m.name} ({m.podRole})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">该成员名下没有客户，可以直接删除。</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => { setDeleteTarget(null); setReassignToId(""); }}>取消</Button>
            <Button variant="destructive" size="sm"
              onClick={() => deleteMut.mutate({
                userId: deleteTarget!.id,
                reassignToUserId: reassignToId ? parseInt(reassignToId) : null,
                reassignToUserName: reassignTarget?.name ?? null,
              })}
              disabled={deleteMut.isPending}>
              {deleteMut.isPending ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : null}
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
