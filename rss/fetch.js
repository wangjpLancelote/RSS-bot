import Parser from "rss-parser";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const parser = new Parser({
  customFields: {
    item: ["content:encoded", "content"]
  }
});

const DEFAULT_HEADERS = {
  "User-Agent": "RSS-Reader-MVP/0.1"
};

function normalizeGuid(item) {
  return (
    item.guid ||
    item.id ||
    item.link ||
    `${item.title || "item"}-${item.isoDate || item.pubDate || Date.now()}`
  );
}

function toItemRow(feedId, item) {
  const contentEncoded = item["content:encoded"];
  const content = item.content;
  return {
    feed_id: feedId,
    guid: normalizeGuid(item),
    title: item.title ?? null,
    link: item.link ?? null,
    author: item.creator ?? item.author ?? null,
    content_html: contentEncoded ?? content ?? item.summary ?? null,
    content_text: item.contentSnippet ?? null,
    published_at: item.isoDate ? new Date(item.isoDate).toISOString() : null,
    fetched_at: new Date().toISOString()
  };
}

async function fetchAndStoreFeed(feedId) {
  const { data: feed, error } = await supabase
    .from("feeds")
    .select("*")
    .eq("id", feedId)
    .single();

  if (error || !feed) {
    throw new Error(error?.message || "Feed not found");
  }

  const now = new Date().toISOString();

  await supabase
    .from("feeds")
    .update({ status: "fetching", last_error: null, updated_at: now })
    .eq("id", feedId);

  const { data: run } = await supabase
    .from("fetch_runs")
    .insert({ feed_id: feedId, started_at: now, status: "ok", items_added: 0 })
    .select("id")
    .single();

  try {
    const headers = { ...DEFAULT_HEADERS };
    if (feed.etag) headers["If-None-Match"] = feed.etag;
    if (feed.last_modified) headers["If-Modified-Since"] = feed.last_modified;

    const response = await fetch(feed.url, { headers, redirect: "follow" });
    if (response.status === 304) {
      const finished = new Date().toISOString();
      await supabase
        .from("feeds")
        .update({ status: "ok", last_fetched_at: finished, updated_at: finished })
        .eq("id", feedId);
      await supabase
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

    const uniqueMap = new Map();
    for (const item of items) {
      if (!uniqueMap.has(item.guid)) {
        uniqueMap.set(item.guid, item);
      }
    }

    const itemsToInsert = Array.from(uniqueMap.values());

    if (itemsToInsert.length > 0) {
      await supabase
        .from("feed_items")
        .upsert(itemsToInsert, { onConflict: "feed_id,guid", ignoreDuplicates: true });
    }

    const finished = new Date().toISOString();
    await supabase
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

    await supabase
      .from("fetch_runs")
      .update({ finished_at: finished, status: "ok", items_added: itemsToInsert.length })
      .eq("id", run?.id || "");

    return { itemsAdded: itemsToInsert.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const finished = new Date().toISOString();
    await supabase
      .from("feeds")
      .update({ status: "error", last_error: message, updated_at: finished })
      .eq("id", feedId);
    await supabase
      .from("fetch_runs")
      .update({ finished_at: finished, status: "error", error: message })
      .eq("id", run?.id || "");
    throw err;
  }
}

async function fetchAllFeeds() {
  const batchSize = Number(process.env.RSS_FETCH_BATCH_SIZE || 100);
  const maxFeeds = process.env.RSS_FETCH_LIMIT ? Number(process.env.RSS_FETCH_LIMIT) : undefined;

  let offset = 0;
  let processed = 0;
  const results = [];

  while (true) {
    const remaining = typeof maxFeeds === "number" ? Math.max(maxFeeds - processed, 0) : null;
    const currentBatchSize = remaining === null ? batchSize : Math.min(batchSize, remaining);

    if (currentBatchSize === 0) break;

    const { data: feeds, error } = await supabase
      .from("feeds")
      .select("id")
      .order("created_at", { ascending: true })
      .range(offset, offset + currentBatchSize - 1);

    if (error) {
      throw new Error(error.message);
    }

    if (!feeds || feeds.length === 0) break;

    for (const feed of feeds) {
      try {
        const result = await fetchAndStoreFeed(feed.id);
        results.push({ feedId: feed.id, itemsAdded: result.itemsAdded });
      } catch (err) {
        results.push({
          feedId: feed.id,
          error: err instanceof Error ? err.message : "Unknown error"
        });
      }
    }

    processed += feeds.length;
    offset += feeds.length;

    if (typeof maxFeeds === "number" && processed >= maxFeeds) break;
    if (feeds.length < currentBatchSize) break;
  }

  return results;
}

(async () => {
  try {
    const results = await fetchAllFeeds();
    const errors = results.filter((item) => item.error);

    console.log(JSON.stringify({ ok: errors.length === 0, results }, null, 2));

    if (errors.length > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
})();
