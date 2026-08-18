import { describe, expect, it } from "vitest";
import { buildDailyBriefingPrompt } from "./dailyBriefingRss";

describe("每日简报 RSS 情报边界", () => {
  it("明确标注 RSS 是外部待核验情报，并禁止将其虚构为客户事实", () => {
    const prompt = buildDailyBriefingPrompt({
      today: "2026年8月18日",
      clientSummaries: [{ name: "香港电讯", stage: "进入商机" }],
      rssDigest: [{ title: "一则政策更新", source: "监管源", pubDate: "2026-08-18", description: "政策内容", link: "https://example.com" }],
    });
    expect(prompt).toContain("不是客户已确认的事实");
    expect(prompt).toContain("不得自动认定与某客户相关");
    expect(prompt).toContain("不能虚构客户意图");
    expect(prompt).toContain("一则政策更新");
  });

  it("当 RSS 暂不可用时要求简报如实省略外部情报，而非补造事件", () => {
    const prompt = buildDailyBriefingPrompt({ today: "2026年8月18日", clientSummaries: [], rssDigest: [] });
    expect(prompt).toContain("暂无可用 RSS 外部情报");
    expect(prompt).toContain("不要为此补造外部事件");
  });
});
