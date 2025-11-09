import 'react-native-url-polyfill/auto';
import Constants from 'expo-constants';
import { getCurrentMonthDateRange, getLastDaysDateRange } from '../utils/date';
import { callEdgeFunction, getEdgeFunctionUrl, invokeFunction } from '../lib/api';

// Platform IDs (IGDB): PC=6, PS5=167, Switch=130. Allow override for Switch via env.
const PC_PLATFORM_ID = 6;
const PS5_PLATFORM_ID = 167;
const SWITCH_PLATFORM_ID = Number(
  (Constants.expoConfig?.extra as any)?.EXPO_PUBLIC_IGDB_SWITCH_PLATFORM_ID ||
    process.env.EXPO_PUBLIC_IGDB_SWITCH_PLATFORM_ID ||
    130
);

// PC, PS5 and Switch only (platform IDs from IGDB)
const POP_PLATFORMS = `${PC_PLATFORM_ID},${PS5_PLATFORM_ID},${SWITCH_PLATFORM_ID}`;

// Prefer env-configured function name; default to 'igdb'.
// Set EXPO_PUBLIC_SUPABASE_IGDB_FUNCTION=igdb (recommended) or igdb-proxy if desired.
const IGDB_FUNCTION_NAME = (Constants.expoConfig?.extra as any)?.EXPO_PUBLIC_SUPABASE_IGDB_FUNCTION ||
  process.env.EXPO_PUBLIC_SUPABASE_IGDB_FUNCTION || 'igdb';

async function callIgdb<T>(endpoint: string, query: string): Promise<T> {
  const prefer = IGDB_FUNCTION_NAME;
  const alt = prefer === 'igdb' ? 'igdb-proxy' : 'igdb';
  const callWith = async (fnName: string) => {
    try {
      // Preferred: invoke via Supabase client (no manual URL juggling)
      const payload = fnName === 'igdb' ? { endpoint, body: query } : { query };
      const res = await invokeFunction(fnName, payload);
      return res as T;
    } catch (e) {
      // Fallback to direct URL (for environments where invoke is misconfigured)
      const url = getEdgeFunctionUrl(fnName);
      const payload = fnName === 'igdb' ? { endpoint, body: query } : { query };
      const res = await callEdgeFunction(url, payload);
      return res as T;
    }
  };
  let firstErr: any = null;
  try {
    return await callWith(prefer);
  } catch (e: any) {
    firstErr = e;
    // Try alternate function unconditionally as a robust fallback
    try {
      return await callWith(alt);
    } catch (e2: any) {
      // Re-throw original error with minimal context to avoid leaking tokens
      const ctx = `IGDB functions failed (prefer=${prefer}, alt=${alt}): ${String(firstErr?.message || '')}`;
      throw new Error(ctx);
    }
  }
}

async function igdbRequest<T>(query: string): Promise<T> {
  return callIgdb<T>('games', query);
}

async function igdbRequestEndpoint<T>(endpoint: string, query: string): Promise<T> {
  return callIgdb<T>(endpoint, query);
}

const igdbImageUrl = (imageId: string | null | undefined, size: string): string | null => {
  if (!imageId) return null;
  // size examples: t_1080p, t_screenshot_big, t_cover_big
  return `https://images.igdb.com/igdb/image/upload/${size}/${imageId}.jpg`;
};

// Types we return for lists (align to current UI expectations)
export interface Game {
  id: number;
  slug: string;
  name: string;
  released: string; // YYYY-MM-DD
  background_image: string | null;
  rating: number; // 0-5 scale (mapped from IGDB 0-100)
  ratings_count: number; // from total_rating_count or rating_count
  added: number;
  metacritic: number | null;
  playtime: number;
  suggestions_count: number;
  updated: string;
}

interface IGDBGameRaw {
  id: number;
  name: string;
  slug?: string;
  first_release_date?: number; // epoch seconds
  rating?: number; // 0-100
  rating_count?: number;
  total_rating?: number; // 0-100
  total_rating_count?: number;
  cover?: { image_id?: string };
  screenshots?: { image_id?: string }[];
  artworks?: { image_id?: string }[];
  updated_at?: number;
}

