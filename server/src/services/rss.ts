import Parser from "rss-parser";
import * as cheerio from "cheerio";
import { serviceClient } from "./supabase";
import { DEFAULT_HEADERS } from "../utils/constants";
import {
  candidateContentHash,
  extractReadableContentFromUrl,
  extractCandidatesForRefresh,
  semanticDecideNovelty,
  type LlmDecision
} from "./langgraphPipeline";

const parser: Parser = new Parser({
  customFields: {
    item: ["content:encoded", "content"]
  }
});
const RSS_CONTENT_MIN_CHARS = Number(process.env.RSS_CONTENT_MIN_CHARS || 120);
const RSS_ENRICH_MAX_ITEMS = Number(process.env.RSS_ENRICH_MAX_ITEMS || 3);

type FeedSourceType = "rss" | "web_monitor";

type FeedRow = {
  id: string;
  url: string;
  title: string | null;
  site_url: string | null;
  description: string | null;
  status: string;
  last_fetched_at: string | null;
  last_error: string | null;
  etag: string | null;
  last_modified: string | null;
  source_type?: FeedSourceType | null;
  source_url?: string | null;
  extraction_mode?: "partial_preferred" | "full_page" | null;
  extraction_rule?: Record<string, unknown> | null;
};

function normalizeGuid(item: Parser.Item): string {
  const itemId = (item as any).id as string | undefined;
  return item.guid || itemId || item.link || `${item.title || "item"}-${item.isoDate || item.pubDate || Date.now()}`;
}

type FeedItemRow = {
  feed_id: string;
  guid: string;
  title: string | null;
  link: string | null;
  author: string | null;
  content_html: string | null;
  content_text: string | null;
  published_at: string | null;
  fetched_at: string;
};

function toItemRow(feedId: string, item: Parser.Item): FeedItemRow {
  const contentEncoded = (item as any)["content:encoded"] as string | undefined;
  const content = (item as any).content as string | undefined;
  const contentHtml = contentEncoded ?? content ?? item.summary ?? null;
  const snippet = item.contentSnippet ?? null;
  const textFromHtml = contentHtml ? cheerio.load(contentHtml).text().replace(/\s+/g, " ").trim() : "";
  const mergedText = (snippet || textFromHtml || "").trim();
  return {
    feed_id: feedId,
    guid: normalizeGuid(item),
    title: item.title ?? null,
    link: item.link ?? null,
    author: (item as any).creator ?? (item as any).author ?? null,
    content_html: contentHtml,
    content_text: mergedText || null,
    published_at: item.isoDate ? new Date(item.isoDate).toISOString() : null,
    fetched_at: new Date().toISOString()
  };
}

function itemBodyLength(item: Pick<FeedItemRow, "content_text" | "content_html">) {
  const textLen = (item.content_text || "").replace(/\s+/g, " ").trim().length;
  const htmlLen = item.content_html ? cheerio.load(item.content_html).text().replace(/\s+/g, " ").trim().length : 0;
  return Math.max(textLen, htmlLen);
}

async function enrichRssItemsBody(items: FeedItemRow[]) {
  if (!items.length || RSS_ENRICH_MAX_ITEMS <= 0) return;

  let used = 0;
  for (const item of items) {
    if (used >= RSS_ENRICH_MAX_ITEMS) break;
    if (!item.link) continue;
    if (itemBodyLength(item) >= RSS_CONTENT_MIN_CHARS) continue;

    used += 1;
    const detail = await extractReadableContentFromUrl(item.link).catch(() => null);
    if (!detail) continue;

    const detailText = (detail.contentMarkdown || detail.contentText || "").replace(/\s+/g, " ").trim();
    if (detailText.length < RSS_CONTENT_MIN_CHARS) continue;

    item.content_html = detail.contentHtml || item.content_html;
    item.content_text = detailText || item.content_text;
    item.title = item.title || detail.title;
  }
}

