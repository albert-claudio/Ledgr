import 'react-native-url-polyfill/auto';

export type SteamFilter = 'recent' | 'all' | 'updated';

export interface SteamReview {
  recommendationid: string;
  author: {
    steamid: string;
    num_games_owned?: number;
    num_reviews?: number;
    playtime_at_review?: number; // minutes
    playtime_forever?: number; // minutes
  };
  language: string;
  review: string;
  timestamp_created: number;
  voted_up: boolean;
  votes_up: number;
  votes_funny: number;
}

export interface SteamReviewsResponse {
  success: number;
  query_summary: {
    review_score: number; // 0-9
    review_score_desc: string;
    total_positive: number;
    total_negative: number;
    total_reviews: number;
  };
  reviews: SteamReview[];
  cursor?: string;
}

export interface SteamFetchOptions {
  language?: string; // e.g., 'portuguese'
  filter?: SteamFilter;
  day_range?: number; // e.g., 90
  num_per_page?: number; // default 20
  cursor?: string;
}

const buildUrl = (appId: number, opts: SteamFetchOptions) => {
  const params = new URLSearchParams();
  params.set('json', '1');
  params.set('purchase_type', 'all');
  params.set('review_type', 'all');
  if (opts.language) params.set('language', opts.language);
  if (opts.filter) params.set('filter', opts.filter);
  if (opts.day_range != null) params.set('day_range', String(opts.day_range));
  if (opts.num_per_page != null) params.set('num_per_page', String(opts.num_per_page));
  if (opts.cursor) params.set('cursor', opts.cursor);
  return `https://store.steampowered.com/appreviews/${appId}?${params.toString()}`;
};

export async function fetchSteamReviews(appId: number, opts: SteamFetchOptions = {}): Promise<SteamReviewsResponse> {
  const url = buildUrl(appId, { language: 'portuguese', filter: 'recent', num_per_page: 20, ...opts });
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Steam reviews error: ${res.status} ${text}`);
  }
  return res.json();
}

export interface SteamSummary {
  approvalPercent: number; // 0-100
  ratingsCount: number;
  ratingFiveScale: number; // 0-5
}

export async function getSteamSummary(appId: number, dayRange = 365): Promise<SteamSummary> {
  const data = await fetchSteamReviews(appId, { filter: 'recent', day_range: dayRange, language: 'portuguese', num_per_page: 1 });
  const totalPos = data?.query_summary?.total_positive || 0;
  const totalNeg = data?.query_summary?.total_negative || 0;
  const total = Math.max(1, totalPos + totalNeg);
  const approval = Math.round((totalPos / total) * 100);
  const rating = Math.round(((approval / 20) * 10)) / 10; // map 0-100 -> 0-5 with 1 decimal
  return { approvalPercent: approval, ratingsCount: data?.query_summary?.total_reviews || total, ratingFiveScale: rating };
}

export async function getRecentThenOlder(appId: number, max = 30, dayRange = 180): Promise<SteamReview[]> {
  const first = await fetchSteamReviews(appId, { filter: 'recent', day_range: dayRange, language: 'portuguese', num_per_page: Math.min(20, max) });
  let list = first.reviews || [];
  let cursor = first.cursor;
  while (list.length < max && cursor) {
    const next = await fetchSteamReviews(appId, { filter: 'recent', day_range: dayRange, language: 'portuguese', num_per_page: Math.min(20, max - list.length), cursor });
    const more = next.reviews || [];
    if (more.length === 0) break;
    list = list.concat(more);
    cursor = next.cursor;
  }
  return list;
}

export function steamToRatingsCategories(approvalPercent: number) {
  const pos = Math.max(0, Math.min(100, approvalPercent));
  const neg = 100 - pos;
  const exceptional = +(pos * 0.45).toFixed(1);
  const recommended = +(pos * 0.55).toFixed(1);
  const meh = +(neg * 0.55).toFixed(1);
  const skip = +(neg * 0.45).toFixed(1);
  // Normalize to 100
  const sum = exceptional + recommended + meh + skip;
  const adj = 100 - sum;
  return [
    { id: 5, title: 'exceptional', count: 0, percent: exceptional },
    { id: 4, title: 'recommended', count: 0, percent: recommended },
    { id: 3, title: 'meh', count: 0, percent: meh },
    { id: 1, title: 'skip', count: 0, percent: +(skip + adj).toFixed(1) },
  ];
}

export async function getSteamAchievementsTotal(appId: number): Promise<number> {
  const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&l=portuguese`;
  const res = await fetch(url);
  if (!res.ok) return 0;
  const json = await res.json().catch(() => ({} as any));
  const entry = json?.[appId];
  if (!entry?.success) return 0;
  const total = entry?.data?.achievements?.total;
  return typeof total === 'number' ? total : 0;
}

export async function estimatePlaytimeFromReviews(appId: number, sample = 40): Promise<number> {
  try {
    const reviews = await getRecentThenOlder(appId, sample, 365);
    const mins = reviews
      .map((r) => r?.author?.playtime_at_review || 0)
      .filter((m) => typeof m === 'number' && m > 0);
    if (!mins.length) return 0;
    const avgMin = Math.round(mins.reduce((a, b) => a + b, 0) / mins.length);
    return Math.max(1, Math.round(avgMin / 60));
  } catch {
    return 0;
  }
}

export async function searchSteamAppIdByName(name: string): Promise<number | undefined> {
  try {
    const url = `https://store.steampowered.com/api/storesearch?term=${encodeURIComponent(name)}&l=portuguese&cc=br`;
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const data = await res.json().catch(() => ({} as any));
    const id = data?.items?.[0]?.id;
    return typeof id === 'number' ? id : undefined;
  } catch {
    return undefined;
  }
}
