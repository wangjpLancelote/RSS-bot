-- RLS policies for authenticated users

alter table public.feeds enable row level security;
alter table public.feed_items enable row level security;
alter table public.fetch_runs enable row level security;
alter table public.feed_events enable row level security;
alter table public.users enable row level security;
alter table public.feed_intake_jobs enable row level security;
alter table public.web_snapshots enable row level security;

create policy "user_read_feeds" on public.feeds
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "user_write_feeds" on public.feeds
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "user_read_items" on public.feed_items
  for select
  to authenticated
  using (
    exists (
      select 1 from public.feeds f
      where f.id = feed_items.feed_id
        and f.user_id = auth.uid()
    )
  );

create policy "user_write_items" on public.feed_items
  for all
  to authenticated
  using (
    exists (
      select 1 from public.feeds f
      where f.id = feed_items.feed_id
        and f.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.feeds f
      where f.id = feed_items.feed_id
        and f.user_id = auth.uid()
    )
  );

create policy "user_read_runs" on public.fetch_runs
  for select
  to authenticated
  using (
    exists (
      select 1 from public.feeds f
      where f.id = fetch_runs.feed_id
        and f.user_id = auth.uid()
    )
  );

create policy "user_write_runs" on public.fetch_runs
  for all
  to authenticated
  using (
    exists (
      select 1 from public.feeds f
      where f.id = fetch_runs.feed_id
        and f.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.feeds f
      where f.id = fetch_runs.feed_id
        and f.user_id = auth.uid()
    )
  );

create policy "user_read_events" on public.feed_events
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "user_write_events" on public.feed_events
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "user_read_intake_jobs" on public.feed_intake_jobs
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "user_write_intake_jobs" on public.feed_intake_jobs
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "user_read_web_snapshots" on public.web_snapshots
  for select
  to authenticated
  using (
    exists (
      select 1 from public.feeds f
      where f.id = web_snapshots.feed_id
        and f.user_id = auth.uid()
    )
  );

create policy "user_write_web_snapshots" on public.web_snapshots
  for all
  to authenticated
  using (
    exists (
      select 1 from public.feeds f
      where f.id = web_snapshots.feed_id
        and f.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.feeds f
      where f.id = web_snapshots.feed_id
        and f.user_id = auth.uid()
    )
  );

create policy "user_read_profile" on public.users
  for select
  to authenticated
  using (id = auth.uid());

create policy "user_write_profile" on public.users
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "user_insert_profile" on public.users
  for insert
  to authenticated
  with check (id = auth.uid());
