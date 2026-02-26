-- ================================================================
-- LEDGR - DAILY QUESTS v2 (SIMPLIFICADO)
-- ================================================================
-- Sistema de missões diárias SIMPLIFICADO
-- - Usa UTC (sem timezone complexo)
-- - Apenas 2 missões: played, added_to_collection
-- - Triggers automáticos
-- - Tudo em 1 arquivo consolidado
-- ================================================================

-- FASE 1: ESTRUTURA BÁSICA
-- ================================================================

-- 1. Enum para tipos de missões (6 tipos: 2 fixos + 4 rotativos)
do $$ begin
  create type public.quest_type as enum (
    'played', 
    'added_to_collection',
    'opened_app',
    'play_15_minutes',
    'write_review',
    'play_old_game'
  );
exception when duplicate_object then null;
end $$;

-- Se o tipo já existe, precisamos adicionar os novos valores
do $$ begin
  alter type public.quest_type add value if not exists 'opened_app';
  alter type public.quest_type add value if not exists 'play_15_minutes';
  alter type public.quest_type add value if not exists 'write_review';
  alter type public.quest_type add value if not exists 'play_old_game';
exception when others then null;
end $$;

-- 2. Tabela de completações de missões
create table if not exists public.daily_quest_completions (
  id bigserial primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  quest_type public.quest_type not null,
  completed_at timestamptz not null default now(),
  date date not null default current_date, -- UTC date
  related_event_id bigint references public.events(id) on delete set null,
  
  -- Constraint única: uma completação por tipo por dia
  unique(profile_id, quest_type, date)
);

-- 3. Tabela de streaks
create table if not exists public.quest_streaks (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_quest_date date, -- UTC date do último dia que completou qualquer missão
  updated_at timestamptz not null default now()
);

-- 4. Índices
create index if not exists daily_quest_completions_profile_date_idx 
  on public.daily_quest_completions(profile_id, date desc);

-- ================================================================
-- FASE 2: FUNÇÕES
-- ================================================================

-- Função: Determinar quais quests estão ativas hoje (baseado no horário de Brasília)
create or replace function public.get_active_quest_types()
returns public.quest_type[]
language plpgsql
stable
as $$
declare
  brasilia_date date;
  day_of_year int;
begin
  -- Pega a data atual no horário de Brasília (America/Sao_Paulo = UTC-3)
  brasilia_date := (timezone('America/Sao_Paulo', now()))::date;
  
  -- Calcula o dia do ano (1-365/366)
  day_of_year := extract(doy from brasilia_date)::int;
  
  -- Alterna as quests baseado em dia par/ímpar
  if (day_of_year % 2) = 0 then
    -- Dia PAR: Abrir app + Jogar 15 minutos
    return array['opened_app'::public.quest_type, 'play_15_minutes'::public.quest_type];
  else
    -- Dia ÍMPAR: Escrever review + Jogar jogo antigo
    return array['write_review'::public.quest_type, 'play_old_game'::public.quest_type];
  end if;
end;
$$;

-- Função: Obter status das missões do dia (usa auth.uid())
create or replace function public.get_daily_quests()
returns jsonb
language plpgsql
security definer
volatile -- VOLATILE porque faz INSERT ao marcar opened_app como completo
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
  
  -- Marca "opened_app" como completo (usuário está usando o app agora)
  perform public.internal_mark_quest_complete(
    user_id,
    'opened_app'::public.quest_type,
    null
  );
  
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

