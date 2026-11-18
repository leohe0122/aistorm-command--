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

describe("自托管：存储与静态资源", () => {
  it("不再使用 Manus 预签名存储，PWA 图标在仓库内", () => {
    const storage = projectFile("server/storage.ts");
    const routers = projectFile("server/routers.ts");
    const entry = projectFile("server/_core/index.ts");
    for (const text of [storage, routers, entry]) expect(text).not.toMatch(/forge|presign\/put|manus-storage/i);
    const manifest = JSON.parse(projectFile("client/public/manifest.json"));
    const indexHtml = projectFile("client/index.html");
    expect(indexHtml).not.toContain("manus-storage");
    for (const icon of manifest.icons) expect(() => projectFile(`client/public${icon.src}`)).not.toThrow();
  });
});

describe("自托管：定时任务、模型 Key、语音与通知", () => {
  it("定时任务只认 CRON_SECRET，未配置时一律拒绝", async () => {
    const { isAuthorizedCronRequest } = await import("./_core/cron");
    const req = (headers: Record<string, string>) => ({ headers } as any);
    expect(isAuthorizedCronRequest(req({ authorization: "Bearer s3cret-value" }), "s3cret-value")).toBe(true);
    expect(isAuthorizedCronRequest(req({ "x-cron-secret": "s3cret-value" }), "s3cret-value")).toBe(true);
    expect(isAuthorizedCronRequest(req({ authorization: "Bearer wrong" }), "s3cret-value")).toBe(false);
    expect(isAuthorizedCronRequest(req({}), "s3cret-value")).toBe(false);
    expect(isAuthorizedCronRequest(req({ authorization: "Bearer " }), "")).toBe(false);
    for (const file of ["server/scheduled/dailyBriefing.ts", "server/scheduled/visitReminder.ts"]) {
      const source = projectFile(file);
      expect(source).toContain("requireCronSecret(req, res)");
      expect(source).not.toContain("isCron");
    }
  });

  it("未配置模型 Key 时不回退到服务器环境变量", async () => {
    const { vi } = await import("vitest");
    vi.stubEnv("OPENAI_API_KEY", "sk-should-not-be-used");
    vi.stubEnv("DATABASE_URL", "");
    const { getLLMProviderConfig } = await import("./db");
    expect(await getLLMProviderConfig("standard")).toBeNull();
    vi.unstubAllEnvs();
  });

  it("语音转写：优先专用配置，其次本部署的 OpenAI Key，都没有则不可用", async () => {
    const { resolveTranscriptionProvider } = await import("./_core/voiceTranscription");
    const reader = (values: Record<string, string>) => async (key: string) => values[key] ?? null;
    expect(await resolveTranscriptionProvider(reader({}))).toBeNull();
    expect(await resolveTranscriptionProvider(reader({ llm_openai_key: "k1" }))).toMatchObject({ baseUrl: "https://api.openai.com/v1", model: "whisper-1", source: "openai" });
    expect(await resolveTranscriptionProvider(reader({ llm_openai_key: "k1", voice_transcription_key: "k2", voice_transcription_url: "https://stt.example.com/v1/", voice_transcription_model: "sensevoice" })))
      .toMatchObject({ baseUrl: "https://stt.example.com/v1", apiKey: "k2", model: "sensevoice", source: "voice" });
  });

  it("管理员通知：飞书地址用飞书消息格式，其他地址收 JSON", async () => {
    const { buildNotificationBody } = await import("./_core/notification");
    const payload = { title: "标题", content: "内容" };
    expect(buildNotificationBody("https://open.feishu.cn/open-apis/bot/v2/hook/x", payload)).toEqual({ msg_type: "text", content: { text: "标题\n\n内容" } });
    expect(buildNotificationBody("https://hooks.example.com/notify", payload)).toEqual(payload);
  });

  it("代码中不再引用 Manus 平台服务", () => {
    for (const file of ["server/_core/sdk.ts", "server/_core/env.ts", "server/_core/notification.ts", "server/_core/voiceTranscription.ts", "server/feishuBot.ts", "server/db.ts"]) {
      expect(projectFile(file)).not.toMatch(/forgeApi|BUILT_IN_FORGE|manus\.im|manus-storage|x-manus|OAUTH_SERVER_URL|VITE_APP_ID|OWNER_OPEN_ID/i);
    }
  });
});
