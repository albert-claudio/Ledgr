import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMyRating, getRatingsAggregate, setMyRating } from '@/services/ratings';

export function useUserRating(igdbId?: number) {
  const qc = useQueryClient();
  const enabled = typeof igdbId === 'number' && igdbId > 0;
  const my = useQuery({ queryKey: ['ur:me', igdbId], queryFn: () => getMyRating(igdbId as number), enabled });
  const agg = useQuery({ queryKey: ['ur:agg', igdbId], queryFn: () => getRatingsAggregate(igdbId as number), enabled, staleTime: 1000 * 30 });

  const setMut = useMutation({
    mutationFn: (rating: number) => setMyRating(igdbId as number, rating),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ur:me', igdbId] });
      qc.invalidateQueries({ queryKey: ['ur:agg', igdbId] });
    }
  });

  return {
    myRating: my.data ?? null,
    isLoading: my.isLoading || agg.isLoading,
    aggregate: agg.data ?? { avg: 0, count: 0 },
    setRating: setMut.mutateAsync,
    setting: setMut.isPending,
  };
}

