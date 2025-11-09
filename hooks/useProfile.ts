import { useQuery } from '@tanstack/react-query';
import { getMyProfileWithCounters, getUserGamesByStatus, UserGameWithCatalog } from '@/services/profile';

export function useProfileHeader(userId?: string | null) {
  return useQuery({
    queryKey: ['profile:header', userId],
    enabled: !!userId,
    queryFn: () => getMyProfileWithCounters(userId as string),
    staleTime: 1000 * 60 * 2,
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
