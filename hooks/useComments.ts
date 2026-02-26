import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { addComment, likeComment, listCommentsForGame, unlikeComment, CommentItem } from '@/services/comments';

export const useComments = (igdbId?: number) => {
  const qc = useQueryClient();
  const key = ['comments', igdbId];

  const query = useQuery<CommentItem[], Error>({
    queryKey: key,
    queryFn: () => listCommentsForGame(igdbId as number),
    enabled: typeof igdbId === 'number' && igdbId > 0,
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 30,
  });

  const addMut = useMutation({
    mutationFn: (text: string) => addComment(igdbId as number, text),
    onSuccess: (created) => {
      qc.setQueryData<CommentItem[] | undefined>(key, (old) => [created, ...(old || [])]);
    }
  });

  const toggleLikeMut = useMutation({
    mutationFn: async (c: CommentItem) => {
      if (c.liked_by_me) { await unlikeComment(c.id); return { id: c.id, liked: false } as const; }
      await likeComment(c.id); return { id: c.id, liked: true } as const;
    },
    onMutate: async (action) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<CommentItem[] | undefined>(key);
      qc.setQueryData<CommentItem[] | undefined>(key, (old) => (old || []).map((it) => it.id === (action as any).id ? { ...it, liked_by_me: !(it.liked_by_me), likes_count: it.liked_by_me ? Math.max(0, it.likes_count - 1) : it.likes_count + 1 } : it));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
  });

  return {
    ...query,
    add: addMut.mutateAsync,
    toggleLike: (c: CommentItem) => toggleLikeMut.mutate(c),
    isAdding: addMut.isPending,
  };
};

