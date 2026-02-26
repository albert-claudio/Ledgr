import { supabase } from '@/lib/supabase';
import { getDailyQuests, markAppOpened, type DailyQuestStatus } from '@/services/quests';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

/**
 * Hook para buscar o status das missões diárias do usuário autenticado
 * NOTA: Usa auth.uid() automaticamente, não precisa passar userId
 */
export function useDailyQuests(userId: string | undefined) {
  const queryClient = useQueryClient();
  const appOpenedMarked = useRef(false); // Garante que só marca uma vez

  const query = useQuery<DailyQuestStatus>({
    queryKey: ['daily-quests', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User must be authenticated');
      const data = await getDailyQuests();
      
      // ✅ Marca "opened_app" explicitamente após buscar quests
      // Isso só acontece uma vez por sessão thanks ao useRef
      if (!appOpenedMarked.current) {
        appOpenedMarked.current = true;
        markAppOpened().catch(err => {
          console.warn('[useDailyQuests] Failed to mark app opened:', err);
        });
      }
      
      return data;
    },
    enabled: !!userId,
    staleTime: 1000 * 30, // 30 segundos - dados mais frescos para feedback rápido
    refetchOnWindowFocus: false, // Evita refetch desnecessário
  });

  // Realtime: Escuta mudanças nas completações de missões
  // OTIMIZADO: Usa refetchQueries para atualização IMEDIATA da UI
  useEffect(() => {
    if (!userId) return;

    // Inscreve no canal de quest completions do usuário
    const channel = supabase
      .channel(`daily-quest-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'daily_quest_completions',
          filter: `profile_id=eq.${userId}`,
        },
        () => {
          // 🎯 REFETCH IMEDIATO: Força atualização instantânea da UI
          // Isso garante que a missão seja marcada como completa assim que o evento sync aparece
          queryClient.refetchQueries({ 
            queryKey: ['daily-quests', userId],
            exact: true 
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return query;
}