-- Função interna: Marcar missão completa (chamada por triggers)
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
begin
  -- Usa horário de Brasília para determinar o dia
  brasilia_date := (timezone('America/Sao_Paulo', now()))::date;
  yesterday := brasilia_date - interval '1 day';
  
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
  -- Verifica se completou TODAS as quests ativas do dia
  declare
    active_quests public.quest_type[];
    all_completed boolean;
  begin
    active_quests := public.get_active_quest_types();
    
    -- Verifica se ambas as quests ativas estão completas
    select 
      (exists(
        select 1 from public.daily_quest_completions
        where profile_id = user_id 
          and quest_type = active_quests[1]
          and date = brasilia_date
      ) and exists(
        select 1 from public.daily_quest_completions
        where profile_id = user_id 
          and quest_type = active_quests[2]
          and date = brasilia_date
      ))
    into all_completed;
    
    -- Só atualiza streak se completou TODAS as quests do dia
    if not all_completed then
      return;
    end if;
  end;
  
  -- Atualiza streak
  select * into streak_record
  from public.quest_streaks
  where profile_id = user_id
  for update;
  
  if not found then
    -- Primeira vez
    insert into public.quest_streaks (profile_id, current_streak, longest_streak, last_quest_date)
    values (user_id, 1, 1, brasilia_date);
    return;
  end if;
  
  -- Se já completou todas hoje, não atualiza streak novamente
  if streak_record.last_quest_date = brasilia_date then
    return;
  end if;
  
  -- Calcula novo streak
  if streak_record.last_quest_date = yesterday then
    new_streak := streak_record.current_streak + 1;
  else
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
end;
$$;

-- ================================================================
-- FASE 3: TRIGGERS
-- ================================================================

-- Trigger para "play_15_minutes": Verifica se jogou 15+ minutos hoje
create or replace function public.auto_complete_play_15_minutes()
returns trigger
language plpgsql
security definer
as $$
declare
  total_minutes numeric;
  brasilia_date date;
begin
  -- Só processa eventos de jogatina
  if new.type not in ('started', 'synced', 'log') then
    return new;
  end if;
  
  -- Calcula a data de Brasília
  brasilia_date := (timezone('America/Sao_Paulo', now()))::date;
  
  -- Soma todas as HORAS jogadas hoje e converte para minutos
  -- hours_added está em meta JSONB
  select coalesce(
    sum((meta->>'hours_added')::numeric) * 60, -- Converte horas para minutos
    0
  )::int
  into total_minutes
  from public.events
  where profile_id = new.profile_id
    and type in ('started', 'synced', 'log')
    and meta->>'hours_added' is not null
    and (timezone('America/Sao_Paulo', created_at))::date = brasilia_date;
  
  -- Log para debug
  raise notice 'Quest 15min check: user=%, total_minutes=%, target=15', new.profile_id, total_minutes;
  
  -- Se atingiu 15 minutos, marca como completo
  if total_minutes >= 15 then
    perform public.internal_mark_quest_complete(
      new.profile_id,
      'play_15_minutes'::public.quest_type,
      new.id
    );
  end if;
  
  return new;
end;
$$;

drop trigger if exists auto_complete_play_15_on_event on public.events;
create trigger auto_complete_play_15_on_event
  after insert or update on public.events
  for each row
  execute function public.auto_complete_play_15_minutes();

-- Trigger para "write_review": Auto-completa quando escreve uma review
create or replace function public.auto_complete_write_review()
returns trigger
language plpgsql
security definer
as $$
begin
  if tg_op = 'INSERT' then
    perform public.internal_mark_quest_complete(
      new.profile_id,
      'write_review'::public.quest_type,
      null
    );
  end if;
  return new;
end;
$$;

drop trigger if exists auto_complete_review_quest on public.reviews;
create trigger auto_complete_review_quest
  after insert on public.reviews
  for each row
  execute function public.auto_complete_write_review();

-- Trigger para "play_old_game": Joga um jogo lançado há 2+ anos
create or replace function public.auto_complete_play_old_game()
returns trigger
language plpgsql
security definer
as $$
declare
  game_release_date date;
  years_old int;
begin
  -- Só processa eventos de jogatina
  if new.type not in ('started', 'synced', 'log') then
    return new;
  end if;
  
  -- Busca a data de lançamento do jogo no IGDB
  select to_date(first_release_date::text, 'YYYY-MM-DD')
  into game_release_date
  from public.games
  where id = new.game_id
    and first_release_date is not null;
  
  -- Se não tem data de lançamento, ignora
  if game_release_date is null then
    return new;
  end if;
  
  -- Calcula quantos anos se passaram
  years_old := extract(year from age(current_date, game_release_date))::int;
  
  -- Se o jogo tem 2+ anos, marca como completo
  if years_old >= 2 then
    perform public.internal_mark_quest_complete(
      new.profile_id,
      'play_old_game'::public.quest_type,
      new.id
    );
  end if;
  
  return new;
