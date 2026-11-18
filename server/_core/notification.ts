import { TRPCError } from "@trpc/server";
import { getSystemConfig } from "../db";

// 管理员通知（可选能力）。原先走托管平台的“通知项目所有者”服务，现改为可配置的 Webhook：
//   系统设置 owner_notify_webhook，或环境变量 NOTIFY_WEBHOOK_URL
// 飞书 / Lark 机器人地址按其消息格式发送；其他地址收到 JSON { title, content }。
// 未配置时只记录日志并返回 false，调用方不受影响（优雅降级）。

export type NotificationPayload = {
  title: string;
  content: string;
};

const TITLE_MAX_LENGTH = 1200;
const CONTENT_MAX_LENGTH = 20000;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

function validatePayload(input: NotificationPayload): NotificationPayload {
  if (!isNonEmptyString(input.title)) throw new TRPCError({ code: "BAD_REQUEST", message: "Notification title is required." });
  if (!isNonEmptyString(input.content)) throw new TRPCError({ code: "BAD_REQUEST", message: "Notification content is required." });
  const title = input.title.trim();
  const content = input.content.trim();
  if (title.length > TITLE_MAX_LENGTH) throw new TRPCError({ code: "BAD_REQUEST", message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.` });
  if (content.length > CONTENT_MAX_LENGTH) throw new TRPCError({ code: "BAD_REQUEST", message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.` });
  return { title, content };
}

export function isFeishuWebhook(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host.endsWith("feishu.cn") || host.endsWith("larksuite.com");
  } catch {
    return false;
  }
}

export function buildNotificationBody(url: string, payload: NotificationPayload): unknown {
  return isFeishuWebhook(url)
    ? { msg_type: "text", content: { text: `${payload.title}\n\n${payload.content}` } }
    : { title: payload.title, content: payload.content };
}

async function notificationWebhook(): Promise<string | null> {
  const configured = (await getSystemConfig("owner_notify_webhook").catch(() => null))?.trim();
  return configured || process.env.NOTIFY_WEBHOOK_URL?.trim() || null;
}

/**
 * 向管理员发送通知。已送达返回 true；未配置或发送失败返回 false（不抛错）。
 * 只有标题或内容不合法时抛出 TRPC 错误。
 */
export async function notifyOwner(payload: NotificationPayload): Promise<boolean> {
  const message = validatePayload(payload);
  const url = await notificationWebhook();
  if (!url) {
    console.info("[Notification] skipped: owner_notify_webhook / NOTIFY_WEBHOOK_URL not configured");
    return false;
  }
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildNotificationBody(url, message)),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      console.warn(`[Notification] webhook responded ${response.status}`);
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] webhook error:", error);
    return false;
  }
}
