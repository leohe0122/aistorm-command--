export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  // Prefer user-supplied OPENAI_API_KEY over built-in forge key
  forgeApiUrl: process.env.OPENAI_API_KEY
    ? "https://api.openai.com"
    : (process.env.BUILT_IN_FORGE_API_URL ?? ""),
  forgeApiKey: process.env.OPENAI_API_KEY ?? process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // 飞书机器人
  feishuAppId: process.env.FEISHU_APP_ID ?? "",
  feishuAppSecret: process.env.FEISHU_APP_SECRET ?? "",
  // 飞书开放平台「事件与回调」页的 Verification Token，用于校验 Webhook 请求来源
  feishuVerificationToken: process.env.FEISHU_VERIFICATION_TOKEN ?? "",
};
