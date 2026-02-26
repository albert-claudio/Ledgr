import { createEvent, deleteEvent, getUserEvents } from '@/services/events';
import type { CreateEventParams } from '@/types/event';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Hook to fetch user's timeline events with infinite scroll
 */
export function useUserEvents(profileId: string | undefined, pageSize: number = 20) {
  return useInfiniteQuery({
    queryKey: ['events', profileId],
    queryFn: async ({ pageParam = 0 }) => {
      if (!profileId) return { events: [], hasMore: false };
      
      // Fetch one extra to check if there's more, using pageParam as offset
      const events = await getUserEvents(profileId, pageSize + 1, pageParam);
      const hasMore = events.length > pageSize;
      const pageEvents = hasMore ? events.slice(0, pageSize) : events;
      
      return {
        events: pageEvents,
        hasMore,
        nextCursor: hasMore ? pageParam + pageSize : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!profileId,
    staleTime: 1000 * 60, // 1 minute
    initialPageParam: 0,
  });
}

/**
 * Hook to create a new event
 */
export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: CreateEventParams) => createEvent(params),
    onSuccess: (data, variables) => {
      // Invalidate events query to refetch
      queryClient.invalidateQueries({ queryKey: ['events', variables.profile_id] });
      
      // 🎯 CRITICAL: Invalidate hero card queries to show updated playtime
      // Isso garante que o hero card atualize imediatamente após sync/log
      queryClient.invalidateQueries({ queryKey: ['currentGame', variables.profile_id] });
      queryClient.invalidateQueries({ queryKey: ['currently-playing', variables.profile_id] });
      queryClient.invalidateQueries({ queryKey: ['profile:playing', variables.profile_id] });
    },
  });
}

/**
 * Hook to delete an event
 */
export function useDeleteEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (eventId: number) => deleteEvent(eventId),
    onSuccess: () => {
      // Invalidate all events queries
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}
