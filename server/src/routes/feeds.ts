import { Router } from "express";
import type { AuthedRequest } from "../types";
import { serviceClient } from "../services/supabase";
import { discoverFeedUrl } from "../services/discovery";
import { fetchAndStoreFeed } from "../services/rss";

const router = Router();
function logError(event: string, meta: Record<string, unknown>) {
  console.error(`[feeds] ${event}`, meta);
}

router.get("/", async (req: AuthedRequest, res) => {
  const { data, error } = await serviceClient
    .from("feeds")
    .select("*")
    .eq("user_id", req.user.id)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ feeds: data || [] });
});

router.get("/:id", async (req: AuthedRequest, res) => {
  const { data, error } = await serviceClient
    .from("feeds")
    .select("*")
    .eq("id", req.params.id)
    .eq("user_id", req.user.id)
    .single();

  if (error) return res.status(404).json({ error: error.message });
  return res.json({ feed: data });
});

router.get("/:id/items", async (req: AuthedRequest, res) => {
  const { data: feed } = await serviceClient
    .from("feeds")
    .select("id")
    .eq("id", req.params.id)
    .eq("user_id", req.user.id)
    .single();

  if (!feed) {
    return res.status(404).json({ error: "Feed not found" });
  }

  const { data, error } = await serviceClient
    .from("feed_items")
    .select("*")
    .eq("feed_id", req.params.id)
    .order("published_at", { ascending: false, nullsFirst: false });

  if (error) return res.status(500).json({ error: error.message });
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
      return res.status(500).json({ error: error.message });
    }

    if (autoFetch) {
      await fetchAndStoreFeed(data.id as string, req.user.id);
    }

    return res.json({ feed: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logError("create_feed_error", {
      userId: req.user.id,
      inputUrl: req.body?.url,
      error: message
    });
    return res.status(500).json({ error: message });
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
    return res.status(500).json({ error: error.message });
  }
  return res.json({ feed: data });
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  const { data: feed } = await serviceClient
    .from("feeds")
    .select("id")
    .eq("id", req.params.id)
    .eq("user_id", req.user.id)
    .single();

  if (!feed) {
    return res.status(404).json({ error: "Feed not found" });
  }

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
    return res.status(500).json({ error: itemsError.message });
  }

  const { error } = await serviceClient.from("feeds").delete().eq("id", req.params.id);
  if (error) {
    logError("delete_feed_error", {
      userId: req.user.id,
      feedId: req.params.id,
      error: error.message
    });
    return res.status(500).json({ error: error.message });
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
    return res.status(500).json({ error: message });
  }
});

export default router;
