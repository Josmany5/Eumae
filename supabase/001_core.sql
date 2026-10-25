-- Eumae core database, sprint Day 1 (Oct 26, 2026).
-- Paste this whole file into Supabase -> SQL Editor -> Run. Safe to run twice.

create extension if not exists vector;

-- 1. Every thing you own: tasks, events, notes, goals, projects, chats, files...
create table if not exists public.items (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind       text not null,            -- 'task', 'event', 'note', 'goal', 'project', 'thread', ...
  id         text not null,            -- the app's own id for the item
  project_id text,                     -- which project owns it (null = none)
  data       jsonb not null,           -- the item itself, exactly as the app stores it
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,              -- soft delete, so Undo works across devices
  primary key (user_id, kind, id)
);
create index if not exists items_user_updated on public.items (user_id, updated_at);
create index if not exists items_project on public.items (user_id, project_id);

-- 2. History: every change to an item, kept forever (Undo, Logbook, learning).
create table if not exists public.item_history (
  seq        bigserial primary key,
  user_id    uuid not null,
  kind       text not null,
  id         text not null,
  op         text not null,            -- 'insert' | 'update' | 'delete'
  before     jsonb,
  after      jsonb,
  at         timestamptz not null default now()
);
create index if not exists item_history_item on public.item_history (user_id, kind, id, seq);

create or replace function public.log_item_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.item_history (user_id, kind, id, op, before, after)
  values (
    coalesce(new.user_id, old.user_id), coalesce(new.kind, old.kind), coalesce(new.id, old.id),
    lower(tg_op),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

drop trigger if exists items_history on public.items;
create trigger items_history after insert or update or delete on public.items
  for each row execute function public.log_item_change();

-- 3. Receipts: one row per action Eumae (or you) took, for the Dispatcher (Day 2).
create table if not exists public.receipts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  action     text not null,            -- e.g. 'create_task'
  actor      text not null,            -- 'user' | 'eumae' | 'app:<name>'
  status     text not null,            -- 'done' | 'failed' | 'needs_approval' | 'undone'
  input      jsonb,
  result     jsonb,
  fix        text,                     -- when it failed: how to fix it
  undo       jsonb,                    -- what reverses it
  at         timestamptz not null default now()
);
create index if not exists receipts_user_at on public.receipts (user_id, at desc);

-- 4. Memory: what Eumae knows about you, with where it came from (Day 3).
create table if not exists public.memories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  scope      text not null default 'you',   -- 'you' | 'app:<name>' | 'project:<id>'
  text       text not null,
  source     text,                           -- where it was learned
  confidence real not null default 0.7,
  embedding  vector(768),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  retired_at timestamptz                     -- rollback without losing it
);
create index if not exists memories_user_scope on public.memories (user_id, scope);
create index if not exists memories_fts on public.memories using gin (to_tsvector('simple', text));

-- 5. Signals: what you ignored, edited, undid or opened (learning, Day 5).
create table if not exists public.signals (
  seq        bigserial primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind       text not null,            -- 'ignored' | 'edited' | 'undone' | 'opened' | 'dismissed'
  target     text,                     -- what it was about
  data       jsonb,
  at         timestamptz not null default now()
);

-- Lock: each person sees and changes only their own rows.
alter table public.items        enable row level security;
alter table public.item_history enable row level security;
alter table public.receipts     enable row level security;
alter table public.memories     enable row level security;
alter table public.signals      enable row level security;

do $$
declare t text;
begin
  foreach t in array array['items','receipts','memories','signals'] loop
    execute format('drop policy if exists own_rows on public.%I', t);
    execute format('create policy own_rows on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
  drop policy if exists own_history on public.item_history;
  create policy own_history on public.item_history for select using (user_id = auth.uid());
end $$;

-- Live updates, so phone and laptop see the same thing at once.
do $$ begin
  alter publication supabase_realtime add table public.items;
exception when duplicate_object then null; end $$;
