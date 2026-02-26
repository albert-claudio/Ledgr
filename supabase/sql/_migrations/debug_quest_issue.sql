-- ================================================================
-- DEBUG: Verificar por que a missão não foi completada
-- ================================================================
-- Execute no Supabase SQL Editor para diagnosticar o problema
-- ================================================================

-- 1. Ver eventos criados HOJE
SELECT 
  id,
  type,
  created_at,
  game_id,
  steam_appid,
  meta
FROM events
WHERE profile_id = auth.uid()
  AND created_at::date = CURRENT_DATE
ORDER BY created_at DESC
LIMIT 10;

-- 2. Ver completações de missões HOJE
SELECT 
  id,
  quest_type,
  completed_at,
  related_event_id,
  date
FROM daily_quest_completions
WHERE profile_id = auth.uid()
  AND date = CURRENT_DATE
ORDER BY completed_at DESC;

-- 3. Ver status atual das missões
SELECT get_daily_quests();

-- 4. Verificar a versão atual do trigger
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'auto_complete_played_quest';

-- ================================================================
-- INTERPRETAÇÃO DOS RESULTADOS:
-- ================================================================
-- 
-- Query 1: Deve mostrar o evento que você criou ao jogar
--   - Anote o 'type' do evento (started, synced, log, etc.)
--
-- Query 2: Deve estar VAZIO se a missão não foi completada
--   - Se estiver vazio = trigger não funcionou
--
-- Query 3: Deve mostrar played: false
--
-- Query 4: Deve mostrar se o trigger tem a linha:
--   if new.type in ('started', 'synced', 'log') then
--   
--   Se ainda mostrar:
--   if new.type in ('synced', 'log') then
--   = VOCÊ AINDA NÃO APLICOU O SCRIPT DE MIGRAÇÃO!
