import { useEmailAuth } from "@/App";

/** 与服务端 AD_ONLY_PATHS 对应：AD 与管理员可执行跨客户、批量与分配类操作。 */
export function useCanManageAll(): boolean {
  const { emailUser } = useEmailAuth();
  return emailUser?.role === "admin" || emailUser?.podRole === "AD";
}
