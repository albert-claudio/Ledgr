-- ================================================================
-- FIX: Robust Streak Logic - Fechar todas as brechas
-- ================================================================
-- Data: 2025-12-10
-- Objetivo: Corrigir vulnerabilidades que permitem streak incorreto
--
-- BRECHAS CORRIGIDAS:
-- 1. get_daily_quests() auto-completava opened_app (REMOVIDO)
-- 2. internal_mark_quest_complete não validava se quest é ativa (VALIDAÇÃO ADICIONADA)
-- 3. Cron job para reset_inactive_streaks não configurado (AGENDADO)
-- 4. Faltava validação se usuário completou ontem antes de incrementar (VALIDAÇÃO ADICIONADA)
-- ================================================================

-- ================================================================
-- PASSO 1: Recriar get_daily_quests SEM auto-complete
-- ================================================================
-- ANTES: Marcava opened_app automaticamente
-- DEPOIS: Apenas retorna status, sem side effects

create or replace function public.get_daily_quests()
returns jsonb
language plpgsql
security definer
stable -- Mudou de VOLATILE para STABLE (não faz mais INSERT)
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
  
  -- ❌ REMOVIDO: NÃO marca opened_app automaticamente
  -- O usuário precisa completar quests legitimamente via triggers ou mark_app_opened()
  
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
-- PASSO 2: Criar mark_app_opened para uso explícito
-- ================================================================
-- Esta função deve ser chamada pelo app quando o usuário
-- realmente interage (não apenas ao carregar dados)

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
    raise notice '[mark_app_opened] ✅ Marked for user %', user_id;
  else
    raise notice '[mark_app_opened] ⏭️ opened_app not active today';
  end if;
end;
$$;

-- ================================================================
-- PASSO 3: Recriar internal_mark_quest_complete COM VALIDAÇÕES
-- ================================================================
-- VALIDAÇÕES ADICIONADAS:
-- 1. Verifica se quest está entre as 2 ativas do dia
-- 2. Verifica se usuário completou TODAS as quests ontem antes de incrementar
-- 3. Só incrementa streak se ambas as quests de hoje estiverem completas

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
  yesterday_completed boolean;
begin
  -- Usa horário de Brasília para determinar o dia
  brasilia_date := (timezone('America/Sao_Paulo', now()))::date;
  yesterday := brasilia_date - interval '1 day';
  
  -- Obtém as quests ativas do dia ANTES de inserir
  active_quests := public.get_active_quest_types();
  
  -- ✅ VALIDAÇÃO 1: Verifica se a quest que está sendo marcada é uma das ativas hoje
  if q_type != all(active_quests) then
    raise notice '[Quest] ⏭️ Ignoring % - not active today (active: %, %)', 
      q_type, active_quests[1], active_quests[2];
    return;
  end if;
  
  raise notice '[Quest] ✅ Quest % is active today', q_type;
  
  -- Tenta inserir (pode falhar se já existe)
  begin
    insert into public.daily_quest_completions (profile_id, quest_type, date, related_event_id)
    values (user_id, q_type, brasilia_date, event_id);
    raise notice '[Quest] ✅ Marked % complete for user % on %', q_type, user_id, brasilia_date;
  exception
    when unique_violation then
      -- Já completou, ignora
      raise notice '[Quest] ⏭️ Quest % already completed today', q_type;
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
    raise notice '[Quest] ⏳ % marked, waiting for other quest (quest1: %, quest2: %)', 
      q_type, quest1_done, quest2_done;
    return;
  end if;
  
  raise notice '[Quest] 🎉 Both quests complete! Updating streak for user %', user_id;
  
  -- Atualiza streak
  select * into streak_record
  from public.quest_streaks
  where profile_id = user_id
  for update;
  
  if not found then
    -- Primeira vez completando quests
    insert into public.quest_streaks (profile_id, current_streak, longest_streak, last_quest_date)
    values (user_id, 1, 1, brasilia_date);
    raise notice '[Quest] 🔥 First streak for user % (1 day)', user_id;
    return;
  end if;
  
  -- Se já completou todas hoje, não atualiza streak novamente
  if streak_record.last_quest_date = brasilia_date then
    raise notice '[Quest] ⏭️ Already updated streak today for user %', user_id;
    return;
  end if;
  
  -- ✅ VALIDAÇÃO 2: Verifica se completou TODAS as quests ontem
  -- Isso previne incrementar streak se pulou dias
  if streak_record.last_quest_date = yesterday then
    -- Usuário completou ontem, continua o streak
    new_streak := streak_record.current_streak + 1;
    raise notice '[Quest] 🔥 Continuing streak: % → % days', streak_record.current_streak, new_streak;
  elsif streak_record.last_quest_date < yesterday or streak_record.last_quest_date is null then
    -- Usuário pulou um ou mais dias, reseta streak
    new_streak := 1;
    raise notice '[Quest] 💀 Streak broken! Starting new: % → 1 day (last was %)', 
      streak_record.current_streak, streak_record.last_quest_date;
  else
    -- last_quest_date > brasilia_date: impossível (clock skew?)
    raise warning '[Quest] ⚠️ Clock skew detected? last_quest_date=% > today=%', 
      streak_record.last_quest_date, brasilia_date;
    new_streak := 1;
  end if;
  
  new_longest := greatest(streak_record.longest_streak, new_streak);
  
  update public.quest_streaks
  set 
    current_streak = new_streak,
    longest_streak = new_longest,
    last_quest_date = brasilia_date,
    updated_at = now()
  where profile_id = user_id;
  
  raise notice '[Quest] ✅ Streak updated: current=%, longest=%', new_streak, new_longest;
