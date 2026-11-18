import { timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";

// 定时任务接口（/api/scheduled/*）的调用凭证。由服务器上的 crontab 或任意调度器携带：
//   Authorization: Bearer <CRON_SECRET>     或     X-Cron-Secret: <CRON_SECRET>
// 未配置 CRON_SECRET 时接口一律拒绝，避免被公开触发（会产生 AI 调用费用并向飞书群推送）。

function presentedSecret(req: Request): string {
  const header = req.headers.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) return header.slice(7).trim();
  const custom = req.headers["x-cron-secret"];
  return typeof custom === "string" ? custom.trim() : "";
}

export function isAuthorizedCronRequest(req: Request, secret = process.env.CRON_SECRET?.trim() ?? ""): boolean {
  if (!secret) return false;
  const given = Buffer.from(presentedSecret(req));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** 校验失败时直接写响应并返回 false。 */
export function requireCronSecret(req: Request, res: Response): boolean {
  if (!process.env.CRON_SECRET?.trim()) {
    res.status(503).json({ error: "CRON_SECRET 未配置，定时任务接口已停用" });
    return false;
  }
  if (!isAuthorizedCronRequest(req)) {
    res.status(401).json({ error: "unauthorized" });
    return false;
  }
  return true;
}
