-- Add user ownership to feeds (auth-based)

alter table public.feeds
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists feeds_user_id_idx on public.feeds(user_id);

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_email_idx on public.users(email);

create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace trigger set_users_updated_at
before update on public.users
for each row execute procedure public.set_updated_at();
