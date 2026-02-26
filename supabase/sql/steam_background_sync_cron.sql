-- ================================================================
-- STEAM BACKGROUND SYNC - CRON JOB CONFIGURATION
-- ================================================================
-- Este script configura a sincronização automática do Steam em background
-- que funciona mesmo com o app fechado/celular desligado.
-- 
-- REQUISITOS:
-- 1. Ativar extensão pg_cron no Dashboard: Database > Extensions > pg_cron
-- 2. Ativar extensão pg_net no Dashboard: Database > Extensions > pg_net
-- 
-- ⚠️ IMPORTANTE: Substitua [PROJECT_ID] e [SERVICE_ROLE_KEY] pelos seus valores!
--    - PROJECT_ID: Encontre em Project Settings > General
--    - SERVICE_ROLE_KEY: Encontre em Project Settings > API > service_role key
-- ================================================================

-- ================================================================
-- PASSO 1: Verificar se as extensões estão ativas
-- ================================================================
-- Execute isso primeiro para verificar:
-- SELECT * FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net');

-- ================================================================
-- PASSO 2: Remover job antigo (se existir)
-- ================================================================
SELECT cron.unschedule('steam-background-sync');

-- ================================================================
-- PASSO 3: Criar o Cron Job para sync automática
-- ================================================================
-- Executa a cada 4 horas (00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC)
-- Isso garante que mesmo sem o app aberto, os dados são sincronizados
--
-- ⚠️ SUBSTITUA [PROJECT_ID] e [SERVICE_ROLE_KEY] ANTES DE EXECUTAR!

SELECT cron.schedule(
  'steam-background-sync',
  '0 */4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://unbkpvuihlcdbycwprwm.supabase.co/functions/v1/steam_sync_scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer [SERVICE_ROLE_KEY]'
    ),
    body := '{"source": "cron"}'::jsonb
  );
  $$
);

-- ================================================================
-- PASSO 3: Verificar se o job foi criado
-- ================================================================
SELECT * FROM cron.job WHERE jobname = 'steam-background-sync';

-- ================================================================
-- COMANDOS ÚTEIS
-- ================================================================

-- Ver histórico de execuções:
-- SELECT * FROM cron.job_run_details 
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'steam-background-sync')
-- ORDER BY start_time DESC LIMIT 10;

-- Remover o job se necessário:
-- SELECT cron.unschedule('steam-background-sync');

-- Executar manualmente (para testes):
-- SELECT net.http_post(
--   url := 'https://[PROJECT_ID].supabase.co/functions/v1/steam_sync_scheduler',
--   headers := jsonb_build_object(
--     'Content-Type', 'application/json',
--     'Authorization', 'Bearer [SERVICE_ROLE_KEY]'
--   ),
--   body := '{"source": "manual"}'::jsonb
-- );

-- ================================================================
-- ALTERNATIVA: Para planos Free sem pg_cron
-- ================================================================
-- Se você está no plano Free do Supabase, pode usar:
-- 1. GitHub Actions com schedule
-- 2. Render Cron Jobs (gratuito)
-- 3. Vercel Cron
-- 4. cron-job.org (gratuito)
-- 
-- Exemplo de curl para chamar externamente:
-- curl -X POST 'https://[PROJECT_ID].supabase.co/functions/v1/steam_sync_scheduler' \
--   -H 'Authorization: Bearer [SERVICE_ROLE_KEY]' \
--   -H 'Content-Type: application/json'
