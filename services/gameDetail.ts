import { GameDetail, Screenshot } from '../types/game';
import { getSteamSummary, steamToRatingsCategories, getSteamAchievementsTotal, estimatePlaytimeFromReviews, searchSteamAppIdByName } from './steam';
import { rawgFindGameBasic, rawgGetGameDetailById } from './rawg';
import { __private__ as IGDB } from './igdb';

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
  time_to_beat?: { hastly?: number; normally?: number; completely?: number };
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
  const exceptional = Math.max(0, r - 75) * 0.8; // up to ~20%
  const recommended = 30 + Math.max(0, r - 50) * 0.3; // 30-60%
  const meh = Math.max(0, 70 - r) * 0.2; // up to ~14%
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

/**
 * Busca os detalhes completos de um jogo via IGDB
 */
export const getGameDetails = async (id: number): Promise<GameDetail> => {
  const fields = [
    'id',
    'name',
    'slug',
    'summary',
    'storyline',
    'url',
    'first_release_date',
    'total_rating',
    'total_rating_count',
    'rating',
    'rating_count',
    'updated_at',
    'cover.image_id',
    'screenshots.image_id',
    'artworks.image_id',
    'platforms.name',
    'platforms.slug',
    'involved_companies.company.name',
    'involved_companies.developer',
    'involved_companies.publisher',
    'genres.name',
    'genres.slug',
    'websites.url',
    'time_to_beat.hastly',
    'time_to_beat.normally',
    'time_to_beat.completely',
  ].join(',');

  const body = `fields ${fields}; where id = ${id}; limit 1;`;
  let rows: IGDBDetailRaw[] = [];
  try {
    rows = await IGDB.igdbRequest<IGDBDetailRaw[]>(body);
  } catch (e) {
    // Fallback without time_to_beat fields in case the schema isn't available
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
  // Try to extract Steam AppID from websites only (fast path)
  const steamUrl = (g.websites || []).map((w) => w.url || '').find((u) => /store\.steampowered\.com\/app\//.test(u));
  const steamAppId = steamUrl ? Number((/store\.steampowered\.com\/app\/(\d+)/.exec(steamUrl) || [])[1]) : undefined;
  let ratingFive = toFiveScale(rating100);
  let ratingsArr = synthesizeRatings(rating100);
  let ratingsCount = g.total_rating_count ?? g.rating_count ?? 0;
  let approvalPercent = 0;
  // Soft-timeout the slow extras: Steam summary, achievements and RAWG fallback
  const deadline = Date.now() + 4500; // keep whole call under ~5s
  const timeLeft = () => Math.max(0, deadline - Date.now());
  async function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
    return await Promise.race<T>([
      p,
      new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
    ]);
  }
  // Run Steam summary and IGDB achievements concurrently with limits
  const steamPromise = (steamAppId && Number.isFinite(steamAppId))
    ? withTimeout(getSteamSummary(steamAppId!, 365), Math.min(1500, timeLeft()), { approvalPercent: 0, ratingsCount: 0, ratingFiveScale: ratingFive })
    : Promise.resolve({ approvalPercent: 0, ratingsCount: 0, ratingFiveScale: ratingFive });
  const igdbAchPromise = withTimeout(
    IGDB.igdbRequestEndpoint<{ id: number }[]>('achievements', `fields id; where game = ${id}; limit 500;`),
    Math.min(1200, timeLeft()),
    [] as { id: number }[]
  );
  const [steamRes, achRows] = await Promise.allSettled([steamPromise, igdbAchPromise]);
  if (steamRes.status === 'fulfilled' && steamAppId && Number.isFinite(steamAppId)) {
    approvalPercent = steamRes.value.approvalPercent;
    ratingFive = steamRes.value.ratingFiveScale; // derive from Steam approval
    ratingsArr = steamToRatingsCategories(steamRes.value.approvalPercent);
    ratingsCount = steamRes.value.ratingsCount;
  }
  let achievementsCount = 0;
  let achievementsSource: string | null = null;
  if (achRows.status === 'fulfilled') {
    achievementsCount = achRows.value?.length || 0;
    if (achievementsCount > 0) achievementsSource = 'IGDB';
  }
  const devs = (g.involved_companies || [])
    .filter((c) => c.developer && c.company)
    .map((c) => ({ id: 0, name: c.company!.name, slug: '', games_count: 0, image_background: '' }));
  const pubs = (g.involved_companies || [])
    .filter((c) => c.publisher && c.company)
    .map((c) => ({ id: 0, name: c.company!.name, slug: '', games_count: 0, image_background: '' }));
  const plats = (g.platforms || []).map((p) => ({
    platform: {
      id: p.id,
      name: p.name,
      slug: p.slug || '',
      image: null,
      year_end: null,
      year_start: null,
      games_count: 0,
      image_background: '',
    },
    released_at: toDateStr(g.first_release_date),
    requirements_en: null,
    requirements_ru: null,
  }));

  // Derive playtime in hours (IGDB uses seconds)
  // Prefer main story (normally), fallback to completely then hastly
  const ttbH = g.time_to_beat?.hastly || 0;
  const ttbN = g.time_to_beat?.normally || 0;
  const ttbC = g.time_to_beat?.completely || 0;
  const toHours = (sec: number) => (sec > 0 ? Math.max(1, Math.round(sec / 3600)) : 0);
  const ttbHoursH = toHours(ttbH);
  const ttbHoursN = toHours(ttbN);
  const ttbHoursC = toHours(ttbC);
  let playtimeHours = ttbHoursN || ttbHoursC || ttbHoursH || 0;
  let playtimeSource: string | null = playtimeHours > 0
    ? (ttbHoursN ? 'IGDB_TTB:NORMALLY' : (ttbHoursC ? 'IGDB_TTB:COMPLETELY' : 'IGDB_TTB:HASTLY'))
    : null;

  // If still missing, try Steam achievements quickly
  if ((!achievementsCount || achievementsCount === 0) && steamAppId && Number.isFinite(steamAppId) && timeLeft() > 500) {
    try {
      const total = await withTimeout(getSteamAchievementsTotal(steamAppId), Math.min(800, timeLeft()), 0);
      achievementsCount = total || achievementsCount;
      if (total > 0) achievementsSource = 'STEAM';
    } catch {}
  }

  // Fallback: estimate playtime from Steam reviews if IGDB TTB is missing
  if ((!playtimeHours || playtimeHours === 0) && steamAppId && Number.isFinite(steamAppId) && timeLeft() > 1000) {
    try {
      const est = await withTimeout(estimatePlaytimeFromReviews(steamAppId, 40), Math.min(1000, timeLeft()), 0);
      if (est > 0) { playtimeHours = est; playtimeSource = 'STEAM_REVIEWS'; }
    } catch {}
  }

  // RAWG fallback for achievements and banner only (no playtime)
  if ((achievementsCount === 0 || (!back && !cover)) && timeLeft() > 800) {
    try {
      const found = await withTimeout(rawgFindGameBasic(g.name), Math.min(500, timeLeft()), null as any);
      if (found) {
        const more = await withTimeout(rawgGetGameDetailById(found.id), Math.min(800, timeLeft()), null as any);
        if (more) {
          if (achievementsCount === 0 && (more.achievements_count || 0) > 0) {
            achievementsCount = more.achievements_count || 0;
            achievementsSource = 'RAWG';
          }
          // RAWG banner fallback (last resort)
          if (!back && !cover) {
            const rb = (more as any).background_image || (more as any).background_image_additional || null;
            if (rb) back = rb;
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // IGDB-first banner fallback: try direct endpoints quickly if still missing
  if (!back) {
    try {
      const shots = await withTimeout(
        IGDB.igdbRequestEndpoint<{ image_id?: string }[]>('screenshots', `fields image_id; where game = ${id}; limit 1;`),
        Math.min(800, timeLeft()),
        [] as { image_id?: string }[]
      );
      const imgId = shots?.[0]?.image_id;
      back = igdbImageUrl(imgId, 't_1080p') || back;
    } catch {}
  }
  if (!back) {
    try {
      const arts = await withTimeout(
        IGDB.igdbRequestEndpoint<{ image_id?: string }[]>('artworks', `fields image_id; where game = ${id}; limit 1;`),
        Math.min(800, timeLeft()),
        [] as { image_id?: string }[]
      );
      const imgId = arts?.[0]?.image_id;
      back = igdbImageUrl(imgId, 't_1080p') || back;
    } catch {}
  }

  const detail: GameDetail = {
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
    playtime: playtimeHours,
    ttb_hastly_hours: ttbHoursH || null,
    ttb_normally_hours: ttbHoursN || null,
    ttb_completely_hours: ttbHoursC || null,
    playtime_source: playtimeSource,
    screenshots_count: g.screenshots?.length || 0,
    movies_count: 0,
    creators_count: 0,
    achievements_count: achievementsCount,
    achievements_source: achievementsSource,
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
    approval_percent: approvalPercent || null,
  };

  return detail;
};

/**
 * Busca screenshots do jogo via IGDB
 */
export const getGameScreenshots = async (id: number): Promise<Screenshot[]> => {
  // Try games endpoint first (fast)
  const query = `fields screenshots.image_id; where id = ${id}; limit 1;`;
  try {
    const rows = await IGDB.igdbRequest<{ screenshots?: { image_id?: string }[] }[]>(query);
    let shots = (rows?.[0]?.screenshots || []);
    if (!shots || shots.length === 0) {
      // Fallback to direct screenshots endpoint if not embedded in games
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

/**
 * Calcula o tempo estimado para completar o jogo em horas
 * Baseado no playtime da API (que vem em horas)
 */
export const getCompletionTime = (playtime: number): string => {
  if (!playtime || playtime === 0) return 'N/A';
  
  if (playtime < 1) {
    const minutes = Math.round(playtime * 60);
    return `${minutes} min`;
  }
  
  return `${Math.round(playtime)} horas`;
};

/**
 * Formata a data de lançamento
 */
export const formatReleaseDate = (date: string): string => {
  if (!date) return 'TBA';
  
  const [year, month, day] = date.split('-');
  const months = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
  ];
  
  return `${day} ${months[parseInt(month) - 1]} ${year}`;
};

/**
 * Calcula a distribuição das avaliações para as barras do gráfico
 */
export const calculateRatingDistribution = (ratings: any[]): number[] => {
  // Criar um array de 20 posições para representar as barras
  const distribution = new Array(20).fill(0);
  
  if (!ratings || ratings.length === 0) return distribution;
  
  // Mapear as avaliações para as barras
  ratings.forEach(rating => {
    if (rating.title === 'exceptional') {
      // Últimas 4 barras (índices 16-19)
      for (let i = 16; i < 20; i++) {
        distribution[i] = rating.percent / 4;
      }
    } else if (rating.title === 'recommended') {
      // Barras 12-15
      for (let i = 12; i < 16; i++) {
        distribution[i] = rating.percent / 4;
      }
    } else if (rating.title === 'meh') {
      // Barras 6-11
      for (let i = 6; i < 12; i++) {
        distribution[i] = rating.percent / 6;
      }
    } else if (rating.title === 'skip') {
      // Primeiras 6 barras
      for (let i = 0; i < 6; i++) {
        distribution[i] = rating.percent / 6;
      }
    }
  });
  
  // Normalizar para valores entre 0 e 100
  const maxValue = Math.max(...distribution);
  if (maxValue > 0) {
    return distribution.map(value => (value / maxValue) * 100);
  }
  
  return distribution;
};
