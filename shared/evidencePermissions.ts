// 证据确认权限（2026-10-11 确认的规则）：
//   AD 与管理员可确认任何证据；
//   录入人本人可确认自己投喂素材产生的证据；
//   SA 只能确认技术评估类证据（标签全部属于 D1、D2、technical）。
// 客户可见范围由服务端统一中间件另行校验，这里只判断“能否确认”。

export const TECHNICAL_TOPICS = new Set(["D1", "D2", "technical"]);

export type ConfirmSubject = { userId: number; role: "admin" | "user"; podRole: string | null };
export type ConfirmTarget = { topics: string[]; sourceType: string; ingestionCreatorId?: number | null };

export function canConfirmEvidence(subject: ConfirmSubject, target: ConfirmTarget): boolean {
  if (subject.role === "admin" || subject.podRole === "AD") return true;
  if (target.sourceType === "ingestion" && target.ingestionCreatorId === subject.userId) return true;
  if (subject.podRole === "SA") return target.topics.length > 0 && target.topics.every(topic => TECHNICAL_TOPICS.has(topic));
  return false;
}
