import { useQuery } from '@tanstack/react-query';
import { getPopularThisWeek, Game } from '../services/igdb';
import { searchGamesPlain2 as searchGames, searchSuggestions } from '../services/igdbSearch';
import { getRecentThenOlder, searchSteamAppIdByName, SteamReview } from '../services/steam';

export function usePopularThisWeek(enabled: boolean = true) {
  return useQuery<Game[], Error>({
    queryKey: ['igdb:popular-this-week'],
    queryFn: getPopularThisWeek,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    enabled,
  });
}

export function useSearchGames(text: string) {
  return useQuery<Game[], Error>({
    queryKey: ['igdb:search', text],
    queryFn: () => searchGames(text),
    enabled: !!text && text.trim().length > 1,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
    keepPreviousData: true,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export type ReviewFeedItem = {
  appId: number;
  gameId?: number;
  gameName: string;
  review: SteamReview;
};

export function useWeeklySteamReviews(enabled: boolean = true) {
  return useQuery<ReviewFeedItem[], Error>({
    queryKey: ['steam:weekly-reviews'],
    queryFn: async () => {
      const games = await getPopularThisWeek();
      const top = games.slice(0, 6);
      const results = await Promise.allSettled(
        top.map(async (g) => {
          try {
            const appId = await searchSteamAppIdByName(g.name);
            if (!appId) return null;
            const revs = await getRecentThenOlder(appId, 1, 30);
            if (revs && revs[0]) {
              return { appId, gameId: g.id, gameName: g.name, review: revs[0] } as ReviewFeedItem;
            }
            return null;
          } catch {
            return null;
          }
        })
      );
      return results
        .map((r) => (r.status === 'fulfilled' ? r.value : null))
        .filter((v): v is ReviewFeedItem => !!v);
    },
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    enabled,
  });
}

export function useSearchSuggestions(text: string, limit = 5) {
  return useQuery<Game[], Error>({
    queryKey: ['igdb:autocomplete', text, limit],
    queryFn: () => searchSuggestions(text, limit) as any,
    enabled: !!text && text.trim().length > 1,
    staleTime: 1000 * 15,
    gcTime: 1000 * 60 * 10,
    keepPreviousData: true,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
