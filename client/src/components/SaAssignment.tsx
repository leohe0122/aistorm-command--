import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useEmailAuth } from "@/App";

type Props = {
  opportunityId: number;
  clientId: number;
  assignedSaId: number | null | undefined;
  assignedSaName: string | null | undefined;
};

const UNASSIGNED = "";

// 商机负责 SA：AD/管理员可分配；其他角色只读。
// SA 只能看到被分配商机所属的客户，所以这里决定了 SA 的数据可见范围。
export function SaAssignment({ opportunityId, clientId, assignedSaId, assignedSaName }: Props) {
  const { emailUser } = useEmailAuth();
  const canAssign = emailUser?.role === "admin" || emailUser?.podRole === "AD";
  const utils = trpc.useUtils();
  const { data: users = [] } = trpc.clients.listSamUsers.useQuery(undefined, { enabled: canAssign });
  const assign = trpc.opportunities.assignSa.useMutation({
    onSuccess: () => {
      toast.success("负责 SA 已更新");
      utils.opportunities.listByClient.invalidate({ clientId });
    },
    onError: error => toast.error(error.message || "分配失败"),
  });

  if (!canAssign) {
    return <p className="mt-1 text-xs text-slate-500">负责 SA：{assignedSaName || "未分配"}</p>;
  }

  const saUsers = users.filter(user => user.podRole === "SA");
  return (
    <label className="mt-2 flex items-center gap-2 text-xs text-slate-400">
      负责 SA
      <select
        value={assignedSaId ?? UNASSIGNED}
        disabled={assign.isPending}
        onChange={event => {
          const value = event.target.value;
          const picked = saUsers.find(user => String(user.id) === value);
          assign.mutate({ opportunityId, saId: picked?.id ?? null, saName: picked?.name ?? null });
        }}
        className="h-7 rounded border border-slate-700 bg-slate-900/60 px-2 text-xs text-slate-200"
      >
        <option value={UNASSIGNED}>未分配</option>
        {saUsers.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
      </select>
    </label>
  );
}
