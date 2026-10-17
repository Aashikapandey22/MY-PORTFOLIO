create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null check (char_length(description) between 1 and 2000),
  technologies jsonb not null default '[]'::jsonb check (jsonb_typeof(technologies) = 'array'),
  image_url text,
  live_url text,
  github_url text,
  category text check (category is null or char_length(category) <= 60),
  featured boolean not null default false,
  published boolean not null default false,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) between 3 and 254),
  subject text check (subject is null or char_length(subject) <= 160),
  message text not null check (char_length(message) between 1 and 5000),
  status text not null default 'new' check (status in ('new', 'read', 'archived')),
  created_at timestamptz not null default now()
);

create index if not exists projects_public_order_idx on public.projects (published, featured desc, sort_order, created_at desc);
create index if not exists contact_messages_status_idx on public.contact_messages (status, created_at desc);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at before update on public.projects for each row execute function public.set_updated_at();

create or replace function public.is_admin() returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon;
grant execute on function public.is_admin() to authenticated;

alter table public.admin_users enable row level security;
alter table public.projects enable row level security;
alter table public.contact_messages enable row level security;

drop policy if exists "public reads published projects" on public.projects;
create policy "public reads published projects" on public.projects for select using (published = true or public.is_admin());
drop policy if exists "admins manage projects" on public.projects;
create policy "admins manage projects" on public.projects for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins read messages" on public.contact_messages;
create policy "admins read messages" on public.contact_messages for select using (public.is_admin());
drop policy if exists "admins update messages" on public.contact_messages;
create policy "admins update messages" on public.contact_messages for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins read admin users" on public.admin_users;
create policy "admins read admin users" on public.admin_users for select using (public.is_admin());
