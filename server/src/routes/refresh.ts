import { Router } from "express";
import type { AuthedRequest } from "../types";
import { serviceClient } from "../services/supabase";
import { fetchAndStoreByType } from "../services/rss";

const router = Router();
function logError(event: string, meta: Record<string, unknown>) {
  console.error(`[refresh] ${event}`, meta);
}

function isNetworkFailure(message?: string | null) {
  const m = (message || "").toLowerCase();
  return m.includes("fetch failed") || m.includes("enotfound") || m.includes("econnrefused") || m.includes("timeout");
}

router.post("/", async (req: AuthedRequest, res) => {
  const limit = typeof req.body.limit === "number" ? req.body.limit : 20;

  const { data: feeds, error } = await serviceClient
    .from("feeds")
    .select("id,source_type")
    .eq("user_id", req.user.id)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    if (isNetworkFailure(error.message)) {
      return res.status(503).json({ error: "Supabase unavailable", detail: error.message, code: "SUPABASE_NETWORK_FAILURE" });
    }
    return res.status(500).json({ error: error.message, code: "SUPABASE_QUERY_FAILED" });
  }

  const results: { feedId: string; sourceType?: string; warning?: string | null; itemsAdded?: number; error?: string }[] = [];

  for (const feed of feeds || []) {
    try {
      const result = await fetchAndStoreByType(feed.id as string, req.user.id);
      results.push({
        feedId: feed.id as string,
        sourceType: (feed.source_type as string) || "rss",
        itemsAdded: result.itemsAdded,
        warning: (result as any).warning || null
      });
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
