-- ================================================================
-- FIX: Mudar função get_daily_quests de STABLE para VOLATILE
-- ================================================================
-- STABLE = read-only, mas a função precisa fazer INSERT
-- VOLATILE = permite modificações no banco
-- ================================================================

CREATE OR REPLACE FUNCTION public.get_daily_quests()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE -- Mudou de STABLE para VOLATILE
AS $$
DECLARE
  user_id uuid;
  brasilia_date date;
  active_quests public.quest_type[];
  quest_status jsonb;
  streak_info record;
BEGIN
  -- Valida auth
  user_id := auth.uid();
  IF user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Data de hoje no horário de Brasília
  brasilia_date := (timezone('America/Sao_Paulo', now()))::date;
  
  -- Obtém quais quests estão ativas hoje
  active_quests := public.get_active_quest_types();
  
  -- Marca "opened_app" como completo (usuário está usando o app agora)
  PERFORM public.internal_mark_quest_complete(
    user_id,
    'opened_app'::public.quest_type,
    NULL
  );
  
  -- Busca status das quests ativas
  SELECT 
    jsonb_build_object(
      active_quests[1]::text, EXISTS(
        SELECT 1 FROM public.daily_quest_completions 
        WHERE profile_id = user_id 
          AND quest_type = active_quests[1]
          AND date = brasilia_date
      ),
      active_quests[2]::text, EXISTS(
        SELECT 1 FROM public.daily_quest_completions 
        WHERE profile_id = user_id 
          AND quest_type = active_quests[2]
          AND date = brasilia_date
      )
    ) INTO quest_status;
  
  -- Busca streak
  SELECT current_streak, longest_streak 
  INTO streak_info
  FROM public.quest_streaks
  WHERE profile_id = user_id;
  
  IF NOT FOUND THEN
    streak_info.current_streak := 0;
    streak_info.longest_streak := 0;
  END IF;
  
  RETURN quest_status || jsonb_build_object(
    'current_streak', streak_info.current_streak,
    'longest_streak', streak_info.longest_streak,
    'date', brasilia_date,
    'active_quests', to_jsonb(active_quests)
  );
END;
$$;

-- ================================================================
-- TESTAR
-- ================================================================

SELECT public.get_daily_quests();
-- Deve retornar as quests do dia com opened_app marcado como true
