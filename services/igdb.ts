import Constants from 'expo-constants';
import 'react-native-url-polyfill/auto';
import { callEdgeFunction, getEdgeFunctionUrl, invokeFunction } from '../lib/api';
import { getLastDaysDateRange } from '../utils/date';

// Platform IDs (IGDB)
const PC_PLATFORM_ID = 6; // PC (Microsoft Windows)

// Helper IGDB filter snippets
const STEAM_WEBSITE_FILTER = 'websites.url ~ *"store.steampowered.com/app/"*';
const PC_ONLY_FILTER = `platforms = (${PC_PLATFORM_ID})`;

// Force usage of the new 'igdb' function (Twitch Auth)
const IGDB_FUNCTION_NAME = 'igdb';

async function callIgdb<T>(endpoint: string, query: string): Promise<T> {
  try {
    // Invoke via Supabase client
    // Clean endpoint to ensure no leading slashes to avoid double slashes in backend
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    
    const payload = { endpoint: cleanEndpoint, body: query };
    const res = await invokeFunction(IGDB_FUNCTION_NAME, payload);
    return res as T;
  } catch (e) {
    // Log warning but don't crash the app. Return empty structure to keep UI running.
    console.warn(`IGDB Call Error [${endpoint}]:`, e);
    return [] as unknown as T; 
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
  return `https://images.igdb.com/igdb/image/upload/${size}/${imageId}.jpg`;
};

// Types
export interface Game {
  id: number;
  slug: string;
  name: string;
  released: string;
  background_image: string | null;
  rating: number;
  ratings_count: number;
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
  first_release_date?: number;
  rating?: number;
  rating_count?: number;
  total_rating?: number;
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
  return Math.round((clamped / 20) * 10) / 10;
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

// --- Exported Query Functions ---

export const getPopularThisMonth = async (limit = 20): Promise<Game[]> => {
  const { startDate, endDate } = getLastDaysDateRange(90);
  const startEpoch = Math.floor(new Date(startDate).getTime() / 1000);
  const endEpoch = Math.floor(new Date(endDate).getTime() / 1000);

  const baseFields = `fields id,name,slug,first_release_date,total_rating,total_rating_count,rating,rating_count,cover.image_id,artworks.image_id,screenshots.image_id,websites.url,updated_at;`;
  const query = `${baseFields} where ${PC_ONLY_FILTER} & ${STEAM_WEBSITE_FILTER} & (cover != null | screenshots != null) & first_release_date != null & first_release_date >= ${startEpoch} & first_release_date <= ${endEpoch}; sort total_rating_count desc; limit ${limit};`;
  
  const rows = await igdbRequest<IGDBGameRaw[]>(query);
  return (rows || []).map(mapToGame).filter((g) => !!g.background_image);
};

export const getNewAndPopular = async (): Promise<Game[]> => {
  const { startDate, endDate } = getLastDaysDateRange(120);
  const startEpoch = Math.floor(new Date(startDate).getTime() / 1000);
  const endEpoch = Math.floor(new Date(endDate).getTime() / 1000);

  const baseFields = `fields id,name,slug,first_release_date,total_rating,total_rating_count,rating,rating_count,cover.image_id,artworks.image_id,screenshots.image_id,websites.url,updated_at;`;
  const query = `${baseFields} where ${PC_ONLY_FILTER} & ${STEAM_WEBSITE_FILTER} & first_release_date != null & first_release_date >= ${startEpoch} & first_release_date <= ${endEpoch}; sort first_release_date desc; limit 20;`;

  const rows = await igdbRequest<IGDBGameRaw[]>(query);
  return (rows || []).map(mapToGame).filter((g) => !!g.background_image);
};

export const getPopularThisWeek = async (): Promise<Game[]> => {
  const { startDate, endDate } = getLastDaysDateRange(7);
  const startEpoch = Math.floor(new Date(startDate).getTime() / 1000);
  const endEpoch = Math.floor(new Date(endDate).getTime() / 1000);
  const baseFields = `fields id,name,slug,first_release_date,total_rating,total_rating_count,rating,rating_count,cover.image_id,artworks.image_id,screenshots.image_id,websites.url,updated_at;`;

  const query = `${baseFields} where ${PC_ONLY_FILTER} & ${STEAM_WEBSITE_FILTER} & (cover != null | screenshots != null) & updated_at != null & updated_at >= ${startEpoch} & updated_at <= ${endEpoch}; sort total_rating_count desc; limit 30;`;
  
  const rows = await igdbRequest<IGDBGameRaw[]>(query);
  return (rows || []).map(mapToGame).filter((g) => !!g.background_image);
};

export const getPopularRightNow = async (): Promise<Game[]> => {
  const baseFields = `fields id,name,slug,first_release_date,total_rating,total_rating_count,rating,rating_count,cover.image_id,artworks.image_id,screenshots.image_id,websites.url,updated_at;`;
  const query = `${baseFields} where ${PC_ONLY_FILTER} & ${STEAM_WEBSITE_FILTER} & (cover != null | screenshots != null); sort total_rating_count desc; limit 30;`;
  
  const rows = await igdbRequest<IGDBGameRaw[]>(query);
  return (rows || []).map(mapToGame).filter((g) => !!g.background_image);
};

export const searchGames = async (text: string): Promise<Game[]> => {
  const q = (text || '').trim();
  if (!q) return [];
  const baseFields = `fields id,name,slug,first_release_date,total_rating,total_rating_count,rating,rating_count,cover.image_id,artworks.image_id,screenshots.image_id,websites.url,updated_at;`;
  const query = `search "${q.replace(/\"/g, '')}"; ${baseFields} where ${PC_ONLY_FILTER} & ${STEAM_WEBSITE_FILTER} & (cover != null | screenshots != null); sort total_rating_count desc; limit 30;`;
  
  const rows = await igdbRequest<IGDBGameRaw[]>(query);
  return (rows || []).map(mapToGame).filter((g) => !!g.background_image);
};

export const searchGamesSafe = async (text: string): Promise<Game[]> => {
  const q = (text || '').trim();
  if (!q) return [];
  const baseFields = `fields id,name,slug,first_release_date,total_rating,total_rating_count,rating,rating_count,cover.image_id,artworks.image_id,screenshots.image_id,updated_at;`;
  const safe = q.split('"').join('\\"');
  const query = `search \"${safe}\"; ${baseFields} where ${PC_ONLY_FILTER} & ${STEAM_WEBSITE_FILTER} & (cover != null | screenshots != null); sort total_rating_count desc; limit 30;`;
  
  const rows = await igdbRequest<IGDBGameRaw[]>(query);
  return (rows || []).map(mapToGame).filter((g) => !!g.background_image);
};