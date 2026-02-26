-- ================================================================
-- LIMPAR TIMELINE: Remover jogos sem sessões reais
-- ================================================================
-- Remove eventos "started" de jogos que só estão na biblioteca
-- mas não têm sessões registradas (sem atividade real)

-- PASSO 1: Ver quantos eventos serão deletados
SELECT 
  e.type,
  count(*) as total,
  count(distinct e.profile_id) as usuarios
FROM public.events e
WHERE e.meta->>'generated_by' = 'backfill_complete'
GROUP BY e.type;

-- PASSO 2: Deletar eventos de backfill
-- Estes foram gerados automaticamente e poluem a timeline
DELETE FROM public.events 
WHERE meta->>'generated_by' = 'backfill_complete';

-- PASSO 3: Verificar que a timeline ficou limpa
SELECT 
  e.type,
  count(*) as total
FROM public.events e
WHERE e.profile_id = auth.uid()
GROUP BY e.type
ORDER BY e.type;

-- RESULTADO ESPERADO:
-- ✅ Timeline mostra apenas eventos com sessões reais (synced, log)
-- ✅ Remove eventos "started" sem atividade
-- ✅ Remove eventos "finished" gerados pelo backfill
-- ✅ Remove eventos "rated" criados pelo backfill

-- A partir de agora, novos eventos só serão criados quando você:
-- - Jogar um jogo (cria evento synced/log automaticamente)
-- - Completar uma quest (não aparece na timeline)
