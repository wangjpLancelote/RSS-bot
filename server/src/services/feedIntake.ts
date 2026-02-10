import { serviceClient } from "./supabase";
import { discoverFeedUrl } from "./discovery";
import {
  PipelineError,
  candidateContentHash,
  runLangGraphConversion,
  type WebCandidate
} from "./langgraphPipeline";
import { fetchAndStoreByType } from "./rss";

type IntakeStatus = "pending" | "running" | "done" | "failed";
type IntakeStage = "detecting" | "converting" | "validating" | "creating" | "done" | "failed";
type FeedSourceType = "rss" | "web_monitor";

type FeedRow = {
  id: string;
  url: string;
  title: string | null;
  site_url: string | null;
  source_type: FeedSourceType;
};

const runningJobs = new Set<string>();

function nowIso() {
  return new Date().toISOString();
}

function errorCodeFor(message: string) {
  const m = message.toLowerCase();
  if (m.includes("fetch failed") || m.includes("timeout") || m.includes("econnrefused") || m.includes("enotfound")) {
    return "UPSTREAM_NETWORK_FAILURE";
  }
  return "INTAKE_CONVERSION_FAILED";
}

function isNetworkFailure(message: string) {
  const m = message.toLowerCase();
  return m.includes("fetch failed") || m.includes("timeout") || m.includes("econnrefused") || m.includes("enotfound");
}

async function updateJob(
  jobId: string,
  patch: Partial<{
    status: IntakeStatus;
    stage: IntakeStage;
    progress: number;
    warning: string | null;
    source_type: FeedSourceType | null;
    result_feed_id: string | null;
    error_code: string | null;
    error_message: string | null;
  }>
) {
  const updates = {
    ...patch,
    updated_at: nowIso()
  };

  await serviceClient.from("feed_intake_jobs").update(updates).eq("id", jobId);
}

async function failJob(jobId: string, code: string, message: string) {
  await updateJob(jobId, {
    status: "failed",
    stage: "failed",
    progress: 100,
    error_code: code,
    error_message: message
  });
}

function toFeedItems(feedId: string, candidates: WebCandidate[]) {
  const fetchedAt = nowIso();
  return candidates.map((candidate) => {
    const hash = candidateContentHash(candidate);
    return {
      feed_id: feedId,
      guid: `web:${candidate.key}:${hash.slice(0, 16)}`,
      title: candidate.title,
      link: candidate.link,
      author: null,
      content_html: candidate.contentHtml,
      content_text: candidate.contentMarkdown || candidate.contentText,
      published_at: candidate.publishedAt,
      fetched_at: fetchedAt
    };
  });
}

function toSnapshotRows(feedId: string, candidates: WebCandidate[]) {
  return candidates.map((candidate) => ({
    feed_id: feedId,
    candidate_key: candidate.key,
    content_hash: candidateContentHash(candidate),
    semantic_summary: candidate.contentText.slice(0, 1000),
    llm_decision: "new",
    created_at: nowIso()
  }));
}

async function logFeedEvent(action: "add" | "remove", feed: { id: string; url?: string | null; title?: string | null }, userId: string) {
  const { error } = await serviceClient.from("feed_events").insert({
    feed_id: feed.id,
    user_id: userId,
    action,
    feed_url: feed.url ?? null,
    feed_title: feed.title ?? null,
    created_at: nowIso()
  });

  if (error) {
    console.error("[feed-intake] feed_event_error", { action, feedId: feed.id, userId, error: error.message });
  }
}

