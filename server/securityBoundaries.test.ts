import { describe, expect, it } from "vitest";
import { isAdminOnlyConfigKey, isSecretConfigKey, redactConfigRows, redactConfigValue } from "../shared/configAccess";
import { extractFeishuToken, verifyFeishuWebhook } from "./feishuWebhookAuth";

const rows = [
  { id: 1, configKey: "llm_openai_key", configValue: "sk-proj-1234567890abcdef", updatedAt: new Date() },
  { id: 2, configKey: "llm_custom_url", configValue: "https://llm.internal.example", updatedAt: new Date() },
  { id: 3, configKey: "feishu_daily_briefing_webhook", configValue: "https://open.feishu.cn/hook/abc", updatedAt: new Date() },
  { id: 4, configKey: "feishu_daily_briefing_enabled", configValue: "true", updatedAt: new Date() },
  { id: 5, configKey: "crm_api_secret", configValue: "short", updatedAt: new Date() },
];

describe("system config redaction", () => {
  it("classifies secret and admin-only keys", () => {
    expect(isSecretConfigKey("llm_openai_key")).toBe(true);
    expect(isSecretConfigKey("crm_api_secret")).toBe(true);
    expect(isSecretConfigKey("feishu_daily_briefing_enabled")).toBe(false);
    expect(isAdminOnlyConfigKey("llm_custom_url")).toBe(true);
    expect(isAdminOnlyConfigKey("feishu_daily_briefing_webhook")).toBe(true);
    expect(isAdminOnlyConfigKey("feishu_daily_briefing_enabled")).toBe(false);
  });

  it("never returns plaintext secrets, even to admins", () => {
    const adminView = redactConfigRows(rows, true);
    expect(adminView).toHaveLength(rows.length);
    const key = adminView.find(row => row.configKey === "llm_openai_key")!;
    expect(key.configValue).not.toContain("1234567890");
    expect(key.configValue).toMatch(/^sk-p•+cdef$/);
    expect(adminView.find(row => row.configKey === "crm_api_secret")!.configValue).toBe("••••••••");
    expect(adminView.find(row => row.configKey === "feishu_daily_briefing_webhook")!.configValue).toBe("https://open.feishu.cn/hook/abc");
  });

  it("hides model routing, webhooks and secrets from non-admins", () => {
    const userView = redactConfigRows(rows, false);
    expect(userView.map(row => row.configKey)).toEqual(["feishu_daily_briefing_enabled"]);
  });

  it("redacts single-key reads the same way", () => {
    expect(redactConfigValue("llm_openai_key", "sk-proj-1234567890abcdef", false)).toBeNull();
    expect(redactConfigValue("llm_openai_key", "sk-proj-1234567890abcdef", true)).not.toContain("1234567890");
    expect(redactConfigValue("feishu_daily_briefing_enabled", "true", false)).toBe("true");
    expect(redactConfigValue("missing", undefined, true)).toBeNull();
  });
});

describe("feishu webhook verification", () => {
  it("reads the token from v2 header and v1/card top level", () => {
    expect(extractFeishuToken({ header: { token: "t-v2" } })).toBe("t-v2");
    expect(extractFeishuToken({ token: "t-v1", action: {} })).toBe("t-v1");
    expect(extractFeishuToken({ action: {} })).toBeNull();
  });

  it("fails closed when no verification token is configured", () => {
    expect(verifyFeishuWebhook({ token: "anything" }, "")).toMatchObject({ ok: false, status: 503 });
  });

  it("rejects missing or forged tokens, including on URL verification", () => {
    expect(verifyFeishuWebhook({ type: "url_verification", challenge: "c" }, "secret-token")).toMatchObject({ ok: false, status: 401 });
    expect(verifyFeishuWebhook({ action: { value: { action: "set_client" } }, token: "forged" }, "secret-token")).toMatchObject({ ok: false, status: 401 });
  });

  it("accepts the configured token", () => {
    expect(verifyFeishuWebhook({ header: { token: "secret-token" } }, "secret-token")).toEqual({ ok: true });
    expect(verifyFeishuWebhook({ type: "url_verification", challenge: "c", token: "secret-token" }, "secret-token")).toEqual({ ok: true });
  });
});
