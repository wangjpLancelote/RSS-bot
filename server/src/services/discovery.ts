import * as cheerio from "cheerio";
import { DEFAULT_HEADERS } from "../utils/constants";

function looksLikeFeed(contentType: string | null) {
  if (!contentType) return false;
  const lowered = contentType.toLowerCase();
  return (
    lowered.includes("application/rss") ||
    lowered.includes("application/atom") ||
    lowered.includes("xml")
  );
}

export async function discoverFeedUrl(inputUrl: string) {
  const response = await fetch(inputUrl, { redirect: "follow", headers: DEFAULT_HEADERS });
  const contentType = response.headers.get("content-type");

  if (looksLikeFeed(contentType)) {
    return {
      feedUrl: response.url,
      siteUrl: new URL(response.url).origin
    };
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const candidates: string[] = [];

  $("link[rel='alternate']").each((_, el) => {
    const type = $(el).attr("type");
    const href = $(el).attr("href");
    if (!href || !type) return;
    if (type.includes("rss") || type.includes("atom") || type.includes("xml")) {
      candidates.push(href);
    }
  });

  if (candidates.length === 0) {
    throw new Error("未发现可用的 RSS/Atom 链接");
  }

  const base = new URL(response.url);
  const feedUrl = new URL(candidates[0], base).toString();

  return {
    feedUrl,
    siteUrl: base.origin
  };
}
