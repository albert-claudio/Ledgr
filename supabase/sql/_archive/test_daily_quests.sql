-- ================================================================
-- TESTE: Função temporária para testar no SQL Editor
-- ================================================================
-- Esta versão aceita user_id como parâmetro para testar
-- NO APP, use get_daily_quests() sem parâmetros

create or replace function public.get_daily_quests_test(test_user_id uuid)
returns jsonb
language plpgsql
security definer
stable
as $$
declare
  today date;
  quest_status jsonb;
  streak_info record;
begin
  today := current_date;
  
  select 
    jsonb_build_object(
      'played', exists(
        select 1 from public.daily_quest_completions 
        where profile_id = test_user_id 
          and quest_type = 'played' 
          and date = today
      ),
      'added_to_collection', exists(
        select 1 from public.daily_quest_completions 
        where profile_id = test_user_id 
          and quest_type = 'added_to_collection' 
          and date = today
      )
    ) into quest_status;
  
  select current_streak, longest_streak 
  into streak_info
  from public.quest_streaks
  where profile_id = test_user_id;
  
  if not found then
    streak_info.current_streak := 0;
    streak_info.longest_streak := 0;
  end if;
  
  return quest_status || jsonb_build_object(
    'current_streak', streak_info.current_streak,
    'longest_streak', streak_info.longest_streak,
    'date', today
  );
end;
$$;

-- TESTE: Use sua profile_id
SELECT public.get_daily_quests_test('[SEU-USER-ID-AQUI]'::uuid);

-- Ou pegue seu ID automaticamente se estiver logado:
SELECT public.get_daily_quests_test(id) 
FROM profiles 
WHERE id = auth.uid();

-- ================================================================
-- A função REAL (get_daily_quests sem parâmetros) está correta
-- e vai funcionar no app automaticamente!
-- ================================================================
