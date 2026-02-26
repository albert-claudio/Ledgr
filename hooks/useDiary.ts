import { useQuery } from '@tanstack/react-query';
import { DiaryEntry, listRecentCommentsByUser } from '@/services/comments';

export function useRecentDiary(userId?: string | null, limit: number = 3) {
  return useQuery<DiaryEntry[]>({
    queryKey: ['diary:recent', userId, limit],
    enabled: !!userId,
    queryFn: () => listRecentCommentsByUser(userId as string, limit),
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 10,
  });
}

