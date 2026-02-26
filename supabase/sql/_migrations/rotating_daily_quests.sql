-- ================================================================
-- MIGRAÇÃO: Daily Quests Rotativas com Horário de Brasília
-- ================================================================
-- Execute este script no Supabase SQL Editor para aplicar as mudanças
-- Data: 2025-12-07
-- ================================================================

-- IMPORTANTE: Este script atualiza o sistema de daily quests para:
-- 1. Suportar 4 novos tipos de quests rotativas
-- 2. Usar horário de Brasília (America/Sao_Paulo) para reset às 23:59
-- 3. Alternar quests diariamente baseado em dia par/ímpar

-- Execute o arquivo completo: supabase/sql/daily_quests.sql
-- Ou copie e cole o conteúdo deste arquivo no SQL Editor

\i 'daily_quests.sql'

-- ================================================================
-- VERIFICAÇÃO PÓS-MIGRAÇÃO
-- ================================================================

-- 1. Verificar se os novos quest types foram adicionados
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'quest_type' 
      AND e.enumlabel = 'opened_app'
  ) THEN
    RAISE EXCEPTION 'Falha: quest_type "opened_app" não foi criado';
  END IF;
  
  RAISE NOTICE 'Sucesso: Novos quest types foram adicionados';
END $$;

-- 2. Verificar se as funções foram criadas
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'get_active_quest_types',
    'get_daily_quests',
    'internal_mark_quest_complete',
    'auto_complete_play_15_minutes',
    'auto_complete_write_review',
    'auto_complete_play_old_game'
  )
ORDER BY routine_name;
-- Esperado: 6 funções

-- 3. Verificar triggers
SELECT 
  trigger_name,
  event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE '%quest%'
ORDER BY trigger_name;
-- Esperado: 5+ triggers

-- 4. Testar a função de quests ativas (deve retornar 2 quest types)
SELECT public.get_active_quest_types();
-- Esperado: array com 2 elementos

-- 5. Testar get_daily_quests (vai marcar opened_app como completo automaticamente)
SELECT public.get_daily_quests();
-- Esperado: JSON com as 2 quests do dia + streak info + active_quests array

-- ================================================================
-- DEBUG: Se algo não funcionar
-- ================================================================

-- Ver todos os quest types disponíveis
SELECT e.enumlabel as quest_type
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname = 'quest_type'
ORDER BY e.enumsortorder;

-- Ver suas completações de hoje
SELECT 
  quest_type,
  completed_at,
  date
FROM daily_quest_completions
WHERE profile_id = auth.uid()
  AND date = (timezone('America/Sao_Paulo', now()))::date
ORDER BY completed_at;

-- Ver seu streak atual
SELECT * 
FROM quest_streaks 
WHERE profile_id = auth.uid();
