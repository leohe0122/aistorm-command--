import type { Express, Request, Response } from "express";
import { FILES_ROUTE_PREFIX, storageOpenStream, verifyFileSignature } from "../storage";
import { sdk } from "./sdk";

// 通过本服务读取已上传的文件。要求登录，或带 storageGetSignedUrl 生成的限时签名。
// 存储桶 / 本地目录不对外公开，所有访问都经过这里。
export function registerFileRoutes(app: Express) {
  app.get(`${FILES_ROUTE_PREFIX}*`, async (req: Request, res: Response) => {
    let key: string;
    try {
      key = decodeURIComponent((req.params as Record<string, string>)[0] ?? "");
    } catch {
      res.status(400).send("Bad file path");
      return;
    }
    if (!key) {
      res.status(400).send("Missing file key");
      return;
    }

    let allowed = false;
    try {
      allowed = verifyFileSignature(key, req.query.expires, req.query.sig);
    } catch {
      allowed = false;
    }
    if (!allowed) {
      try {
        await sdk.authenticateRequest(req);
        allowed = true;
      } catch {
        allowed = false;
      }
    }
    if (!allowed) {
      res.status(401).send("Unauthorized");
      return;
    }

    try {
      const file = await storageOpenStream(key);
      if (!file) {
        res.status(404).send("Not found");
        return;
      }
      res.set("Cache-Control", "private, max-age=300");
      res.set("X-Content-Type-Options", "nosniff");
      if (file.contentLength !== undefined) res.set("Content-Length", String(file.contentLength));
      if (file.contentType) res.type(file.contentType);
      else res.type(key.split("/").pop() ?? "application/octet-stream");
      file.stream.on("error", error => {
        console.error("[files] stream failed:", error);
        if (!res.headersSent) res.status(502).end();
        else res.destroy(error);
      });
      file.stream.pipe(res);
    } catch (error: any) {
      console.error("[files] failed:", error?.message ?? error);
      res.status(error?.message?.includes("非法") ? 400 : 500).send("File unavailable");
    }
  });
}
