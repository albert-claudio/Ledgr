-- Add trophy counter to profile_counters view and auto-update
-- This optimizes trophy counting by pre-calculating and caching the total

-- 1) Add total_trophies column to profiles table for caching
alter table public.profiles add column if not exists total_trophies integer not null default 0;

-- 2) Function to calculate total trophies for a user
create or replace function public.calculate_user_trophies(user_id uuid)
returns integer as $$
declare
  trophy_count integer;
begin
  select coalesce(sum(achievements_unlocked), 0)::integer
  into trophy_count
  from public.steam_user_games
  where profile_id = user_id;
  
  return trophy_count;
end;
$$ language plpgsql security definer;

-- 3) Function to update trophy count when steam_user_games changes
create or replace function public.update_user_trophy_count()
returns trigger as $$
begin
  -- Handle INSERT and UPDATE
  if (TG_OP = 'INSERT' or TG_OP = 'UPDATE') then
    update public.profiles
    set total_trophies = public.calculate_user_trophies(NEW.profile_id)
    where id = NEW.profile_id;
    return NEW;
  end if;
  
  -- Handle DELETE
  if (TG_OP = 'DELETE') then
    update public.profiles
    set total_trophies = public.calculate_user_trophies(OLD.profile_id)
    where id = OLD.profile_id;
    return OLD;
  end if;
  
  return null;
end;
$$ language plpgsql security definer;

-- 4) Create trigger to auto-update trophy count
drop trigger if exists trigger_update_trophy_count on public.steam_user_games;
create trigger trigger_update_trophy_count
after insert or update of achievements_unlocked or delete on public.steam_user_games
for each row execute function public.update_user_trophy_count();

-- 5) Backfill trophy counts for existing users
update public.profiles
set total_trophies = public.calculate_user_trophies(id)
where exists (
  select 1 from public.steam_user_games
  where steam_user_games.profile_id = profiles.id
);

-- 6) Update profile_counters view to include trophies
create or replace view public.profile_counters as
select
  p.id as profile_id,
  count(ug.id) filter (where ug.id is not null)              as total_games,
  count(ug.id) filter (where ug.status = 'playing')          as playing_count,
  count(ug.id) filter (where ug.status = 'completed')        as completed_count,
  count(ug.id) filter (where ug.status = 'wishlist')         as wishlist_count,
  sum(ug.minutes_played)::bigint                              as total_minutes_played,
  max(ug.last_session_at)                                     as last_activity,
  p.total_trophies                                            as total_trophies
from public.profiles p
left join public.user_games ug on ug.profile_id = p.id
group by p.id;

-- Index for performance
create index if not exists idx_profiles_total_trophies on public.profiles(total_trophies desc);
