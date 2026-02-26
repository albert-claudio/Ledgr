import { getMostPlayedSteamGame, getMyProfileWithCounters, getSteamTrophyCount, getUserGamesByStatus, UserGameWithCatalog } from '@/services/profile';
import { useQuery } from '@tanstack/react-query';

export function useProfileHeader(userId?: string | null) {
  return useQuery({
    queryKey: ['profile:header', userId],
    enabled: !!userId,
    queryFn: () => getMyProfileWithCounters(userId as string),
    staleTime: 1000 * 60 * 2,
  });
}

export function useSteamTrophies(userId?: string | null) {
  return useQuery({
    queryKey: ['profile:trophies', userId],
    enabled: !!userId,
    queryFn: () => getSteamTrophyCount(userId as string),
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}

export function useMostPlayedGame(userId?: string | null) {
  return useQuery({
    queryKey: ['profile:mostPlayed', userId],
    enabled: !!userId,
    queryFn: () => getMostPlayedSteamGame(userId as string),
    staleTime: 1000 * 60 * 5,
  });
}

export function useCurrentlyGaming(userId?: string | null) {
  return useQuery<UserGameWithCatalog[]>({
    queryKey: ['profile:playing', userId],
    enabled: !!userId,
    queryFn: () => getUserGamesByStatus(userId as string, 'playing', 12),
    staleTime: 1000 * 30,
  });
}


export function useWishlist(userId?: string | null) {
  return useQuery<UserGameWithCatalog[]>({
    queryKey: ['profile:wishlist', userId],
    enabled: !!userId,
    queryFn: () => getUserGamesByStatus(userId as string, 'wishlist'),
    staleTime: 1000 * 30,
  });
}

export function useCompleted(userId?: string | null) {
  return useQuery<UserGameWithCatalog[]>({
    queryKey: ['profile:completed', userId],
    enabled: !!userId,
    queryFn: () => getUserGamesByStatus(userId as string, 'completed'),
    staleTime: 1000 * 30,
  });
}

export function useTopRatedGames(userId?: string | null) {
  return useQuery<UserGameWithCatalog[]>({
    queryKey: ['profile:topRated', userId],
    enabled: !!userId,
    queryFn: () => import('@/services/profile').then(m => m.getTopRatedGames(userId as string)),
    staleTime: 1000 * 60 * 5,
  });
}