async function backfillExistingRssItems(feedId: string, items: FeedItemRow[]) {
  const weakItems = items.filter((item) => itemBodyLength(item) < RSS_CONTENT_MIN_CHARS).slice(0, RSS_ENRICH_MAX_ITEMS);
  if (!weakItems.length) return;

  await enrichRssItemsBody(weakItems);
  const updates = weakItems.filter((item) => itemBodyLength(item) >= RSS_CONTENT_MIN_CHARS);
  if (!updates.length) return;

  await Promise.all(
    updates.map((item) =>
      serviceClient
        .from("feed_items")
        .update({
          title: item.title,
          content_html: item.content_html,
          content_text: item.content_text
        })
        .eq("feed_id", feedId)
        .eq("guid", item.guid)
    )
  );
}

function normalizeCandidateKey(candidate: { key: string; link: string | null; title: string | null }) {
  return candidate.key || `${candidate.link || "no-link"}:${candidate.title || "no-title"}`;
}

async function loadFeedById(feedId: string, userId?: string) {
  let feedQuery = serviceClient.from("feeds").select("*").eq("id", feedId);
  if (userId) {
    feedQuery = feedQuery.or(`user_id.eq.${userId},user_id.is.null`);
  }

  const { data: feed, error } = await feedQuery.maybeSingle();
  if (error) throw new Error(error.message);
  if (!feed) throw new Error("Feed not found");
  return feed as FeedRow;
}

async function setFeedFetching(feedId: string) {
  const now = new Date().toISOString();
  await serviceClient
    .from("feeds")
    .update({ status: "fetching", last_error: null, updated_at: now })
    .eq("id", feedId);
  return now;
}

async function startFetchRun(feedId: string, startedAt: string) {
  const { data: run } = await serviceClient
    .from("fetch_runs")
    .insert({ feed_id: feedId, started_at: startedAt, status: "ok", items_added: 0 })
    .select("id")
    .single();
  return run?.id as string | undefined;
}

async function finishFetchRunOk(runId: string | undefined, finishedAt: string, itemsAdded: number) {
  if (!runId) return;
  await serviceClient
    .from("fetch_runs")
    .update({ finished_at: finishedAt, status: "ok", items_added: itemsAdded })
    .eq("id", runId);
}

async function finishFetchRunError(runId: string | undefined, finishedAt: string, error: string) {
  if (!runId) return;
  await serviceClient
    .from("fetch_runs")
    .update({ finished_at: finishedAt, status: "error", error })
    .eq("id", runId);
}

