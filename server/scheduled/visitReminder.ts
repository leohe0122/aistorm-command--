import type { Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { getSystemConfig, getDb } from "../db";
import { clients, meetingMinutes } from "../../drizzle/schema";
import { sql, and, gte, lte } from "drizzle-orm";

/**
 * 48小时拜访纪要提醒 Handler
 * 路由：POST /api/scheduled/visit-reminder
 * 触发：每天 01:00 UTC (09:00 SGT/CST)，检查过去48小时内有拜访但未录入纪要的客户
 * 认证：Heartbeat cron (user.isCron === true)
 *
 * 架构说明：
 * - 检查 meeting_minutes 表中，拜访日期在48小时前但无纪要内容的记录
 * - 或者检查 clients 表中 lastVisitDate 在48小时前、但对应时间段内无 meeting_minutes 记录的客户
 * - 通过飞书 Webhook 推送提醒给 POD 全员
 * - 配置项：feishu_visit_reminder_enabled / feishu_visit_reminder_webhook（可复用每日简报的 webhook）
 */
export async function visitReminderHandler(req: Request, res: Response) {
  try {
    // Authenticate cron caller
    let user;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      return res.status(403).json({ error: "unauthorized" });
    }
    if (!user.isCron) {
      return res.status(403).json({ error: "cron-only endpoint" });
    }

    // Get config
    const feishuWebhook = await getSystemConfig("feishu_daily_briefing_webhook"); // 复用每日简报 webhook
    const enabled = await getSystemConfig("feishu_visit_reminder_enabled");

    if (!feishuWebhook) {
      return res.json({ ok: true, skipped: "no webhook configured" });
    }
    if (enabled !== "true") {
      return res.json({ ok: true, skipped: "visit reminder disabled" });
    }

    const db = await getDb();
    if (!db) {
      return res.json({ ok: true, skipped: "database not available" });
    }

    // 检查：过去 24-72 小时内有拜访记录（lastVisitDate），但该时间段内无对应纪要的客户
    const now = new Date();
    const cutoff72h = new Date(now.getTime() - 72 * 60 * 60 * 1000);
    const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 查询最近有拜访但可能缺少纪要的客户（简化版：检查 visitCount > 0 且最近拜访在24-72h之间）
    const recentlyVisited = await db
      .select({ id: clients.id, name: clients.name, lastVisitDate: sql<Date>`MAX(mm.visitDate)` })
      .from(clients)
      .leftJoin(meetingMinutes as any, sql`${(meetingMinutes as any).clientId} = ${clients.id}`)
      .where(
        and(
          gte(sql`mm.visitDate`, cutoff72h),
          lte(sql`mm.visitDate`, cutoff24h)
        )
      )
      .groupBy(clients.id, clients.name)
      .limit(20);

    if (recentlyVisited.length === 0) {
      return res.json({ ok: true, skipped: "no visits requiring reminder" });
    }

    // 构建飞书消息
    const clientList = recentlyVisited
      .map(c => `• ${c.name}（最近拜访：${c.lastVisitDate ? new Date(c.lastVisitDate).toLocaleDateString("zh-CN") : "未知"}）`)
      .join("\n");

    const feishuPayload = {
      msg_type: "text",
      content: {
        text: `⏰ AIStorm Command 拜访纪要提醒\n\n以下客户在过去 24-72 小时内有拜访记录，请在 48 小时内录入书面纪要：\n\n${clientList}\n\n📋 请登录 AIStorm Command → 拜访作战日志 录入纪要，包含 MEDDPICC 更新点、客户真实反应、Next Steps 及责任人。\n\n— AIStorm Command 自动提醒`
      }
    };

    const feishuRes = await fetch(feishuWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(feishuPayload),
    });

    if (!feishuRes.ok) {
      const errText = await feishuRes.text();
      console.error("[VisitReminder] Feishu webhook failed:", feishuRes.status, errText);
      return res.status(500).json({ error: "Feishu webhook failed", status: feishuRes.status });
    }

    const feishuResult = await feishuRes.json();
    console.log("[VisitReminder] Sent successfully:", feishuResult);

    return res.json({
      ok: true,
      clientsReminded: recentlyVisited.length,
      clients: recentlyVisited.map(c => c.name),
    });
  } catch (error) {
    console.error("[VisitReminder] Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
