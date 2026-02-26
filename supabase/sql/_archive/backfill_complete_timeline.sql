-- ================================================================
-- LEDGR - COMPLETE TIMELINE BACKFILL
-- ================================================================
-- Este script migra TODOS os dados existentes para a timeline:
-- - Jogos "playing" → eventos 'started'
-- - Jogos "completed" → eventos 'finished'  
-- - Ratings → eventos 'rated'
-- - Diary entries → eventos 'log'
-- ================================================================

-- BLOCO 1: JOGOS INICIADOS (playing)
-- Usa last_session_at para ordenação cronológica correta
-- Inclui horas jogadas atuais no meta
INSERT INTO public.events (profile_id, game_id, type, meta, created_at)
SELECT 
  ug.profile_id,
  ug.game_id,
  'started'::public.event_type,
  jsonb_build_object(
    'platform', 'PC',
    'status', 'playing',
    'total_hours', round((ug.minutes_played::numeric / 60), 1),
    'sessions_count', ug.sessions_count,
    'generated_by', 'backfill_complete'
  ),
  -- Usa a última sessão como data do evento (atividade mais recente)
  COALESCE(ug.last_session_at, ug.updated_at, ug.created_at)
FROM public.user_games ug
WHERE ug.status = 'playing'
AND NOT EXISTS (
    SELECT 1 FROM public.events e 
    WHERE e.profile_id = ug.profile_id 
    AND e.game_id = ug.game_id 
    AND e.type = 'started'
)
ON CONFLICT DO NOTHING;

-- BLOCO 2: JOGOS COMPLETOS (finished)
-- Cria eventos 'finished' para jogos com status 'completed'
INSERT INTO public.events (profile_id, game_id, type, meta, created_at)
SELECT 
  ug.profile_id,
  ug.game_id,
  'finished'::public.event_type,
  jsonb_build_object(
    'completion_time_hours', round((ug.minutes_played::numeric / 60), 1),
    'platform', 'PC',
    'status', 'completed',
    'generated_by', 'backfill_complete'
  ),
  ug.updated_at -- Usa data de última atualização (quando marcou como completo)
FROM public.user_games ug
WHERE ug.status = 'completed'
AND NOT EXISTS (
    SELECT 1 FROM public.events e 
    WHERE e.profile_id = ug.profile_id 
    AND e.game_id = ug.game_id 
    AND e.type = 'finished'
)
ON CONFLICT DO NOTHING;

-- BLOCO 3: AVALIAÇÕES (rated)
-- Cria eventos 'rated' a partir de user_ratings
INSERT INTO public.events (profile_id, game_id, type, meta, created_at)
SELECT 
  ur.profile_id,
  g.id as game_id, -- Precisa fazer JOIN porque user_ratings usa game_igdb_id
  'rated'::public.event_type,
  jsonb_build_object(
    'rating', ur.rating,
    'generated_by', 'backfill_complete'
  ),
  ur.created_at
FROM public.user_ratings ur
INNER JOIN public.games g ON g.igdb_id = ur.game_igdb_id
WHERE NOT EXISTS (
    SELECT 1 FROM public.events e 
    WHERE e.profile_id = ur.profile_id 
    AND e.game_id = g.id
    AND e.type = 'rated'
)
ON CONFLICT DO NOTHING;

-- BLOCO 4: ENTRADAS NO DIÁRIO (log)
-- NOTA: Este bloco assume que existe uma tabela 'diary_entries' ou 'game_logs'
-- Se você tiver uma estrutura diferente, ajuste de acordo

-- Verifique se a tabela existe antes de executar
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'diary_entries'
  ) THEN
    -- Cria eventos 'log' a partir de diary_entries
    INSERT INTO public.events (profile_id, game_id, type, meta, created_at)
    SELECT 
      de.profile_id,
      de.game_id,
      'log'::public.event_type,
      jsonb_build_object(
        'log_text', substring(de.content, 1, 500), -- Limita a 500 chars
        'diary_id', de.id,
        'generated_by', 'backfill_complete'
      ),
      de.created_at
    FROM public.diary_entries de
    WHERE NOT EXISTS (
        SELECT 1 FROM public.events e 
        WHERE e.profile_id = de.profile_id 
        AND e.game_id = de.game_id 
        AND e.type = 'log'
        AND e.meta->>'diary_id' = de.id::text
    )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ================================================================
-- VERIFICAÇÃO DE RESULTADOS
-- ================================================================

-- Contagem de eventos criados por tipo
SELECT 
  type,
  count(*) as total,
  count(DISTINCT profile_id) as users_affected
FROM public.events
WHERE meta->>'generated_by' = 'backfill_complete'
GROUP BY type
ORDER BY type;

-- Timeline dos últimos 20 eventos criados
SELECT 
  p.username,
  e.type,
  g.name as game_name,
  e.created_at,
  e.meta->>'generated_by' as source
FROM public.events e
LEFT JOIN public.profiles p ON p.id = e.profile_id
LEFT JOIN public.games g ON g.id = e.game_id
ORDER BY e.created_at DESC
LIMIT 20;
