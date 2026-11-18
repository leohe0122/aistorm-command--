import { randomInt } from "node:crypto";

// 去掉易混淆字符（0/O、1/l/I）。16 位约 92 比特熵。
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/** 生成一次性初始密码 / 临时密码：用密码学安全随机数，按 4 位一组以短横线分隔，便于口头转达。 */
export function generateTempPassword(groups = 4): string {
  const parts: string[] = [];
  for (let g = 0; g < groups; g++) {
    let part = "";
    for (let i = 0; i < 4; i++) part += ALPHABET[randomInt(ALPHABET.length)];
    parts.push(part);
  }
  return parts.join("-");
}

/** 对外链接（飞书欢迎消息等）使用的站点地址：优先 PUBLIC_APP_URL，否则取请求的来源。 */
export function publicAppUrl(req?: { protocol?: string; headers?: Record<string, unknown> }): string {
  const configured = process.env.PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const forwardedProto = String(req?.headers?.["x-forwarded-proto"] ?? "").split(",")[0].trim();
  const proto = forwardedProto || req?.protocol || "https";
  const host = String(req?.headers?.["x-forwarded-host"] ?? req?.headers?.host ?? "").split(",")[0].trim();
  return host ? `${proto}://${host}` : "";
}
