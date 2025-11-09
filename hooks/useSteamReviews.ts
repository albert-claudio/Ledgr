import { useQuery } from '@tanstack/react-query';
import { getRecentThenOlder, SteamReview } from '../services/steam';

export const useSteamReviews = (steamAppId: number | undefined) => {
  return useQuery<SteamReview[], Error>({
    queryKey: ['steam-reviews', steamAppId],
    queryFn: () => getRecentThenOlder(steamAppId!, 20, 180),
    enabled: !!steamAppId,
    staleTime: 1000 * 60 * 60, // 1 hora
    gcTime: 1000 * 60 * 60 * 2, // 2 horas
  });
};

