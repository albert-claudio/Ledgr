import { supabase } from '@/lib/supabase';
// Use legacy API for readAsStringAsync to avoid SDK 54 deprecation warnings
import * as FileSystem from 'expo-file-system/legacy';
import { __private__ as IGDB } from './igdb';

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_public: boolean;
  total_trophies: number;
  created_at: string;
  updated_at: string;
};

export type ProfileCounters = {
  profile_id: string;
  total_games: number;
  playing_count: number;
  completed_count: number;
  wishlist_count: number;
  total_minutes_played: number | null;
  last_activity: string | null;
  total_trophies: number;
};

export type GameRow = {
  id: number;
  igdb_id: number;
  name: string;
  slug: string | null;
  cover_image_id: string | null;
};

export type UserGameRow = {
  id: number;
  profile_id: string;
  game_id: number;
  status: 'playing' | 'completed' | 'paused' | 'dropped' | 'wishlist';
  is_favorite: boolean;
  minutes_played: number;
  sessions_count: number;
  last_session_at: string | null;
  created_at: string;
  updated_at: string;
};

export type UserCollection = {
  id: number;
  profile_id: string;
  name: string;
  created_at: string;
};

export type UserCollectionGame = {
  id: number;
  collection_id: number;
  profile_id: string;
  game_id: number;
  created_at: string;
};

export async function getMyProfileWithCounters(userId: string) {
  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single<Profile>();
  if (pErr) throw pErr;
  const { data: counters } = await supabase
    .from('profile_counters')
    .select('*')
    .eq('profile_id', userId)
    .single<ProfileCounters>();
  return { profile, counters: counters || null };
}

export type UserGameWithCatalog = UserGameRow & { game: GameRow };
// === Steam PC filter helpers ===
// Filters a batch of IGDB IDs to only those available on PC (Windows) with a Steam store page.
async function filterToSteamPcIgdbIds(ids: number[]): Promise<Set<number>> {
  const uniq = Array.from(new Set((ids || []).filter((x) => Number.isFinite(x)) as number[]));
  if (!uniq.length) return new Set();
  const PC_PLATFORM_ID = 6; // PC (Microsoft Windows)
  const fields = 'fields id;';
  const where = `where id = (${uniq.join(',')}) & platforms = (${PC_PLATFORM_ID}) & websites.url ~ *"store.steampowered.com/app/"*;`;
  try {
    const rows = await IGDB.igdbRequest<{ id: number }[]>(`${fields} ${where} limit ${uniq.length};`);
    return new Set((rows || []).map((r) => r.id));
  } catch {
    return new Set();
  }
}

export async function getUserGamesByStatus(
  userId: string, 
  status: UserGameRow['status'], 
  limit?: number,
  lastWeeks?: number // Novo: filtrar por últimas N semanas
) {
  // Using a join: select user_games.*, games(*) as game
  let q = supabase
    .from('user_games')
    .select('*, game:games(*)')
    .eq('profile_id', userId)
    .eq('status', status);
  
  // Se lastWeeks especificado, filtra por data e ordena por mais jogado
  if (lastWeeks) {
    const weeksAgo = new Date();
    weeksAgo.setDate(weeksAgo.getDate() - (lastWeeks * 7));
    q = q
      .gte('last_session_at', weeksAgo.toISOString())
      .order('minutes_played', { ascending: false });
  } else {
    // Comportamento padrão: ordena por sessão mais recente
    q = q.order('last_session_at', { ascending: false, nullsFirst: false });
  }
  
  if (limit) q.limit(limit);
  const { data, error } = await q;
  if (error) throw error;
  let rows = (data as any[]) || [];
  // Fallback: if nested game is missing for any row, fetch games and attach
  const needsLookup = rows.some(r => !r.game && r.game_id);
  if (needsLookup) {
    const ids = Array.from(new Set(rows.map(r => r.game_id).filter(Boolean)));
    if (ids.length) {
      const { data: games } = await supabase.from('games').select('*').in('id', ids as number[]);
      const map = new Map((games || []).map(g => [g.id, g] as const));
      for (const r of rows) {
        if (!r.game) r.game = map.get(r.game_id) || null;
      }
    }
  }
  // Filter out non‑Steam/console games based on IGDB
  try {
    const igdbIds = rows.map((r) => r?.game?.igdb_id).filter((x: any) => Number.isFinite(x)) as number[];
    const allow = await filterToSteamPcIgdbIds(igdbIds);
    if (allow && allow.size > 0) {
      rows = rows.filter((r) => allow.has(r?.game?.igdb_id));
    }
  } catch {}
  return rows as unknown as UserGameWithCatalog[];
}

