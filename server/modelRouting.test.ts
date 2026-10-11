import { describe, expect, it } from "vitest";
import { adaptPayloadForProvider, chatCompletionsUrl, inferTier, providerOfModel, resolveModel } from "./_core/modelRouting";

describe("model tiers", () => {
  it("infers tiers from legacy hard-coded model names", () => {
    expect(inferTier("gpt-4o-mini")).toBe("fast");
    expect(inferTier("gpt-5-mini")).toBe("fast");
    expect(inferTier("glm-4-flash")).toBe("fast");
    expect(inferTier("claude-3-haiku-20240307")).toBe("fast");
    expect(inferTier("gpt-5")).toBe("reasoning");
    expect(inferTier("claude-sonnet-4-5")).toBe("reasoning");
    expect(inferTier("gpt-4o")).toBe("standard");
    expect(inferTier(undefined)).toBe("standard");
  });

  it("knows which provider a model name belongs to", () => {
    expect(providerOfModel("gpt-4o")).toBe("openai");
    expect(providerOfModel("claude-haiku-5-5")).toBe("claude");
    expect(providerOfModel("glm-4-flash")).toBe("glm");
    expect(providerOfModel("my-local-model")).toBeNull();
  });
});

describe("model resolution", () => {
  it("keeps a requested model that matches the active provider", () => {
    expect(resolveModel({ provider: "openai", requestedModel: "gpt-5-mini" })).toBe("gpt-5-mini");
  });

  it("translates another provider's model by tier", () => {
    expect(resolveModel({ provider: "claude", requestedModel: "gpt-4o-mini" })).toBe("claude-haiku-5-5");
    expect(resolveModel({ provider: "claude", requestedModel: "gpt-5" })).toBe("claude-opus-5-5");
    expect(resolveModel({ provider: "openai", requestedModel: "claude-sonnet-4-5" })).toBe("gpt-5");
  });

  it("prefers an explicit tier and admin override", () => {
    expect(resolveModel({ provider: "openai", tier: "fast" })).toBe("gpt-4o-mini");
    expect(resolveModel({ provider: "openai", requestedModel: "gpt-4o", override: "gpt-4.1" })).toBe("gpt-4.1");
  });

  it("passes the requested model through for custom endpoints", () => {
    expect(resolveModel({ provider: "custom", requestedModel: "gpt-4o-mini" })).toBe("gpt-4o-mini");
    expect(resolveModel({ provider: "custom", requestedModel: "x", override: "qwen-max" })).toBe("qwen-max");
  });
});

describe("provider endpoints and payloads", () => {
  it("uses the correct chat completions endpoint per provider", () => {
    expect(chatCompletionsUrl("glm")).toBe("https://open.bigmodel.cn/api/paas/v4/chat/completions");
    expect(chatCompletionsUrl("custom", "https://llm.example.com/")).toBe("https://llm.example.com/v1/chat/completions");
    expect(chatCompletionsUrl("custom", "https://llm.example.com/v1/chat/completions")).toBe("https://llm.example.com/v1/chat/completions");
    expect(chatCompletionsUrl("custom", "")).toBe("");
  });

  it("drops provider-specific parameters the target does not accept", () => {
    const out = adaptPayloadForProvider("glm", { model: "glm-4-flash", messages: [], reasoning: { effort: "low" }, thinking: {} });
    expect(out).not.toHaveProperty("reasoning");
    const openai = adaptPayloadForProvider("openai", { messages: [], reasoning: { effort: "low" }, thinking: {} });
    expect(openai).toHaveProperty("reasoning");
    expect(openai).not.toHaveProperty("thinking");
  });

  it("turns JSON schema output into an explicit instruction for Claude's compatible endpoint", () => {
    const out = adaptPayloadForProvider("claude", {
      messages: [{ role: "user", content: "hi" }],
      response_format: { type: "json_schema", json_schema: { name: "x", schema: { type: "object", properties: { a: { type: "string" } } } } },
    });
    expect(out).not.toHaveProperty("response_format");
    const messages = out.messages as Array<{ role: string; content: string }>;
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("JSON Schema");
    expect(messages[1]).toEqual({ role: "user", content: "hi" });
  });
});
