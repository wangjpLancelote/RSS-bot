import Parser from "rss-parser";
import { serviceClient } from "./supabase";
import { DEFAULT_HEADERS } from "../utils/constants";

const parser: Parser = new Parser({
  customFields: {
    item: ["content:encoded", "content"]
  }
});

function normalizeGuid(item: Parser.Item): string {
  return (
    item.guid ||
    item.id ||
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
    author: (item as any).creator ?? item.author ?? null,
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
      await serviceClient
        .from("fetch_runs")
        .update({ finished_at: finished, status: "ok", items_added: 0 })
        .eq("id", run?.id || "");
      return { itemsAdded: 0 };
    }

    if (!response.ok) {
      throw new Error(`Fetch failed with status ${response.status}`);
    }

    const xml = await response.text();
    const parsed = await parser.parseString(xml);
    const items = (parsed.items || []).map((item) => toItemRow(feedId, item));

    let itemsToInsert = items;
    const incomingGuids = items.map((item) => item.guid);

    if (incomingGuids.length > 0) {
      const { data: existing } = await serviceClient
        .from("feed_items")
        .select("guid")
        .eq("feed_id", feedId)
        .in("guid", incomingGuids);

      const existingSet = new Set((existing || []).map((row) => row.guid));
      itemsToInsert = items.filter((item) => !existingSet.has(item.guid));
    }

    if (itemsToInsert.length > 0) {
      await serviceClient
        .from("feed_items")
        .upsert(itemsToInsert, { onConflict: "feed_id,guid" });
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

    await serviceClient
      .from("fetch_runs")
      .update({ finished_at: finished, status: "ok", items_added: itemsToInsert.length })
      .eq("id", run?.id || "");

    return { itemsAdded: itemsToInsert.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const finished = new Date().toISOString();
    await serviceClient
      .from("feeds")
      .update({ status: "error", last_error: message, updated_at: finished })
      .eq("id", feedId);
    await serviceClient
      .from("fetch_runs")
      .update({ finished_at: finished, status: "error", error: message })
      .eq("id", run?.id || "");
    throw err;
  }
}

export async function fetchAllFeeds(limit = 20) {
  const { data: feeds } = await serviceClient
    .from("feeds")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(limit);

  const results: { feedId: string; itemsAdded?: number; error?: string }[] = [];

  for (const feed of feeds || []) {
    try {
      const result = await fetchAndStoreFeed(feed.id as string);
      results.push({ feedId: feed.id as string, itemsAdded: result.itemsAdded });
    } catch (err) {
      results.push({
        feedId: feed.id as string,
        error: err instanceof Error ? err.message : "Unknown error"
      });
    }
  }

  return results;
}
