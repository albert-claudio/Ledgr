-- ================================================================
-- DEBUG: Daily Quests System
-- ================================================================
-- Execute estas queries para investigar por que a missão não completou

-- 1. Verificar se as tabelas existem
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('daily_quest_completions', 'quest_streaks');
-- Esperado: 2 linhas

-- 2. Verificar se o trigger existe na tabela user_games
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'user_games'
  AND trigger_name LIKE '%quest%';
-- Esperado: auto_complete_collection_on_insert

-- 3. Verificar se a função do trigger existe
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'auto_complete_collection_quest';
-- Esperado: 1 linha

-- 4. Verificar se você tem timezone configurado
SELECT id, username, timezone 
FROM profiles 
WHERE id = auth.uid();

-- 5. Ver quais missões você já completou hoje
SELECT 
  quest_type,
  date,
  completed_at at time zone 'America/Sao_Paulo' as completed_local
FROM daily_quest_completions
WHERE profile_id = auth.uid()
  AND date >= current_date - interval '3 days'
ORDER BY completed_at DESC;

-- 6. Ver seu streak atual
SELECT * FROM quest_streaks WHERE profile_id = auth.uid();

-- 7. Ver status atual das missões
SELECT public.get_daily_quests();

-- 8. Verificar jogos na sua coleção (últimos 5)
SELECT 
  id,
  game_id,
  profile_id,
  status,
  created_at at time zone 'America/Sao_Paulo' as created_local
FROM user_games
WHERE profile_id = auth.uid()
ORDER BY created_at DESC
LIMIT 5;

-- 9. TESTE MANUAL: Adicionar jogo fictício para testar o trigger
-- ATENÇÃO: Só rode se quiser testar manualmente
/*
INSERT INTO user_games (profile_id, game_id, status)
VALUES (auth.uid(), 999999, 'backlog');

-- Depois verificar se a missão foi completada:
SELECT public.get_daily_quests();
*/

-- 10. Ver logs de erro (se tiver permissão)
-- Verificar se há erros na função do trigger
SELECT * FROM pg_stat_statements 
WHERE query LIKE '%auto_complete_collection%'
ORDER BY calls DESC
LIMIT 5;
