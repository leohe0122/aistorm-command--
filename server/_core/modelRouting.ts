// 模型路由：业务代码只声明“需要多强的模型”（档位），
// 由这里按当前启用的模型提供方换算成具体模型名与接口地址。
// 这样在系统设置里切换 OpenAI / Claude / GLM / 自定义端点时，业务代码无需改动。

export type ProviderId = "openai" | "claude" | "glm" | "custom";
export type ModelTier = "reasoning" | "standard" | "fast";

export const PROVIDERS: ProviderId[] = ["openai", "claude", "glm", "custom"];
export const MODEL_TIERS: ModelTier[] = ["reasoning", "standard", "fast"];

/** 各提供方的 OpenAI 兼容 Chat Completions 地址（custom 由管理员配置基础地址）。 */
export function chatCompletionsUrl(provider: ProviderId, customBaseUrl?: string | null): string {
  switch (provider) {
    case "openai":
      return "https://api.openai.com/v1/chat/completions";
    case "claude":
      // Anthropic 的 OpenAI 兼容端点；JSON Schema 约束在该端点不生效，见 adaptPayloadForProvider。
      return "https://api.anthropic.com/v1/chat/completions";
    case "glm":
      return "https://open.bigmodel.cn/api/paas/v4/chat/completions";
    case "custom": {
      const base = (customBaseUrl ?? "").trim().replace(/\/$/, "");
      if (!base) return "";
      return /\/chat\/completions$/.test(base) ? base : `${base}/v1/chat/completions`;
    }
  }
}

/** 默认模型。可在系统配置中用 llm_model_<provider>_<tier> 覆盖。 */
export const DEFAULT_MODELS: Record<Exclude<ProviderId, "custom">, Record<ModelTier, string>> = {
  openai: { reasoning: "gpt-5", standard: "gpt-4o", fast: "gpt-4o-mini" },
  claude: { reasoning: "claude-opus-5-5", standard: "claude-sonnet-5-5", fast: "claude-haiku-5-5" },
  glm: { reasoning: "glm-4-flash", standard: "glm-4-flash", fast: "glm-4-flash" },
};

export function modelOverrideKey(provider: ProviderId, tier: ModelTier): string {
  return `llm_model_${provider}_${tier}`;
}

/** 由历史代码里写死的模型名推断档位，保证旧调用在切换提供方后仍能工作。 */
export function inferTier(model?: string | null): ModelTier {
  const name = (model ?? "").toLowerCase();
  if (!name) return "standard";
  if (/(mini|flash|haiku|nano|lite)/.test(name)) return "fast";
  if (/^gpt-5|^o\d|opus|sonnet|fable|mythos|reasoner/.test(name)) return "reasoning";
  return "standard";
}

/** 模型名属于哪个提供方的命名空间；无法判断时返回 null。 */
export function providerOfModel(model?: string | null): ProviderId | null {
  const name = (model ?? "").toLowerCase();
  if (/^(gpt-|o\d|chatgpt-)/.test(name)) return "openai";
  if (/^claude-/.test(name)) return "claude";
  if (/^glm-/.test(name)) return "glm";
  return null;
}

/**
 * 选出最终发送的模型名：
 * 1. 管理员为该提供方与档位配置了覆盖值，用覆盖值；
 * 2. 调用方指定的模型本就属于当前提供方，保留；
 * 3. 否则按档位取当前提供方的默认模型。
 * custom 端点无默认表，未配置覆盖时保留调用方传入的模型名。
 */
export function resolveModel(opts: {
  provider: ProviderId;
  requestedModel?: string | null;
  tier?: ModelTier;
  override?: string | null;
}): string | undefined {
  const tier = opts.tier ?? inferTier(opts.requestedModel);
  const override = opts.override?.trim();
  if (override) return override;
  if (opts.provider === "custom") return opts.requestedModel ?? undefined;
  if (opts.requestedModel && providerOfModel(opts.requestedModel) === opts.provider) return opts.requestedModel;
  return DEFAULT_MODELS[opts.provider][tier];
}

/** 各提供方对 OpenAI 兼容参数的支持不同，发送前做必要的裁剪与补偿。 */
export function adaptPayloadForProvider(provider: ProviderId, payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...payload };
  if (provider !== "openai") delete out.reasoning;
  if (provider === "openai" || provider === "custom") delete out.thinking;

  if (provider === "claude") {
    const format = out.response_format as { type?: string; json_schema?: { schema?: unknown } } | undefined;
    if (format && format.type !== "text") {
      // 兼容端点会忽略 response_format；改为在系统提示中明确要求，解析侧仍需容错。
      const schemaHint = format.type === "json_schema" && format.json_schema?.schema
        ? `\n输出必须符合以下 JSON Schema：\n${JSON.stringify(format.json_schema.schema)}`
        : "";
      const instruction = `只输出一个合法的 JSON 对象，不要包含 Markdown 代码块或任何解释文字。${schemaHint}`;
      const messages = Array.isArray(out.messages) ? [...(out.messages as Array<Record<string, unknown>>)] : [];
      out.messages = [{ role: "system", content: instruction }, ...messages];
      delete out.response_format;
    }
  }
  return out;
}
