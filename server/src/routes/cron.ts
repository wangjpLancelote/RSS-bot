import { Router } from "express";
import { fetchAllFeeds } from "../services/rss";

const router = Router();
function logError(event: string, meta: Record<string, unknown>) {
  console.error(`[cron] ${event}`, meta);
}

function isNetworkFailure(message?: string | null) {
  const m = (message || "").toLowerCase();
  return m.includes("fetch failed") || m.includes("enotfound") || m.includes("econnrefused") || m.includes("timeout");
}

router.post("/refresh", async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = req.headers["x-cron-secret"];
    if (header !== secret) {
      logError("invalid_secret", { remote: req.ip });
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  try {
    const limit = Number(req.query.limit || 20);
    const results = await fetchAllFeeds({ maxFeeds: limit });
    return res.json({ ok: true, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logError("cron_refresh_error", {
      limit: req.query.limit,
      error: message
    });
    if (isNetworkFailure(message)) {
      return res.status(503).json({ error: "Upstream unavailable", detail: message, code: "UPSTREAM_NETWORK_FAILURE" });
    }
    return res.status(500).json({ error: message, code: "CRON_REFRESH_FAILED" });
  }
});

export default router;
