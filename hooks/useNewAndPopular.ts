import { useQuery } from '@tanstack/react-query';
import { getNewAndPopular, Game } from '../services/igdb';

export const useNewAndPopular = () => {
  return useQuery<Game[], Error>({
    // Include filters in key to avoid stale cache collisions
    queryKey: ['igdb:new-and-popular', 'pc-steam', 120, '-released'],
    queryFn: getNewAndPopular,
    staleTime: 1000 * 60 * 30, // 30 minutos
    gcTime: 1000 * 60 * 60, // 1 hora
    retry: 2,
    refetchOnMount: true,
  });
};
