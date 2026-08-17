import { describe, expect, it } from "vitest";
import { extractTextFromBuffer } from "./docExtract";

describe("extractTextFromBuffer", () => {
  it("extracts UTF-8 Markdown so system-created knowledge notes remain AI-readable", async () => {
    const content = "# AI Pentest\n\n## 客户价值\n自动化验证攻击路径。";
    const extracted = await extractTextFromBuffer(Buffer.from(content, "utf8"), "text/markdown", "ai-pentest.md");

    expect(extracted).toBe(content);
  });

  it("extracts plain text files uploaded in a batch", async () => {
    const content = "ThreatTrace 适用网络流量检测与响应场景。";
    const extracted = await extractTextFromBuffer(Buffer.from(content, "utf8"), "text/plain", "threattrace.txt");

    expect(extracted).toBe(content);
  });
});
