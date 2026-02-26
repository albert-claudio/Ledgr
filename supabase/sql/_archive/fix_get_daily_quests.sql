-- ================================================================
-- FIX: Re-apply get_daily_quests function
-- ================================================================

-- 1. Drop existing function to ensure clean slate
DROP FUNCTION IF EXISTS public.get_daily_quests();

-- 2. Re-create the function
CREATE OR REPLACE FUNCTION public.get_daily_quests()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_id uuid;
  today date;
  quest_status jsonb;
  streak_info record;
BEGIN
  -- SEGURANÇA: Valida auth
  user_id := auth.uid();
  IF user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Obtém data de hoje no timezone do usuário
  today := public.get_user_date(user_id);
  
  -- Busca o status das missões do dia
  SELECT 
    jsonb_build_object(
      'played', EXISTS(
        SELECT 1 FROM public.daily_quest_completions 
        WHERE profile_id = user_id 
          AND quest_type = 'played' 
          AND date = today
      ),
      'rated', EXISTS(
        SELECT 1 FROM public.daily_quest_completions 
        WHERE profile_id = user_id 
          AND quest_type = 'rated' 
          AND date = today
      ),
      'added_to_collection', EXISTS(
        SELECT 1 FROM public.daily_quest_completions 
        WHERE profile_id = user_id 
          AND quest_type = 'added_to_collection' 
          AND date = today
      )
    ) INTO quest_status;
  
  -- Busca informações de streak
  SELECT current_streak, longest_streak 
  INTO streak_info
  FROM public.quest_streaks
  WHERE profile_id = user_id;
  
  -- Se não existir registro de streak, usa valores padrão
  IF NOT FOUND THEN
    streak_info.current_streak := 0;
    streak_info.longest_streak := 0;
  END IF;
  
  -- Combina tudo em um único objeto
  RETURN quest_status || jsonb_build_object(
    'current_streak', streak_info.current_streak,
    'longest_streak', streak_info.longest_streak,
    'date', today
  );
END;
$$;

-- 3. Grant permissions explicitly
GRANT EXECUTE ON FUNCTION public.get_daily_quests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_quests() TO service_role;

-- 4. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload config';
