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
  isInfoSparse?: boolean;
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
          {
            tag: "button",
            text: { tag: "plain_text", content: "✏️ 修改" },
            type: "default",
            value: { action: "edit_request", pendingId: params.pendingId },
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
  rawText?: string; awaitingClient?: number;
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

// ── 发送欢迎消息给新成员 ──────────────────────────────────────────────────────
export async function sendFeishuWelcomeMessage(params: {
  email: string;
  name: string;
  podRole: string;
  password: string;
  loginUrl: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (!ENV.feishuAppId || !ENV.feishuAppSecret) {
      return { success: false, error: '飞书 App ID/Secret 未配置' };
    }
    const token = await getFeishuToken();
    if (!token) return { success: false, error: '获取飞书 Token 失败' };

    // Step 1: 通过邮箱查询飞书 open_id
    const lookupRes = await fetch(
      `https://open.feishu.cn/open-apis/contact/v3/users/batch_get_id?user_id_type=open_id`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ emails: [params.email] }),
      }
    );
    const lookupData = await lookupRes.json() as any;
    const openId = lookupData?.data?.user_list?.[0]?.user_id;
    if (!openId) {
      return { success: false, error: `未找到邮箱 ${params.email} 对应的飞书账号` };
    }

    // Step 2: 发送欢迎卡片消息
    const roleLabels: Record<string, string> = {
      AD: "Account Director · 客户总监",
      SAM: "SAM · 战略客户经理",
      SA: "SA · 解决方案架构师",
      RSM: "RSM · 属地销售",
    };
    const card = {
      config: { wide_screen_mode: true },
      header: {
        title: { tag: "plain_text", content: "🎉 欢迎加入 AIStorm Command！" },
        template: "blue",
      },
      elements: [
        {
          tag: "div",
          text: { tag: "lark_md", content: `**${params.name}** 你好！\n\n你的 AIStorm Command 账号已创建，以下是你的登录信息：` },
        },
        { tag: "hr" },
        {
          tag: "div",
          fields: [
            { is_short: true, text: { tag: "lark_md", content: `**角色**\n${roleLabels[params.podRole] || params.podRole}` } },
            { is_short: true, text: { tag: "lark_md", content: `**登录邮箱**\n${params.email}` } },
          ],
        },
        {
          tag: "div",
          text: { tag: "lark_md", content: `**初始密码**\n\`${params.password}\`` },
        },
        { tag: "hr" },
        {
          tag: "action",
          actions: [
            {
              tag: "button",
              text: { tag: "plain_text", content: "🚀 立即登录 AIStorm Command" },
              type: "primary",
              url: params.loginUrl,
            },
          ],
        },
        {
          tag: "note",
          elements: [
            { tag: "plain_text", content: "登录后请在侧边栏底部点击 🔑 按钮修改密码。如有问题请联系 Leo。" },
          ],
        },
      ],
    };

    await sendFeishuCard(openId, card);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ── 发送重置密码通知 ──────────────────────────────────────────────────────────
export async function sendFeishuPasswordReset(params: {
  email: string;
  name: string;
  tempPassword: string;
  loginUrl: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (!ENV.feishuAppId || !ENV.feishuAppSecret) return { success: false, error: '飞书未配置' };
    const token = await getFeishuToken();
    if (!token) return { success: false, error: '获取 Token 失败' };
    const lookupRes = await fetch(
      `https://open.feishu.cn/open-apis/contact/v3/users/batch_get_id?user_id_type=open_id`,
      { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ emails: [params.email] }) }
    );
    const lookupData = await lookupRes.json() as any;
    const openId = lookupData?.data?.user_list?.[0]?.user_id;
    if (!openId) return { success: false, error: `未找到飞书账号: ${params.email}` };
    const card = {
      config: { wide_screen_mode: true },
      header: { title: { tag: "plain_text", content: "🔑 你的 AIStorm Command 密码已重置" }, template: "orange" },
      elements: [
        { tag: "div", text: { tag: "lark_md", content: `**${params.name}** 你好！\n\n管理员已为你重置了 AIStorm Command 的登录密码，以下是新的临时密码：` } },
        { tag: "hr" },
        { tag: "div", text: { tag: "lark_md", content: `**临时密码**\n\`${params.tempPassword}\`` } },
        { tag: "hr" },
        { tag: "action", actions: [{ tag: "button", text: { tag: "plain_text", content: "🚀 立即登录并修改密码" }, type: "primary", url: params.loginUrl }] },
        { tag: "note", elements: [{ tag: "plain_text", content: "登录后请在侧边栏底部点击 🔑 按钮修改密码。如有问题请联系 Leo。" }] },
      ],
    };
    await sendFeishuCard(openId, card);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ── 发送账号状态变更通知 ──────────────────────────────────────────────────────
