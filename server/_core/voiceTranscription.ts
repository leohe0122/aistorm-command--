// 语音转写（可选能力）。走 OpenAI 兼容的 /audio/transcriptions 接口，配置都在“系统设置”里，
// 由各部署的管理员填写自己的 Key，不读取任何平台或服务器级别的兜底 Key。
//
// 选择顺序：
//   1. voice_transcription_key（+ 可选 voice_transcription_url、voice_transcription_model）
//   2. 已配置的 OpenAI 模型 Key（llm_openai_key），使用 OpenAI 官方 whisper-1
//   3. 都没有：返回 { ok: false, reason }，调用方提示用户改发文字（优雅降级）

import { getSystemConfig } from "../db";

const OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "whisper-1";
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export type TranscriptionProvider = { baseUrl: string; apiKey: string; model: string; source: "voice" | "openai" };
export type TranscriptionResult = { ok: true; text: string } | { ok: false; reason: string };

export async function resolveTranscriptionProvider(read: (key: string) => Promise<string | null | undefined> = getSystemConfig): Promise<TranscriptionProvider | null> {
  const voiceKey = (await read("voice_transcription_key"))?.trim();
  if (voiceKey) {
    const baseUrl = ((await read("voice_transcription_url"))?.trim() || OPENAI_BASE_URL).replace(/\/+$/, "");
    const model = (await read("voice_transcription_model"))?.trim() || DEFAULT_MODEL;
    return { baseUrl, apiKey: voiceKey, model, source: "voice" };
  }
  const openaiKey = (await read("llm_openai_key"))?.trim();
  if (openaiKey) return { baseUrl: OPENAI_BASE_URL, apiKey: openaiKey, model: DEFAULT_MODEL, source: "openai" };
  return null;
}

export async function transcribeAudioBuffer(
  audio: Buffer,
  options: { mimeType?: string; filename?: string; prompt?: string; language?: string } = {},
): Promise<TranscriptionResult> {
  if (audio.byteLength === 0) return { ok: false, reason: "语音文件为空" };
  if (audio.byteLength > MAX_AUDIO_BYTES) return { ok: false, reason: "语音文件超过 25MB" };
  const provider = await resolveTranscriptionProvider();
  if (!provider) return { ok: false, reason: "未配置语音转写" };

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)], { type: options.mimeType || "audio/ogg" }), options.filename || "audio.ogg");
  form.append("model", provider.model);
  form.append("response_format", "json");
  if (options.prompt) form.append("prompt", options.prompt);
  if (options.language) form.append("language", options.language);

  try {
    const response = await fetch(`${provider.baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { authorization: `Bearer ${provider.apiKey}` },
      body: form,
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(`[voice] transcription failed (${response.status}): ${detail.slice(0, 200)}`);
      return { ok: false, reason: `语音转写失败（${response.status}）` };
    }
    const data = (await response.json()) as { text?: string };
    const text = (data.text ?? "").trim();
    return text ? { ok: true, text } : { ok: false, reason: "没有识别出文字" };
  } catch (error: any) {
    console.warn("[voice] transcription error:", error?.message ?? error);
    return { ok: false, reason: "语音转写服务不可用" };
  }
}
