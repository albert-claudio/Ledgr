import { supabase } from '@/lib/supabase';

// ================================================================
// TYPES
// ================================================================

export type GameState = 
  | 'playing'      // Jogando
  | 'paused'       // Encostado
  | 'dropped'      // Dropei
  | 'completed'    // Zerei
  | 'ng_plus'      // NG+
  | 'platinum';    // Platinei

export type MoodType = 
  | 'happy'        // Feliz 😊
  | 'tilted'       // Tiltado 😤
  | 'relaxed'      // Relaxado 😌
  | 'excited'      // Emocionado 🤩
  | 'bored';       // Entediado 😴

export type MarkerType = 
  | 'boss_killed'     // Boss morto 👹
  | 'mission_stuck'   // Missão travada ⚠️
  | 'new_character'   // Personagem novo 👤
  | 'moral_choice'    // Decisão moral 🤔
  | 'new_weapon'      // Arma nova ⚔️
  | 'build'           // Build 🏗️
  | 'coop'            // Co-op 👥
  | 'pvp';            // PvP ⚔️

export interface SessionNote {
  id: number;
  event_id: number | null;
  profile_id: string;
  game_id: number;
  progress_text?: string | null;
  game_state?: GameState | null;
  mood?: MoodType | null;
  markers?: MarkerType[] | null;
  note_text?: string | null;
  media_urls?: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface SessionNoteInput {
  event_id?: number | null;
  game_id: number;
  progress_text?: string;
  game_state?: GameState;
  mood?: MoodType;
  markers?: MarkerType[];
  note_text?: string;
  media_urls?: string[];
}

export interface GameDiaryEntry extends SessionNote {
  hours_played?: number | null;
}

export interface MoodStats {
  mood: MoodType;
  count: number;
  percentage: number;
}

// ================================================================
// HELPER FUNCTIONS - LABELS E ÍCONES
// ================================================================

export function getGameStateLabel(state: GameState): string {
  const labels: Record<GameState, string> = {
    playing: 'Jogando',
    paused: 'Encostado',
    dropped: 'Dropei',
    completed: 'Zerei',
    ng_plus: 'NG+',
    platinum: 'Platinei',
  };
  return labels[state];
}

export function getGameStateIcon(state: GameState): string {
  const icons: Record<GameState, string> = {
    playing: '🎮',
    paused: '⏸️',
    dropped: '🚫',
    completed: '✅',
    ng_plus: '♾️',
    platinum: '🏆',
  };
  return icons[state];
}

export function getMoodLabel(mood: MoodType): string {
  const labels: Record<MoodType, string> = {
    happy: 'Feliz',
    tilted: 'Tiltado',
    relaxed: 'Relaxado',
    excited: 'Emocionado',
    bored: 'Entediado',
  };
  return labels[mood];
}

export function getMoodIcon(mood: MoodType): string {
  const icons: Record<MoodType, string> = {
    happy: '😊',
    tilted: '😤',
    relaxed: '😌',
    excited: '🤩',
    bored: '😴',
  };
  return icons[mood];
}

export function getMarkerLabel(marker: MarkerType): string {
  const labels: Record<MarkerType, string> = {
    boss_killed: 'Boss morto',
    mission_stuck: 'Missão travada',
    new_character: 'Personagem novo',
    moral_choice: 'Decisão moral',
    new_weapon: 'Arma nova',
    build: 'Build',
    coop: 'Co-op',
    pvp: 'PvP',
  };
  return labels[marker];
}

export function getMarkerIcon(marker: MarkerType): string {
  const icons: Record<MarkerType, string> = {
    boss_killed: '👹',
    mission_stuck: '⚠️',
    new_character: '👤',
    moral_choice: '🤔',
    new_weapon: '⚔️',
    build: '🏗️',
    coop: '👥',
    pvp: '⚔️',
  };
  return icons[marker];
}

// ================================================================
// CRUD OPERATIONS
// ================================================================

/**
 * Cria uma nova nota de sessão
 */
export async function createSessionNote(
  input: SessionNoteInput
): Promise<SessionNote> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User must be authenticated');

  const { data, error } = await supabase
    .from('session_notes')
    .insert({
      profile_id: user.id,
      ...input,
    })
    .select()
    .single();

