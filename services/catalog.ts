import 'react-native-url-polyfill/auto';
import { __private__ as IGDB } from './igdb';
import { Game } from './igdb';

const igdbImageUrl = (imageId: string | null | undefined, size: string): string | null => {
  if (!imageId) return null;
  return `https://images.igdb.com/igdb/image/upload/${size}/${imageId}.jpg`;
};

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

const mapToGame = (g: IGDBGameRaw): Game => ({
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
});

export type CatalogFilters = {
  startEpoch?: number;
  endEpoch?: number;
  genreId?: number;
  platformId?: number;
  sort?: 'popular' | 'recent';
};

export async function fetchCatalogPage(page: number, pageSize: number, filters: CatalogFilters): Promise<Game[]> {
  const baseFields = `fields id,name,slug,first_release_date,total_rating,total_rating_count,rating,rating_count,cover.image_id,artworks.image_id,screenshots.image_id,websites.url,updated_at;`;
  const whereParts: string[] = [];
  whereParts.push('(cover != null | screenshots != null)');
  // Always restrict to PC (Windows) games on Steam
  const PC_PLATFORM_ID = 6;
  whereParts.push(`platforms = (${PC_PLATFORM_ID})`);
  whereParts.push('websites.url ~ *"store.steampowered.com/app/"*');
  // If a platform filter was explicitly passed, it must be PC=6 to have any effect
  if (filters.platformId && filters.platformId !== PC_PLATFORM_ID) {
    // Ignore non-PC platform filters to avoid empty results; we keep PC-only
  }
  if (filters.genreId) whereParts.push(`genres = (${filters.genreId})`);
  if (filters.startEpoch) whereParts.push(`first_release_date != null & first_release_date >= ${filters.startEpoch}`);
  if (filters.endEpoch) whereParts.push(`first_release_date <= ${filters.endEpoch}`);
  const where = whereParts.length ? `where ${whereParts.join(' & ')};` : '';
  const sort = filters.sort === 'recent' ? 'sort first_release_date desc;' : 'sort total_rating_count desc;';
  const offset = page * pageSize;
  const limit = `limit ${pageSize}; offset ${offset};`;
  const query = `\n${baseFields}\n${where}\n${sort}\n${limit}\n`;
  const rows = await IGDB.igdbRequest<IGDBGameRaw[]>(query);
  return (rows || []).map(mapToGame).filter((g) => !!g.background_image);
}

export async function fetchGenres(): Promise<{ id: number; name: string }[]> {
  try {
    const rows = await IGDB.igdbRequestEndpoint<{ id: number; name: string }[]>('genres', 'fields id,name; sort name asc; limit 100;');
    return rows || [];
  } catch {
    return [];
  }
}

export async function fetchPlatforms(): Promise<{ id: number; name: string }[]> {
  try {
    const rows = await IGDB.igdbRequestEndpoint<{ id: number; name: string }[]>('platforms', 'fields id,name; sort name asc; limit 200;');
    const list = (rows || []);
    // Keep only PC (Microsoft Windows) to match Steam-only policy
    return list.filter((p) => p.id === 6 || /pc|windows/i.test(p.name));
  } catch {
    return [];
  }
}
