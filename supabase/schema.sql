create extension if not exists "uuid-ossp";

create table if not exists public.feeds (
  id uuid primary key default uuid_generate_v4(),
  url text not null unique,
  title text,
  site_url text,
  description text,
  status text not null default 'idle',
  last_fetched_at timestamptz,
  last_error text,
  etag text,
  last_modified text,
  source_type text not null default 'rss',
  source_url text,
  resolved_feed_url text,
  extraction_mode text not null default 'partial_preferred',
  extraction_rule jsonb not null default '{}'::jsonb,
  transform_status text not null default 'none',
  transform_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feeds_status_check check (status in ('idle', 'fetching', 'ok', 'error')),
  constraint feeds_source_type_check check (source_type in ('rss', 'web_monitor')),
  constraint feeds_extraction_mode_check check (extraction_mode in ('partial_preferred', 'full_page')),
  constraint feeds_transform_status_check check (transform_status in ('none', 'converted', 'failed'))
);

create table if not exists public.feed_items (
  id uuid primary key default uuid_generate_v4(),
  feed_id uuid not null references public.feeds(id) on delete cascade,
  guid text not null,
  title text,
  link text,
  author text,
  content_html text,
  content_text text,
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  unique (feed_id, guid)
);

create index if not exists feed_items_feed_id_idx on public.feed_items(feed_id);
create index if not exists feed_items_published_at_idx on public.feed_items(published_at desc);

create table if not exists public.fetch_runs (
  id uuid primary key default uuid_generate_v4(),
  feed_id uuid not null references public.feeds(id) on delete cascade,
  started_at timestamptz not null,
  finished_at timestamptz,
  status text not null default 'ok',
  error text,
  items_added integer not null default 0,
  constraint fetch_runs_status_check check (status in ('ok', 'error'))
);

create table if not exists public.feed_events (
  id uuid primary key default uuid_generate_v4(),
  feed_id uuid references public.feeds(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  feed_url text,
  feed_title text,
  created_at timestamptz not null default now(),
  constraint feed_events_action_check check (action in ('add', 'remove'))
);

create index if not exists feed_events_feed_id_idx on public.feed_events(feed_id);
create index if not exists feed_events_user_id_idx on public.feed_events(user_id);
create index if not exists feed_events_created_at_idx on public.feed_events(created_at desc);

create table if not exists public.feed_intake_jobs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  input_url text not null,
  title_hint text,
  status text not null default 'pending',
  stage text not null default 'detecting',
  progress integer not null default 0,
  result_feed_id uuid references public.feeds(id) on delete set null,
  source_type text,
  warning text,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feed_intake_jobs_status_check check (status in ('pending', 'running', 'done', 'failed')),
  constraint feed_intake_jobs_progress_check check (progress >= 0 and progress <= 100),
  constraint feed_intake_jobs_source_type_check check (source_type is null or source_type in ('rss', 'web_monitor'))
);

create index if not exists feed_intake_jobs_user_id_idx on public.feed_intake_jobs(user_id);
create index if not exists feed_intake_jobs_created_at_idx on public.feed_intake_jobs(created_at desc);

create table if not exists public.web_snapshots (
  id uuid primary key default uuid_generate_v4(),
  feed_id uuid not null references public.feeds(id) on delete cascade,
  candidate_key text not null,
  content_hash text not null,
  semantic_summary text,
  llm_decision text not null,
  created_at timestamptz not null default now(),
  constraint web_snapshots_llm_decision_check check (llm_decision in ('new', 'minor_update', 'noise')),
  unique (feed_id, candidate_key, content_hash)
);

create index if not exists web_snapshots_feed_id_idx on public.web_snapshots(feed_id);
create index if not exists web_snapshots_created_at_idx on public.web_snapshots(created_at desc);

create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace trigger set_feeds_updated_at
before update on public.feeds
for each row execute procedure public.set_updated_at();

create or replace trigger set_feed_intake_jobs_updated_at
before update on public.feed_intake_jobs
for each row execute procedure public.set_updated_at();
