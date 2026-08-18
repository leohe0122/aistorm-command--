import { getDb } from "./db";

export type BriefingRssItem = {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source: string;
};

export async function getComplianceRssDigest(limit = 5): Promise<BriefingRssItem[]> {
  try {
    const db = await getDb();
    if (!db) return [];
    const { rssSources } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const allSources = await db.select().from(rssSources).where(eq(rssSources.isActive, true));
    const sources = allSources.filter((source: any) => ((source.tags as string[]) || []).includes("合规政策"));
    if (sources.length === 0) return [];
    const fetch = (await import("node-fetch")).default;
    const { XMLParser } = await import("fast-xml-parser");
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
    const results: BriefingRssItem[] = [];
    for (const source of sources) {
      try {
        const response = await fetch(source.url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; AIStorm Daily Briefing)" }, signal: AbortSignal.timeout(6000) });
        if (!response.ok) continue;
        const parsed = parser.parse(await response.text());
        const rawItems = parsed?.rss?.channel?.item || parsed?.feed?.entry || [];
        const items = Array.isArray(rawItems) ? rawItems : [rawItems];
        items.slice(0, 4).forEach((item: any) => results.push({
          title: String(item.title || "").replace(/<[^>]+>/g, "").slice(0, 220),
          link: String(item.link?.["@_href"] || item.link || item.guid || ""),
          pubDate: String(item.pubDate || item.updated || item.published || ""),
          description: String(item.description || item.summary || "").replace(/<[^>]+>/g, "").slice(0, 260),
          source: source.name,
        }));
      } catch {
        // A failed public source must not block the operational briefing.
      }
    }
    return results.sort((a, b) => (new Date(b.pubDate).getTime() || 0) - (new Date(a.pubDate).getTime() || 0)).slice(0, limit);
  } catch {
    return [];
  }
}

export function buildDailyBriefingPrompt({ today, clientSummaries, rssDigest }: { today: string; clientSummaries: unknown; rssDigest: BriefingRssItem[] }) {
  const externalContext = rssDigest.length > 0
    ? JSON.stringify(rssDigest.map(item => ({ title: item.title, source: item.source, publishedAt: item.pubDate, description: item.description })), null, 2)
    : "暂无可用 RSS 外部情报；不要为此补造外部事件。";
  return `你是 AIStorm Command 的每日战情简报生成器。今天是${today}。

以下是客户作战系统的已入库事实：
${JSON.stringify(clientSummaries, null, 2)}

以下是外部 RSS 情报（仅供提示潜在的合规或市场关注点，不是客户已确认的事实）：
${externalContext}

请生成一份简洁的每日战情简报，格式如下：
1. 今日重点关注（1-2句话，指出最需要关注的客户和事项）
2. 各客户状态速览（每户1行，包含：客户名 | 阶段 | MEDDPICC均分 | 待办任务数 | 关键提示）
3. 外部情报观察（仅在上述 RSS 存在且确实相关时列出，必须标注“RSS 外部情报”，不得自动认定与某客户相关）
4. 今日建议行动（3条具体行动建议，指明负责角色 AD/SAM/SA；对于 RSS 仅能建议核验或调研，不能虚构客户意图）

要求：简洁专业、诚实处理数据不足，总字数不超过450字，使用中文。`;
}
