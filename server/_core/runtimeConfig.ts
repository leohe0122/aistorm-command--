// 启动时逐项检查运行配置：缺少必需项时在生产环境直接退出并列出变量名，
// 而不是等用户点到某个页面才报错。只输出变量名，不输出任何值。

type Check = { name: string; ok: boolean; required: boolean; hint: string };

export function runtimeConfigChecks(env: NodeJS.ProcessEnv = process.env): Check[] {
  const has = (name: string) => Boolean(env[name]?.trim());
  const driver = env.STORAGE_DRIVER?.trim().toLowerCase();
  const checks: Check[] = [
    { name: "DATABASE_URL", ok: has("DATABASE_URL"), required: true, hint: "MySQL 8 连接串" },
    { name: "JWT_SECRET", ok: (env.JWT_SECRET?.trim().length ?? 0) >= 32, required: true, hint: "至少 32 位随机字符串，用于文件签名链接" },
    { name: "STORAGE_DRIVER", ok: driver === "local" || driver === "s3", required: true, hint: "local 或 s3" },
    { name: "PUBLIC_APP_URL", ok: has("PUBLIC_APP_URL"), required: false, hint: "对外地址，如 https://command.aistorm.com；用于飞书消息里的登录链接与文档预览链接" },
    { name: "CRON_SECRET", ok: has("CRON_SECRET"), required: false, hint: "未设置时定时任务接口停用" },
  ];
  if (driver === "s3") checks.push({ name: "S3_BUCKET", ok: has("S3_BUCKET"), required: true, hint: "STORAGE_DRIVER=s3 时必填" });
  return checks;
}

/** 返回缺失的必需项；生产环境由调用方决定是否退出。 */
export function reportRuntimeConfig(env: NodeJS.ProcessEnv = process.env): string[] {
  const checks = runtimeConfigChecks(env);
  for (const check of checks.filter(item => !item.ok)) {
    console.warn(`[config] ${check.required ? "缺少必需配置" : "未设置（可选）"} ${check.name}：${check.hint}`);
  }
  return checks.filter(item => item.required && !item.ok).map(item => item.name);
}
