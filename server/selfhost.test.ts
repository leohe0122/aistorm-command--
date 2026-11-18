// 迁出 Manus 托管的回归保护：生产运行不依赖 Manus 平台与 devDependencies。
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectFile = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("自托管：构建与运行时", () => {
  it("服务入口不静态引入 vite（生产包只装 dependencies 也能启动）", () => {
    const entry = projectFile("server/_core/index.ts");
    expect(entry).not.toMatch(/^import .* from "\.\/vite";?$/m);
    expect(entry).toContain('await import("./vite")');
    const devServer = projectFile("server/_core/vite.ts");
    expect(devServer).not.toMatch(/^import .* from "vite";?$/m);
    expect(devServer).not.toContain("vite.config\"");
  });

  it("构建配置与页面不再加载 Manus 插件、调试采集或统计脚本", () => {
    const viteConfig = projectFile("vite.config.ts");
    const indexHtml = projectFile("client/index.html");
    const pkg = projectFile("package.json");
    for (const text of [viteConfig, indexHtml, pkg]) {
      expect(text).not.toMatch(/manus-runtime|debug-collector|umami|vite-plugin-jsx-loc/);
    }
  });

  it("前端不再走 Manus OAuth 登录", () => {
    const main = projectFile("client/src/main.tsx");
    const useAuth = projectFile("client/src/_core/hooks/useAuth.ts");
    expect(main).not.toContain("manus-cookie");
    expect(useAuth).not.toContain("startLogin");
  });
});
