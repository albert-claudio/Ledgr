import { useQuery } from '@tanstack/react-query';
import { getPopularRightNow, Game } from '../services/igdb';

export const usePopularRightNow = () => {
  return useQuery<Game[], Error>({
    queryKey: ['igdb:popular-right-now'],
    queryFn: getPopularRightNow,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    retry: 1,
    refetchOnMount: true,
  });
};