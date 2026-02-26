-- Schema for profile, external accounts, games catalog, user games, and counters view
-- Run this in Supabase SQL Editor or via supabase CLI.

-- 1) Enum for user game status
do $$ begin
  create type public.game_status as enum ('playing','completed','paused','dropped','wishlist');

-- 1b) Enable unaccent for username slugification (idempotent)
create extension if not exists unaccent;

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

-- 2b) Auto-create a profile row whenever a new auth user is created
create or replace function public.handle_new_user()
returns trigger as $$
declare
  base_name text;
  root_name text;
  candidate text;
  tries int := 0;
begin
  -- If profile already exists, nothing to do
  if exists (select 1 from public.profiles where id = new.id) then
    return new;
  end if;

  -- Pick a base username from metadata or email local-part
  base_name := coalesce(nullif(trim((new.raw_user_meta_data->>'username')::text), ''), split_part(new.email, '@', 1));
  if base_name is null or length(base_name) = 0 then
    base_name := substring(replace(new.id::text, '-', '') from 1 for 12);
  end if;
  -- Slugify to [a-z0-9_]: unaccent, non-alnum -> '_', collapse/trim '_', lower
  candidate := lower(regexp_replace(regexp_replace(unaccent(base_name), '[^a-zA-Z0-9]+', '_', 'g'), '_+', '_', 'g'));
  candidate := regexp_replace(candidate, '^_+|_+$', '', 'g');
  if candidate is null or length(candidate) = 0 then
    candidate := lower(substring(replace(new.id::text, '-', '') from 1 for 12));
  end if;
  root_name := candidate;

  -- Try to insert with a unique username, appending a short suffix on collision
  loop
    begin
      insert into public.profiles (id, username, display_name, avatar_url, is_public)
      values (
        new.id,
        candidate,
        nullif(trim((new.raw_user_meta_data->>'full_name')::text), ''),
        null,
        true
      );
      return new;
    exception when unique_violation then
      tries := tries + 1;
      if tries > 10 then
        candidate := root_name || '_' || substr(replace(new.id::text, '-', ''), 1, 6);
      else
        candidate := root_name || '_' || lpad((floor(random()*10000))::int::text, 4, '0');
      end if;
      -- loop and try again
    end;
  end loop;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 2c) Backfill profiles for any existing auth.users missing a profile (idempotent)


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

-- 3b) Steam integration tables (apps cache, ownership snapshots, achievement jobs)
do $$ begin
  create type public.steam_job_status as enum ('pending','processing','completed','failed');

-- 1b) Enable unaccent for username slugification (idempotent)
create extension if not exists unaccent;

create table if not exists public.steam_apps (
  appid bigint primary key,
  name text not null,
  header_image text,
  store_url text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.steam_user_games (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  steam_appid bigint not null references public.steam_apps(appid) on delete cascade,
  playtime_forever integer not null default 0,
  playtime_recent integer not null default 0,
  last_played timestamptz,
  imported_at timestamptz not null default now(),
  last_synced_at timestamptz not null default now(),
  achievements_unlocked integer not null default 0,
  achievements_total integer not null default 0,
  primary key (profile_id, steam_appid)
);

create index if not exists steam_user_games_profile_idx on public.steam_user_games(profile_id, last_synced_at desc);

create table if not exists public.steam_sync_runs (
  id bigserial primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  steamid text not null,
  game_count integer not null default 0,
  warning text,
  processed_at timestamptz not null default now()
);

create table if not exists public.steam_achievement_jobs (
  id bigserial primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  steam_appid bigint not null references public.steam_apps(appid) on delete cascade,
  priority smallint not null default 5,
  status public.steam_job_status not null default 'pending',
  playtime_forever integer not null default 0,
  last_played timestamptz,
  attempts smallint not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, steam_appid)
);

create index if not exists steam_achievement_jobs_status_idx on public.steam_achievement_jobs(status, priority);

drop trigger if exists tg_steam_achievement_jobs_updated_at on public.steam_achievement_jobs;
create trigger tg_steam_achievement_jobs_updated_at
before update on public.steam_achievement_jobs
for each row execute function public.tg_set_updated_at();

