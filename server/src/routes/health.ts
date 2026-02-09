import { Router } from "express";
import { checkSupabaseAuthHealth, checkSupabaseRestHealth } from "../services/supabase";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ ok: true, service: "rss-backend" });
});

router.get("/auth", async (_req, res) => {
  const [authResult, restResult] = await Promise.all([checkSupabaseAuthHealth(), checkSupabaseRestHealth()]);

  if (authResult.ok && restResult.ok) {
    return res.json({
      ok: true,
      status: "ok",
      supabaseAuthStatus: authResult.status,
      supabaseRestStatus: restResult.status
    });
  }

  return res.status(503).json({
    ok: false,
    status: "degraded",
    code: "AUTH_NETWORK_FAILURE",
    detail: authResult.error || restResult.error || "Supabase upstream health check failed",
    supabaseAuthStatus: authResult.status,
    supabaseRestStatus: restResult.status
  });
});

export default router;
