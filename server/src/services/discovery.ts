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

function hasFeedHint(value: string) {
  const lowered = value.toLowerCase();
  return (
    lowered.includes("rss") ||
    lowered.includes("atom") ||
    lowered.includes("feed") ||
    lowered.includes(".xml")
  );
}

function looksLikeFeedXmlSnippet(text: string) {
  const head = text.slice(0, 3000).toLowerCase();
  return (
    head.includes("<rss") ||
    head.includes("<feed") ||
    head.includes("<rdf:rdf") ||
    (head.includes("<?xml") && head.includes("<channel"))
  );
}

async function probeFeedUrl(candidateUrl: string) {
  try {
    const response = await fetch(candidateUrl, {
      redirect: "follow",
      headers: DEFAULT_HEADERS
    });
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type");
    if (looksLikeFeed(contentType)) {
      return response.url;
    }

    const body = await response.text();
    if (looksLikeFeedXmlSnippet(body)) {
      return response.url;
    }

    return null;
  } catch {
    return null;
  }
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
  const base = new URL(response.url);
  const candidateSet = new Set<string>();
  const pushCandidate = (href?: string | null) => {
    const raw = (href || "").trim();
    if (!raw) return;
    try {
      candidateSet.add(new URL(raw, base).toString());
    } catch {
      // Ignore invalid candidate URL.
    }
  };

  $("link[href]").each((_, el) => {
    const rel = ($(el).attr("rel") || "").toLowerCase();
    const type = $(el).attr("type");
    const href = $(el).attr("href");
    const relHasAlternate = rel.split(/\s+/).includes("alternate");
    const typeHasFeed = hasFeedHint(type || "");
    const hrefHasFeed = hasFeedHint(href || "");
    if ((relHasAlternate && (typeHasFeed || hrefHasFeed)) || typeHasFeed) {
      pushCandidate(href);
    }
  });

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    const text = $(el).text() || "";
    if (hasFeedHint(href || "") || hasFeedHint(text)) {
      pushCandidate(href);
    }
  });

  // Common feed endpoints used by many blogs/CMS.
  [
    "/feed",
    "/feed.xml",
    "/feeds",
    "/rss",
    "/rss.xml",
    "/atom.xml",
    "/index.xml"
  ].forEach((path) => {
    pushCandidate(path);
  });

  const candidates = Array.from(candidateSet).slice(0, 20);
  for (const candidate of candidates) {
    const discovered = await probeFeedUrl(candidate);
    if (discovered) {
      return {
        feedUrl: discovered,
        siteUrl: base.origin
      };
    }
  }

  if (candidates.length === 0) {
    throw new Error("未发现可用的 RSS/Atom 链接");
  }
  throw new Error("未发现可用的 RSS/Atom 链接");
}