const toDateStr = (epochSec?: number): string => {
  if (!epochSec) return '';
  const d = new Date(epochSec * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const toFiveScale = (value?: number | null): number => {
  if (!value && value !== 0) return 0;
  const clamped = Math.max(0, Math.min(100, value));
  return Math.round((clamped / 20) * 10) / 10; // 1 decimal on 0-5
};

const pickBackdrop = (g: IGDBGameRaw): string | null => {
  const art = g.artworks?.[0]?.image_id;
  const shot = g.screenshots?.[0]?.image_id;
  return (
    igdbImageUrl(art || shot, 't_screenshot_huge') ||
    igdbImageUrl(art || shot, 't_1080p') ||
    null
  );
};

const pickCover = (g: IGDBGameRaw): string | null => {
  const cover = g.cover?.image_id;
  const art = g.artworks?.[0]?.image_id;
  const shot = g.screenshots?.[0]?.image_id;
  return (
    igdbImageUrl(cover, 't_cover_big') ||
    igdbImageUrl(art || shot, 't_1080p') ||
    null
  );
};

const mapToGame = (g: IGDBGameRaw): Game => {
  return {
    id: g.id,
    slug: g.slug || String(g.id),
    name: g.name,
    released: toDateStr(g.first_release_date),
    // For list cards we prefer the vertical cover image
    background_image: pickCover(g),
    rating: toFiveScale(g.total_rating ?? g.rating ?? 0),
    ratings_count: g.total_rating_count ?? g.rating_count ?? 0,
    added: 0,
    metacritic: null,
    playtime: 0,
    suggestions_count: 0,
    updated: g.updated_at ? new Date(g.updated_at * 1000).toISOString() : new Date().toISOString(),
  };
};

export const __private__ = { igdbRequest, igdbRequestEndpoint };

/**
 * Popular titles this month across PC/PS5/Switch (last ~90 days window)
 */
export const getPopularThisMonth = async (limit = 20): Promise<Game[]> => {
  const { startDate, endDate } = getLastDaysDateRange(90);
  const startEpoch = Math.floor(new Date(startDate).getTime() / 1000);
  const endEpoch = Math.floor(new Date(endDate).getTime() / 1000);

  const baseFields = `fields id,name,slug,first_release_date,total_rating,total_rating_count,rating,rating_count,cover.image_id,artworks.image_id,screenshots.image_id,updated_at;`;

  const query = `
    ${baseFields}
    where platforms = (${PC_PLATFORM_ID},${PS5_PLATFORM_ID}) & (cover != null | screenshots != null) & first_release_date != null & first_release_date >= ${startEpoch} & first_release_date <= ${endEpoch};
    sort total_rating_count desc;
    limit ${limit};
  `;
  let rows = await igdbRequest<IGDBGameRaw[]>(query);
  if (!rows || rows.length === 0) {
    const fallback = `
      ${baseFields}
      where platforms = (${PC_PLATFORM_ID},${PS5_PLATFORM_ID}) & (cover != null | screenshots != null) & first_release_date != null & first_release_date >= ${startEpoch} & first_release_date <= ${endEpoch};
      sort total_rating_count desc;
      limit ${limit};
    `;
    rows = await igdbRequest<IGDBGameRaw[]>(fallback);
  }
  if (!rows || rows.length === 0) {
    const fallback2 = `
      ${baseFields}
      where platforms = (${PC_PLATFORM_ID},${PS5_PLATFORM_ID}) & (cover != null | screenshots != null);
      sort total_rating_count desc;
      limit ${limit};
    `;
    rows = await igdbRequest<IGDBGameRaw[]>(fallback2);
  }
  return (rows || []).map(mapToGame).filter((g) => !!g.background_image);
};

/**
 * New and popular (last ~120 days), PS5 + Switch focus
 */
export const getNewAndPopular = async (): Promise<Game[]> => {
  const { startDate, endDate } = getLastDaysDateRange(120);
  const startEpoch = Math.floor(new Date(startDate).getTime() / 1000);
  const endEpoch = Math.floor(new Date(endDate).getTime() / 1000);

  const baseFields = `fields id,name,slug,first_release_date,total_rating,total_rating_count,rating,rating_count,cover.image_id,artworks.image_id,screenshots.image_id,updated_at;`;
  const query = `
    ${baseFields}
    where platforms = (${PS5_PLATFORM_ID},${SWITCH_PLATFORM_ID}) &
          first_release_date != null &
          first_release_date >= ${startEpoch} & first_release_date <= ${endEpoch};
    sort first_release_date desc;
    limit 20;
  `;

  let rows = await igdbRequest<IGDBGameRaw[]>(query);
  if (!rows || rows.length === 0) {
    const fallback = `
      ${baseFields}
      where platforms = (${PS5_PLATFORM_ID},${SWITCH_PLATFORM_ID}) & (cover != null | screenshots != null);
      sort total_rating_count desc;
      limit 20;
    `;
    rows = await igdbRequest<IGDBGameRaw[]>(fallback);
  }
  return (rows || [])
    .map(mapToGame)
    .filter((g) => !!g.background_image);
};

/**
 * Popular this week (last 7 days)
 */
export const getPopularThisWeek = async (): Promise<Game[]> => {
  const { startDate, endDate } = getLastDaysDateRange(7);
  const startEpoch = Math.floor(new Date(startDate).getTime() / 1000);
  const endEpoch = Math.floor(new Date(endDate).getTime() / 1000);
  const baseFields = `fields id,name,slug,first_release_date,total_rating,total_rating_count,rating,rating_count,cover.image_id,artworks.image_id,screenshots.image_id,updated_at;`;

  const query = `
    ${baseFields}
    where platforms = (${POP_PLATFORMS}) & (cover != null | screenshots != null) & updated_at != null & updated_at >= ${startEpoch} & updated_at <= ${endEpoch};
    sort total_rating_count desc;
    limit 30;
  `;
  let rows = await igdbRequest<IGDBGameRaw[]>(query);
  if (!rows || rows.length === 0) {
    const fallback1 = `
      ${baseFields}
      where platforms = (${POP_PLATFORMS}) & (cover != null | screenshots != null);
      sort total_rating_count desc;
      limit 30;
    `;
    rows = await igdbRequest<IGDBGameRaw[]>(fallback1);
  }
  if (!rows || rows.length === 0) {
    const fallback2 = `
      ${baseFields}
      where platforms = (${POP_PLATFORMS}) & (cover != null | screenshots != null);
      sort total_rating_count desc;
      limit 30;
    `;
    rows = await igdbRequest<IGDBGameRaw[]>(fallback2);
  }
  return (rows || []).map(mapToGame).filter((g) => !!g.background_image);
};

/**
 * Popular right now (IGDB popularity via rating counts)
 */
export const getPopularRightNow = async (): Promise<Game[]> => {
  const baseFields = `fields id,name,slug,first_release_date,total_rating,total_rating_count,rating,rating_count,cover.image_id,artworks.image_id,screenshots.image_id,updated_at;`;
  const query = `
    ${baseFields}
    where platforms = (${POP_PLATFORMS}) & (cover != null | screenshots != null);
    sort total_rating_count desc;
    limit 30;
  `;
  let rows = await igdbRequest<IGDBGameRaw[]>(query);
  if (!rows || rows.length === 0) {
    const fallback = `
      ${baseFields}
      where platforms = (${POP_PLATFORMS}) & (cover != null | screenshots != null);
      sort total_rating_count desc;
      limit 30;
    `;
    rows = await igdbRequest<IGDBGameRaw[]>(fallback);
  }
  return (rows || []).map(mapToGame).filter((g) => !!g.background_image);
};

/**
 * Search games by name (unsafe – raw search string)
 */
export const searchGames = async (text: string): Promise<Game[]> => {
  const q = (text || '').trim();
  if (!q) return [];
  const baseFields = `fields id,name,slug,first_release_date,total_rating,total_rating_count,rating,rating_count,cover.image_id,artworks.image_id,screenshots.image_id,updated_at;`;
  const query = `
    search "${q.replace(/\"/g, '')}";
    ${baseFields}
    where platforms = (${POP_PLATFORMS}) & (cover != null | screenshots != null);
    sort total_rating_count desc;
    limit 30;
  `;
  const rows = await igdbRequest<IGDBGameRaw[]>(query);
  return (rows || []).map(mapToGame).filter((g) => !!g.background_image);
};

// Safer variant used by the search screen (escapes quotes)
export const searchGamesSafe = async (text: string): Promise<Game[]> => {
  const q = (text || '').trim();
  if (!q) return [];
  const baseFields = `fields id,name,slug,first_release_date,total_rating,total_rating_count,rating,rating_count,cover.image_id,artworks.image_id,screenshots.image_id,updated_at;`;
  const safe = q.split('"').join('\\"');
  const query = `
    search \"${safe}\";
    ${baseFields}
    where platforms = (${POP_PLATFORMS}) & (cover != null | screenshots != null);
    sort total_rating_count desc;
    limit 30;
  `;
  const rows = await igdbRequest<IGDBGameRaw[]>(query);
  return (rows || []).map(mapToGame).filter((g) => !!g.background_image);
};

