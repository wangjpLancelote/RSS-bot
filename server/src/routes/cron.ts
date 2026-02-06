import { Router } from "express";
import { fetchAllFeeds } from "../services/rss";

const router = Router();

router.post("/refresh", async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = req.headers["x-cron-secret"];
    if (header !== secret) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  try {
    const limit = Number(req.query.limit || 20);
    const results = await fetchAllFeeds({ maxFeeds: limit });
    return res.json({ ok: true, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
});

export default router;
