import 'react-native-url-polyfill/auto';
import { callEdgeFunction, getEdgeFunctionUrl, invokeFunction } from '../lib/api';
import type { Game } from './igdb';

type IGDBGameRaw = {
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
};

async function igdbRequestDirect<T>(query: string): Promise<T> {
  const payload = { endpoint: 'games', body: query };
  try {
    const res = await invokeFunction('igdb', payload);
    return res as T;
  } catch (e) {
    const url = getEdgeFunctionUrl('igdb');
    const res = await callEdgeFunction(url, payload);
    return res as T;
  }
}

const igdbImageUrl = (imageId: string | null | undefined, size: string): string | null => {
  if (!imageId) return null;
  return `https://images.igdb.com/igdb/image/upload/${size}/${imageId}.jpg`;
};

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
    rating: (Math.round(((g.total_rating ?? g.rating ?? 0) / 20) * 10) / 10),
    ratings_count: g.total_rating_count ?? g.rating_count ?? 0,
    added: 0,
    metacritic: null,
    playtime: 0,
    suggestions_count: 0,
    updated: toDateStr(g.updated_at),
  };
};

const sanitizeSearchText = (text: string): string => {
  return (text || '')
    .normalize('NFKC')
    .replace(/["'`\\]/g, '')
    .replace(/[\r\n;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
};

// IGDB filter helpers aligned with services/igdb.ts
const PC_PLATFORM_ID = 6; // PC (Microsoft Windows)
const STEAM_WEBSITE_FILTER = 'websites.url ~ *"store.steampowered.com/app/"*';
const PC_ONLY_FILTER = `platforms = (${PC_PLATFORM_ID})`;

export const searchGamesPlain = async (text: string): Promise<Game[]> => {
  const q = sanitizeSearchText(text);
  if (!q) return [];
  const baseFields = `fields id,name,slug,first_release_date,total_rating,total_rating_count,rating,rating_count,cover.image_id,artworks.image_id,screenshots.image_id,websites.url,updated_at;`;
  const query = `
    search "${q}";
    ${baseFields}
    where ${PC_ONLY_FILTER} & ${STEAM_WEBSITE_FILTER} & (cover != null | screenshots != null);
    sort total_rating_count desc;
    limit 30;
  `;
  const rows = await igdbRequestDirect<IGDBGameRaw[]>(query);
  return (rows || []).map(mapToGame).filter((g) => !!g.background_image);
};

// Alternative with fuzzy search: splits text into words and searches for each
export const searchGamesPlain2 = async (text: string): Promise<Game[]> => {
  const q = sanitizeSearchText(text);
  if (!q) return [];
  
  const baseFields = `fields id,name,slug,first_release_date,total_rating,total_rating_count,rating,rating_count,cover.image_id,artworks.image_id,screenshots.image_id,websites.url,updated_at;`;
  
  // Helper: Check if word is a roman numeral or number
  const isNumberOrRoman = (w: string): boolean => {
    return /^(i{1,3}|iv|v|vi{1,3}|ix|x|xi{1,3}|\d+)$/i.test(w);
  };
  
  // Split into words and filter intelligently
  const stopWords = ['the', 'of', 'and', 'a', 'an', 'in', 'on', 'at', 'to', 'for'];
  const words = q.toLowerCase()
    .split(/\s+/)
    .filter(w => {
      // Keep numbers, roman numerals (even 1 char)
      if (isNumberOrRoman(w)) return true;
      // Keep words >= 2 chars that aren't stop words
      return w.length >= 2 && !stopWords.includes(w);
    });
  
  let whereClause = `${PC_ONLY_FILTER} & ${STEAM_WEBSITE_FILTER} & (cover != null | screenshots != null)`;
  
  // Strategy 1: Multi-word partial search
  if (words.length > 0) {
    const nameConditions = words.map(w => `name ~ *"${w}"*`).join(' & ');
    whereClause += ` & (${nameConditions})`;
  }
  
  const query = `
    ${baseFields}
    where ${whereClause};
    sort total_rating_count desc;
    limit 30;
  `;
  
  let rows = await igdbRequestDirect<IGDBGameRaw[]>(query);
  
  // Strategy 2: Fallback to exact IGDB search if no results
  if (!rows || rows.length === 0) {
    const dq = '"';
    const fallbackQuery = `
      search ${dq}${q}${dq};
      ${baseFields}
      where ${PC_ONLY_FILTER} & ${STEAM_WEBSITE_FILTER} & (cover != null | screenshots != null);
      limit 30;
    `;
    rows = await igdbRequestDirect<IGDBGameRaw[]>(fallbackQuery);
  }
  
  return (rows || []).map(mapToGame).filter((g) => !!g.background_image);
};

// Autocomplete-friendly suggestions with fuzzy search
export const searchSuggestions = async (text: string, limit = 5): Promise<Pick<Game,'id'|'name'|'slug'|'background_image'>[]> => {
  const q = sanitizeSearchText(text);
  if (!q) return [];
  
  const fields = `fields id,name,slug,cover.image_id,websites.url;`;
  
  // Helper: Check if word is a roman numeral or number
  const isNumberOrRoman = (w: string): boolean => {
    return /^(i{1,3}|iv|v|vi{1,3}|ix|x|xi{1,3}|\d+)$/i.test(w);
  };
  
  // Split into words and filter intelligently
  const stopWords = ['the', 'of', 'and', 'a', 'an', 'in', 'on', 'at', 'to', 'for'];
  const words = q.toLowerCase()
    .split(/\s+/)
    .filter(w => {
      if (isNumberOrRoman(w)) return true;
      return w.length >= 2 && !stopWords.includes(w);
    });
  
  let whereClause = `${PC_ONLY_FILTER} & ${STEAM_WEBSITE_FILTER} & (cover != null | screenshots != null)`;
  
  // Multi-word partial search
  if (words.length > 0) {
    const nameConditions = words.map(w => `name ~ *"${w}"*`).join(' & ');
    whereClause += ` & (${nameConditions})`;
  }
  
  const query = `
    ${fields}
    where ${whereClause};
    sort total_rating_count desc;
    limit ${Math.max(1, Math.min(10, limit))};
  `;
  
  let rows = await igdbRequestDirect<IGDBGameRaw[]>(query);
  
  // Fallback to exact search if no results
  if (!rows || rows.length === 0) {
    const dq = '"';
    const fallbackQuery = `
      search ${dq}${q}${dq};
      ${fields}
      where ${PC_ONLY_FILTER} & ${STEAM_WEBSITE_FILTER} & (cover != null | screenshots != null);
      limit ${Math.max(1, Math.min(10, limit))};
    `;
    rows = await igdbRequestDirect<IGDBGameRaw[]>(fallbackQuery);
  }
  
  return (rows || []).map((g) => ({
    id: g.id,
    slug: g.slug || String(g.id),
    name: g.name,
    background_image: igdbImageUrl(g.cover?.image_id || null, 't_cover_big') || null,
  }));
};
