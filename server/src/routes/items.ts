import { Router } from "express";
import type { AuthedRequest } from "../types";
import { serviceClient } from "../services/supabase";

const router = Router();

function isNetworkFailure(message?: string | null) {
  const m = (message || "").toLowerCase();
  return m.includes("fetch failed") || m.includes("enotfound") || m.includes("econnrefused") || m.includes("timeout");
}

router.get("/:id", async (req: AuthedRequest, res) => {
  const { data: item, error } = await serviceClient
    .from("feed_items")
    .select("*, feeds!inner(user_id)")
    .eq("id", req.params.id)
    .eq("feeds.user_id", req.user.id)
    .single();

  if (error) {
    if (isNetworkFailure(error.message)) {
      return res.status(503).json({ error: "Supabase unavailable", detail: error.message, code: "SUPABASE_NETWORK_FAILURE" });
    }
    return res.status(404).json({ error: error.message, code: "ITEM_NOT_FOUND" });
  }
  return res.json({ item });
});

export default router;