async function createRssFeed({
  userId,
  inputUrl,
  titleHint
}: {
  userId: string;
  inputUrl: string;
  titleHint?: string | null;
}): Promise<{ feed: FeedRow; warning: string | null }> {
  let discovered: { feedUrl: string; siteUrl: string };
  try {
    discovered = await discoverFeedUrl(inputUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown discovery error";
    if (isNetworkFailure(message)) {
      throw new PipelineError("INTAKE_SOURCE_UNAVAILABLE", `链接不可访问: ${message}`);
    }
    throw new PipelineError("INTAKE_DISCOVERY_FAILED", message);
  }
  const now = nowIso();
  const payload = {
    url: discovered.feedUrl,
    title: titleHint?.trim() ? titleHint.trim() : null,
    site_url: discovered.siteUrl,
    status: "idle",
    created_at: now,
    updated_at: now,
    user_id: userId,
    source_type: "rss",
    source_url: inputUrl,
    resolved_feed_url: discovered.feedUrl,
    extraction_mode: "partial_preferred",
    extraction_rule: {},
    transform_status: "none",
    transform_error: null
  };

  const { data, error } = await serviceClient.from("feeds").insert(payload).select("*").single();
  if (!error && data) {
    return { feed: data as FeedRow, warning: null };
  }

  if (error?.code === "23505") {
    const { data: existing } = await serviceClient
      .from("feeds")
      .select("*")
      .eq("url", discovered.feedUrl)
      .or(`user_id.eq.${userId},user_id.is.null`)
      .maybeSingle();

    if (existing) {
      return {
        feed: existing as FeedRow,
        warning: "该订阅源已存在，已返回现有记录"
      };
    }

    throw new PipelineError("INTAKE_DISCOVERY_FAILED", "Feed already exists");
  }

  throw new PipelineError("INTAKE_DISCOVERY_FAILED", error?.message || "Failed to create RSS feed");
}

async function createWebMonitorFeed({
  userId,
  inputUrl,
  titleHint
}: {
  userId: string;
  inputUrl: string;
  titleHint?: string | null;
}): Promise<{ feed: FeedRow; warning: string | null }> {
  const conversion = await runLangGraphConversion(inputUrl);
  if (!conversion.candidates.length) {
    throw new PipelineError("INTAKE_VALIDATION_FAILED", "No candidates after conversion");
  }

  const now = nowIso();
  const feedPayload = {
    url: inputUrl,
    title: titleHint?.trim() ? titleHint.trim() : conversion.title,
    site_url: conversion.siteUrl,
    description: conversion.description,
    status: "ok",
    last_fetched_at: now,
    last_error: null,
    created_at: now,
    updated_at: now,
    user_id: userId,
    source_type: "web_monitor",
    source_url: inputUrl,
    resolved_feed_url: null,
    extraction_mode: conversion.extractionMode,
    extraction_rule: conversion.extractionRule,
    transform_status: "converted",
    transform_error: null
  };

  const { data: feed, error } = await serviceClient.from("feeds").insert(feedPayload).select("*").single();
  if (error) {
    if (error.code === "23505") {
      const { data: existing } = await serviceClient
        .from("feeds")
        .select("*")
        .eq("url", inputUrl)
        .or(`user_id.eq.${userId},user_id.is.null`)
        .maybeSingle();
      if (existing) {
        return {
          feed: existing as FeedRow,
          warning: "该网页监控源已存在，已返回现有记录"
        };
      }
    }
    throw new PipelineError("INTAKE_CONVERSION_FAILED", error.message);
  }

  const feedId = String(feed.id);
  const items = toFeedItems(feedId, conversion.candidates);
  if (items.length > 0) {
    await serviceClient.from("feed_items").upsert(items, { onConflict: "feed_id,guid", ignoreDuplicates: true });
  }

  const snapshots = toSnapshotRows(feedId, conversion.candidates);
  if (snapshots.length > 0) {
    await serviceClient
      .from("web_snapshots")
      .upsert(snapshots, { onConflict: "feed_id,candidate_key,content_hash", ignoreDuplicates: true });
  }

  const warning = conversion.warnings.length > 0 ? conversion.warnings.slice(0, 2).join("; ") : null;
  return { feed: feed as FeedRow, warning };
}

async function processFeedIntakeJob(jobId: string) {
  if (runningJobs.has(jobId)) return;
  runningJobs.add(jobId);

  try {
    const { data: job, error } = await serviceClient.from("feed_intake_jobs").select("*").eq("id", jobId).single();
    if (error || !job) {
      return;
    }

    const userId = String(job.user_id);
    const inputUrl = String(job.input_url || "").trim();
    const titleHint = typeof (job as any).title_hint === "string" ? String((job as any).title_hint) : null;

    if (!inputUrl) {
      await failJob(jobId, "INTAKE_DISCOVERY_FAILED", "Input URL is empty");
      return;
    }

    await updateJob(jobId, {
      status: "running",
      stage: "detecting",
      progress: 10,
      error_code: null,
      error_message: null
    });

    try {
      await updateJob(jobId, { stage: "creating", progress: 65 });
      const { feed, warning } = await createRssFeed({ userId, inputUrl, titleHint });
      await logFeedEvent("add", feed, userId);
      await updateJob(jobId, {
        status: "done",
        stage: "done",
        progress: 100,
        result_feed_id: feed.id,
        source_type: "rss",
        warning,
        error_code: null,
        error_message: null
      });
      // Initial refresh should not block intake completion.
      void fetchAndStoreByType(feed.id, userId).catch((err) => {
        const message = err instanceof Error ? err.message : "Unknown refresh error";
        console.error("[feed-intake] async_refresh_error", { feedId: feed.id, message });
      });
      return;
    } catch (err) {
      if (err instanceof PipelineError && err.code !== "INTAKE_DISCOVERY_FAILED") {
        throw err;
      }
      const message = err instanceof Error ? err.message : "RSS discovery failed";
      console.warn("[feed-intake] rss_discovery_fallback", { jobId, message });
    }

    await updateJob(jobId, { stage: "converting", progress: 35 });
    await updateJob(jobId, { stage: "validating", progress: 55 });
    await updateJob(jobId, { stage: "creating", progress: 75 });

    const { feed, warning } = await createWebMonitorFeed({ userId, inputUrl, titleHint });
    await logFeedEvent("add", feed, userId);
    await updateJob(jobId, {
      status: "done",
      stage: "done",
      progress: 100,
      result_feed_id: feed.id,
      source_type: "web_monitor",
      warning,
      error_code: null,
      error_message: null
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown feed intake error";
    const code = err instanceof PipelineError ? err.code : errorCodeFor(message);
    console.error("[feed-intake] job_failed", { jobId, code, message });
    await failJob(jobId, code, message);
  } finally {
    runningJobs.delete(jobId);
  }
}

export async function enqueueFeedIntake({
  userId,
  url,
  title
}: {
  userId: string;
  url: string;
  title?: string | null;
}) {
  const inputUrl = url.trim();
  if (!inputUrl) {
    throw new PipelineError("INTAKE_DISCOVERY_FAILED", "URL is required");
  }

  const now = nowIso();
  const { data, error } = await serviceClient
    .from("feed_intake_jobs")
    .insert({
      user_id: userId,
      input_url: inputUrl,
      title_hint: title?.trim() ? title.trim() : null,
      status: "pending",
      stage: "detecting",
      progress: 0,
      created_at: now,
      updated_at: now
    })
    .select("id,status")
    .single();

  if (error || !data) {
    throw new PipelineError("INTAKE_CONVERSION_FAILED", error?.message || "Failed to create intake job");
  }

  const jobId = String(data.id);
  setTimeout(() => {
    void processFeedIntakeJob(jobId);
  }, 0);

  return {
    jobId,
    status: String(data.status) as IntakeStatus
  };
}

export async function getFeedIntakeJob(userId: string, jobId: string) {
  const { data, error } = await serviceClient
    .from("feed_intake_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new PipelineError("SUPABASE_QUERY_FAILED", error.message);
  }

  if (!data) {
    return null;
  }

  return formatFeedIntakeJob(data);
}

export function formatFeedIntakeJob(data: Record<string, unknown>) {
  return {
    jobId: String(data.id),
    status: String(data.status),
    stage: String(data.stage),
    progress: Number(data.progress || 0),
    result:
      data.result_feed_id && data.source_type
        ? {
            feedId: String(data.result_feed_id),
            sourceType: String(data.source_type),
            warning: (data.warning as string) || null
          }
        : undefined,
    error:
      data.error_code || data.error_message
        ? {
            code: data.error_code || "INTAKE_CONVERSION_FAILED",
            message: data.error_message || "Unknown error"
          }
        : undefined
  };
}
