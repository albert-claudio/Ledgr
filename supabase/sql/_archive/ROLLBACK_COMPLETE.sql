-- ================================================================
-- LIMPAR EVENTOS DE BACKFILL DA TIMELINE
-- ================================================================
-- Remove eventos que foram criados pelo backfill automático
-- Isso vai deixar apenas eventos reais de atividade recente

-- Ver quantos eventos serão deletados
SELECT 
  type,
  count(*) as total
FROM public.events
WHERE meta->>'generated_by' = 'backfill_complete'
GROUP BY type;

-- DELETAR eventos de backfill (DESCOMENTAR LINHA ABAIXO QUANDO TIVER CERTEZA)
DELETE FROM public.events 
WHERE meta->>'generated_by' = 'backfill_complete';

-- Verificar que foi limpo
SELECT count(*) FROM public.events;

-- Agora a timeline deve mostrar apenas eventos reais de jogos que você jogou recentemente
