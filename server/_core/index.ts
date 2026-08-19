import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { dailyBriefingHandler } from "../scheduled/dailyBriefing";
import { visitReminderHandler } from "../scheduled/visitReminder";
import multer from "multer";
import { feishuWebhookHandler } from "../feishuBot";

const BUILD_MARKER = "20260819-ai-guidance-reasoning-fallback-v1";

async function startServer() {
  console.log(`[STARTUP] PORT=${process.env.PORT ?? "undefined"} NODE_ENV=${process.env.NODE_ENV ?? "undefined"}`);
  const app = express();
  const server = createServer(app);
  // 不依赖数据库、认证或任何外部服务；用于托管平台最早期健康探针。
  app.get("/__startup", (_req, res) => {
    res.status(200).json({ ok: true, ts: Date.now(), port: process.env.PORT ?? null, env: process.env.NODE_ENV ?? null });
  });
  // 无缓存版本探针：用于确认域名实际命中的服务实例与前端缓存策略版本。
  app.get("/__version", (_req, res) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.status(200).json({
      build: BUILD_MARKER,
      aiReviewRoute: "review-one-to-n-v3-nonempty-guard",
      serviceWorker: "20260819-ai-guidance-reasoning-v1",
      ts: Date.now(),
    });
  });
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);

  // ── Multipart file upload endpoint (bypasses tRPC JSON 32MB limit) ──
  const upload = multer({ storage: multer.memoryStorage() });
  app.post("/api/upload-doc", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) { res.status(400).json({ error: "No file provided" }); return; }
      const { storagePut } = await import("../storage");
      const hash = Math.random().toString(36).slice(2, 10);
      const filename = req.file.originalname;
      const ext = filename.includes(".") ? filename.slice(filename.lastIndexOf(".")) : "";
      const base = filename.includes(".") ? filename.slice(0, filename.lastIndexOf(".")) : filename;
      // Sanitize filename: replace non-ASCII chars with underscores, keep only safe chars
      const safeBase = base.replace(/[^\x00-\x7F]/g, '_').replace(/[^a-zA-Z0-9_\-\.]/g, '_').replace(/_+/g, '_').slice(0, 60);
      const safeExt = ext.replace(/[^\x00-\x7F]/g, '').replace(/[^a-zA-Z0-9\.]/g, '').slice(0, 10);
      const fileKey = `product-docs/${Date.now()}-${safeBase}_${hash}${safeExt}`;
      const { key, url } = await storagePut(fileKey, req.file.buffer, req.file.mimetype || "application/octet-stream");
      // 异步提取文字内容（不阻塞响应）
      const extractedText = await (async () => {
        try {
          const { extractTextFromBuffer } = await import('../docExtract');
          return await extractTextFromBuffer(req.file!.buffer, req.file!.mimetype || '', filename);
        } catch { return ''; }
      })();
      res.json({ fileKey: key, fileUrl: url, filename, mimeType: req.file.mimetype, fileSize: req.file.size, extractedText });
    } catch (e: any) {
      console.error("[upload-doc]", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // Scheduled / Heartbeat endpoints (must be before Vite/static fallthrough)
  app.post("/api/scheduled/daily-briefing", dailyBriefingHandler);
  app.post("/api/scheduled/visit-reminder", visitReminderHandler);
  // 飞书机器人 Webhook（接收消息事件 + 卡片回调）
  app.post("/api/feishu/webhook", feishuWebhookHandler);

  // 旧 Demo 已随新版三层作战架构下线；在静态资源回退前明确返回永久移除，
  // 防止 CDN 或历史构建继续呈现重构前的演示页面。
  app.get("/demo.html", (_req, res) => {
    res.status(410).type("text/plain").send("此演示已下线，请使用 AIStorm Command 的实时作战台路径。");
  });

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // 托管生产网关只会转发到平台注入的 PORT。不得在端口冲突时漂移到其他端口，
  // 否则进程虽能启动，外部请求会全部落到平台 500 页面。
  const port = parseInt(process.env.PORT || "3000", 10);

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${port}/`);
  });
}

startServer().catch(console.error);
