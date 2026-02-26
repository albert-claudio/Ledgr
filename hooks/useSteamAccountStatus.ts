import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

/**
 * Hook to check if user has Steam account linked
 */
export function useSteamAccountStatus(profileId: string | undefined) {
  return useQuery({
    queryKey: ['steam-account', profileId],
    queryFn: async () => {
      if (!profileId) return { linked: false, steamId: null };

      const { data, error } = await supabase
        .from('external_accounts')
        .select('provider, external_id')
        .eq('profile_id', profileId)
        .eq('provider', 'steam')
        .maybeSingle();

      if (error) {
        console.error('[Steam Status] Error:', error);
        return { linked: false, steamId: null };
      }

      return {
        linked: !!data,
        steamId: data?.external_id || null,
      };
    },
    enabled: !!profileId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
