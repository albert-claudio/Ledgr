import { cancelQuestReminder, scheduleQuestReminder } from '@/services/notifications';
import { getCompletedQuestsCount } from '@/services/quests';
import { useEffect, useRef } from 'react';
import { useDailyQuests } from './useDailyQuests';

/**
 * Hook que gerencia automaticamente as notificações de lembrete das daily quests
 * 
 * Comportamento:
 * - Quando completar 1 de 2 quests: agenda notificação
 * - Quando completar 2 de 2 quests: cancela notificação
 * - Quando mudar de dia: limpa estado
 * 
 * @param userId - ID do usuário autenticado
 * @param delayMinutes - Delay em minutos para a notificação (padrão: 120 = 2 horas)
 */
export function useDailyQuestNotifications(
  userId: string | undefined,
  delayMinutes: number = 120 // 2 horas - produção
) {
  const questsQuery = useDailyQuests(userId);
  const lastCompletedCount = useRef<number>(0);
  const lastDate = useRef<string>('');

  useEffect(() => {
    if (!userId || !questsQuery.data) return;

    const quests = questsQuery.data;
    const completedCount = getCompletedQuestsCount(quests);
    const currentDate = quests.date;

    // Se mudou de dia, resetar estado
    if (currentDate !== lastDate.current) {
      lastDate.current = currentDate;
      lastCompletedCount.current = 0;
      cancelQuestReminder(); // Limpar notificações antigas
      console.log('[QuestNotifications] New day, resetting state');
    }

    // Detectar mudanças no número de quests completadas
    if (completedCount !== lastCompletedCount.current) {
      console.log(`[QuestNotifications] Completed count changed: ${lastCompletedCount.current} -> ${completedCount}`);
      lastCompletedCount.current = completedCount;

      if (completedCount === 1) {
        // Completou a primeira quest → agendar lembrete
        console.log('[QuestNotifications] ✅ First quest completed, scheduling reminder');
        scheduleQuestReminder(delayMinutes);
      } else if (completedCount === 2) {
        // Completou todas as quests → cancelar lembrete
        console.log('[QuestNotifications] 🎉 All quests completed, cancelling reminder');
        cancelQuestReminder();
      }
    }
  }, [userId, questsQuery.data, delayMinutes]);

  // Limpar ao desmontar
  useEffect(() => {
    return () => {
      // Não cancelar ao desmontar - queremos que a notificação persista
      console.log('[QuestNotifications] Unmounting (notification keeps running)');
    };
  }, []);
}
