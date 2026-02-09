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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feeds_status_check check (status in ('idle', 'fetching', 'ok', 'error'))
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

create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace trigger set_feeds_updated_at
before update on public.feeds
for each row execute procedure public.set_updated_at();
