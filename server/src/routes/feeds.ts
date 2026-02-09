import { Router, type Response } from "express";
import type { AuthedRequest } from "../types";
import { serviceClient } from "../services/supabase";
import { discoverFeedUrl } from "../services/discovery";
import { fetchAndStoreFeed } from "../services/rss";

const router = Router();
function logError(event: string, meta: Record<string, unknown>) {
  console.error(`[feeds] ${event}`, meta);
}

function isNetworkFailure(message?: string | null) {
  const m = (message || "").toLowerCase();
  return m.includes("fetch failed") || m.includes("enotfound") || m.includes("econnrefused") || m.includes("timeout");
}

function respondSupabaseError(res: Response, message: string, notFoundAs404 = false) {
  if (isNetworkFailure(message)) {
    return res.status(503).json({
      error: "Supabase unavailable",
      detail: message,
      code: "SUPABASE_NETWORK_FAILURE"
    });
  }
  if (notFoundAs404) {
    return res.status(404).json({ error: message, code: "SUPABASE_NOT_FOUND" });
  }
  return res.status(500).json({ error: message, code: "SUPABASE_QUERY_FAILED" });
}

async function logFeedEvent(action: "add" | "remove", feed: { id: string; url?: string | null; title?: string | null }, userId: string) {
  const { error } = await serviceClient.from("feed_events").insert({
    feed_id: feed.id,
    user_id: userId,
    action,
    feed_url: feed.url ?? null,
    feed_title: feed.title ?? null,
    created_at: new Date().toISOString()
  });

  if (error) {
    logError("feed_event_error", { action, feedId: feed.id, userId, error: error.message });
  }
}

router.get("/", async (req: AuthedRequest, res) => {
  const { data, error } = await serviceClient
    .from("feeds")
    .select("*")
    // Return both:
    // 1) feeds owned by the current user
    // 2) legacy/default feeds inserted before auth mode (user_id is null)
    .or(`user_id.eq.${req.user.id},user_id.is.null`)
    .order("created_at", { ascending: false });

  if (error) return respondSupabaseError(res, error.message);
  return res.json({ feeds: data || [] });
});

router.get("/:id", async (req: AuthedRequest, res) => {
  const { data, error } = await serviceClient
    .from("feeds")
    .select("*")
    .eq("id", req.params.id)
    .or(`user_id.eq.${req.user.id},user_id.is.null`)
    .single();

  if (error) return respondSupabaseError(res, error.message, true);
  return res.json({ feed: data });
});

router.get("/:id/items", async (req: AuthedRequest, res) => {
  const { data: feed } = await serviceClient
    .from("feeds")
    .select("id")
    .eq("id", req.params.id)
    .or(`user_id.eq.${req.user.id},user_id.is.null`)
    .single();

  if (!feed) {
    return res.status(404).json({ error: "Feed not found" });
  }

  const { data, error } = await serviceClient
    .from("feed_items")
    .select("*")
    .eq("feed_id", req.params.id)
    .order("published_at", { ascending: false, nullsFirst: false });

  if (error) return respondSupabaseError(res, error.message);
  return res.json({ items: data || [] });
});

router.post("/", async (req: AuthedRequest, res) => {
  try {
    const url = typeof req.body.url === "string" ? req.body.url.trim() : "";
    const autoFetch = req.body.autoFetch !== false;

    if (!url) {
      return res.status(400).json({ error: "缺少 RSS 链接" });
    }

    const { feedUrl, siteUrl } = await discoverFeedUrl(url);
    const now = new Date().toISOString();

    const { data, error } = await serviceClient
      .from("feeds")
      .insert({
        url: feedUrl,
        site_url: siteUrl,
        status: "idle",
        created_at: now,
        updated_at: now,
        user_id: req.user.id
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        return res.status(409).json({ error: "该订阅源已存在" });
      }
      logError("create_feed_db_error", {
        userId: req.user.id,
        url: feedUrl,
        error: error.message
      });
      return respondSupabaseError(res, error.message);
    }

    if (autoFetch) {
      await fetchAndStoreFeed(data.id as string, req.user.id);
    }

    await logFeedEvent("add", data, req.user.id);

    return res.json({ feed: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logError("create_feed_error", {
      userId: req.user.id,
      inputUrl: req.body?.url,
      error: message
    });
    if (isNetworkFailure(message)) {
      return res.status(503).json({ error: "Upstream unavailable", detail: message, code: "UPSTREAM_NETWORK_FAILURE" });
    }
    return res.status(500).json({ error: message, code: "FEED_CREATE_FAILED" });
  }
});

router.patch("/:id", async (req: AuthedRequest, res) => {
  const updates: Record<string, string | null> = {};

  if (typeof req.body.title === "string") {
    const nextTitle = req.body.title.trim();
    updates.title = nextTitle || null;
  }

  if (typeof req.body.url === "string") {
    const nextUrl = req.body.url.trim();
    if (!nextUrl) {
      return res.status(400).json({ error: "URL 不能为空" });
    }
    updates.url = nextUrl;
    updates.etag = null;
    updates.last_modified = null;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "没有可更新字段" });
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await serviceClient
    .from("feeds")
    .update(updates)
    .eq("id", req.params.id)
    .eq("user_id", req.user.id)
    .select("*")
    .single();

  if (error) {
    logError("update_feed_error", {
      userId: req.user.id,
      feedId: req.params.id,
      error: error.message
    });
    return respondSupabaseError(res, error.message);
  }
  return res.json({ feed: data });
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  const { data: feed } = await serviceClient
    .from("feeds")
    .select("id,url,title")
    .eq("id", req.params.id)
    .eq("user_id", req.user.id)
    .single();

  if (!feed) {
    return res.status(404).json({ error: "Feed not found" });
  }

  await logFeedEvent("remove", feed, req.user.id);

  const { error: itemsError } = await serviceClient
    .from("feed_items")
    .delete()
    .eq("feed_id", req.params.id);

  if (itemsError) {
    logError("delete_feed_items_error", {
      userId: req.user.id,
      feedId: req.params.id,
      error: itemsError.message
    });
    return respondSupabaseError(res, itemsError.message);
  }

  const { error } = await serviceClient.from("feeds").delete().eq("id", req.params.id);
  if (error) {
    logError("delete_feed_error", {
      userId: req.user.id,
      feedId: req.params.id,
      error: error.message
    });
    return respondSupabaseError(res, error.message);
  }
  return res.json({ ok: true });
});

router.post("/:id/refresh", async (req: AuthedRequest, res) => {
  try {
    const result = await fetchAndStoreFeed(req.params.id, req.user.id);
    return res.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logError("refresh_feed_error", {
      userId: req.user.id,
      feedId: req.params.id,
      error: message
    });
    if (isNetworkFailure(message)) {
      return res.status(503).json({ error: "Upstream unavailable", detail: message, code: "UPSTREAM_NETWORK_FAILURE" });
    }
    return res.status(500).json({ error: message, code: "FEED_REFRESH_FAILED" });
  }
});

export default router;
