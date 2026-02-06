import { Router } from "express";
import type { AuthedRequest } from "../types";
import { serviceClient } from "../services/supabase";
import { fetchAndStoreFeed } from "../services/rss";

const router = Router();
function logError(event: string, meta: Record<string, unknown>) {
  console.error(`[refresh] ${event}`, meta);
}

router.post("/", async (req: AuthedRequest, res) => {
  const limit = typeof req.body.limit === "number" ? req.body.limit : 20;

  const { data: feeds } = await serviceClient
    .from("feeds")
    .select("id")
    .eq("user_id", req.user.id)
    .order("created_at", { ascending: true })
    .limit(limit);

  const results: { feedId: string; itemsAdded?: number; error?: string }[] = [];

  for (const feed of feeds || []) {
    try {
      const result = await fetchAndStoreFeed(feed.id as string, req.user.id);
      results.push({ feedId: feed.id as string, itemsAdded: result.itemsAdded });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      logError("refresh_feed_error", {
        userId: req.user.id,
        feedId: feed.id,
        error: message
      });
      results.push({
        feedId: feed.id as string,
        error: message
      });
    }
  }

  return res.json({ ok: true, results });
});

export default router;