async function fetchAndStoreRssFeed(feed: FeedRow) {
  const feedId = feed.id;
  const startedAt = await setFeedFetching(feedId);
  const runId = await startFetchRun(feedId, startedAt);

  try {
    const headers: Record<string, string> = { ...DEFAULT_HEADERS };
    if (feed.etag) headers["If-None-Match"] = feed.etag;
    if (feed.last_modified) headers["If-Modified-Since"] = feed.last_modified;

    const response = await fetch(feed.url, { headers, redirect: "follow" });
    if (response.status === 304) {
      const finished = new Date().toISOString();
      await serviceClient
        .from("feeds")
        .update({ status: "ok", last_fetched_at: finished, last_error: null, updated_at: finished })
        .eq("id", feedId);
      await finishFetchRunOk(runId, finished, 0);
      return { itemsAdded: 0 };
    }

    if (!response.ok) {
      throw new Error(`Fetch failed with status ${response.status}`);
    }

    const xml = await response.text();
    const parsed = await parser.parseString(xml);
    const items = (parsed.items || []).map((item) => toItemRow(feedId, item));
    const seenGuids = new Set<string>();
    const itemsToInsert = items.filter((item) => {
      if (seenGuids.has(item.guid)) return false;
      seenGuids.add(item.guid);
      return true;
    });

    if (itemsToInsert.length > 0) {
      const guids = itemsToInsert.map((item) => item.guid);
      const { data: existingGuidRows } = await serviceClient
        .from("feed_items")
        .select("guid")
        .eq("feed_id", feedId)
        .in("guid", guids);
      const existingGuids = new Set((existingGuidRows || []).map((row) => String((row as any).guid)));
      const newItems = itemsToInsert.filter((item) => !existingGuids.has(item.guid));
      const existingItems = itemsToInsert.filter((item) => existingGuids.has(item.guid));
      await enrichRssItemsBody(newItems);
      await backfillExistingRssItems(feedId, existingItems);
      await serviceClient.from("feed_items").upsert(itemsToInsert, { onConflict: "feed_id,guid", ignoreDuplicates: true });
    }

    const finished = new Date().toISOString();
    await serviceClient
      .from("feeds")
      .update({
        title: parsed.title || feed.title,
        site_url: parsed.link || feed.site_url,
        description: parsed.description || feed.description,
        status: "ok",
        last_fetched_at: finished,
        last_error: null,
        etag: response.headers.get("etag") || feed.etag,
        last_modified: response.headers.get("last-modified") || feed.last_modified,
        updated_at: finished
      })
      .eq("id", feedId);

    await finishFetchRunOk(runId, finished, itemsToInsert.length);
    return { itemsAdded: itemsToInsert.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[rss] fetch_and_store_error", { feedId, error: message });
    const finished = new Date().toISOString();
    await serviceClient.from("feeds").update({ status: "error", last_error: message, updated_at: finished }).eq("id", feedId);
    await finishFetchRunError(runId, finished, message);
    throw err;
  }
}

async function fetchAndStoreWebMonitorFeed(feed: FeedRow) {
  const feedId = feed.id;
  const startedAt = await setFeedFetching(feedId);
  const runId = await startFetchRun(feedId, startedAt);

  try {
    const sourceUrl = feed.source_url || feed.url;
    const extractionMode = feed.extraction_mode === "full_page" ? "full_page" : "partial_preferred";
    const extractionRule = feed.extraction_rule || {};
    const { candidates, rendered } = await extractCandidatesForRefresh({
      url: sourceUrl,
      extractionMode,
      extractionRule: extractionRule as any
    });

    const { data: recentSnapshots } = await serviceClient
      .from("web_snapshots")
      .select("candidate_key,content_hash,semantic_summary")
      .eq("feed_id", feedId)
      .order("created_at", { ascending: false })
      .limit(80);

    const existing = recentSnapshots || [];
    const seenSnapshotKey = new Set(existing.map((item) => `${item.candidate_key}:${item.content_hash}`));
    const budget = { used: 0, max: 3 };
    const snapshotRows: any[] = [];
    const feedItems: FeedItemRow[] = [];
    const warnings: string[] = [...(rendered.warnings || [])];

    for (const candidate of candidates) {
      const candidateKey = normalizeCandidateKey(candidate);
      const contentHash = candidateContentHash(candidate);
      const snapshotIdentity = `${candidateKey}:${contentHash}`;
      if (seenSnapshotKey.has(snapshotIdentity)) {
        continue;
      }

      const sameKeyRecent = existing
        .filter((item) => item.candidate_key === candidateKey && item.content_hash !== contentHash)
        .map((item) => item.semantic_summary || "")
        .filter(Boolean)
        .slice(0, 3);

      const semantic = await semanticDecideNovelty({
        candidate,
        recentSummaries: sameKeyRecent,
        budget
      });

      if (semantic.budgetExceeded) {
        warnings.push("llm_budget_exceeded");
      }

      const decision: LlmDecision = semantic.decision;
      snapshotRows.push({
        feed_id: feedId,
        candidate_key: candidateKey,
        content_hash: contentHash,
        semantic_summary: semantic.summary,
        llm_decision: decision,
        created_at: new Date().toISOString()
      });

      if (decision === "new") {
        feedItems.push({
          feed_id: feedId,
          guid: `web:${candidateKey}:${contentHash.slice(0, 16)}`,
          title: candidate.title,
          link: candidate.link,
          author: null,
          content_html: candidate.contentHtml,
          content_text: candidate.contentMarkdown || candidate.contentText,
          published_at: candidate.publishedAt,
          fetched_at: new Date().toISOString()
        });
      }
    }

    if (snapshotRows.length > 0) {
      await serviceClient
        .from("web_snapshots")
        .upsert(snapshotRows, { onConflict: "feed_id,candidate_key,content_hash", ignoreDuplicates: true });
    }

    if (feedItems.length > 0) {
      await serviceClient.from("feed_items").upsert(feedItems, { onConflict: "feed_id,guid", ignoreDuplicates: true });
    }

    const finished = new Date().toISOString();
    await serviceClient
      .from("feeds")
      .update({
        title: feed.title || rendered.title,
        site_url: feed.site_url || new URL(rendered.url).origin,
        status: "ok",
        last_fetched_at: finished,
        last_error: null,
        updated_at: finished
      })
      .eq("id", feedId);

    await finishFetchRunOk(runId, finished, feedItems.length);

    return {
      itemsAdded: feedItems.length,
      warning: warnings.length > 0 ? warnings.slice(0, 2).join("; ") : null
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown web monitor error";
    console.error("[web-monitor] fetch_and_store_error", { feedId, error: message });
    const finished = new Date().toISOString();
    await serviceClient.from("feeds").update({ status: "error", last_error: message, updated_at: finished }).eq("id", feedId);
    await finishFetchRunError(runId, finished, message);
    throw err;
  }
}

export async function fetchAndStoreByType(feedId: string, userId?: string) {
  const feed = await loadFeedById(feedId, userId);
  const sourceType = (feed.source_type || "rss") as FeedSourceType;

  if (sourceType === "web_monitor") {
    return fetchAndStoreWebMonitorFeed(feed);
  }
  return fetchAndStoreRssFeed(feed);
}

// Backward-compatible name used by existing routes.
export async function fetchAndStoreFeed(feedId: string, userId?: string) {
  return fetchAndStoreByType(feedId, userId);
}

export async function fetchAndStoreWebMonitor(feedId: string, userId?: string) {
  const feed = await loadFeedById(feedId, userId);
  return fetchAndStoreWebMonitorFeed(feed);
}

export async function fetchAllFeeds({
  batchSize = 100,
  maxFeeds
}: {
  batchSize?: number;
  maxFeeds?: number;
} = {}) {
  const results: { feedId: string; sourceType: FeedSourceType; itemsAdded?: number; error?: string; warning?: string | null }[] = [];
  let offset = 0;
  let processed = 0;

  while (true) {
    const remaining = typeof maxFeeds === "number" ? Math.max(maxFeeds - processed, 0) : null;
    const currentBatchSize = remaining === null ? batchSize : Math.min(batchSize, remaining);
    if (currentBatchSize === 0) break;

    const { data: feeds, error } = await serviceClient
      .from("feeds")
      .select("id,source_type")
      .order("created_at", { ascending: true })
      .range(offset, offset + currentBatchSize - 1);

    if (error) {
      console.error("[rss] fetch_all_query_error", { offset, currentBatchSize, error: error.message });
      throw new Error(error.message);
    }

    if (!feeds || feeds.length === 0) break;

    for (const feed of feeds) {
      const currentFeedId = String(feed.id);
      const sourceType = (feed.source_type || "rss") as FeedSourceType;
      try {
        const result = await fetchAndStoreByType(currentFeedId);
        results.push({ feedId: currentFeedId, sourceType, itemsAdded: result.itemsAdded, warning: (result as any).warning || null });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("[rss] fetch_all_feed_error", { feedId: currentFeedId, sourceType, error: message });
        results.push({ feedId: currentFeedId, sourceType, error: message });
      }
    }

    processed += feeds.length;
    offset += feeds.length;

    if (typeof maxFeeds === "number" && processed >= maxFeeds) break;
    if (feeds.length < currentBatchSize) break;
  }

  return results;
}
