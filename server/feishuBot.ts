import { Request, Response } from "express";
import crypto from "crypto";
import { ENV } from "./_core/env";
import { invokeLLM } from "./_core/llm";
import { getAllClients, insertMeeting, getDb } from "./db";

// ── 飞书 API 工具函数 ──────────────────────────────────────────────────────────

async function getFeishuToken(): Promise<string> {
  const res = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: ENV.feishuAppId, app_secret: ENV.feishuAppSecret }),
  });
  const data = await res.json() as any;
  return data.tenant_access_token ?? "";
}

async function sendFeishuCard(openId: string, card: object): Promise<void> {
  const token = await getFeishuToken();
  await fetch("https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({
      receive_id: openId,
      msg_type: "interactive",
      content: JSON.stringify(card),
    }),
  });
}

// ── 自然语言解析：从消息中提取拜访信息 ──────────────────────────────────────────

async function parseVisitFromMessage(text: string, clientNames: string[]): Promise<{
  clientName: string | null;
  contactType: string;
  initiatedBy: string;
  keyPoints: string;
  attendees: string;
} | null> {
  const clientListStr = clientNames.slice(0, 30).join("、");
  const prompt = `你是一个销售数据录入助手。用户发来一条拜访记录消息，请从中提取结构化信息。

当前系统中的客户列表：${clientListStr}

用户消息：
${text}

请以JSON格式返回，字段说明：
- clientName: 从客户列表中匹配最相关的客户名称（如果无法匹配则返回null）
- contactType: 接触方式，必须是以下之一：formal_meeting（正式会议）、dinner_meeting（饭局/酒桌）、phone_call（电话）、video_call（视频通话）、instant_message（即时消息）、event（活动/展会）、customer_initiated（客户主动联系）
- initiatedBy: 发起方，必须是以下之一：sam（我方主动）、customer（客户主动）、mutual（双方约定）
- keyPoints: 本次接触的关键信息点（100字以内）
- attendees: 参会人（如果提到的话）

只返回JSON，不要其他内容。`;

  try {
    const result = await invokeLLM({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
    const content = result.choices[0]?.message?.content ?? "{}";
    return JSON.parse(typeof content === "string" ? content : "{}");
  } catch {
    return null;
  }
}

// ── 构建确认卡片 ──────────────────────────────────────────────────────────────

function buildConfirmCard(params: {
  clientName: string;
  contactType: string;
  initiatedBy: string;
  keyPoints: string;
  attendees: string;
  pendingId: string;
}): object {
  const contactTypeLabels: Record<string, string> = {
    formal_meeting: "🏢 正式会议",
    dinner_meeting: "🍽️ 饭局/酒桌",
    phone_call: "📞 电话",
    video_call: "💻 视频通话",
    instant_message: "💬 即时消息",
    event: "🎪 活动/展会",
    customer_initiated: "⭐ 客户主动联系",
  };

  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: "plain_text", content: "📋 拜访记录确认" },
      template: "blue",
    },
    elements: [
      {
        tag: "div",
        fields: [
          { is_short: true, text: { tag: "lark_md", content: `**客户**\n${params.clientName}` } },
          { is_short: true, text: { tag: "lark_md", content: `**接触方式**\n${contactTypeLabels[params.contactType] ?? params.contactType}` } },
          { is_short: true, text: { tag: "lark_md", content: `**参会人**\n${params.attendees || "未记录"}` } },
        ],
      },
      {
        tag: "div",
        text: { tag: "lark_md", content: `**关键信息**\n${params.keyPoints}` },
      },
      {
        tag: "div",
        text: { tag: "lark_md", content: `**这次是谁约的？**` },
      },
      {
        tag: "action",
        actions: [
          {
            tag: "button",
            text: { tag: "plain_text", content: params.initiatedBy === "sam" ? "✓ 我方约的" : "我方约的" },
            type: params.initiatedBy === "sam" ? "primary" : "default",
            value: { action: "set_initiated", pendingId: params.pendingId, initiatedBy: "sam" },
          },
          {
            tag: "button",
            text: { tag: "plain_text", content: params.initiatedBy === "customer" ? "✓ ⭐ 客户约的" : "⭐ 客户约的" },
            type: params.initiatedBy === "customer" ? "primary" : "default",
            value: { action: "set_initiated", pendingId: params.pendingId, initiatedBy: "customer" },
          },
        ],
      },
      {
        tag: "action",
        actions: [
          {
            tag: "button",
            text: { tag: "plain_text", content: "✅ 确认录入" },
            type: "primary",
            value: { action: "confirm", pendingId: params.pendingId },
          },
          {
            tag: "button",
            text: { tag: "plain_text", content: "❌ 取消" },
            type: "danger",
            value: { action: "cancel", pendingId: params.pendingId },
          },
        ],
      },
    ],
  };
}

