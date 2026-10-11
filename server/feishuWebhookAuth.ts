import { timingSafeEqual } from "crypto";

// 飞书在不同回调格式里放 Verification Token 的位置不同：
// v2 事件在 header.token，v1 事件、URL 校验与卡片回调在顶层 token。
export function extractFeishuToken(body: any): string | null {
  const token = body?.header?.token ?? body?.token;
  return typeof token === "string" && token.length > 0 ? token : null;
}

export type FeishuWebhookAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; reason: string };

/** 未配置 Token 时拒绝（fail-closed），避免任何人伪造卡片回调改写待确认拜访记录。 */
export function verifyFeishuWebhook(body: any, expectedToken: string): FeishuWebhookAuthResult {
  if (!expectedToken) {
    return { ok: false, status: 503, reason: "FEISHU_VERIFICATION_TOKEN 未配置，已拒绝飞书回调" };
  }
  const token = extractFeishuToken(body);
  if (!token) return { ok: false, status: 401, reason: "缺少 Verification Token" };
  const a = Buffer.from(token);
  const b = Buffer.from(expectedToken);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, status: 401, reason: "Verification Token 不匹配" };
  }
  return { ok: true };
}
