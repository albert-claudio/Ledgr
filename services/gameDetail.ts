import { invokeFunction } from '../lib/api';
import { GameDetail, Screenshot } from '../types/game';
import { __private__ as IGDB } from './igdb';
import { rawgFindGameBasic, rawgGetGameDetailById } from './rawg';
import { estimatePlaytimeFromReviews, getSteamSummary, searchSteamAppIdByName, steamToRatingsCategories } from './steam';

const igdbImageUrl = (imageId: string | null | undefined, size: string): string | null => {
  if (!imageId) return null;
  return `https://images.igdb.com/igdb/image/upload/${size}/${imageId}.jpg`;
};

interface IGDBDetailRaw {
  id: number;
  name: string;
  slug?: string;
  summary?: string;
  storyline?: string;
  url?: string;
  first_release_date?: number;
  total_rating?: number;
  total_rating_count?: number;
  rating?: number;
  rating_count?: number;
  updated_at?: number;
  cover?: { image_id?: string };
  screenshots?: { id: number; image_id?: string; width?: number; height?: number }[];
  artworks?: { image_id?: string }[];
  platforms?: { id: number; name: string; slug?: string }[];
  involved_companies?: { company?: { id: number; name: string; slug?: string }; developer?: boolean; publisher?: boolean }[];
  genres?: { id: number; name: string; slug?: string }[];
  websites?: { url?: string }[];
  external_games?: { category: number; uid: string }[];
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

const synthesizeRatings = (rating100?: number): { title: string; percent: number; count: number; id: number }[] => {
  const r = Math.max(0, Math.min(100, rating100 ?? 0));
  const exceptional = Math.max(0, r - 75) * 0.8;
  const recommended = 30 + Math.max(0, r - 50) * 0.3;
  const meh = Math.max(0, 70 - r) * 0.2;
  let skip = 100 - (exceptional + recommended + meh);
  const total = exceptional + recommended + meh + skip;
  const ex = (exceptional / total) * 100;
  const rec = (recommended / total) * 100;
  const m = (meh / total) * 100;
  const sk = 100 - (ex + rec + m);
  return [
    { id: 5, title: 'exceptional', percent: Number(ex.toFixed(1)), count: 0 },
    { id: 4, title: 'recommended', percent: Number(rec.toFixed(1)), count: 0 },
    { id: 3, title: 'meh', percent: Number(m.toFixed(1)), count: 0 },
    { id: 1, title: 'skip', percent: Number(sk.toFixed(1)), count: 0 },
  ];
};

// Timeouts for external data
const deadline = (ms: number) => Date.now() + ms; 
const timeLeft = (dl: number) => Math.max(0, dl - Date.now());
async function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return await Promise.race<T>([
    p,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export const getGameDetails = async (id: number): Promise<GameDetail> => {
  // CLEAN QUERY: Removed time_to_beat.* fields to prevent 400 Error
  const fields = [
    'id', 'name', 'slug', 'summary', 'storyline', 'url', 'first_release_date',
    'total_rating', 'total_rating_count', 'rating', 'rating_count', 'updated_at',
    'cover.image_id', 'screenshots.image_id', 'artworks.image_id',
    'platforms.name', 'platforms.slug',
    'involved_companies.company.name', 'involved_companies.developer', 'involved_companies.publisher',
    'genres.name', 'genres.slug', 'websites.url',
    'external_games.category', 'external_games.uid',
  ].join(',');

  const body = `fields ${fields}; where id = ${id}; limit 1;`;
  
  // Parallel fetch: Game Details + Time To Beat (Separate Endpoint)
  // endpoint is "time_to_beats" (plural, no slash)
  const ttbPromise = IGDB.igdbRequestEndpoint<{ game: number; hastily: number; normally: number; completely: number }[]>('time_to_beats', `fields hastily, normally, completely; where game = ${id}; limit 1;`);
  
  let rows: IGDBDetailRaw[] = [];
  let ttbRow: { hastily?: number; normally?: number; completely?: number } | null = null;

  try {
    const [gameRows, ttbRows] = await Promise.all([
      IGDB.igdbRequest<IGDBDetailRaw[]>(body),
      ttbPromise.catch(err => { console.warn('TTB fetch failed', err); return []; }) // Catch 404s silently
    ]);
    rows = gameRows;
    ttbRow = ttbRows?.[0] || null;
  } catch (e) {
    console.error('Game detail fetch failed:', e);
    // Fallback query if schema differs
    const fallbackFields = [
      'id', 'name', 'slug', 'summary', 'storyline', 'url', 'first_release_date',
      'total_rating', 'total_rating_count', 'rating', 'rating_count', 'updated_at',
      'cover.image_id', 'screenshots.image_id',
      'artworks.image_id', 'platforms.name', 'platforms.slug',
      'involved_companies.company.name', 'involved_companies.developer', 'involved_companies.publisher',
      'genres.name', 'genres.slug', 'websites.url'
    ].join(',');
    const fbBody = `fields ${fallbackFields}; where id = ${id}; limit 1;`;
    rows = await IGDB.igdbRequest<IGDBDetailRaw[]>(fbBody);
  }
  
  const g = rows[0];
  if (!g) throw new Error('Game not found');

  let back = igdbImageUrl(g.artworks?.[0]?.image_id || g.screenshots?.[0]?.image_id, 't_1080p') || null;
  const cover = igdbImageUrl(g.cover?.image_id, 't_cover_big') || back || null;
  const rating100 = g.total_rating ?? g.rating ?? 0;
  
  // Extract Steam AppID
  let steamAppId = (g.external_games || [])
    .find(eg => eg.category === 1)?.uid ? Number((g.external_games || []).find(eg => eg.category === 1)?.uid) : undefined;

  if (!steamAppId) {
    const steamUrl = (g.websites || []).map((w) => w.url || '').find((u) => /store\.steampowered\.com\/app\//.test(u));
    steamAppId = steamUrl ? Number((/store\.steampowered\.com\/app\/(\d+)/.exec(steamUrl) || [])[1]) : undefined;
  }

  let ratingFive = toFiveScale(rating100);
  let ratingsArr = synthesizeRatings(rating100);
  let ratingsCount = g.total_rating_count ?? g.rating_count ?? 0;

  // Initialize TTB hours variables for return object
  const toHours = (sec: number) => (sec > 0 ? Math.max(1, Math.round(sec / 3600)) : 0);
  let ttbHoursH = 0;
  let ttbHoursN = 0;
  let ttbHoursC = 0;
  const hasTTBData = ttbRow && (ttbRow.normally || ttbRow.hastily || ttbRow.completely);
  if (hasTTBData) {
      ttbHoursH = toHours(ttbRow?.hastily || 0);
      ttbHoursN = toHours(ttbRow?.normally || 0);
      ttbHoursC = toHours(ttbRow?.completely || 0);
  }

  // Extra Image fallbacks
  if (!back) {
    try {
      const shots = await withTimeout(IGDB.igdbRequestEndpoint<{ image_id?: string }[]>('screenshots', `fields image_id; where game = ${id}; limit 1;`), 800, []);
      const imgId = shots?.[0]?.image_id;
      back = igdbImageUrl(imgId, 't_1080p') || back;
    } catch {}
  }
  if (!back) {
    try {
      const arts = await withTimeout(IGDB.igdbRequestEndpoint<{ image_id?: string }[]>('artworks', `fields image_id; where game = ${id}; limit 1;`), 800, []);
      const imgId = arts?.[0]?.image_id;
      back = igdbImageUrl(imgId, 't_1080p') || back;
    } catch {}
  }

  const devs = (g.involved_companies || []).filter((c) => c.developer && c.company).map((c) => ({ id: 0, name: c.company!.name, slug: '', games_count: 0, image_background: '' }));
  const pubs = (g.involved_companies || []).filter((c) => c.publisher && c.company).map((c) => ({ id: 0, name: c.company!.name, slug: '', games_count: 0, image_background: '' }));
  const plats = (g.platforms || []).map((p) => ({
    platform: { id: p.id, name: p.name, slug: p.slug || '', image: null, year_end: null, year_start: null, games_count: 0, image_background: '' },
    released_at: toDateStr(g.first_release_date),
    requirements_en: null,
    requirements_ru: null,
  }));

  return {
    id: g.id,
    slug: g.slug || String(g.id),
    name: g.name,
    name_original: g.name,
    description: g.summary || g.storyline || '',
    description_raw: g.summary || g.storyline || '',
    metacritic: null,
    metacritic_platforms: [],
    released: toDateStr(g.first_release_date),
    tba: !g.first_release_date,
    updated: g.updated_at ? new Date(g.updated_at * 1000).toISOString() : new Date().toISOString(),
    background_image: back || cover || '',
    background_image_additional: back || cover || '',
    cover_image: cover || '',
    website: g.url || '',
    rating: ratingFive,
    rating_top: 5,
    ratings: ratingsArr,
    ratings_count: ratingsCount,
    reviews_text_count: 0,
    added: 0,
    added_by_status: { yet: 0, owned: 0, beaten: 0, toplay: 0, dropped: 0, playing: 0 },
    playtime: 0, // Will be filled by external details
    ttb_hastily_hours: ttbHoursH || null,
    ttb_normally_hours: ttbHoursN || null,
    ttb_completely_hours: ttbHoursC || null,
    playtime_source: hasTTBData ? 'IGDB_TTB' : null, // Provisional source
    screenshots_count: g.screenshots?.length || 0,
    movies_count: 0,
    creators_count: 0,
    achievements_count: 0, // Will be filled by external details
    achievements_source: null,
    parent_achievements_count: 0,
    reddit_url: '',
    reddit_name: '',
    reddit_description: '',
    reddit_logo: '',
    reddit_count: 0,
    twitch_count: 0,
    youtube_count: 0,
    reviews_count: 0,
    saturated_color: '#000000',
    dominant_color: '#000000',
    parent_platforms: (g.platforms || []).map((p) => ({ platform: { id: p.id, name: p.name, slug: p.slug || '' } })),
    platforms: plats,
    stores: [],
    developers: devs,
    genres: (g.genres || []).map((x) => ({ id: x.id, name: x.name, slug: x.slug || '', games_count: 0, image_background: '' })),
    tags: [],
    publishers: pubs,
    esrb_rating: null,
    clip: null,
    steam_appid: steamAppId || null,
    approval_percent: null,
  };
};

export const getGameExternalDetails = async (id: number, name: string, steamAppId?: number | null): Promise<Partial<GameDetail>> => {
  const dl = deadline(8500); // 8.5s total budget
  
  // 1. Steam Data (Trophies & Ratings)
  const steamPromise = (steamAppId && Number.isFinite(steamAppId))
    ? withTimeout(getSteamSummary(steamAppId!, 365), 2500, { approvalPercent: 0, ratingsCount: 0, ratingFiveScale: 0 })
    : Promise.resolve({ approvalPercent: 0, ratingsCount: 0, ratingFiveScale: 0 });
  
  const steamAchPromise = (steamAppId && Number.isFinite(steamAppId))
    ? withTimeout(
        invokeFunction('steam_game_info', { appid: steamAppId }),
        2500,
        { achievements_count: 0 }
      ).catch(() => ({ achievements_count: 0 }))
    : Promise.resolve({ achievements_count: 0 });

  // 2. Playtime Data (HLTB > Steam > RAWG)
  const hltbPromise = invokeFunction('hltb_search', { name })
    .catch(err => {
      console.warn('[HLTB] Search failed:', err);
      return { main: 0, extra: 0, completionist: 0 };
    });

  // Clean Name Search (Parallel fallback)
  const cleanName = name.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  const hltbCleanPromise = (cleanName !== name && cleanName.length > 2)
    ? invokeFunction('hltb_search', { name: cleanName }).catch(() => ({ main: 0, extra: 0, completionist: 0 }))
    : Promise.resolve({ main: 0, extra: 0, completionist: 0 });

  const steamPlaytimePromise = (steamAppId && Number.isFinite(steamAppId))
    ? estimatePlaytimeFromReviews(steamAppId!, 40).catch(() => 0)
    : Promise.resolve(0);

  // Execute Parallel Fetches
  const [steamRes, steamAchRes, hltbData, hltbCleanData, steamEst] = await Promise.all([
    steamPromise,
    steamAchPromise,
    withTimeout(hltbPromise, 8000, { main: 0, extra: 0, completionist: 0 }),
    withTimeout(hltbCleanPromise, 8000, { main: 0, extra: 0, completionist: 0 }),
    withTimeout(steamPlaytimePromise, 3000, 0)
  ]);

  // Process Steam Data
  let approvalPercent: number | null = null;
  let ratingsArr: any[] | undefined;
  let ratingFive: number | undefined;
  let ratingsCount: number | undefined;

  if (steamRes.approvalPercent > 0) {
    approvalPercent = steamRes.approvalPercent;
    ratingFive = steamRes.ratingFiveScale;
    ratingsArr = steamToRatingsCategories(steamRes.approvalPercent);
    ratingsCount = steamRes.ratingsCount;
  }

  let achievementsCount = 0;
  let achievementsSource: string | null = null;
  if (steamAchRes.achievements_count > 0) {
    achievementsCount = steamAchRes.achievements_count;
    achievementsSource = 'STEAM_PUBLIC';
  }

  // Process Playtime
  let playtimeHours = 0;
  let playtimeSource: string | null = null;

  // Priority 1: HLTB (Original Name)
  if (hltbData && (hltbData.main || hltbData.completionist)) {
    playtimeHours = hltbData.main || hltbData.completionist || 0;
    playtimeSource = hltbData.main ? 'HLTB:MAIN' : 'HLTB:COMPLETIONIST';
  }
  // Priority 2: HLTB (Clean Name)
  else if (hltbCleanData && (hltbCleanData.main || hltbCleanData.completionist)) {
    playtimeHours = hltbCleanData.main || hltbCleanData.completionist || 0;
    playtimeSource = hltbCleanData.main ? 'HLTB_CLEAN:MAIN' : 'HLTB_CLEAN:COMPLETIONIST';
  }
  // Priority 3: Steam Estimate
  else if (steamEst > 0) {
    playtimeHours = steamEst;
    playtimeSource = 'STEAM_REVIEWS';
  }
  
  // Priority 4: RAWG Fallback (if time permits)
  if (playtimeHours === 0 && timeLeft(dl) > 1000) {
    try {
      const found = await withTimeout(rawgFindGameBasic(name), Math.min(1000, timeLeft(dl)), null as any);
      if (found) {
        const rawgData = await withTimeout(rawgGetGameDetailById(found.id), Math.min(1500, timeLeft(dl)), null as any);
        if (rawgData && rawgData.playtime > 0) {
          playtimeHours = rawgData.playtime;
          playtimeSource = 'RAWG:PLAYTIME';
        }
      }
    } catch {}
  }

  // Priority 5: Steam Search Fallback (if time permits and no appid)
  if (playtimeHours === 0 && !steamAppId && timeLeft(dl) > 1500) {
    try {
      const foundAppId = await withTimeout(searchSteamAppIdByName(name), Math.min(1500, timeLeft(dl)), undefined);
      if (foundAppId && Number.isFinite(foundAppId)) {
        const est = await withTimeout(estimatePlaytimeFromReviews(foundAppId, 30), Math.min(2000, timeLeft(dl)), 0);
        if (est > 0) {
          playtimeHours = est;
          playtimeSource = 'STEAM_SEARCH:REVIEWS';
        }
      }
    } catch {}
  }

  // Priority 6: Minimum Estimate
  if (playtimeHours === 0) {
    playtimeHours = 5;
    playtimeSource = 'ESTIMATE:MINIMUM';
  }

  return {
    approval_percent: approvalPercent,
    rating: ratingFive,
    ratings: ratingsArr,
    ratings_count: ratingsCount,
    achievements_count: achievementsCount,
    achievements_source: achievementsSource,
    playtime: playtimeHours,
    playtime_source: playtimeSource,
  };
};

export const getGameScreenshots = async (id: number): Promise<Screenshot[]> => {
  const query = `fields screenshots.image_id; where id = ${id}; limit 1;`;
  try {
    const rows = await IGDB.igdbRequest<{ screenshots?: { image_id?: string }[] }[]>(query);
    let shots = (rows?.[0]?.screenshots || []);
    if (!shots || shots.length === 0) {
      const direct = await IGDB.igdbRequestEndpoint<{ image_id?: string }[]>('screenshots', `fields image_id; where game = ${id}; limit 8;`);
      shots = direct || [];
    }
    shots = shots.slice(0, 8);
    return shots.map((s, idx) => ({
      id: idx + 1,
      image: igdbImageUrl(s.image_id, 't_screenshot_big') || igdbImageUrl(s.image_id, 't_1080p') || '',
      width: 0,
      height: 0,
      is_deleted: false,
    }));
  } catch {
    return [];
  }
};

export const getCompletionTime = (playtime: number): string => {
  // Never return N/A - always provide an estimate
  if (!playtime || playtime === 0) return '~5 horas';
  if (playtime < 1) {
    const minutes = Math.round(playtime * 60);
    return `${minutes} min`;
  }
  // Add ~ prefix for estimates to indicate approximate value
  return `~${Math.round(playtime)} horas`;
};

export const formatReleaseDate = (date: string): string => {
  if (!date) return 'TBA';
  const [year, month, day] = date.split('-');
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${day} ${months[parseInt(month) - 1]} ${year}`;
};

export const calculateRatingDistribution = (ratings: any[]): number[] => {
  const distribution = new Array(20).fill(0);
  if (!ratings || ratings.length === 0) return distribution;
  ratings.forEach(rating => {
    if (rating.title === 'exceptional') {
      for (let i = 16; i < 20; i++) distribution[i] = rating.percent / 4;
    } else if (rating.title === 'recommended') {
      for (let i = 12; i < 16; i++) distribution[i] = rating.percent / 4;
    } else if (rating.title === 'meh') {
      for (let i = 6; i < 12; i++) distribution[i] = rating.percent / 6;
    } else if (rating.title === 'skip') {
      for (let i = 0; i < 6; i++) distribution[i] = rating.percent / 6;
    }
  });
  const maxValue = Math.max(...distribution);
  if (maxValue > 0) {
    return distribution.map(value => (value / maxValue) * 100);
  }
  return distribution;
};