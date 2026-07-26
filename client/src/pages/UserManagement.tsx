import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Users, ShieldCheck, UserX, UserCheck, RefreshCw } from "lucide-react";

const POD_ROLES = ["AD", "SAM", "SA", "RSM"] as const;
const SYSTEM_ROLES = ["admin", "user"] as const;

export default function UserManagement() {
  const { data: users, isLoading, refetch } = trpc.admin.listUsers.useQuery();
  const toggleMutation = trpc.admin.toggleUser.useMutation({
    onSuccess: () => { refetch(); toast.success("用户状态已更新"); },
    onError: (e) => toast.error(e.message),
  });
  const updateRoleMutation = trpc.admin.updateUserRole.useMutation({
    onSuccess: () => { refetch(); toast.success("角色已更新"); },
    onError: (e) => toast.error(e.message),
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPodRole, setEditPodRole] = useState("");
  const [editRole, setEditRole] = useState("");

  const startEdit = (user: { id: number; podRole: string | null; role: string }) => {
    setEditingId(user.id);
    setEditPodRole(user.podRole ?? "SAM");
    setEditRole(user.role);
  };

  const saveEdit = (userId: number) => {
    updateRoleMutation.mutate({ userId, podRole: editPodRole, role: editRole });
    setEditingId(null);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #0A2540, #1B6FBF)" }}>
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">用户管理</h1>
            <p className="text-sm text-muted-foreground">管理 AIStorm Command 的团队成员账号与角色</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          刷新
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "总用户数", value: users?.length ?? 0, color: "#1B6FBF" },
          { label: "活跃用户", value: users?.filter(u => u.isActive).length ?? 0, color: "#4DB87A" },
          { label: "管理员", value: users?.filter(u => u.role === "admin").length ?? 0, color: "#00A8D6" },
        ].map(stat => (
          <div key={stat.label} className="rounded-lg border border-border p-4 bg-card">
            <div className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
            <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* User table */}
      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">姓名 / 邮箱</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">POD 角色</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">系统权限</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">状态</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">注册时间</th>
              <th className="text-right px-4 py-3 text-muted-foreground font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">加载中...</td></tr>
            ) : users?.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">暂无用户</td></tr>
            ) : users?.map((user, idx) => (
              <tr key={user.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${idx % 2 === 0 ? "" : "bg-muted/5"}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ background: "linear-gradient(135deg, #1B6FBF, #00A8D6)" }}>
                      {user.name?.charAt(0)?.toUpperCase() ?? "?"}
                    </div>
                    <div>
                      <div className="font-medium text-foreground">{user.name}</div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {editingId === user.id ? (
                    <Select value={editPodRole} onValueChange={setEditPodRole}>
                      <SelectTrigger className="h-7 w-24 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {POD_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className="text-xs font-mono">
                      {user.podRole ?? "未设置"}
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingId === user.id ? (
                    <Select value={editRole} onValueChange={setEditRole}>
                      <SelectTrigger className="h-7 w-24 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SYSTEM_ROLES.map(r => <SelectItem key={r} value={r}>{r === "admin" ? "管理员" : "普通用户"}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge className="text-xs" style={user.role === "admin"
                      ? { background: "rgba(0,168,214,0.15)", color: "#00A8D6", border: "1px solid rgba(0,168,214,0.3)" }
                      : { background: "rgba(255,255,255,0.05)", color: "#888", border: "1px solid rgba(255,255,255,0.1)" }}>
                      {user.role === "admin" ? <><ShieldCheck className="w-3 h-3 mr-1 inline" />管理员</> : "普通用户"}
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge className="text-xs" style={user.isActive
                    ? { background: "rgba(77,184,122,0.15)", color: "#4DB87A", border: "1px solid rgba(77,184,122,0.3)" }
                    : { background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                    {user.isActive ? "活跃" : "已禁用"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {user.createdAt ? new Date(user.createdAt).toLocaleDateString("zh-CN") : "-"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {editingId === user.id ? (
                      <>
                        <Button size="sm" variant="default" className="h-7 text-xs px-3"
                          onClick={() => saveEdit(user.id)}
                          disabled={updateRoleMutation.isPending}>
                          保存
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs px-3"
                          onClick={() => setEditingId(null)}>
                          取消
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" className="h-7 text-xs px-3"
                          onClick={() => startEdit(user)}>
                          编辑角色
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs px-3"
                          style={user.isActive
                            ? { color: "#ef4444", borderColor: "rgba(239,68,68,0.3)" }
                            : { color: "#4DB87A", borderColor: "rgba(77,184,122,0.3)" }}
                          onClick={() => toggleMutation.mutate({ userId: user.id, isActive: !user.isActive })}
                          disabled={toggleMutation.isPending}>
                          {user.isActive ? <><UserX className="w-3 h-3 mr-1" />禁用</> : <><UserCheck className="w-3 h-3 mr-1" />启用</>}
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

      <p className="text-xs text-muted-foreground mt-4 text-center">
        仅管理员可访问此页面 · 禁用的用户将无法登录系统
      </p>
    </div>
  );
}
