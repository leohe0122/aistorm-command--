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
import path from "path";
import fs from "fs";
import { getDb } from "../db";
import { demoTokens } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

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
  // Serve demo.html with token-based access control
  app.get("/demo.html", async (req, res) => {
    const token = req.query.token as string | undefined;
    const distDir =
      process.env.NODE_ENV === "development"
        ? path.resolve(import.meta.dirname, "../..", "dist", "public")
        : path.resolve(import.meta.dirname, "public");
    const demoPath = path.resolve(distDir, "demo.html");

    if (!fs.existsSync(demoPath)) {
      res.status(404).send(`demo.html not found`);
      return;
    }

    // If no token provided, show access denied page
    if (!token) {
      res.status(403).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>访问受限</title><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0d1117;color:#e6edf3}div{text-align:center}h2{color:#f85149}p{color:#8b949e}a{color:#58a6ff}</style></head><body><div><h2>🔒 访问受限</h2><p>此演示需要有效的访问链接。</p><p>请联系 <a href="mailto:leo.he@aistorm.com">leo.he@aistorm.com</a> 获取访问权限。</p></div></body></html>`);
      return;
    }

    try {
      const db = await getDb();
      if (!db) { res.sendFile(demoPath); return; } // fallback if DB unavailable

      const [record] = await db.select().from(demoTokens).where(eq(demoTokens.token, token)).limit(1);

      if (!record || !record.isActive) {
        res.status(403).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>链接无效</title><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0d1117;color:#e6edf3}div{text-align:center}h2{color:#f85149}p{color:#8b949e}a{color:#58a6ff}</style></head><body><div><h2>🔒 链接无效或已失效</h2><p>此访问链接已被撤销或不存在。</p><p>请联系 <a href="mailto:leo.he@aistorm.com">leo.he@aistorm.com</a> 获取新的访问链接。</p></div></body></html>`);
        return;
      }

      // Check expiry
      if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
        res.status(403).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>链接已过期</title><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0d1117;color:#e6edf3}div{text-align:center}h2{color:#f0883e}p{color:#8b949e}a{color:#58a6ff}</style></head><body><div><h2>⏰ 访问链接已过期</h2><p>此链接已于 ${new Date(record.expiresAt).toLocaleDateString('zh-CN')} 过期。</p><p>请联系 <a href="mailto:leo.he@aistorm.com">leo.he@aistorm.com</a> 获取新的访问链接。</p></div></body></html>`);
        return;
      }

      // Record access
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
      await db.update(demoTokens).set({
        accessCount: (record.accessCount || 0) + 1,
        lastAccessAt: new Date(),
        lastAccessIp: clientIp,
      }).where(eq(demoTokens.id, record.id));

      // Inject watermark info into demo.html
      let html = fs.readFileSync(demoPath, 'utf-8');
      const watermarkScript = `<script>
window.__DEMO_VIEWER__ = ${JSON.stringify({ name: record.recipientName, email: record.recipientEmail || '', token: token.slice(0, 8) + '...' })};
</script>`;
      html = html.replace('</head>', watermarkScript + '</head>');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (err) {
      console.error('[demo.html] token validation error:', err);
      res.sendFile(demoPath); // fallback on error
    }
  });
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