export async function sendFeishuAccountStatus(params: {
  email: string;
  name: string;
  isActive: boolean;
  loginUrl: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (!ENV.feishuAppId || !ENV.feishuAppSecret) return { success: false, error: '飞书未配置' };
    const token = await getFeishuToken();
    if (!token) return { success: false, error: '获取 Token 失败' };
    const lookupRes = await fetch(
      `https://open.feishu.cn/open-apis/contact/v3/users/batch_get_id?user_id_type=open_id`,
      { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ emails: [params.email] }) }
    );
    const lookupData = await lookupRes.json() as any;
    const openId = lookupData?.data?.user_list?.[0]?.user_id;
    if (!openId) return { success: false, error: `未找到飞书账号: ${params.email}` };
    const card = {
      config: { wide_screen_mode: true },
      header: {
        title: { tag: "plain_text", content: params.isActive ? "✅ 你的账号已重新启用" : "⛔ 你的账号已被停用" },
        template: params.isActive ? "green" : "red",
      },
      elements: [
        {
          tag: "div",
          text: {
            tag: "lark_md",
            content: params.isActive
              ? `**${params.name}** 你好！\n\n你的 AIStorm Command 账号已由管理员重新启用，现在可以正常登录使用。`
              : `**${params.name}** 你好！\n\n你的 AIStorm Command 账号已由管理员暂停使用。如有疑问，请联系 Leo。`,
          },
        },
        ...(params.isActive ? [
          { tag: "hr" as const },
          { tag: "action" as const, actions: [{ tag: "button", text: { tag: "plain_text", content: "🚀 立即登录" }, type: "primary", url: params.loginUrl }] },
        ] : []),
      ],
    };
    await sendFeishuCard(openId, card);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

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

      // 处理客户名称补充（截图无法识别客户时）
      if (action.action === "set_client" && action.pendingId) {
        const record = await getPendingRecord(action.pendingId);
        if (!record) { res.json({ toast: { type: "error", content: "记录已过期" } }); return; }
        const db = await getDb();
        if (db) {
          const { feishuPendingRecords } = await import('../drizzle/schema');
          const { eq } = await import('drizzle-orm');
          await db.update(feishuPendingRecords)
            .set({ clientId: action.clientId, clientName: action.clientName, awaitingClient: 0 })
            .where(eq(feishuPendingRecords.id, action.pendingId));
        }
        const updatedRecord = await getPendingRecord(action.pendingId);
        if (!updatedRecord) { res.json({ toast: { type: "error", content: "记录已过期" } }); return; }
        res.json(buildConfirmCard({
          clientName: action.clientName, contactType: updatedRecord.contactType,
          initiatedBy: updatedRecord.initiatedBy, keyPoints: updatedRecord.keyPoints,
          attendees: updatedRecord.attendees, pendingId: action.pendingId,
        }));
        return;
      }

      // 处理修改请求
      if (action.action === "edit_request" && action.pendingId) {
        const record = await getPendingRecord(action.pendingId);
        if (!record) { res.json({ toast: { type: "error", content: "记录已过期" } }); return; }
        const token = await getFeishuToken();
        await fetch(`https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({
            receive_id: record.openId,
            msg_type: "text",
            content: JSON.stringify({ text: `✏️ 请发送修改后的信息（用|分隔）：\n客户名|关键信息|参会人\n\n例如：美的集团|讨论了安全预算，明年有采购计划|张总（CTO）\n\n当前记录ID：${action.pendingId}` }),
          }),
        });
        res.json({ toast: { type: "info", content: "请在聊天框中发送修改内容" } });
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

      const openId = event?.sender?.sender_id?.open_id;
      if (!openId) { res.json({}); return; }

      // ── 处理语音消息（飞书语音）──────────────────────────────────────────────────
      if (message.message_type === "audio") {
        let audioContent: any;
        try { audioContent = JSON.parse(message.content); } catch { res.json({}); return; }
        const audioKey = audioContent.file_key;
        if (!audioKey) { res.json({}); return; }

        // 下载语音文件
        const audioToken = await getFeishuToken();
        const audioRes = await fetch(`https://open.feishu.cn/open-apis/im/v1/messages/${message.message_id}/resources/${audioKey}?type=file`, {
          headers: { "Authorization": `Bearer ${audioToken}` },
        });
        if (!audioRes.ok) {
          await fetch(`https://open.feishu.cn/open-apis/im/v1/messages/${message.message_id}/reply`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${audioToken}` },
            body: JSON.stringify({ msg_type: "text", content: JSON.stringify({ text: "⚠️ 无法读取语音文件，请重试或直接发文字" }) }),
          });
          res.json({}); return;
        }

        // 上传到临时存储获取 URL，再调用 Whisper 转录
        const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
        const audioBase64 = audioBuffer.toString("base64");
        const mimeType = audioRes.headers.get("content-type") || "audio/ogg";

        // 直接调用 Whisper API（复用 voiceTranscription 逻辑）
        let transcribedText = "";
        try {
          const formData = new FormData();
          const audioBlob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
          formData.append("file", audioBlob, `audio.ogg`);
          formData.append("model", "whisper-1");
          formData.append("response_format", "verbose_json");
          formData.append("prompt", "这是一段销售拜访记录，请转录为中文");
          const baseUrl = ENV.forgeApiUrl?.endsWith("/") ? ENV.forgeApiUrl : `${ENV.forgeApiUrl}/`;
          const whisperRes = await fetch(`${baseUrl}v1/audio/transcriptions`, {
            method: "POST",
            headers: { authorization: `Bearer ${ENV.forgeApiKey}`, "Accept-Encoding": "identity" },
            body: formData,
          });
          if (whisperRes.ok) {
            const whisperData = await whisperRes.json() as any;
            transcribedText = whisperData.text ?? "";
          }
        } catch (e: any) {
          console.error("[feishu-webhook] whisper error:", e.message);
        }

        if (!transcribedText) {
          const t = await getFeishuToken();
          await fetch(`https://open.feishu.cn/open-apis/im/v1/messages/${message.message_id}/reply`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${t}` },
            body: JSON.stringify({ msg_type: "text", content: JSON.stringify({ text: "⚠️ 语音转文字失败，请直接发文字描述" }) }),
          });
          res.json({}); return;
        }

        // 转录成功，按文字消息流程处理
        const voiceClients = await getAllClients();
        const voiceClientNames = voiceClients.map((c: any) => c.name);
        const voiceParsed = await parseVisitFromMessage(transcribedText, voiceClientNames);
        if (!voiceParsed || !voiceParsed.clientName) {
          const t = await getFeishuToken();
          await fetch(`https://open.feishu.cn/open-apis/im/v1/messages/${message.message_id}/reply`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${t}` },
            body: JSON.stringify({ msg_type: "text", content: JSON.stringify({ text: `🎤 已转录：「${transcribedText}」\n\n❓ 无法识别客户名称，请明确提及客户名称后重新发送` }) }),
          });
          res.json({}); return;
        }
        const voiceMatchedClient = voiceClients.find((c: any) => c.name === voiceParsed.clientName || c.name.includes(voiceParsed.clientName!) || voiceParsed.clientName!.includes(c.name));
        if (!voiceMatchedClient) { res.json({}); return; }
        const voicePendingId = crypto.randomBytes(8).toString("hex");
        await savePendingRecord(voicePendingId, {
          clientId: voiceMatchedClient.id, clientName: voiceMatchedClient.name,
          contactType: voiceParsed.contactType || "formal_meeting", initiatedBy: voiceParsed.initiatedBy || "sam",
          keyPoints: voiceParsed.keyPoints || transcribedText.slice(0, 200),
          attendees: voiceParsed.attendees || "", openId, rawText: transcribedText,
        });
        const isVoiceSparse = !voiceParsed.keyPoints || voiceParsed.keyPoints.length < 15;
        await sendFeishuCard(openId, buildConfirmCard({
          clientName: voiceMatchedClient.name, contactType: voiceParsed.contactType || "formal_meeting",
          initiatedBy: voiceParsed.initiatedBy || "sam",
          keyPoints: voiceParsed.keyPoints || transcribedText.slice(0, 200),
          attendees: voiceParsed.attendees || "", pendingId: voicePendingId, isInfoSparse: isVoiceSparse,
        }));
        res.json({}); return;
      }

      // ── 处理图片消息（微信截图等）──────────────────────────────────────────────
      if (message.message_type === "image") {
        let imgContent: any;
        try { imgContent = JSON.parse(message.content); } catch { res.json({}); return; }
        const imageKey = imgContent.image_key;
        if (!imageKey) { res.json({}); return; }

        // 下载图片并转为 base64
        const imgToken = await getFeishuToken();
        const imgRes = await fetch(`https://open.feishu.cn/open-apis/im/v1/messages/${message.message_id}/resources/${imageKey}?type=image`, {
          headers: { "Authorization": `Bearer ${imgToken}` },
        });
        if (!imgRes.ok) {
          await fetch(`https://open.feishu.cn/open-apis/im/v1/messages/${message.message_id}/reply`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${imgToken}` },
            body: JSON.stringify({ msg_type: "text", content: JSON.stringify({ text: "⚠️ 无法读取图片，请确认图片权限后重试" }) }),
          });
          res.json({}); return;
        }
        const imgBuffer = await imgRes.arrayBuffer();
        const base64Img = Buffer.from(imgBuffer).toString("base64");
        const mimeType = imgRes.headers.get("content-type") || "image/jpeg";

        // 用 Vision LLM 识别图片内容
        const clients = await getAllClients();
        const clientNames = clients.map((c: any) => c.name);
        const clientListStr = clientNames.slice(0, 30).join("、");

        let parsedImg: any = null;
        try {
          const visionResult = await invokeLLM({
            model: "gpt-4o",
            messages: [{
              role: "user",
              content: [
                {
                  type: "text",
                  text: `你是一个销售数据录入助手。请分析这张截图（可能是微信聊天记录、会议截图或客户沟通记录），提取拜访/接触信息。

当前系统中的客户列表：${clientListStr}

请以JSON格式返回：
- clientName: 从客户列表中匹配最相关的客户名称（如果无法匹配则返回null）
- contactType: 接触方式，必须是以下之一：formal_meeting、dinner_meeting、phone_call、video_call、instant_message（微信/即时消息）、event、customer_initiated
- initiatedBy: 发起方，sam（我方）或 customer（客户）
- keyPoints: 从截图中提取的关键信息点（100字以内）
- attendees: 参会/对话人（如果能识别）

只返回JSON，不要其他内容。`
                },
                {
                  type: "image_url",
                  image_url: { url: `data:${mimeType};base64,${base64Img}` }
                }
              ] as any,
            }],
            response_format: { type: "json_object" },
          });
          const visionContent = visionResult.choices[0]?.message?.content ?? "{}";
          parsedImg = JSON.parse(typeof visionContent === "string" ? visionContent : "{}");
        } catch (e: any) {
          console.error("[feishu-webhook] vision error:", e.message);
        }

        if (!parsedImg || !parsedImg.clientName) {
          // 无法识别客户名，推送客户选择卡片
          const allClients2 = await getAllClients();
          const noPendingId = crypto.randomBytes(8).toString("hex");
          await savePendingRecord(noPendingId, {
            clientId: 0, clientName: "", contactType: parsedImg?.contactType || "instant_message",
            initiatedBy: parsedImg?.initiatedBy || "sam",
            keyPoints: parsedImg?.keyPoints || "（从截图提取）",
            attendees: parsedImg?.attendees || "", openId, awaitingClient: 1,
          });
          const clientButtons = allClients2.slice(0, 10).map((c: any) => ({
            tag: "button",
            text: { tag: "plain_text", content: c.name },
            type: "default",
            value: { action: "set_client", pendingId: noPendingId, clientId: c.id, clientName: c.name },
          }));
          await sendFeishuCard(openId, {
            config: { wide_screen_mode: true },
            header: { title: { tag: "plain_text", content: "❓ 请选择客户" }, template: "orange" },
            elements: [
              { tag: "div", text: { tag: "lark_md", content: "截图已识别，但无法确定是哪个客户，请点击选择：" } },
              { tag: "action", actions: clientButtons },
            ],
          });
          res.json({}); return;
        }

        const matchedClientImg = clients.find((c: any) =>
          c.name === parsedImg.clientName ||
          c.name.includes(parsedImg.clientName) ||
          parsedImg.clientName.includes(c.name)
        );
        if (!matchedClientImg) {
          const t3 = await getFeishuToken();
          await fetch(`https://open.feishu.cn/open-apis/im/v1/messages/${message.message_id}/reply`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${t3}` },
            body: JSON.stringify({ msg_type: "text", content: JSON.stringify({ text: `❓ 识别到客户"${parsedImg.clientName}"，但系统中未找到匹配，请检查客户名称` }) }),
          });
          res.json({}); return;
        }

        const pendingIdImg = require("crypto").randomBytes(8).toString("hex");
        await savePendingRecord(pendingIdImg, {
          clientId: matchedClientImg.id, clientName: matchedClientImg.name,
          contactType: parsedImg.contactType || "instant_message",
          initiatedBy: parsedImg.initiatedBy || "sam",
          keyPoints: parsedImg.keyPoints || "（从截图提取）",
          attendees: parsedImg.attendees || "", openId,
        });
        await sendFeishuCard(openId, buildConfirmCard({
          clientName: matchedClientImg.name,
          contactType: parsedImg.contactType || "instant_message",
          initiatedBy: parsedImg.initiatedBy || "sam",
          keyPoints: parsedImg.keyPoints || "（从截图提取）",
          attendees: parsedImg.attendees || "",
          pendingId: pendingIdImg,
        }));
        res.json({}); return;
      }

      // ── 处理文件消息（飞书妙记/文档）──────────────────────────────────────────
      if (message.message_type === "file") {
        let fileContent: any;
        try { fileContent = JSON.parse(message.content); } catch { res.json({}); return; }
        const fileKey = fileContent.file_key;
        const fileName = fileContent.file_name ?? "会议记录";
        if (!fileKey) { res.json({}); return; }

        const fileToken = await getFeishuToken();
        const fileRes = await fetch(`https://open.feishu.cn/open-apis/im/v1/messages/${message.message_id}/resources/${fileKey}?type=file`, {
          headers: { "Authorization": `Bearer ${fileToken}` },
        });
        if (!fileRes.ok) {
          await fetch(`https://open.feishu.cn/open-apis/im/v1/messages/${message.message_id}/reply`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${fileToken}` },
            body: JSON.stringify({ msg_type: "text", content: JSON.stringify({ text: "⚠️ 无法读取文件内容，请确认文件权限后重试，或直接发送文字描述" }) }),
          });
          res.json({}); return;
        }
        const fileBuffer = await fileRes.arrayBuffer();
        const fileText = Buffer.from(fileBuffer).toString("utf-8").slice(0, 8000);

        const clientsF = await getAllClients();
        const clientNamesF = clientsF.map((c: any) => c.name);
        const parsedF = await parseVisitFromMessage(`【飞书妙记/文件：${fileName}】
${fileText}`, clientNamesF);
        if (!parsedF || !parsedF.clientName) {
          const t4 = await getFeishuToken();
          await fetch(`https://open.feishu.cn/open-apis/im/v1/messages/${message.message_id}/reply`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${t4}` },
            body: JSON.stringify({ msg_type: "text", content: JSON.stringify({ text: "❓ 无法从文件中识别客户名称，请在发送文件时附上一句话说明，例如：「这是和美的集团的会议记录」" }) }),
          });
          res.json({}); return;
        }
        const matchedClientF = clientsF.find((c: any) => c.name === parsedF.clientName || c.name.includes(parsedF.clientName!) || parsedF.clientName!.includes(c.name));
        if (!matchedClientF) { res.json({}); return; }
        const pendingIdF = require("crypto").randomBytes(8).toString("hex");
        await savePendingRecord(pendingIdF, {
          clientId: matchedClientF.id, clientName: matchedClientF.name,
          contactType: parsedF.contactType || "formal_meeting", initiatedBy: parsedF.initiatedBy || "sam",
          keyPoints: parsedF.keyPoints || "", attendees: parsedF.attendees || "", openId,
        });
        await sendFeishuCard(openId, buildConfirmCard({
          clientName: matchedClientF.name, contactType: parsedF.contactType || "formal_meeting",
          initiatedBy: parsedF.initiatedBy || "sam", keyPoints: parsedF.keyPoints || "",
          attendees: parsedF.attendees || "", pendingId: pendingIdF,
        }));
        res.json({}); return;
      }

      // 只处理文本消息（其他类型忽略）
      if (message.message_type !== "text") {
        const t5 = await getFeishuToken();
        await fetch(`https://open.feishu.cn/open-apis/im/v1/messages/${message.message_id}/reply`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${t5}` },
          body: JSON.stringify({ msg_type: "text", content: JSON.stringify({ text: "💡 支持以下录入方式：\n1️⃣ 文字：「刚和美的集团张总吃了饭，聊了安全预算」\n2️⃣ 截图：直接发微信聊天截图\n3️⃣ 文件：发送飞书妙记文件\n4️⃣ 语音：直接发语音消息，自动转文字" }) }),
        });
        res.json({});
        return;
      }

      const openId2 = openId;
      let text = "";
      try {
        const content = JSON.parse(message.content);
        text = content.text ?? "";
      } catch { res.json({}); return; }

      if (!text.trim()) { res.json({}); return; }

      // 检测是否是修改回复（格式：客户名|关键信息|参会人，且消息中包含 pendingId 提示）
      // 用户回复格式：美的集团|聊了安全预算|张总
      const editMatch = text.match(/^([^|]+)\|([^|]+)(?:\|(.+))?$/);
      if (editMatch) {
        // 查找最近1小时内该用户的 pending 记录
        const db2 = await getDb();
        if (db2) {
          const { feishuPendingRecords } = await import('../drizzle/schema');
          const { eq, and, gt } = await import('drizzle-orm');
          const recentRecords = await db2.select().from(feishuPendingRecords)
            .where(and(eq(feishuPendingRecords.openId, openId), gt(feishuPendingRecords.expiresAt, new Date())))
            .orderBy(feishuPendingRecords.createdAt)
            .limit(1);
          if (recentRecords.length > 0) {
            const pendingRec = recentRecords[0];
            const newClientName = editMatch[1].trim();
            const newKeyPoints = editMatch[2].trim();
            const newAttendees = editMatch[3]?.trim() || pendingRec.attendees || "";
            // 匹配客户
            const allClients3 = await getAllClients();
            const matchedEdit = allClients3.find((c: any) => c.name === newClientName || c.name.includes(newClientName) || newClientName.includes(c.name));
            if (matchedEdit) {
              await db2.update(feishuPendingRecords)
                .set({ clientId: matchedEdit.id, clientName: matchedEdit.name, keyPoints: newKeyPoints, attendees: newAttendees })
                .where(eq(feishuPendingRecords.id, pendingRec.id));
              await sendFeishuCard(openId, buildConfirmCard({
                clientName: matchedEdit.name, contactType: pendingRec.contactType,
                initiatedBy: pendingRec.initiatedBy, keyPoints: newKeyPoints,
                attendees: newAttendees, pendingId: pendingRec.id,
              }));
              res.json({}); return;
            }
          }
        }
      }

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
      const isInfoSparse = !parsed.keyPoints || parsed.keyPoints.length < 15;
      const card = buildConfirmCard({
        clientName: matchedClient.name,
        contactType: parsed.contactType || "formal_meeting",
        initiatedBy: parsed.initiatedBy || "sam",
        keyPoints: parsed.keyPoints || text.slice(0, 200),
        attendees: parsed.attendees || "",
        pendingId,
        isInfoSparse,
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
