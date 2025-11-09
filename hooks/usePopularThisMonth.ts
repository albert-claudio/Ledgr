import { useQuery } from '@tanstack/react-query';
import { getPopularThisMonth, getPopularRightNow, Game } from '../services/igdb';

export const usePopularThisMonth = (limit = 20) => {
  return useQuery<Game[], Error>({
    // IGDB: mais jogados/avaliados do mês (resiliente)
    queryKey: ['igdb:popular-this-month:resilient', limit],
    queryFn: async () => {
      try {
        return await getPopularThisMonth(limit);
      } catch (err) {
        console.warn('[usePopularThisMonth] primary failed; fallback to popularity', err);
        return await getPopularRightNow();
      }
    },
    staleTime: 1000 * 60 * 30, // 30 minutos
    gcTime: 1000 * 60 * 60, // 1 hora
    retry: 1,
    refetchOnMount: true,
  });
};