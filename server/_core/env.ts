export const ENV = {
  // 会话之外的服务端签名密钥：用于文件限时签名链接（server/storage.ts）。
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  // 飞书机器人
  feishuAppId: process.env.FEISHU_APP_ID ?? "",
  feishuAppSecret: process.env.FEISHU_APP_SECRET ?? "",
  // 飞书开放平台「事件与回调」页的 Verification Token，用于校验 Webhook 请求来源
  feishuVerificationToken: process.env.FEISHU_VERIFICATION_TOKEN ?? "",
};