end;
$$;

-- ================================================================
-- PASSO 4: Configurar Cron Job para reset automático
-- ================================================================
-- Reseta streaks de usuários inativos diariamente à meia-noite (Brasília)

-- Verifica se extensão pg_cron está ativa
do $$
begin
  if not exists (
    select 1 from pg_extension where extname = 'pg_cron'
  ) then
    raise notice '[Cron] ⚠️ pg_cron extension not found. Install it first:';
    raise notice '[Cron]    CREATE EXTENSION pg_cron;';
  else
    raise notice '[Cron] ✅ pg_cron extension found';
  end if;
end $$;

-- Remove job antigo se existir
select cron.unschedule('reset-inactive-streaks-daily')
where exists (
  select 1 from cron.job where jobname = 'reset-inactive-streaks-daily'
);

-- Agenda novo job
-- Roda às 3h UTC = meia-noite em Brasília (UTC-3)
select cron.schedule(
  'reset-inactive-streaks-daily',
  '0 3 * * *',
  $$SELECT public.reset_inactive_streaks();$$
);

-- ================================================================
-- PASSO 5: Resetar streaks inválidos (limpeza)
-- ================================================================
-- Zera streaks que foram incrementados incorretamente
-- (usuários que não completaram todas as quests mas têm streak > 0)

do $$
declare
  affected_count int;
  brasilia_date date;
  yesterday date;
begin
  brasilia_date := (timezone('America/Sao_Paulo', now()))::date;
  yesterday := brasilia_date - interval '1 day';
  
  -- Reseta streaks de usuários que:
  -- 1. Têm streak > 0 (estavam em sequência)
  -- 2. last_quest_date < ontem (não completaram ontem)
  update public.quest_streaks
  set 
    current_streak = 0,
    updated_at = now()
  where current_streak > 0
    and (last_quest_date < yesterday or last_quest_date is null);
  
  get diagnostics affected_count = row_count;
  raise notice '[Cleanup] 💀 Reset % invalid streaks', affected_count;
end $$;

-- ================================================================
-- VERIFICAÇÃO
-- ================================================================

-- 1. Verificar que funções foram atualizadas
select 
  routine_name,
  volatility, -- get_daily_quests deve ser STABLE
  security_type
from information_schema.routines 
where routine_schema = 'public' 
  and routine_name in ('get_daily_quests', 'mark_app_opened', 'internal_mark_quest_complete')
order by routine_name;

-- 2. Verificar cron job agendado
select 
  jobid,
  jobname, 
  schedule, 
  command,
  active
from cron.job 
where jobname = 'reset-inactive-streaks-daily';

-- 3. Verificar quests ativas hoje
select public.get_active_quest_types() as active_quests_today;

-- 4. Verificar streaks resetados
select 
  count(*) filter (where current_streak = 0) as streaks_zerados,
  count(*) filter (where current_streak > 0) as streaks_ativos,
  max(current_streak) as maior_streak_ativo
from public.quest_streaks;

-- ================================================================
-- RESULTADO ESPERADO
-- ================================================================
-- ✅ get_daily_quests: volatility = STABLE (não faz mais INSERT)
-- ✅ mark_app_opened: criado para uso explícito
-- ✅ internal_mark_quest_complete: valida quests ativas + ontem completo
-- ✅ Cron job agendado para rodar diariamente
-- ✅ Streaks inválidos resetados
-- ================================================================