  if (error) {
    console.error('[createSessionNote] Error:', error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Atualiza uma nota de sessão existente
 */
export async function updateSessionNote(
  id: number,
  updates: Partial<SessionNoteInput>
): Promise<SessionNote> {
  const { data, error } = await supabase
    .from('session_notes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[updateSessionNote] Error:', error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Deleta uma nota de sessão
 */
export async function deleteSessionNote(id: number): Promise<void> {
  // Primeiro busca a nota para deletar a mídia
  const { data: note } = await supabase
    .from('session_notes')
    .select('media_urls')
    .eq('id', id)
    .single();

  // Deleta mídia associada se existir
  if (note?.media_urls && note.media_urls.length > 0) {
    for (const url of note.media_urls) {
      await deleteSessionMedia(url).catch(err => {
        console.warn('[deleteSessionNote] Failed to delete media:', err);
      });
    }
  }

  const { error } = await supabase
    .from('session_notes')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[deleteSessionNote] Error:', error);
    throw new Error(error.message);
  }
}

/**
 * Busca nota de sessão por ID
 */
export async function getSessionNote(id: number): Promise<SessionNote | null> {
  const { data, error } = await supabase
    .from('session_notes')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error('[getSessionNote] Error:', error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Busca nota de sessão por event_id
 */
export async function getSessionNoteByEvent(
  eventId: number
): Promise<SessionNote | null> {
  const { data, error } = await supabase
    .from('session_notes')
    .select('*')
    .eq('event_id', eventId)
    .maybeSingle();

  if (error) {
    console.error('[getSessionNoteByEvent] Error:', error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Busca todas as notas de um jogo (diário completo)
 */
export async function getGameDiary(
  gameId: number,
  limit: number = 50
): Promise<GameDiaryEntry[]> {
  const { data, error } = await supabase
    .rpc('get_game_diary', {
      p_game_id: gameId,
      p_limit: limit,
    });

  if (error) {
    console.error('[getGameDiary] Error:', error);
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Busca estatísticas de humor de um jogo
 */
export async function getGameMoodStats(
  gameId: number
): Promise<MoodStats[]> {
  const { data, error } = await supabase
    .rpc('get_game_mood_stats', {
      p_game_id: gameId,
    });

  if (error) {
    console.error('[getGameMoodStats] Error:', error);
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Busca notas do usuário autenticado (timeline pessoal)
 */
export async function getUserSessionNotes(
  limit: number = 20
): Promise<SessionNote[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User must be authenticated');

  const { data, error } = await supabase
    .from('session_notes')
    .select('*')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[getUserSessionNotes] Error:', error);
    throw new Error(error.message);
  }

  return data || [];
}

// ================================================================
// MEDIA UPLOAD
// ================================================================

/**
 * Faz upload de mídia (screenshot/vídeo) para uma sessão
 * Retorna a URL pública do arquivo
 * 
 * @param uri - URI local da imagem (retornado pelo ImagePicker)
 * @param sessionId - ID da sessão
 */
export async function uploadSessionMedia(
  uri: string,
  sessionId: number
): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User must be authenticated');

  // Extrai extensão da URI
  const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(7);
  const fileName = `${timestamp}-${randomSuffix}.${fileExt}`;

  // Path: {userId}/{sessionId}/{fileName}
  const filePath = `${user.id}/${sessionId}/${fileName}`;

  // Cria FormData e adiciona arquivo
  const formData = new FormData();
  
  // React Native FormData approach - adiciona como objeto com uri, name e type
  formData.append('file', {
    uri: uri,
    name: fileName,
    type: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
  } as any);

  // Upload usando fetch direto (Supabase storage funciona melhor assim em RN)
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No session found');

  // Constrói URL do storage a partir da URL base do Supabase
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const uploadUrl = `${supabaseUrl}/storage/v1/object/session-media/${filePath}`;

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[uploadSessionMedia] Upload failed:', error);
    throw new Error('Failed to upload image');
  }

  // Retorna URL pública
  const { data: { publicUrl } } = supabase.storage
    .from('session-media')
    .getPublicUrl(filePath);

  return publicUrl;
}

/**
 * Deleta mídia do storage
 */
export async function deleteSessionMedia(url: string): Promise<void> {
  // Extrai o path da URL
  // URL format: https://{project}.supabase.co/storage/v1/object/public/session-media/{path}
  const parts = url.split('/session-media/');
  if (parts.length !== 2) {
    throw new Error('Invalid media URL');
  }
  const filePath = parts[1];

  const { error } = await supabase.storage
    .from('session-media')
    .remove([filePath]);

  if (error) {
    console.error('[deleteSessionMedia] Error:', error);
    throw new Error(error.message);
  }
}

/**
 * Adiciona URL de mídia a uma nota existente
 */
export async function addMediaToNote(
  noteId: number,
  mediaUrl: string
): Promise<SessionNote> {
  // Busca nota atual
  const note = await getSessionNote(noteId);
  if (!note) throw new Error('Note not found');

  // Adiciona URL ao array
  const updatedUrls = [...(note.media_urls || []), mediaUrl];

  // Atualiza nota
  return updateSessionNote(noteId, { media_urls: updatedUrls });
}

/**
 * Remove URL de mídia de uma nota
 */
export async function removeMediaFromNote(
  noteId: number,
  mediaUrl: string
): Promise<SessionNote> {
  // Busca nota atual
  const note = await getSessionNote(noteId);
  if (!note) throw new Error('Note not found');

  // Remove URL do array
  const updatedUrls = (note.media_urls || []).filter(url => url !== mediaUrl);

  // Deleta arquivo do storage
  await deleteSessionMedia(mediaUrl);

  // Atualiza nota
  return updateSessionNote(noteId, { media_urls: updatedUrls });
}
