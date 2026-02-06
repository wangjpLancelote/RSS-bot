export type FeedStatus = "idle" | "fetching" | "ok" | "error";

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