end;
$$;

drop trigger if exists auto_complete_old_game_on_event on public.events;
create trigger auto_complete_old_game_on_event
  after insert on public.events
  for each row
  execute function public.auto_complete_play_old_game();

-- Trigger A: Auto-completar "played" quando joga (MANTIDO PARA COMPATIBILIDADE)
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

drop trigger if exists auto_complete_played_on_event on public.events;
create trigger auto_complete_played_on_event
  after insert on public.events
  for each row
  execute function public.auto_complete_played_quest();

-- Trigger B: Auto-completar "added_to_collection" quando adiciona jogo
create or replace function public.auto_complete_collection_quest()
returns trigger
language plpgsql
security definer
as $$
begin
  if tg_op = 'INSERT' then
    perform public.internal_mark_quest_complete(
      new.profile_id,
      'added_to_collection'::public.quest_type,
      null
    );
  end if;
  return new;
end;
$$;

-- Trigger em user_games (biblioteca principal)
drop trigger if exists auto_complete_collection_on_user_games on public.user_games;
create trigger auto_complete_collection_on_user_games
  after insert on public.user_games
  for each row
  execute function public.auto_complete_collection_quest();

-- Trigger em user_collection_games (coleções personalizadas)
drop trigger if exists auto_complete_collection_on_collections on public.user_collection_games;
create trigger auto_complete_collection_on_collections
  after insert on public.user_collection_games
  for each row
  execute function public.auto_complete_collection_quest();

-- ================================================================
-- FASE 4: SEGURANÇA (RLS)
-- ================================================================

alter table public.daily_quest_completions enable row level security;
alter table public.quest_streaks enable row level security;

drop policy if exists "quest_completions_select" on public.daily_quest_completions;
create policy "quest_completions_select" on public.daily_quest_completions 
  for select using (profile_id = auth.uid());

drop policy if exists "quest_completions_insert" on public.daily_quest_completions;
create policy "quest_completions_insert" on public.daily_quest_completions 
  for insert with check (false); -- Apenas triggers

drop policy if exists "quest_streaks_select" on public.quest_streaks;
create policy "quest_streaks_select" on public.quest_streaks 
  for select using (profile_id = auth.uid());

drop policy if exists "quest_streaks_insert" on public.quest_streaks;
create policy "quest_streaks_insert" on public.quest_streaks 
  for insert with check (false); -- Apenas triggers

drop policy if exists "quest_streaks_update" on public.quest_streaks;
create policy "quest_streaks_update" on public.quest_streaks 
  for update using (false); -- Apenas triggers

-- ================================================================
-- TESTES E VERIFICAÇÃO
-- ================================================================

-- Teste 1: Verificar tabelas criadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('daily_quest_completions', 'quest_streaks')
  AND table_schema = 'public';
-- Esperado: 2 linhas

-- Teste 2: Verificar triggers criados
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_name LIKE '%quest%'
  AND event_object_schema = 'public'
ORDER BY event_object_table, trigger_name;
-- Esperado: 3 triggers

-- Teste 3: Testar função get_daily_quests
SELECT public.get_daily_quests();
-- Esperado: {"played": false, "added_to_collection": false, "current_streak": 0, "longest_streak": 0, "date": "2025-11-27"}

-- ================================================================
-- RESULTADO ESPERADO
-- ================================================================
-- ✅ 2 tabelas criadas (completions + streaks)
-- ✅ 2 funções criadas (get_daily_quests + internal_mark_complete)
-- ✅ 3 triggers criados (events + user_games + user_collection_games)
-- ✅ RLS configurado
-- ✅ Usa UTC (simples, sem timezone)
-- ✅ Apenas 2 missões (played + added_to_collection)
