import { Router } from "express";
import type { AuthedRequest } from "../types";
import { serviceClient } from "../services/supabase";

const router = Router();

router.get("/:id", async (req: AuthedRequest, res) => {
  const { data: item, error } = await serviceClient
    .from("feed_items")
    .select("*, feeds!inner(user_id)")
    .eq("id", req.params.id)
    .eq("feeds.user_id", req.user.id)
    .single();

  if (error) return res.status(404).json({ error: error.message });
  return res.json({ item });
});

export default router;
