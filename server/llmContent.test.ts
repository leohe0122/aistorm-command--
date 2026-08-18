import { describe, expect, it } from "vitest";
import { getLLMTextContent } from "./_core/llm";

describe("getLLMTextContent", () => {
  it("保留非空字符串正文并去除首尾空白", () => {
    expect(getLLMTextContent("  # 商机 Review  \n")).toBe("# 商机 Review");
  });

  it("从多模态文本分段中只拼接文本内容", () => {
    const content = [
      { type: "text", text: "第一段事实" },
      { type: "image_url", image_url: { url: "https://example.com/a.png" } },
      { type: "text", text: "第二段判断" },
    ] as any;
    expect(getLLMTextContent(content)).toBe("第一段事实\n第二段判断");
  });

  it("将 null、空白和非文本分段归一为空字符串，供调用方拒绝持久化", () => {
    expect(getLLMTextContent(null)).toBe("");
    expect(getLLMTextContent("   ")).toBe("");
    expect(getLLMTextContent([{ type: "image_url", image_url: { url: "https://example.com/a.png" } }] as any)).toBe("");
  });
});
