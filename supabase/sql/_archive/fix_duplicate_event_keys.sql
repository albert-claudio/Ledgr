-- ================================================================
-- FIX: Eventos com IDs duplicados causando erro de keys no React
-- ================================================================

-- Ver se há IDs duplicados
SELECT id, count(*) 
FROM public.events 
GROUP BY id 
HAVING count(*) > 1;

-- Ver eventos com detalhes para debug
SELECT id, profile_id, type, created_at 
FROM public.events 
ORDER BY id 
LIMIT 20;

-- Se houver eventos temporários/otimistas com IDs baixos (< 1000), deletar
-- DELETE FROM public.events WHERE id < 1000;

-- Resetar a sequence se necessário (CUIDADO: só faça se tiver certeza)
-- SELECT setval('events_id_seq', (SELECT MAX(id) FROM public.events));
