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

export async function getUserGamesByStatus(userId: string, status: UserGameRow['status'], limit?: number) {
  // Using a join: select user_games.*, games(*) as game
  const q = supabase
    .from('user_games')
    .select('*, game:games(*)')
    .eq('profile_id', userId)
    .eq('status', status)
    .order('last_session_at', { ascending: false, nullsFirst: false });
  if (limit) q.limit(limit);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data as any[]) || [];
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
  return (data as unknown as UserGameWithCatalog | null) || null;
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
  const rows = (data as any[]) || [];
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
  return (data as any[]) as (UserCollectionGame & { game: GameRow })[];
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
