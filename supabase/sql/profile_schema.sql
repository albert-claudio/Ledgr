-- Schema for profile, external accounts, games catalog, user games, and counters view
-- Run this in Supabase SQL Editor or via supabase CLI.

-- 1) Enum for user game status
do $$ begin
  create type public.game_status as enum ('playing','completed','paused','dropped','wishlist');
exception when duplicate_object then null; end $$;

-- 2) Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text,
  avatar_url text,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.tg_set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end; $$ language plpgsql;

drop trigger if exists tg_profiles_updated_at on public.profiles;
create trigger tg_profiles_updated_at
before update on public.profiles
for each row execute function public.tg_set_updated_at();

-- 3) External accounts (Steam, PSN, Xbox)
create table if not exists public.external_accounts (
  id bigserial primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('steam','psn','xbox')),
  external_id text not null,
  display_name text,
  created_at timestamptz not null default now(),
  unique (profile_id, provider),
  unique (provider, external_id)
);

-- 4) Minimal games catalog (by IGDB)
create table if not exists public.games (
  id bigserial primary key,
  igdb_id bigint not null unique,
  name text not null,
  slug text,
  cover_image_id text, -- IGDB image_id for cover (e.g., co1wvr)
  created_at timestamptz not null default now()
);

-- 5) User to game relationship
create table if not exists public.user_games (
  id bigserial primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  game_id bigint not null references public.games(id) on delete cascade,
  status public.game_status not null default 'playing',
  is_favorite boolean not null default false,
  minutes_played integer not null default 0,
  sessions_count integer not null default 0,
  last_session_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, game_id)
);

drop trigger if exists tg_user_games_updated_at on public.user_games;
create trigger tg_user_games_updated_at
before update on public.user_games
for each row execute function public.tg_set_updated_at();

-- 6) View with counters per profile
create or replace view public.profile_counters as
select
  p.id as profile_id,
  count(ug.id) filter (where ug.id is not null)              as total_games,
  count(ug.id) filter (where ug.status = 'playing')          as playing_count,
  count(ug.id) filter (where ug.status = 'completed')        as completed_count,
  count(ug.id) filter (where ug.status = 'wishlist')         as wishlist_count,
  sum(ug.minutes_played)::bigint                              as total_minutes_played,
  max(ug.last_session_at)                                     as last_activity
from public.profiles p
left join public.user_games ug on ug.profile_id = p.id
group by p.id;

-- 7) Storage bucket for avatars (public read)
insert into storage.buckets (id, name, public)
select 'avatars','avatars', true
where not exists (select 1 from storage.buckets where id = 'avatars');

-- 8) RLS
alter table public.profiles enable row level security;
alter table public.external_accounts enable row level security;
alter table public.games enable row level security;
alter table public.user_games enable row level security;

-- Profiles: public read if is_public, or owner; write only owner
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
for select using (is_public = true or auth.uid() = id);

drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert" on public.profiles
for insert with check (auth.uid() = id);

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
for update using (auth.uid() = id) with check (auth.uid() = id);

-- External accounts: visible if profile is public or owner; write only owner
drop policy if exists "ext_select" on public.external_accounts;
create policy "ext_select" on public.external_accounts
for select using (
  exists (
    select 1 from public.profiles p
    where p.id = external_accounts.profile_id
      and (p.is_public = true or p.id = auth.uid())
  )
);

drop policy if exists "ext_ins" on public.external_accounts;
create policy "ext_ins" on public.external_accounts
for insert with check (profile_id = auth.uid());

drop policy if exists "ext_upd" on public.external_accounts;
create policy "ext_upd" on public.external_accounts
for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists "ext_del" on public.external_accounts;
create policy "ext_del" on public.external_accounts
for delete using (profile_id = auth.uid());

-- Games catalog: readable by anyone; insert allowed for authenticated; no update/delete
drop policy if exists "games_select" on public.games;
create policy "games_select" on public.games for select using (true);

drop policy if exists "games_insert" on public.games;
  create policy "games_insert" on public.games for insert with check (auth.role() = 'authenticated');

-- 8.1) Allow upsert (update) on games for authenticated users (supports ON CONFLICT DO UPDATE)
drop policy if exists "games_update" on public.games;
create policy "games_update" on public.games
for update using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

-- User games: visible if profile is public or owner; write only owner
drop policy if exists "ug_select" on public.user_games;
  create policy "ug_select" on public.user_games
  for select using (
    -- Owner can always see their own rows, OR anyone can see rows of public profiles
    user_games.profile_id = auth.uid()
    OR exists (
      select 1 from public.profiles p
      where p.id = user_games.profile_id
        and p.is_public = true
    )
  );

drop policy if exists "ug_insert" on public.user_games;
create policy "ug_insert" on public.user_games
for insert with check (profile_id = auth.uid());

drop policy if exists "ug_update" on public.user_games;
create policy "ug_update" on public.user_games
for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists "ug_delete" on public.user_games;
  create policy "ug_delete" on public.user_games
  for delete using (profile_id = auth.uid());

-- 9) Custom shelves (user-defined collections)
create table if not exists public.user_collections (
  id bigserial primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique(profile_id, name)
);

