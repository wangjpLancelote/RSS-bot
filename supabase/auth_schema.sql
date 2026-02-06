-- Add user ownership to feeds (auth-based)

alter table public.feeds
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists feeds_user_id_idx on public.feeds(user_id);
