import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

type SteamAccount = {
  id: number;
  profile_id: string;
  provider: string;
  external_id: string;
  display_name: string | null;
  created_at: string;
};

async function getSteamAccount(userId: string): Promise<SteamAccount | null> {
  const { data, error } = await supabase
    .from('external_accounts')
    .select('*')
    .eq('profile_id', userId)
    .eq('provider', 'steam')
    .maybeSingle<SteamAccount>();

  if (error) throw error;
  return data;
}

export function useSteamAccount(userId?: string | null) {
  return useQuery({
    queryKey: ['steam:account', userId],
    enabled: !!userId,
    queryFn: () => getSteamAccount(userId as string),
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}
