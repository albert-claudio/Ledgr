import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { followUser, getFollowStats, unfollowUser } from '@/services/follows';

export function useFollow(profileId?: string) {
  const qc = useQueryClient();
  const stats = useQuery({
    queryKey: ['follow:stats', profileId],
    enabled: !!profileId,
    queryFn: () => getFollowStats(profileId as string),
    staleTime: 1000 * 30,
  });

  const followMut = useMutation({
    mutationFn: () => followUser(profileId as string),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['follow:stats', profileId] });
    },
  });

  const unfollowMut = useMutation({
    mutationFn: () => unfollowUser(profileId as string),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['follow:stats', profileId] });
    },
  });

  return {
    stats,
    isFollowing: !!stats.data?.isFollowing,
    followers: stats.data?.followers ?? 0,
    following: stats.data?.following ?? 0,
    follow: followMut.mutateAsync,
    unfollow: unfollowMut.mutateAsync,
    isWorking: followMut.isPending || unfollowMut.isPending,
  };
}

