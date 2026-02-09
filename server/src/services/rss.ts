import Parser from "rss-parser";
import { serviceClient } from "./supabase";
import { DEFAULT_HEADERS } from "../utils/constants";

const parser: Parser = new Parser({
  customFields: {
    item: ["content:encoded", "content"]
  }
});

function normalizeGuid(item: Parser.Item): string {
  const itemId = (item as any).id as string | undefined;
  return (
    item.guid ||
    itemId ||
    item.link ||
    `${item.title || "item"}-${item.isoDate || item.pubDate || Date.now()}`
  );
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
  return {
    feed_id: feedId,
    guid: normalizeGuid(item),
    title: item.title ?? null,
    link: item.link ?? null,
    author: (item as any).creator ?? (item as any).author ?? null,
    content_html: contentEncoded ?? content ?? item.summary ?? null,
    content_text: item.contentSnippet ?? null,
    published_at: item.isoDate ? new Date(item.isoDate).toISOString() : null,
    fetched_at: new Date().toISOString()
  };
}

export async function fetchAndStoreFeed(feedId: string, userId?: string) {
  let feedQuery = serviceClient.from("feeds").select("*").eq("id", feedId);
  if (userId) {
    feedQuery = feedQuery.eq("user_id", userId);
  }

  const { data: feed, error } = await feedQuery.single();

  if (error || !feed) {
    throw new Error(error?.message || "Feed not found");
  }

  const now = new Date().toISOString();

  await serviceClient
    .from("feeds")
    .update({ status: "fetching", last_error: null, updated_at: now })
    .eq("id", feedId);

  const { data: run } = await serviceClient
    .from("fetch_runs")
    .insert({ feed_id: feedId, started_at: now, status: "ok", items_added: 0 })
    .select("id")
    .single();
  const runId = run?.id as string | undefined;

  try {
    const headers: Record<string, string> = { ...DEFAULT_HEADERS };
    if (feed.etag) headers["If-None-Match"] = feed.etag as string;
    if (feed.last_modified) headers["If-Modified-Since"] = feed.last_modified as string;

    const response = await fetch(feed.url as string, { headers, redirect: "follow" });
    if (response.status === 304) {
      const finished = new Date().toISOString();
      await serviceClient
        .from("feeds")
        .update({ status: "ok", last_fetched_at: finished, updated_at: finished })
        .eq("id", feedId);
      if (runId) {
        await serviceClient
          .from("fetch_runs")
          .update({ finished_at: finished, status: "ok", items_added: 0 })
          .eq("id", runId);
      }
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
      if (seenGuids.has(item.guid)) {
        return false;
      }
      seenGuids.add(item.guid);
      return true;
    });

    if (itemsToInsert.length > 0) {
      await serviceClient
        .from("feed_items")
        .upsert(itemsToInsert, { onConflict: "feed_id,guid", ignoreDuplicates: true });
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

    if (runId) {
      await serviceClient
        .from("fetch_runs")
        .update({ finished_at: finished, status: "ok", items_added: itemsToInsert.length })
        .eq("id", runId);
    }

    return { itemsAdded: itemsToInsert.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[rss] fetch_and_store_error", { feedId, userId: userId || null, error: message });
    const finished = new Date().toISOString();
    await serviceClient
      .from("feeds")
      .update({ status: "error", last_error: message, updated_at: finished })
      .eq("id", feedId);
    if (runId) {
      await serviceClient
        .from("fetch_runs")
        .update({ finished_at: finished, status: "error", error: message })
        .eq("id", runId);
    }
    throw err;
  }
}

export async function fetchAllFeeds({
  batchSize = 100,
  maxFeeds
}: {
  batchSize?: number;
  maxFeeds?: number;
} = {}) {
  const results: { feedId: string; itemsAdded?: number; error?: string }[] = [];
  let offset = 0;
  let processed = 0;

  while (true) {
    const remaining = typeof maxFeeds === "number" ? Math.max(maxFeeds - processed, 0) : null;
    const currentBatchSize = remaining === null ? batchSize : Math.min(batchSize, remaining);

    if (currentBatchSize === 0) {
      break;
    }

    const { data: feeds, error } = await serviceClient
      .from("feeds")
      .select("id")
      .order("created_at", { ascending: true })
      .range(offset, offset + currentBatchSize - 1);

    if (error) {
      console.error("[rss] fetch_all_query_error", { offset, currentBatchSize, error: error.message });
      throw new Error(error.message);
    }

    if (!feeds || feeds.length === 0) {
      break;
    }

    for (const feed of feeds) {
      const currentFeedId = String(feed.id);
      try {
        const result = await fetchAndStoreFeed(currentFeedId);
        results.push({ feedId: currentFeedId, itemsAdded: result.itemsAdded });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("[rss] fetch_all_feed_error", { feedId: currentFeedId, error: message });
        results.push({
          feedId: currentFeedId,
          error: message
        });
      }
    }

    processed += feeds.length;
    offset += feeds.length;

    if (typeof maxFeeds === "number" && processed >= maxFeeds) {
      break;
    }

    if (feeds.length < currentBatchSize) {
      break;
    }
  }

  return results;
}
