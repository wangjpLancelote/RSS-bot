export type FeedStatus = "idle" | "fetching" | "ok" | "error";
export type FeedSourceType = "rss" | "web_monitor";
export type FeedIntakeStage = "detecting" | "converting" | "validating" | "creating" | "done" | "failed";

export type FeedIntakeJob = {
  jobId: string;
  status: "pending" | "running" | "done" | "failed";
  stage: FeedIntakeStage;
  progress: number;
  result?: {
    feedId: string;
    sourceType: FeedSourceType;
    warning?: string | null;
  };
  error?: {
    code: string;
    message: string;
  };
};

export type Feed = {
  id: string;
  url: string;
  title: string | null;
  site_url: string | null;
  description: string | null;
  user_id?: string | null;
  status: FeedStatus;
  last_fetched_at: string | null;
  last_error: string | null;
  etag: string | null;
  last_modified: string | null;
  source_type?: FeedSourceType | null;
  source_url?: string | null;
  resolved_feed_url?: string | null;
  extraction_mode?: "partial_preferred" | "full_page" | null;
  extraction_rule?: Record<string, unknown> | null;
  transform_status?: "none" | "converted" | "failed" | null;
  transform_error?: string | null;
  created_at: string;
  updated_at: string;
};

export type FeedItem = {
  id: string;
  feed_id: string;
  guid: string;
  title: string | null;
  link: string | null;
  author: string | null;
  content_html: string | null;
  content_text: string | null;
  published_at: string | null;
  fetched_at: string;
};
