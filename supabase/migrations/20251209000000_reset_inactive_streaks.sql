-- ================================================================
-- DAILY QUESTS - AUTO RESET INACTIVE STREAKS
-- ================================================================
-- Esta migration adiciona funcionalidade para resetar automaticamente
-- streaks de usuários que não completaram todas as quests do dia anterior
-- ================================================================

-- Função para resetar streaks de usuários inativos
create or replace function public.reset_inactive_streaks()
returns void
language plpgsql
security definer
as $$
declare
  brasilia_date date;
  yesterday date;
  affected_count int;
begin
  -- Usa horário de Brasília (America/Sao_Paulo = UTC-3)
  brasilia_date := (timezone('America/Sao_Paulo', now()))::date;
  yesterday := brasilia_date - interval '1 day';
  
  -- Reseta streak para usuários que:
  -- 1. Têm streak > 0 (estavam em uma sequência)
  -- 2. NÃO completaram todas as quests ontem (quebrou a sequência)
  --    - last_quest_date < yesterday: pulou um ou mais dias
  --    - last_quest_date is null: nunca completou quests
  update public.quest_streaks
  set 
    current_streak = 0,
    updated_at = now()
  where current_streak > 0
    and (last_quest_date < yesterday or last_quest_date is null);
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  raise notice '[Daily Quests] Reset % inactive streaks at %', affected_count, brasilia_date;
end;
$$;

-- Comentário para documentação
comment on function public.reset_inactive_streaks() is 
  'Reseta streaks de usuários que não completaram todas as quests do dia anterior. Deve rodar diariamente à meia-noite (via Cron Job).';

-- ================================================================
-- INSTRUÇÕES DE CONFIGURAÇÃO DO CRON JOB
-- ================================================================
-- 
-- No Supabase Dashboard:
-- 1. Vá em "Database" > "Extensions"
-- 2. Ative a extensão "pg_cron" se ainda não estiver ativa
-- 
-- 3. Execute o seguinte comando SQL para criar o Cron Job:
--
-- SELECT cron.schedule(
--   'reset-inactive-streaks-daily',           -- Nome do job
--   '0 3 * * *',                               -- Schedule: 3h AM UTC = meia-noite em Brasília (UTC-3)
--   $$SELECT public.reset_inactive_streaks();$$
-- );
--
-- 4. Para verificar se o job foi criado:
-- SELECT * FROM cron.job WHERE jobname = 'reset-inactive-streaks-daily';
--
-- 5. Para monitorar execuções:
-- SELECT * FROM cron.job_run_details 
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'reset-inactive-streaks-daily')
-- ORDER BY start_time DESC 
-- LIMIT 10;
--
-- 6. Para deletar o job (se necessário):
-- SELECT cron.unschedule('reset-inactive-streaks-daily');
--
-- ================================================================
-- NOTAS IMPORTANTES
-- ================================================================
-- - O horário '0 3 * * *' significa 3h AM UTC
-- - Como Brasília está em UTC-3, isso equivale a meia-noite (00:00) em horário de Brasília
-- - A função usa timezone('America/Sao_Paulo', now()) para garantir consistência
-- - Usuários que abrirem o app após perder o streak verão streak = 0
-- ================================================================
