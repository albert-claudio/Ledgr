-- ================================================================
-- FIX: Streak Logic - Não incrementar streak incorretamente
-- ================================================================
-- Problema: O streak estava aumentando mesmo sem completar as quests
-- porque opened_app era marcado automaticamente ao chamar get_daily_quests()
-- 
-- Solução: 
-- 1. Remover o auto-complete de opened_app do get_daily_quests()
-- 2. Criar trigger separado para opened_app baseado em ação real do usuário
-- ================================================================

-- ================================================================
-- PASSO 1: Recriar get_daily_quests SEM auto-complete de opened_app
-- ================================================================

create or replace function public.get_daily_quests()
returns jsonb
language plpgsql
security definer
stable -- Agora é STABLE porque não faz mais INSERT
as $$
declare
  user_id uuid;
  brasilia_date date;
  active_quests public.quest_type[];
  quest_status jsonb;
  streak_info record;
begin
  -- Valida auth
  user_id := auth.uid();
  if user_id is null then
    raise exception 'Not authenticated';
  end if;
  
  -- Data de hoje no horário de Brasília
  brasilia_date := (timezone('America/Sao_Paulo', now()))::date;
  
  -- Obtém quais quests estão ativas hoje
  active_quests := public.get_active_quest_types();
  
  -- NÃO MARCA MAIS opened_app automaticamente aqui!
  -- O usuário precisa completar as quests de forma legítima
  
  -- Busca status das quests ativas
  select 
    jsonb_build_object(
      active_quests[1]::text, exists(
        select 1 from public.daily_quest_completions 
        where profile_id = user_id 
          and quest_type = active_quests[1]
          and date = brasilia_date
      ),
      active_quests[2]::text, exists(
        select 1 from public.daily_quest_completions 
        where profile_id = user_id 
          and quest_type = active_quests[2]
          and date = brasilia_date
      )
    ) into quest_status;
  
  -- Busca streak
  select current_streak, longest_streak 
  into streak_info
  from public.quest_streaks
  where profile_id = user_id;
  
  if not found then
    streak_info.current_streak := 0;
    streak_info.longest_streak := 0;
  end if;
  
  return quest_status || jsonb_build_object(
    'current_streak', streak_info.current_streak,
    'longest_streak', streak_info.longest_streak,
    'date', brasilia_date,
    'active_quests', to_jsonb(active_quests)
  );
end;
$$;

-- ================================================================
-- PASSO 2: Criar função para marcar opened_app explicitamente
-- ================================================================
-- Esta função deve ser chamada pelo app quando o usuário realmente
-- interage com o app (não apenas ao carregar dados)

create or replace function public.mark_app_opened()
returns void
language plpgsql
security definer
as $$
declare
  user_id uuid;
  brasilia_date date;
  active_quests public.quest_type[];
begin
  user_id := auth.uid();
  if user_id is null then
    raise exception 'Not authenticated';
  end if;
  
  brasilia_date := (timezone('America/Sao_Paulo', now()))::date;
  active_quests := public.get_active_quest_types();
  
  -- Só marca se opened_app é uma das quests ativas do dia
  if 'opened_app'::public.quest_type = any(active_quests) then
    perform public.internal_mark_quest_complete(
      user_id,
      'opened_app'::public.quest_type,
      null
    );
  end if;
end;
$$;

-- ================================================================
-- PASSO 3: Corrigir a lógica de verificação de quests completas
-- ================================================================
-- A função internal_mark_quest_complete precisa verificar que
-- AMBAS as quests ativas do dia estão completas antes de incrementar

create or replace function public.internal_mark_quest_complete(
  user_id uuid,
  q_type public.quest_type,
  event_id bigint default null
)
returns void
language plpgsql
security definer
as $$
declare
  brasilia_date date;
  yesterday date;
  streak_record record;
  new_streak int;
  new_longest int;
  active_quests public.quest_type[];
  quest1_done boolean;
  quest2_done boolean;
begin
  -- Usa horário de Brasília para determinar o dia
  brasilia_date := (timezone('America/Sao_Paulo', now()))::date;
  yesterday := brasilia_date - interval '1 day';
  
  -- Obtém as quests ativas do dia ANTES de inserir
  active_quests := public.get_active_quest_types();
  
  -- Verifica se a quest que está sendo marcada é uma das ativas hoje
  -- Se não for, ignora (para evitar completar quests de outros dias)
  if q_type != all(active_quests) then
    raise notice '[Quest] Ignoring % - not active today (active: %, %)', 
      q_type, active_quests[1], active_quests[2];
    return;
  end if;
  
  -- Tenta inserir (pode falhar se já existe)
  begin
    insert into public.daily_quest_completions (profile_id, quest_type, date, related_event_id)
    values (user_id, q_type, brasilia_date, event_id);
  exception
    when unique_violation then
      -- Já completou, ignora
      return;
  end;
  
  -- Se chegou aqui, inseriu com sucesso
  -- Agora verifica se AMBAS as quests ativas do dia estão completas
  
  select exists(
    select 1 from public.daily_quest_completions
    where profile_id = user_id 
      and quest_type = active_quests[1]
      and date = brasilia_date
  ) into quest1_done;
  
  select exists(
    select 1 from public.daily_quest_completions
    where profile_id = user_id 
      and quest_type = active_quests[2]
      and date = brasilia_date
  ) into quest2_done;
  
  -- Só atualiza streak se AMBAS estão completas
  if not (quest1_done and quest2_done) then
    raise notice '[Quest] % marked complete, but waiting for other quest', q_type;
    return;
  end if;
  
  raise notice '[Quest] Both quests complete! Updating streak for user %', user_id;
  
  -- Atualiza streak
  select * into streak_record
  from public.quest_streaks
  where profile_id = user_id
  for update;
  
  if not found then
    -- Primeira vez
    insert into public.quest_streaks (profile_id, current_streak, longest_streak, last_quest_date)
    values (user_id, 1, 1, brasilia_date);
    raise notice '[Quest] First streak for user %', user_id;
    return;
  end if;
  
  -- Se já completou todas hoje, não atualiza streak novamente
  if streak_record.last_quest_date = brasilia_date then
    raise notice '[Quest] Already updated streak today for user %', user_id;
    return;
  end if;
  
  -- Calcula novo streak
  if streak_record.last_quest_date = yesterday then
    new_streak := streak_record.current_streak + 1;
    raise notice '[Quest] Continuing streak: % -> %', streak_record.current_streak, new_streak;
  else
    new_streak := 1;
    raise notice '[Quest] Starting new streak (last was %)', streak_record.last_quest_date;
  end if;
  
  new_longest := greatest(streak_record.longest_streak, new_streak);
  
  update public.quest_streaks
  set 
    current_streak = new_streak,
    longest_streak = new_longest,
    last_quest_date = brasilia_date,
    updated_at = now()
  where profile_id = user_id;
end;
$$;

-- ================================================================
-- PASSO 4: Resetar streaks incorretos (opcional - limpeza)
-- ================================================================
-- Se você quiser resetar streaks que foram incrementados incorretamente,
-- descomente e execute este bloco:

-- UPDATE public.quest_streaks
-- SET current_streak = 0
-- WHERE profile_id = 'SEU_USER_ID_AQUI'::uuid;

-- ================================================================
-- VERIFICAÇÃO
-- ================================================================

-- Verificar que as funções foram criadas
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('get_daily_quests', 'mark_app_opened', 'internal_mark_quest_complete');

-- Verificar quais quests estão ativas hoje
SELECT public.get_active_quest_types();
