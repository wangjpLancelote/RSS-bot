-- Feed intake + web monitor extensions

alter table public.feeds
  add column if not exists source_type text not null default 'rss',
  add column if not exists source_url text,
  add column if not exists resolved_feed_url text,
  add column if not exists extraction_mode text not null default 'partial_preferred',
  add column if not exists extraction_rule jsonb not null default '{}'::jsonb,
  add column if not exists transform_status text not null default 'none',
  add column if not exists transform_error text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'feeds_source_type_check'
  ) then
    alter table public.feeds
      add constraint feeds_source_type_check check (source_type in ('rss', 'web_monitor'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'feeds_extraction_mode_check'
  ) then
    alter table public.feeds
      add constraint feeds_extraction_mode_check check (extraction_mode in ('partial_preferred', 'full_page'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'feeds_transform_status_check'
  ) then
    alter table public.feeds
      add constraint feeds_transform_status_check check (transform_status in ('none', 'converted', 'failed'));
  end if;
end $$;

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

create or replace trigger set_feed_intake_jobs_updated_at
before update on public.feed_intake_jobs
for each row execute procedure public.set_updated_at();

alter table public.feed_intake_jobs
  add column if not exists title_hint text;
