-- ================================================================
-- SCRIPT TEMPORÁRIO: Resetar missões do dia e streak do usuário
-- ================================================================
-- Use este script para limpar as missões de hoje e resetar o streak
-- Este é um script de uso ÚNICO para corrigir o estado atual
-- ================================================================

-- INSTRUÇÕES:
-- 1. Execute este script NO Supabase SQL Editor
-- 2. DEPOIS execute o script 20251209230000_fix_streak_logic.sql
-- 3. DEPOIS configure o Cron Job conforme CRON_JOB_SETUP.md

-- ================================================================
-- PASSO 1: Deletar completações de missões de HOJE
-- ================================================================
-- Isso vai limpar todas as missões que foram marcadas hoje
-- permitindo que você comece do zero

DELETE FROM public.daily_quest_completions
WHERE profile_id = auth.uid()
  AND date = CURRENT_DATE;

-- ================================================================
-- PASSO 2: Resetar o streak para 0
-- ================================================================
-- Isso zera o current_streak mas MANTÉM o longest_streak

UPDATE public.quest_streaks
SET 
  current_streak = 0,
  last_quest_date = NULL,
  updated_at = NOW()
WHERE profile_id = auth.uid();

-- ================================================================
-- VERIFICAÇÃO: Ver o estado atual
-- ================================================================

-- Ver suas missões
SELECT * FROM public.daily_quest_completions
WHERE profile_id = auth.uid()
ORDER BY date DESC
LIMIT 10;

-- Ver seu streak
SELECT * FROM public.quest_streaks
WHERE profile_id = auth.uid();

-- Testar a função get_daily_quests
SELECT public.get_daily_quests();

-- ================================================================
-- RESULTADO ESPERADO:
-- ================================================================
-- ✅ daily_quest_completions: sem registros de hoje
-- ✅ quest_streaks: current_streak = 0, last_quest_date = NULL
-- ✅ get_daily_quests(): opened_app e outra quest = false
-- ================================================================
