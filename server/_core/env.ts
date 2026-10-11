export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  // 托管平台内置服务（文件存储、通知、语音转写等）。只指向平台通道，
  // 不再被 OPENAI_API_KEY 劫持；AI 模型调用走 server/_core/modelRouting.ts 的提供方配置。
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // 飞书机器人
  feishuAppId: process.env.FEISHU_APP_ID ?? "",
  feishuAppSecret: process.env.FEISHU_APP_SECRET ?? "",
  // 飞书开放平台「事件与回调」页的 Verification Token，用于校验 Webhook 请求来源
  feishuVerificationToken: process.env.FEISHU_VERIFICATION_TOKEN ?? "",
};