export async function upsertGameFromIGDB(igdb: { igdb_id: number; name: string; slug?: string | null; cover_image_id?: string | null; }) {
  const payload = {
    igdb_id: igdb.igdb_id,
    name: igdb.name,
    slug: igdb.slug ?? null,
    cover_image_id: igdb.cover_image_id ?? null,
  };
  const { data, error } = await supabase
    .from('games')
    .upsert(payload, { onConflict: 'igdb_id' })
    .select()
    .single<GameRow>();
  if (error) throw error;
  return data;
}

export async function addUserGame(userId: string, gameId: number, status: UserGameRow['status'] = 'playing') {
  const { data, error } = await supabase
    .from('user_games')
    .upsert({ profile_id: userId, game_id: gameId, status }, { onConflict: 'profile_id,game_id' })
    .select()
    .single<UserGameRow>();
  if (error) throw error;
  return data;
}

export async function removeUserGameById(userId: string, userGameId: number) {
  const { error } = await supabase
    .from('user_games')
    .delete()
    .eq('id', userGameId)
    .eq('profile_id', userId);
  if (error) throw error;
}

export async function removeUserGame(userId: string, gameId: number) {
  const { error } = await supabase
    .from('user_games')
    .delete()
    .eq('profile_id', userId)
    .eq('game_id', gameId);
  if (error) throw error;
}

export function igdbCoverUrl(imageId?: string | null, size: 't_cover_big' | 't_1080p' = 't_cover_big') {
  if (!imageId) return null;
  return `https://images.igdb.com/igdb/image/upload/${size}/${imageId}.jpg`;
}

export function extractIgdbImageIdFromUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const m = url.match(/\/([a-z0-9_]+)\.jpg$/i);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export async function getFavoriteUserGame(userId: string) {
  const { data, error } = await supabase
    .from('user_games')
    .select('*, game:games(*)')
    .eq('profile_id', userId)
    .eq('is_favorite', true)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const row = (data as unknown as UserGameWithCatalog | null) || null;
  if (!row?.game?.igdb_id) return row;
  try {
    const allow = await filterToSteamPcIgdbIds([row.game.igdb_id]);
    if (!allow.has(row.game.igdb_id)) return null;
  } catch {}
  return row;
}

export async function uploadAvatarFromUri(userId: string, uri: string) {
  const pathInBucket = `${userId}/avatar-${Date.now()}.jpg`;
  // Read image as base64 from local URI
  const encodingBase64: any = (FileSystem as any)?.EncodingType?.Base64 ?? 'base64';
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: encodingBase64 } as any);
  const arrayBuffer = base64ToArrayBuffer(base64);
  const { error: upErr } = await supabase.storage
    .from('avatars')
    .upload(pathInBucket, arrayBuffer, { upsert: true, contentType: 'image/jpeg' });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from('avatars').getPublicUrl(pathInBucket);
  const publicUrl = pub.publicUrl;
  const { error: updErr } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId);
  if (updErr) throw updErr;
  return publicUrl;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const clean = base64.replace(/\s/g, '');
  const padding = (clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0);
  const length = (clean.length * 3) / 4 - padding;
  const bytes = new Uint8Array(length);
  const lookup = new Uint8Array(256);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c1 = lookup[clean.charCodeAt(i)];
    const c2 = lookup[clean.charCodeAt(i + 1)];
    const c3 = clean.charCodeAt(i + 2) === 61 ? 64 : lookup[clean.charCodeAt(i + 2)]; // '=' -> 61
    const c4 = clean.charCodeAt(i + 3) === 61 ? 64 : lookup[clean.charCodeAt(i + 3)];
    const n = (c1 << 18) | (c2 << 12) | ((c3 & 63) << 6) | (c4 & 63);
    bytes[p++] = (n >> 16) & 255;
    if (c3 !== 64) bytes[p++] = (n >> 8) & 255;
    if (c4 !== 64) bytes[p++] = n & 255;
  }
  return bytes.buffer;
}

