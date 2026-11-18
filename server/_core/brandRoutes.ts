import type { Express } from "express";
import fs from "node:fs";
import path from "node:path";
import { getBrandLogo, getBranding } from "../branding";

// 品牌相关的公开资源：自定义 Logo 与按品牌生成的 PWA manifest。
export function registerBrandRoutes(app: Express) {
  app.get("/brand/logo", async (_req, res) => {
    const logo = await getBrandLogo().catch(() => null);
    if (!logo) {
      res.status(404).end();
      return;
    }
    res.set("Cache-Control", "public, max-age=300");
    res.set("X-Content-Type-Options", "nosniff");
    res.type(logo.mimeType).send(Buffer.from(logo.data));
  });

  // PWA 名称跟随品牌配置；上传了 Logo 时图标也用它。其余字段沿用 client/public/manifest.json。
  app.get("/manifest.json", async (_req, res, next) => {
    try {
      const candidates = [
        path.resolve(import.meta.dirname, "public", "manifest.json"),
        path.resolve(import.meta.dirname, "../..", "client", "public", "manifest.json"),
      ];
      const file = candidates.find(candidate => fs.existsSync(candidate));
      if (!file) return next();
      const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
      const [brand, logo] = await Promise.all([getBranding(), getBrandLogo().catch(() => null)]);
      manifest.name = brand.productName;
      manifest.short_name = brand.productName.length <= 12 ? brand.productName : "Command";
      if (logo) manifest.icons = [{ src: "/brand/logo", sizes: "any", type: logo.mimeType, purpose: "any" }, ...manifest.icons];
      res.set("Cache-Control", "no-cache");
      res.type("application/manifest+json").send(JSON.stringify(manifest));
    } catch (error) {
      next(error);
    }
  });
}