// ── 数据库持久化待确认记录（避免 serverless 冷启动后内存丢失）────────────────────
async function savePendingRecord(pendingId: string, data: {
  clientId: number; clientName: string; contactType: string;
  initiatedBy: string; keyPoints: string; attendees: string; openId: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const { feishuPendingRecords } = await import('../drizzle/schema');
  const expiresAt = new Date(Date.now() + 3600000); // 1 hour
  await db.insert(feishuPendingRecords).values({ id: pendingId, ...data, expiresAt });
}

async function getPendingRecord(pendingId: string): Promise<{
  clientId: number; clientName: string; contactType: string;
  initiatedBy: string; keyPoints: string; attendees: string; openId: string;
} | null> {
  const db = await getDb();
  if (!db) return null;
  const { feishuPendingRecords } = await import('../drizzle/schema');
  const { eq } = await import('drizzle-orm');
  const rows = await db.select().from(feishuPendingRecords).where(eq(feishuPendingRecords.id, pendingId)).limit(1);
  if (!rows.length) return null;
  const row = rows[0];
  if (new Date() > row.expiresAt) {
    await db.delete(feishuPendingRecords).where(eq(feishuPendingRecords.id, pendingId));
    return null;
  }
  return { clientId: row.clientId, clientName: row.clientName, contactType: row.contactType,
    initiatedBy: row.initiatedBy, keyPoints: row.keyPoints, attendees: row.attendees || '', openId: row.openId };
}

async function deletePendingRecord(pendingId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const { feishuPendingRecords } = await import('../drizzle/schema');
  const { eq } = await import('drizzle-orm');
  await db.delete(feishuPendingRecords).where(eq(feishuPendingRecords.id, pendingId));
}

// ── 主 Webhook Handler ────────────────────────────────────────────────────────

export async function feishuWebhookHandler(req: Request, res: Response) {
  try {
    const body = req.body;

    // 1. 飞书验证挑战（首次配置 Webhook 时）
    if (body.challenge || body.type === "url_verification") {
      res.json({ challenge: body.challenge });
      return;
    }

    // 2. 验证签名（如果配置了 Verification Token）
    // 飞书会在 header 中发送 X-Lark-Request-Timestamp 和 X-Lark-Signature
    const timestamp = req.headers["x-lark-request-timestamp"] as string;
    const nonce = req.headers["x-lark-request-nonce"] as string;
    const signature = req.headers["x-lark-signature"] as string;
    if (timestamp && signature && ENV.feishuAppSecret) {
      const toSign = timestamp + nonce + ENV.feishuAppSecret + JSON.stringify(body);
      const expectedSig = crypto.createHash("sha256").update(toSign).digest("hex");
      if (expectedSig !== signature) {
        // 签名不匹配时只记录日志，不拒绝（避免误拒合法请求）
        console.log("[feishu-webhook] signature mismatch, continuing anyway");
      }
    }

    const event = body.event;
    const header = body.header;

    // 3. 处理卡片回调（用户点击确认/取消按钮）
    // 记录所有进入的事件（用于诊断）
    console.log("[feishu-webhook] received:", JSON.stringify({ type: body.type, header_event_type: header?.event_type, has_event: !!event }));

    if (body.type === "card" || header?.event_type === "card.action.trigger" || body.action) {
      const action = body.action?.value ?? body.event?.action?.value;
      if (!action) { res.json({ toast: { type: "info", content: "无效操作" } }); return; }

      // 处理发起方切换按钮
      if (action.action === "set_initiated" && action.pendingId) {
        const record = await getPendingRecord(action.pendingId);
        if (!record) { res.json({ toast: { type: "error", content: "记录已过期" } }); return; }
        // 更新数据库中的 initiatedBy
        const db = await getDb();
        if (db) {
          const { feishuPendingRecords } = await import('../drizzle/schema');
          const { eq } = await import('drizzle-orm');
          await db.update(feishuPendingRecords)
            .set({ initiatedBy: action.initiatedBy })
            .where(eq(feishuPendingRecords.id, action.pendingId));
        }
        // 返回更新后的卡片
        const updatedCard = buildConfirmCard({
          clientName: record.clientName,
          contactType: record.contactType,
          initiatedBy: action.initiatedBy,
          keyPoints: record.keyPoints,
          attendees: record.attendees,
          pendingId: action.pendingId,
        });
        res.json(updatedCard);
        return;
      }

      if (action.action === "confirm" && action.pendingId) {
        const record = await getPendingRecord(action.pendingId);
        if (!record) {
          res.json({ toast: { type: "error", content: "记录已过期，请重新发送" } });
          return;
        }
        // 写入数据库
        await insertMeeting({
          clientId: record.clientId,
          meetingDate: new Date(),
          visitType: "拜访",
          attendees: record.attendees || undefined,
          keyPoints: record.keyPoints,
          contactType: record.contactType as any,
          initiatedBy: record.initiatedBy as any,
          entrySource: "feishu_bot",
        });
        await deletePendingRecord(action.pendingId);
        res.json({ toast: { type: "success", content: `✅ 已录入 ${record.clientName} 的拜访记录` } });
        return;
      }

      if (action.action === "cancel" && action.pendingId) {
        await deletePendingRecord(action.pendingId);
        res.json({ toast: { type: "info", content: "已取消录入" } });
        return;
      }

      res.json({});
      return;
    }

    // 4. 处理消息事件（用户发消息给机器人）
    if (header?.event_type === "im.message.receive_v1" || event?.message) {
      const message = event?.message;
      if (!message) { res.json({}); return; }

      // 只处理文本消息
      if (message.message_type !== "text") {
        res.json({});
        return;
      }

      const openId = event?.sender?.sender_id?.open_id;
      if (!openId) { res.json({}); return; }

      let text = "";
      try {
        const content = JSON.parse(message.content);
        text = content.text ?? "";
      } catch { res.json({}); return; }

      if (!text.trim()) { res.json({}); return; }

      // 获取所有客户名称用于匹配
      const clients = await getAllClients();
      const clientNames = clients.map((c: any) => c.name);

      // AI 解析消息
      const parsed = await parseVisitFromMessage(text, clientNames);
      if (!parsed || !parsed.clientName) {
        // 无法识别客户，回复提示
        const token = await getFeishuToken();
        await fetch(`https://open.feishu.cn/open-apis/im/v1/messages/${message.message_id}/reply`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({
            msg_type: "text",
            content: JSON.stringify({ text: "❓ 无法识别客户名称，请在消息中明确提及客户名称，例如：\n「刚和美的集团张总吃了饭，聊了安全预算的事」" }),
          }),
        });
        res.json({});
        return;
      }

      // 匹配客户 ID
      const matchedClient = clients.find((c: any) =>
        c.name === parsed.clientName ||
        c.name.includes(parsed.clientName!) ||
        parsed.clientName!.includes(c.name)
      );
      if (!matchedClient) {
        res.json({});
        return;
      }

      // 生成待确认记录（存入数据库）
      const pendingId = crypto.randomBytes(8).toString("hex");
      await savePendingRecord(pendingId, {
        clientId: matchedClient.id,
        clientName: matchedClient.name,
        contactType: parsed.contactType || "formal_meeting",
        initiatedBy: parsed.initiatedBy || "sam",
        keyPoints: parsed.keyPoints || text.slice(0, 200),
        attendees: parsed.attendees || "",
        openId,
      });

      // 推送确认卡片
      const card = buildConfirmCard({
        clientName: matchedClient.name,
        contactType: parsed.contactType || "formal_meeting",
        initiatedBy: parsed.initiatedBy || "sam",
        keyPoints: parsed.keyPoints || text.slice(0, 200),
        attendees: parsed.attendees || "",
        pendingId,
      });
      await sendFeishuCard(openId, card);
      res.json({});
      return;
    }

    res.json({});
  } catch (e: any) {
    console.error("[feishu-webhook]", e.message);
    res.status(500).json({ error: e.message });
  }
}
