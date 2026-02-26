-- ================================================================
-- CORREÇÃO URGENTE: Erro SQL e Trigger de Rating
-- ================================================================
-- Execute este script para corrigir o erro imediatamente

-- 1. Remove o trigger problemático
drop trigger if exists auto_create_rated_event_on_rating on public.user_ratings;
drop function if exists public.auto_create_rated_event();

-- 2. Remove qualquer constraint problemática
do $$ begin
  alter table public.events drop constraint if exists events_unique_rated;
exception when others then null;
end $$;

-- 3. Deleta eventos "rated" que foram criados erroneamente
-- CUIDADO: Só execute se esses eventos não deveriam estar na timeline
-- DELETE FROM public.events WHERE type = 'rated';

-- Verificar se o trigger foi removido
SELECT trigger_name FROM information_schema.triggers 
WHERE trigger_name = 'auto_create_rated_event_on_rating';
-- Esperado: 0 linhas

-- App deve voltar ao normal após executar isso
