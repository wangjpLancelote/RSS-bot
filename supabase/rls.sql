-- Enable RLS and allow anonymous access for MVP (single-user, non-auth)
-- NOTE: This is permissive. For production, replace with authenticated policies.

alter table public.feeds enable row level security;
alter table public.feed_items enable row level security;
alter table public.fetch_runs enable row level security;

create policy "anon_read_feeds" on public.feeds
  for select
  to anon
  using (true);

create policy "anon_write_feeds" on public.feeds
  for all
  to anon
  using (true)
  with check (true);

create policy "anon_read_items" on public.feed_items
  for select
  to anon
  using (true);

create policy "anon_write_items" on public.feed_items
  for all
  to anon
  using (true)
  with check (true);

create policy "anon_read_runs" on public.fetch_runs
  for select
  to anon
  using (true);

create policy "anon_write_runs" on public.fetch_runs
  for all
  to anon
  using (true)
  with check (true);
