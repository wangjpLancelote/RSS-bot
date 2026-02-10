import { Router } from "express";
import type { AuthedRequest } from "../types";
import { PipelineError } from "../services/langgraphPipeline";
import { enqueueFeedIntake, getFeedIntakeJob } from "../services/feedIntake";

const router = Router();

function isNetworkFailure(message?: string | null) {
  const m = (message || "").toLowerCase();
  return m.includes("fetch failed") || m.includes("enotfound") || m.includes("econnrefused") || m.includes("timeout");
}

router.post("/", async (req: AuthedRequest, res) => {
  try {
    const url = typeof req.body?.url === "string" ? req.body.url.trim() : "";
    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    if (!url) {
      return res.status(400).json({
        error: "URL is required",
        code: "INTAKE_DISCOVERY_FAILED"
      });
    }

    const job = await enqueueFeedIntake({
      userId: req.user.id,
      url,
      title: title || null
    });

    return res.status(202).json(job);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown intake error";
    const code = err instanceof PipelineError ? err.code : "INTAKE_CONVERSION_FAILED";
    if (isNetworkFailure(message)) {
      return res.status(503).json({
        error: "Upstream unavailable",
        detail: message,
        code: "UPSTREAM_NETWORK_FAILURE"
      });
    }
    return res.status(500).json({
      error: message,
      code
    });
  }
});

router.get("/:jobId", async (req: AuthedRequest, res) => {
  try {
    const job = await getFeedIntakeJob(req.user.id, req.params.jobId);
    if (!job) {
      return res.status(404).json({
        error: "Intake job not found",
        code: "INTAKE_JOB_NOT_FOUND"
      });
    }
    return res.json(job);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown intake error";
    const code = err instanceof PipelineError ? err.code : "INTAKE_CONVERSION_FAILED";
    return res.status(500).json({
      error: message,
      code
    });
  }
});

export default router;