create table if not exists public.user_collection_games (
  id bigserial primary key,
  collection_id bigint not null references public.user_collections(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  game_id bigint not null references public.games(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(collection_id, game_id)
);

alter table public.user_collections enable row level security;
alter table public.user_collection_games enable row level security;

-- User collections: owner read/write; public read if profile is public
drop policy if exists "uc_select" on public.user_collections;
create policy "uc_select" on public.user_collections
for select using (
  profile_id = auth.uid() or exists (
    select 1 from public.profiles p where p.id = user_collections.profile_id and p.is_public = true
  )
);

drop policy if exists "uc_insert" on public.user_collections;
create policy "uc_insert" on public.user_collections
for insert with check (profile_id = auth.uid());

drop policy if exists "uc_update" on public.user_collections;
create policy "uc_update" on public.user_collections
for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists "uc_delete" on public.user_collections;
create policy "uc_delete" on public.user_collections
for delete using (profile_id = auth.uid());

-- Collection games: owner read/write; public read if profile is public
drop policy if exists "ucg_select" on public.user_collection_games;
create policy "ucg_select" on public.user_collection_games
for select using (
  profile_id = auth.uid() or exists (
    select 1 from public.profiles p where p.id = user_collection_games.profile_id and p.is_public = true
  )
);

drop policy if exists "ucg_insert" on public.user_collection_games;
create policy "ucg_insert" on public.user_collection_games
for insert with check (profile_id = auth.uid());

drop policy if exists "ucg_delete" on public.user_collection_games;
create policy "ucg_delete" on public.user_collection_games
for delete using (profile_id = auth.uid());

-- Storage RLS for avatars bucket
-- Public read
drop policy if exists "Public read avatars" on storage.objects;
create policy "Public read avatars"
on storage.objects for select
using (bucket_id = 'avatars');

-- Owner write to own folder: objects.name starts with their uid
drop policy if exists "Avatar owner write" on storage.objects;
create policy "Avatar owner write"
on storage.objects for insert
with check (
  bucket_id = 'avatars' and
  auth.role() = 'authenticated' and
  (position((auth.uid())::text || '/' in name) = 1)
);

drop policy if exists "Avatar owner update" on storage.objects;
create policy "Avatar owner update"
on storage.objects for update using (
  bucket_id = 'avatars' and (position((auth.uid())::text || '/' in name) = 1)
) with check (
  bucket_id = 'avatars' and (position((auth.uid())::text || '/' in name) = 1)
);

drop policy if exists "Avatar owner delete" on storage.objects;
create policy "Avatar owner delete"
on storage.objects for delete using (
  bucket_id = 'avatars' and (position((auth.uid())::text || '/' in name) = 1)
);

-- 10) Comments feature: user comments per IGDB game + likes
create table if not exists public.comments (
  id bigserial primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  game_igdb_id bigint not null,
  text text not null check (char_length(text) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists comments_game_idx on public.comments(game_igdb_id, created_at desc);
create index if not exists comments_profile_idx on public.comments(profile_id);

create table if not exists public.comment_likes (
  comment_id bigint not null references public.comments(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, profile_id)
);

alter table public.comments enable row level security;
alter table public.comment_likes enable row level security;

-- Comments: public read; insert/update/delete only owner
drop policy if exists "comments_select" on public.comments;
create policy "comments_select" on public.comments for select using (true);

drop policy if exists "comments_insert" on public.comments;
create policy "comments_insert" on public.comments for insert with check (profile_id = auth.uid());

drop policy if exists "comments_update" on public.comments;
create policy "comments_update" on public.comments for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists "comments_delete" on public.comments;
create policy "comments_delete" on public.comments for delete using (profile_id = auth.uid());

-- Likes: public read; insert/delete only owner
drop policy if exists "comment_likes_select" on public.comment_likes;
create policy "comment_likes_select" on public.comment_likes for select using (true);

drop policy if exists "comment_likes_insert" on public.comment_likes;
create policy "comment_likes_insert" on public.comment_likes for insert with check (profile_id = auth.uid());

drop policy if exists "comment_likes_delete" on public.comment_likes;
create policy "comment_likes_delete" on public.comment_likes for delete using (profile_id = auth.uid());

-- 11) Follows (social graph: follower -> following)
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id)
);

alter table public.follows enable row level security;

-- Allow public reads for simple counts and public profiles; writes only by follower
drop policy if exists "follows_select" on public.follows;
create policy "follows_select" on public.follows for select using (true);

drop policy if exists "follows_insert" on public.follows;
create policy "follows_insert" on public.follows for insert with check (follower_id = auth.uid());

drop policy if exists "follows_delete" on public.follows;
create policy "follows_delete" on public.follows for delete using (follower_id = auth.uid());

create index if not exists follows_following_idx on public.follows(following_id);
create index if not exists follows_follower_idx on public.follows(follower_id);
-- Enable realtime replication for follows table (safe if already added)
do $$ begin
  perform 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'follows';
  if not found then
    execute 'alter publication supabase_realtime add table public.follows';
  end if;
exception when others then null; end $$;

-- 12) User ratings per IGDB game (1..5)
create table if not exists public.user_ratings (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  game_igdb_id bigint not null,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, game_igdb_id)
);

alter table public.user_ratings enable row level security;

drop policy if exists "ur_select" on public.user_ratings;
create policy "ur_select" on public.user_ratings for select using (true);

drop policy if exists "ur_insert" on public.user_ratings;
create policy "ur_insert" on public.user_ratings for insert with check (profile_id = auth.uid());

drop policy if exists "ur_update" on public.user_ratings;
create policy "ur_update" on public.user_ratings for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create index if not exists user_ratings_game_idx on public.user_ratings(game_igdb_id);
