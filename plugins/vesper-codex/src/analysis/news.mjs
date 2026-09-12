const POSITIVE = ["beat", "growth", "profit", "upgrade", "record", "strong", "surge", "raised"];
const NEGATIVE = ["miss", "loss", "downgrade", "weak", "lawsuit", "investigation", "cut", "warning"];

export class NewsService {
  constructor({ fetchImpl = fetch } = {}) {
    this.fetchImpl = fetchImpl;
  }

  async search({ symbol = null, limit = 8 } = {}) {
    const query = symbol ? `${symbol} stock` : "global markets";
    const url = new URL("https://news.search.yahoo.com/rss");
    url.searchParams.set("p", query);
    const response = await this.fetchImpl(url, {
      headers: { "User-Agent": "Vesper-Codex/0.1" }
    });
    if (!response.ok) throw new Error(`News source returned HTTP ${response.status}`);
    const xml = await response.text();
    return parseRss(xml).slice(0, Math.min(Math.max(Number(limit) || 8, 1), 20)).map((item) => ({
      ...item,
      sentiment: classifySentiment(`${item.title} ${item.description}`),
      source: "Yahoo News RSS",
      disclaimer: "Headline sentiment is a coarse research signal, not investment advice."
    }));
  }
}

export function parseRss(xml) {
  const items = [...String(xml).matchAll(/<item>([\s\S]*?)<\/item>/gi)];
  return items.map((match) => {
    const body = match[1];
    return {
      title: decodeXml(tag(body, "title")),
      link: decodeXml(tag(body, "link")),
      publishedAt: decodeXml(tag(body, "pubDate")),
      description: stripHtml(decodeXml(tag(body, "description"))).slice(0, 400)
    };
  }).filter((item) => item.title && item.link);
}

export function classifySentiment(text) {
  const lower = String(text || "").toLowerCase();
  let score = 0;
  for (const word of POSITIVE) if (lower.includes(word)) score += 1;
  for (const word of NEGATIVE) if (lower.includes(word)) score -= 1;
  return {
    label: score > 0 ? "POSITIVE" : score < 0 ? "NEGATIVE" : "NEUTRAL",
    score: Math.max(-1, Math.min(1, score / 3))
  };
}

function tag(xml, name) {
  const match = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  return match?.[1] || "";
}

function stripHtml(value) {
  return String(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeXml(value) {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}