export async function removeAvatar(userId: string) {
  // First, clear avatar_url so the UI updates immediately
  const { error: updErr } = await supabase
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', userId);
  if (updErr) throw updErr;
  // Best-effort: remove any files under this user's folder in the avatars bucket
  try {
    const { data: files } = await supabase.storage.from('avatars').list(userId, { limit: 100 });
    const keys = (files || []).map((f: any) => `${userId}/${f.name}`);
    if (keys.length) {
      await supabase.storage.from('avatars').remove(keys);
    }
  } catch {
    // ignore cleanup failures
  }
}

// =============== Custom Shelves (User Collections) ===============
export async function createUserCollection(userId: string, name: string) {
  const payload = { profile_id: userId, name: name.trim() } as const;
  const { data, error } = await supabase.from('user_collections').insert(payload).select('*').single<UserCollection>();
  if (error) throw error;
  return data;
}

export async function listUserCollections(userId: string) {
  const { data, error } = await supabase
    .from('user_collections')
    .select('*')
    .eq('profile_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as UserCollection[];
}

export async function getUserCollectionSamples(userId: string, collectionId: number, limit: number = 3) {
  const { data, error, count } = await supabase
    .from('user_collection_games')
    .select('id, game:games(*)', { count: 'exact' })
    .eq('profile_id', userId)
    .eq('collection_id', collectionId)
    .limit(limit);
  if (error) throw error;
  let rows = (data as any[]) || [];
  // Keep sample covers within Steam PC scope (count unchanged)
  try {
    const igdbIds = rows.map((r) => r?.game?.igdb_id).filter((x: any) => Number.isFinite(x)) as number[];
    const allow = await filterToSteamPcIgdbIds(igdbIds);
    rows = rows.filter((r) => allow.has(r?.game?.igdb_id));
  } catch {}
  const games = rows.map((r) => r.game as GameRow).filter(Boolean);
  return { games, count: count || 0 };
}

export async function addGameToCollection(userId: string, collectionId: number, gameId: number) {
  const { data, error } = await supabase
    .from('user_collection_games')
    .insert({ profile_id: userId, collection_id: collectionId, game_id: gameId })
    .select('*')
    .single<UserCollectionGame>();
  if (error) throw error;
  return data;
}

export async function listCollectionGames(userId: string, collectionId: number) {
  const { data, error } = await supabase
    .from('user_collection_games')
    .select('*, game:games(*)')
    .eq('profile_id', userId)
    .eq('collection_id', collectionId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  let rows = ((data as any[]) || []) as (UserCollectionGame & { game: GameRow })[];
  try {
    const igdbIds = rows.map((r) => r?.game?.igdb_id).filter((x: any) => Number.isFinite(x)) as number[];
    const allow = await filterToSteamPcIgdbIds(igdbIds);
    rows = rows.filter((r) => allow.has(r?.game?.igdb_id));
  } catch {}
  return rows;
}

export async function removeUserCollectionGame(userId: string, rowId: number) {
  const { error } = await supabase
    .from('user_collection_games')
    .delete()
    .eq('id', rowId)
    .eq('profile_id', userId);
  if (error) throw error;
}

export async function getPlatformsForIgdbIds(ids: number[]): Promise<string[]> {
  const uniq = Array.from(new Set((ids || []).filter((x) => Number.isFinite(x)) as number[]));
  if (uniq.length === 0) return [];
  const batch = uniq.slice(0, 30); // cap to avoid long queries
  const fields = 'fields platforms.slug,platforms.name;';
  const query = `${fields} where id = (${batch.join(',')}); limit ${batch.length};`;
  try {
    const rows = await IGDB.igdbRequest<{ platforms?: { slug?: string; name?: string }[] }[]>(query);
    const slugs = new Set<string>();
    for (const r of rows || []) {
      for (const p of r.platforms || []) {
        const s = (p.slug || '').toLowerCase();
        if (s) slugs.add(s);
      }
    }
    return Array.from(slugs);
  } catch {
    return [];
  }
}


export async function getSteamTrophyCount(userId: string) {
  // First, try to get the pre-calculated value from profiles (single fast query)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('total_trophies')
    .eq('id', userId)
    .maybeSingle();
  
  if (!profileError && profile && typeof profile.total_trophies === 'number') {
    return profile.total_trophies;
  }
  
  // Fallback: calculate if not available (shouldn't happen after migration)
  const { data, error } = await supabase
    .from('steam_user_games')
    .select('achievements_unlocked')
    .eq('profile_id', userId);
  
  if (error) throw error;
  return (data || []).reduce((acc, row) => acc + (row.achievements_unlocked || 0), 0);
}

// Alias for backward compatibility
export const getTotalTrophyCount = getSteamTrophyCount;

export async function getMostPlayedSteamGame(userId: string) {
  // 1. Get top played steam game
  const { data: steamGame, error } = await supabase
    .from('steam_user_games')
    .select('steam_appid, playtime_forever')
    .eq('profile_id', userId)
    .order('playtime_forever', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !steamGame) return null;

  // 2. Try to find IGDB mapping
  const { data: mapping } = await supabase
    .from('steam_igdb_mappings')
    .select('igdb_id')
    .eq('steam_appid', steamGame.steam_appid)
    .maybeSingle();

  if (mapping?.igdb_id) {
    const { data: game } = await supabase
      .from('games')
      .select('*')
      .eq('igdb_id', mapping.igdb_id)
      .maybeSingle();
    
    if (game) {
      return {
        name: game.name,
        cover_image_id: game.cover_image_id,
        playtime_forever: steamGame.playtime_forever,
        source: 'igdb' as const
      };
    }
  }

  // 3. Fallback to Steam App info
  const { data: app } = await supabase
    .from('steam_apps')
    .select('name, header_image')
    .eq('appid', steamGame.steam_appid)
    .maybeSingle();

  if (app) {
    return {
      name: app.name,
      cover_image_id: null, // Steam doesn't give vertical cover easily here
      header_image: app.header_image,
      playtime_forever: steamGame.playtime_forever,
      source: 'steam' as const
    };
  }

  return null;
}
export async function getTopRatedGames(userId: string) {
  // Fetch events of type 'rated' with rating 5
  const { data, error } = await supabase
    .from('events')
    .select('game_id, meta, game:games(*)')
    .eq('profile_id', userId)
    .eq('type', 'rated')
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Filter for 5 stars and deduplicate by game_id
  const seen = new Set<number>();
  const result: UserGameWithCatalog[] = [];

  for (const row of data || []) {
    const rating = row.meta?.rating;
    if (rating === 5 && row.game && !seen.has(row.game_id)) {
      seen.add(row.game_id);
      // Mock a UserGameRow structure since we don't have it directly from events
      result.push({
        id: 0, // Dummy ID
        profile_id: userId,
        game_id: row.game_id,
        status: 'completed', // Assumption or irrelevant
        is_favorite: false,
        minutes_played: 0,
        sessions_count: 0,
        last_session_at: null,
        created_at: '',
        updated_at: '',
        game: row.game,
      });
    }
  }

  return result;
}

/**
 * Get last Steam sync timestamp for a user
 */
export async function getLastSteamSync(userId: string) {
  const { data, error } = await supabase
    .from('steam_sync_jobs')
    .select('created_at, updated_at, status')
    .eq('profile_id', userId)
    .eq('stage', 'library')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return {
    lastSyncAt: data.updated_at || data.created_at,
    status: data.status as 'pending' | 'processing' | 'completed' | 'failed',
  };
}
