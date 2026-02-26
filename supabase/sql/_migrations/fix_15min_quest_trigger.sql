-- ================================================================
-- FIX: Corrigir trigger de 15 minutos
-- ================================================================
-- O trigger estava procurando duration_minutes, mas o campo correto
-- é meta->>'hours_added' (JSONB) e precisa converter horas para minutos
-- ================================================================

CREATE OR REPLACE FUNCTION public.auto_complete_play_15_minutes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_minutes numeric;
  brasilia_date date;
BEGIN
  -- Só processa eventos de jogatina
  IF NEW.type NOT IN ('started', 'synced', 'log') THEN
    RETURN NEW;
  END IF;
  
  -- Calcula a data de Brasília
  brasilia_date := (timezone('America/Sao_Paulo', now()))::date;
  
  -- Soma todas as HORAS jogadas hoje e converte para minutos
  -- hours_added está em meta JSONB
  SELECT COALESCE(
    SUM((meta->>'hours_added')::numeric) * 60, -- Converte horas para minutos
    0
  )::int
  INTO total_minutes
  FROM public.events
  WHERE profile_id = NEW.profile_id
    AND type IN ('started', 'synced', 'log')
    AND meta->>'hours_added' IS NOT NULL
    AND (timezone('America/Sao_Paulo', created_at))::date = brasilia_date;
  
  -- Log para debug
  RAISE NOTICE 'Quest 15min check: user=%, total_minutes=%, target=15', NEW.profile_id, total_minutes;
  
  -- Se atingiu 15 minutos (0.25 horas), marca como completo
  IF total_minutes >= 15 THEN
    PERFORM public.internal_mark_quest_complete(
      NEW.profile_id,
      'play_15_minutes'::public.quest_type,
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recriar o trigger
DROP TRIGGER IF EXISTS auto_complete_play_15_on_event ON public.events;
CREATE TRIGGER auto_complete_play_15_on_event
  AFTER INSERT OR UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_complete_play_15_minutes();

-- ================================================================
-- TESTE: Verificar se há sessões de hoje
-- ================================================================

SELECT 
  profile_id,
  type,
  meta->>'hours_added' as hours,
  (meta->>'hours_added')::numeric * 60 as minutes,
  created_at
FROM events
WHERE type IN ('started', 'synced', 'log')
  AND meta->>'hours_added' IS NOT NULL
  AND (timezone('America/Sao_Paulo', created_at))::date = (timezone('America/Sao_Paulo', now()))::date
ORDER BY created_at DESC
LIMIT 10;

-- Ver total de minutos de hoje por usuário
SELECT 
  profile_id,
  SUM((meta->>'hours_added')::numeric * 60)::int as total_minutes
FROM events
WHERE type IN ('started', 'synced', 'log')
  AND meta->>'hours_added' IS NOT NULL
  AND (timezone('America/Sao_Paulo', created_at))::date = (timezone('America/Sao_Paulo', now()))::date
GROUP BY profile_id;
