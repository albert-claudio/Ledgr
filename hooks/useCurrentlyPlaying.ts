import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

interface CurrentlyPlayingGame {
  id: number;
  game_id: number;
  status: string;
  game: {
    id: number;
    igdb_id: number;
    name: string;
    slug: string;
    cover_image_id: string | null;
  };
}

/**
 * Hook to get the game user is currently playing
 */
export function useCurrentlyPlaying(profileId: string | undefined) {
  return useQuery({
    queryKey: ['currently-playing', profileId],
    queryFn: async (): Promise<CurrentlyPlayingGame | null> => {
      if (!profileId) return null;

      const { data, error } = await supabase
        .from('user_games')
        .select(`
          id,
          game_id,
          status,
          game:games(id, igdb_id, name, slug, cover_image_id)
        `)
        .eq('profile_id', profileId)
        .eq('status', 'playing')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('[Currently Playing] Error:', error);
        return null;
      }

      return data as CurrentlyPlayingGame | null;
    },
    enabled: !!profileId,
    staleTime: 1000 * 10, // 10 segundos - atualiza rápido para refletir sessões recentes
  });
}
