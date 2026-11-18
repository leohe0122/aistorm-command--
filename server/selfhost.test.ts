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

describe("自托管：登录只保留邮箱会话", () => {
  it("没有邮箱会话时拒绝请求，旧的 app_session_id JWT 不再被当作用户身份", async () => {
    const { SignJWT } = await import("jose");
    const { sdk } = await import("./_core/sdk");
    const legacyJwt = await new SignJWT({ openId: "oauth_user", appId: "app", name: "旧会话" })
      .setProtectedHeader({ alg: "HS256" })
      .sign(new TextEncoder().encode("any-secret"));
    await expect(sdk.authenticateRequest({ headers: {} } as any)).rejects.toThrow();
    await expect(sdk.authenticateRequest({ headers: { cookie: `app_session_id=${legacyJwt}` } } as any)).rejects.toThrow();
  });

  it("初始密码与临时密码用安全随机数生成，不再有硬编码默认密码", async () => {
    const { generateTempPassword } = await import("./_core/password");
    const samples = new Set(Array.from({ length: 200 }, () => generateTempPassword()));
    expect(samples.size).toBe(200);
    for (const password of samples) expect(password).toMatch(/^[A-HJ-NP-Za-km-z2-9]{4}(-[A-HJ-NP-Za-km-z2-9]{4}){3}$/);
    const routers = projectFile("server/routers.ts");
    const teamPage = projectFile("client/src/pages/TeamManagement.tsx");
    expect(routers).not.toContain("Aistorm2024!");
    expect(teamPage).not.toContain("Aistorm2024!");
    expect(routers).not.toContain("Math.floor(1000 + Math.random() * 9000)");
  });

  it("站点地址优先取 PUBLIC_APP_URL，否则取反向代理转发的来源", async () => {
    const { publicAppUrl } = await import("./_core/password");
    const saved = process.env.PUBLIC_APP_URL;
    delete process.env.PUBLIC_APP_URL;
    expect(publicAppUrl({ protocol: "http", headers: { "x-forwarded-proto": "https", host: "command.example.com" } })).toBe("https://command.example.com");
    process.env.PUBLIC_APP_URL = "https://command.aistorm.com/";
    expect(publicAppUrl()).toBe("https://command.aistorm.com");
    if (saved === undefined) delete process.env.PUBLIC_APP_URL; else process.env.PUBLIC_APP_URL = saved;
  });
});
