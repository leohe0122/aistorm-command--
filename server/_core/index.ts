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
      const fileKey = `product-docs/${Date.now()}-${base}_${hash}${ext}`;
      const { key, url } = await storagePut(fileKey, req.file.buffer, req.file.mimetype || "application/octet-stream");
      res.json({ fileKey: key, fileUrl: url, filename, mimeType: req.file.mimetype, fileSize: req.file.size });
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
