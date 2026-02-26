import { supabase } from '@/lib/supabase';

export type QuestType = 
  | 'played' 
  | 'rated' 
  | 'added_to_collection'
  | 'opened_app'
  | 'play_15_minutes'
  | 'write_review'
  | 'play_old_game';

export interface DailyQuestStatus {
  // As quests podem variar baseado no dia
  opened_app?: boolean;
  play_15_minutes?: boolean;
  write_review?: boolean;
  play_old_game?: boolean;
  // Quests antigas (mantidas para compatibilidade)
  played?: boolean;
  rated?: boolean;
  added_to_collection?: boolean;
  
  // Metadados
  current_streak: number;
  longest_streak: number;
  date: string;
  active_quests: QuestType[]; // Quais 2 quests estão ativas hoje
}

/**
 * Busca o status das missões diárias do usuário autenticado
 * NOTA: Não aceita user_id - usa auth.uid() no backend
 */
export async function getDailyQuests(): Promise<DailyQuestStatus> {
  console.log('[getDailyQuests] Calling RPC...');
  const { data, error } = await supabase.rpc('get_daily_quests');

  console.log('[getDailyQuests] Response:', { data, error });

  if (error) {
    console.error('[getDailyQuests] Error:', error);
    throw new Error(error.message);
  }

  if (!data) {
    console.warn('[getDailyQuests] No data returned');
    throw new Error('No data returned from get_daily_quests');
  }

  console.log('[getDailyQuests] Success:', data);
  return data as DailyQuestStatus;
}

/**
 * Verifica se todas as missões ativas do dia foram completadas
 */
export function areAllQuestsComplete(status: DailyQuestStatus): boolean {
  if (!status.active_quests || status.active_quests.length === 0) {
    return false;
  }
  
  return status.active_quests.every(questType => status[questType] === true);
}

/**
 * Conta quantas missões ativas foram completadas
 */
export function getCompletedQuestsCount(status: DailyQuestStatus): number {
  if (!status.active_quests || status.active_quests.length === 0) {
    return 0;
  }
  
  return status.active_quests.filter(questType => status[questType] === true).length;
}

/**
 * Retorna o label e ícone para cada tipo de quest
 */
export function getQuestInfo(questType: QuestType): { label: string; icon: string } {
  const questMap: Record<QuestType, { label: string; icon: string }> = {
    opened_app: { label: 'Abrir o app hoje', icon: '📱' },
    play_15_minutes: { label: 'Registrar 15 minutos de jogo', icon: '⏱️' },
    write_review: { label: 'Escrever uma avaliação', icon: '✍️' },
    play_old_game: { label: 'Jogar um jogo antigo', icon: '🕹️' },
    played: { label: 'Jogar qualquer jogo', icon: '🎮' },
    rated: { label: 'Avaliar um jogo', icon: '⭐' },
    added_to_collection: { label: 'Adicionar um jogo na coleção', icon: '📚' },
  };
  
  return questMap[questType] || { label: questType, icon: '❓' };
}

/**
 * Marca explicitamente que o usuário abriu o app
 * Isso completa a quest "opened_app" se ela estiver ativa hoje
 * 
 * NOTA: Requer aplicar a migration 20251209230000_fix_streak_logic.sql no Supabase
 */
export async function markAppOpened(): Promise<void> {
  const { error } = await supabase.rpc('mark_app_opened');

  if (error) {
    // PGRST202 = função não encontrada (migration ainda não aplicada)
    if (error.code === 'PGRST202') {
      console.warn('[markAppOpened] Function not found - apply migration 20251209230000_fix_streak_logic.sql');
      return;
    }
    
    console.error('[markAppOpened] Error:', error);
    return;
  }

  console.log('[markAppOpened] ✅ Quest "opened_app" marked');
}
