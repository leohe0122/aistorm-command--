import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
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

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
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
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
