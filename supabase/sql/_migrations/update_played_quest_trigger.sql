-- ================================================================
-- ATUALIZAÇÃO: Melhorar detecção da missão "played"
-- ================================================================
-- Este script atualiza o trigger para detectar mais tipos de eventos
-- Execute no Supabase SQL Editor
-- ================================================================

-- Atualizar trigger para detectar: started, synced, log
create or replace function public.auto_complete_played_quest()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Detecta quando usuário joga: started (inicia jogo), synced (Steam sync), log (log manual)
  if new.type in ('started', 'synced', 'log') then
    perform public.internal_mark_quest_complete(
      new.profile_id,
      'played'::public.quest_type,
      new.id
    );
  end if;
  return new;
end;
$$;

-- Verificação
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'auto_complete_played_quest';
