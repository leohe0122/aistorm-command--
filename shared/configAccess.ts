// 系统配置的读取边界：密钥类配置任何人都不以明文返回；
// 非管理员连外发通道（Webhook）与模型路由也看不到。

const SECRET_KEY_PATTERN = /(_key|secret|token|password|passwd|credential)s?$/i;
const ADMIN_ONLY_KEY_PATTERN = /(webhook|^llm_)/i;

export function isSecretConfigKey(key: string): boolean {
  return SECRET_KEY_PATTERN.test(key);
}

export function isAdminOnlyConfigKey(key: string): boolean {
  return isSecretConfigKey(key) || ADMIN_ONLY_KEY_PATTERN.test(key);
}

export function maskSecretValue(value: string | null | undefined): string | null {
  if (!value) return value ?? null;
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••••••${value.slice(-4)}`;
}

type ConfigRow = { configKey: string; configValue: string | null };

/** 管理员看到全部键但密钥脱敏；其他已登录用户只看到非敏感键。 */
export function redactConfigRows<T extends ConfigRow>(rows: T[], isAdmin: boolean): T[] {
  return rows
    .filter(row => isAdmin || !isAdminOnlyConfigKey(row.configKey))
    .map(row => (isSecretConfigKey(row.configKey) ? { ...row, configValue: maskSecretValue(row.configValue) } : row));
}

/** 单键读取：密钥永不明文；非管理员读取敏感键返回 null。 */
export function redactConfigValue(key: string, value: string | null | undefined, isAdmin: boolean): string | null {
  if (!isAdmin && isAdminOnlyConfigKey(key)) return null;
  if (isSecretConfigKey(key)) return maskSecretValue(value);
  return value ?? null;
}
