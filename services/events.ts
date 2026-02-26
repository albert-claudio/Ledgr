import { supabase } from '@/lib/supabase';
import type { CreateEventParams, Event } from '@/types/event';

/**
 * Create a new timeline event
 */
export async function createEvent(params: CreateEventParams): Promise<Event | null> {
  try {
    const { data, error } = await supabase
      .from('events')
      .insert({
        profile_id: params.profile_id,
        game_id: params.game_id || null,
        steam_appid: params.steam_appid || null,
        type: params.type,
        meta: params.meta || {},
      })
      .select(`
        *,
        game:games(id, igdb_id, name, slug, cover_image_id),
        profile:profiles(id, username, display_name, avatar_url)
      `)
      .single();

    if (error) {
      console.error('[Events] Create error:', error);
      return null;
    }

    return data as Event;
  } catch (e) {
    console.error('[Events] Create exception:', e);
    return null;
  }
}

/**
 * Get user's timeline events with pagination support
 * @param profileId - User's profile ID
 * @param limit - Number of events to fetch
 * @param offset - Number of events to skip (for pagination)
 */
export async function getUserEvents(
  profileId: string,
  limit: number = 50,
  offset: number = 0
): Promise<Event[]> {
  try {
    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        game:games(id, igdb_id, name, slug, cover_image_id),
        profile:profiles(id, username, display_name, avatar_url)
      `)
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[Events] Fetch error:', error);
      return [];
    }

    return (data as Event[]) || [];
  } catch (e) {
    console.error('[Events] Fetch exception:', e);
    return [];
  }
}

/**
 * Get events for a specific game
 */
export async function getGameEvents(
  profileId: string,
  gameId: number,
  limit: number = 20
): Promise<Event[]> {
  try {
    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        game:games(id, igdb_id, name, slug, cover_image_id),
        profile:profiles(id, username, display_name, avatar_url)
      `)
      .eq('profile_id', profileId)
      .eq('game_id', gameId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[Events] Game events error:', error);
      return [];
    }

    return (data as Event[]) || [];
  } catch (e) {
    console.error('[Events] Game events exception:', e);
    return [];
  }
}

/**
 * Delete an event
 */
export async function deleteEvent(eventId: number): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId);

    if (error) {
      console.error('[Events] Delete error:', error);
      return false;
    }

    return true;
  } catch (e) {
    console.error('[Events] Delete exception:', e);
    return false;
  }
}

/**
 * Helper: Create "started" event when user begins playing
 */
export async function createStartedEvent(
  profileId: string,
  gameId: number,
  platform?: string
): Promise<Event | null> {
  return createEvent({
    profile_id: profileId,
    game_id: gameId,
    type: 'started',
    meta: { platform, status: 'playing' },
  });
}

/**
 * Helper: Create "finished" event when user completes a game
 */
export async function createFinishedEvent(
  profileId: string,
  gameId: number,
  totalHours?: number,
  platform?: string
): Promise<Event | null> {
  return createEvent({
    profile_id: profileId,
    game_id: gameId,
    type: 'finished',
    meta: { 
      completion_time_hours: totalHours,
      platform,
      status: 'completed'
    },
  });
}

/**
 * Helper: Create "rated" event when user rates a game
 */
export async function createRatedEvent(
  profileId: string,
  gameId: number,
  rating: number,
  previousRating?: number
): Promise<Event | null> {
  return createEvent({
    profile_id: profileId,
    game_id: gameId,
    type: 'rated',
    meta: { rating, previous_rating: previousRating },
  });
}

/**
 * Helper: Create "log" event when user creates diary entry
 */
export async function createLogEvent(
  profileId: string,
  gameId: number,
  logText: string,
  diaryId?: number
): Promise<Event | null> {
  return createEvent({
    profile_id: profileId,
    game_id: gameId,
    type: 'log',
    meta: { 
      log_text: logText.substring(0, 500), // Limit to 500 chars
      diary_id: diaryId 
    },
  });
}

/**
 * Helper: Create "synced" event when Steam worker adds playtime
 */
export async function createSyncedEvent(
  profileId: string,
  gameId: number,
  steamAppId: number,
  hoursAdded: number,
  totalHours: number
): Promise<Event | null> {
  return createEvent({
    profile_id: profileId,
    game_id: gameId,
    steam_appid: steamAppId,
    type: 'synced',
    meta: { hours_added: hoursAdded, total_hours: totalHours },
  });
}

/**
 * Registra uma sessão de jogo manual e cria evento na timeline
 * @param gameId - ID do jogo na tabela games
 * @param hoursAdded - Horas jogadas nesta sessão
 * @returns Promise<void>
 */
export async function logGameSession(gameId: number, hoursAdded: number): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  
  if (!userId || userError) {
    throw new Error('Usuário não autenticado');
  }

  // 1. Buscar o estado ATUAL do jogo (para pegar o tempo antigo)
  const { data: currentGame, error: fetchError } = await supabase
    .from('user_games')
    .select('minutes_played, status, sessions_count')
    .eq('profile_id', userId)
    .eq('game_id', gameId)
    .single();

  if (fetchError || !currentGame) {
    throw new Error('Jogo não está na biblioteca');
  }

  // 2. Calcular novos valores
  const minutesToAdd = Math.round(hoursAdded * 60);
  const oldMinutes = currentGame.minutes_played || 0;
  const newMinutes = oldMinutes + minutesToAdd;
  const newSessionsCount = (currentGame.sessions_count || 0) + 1;
  
  // Se estava 'paused' ou 'wishlist', muda para 'playing' automaticamente
  const newStatus = ['wishlist', 'paused'].includes(currentGame.status) 
    ? 'playing' 
    : currentGame.status;

  // 3. Atualizar a tabela 'user_games' (O Total)
  const { error: updateError } = await supabase
    .from('user_games')
    .update({ 
      minutes_played: newMinutes,
      status: newStatus,
      sessions_count: newSessionsCount,
      last_session_at: new Date().toISOString(), // Importante para ordenação
    })
    .eq('profile_id', userId)
    .eq('game_id', gameId);

  if (updateError) {
    console.error('[logGameSession] Erro ao atualizar user_games:', updateError);
    throw new Error('Erro ao atualizar progresso');
  }

  // 4. Criar o Evento na Timeline (O Histórico)
  // Salvamos TANTO o que foi adicionado QUANTO o novo total
  const { error: eventError } = await supabase
    .from('events')
    .insert({
      profile_id: userId,
      game_id: gameId,
      type: 'synced', // Usamos 'synced' tanto para Steam quanto Manual
      meta: {
        hours_added: Math.round(hoursAdded * 10) / 10,  // "Você jogou +2h"
        total_hours: Math.round((newMinutes / 60) * 10) / 10, // "Total: 12.5h"
        source: 'manual', // Para diferenciar de Steam
        sessions_count: newSessionsCount,
      },
    });

  if (eventError) {
    console.error('[logGameSession] Erro ao criar evento:', eventError);
    throw new Error('Erro ao criar evento na timeline');
  }

  console.log(`[logGameSession] Sessão registrada: +${hoursAdded}h (Total: ${newMinutes / 60}h)`);
}