-- Steam accounts for status tracking
create table if not exists public.steam_accounts (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  steamid text not null,
  last_full_library_sync_at timestamptz,
  last_achievements_sync_at timestamptz,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists tg_steam_accounts_updated_at on public.steam_accounts;
create trigger tg_steam_accounts_updated_at
before update on public.steam_accounts
for each row execute function public.tg_set_updated_at();

-- Sync jobs (library/achievements) with progress
create table if not exists public.steam_sync_jobs (
  id bigserial primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  stage text not null check (stage in ('library','achievements')),
  status public.steam_job_status not null default 'pending',
  progress smallint not null default 0 check (progress between 0 and 100),
  detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists steam_sync_jobs_profile_idx on public.steam_sync_jobs(profile_id, created_at desc);
create index if not exists steam_sync_jobs_status_idx on public.steam_sync_jobs(status, stage);

drop trigger if exists tg_steam_sync_jobs_updated_at on public.steam_sync_jobs;
create trigger tg_steam_sync_jobs_updated_at
before update on public.steam_sync_jobs
for each row execute function public.tg_set_updated_at();

-- Achievements metadata and user unlocks
create table if not exists public.steam_game_achievements (
  id bigserial primary key,
  appid bigint not null references public.steam_apps(appid) on delete cascade,
  api_name text not null,
  display_name text,
  description text,
  icon text,
  icon_gray text,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(appid, api_name)
);

create index if not exists sga_app_idx on public.steam_game_achievements(appid);

drop trigger if exists tg_sga_updated_at on public.steam_game_achievements;
create trigger tg_sga_updated_at
before update on public.steam_game_achievements
for each row execute function public.tg_set_updated_at();

create table if not exists public.steam_user_achievements (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  appid bigint not null references public.steam_apps(appid) on delete cascade,
  api_name text not null,
  unlocked boolean not null default false,
  unlock_time timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(profile_id, appid, api_name)
);

create index if not exists sua_profile_app_idx on public.steam_user_achievements(profile_id, appid);

drop trigger if exists tg_sua_updated_at on public.steam_user_achievements;
create trigger tg_sua_updated_at
before update on public.steam_user_achievements
for each row execute function public.tg_set_updated_at();

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
alter table public.steam_apps enable row level security;
alter table public.steam_user_games enable row level security;
alter table public.steam_sync_runs enable row level security;
alter table public.steam_achievement_jobs enable row level security;
alter table public.steam_accounts enable row level security;
alter table public.steam_sync_jobs enable row level security;
alter table public.steam_game_achievements enable row level security;
alter table public.steam_user_achievements enable row level security;

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

-- Steam apps cache: readable by anyone; updates allowed for authenticated callers (edge functions)
drop policy if exists "steam_apps_select" on public.steam_apps;
create policy "steam_apps_select" on public.steam_apps for select using (true);

drop policy if exists "steam_apps_insert" on public.steam_apps;
create policy "steam_apps_insert" on public.steam_apps
for insert with check (auth.role() = 'authenticated');

drop policy if exists "steam_apps_update" on public.steam_apps;
create policy "steam_apps_update" on public.steam_apps
for update using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

-- Steam ownership snapshots: visible if owner or profile is public; write only owner
drop policy if exists "sug_select" on public.steam_user_games;
create policy "sug_select" on public.steam_user_games
for select using (
  steam_user_games.profile_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = steam_user_games.profile_id
      and p.is_public = true
  )
);

drop policy if exists "sug_insert" on public.steam_user_games;
create policy "sug_insert" on public.steam_user_games
for insert with check (profile_id = auth.uid());

drop policy if exists "sug_update" on public.steam_user_games;
create policy "sug_update" on public.steam_user_games
for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists "sug_delete" on public.steam_user_games;
create policy "sug_delete" on public.steam_user_games
for delete using (profile_id = auth.uid());

-- Steam sync runs: owner only
drop policy if exists "ssr_select" on public.steam_sync_runs;
create policy "ssr_select" on public.steam_sync_runs
for select using (profile_id = auth.uid());

drop policy if exists "ssr_insert" on public.steam_sync_runs;
create policy "ssr_insert" on public.steam_sync_runs
for insert with check (profile_id = auth.uid());

drop policy if exists "ssr_delete" on public.steam_sync_runs;
create policy "ssr_delete" on public.steam_sync_runs
for delete using (profile_id = auth.uid());

-- Steam achievement jobs: owner can inspect/retry; workers use service key
drop policy if exists "saj_select" on public.steam_achievement_jobs;
create policy "saj_select" on public.steam_achievement_jobs
for select using (profile_id = auth.uid());

drop policy if exists "saj_insert" on public.steam_achievement_jobs;
create policy "saj_insert" on public.steam_achievement_jobs
for insert with check (profile_id = auth.uid());

drop policy if exists "saj_update" on public.steam_achievement_jobs;
create policy "saj_update" on public.steam_achievement_jobs
for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists "saj_delete" on public.steam_achievement_jobs;
create policy "saj_delete" on public.steam_achievement_jobs
for delete using (profile_id = auth.uid());

-- Steam accounts: owner read/write
drop policy if exists "sacc_select" on public.steam_accounts;
create policy "sacc_select" on public.steam_accounts
for select using (profile_id = auth.uid());

drop policy if exists "sacc_insert" on public.steam_accounts;
create policy "sacc_insert" on public.steam_accounts
for insert with check (profile_id = auth.uid());

drop policy if exists "sacc_update" on public.steam_accounts;
create policy "sacc_update" on public.steam_accounts
for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Steam sync jobs: owner read/write
drop policy if exists "ssj_select" on public.steam_sync_jobs;
create policy "ssj_select" on public.steam_sync_jobs
for select using (profile_id = auth.uid());

drop policy if exists "ssj_insert" on public.steam_sync_jobs;
create policy "ssj_insert" on public.steam_sync_jobs
for insert with check (profile_id = auth.uid());

drop policy if exists "ssj_update" on public.steam_sync_jobs;
create policy "ssj_update" on public.steam_sync_jobs
for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Steam game achievements: public read; insert/update by authenticated only via edge function
drop policy if exists "sga_select" on public.steam_game_achievements;
create policy "sga_select" on public.steam_game_achievements for select using (true);

drop policy if exists "sga_insert" on public.steam_game_achievements;
create policy "sga_insert" on public.steam_game_achievements for insert with check (auth.role() = 'authenticated');

drop policy if exists "sga_update" on public.steam_game_achievements;
create policy "sga_update" on public.steam_game_achievements for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Steam user achievements: owner read/write; public read if profile is public
drop policy if exists "sua_select" on public.steam_user_achievements;
create policy "sua_select" on public.steam_user_achievements
for select using (
  profile_id = auth.uid() or exists (
    select 1 from public.profiles p where p.id = steam_user_achievements.profile_id and p.is_public = true
  )
);

drop policy if exists "sua_insert" on public.steam_user_achievements;
create policy "sua_insert" on public.steam_user_achievements
for insert with check (profile_id = auth.uid());

drop policy if exists "sua_update" on public.steam_user_achievements;
create policy "sua_update" on public.steam_user_achievements
for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

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


