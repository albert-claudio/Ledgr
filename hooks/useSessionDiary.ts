import {
    addMediaToNote,
    createSessionNote,
    deleteSessionNote,
    getGameDiary,
    getGameMoodStats,
    getSessionNote,
    getSessionNoteByEvent,
    getUserSessionNotes,
    removeMediaFromNote,
    updateSessionNote,
    uploadSessionMedia,
    type GameDiaryEntry,
    type MoodStats,
    type SessionNote,
    type SessionNoteInput,
} from '@/services/sessionDiary';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

// ================================================================
// QUERY HOOKS
// ================================================================

/**
 * Busca nota de sessão por ID
 */
export function useSessionNote(noteId: number | null) {
  return useQuery<SessionNote | null>({
    queryKey: ['session-note', noteId],
    queryFn: () => (noteId ? getSessionNote(noteId) : Promise.resolve(null)),
    enabled: noteId !== null,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}

/**
 * Busca nota de sessão por event_id
 */
export function useSessionNoteByEvent(eventId: number | null) {
  return useQuery<SessionNote | null>({
    queryKey: ['session-note', 'event', eventId],
    queryFn: () => (eventId ? getSessionNoteByEvent(eventId) : Promise.resolve(null)),
    enabled: eventId !== null,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}

/**
 * Busca diário completo de um jogo
 */
export function useGameDiary(gameId: number | null, limit?: number) {
  return useQuery<GameDiaryEntry[]>({
    queryKey: ['game-diary', gameId, limit],
    queryFn: () => (gameId ? getGameDiary(gameId, limit) : Promise.resolve([])),
    enabled: gameId !== null,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}

/**
 * Busca estatísticas de humor de um jogo
 */
export function useGameMoodStats(gameId: number | null) {
  return useQuery<MoodStats[]>({
    queryKey: ['game-mood-stats', gameId],
    queryFn: () => (gameId ? getGameMoodStats(gameId) : Promise.resolve([])),
    enabled: gameId !== null,
    staleTime: 1000 * 60 * 10, // 10 minutos (stats mudam menos)
  });
}

/**
 * Busca notas do usuário autenticado
 */
export function useUserSessionNotes(limit?: number) {
  return useQuery<SessionNote[]>({
    queryKey: ['user-session-notes', limit],
    queryFn: () => getUserSessionNotes(limit),
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}

// ================================================================
// MUTATION HOOKS
// ================================================================

/**
 * Hook para criar/atualizar/deletar notas de sessão
 */
export function useSessionDiaryMutation() {
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: (input: SessionNoteInput) => createSessionNote(input),
    onSuccess: (data) => {
      // Invalida queries relevantes
      queryClient.invalidateQueries({ queryKey: ['session-note'] });
      queryClient.invalidateQueries({ queryKey: ['game-diary', data.game_id] });
      queryClient.invalidateQueries({ queryKey: ['user-session-notes'] });
      queryClient.invalidateQueries({ queryKey: ['game-mood-stats', data.game_id] });
    },
  });

  const update = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: Partial<SessionNoteInput> }) =>
      updateSessionNote(id, updates),
    onSuccess: (data) => {
      // Invalida queries relevantes
      queryClient.invalidateQueries({ queryKey: ['session-note', data.id] });
      queryClient.invalidateQueries({ queryKey: ['game-diary', data.game_id] });
      queryClient.invalidateQueries({ queryKey: ['user-session-notes'] });
      queryClient.invalidateQueries({ queryKey: ['game-mood-stats', data.game_id] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteSessionNote(id),
    onSuccess: () => {
      // Invalida todas as queries de sessão
      queryClient.invalidateQueries({ queryKey: ['session-note'] });
      queryClient.invalidateQueries({ queryKey: ['game-diary'] });
      queryClient.invalidateQueries({ queryKey: ['user-session-notes'] });
      queryClient.invalidateQueries({ queryKey: ['game-mood-stats'] });
    },
  });

  return {
    create,
    update,
    remove,
    isLoading: create.isPending || update.isPending || remove.isPending,
  };
}

/**
 * Hook para upload de mídia
 */
export function useSessionMediaMutation() {
  const queryClient = useQueryClient();

  const upload = useMutation({
    mutationFn: ({ file, sessionId }: { file: string; sessionId: number }) =>
      uploadSessionMedia(file, sessionId),
    onSuccess: (_, variables) => {
      // Invalida nota específica
      queryClient.invalidateQueries({ queryKey: ['session-note', variables.sessionId] });
    },
  });

  const addToNote = useMutation({
    mutationFn: ({ noteId, mediaUrl }: { noteId: number; mediaUrl: string }) =>
      addMediaToNote(noteId, mediaUrl),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['session-note', data.id] });
      queryClient.invalidateQueries({ queryKey: ['game-diary', data.game_id] });
    },
  });

  const removeFromNote = useMutation({
    mutationFn: ({ noteId, mediaUrl }: { noteId: number; mediaUrl: string }) =>
      removeMediaFromNote(noteId, mediaUrl),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['session-note', data.id] });
      queryClient.invalidateQueries({ queryKey: ['game-diary', data.game_id] });
    },
  });

  return {
    upload,
    addToNote,
    removeFromNote,
    isLoading: upload.isPending || addToNote.isPending || removeFromNote.isPending,
  };
}
