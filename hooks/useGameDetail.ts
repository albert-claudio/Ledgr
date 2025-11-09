import { useQuery } from '@tanstack/react-query';
import { getGameDetails, getGameScreenshots } from '../services/gameDetail';
import { GameDetail, Screenshot } from '../types/game';

export const useGameDetail = (gameId: number | undefined) => {
  return useQuery<GameDetail, Error>({
    queryKey: ['game-detail', gameId],
    queryFn: () => getGameDetails(gameId!),
    enabled: !!gameId,
    staleTime: 1000 * 60 * 60, // 1 hora
    gcTime: 1000 * 60 * 60 * 2, // 2 horas
    retry: 0, // evitar re-tentativas longas que atrasam a navegação
    keepPreviousData: true,
  });
};

export const useGameScreenshots = (gameId: number | undefined) => {
  return useQuery<Screenshot[], Error>({
    queryKey: ['game-screenshots', gameId],
    queryFn: () => getGameScreenshots(gameId!),
    enabled: !!gameId,
    staleTime: 1000 * 60 * 60, // 1 hora
    gcTime: 1000 * 60 * 60 * 2, // 2 horas
  });
};
