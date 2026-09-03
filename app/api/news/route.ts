import { successResponse, errorResponse } from "@/lib/apiResponse";

export type NewsItem = {
  title: string;
  link: string;
  pubDate: string;
  image: string | null;
};

// Public national news RSS - not editorial content JARIS produces, just a
// live headline feed for the landing page. No auth/PII involved.
const FEED_URL = "https://www.cnnindonesia.com/nasional/rss";

function decodeEntities(text: string) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'");
}

function extractTag(block: string, tag: string): string | null {
  const cdataMatch = block.match(new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, "i"));
  if (cdataMatch) return decodeEntities(cdataMatch[1].trim());
  const plainMatch = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  if (plainMatch) return decodeEntities(plainMatch[1].trim());
  return null;
}

function parseRssItems(xml: string, limit: number): NewsItem[] {
  const items: NewsItem[] = [];
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];

  for (const block of itemBlocks.slice(0, limit)) {
    const title = extractTag(block, "title");
    const link = extractTag(block, "link");
    const pubDate = extractTag(block, "pubDate");
    if (!title || !link) continue;

    const enclosureMatch = block.match(/<enclosure[^>]*url="([^"]+)"/i);
    const imgInDescMatch = block.match(/<img[^>]*src="([^"]+)"/i);
    const image = enclosureMatch?.[1] ?? imgInDescMatch?.[1] ?? null;

    items.push({ title, link, pubDate: pubDate ?? "", image });
  }

  return items;
}

export async function GET() {
  try {
    const res = await fetch(FEED_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; JARIS-Landing/1.0)" },
      // Refresh every 10 minutes - a live feed, but no need to hit the
      // upstream source on every landing page view.
      next: { revalidate: 600 },
    });

    if (!res.ok) {
      return errorResponse("Sumber berita sedang tidak tersedia", 502);
    }

    const xml = await res.text();
    const items = parseRssItems(xml, 6);

    return successResponse(items, "Berita terkini");
  } catch {
    return errorResponse("Tidak dapat mengambil berita terkini", 502);
  }
}
