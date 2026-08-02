import { Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { invokeLLM } from "../_core/llm";
import { notifyOwner } from "../_core/notification";
import {
  getWeeklyReportData,
  getSystemConfig,
} from "../db";

/**
 * 每日简报飞书推送 Handler
 * 路由：POST /api/scheduled/daily-briefing
 * 触发：每天 00:00 UTC (08:00 SGT/CST)
 * 认证：Heartbeat cron (user.isCron === true)
 */
export async function dailyBriefingHandler(req: Request, res: Response) {
  try {
    // Authenticate cron caller (throws ForbiddenError if not valid)
    let user;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      return res.status(403).json({ error: "unauthorized" });
    }
    if (!user.isCron) {
      return res.status(403).json({ error: "cron-only endpoint" });
    }

    // Get Feishu webhook config
    const feishuWebhook = await getSystemConfig("feishu_daily_briefing_webhook");
    const enabled = await getSystemConfig("feishu_daily_briefing_enabled");

    if (!feishuWebhook) {
      return res.json({ ok: true, skipped: "no webhook configured" });
    }
    if (enabled === "false") {
      return res.json({ ok: true, skipped: "daily briefing disabled" });
    }

    // Gather data
    const reportData = await getWeeklyReportData();

    if (!reportData) {
      return res.json({ ok: true, skipped: "no data available" });
    }

    const { allClients: clients, meddpiccData, latestScores, recentSignals, pendingTasks } = reportData;

    const today = new Date().toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });

    // Build context for AI
    const clientSummaries = clients.map((client) => {
      const meddpicc = meddpiccData.find((m) => m.clientId === client.id);
      const latestScore = latestScores.find((s) => s.clientId === client.id);
      const recentSignalsForClient = recentSignals.filter((s) => s.clientId === client.id);
      const pendingTasksForClient = pendingTasks.filter((t) => t.clientId === client.id);

      const avgScore = meddpicc
        ? Math.round(
            (meddpicc.metricsScore +
              meddpicc.economicBuyerScore +
              meddpicc.decisionCriteriaScore +
              meddpicc.decisionProcessScore +
              meddpicc.paperProcessScore +
              meddpicc.implicatePainScore +
              meddpicc.championScore +
              meddpicc.competitionScore) /
              8
          )
        : 0;

      return {
        name: client.name,
        stage: client.stage,
        priority: client.priority,
        meddpiccScore: avgScore,
        opportunityScore: latestScore?.overallScore ?? null,
      riskLevel: latestScore?.riskLevel ?? null,
      recentSignalsCount: recentSignalsForClient.length,
      pendingTasksCount: pendingTasksForClient.length,
      topSignal: recentSignalsForClient[0]?.rawSignal?.slice(0, 100) ?? null,
      };
    });

    const prompt = `你是T100专项AI作战指挥系统的每日简报生成器。今天是${today}。

以下是5户重点客户的当前状态数据：
${JSON.stringify(clientSummaries, null, 2)}

请生成一份简洁的每日战情简报，格式如下：
1. 今日重点关注（1-2句话，指出最需要关注的客户和事项）
2. 各客户状态速览（每户1行，包含：客户名 | 阶段 | MEDDPICC均分 | 待办任务数 | 关键提示）
3. 今日建议行动（3条具体行动建议，指明负责角色AD/SAM/SA）

要求：简洁专业，总字数不超过400字，使用中文。`;

    const llmResult = await invokeLLM({
      messages: [{ role: "user", content: prompt }],
    });
    const briefing = typeof llmResult.choices[0]?.message?.content === "string"
      ? llmResult.choices[0].message.content
      : JSON.stringify(llmResult.choices[0]?.message?.content ?? "");

    // Format Feishu message
    const feishuPayload = {
      msg_type: "text",
      content: {
        text: `📊 T100专项每日战情简报 · ${today}\n\n${briefing}\n\n---\n🤖 由T100 AI作战指挥系统自动生成`,
      },
    };

    // Send to Feishu
    const feishuRes = await fetch(feishuWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(feishuPayload),
    });

    if (!feishuRes.ok) {
      const errText = await feishuRes.text();
      console.error("[DailyBriefing] Feishu webhook failed:", feishuRes.status, errText);
      return res.status(500).json({
        error: "Feishu webhook failed",
        status: feishuRes.status,
        body: errText.slice(0, 200),
        timestamp: new Date().toISOString(),
      });
    }

    const feishuResult = await feishuRes.json();
    console.log("[DailyBriefing] Sent successfully:", feishuResult);

    // Also push personal notification to project owner
    try {
      await notifyOwner({
        title: `📊 每日战情简报 · ${today}`,
        content: briefing.slice(0, 2000),
      });
    } catch (notifyErr) {
      console.warn("[DailyBriefing] notifyOwner failed (non-critical):", notifyErr);
    }

    return res.json({
      ok: true,
      message: "Daily briefing sent to Feishu",
      timestamp: new Date().toISOString(),
      clientCount: clients.length,
    });
  } catch (error: any) {
    console.error("[DailyBriefing] Error:", error);
    return res.status(500).json({
      error: error.message || "Internal error",
      stack: error.stack,
      context: { url: req.url, taskUid: (req as any).user?.taskUid },
      timestamp: new Date().toISOString(),
    });
  }
}
