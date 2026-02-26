-- ================================================================
-- CORREÇÃO: Atualizar Eventos Existentes com Horas Corretas
-- ================================================================
-- Este script atualiza os eventos 'started' que foram criados
-- pelo backfill para incluir as horas jogadas e usar data correta
-- ================================================================

-- 1. Atualizar eventos 'started' com horas e data correta
UPDATE public.events e
SET 
  meta = jsonb_build_object(
    'platform', 'PC',
    'status', 'playing',
    'total_hours', round((ug.minutes_played::numeric / 60), 1),
    'sessions_count', ug.sessions_count,
    'generated_by', e.meta->>'generated_by'
  ),
  created_at = COALESCE(ug.last_session_at, ug.updated_at, e.created_at)
FROM public.user_games ug
WHERE e.profile_id = ug.profile_id
  AND e.game_id = ug.game_id
  AND e.type = 'started'
  AND (e.meta->>'generated_by' = 'backfill' OR e.meta->>'generated_by' = 'backfill_complete');

-- 2. Verificar os 10 eventos mais recentes
SELECT 
  p.username,
  e.type,
  g.name as jogo,
  e.meta->>'total_hours' as horas,
  e.created_at,
  e.meta->>'generated_by' as fonte
FROM public.events e
LEFT JOIN public.profiles p ON p.id = e.profile_id
LEFT JOIN public.games g ON g.id = e.game_id
WHERE e.type = 'started'
ORDER BY e.created_at DESC
LIMIT 10;
