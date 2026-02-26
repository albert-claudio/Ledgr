import 'react-native-url-polyfill/auto';
// NOTE: RAWG is used strictly as a fallback for specific fields
// (e.g., playtime and achievements_count) when IGDB/Steam do not
// provide them for a given title. Do not import this file in feed/
// list code (Home/Popular/New). All primary lists and covers must
// come from IGDB.

const RAWG_BASE = 'https://api.rawg.io/api';
const RAWG_KEY = process.env.EXPO_PUBLIC_RAWG_API_KEY || process.env.RAWG_API_KEY;

type RawgSearchResult = {
  results: { id: number; slug: string; name: string; playtime?: number }[];
};

type RawgGameDetail = {
  id: number;
  name: string;
  slug: string;
  playtime: number; // hours
  achievements_count?: number;
  background_image?: string | null;
  background_image_additional?: string | null;
};

async function rawgFetch<T>(path: string): Promise<T> {
  if (!RAWG_KEY) throw new Error('Missing EXPO_PUBLIC_RAWG_API_KEY');
  const url = `${RAWG_BASE}${path}${path.includes('?') ? '&' : '?'}key=${RAWG_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`RAWG error: ${res.status} ${t}`);
  }
  return res.json();
}

export async function rawgFindGameBasic(name: string): Promise<{ id: number; slug: string } | null> {
  try {
    const data = await rawgFetch<RawgSearchResult>(`/games?search_precise=true&search_exact=false&page_size=1&search=${encodeURIComponent(name)}`);
    const first = data?.results?.[0];
    if (!first) return null;
    return { id: first.id, slug: first.slug };
  } catch {
    return null;
  }
}

export async function rawgGetGameDetailById(id: number): Promise<{ playtime: number; achievements_count?: number; background_image?: string | null; background_image_additional?: string | null }> {
  const data = await rawgFetch<RawgGameDetail>(`/games/${id}`);
  return {
    playtime: data.playtime || 0,
    achievements_count: data.achievements_count || 0,
    background_image: data.background_image || null,
    background_image_additional: data.background_image_additional || null,
  };
}
