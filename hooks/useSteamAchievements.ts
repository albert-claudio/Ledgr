import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useSteamAchievements(steamAppId: number | undefined, userId: string | undefined) {
  const [steamData, setSteamData] = useState<{ unlocked: number; total: number } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!steamAppId || !userId) return;

    const fetchSteamData = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('get-steam-achievements', {
          body: { steamAppId },
        });

        if (!error && data && data.total > 0) {
          setSteamData({ unlocked: data.unlocked, total: data.total });
        }
      } catch (e) {
        console.log('Erro ao buscar dados da Steam:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchSteamData();
  }, [steamAppId, userId]);

  return { steamData, loading };
}