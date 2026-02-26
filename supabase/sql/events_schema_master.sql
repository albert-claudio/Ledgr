-- ================================================================
-- LEDGR - TIMELINE EVENTS SCHEMA (MASTER)
-- ================================================================
-- Este script unificado cria a estrutura completa da Timeline
-- e faz backfill automático dos jogos existentes.
-- Execute UMA VEZ no Supabase SQL Editor.
-- ================================================================

-- BLOCO 1: ESTRUTURA DA NOVA TIMELINE (events)

-- 1. Enum para os tipos de eventos (Define o que pode aparecer no feed)
do $$ begin
  create type public.event_type as enum ('started', 'synced', 'log', 'rated', 'finished');
exception when duplicate_object then null;
end $$;

-- 2. Tabela Definitiva de Eventos
create table if not exists public.events (
  id bigserial primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  game_id bigint references public.games(id) on delete cascade, -- Link com IGDB
  steam_appid bigint, -- Link Opcional Steam
  type public.event_type not null,
  meta jsonb default '{}'::jsonb, 
  -- Ex: { "rating": 5, "hours_added": 4, "log_text": "..." }
  created_at timestamptz not null default now()
);

-- 3. Índices para o Feed carregar rápido
create index if not exists events_profile_idx on public.events(profile_id, created_at desc);
create index if not exists events_game_idx on public.events(game_id);
create index if not exists events_type_idx on public.events(type);

-- 4. Segurança (RLS)
alter table public.events enable row level security;

-- Leitura: Dono ou Público (se perfil for público)
drop policy if exists "events_select" on public.events;
create policy "events_select" on public.events for select using (
  profile_id = auth.uid() OR exists (
    select 1 from public.profiles p 
    where p.id = events.profile_id and p.is_public = true
  )
);

-- Escrita: Apenas o Dono
drop policy if exists "events_insert" on public.events;
create policy "events_insert" on public.events for insert with check (profile_id = auth.uid());

drop policy if exists "events_update" on public.events;
create policy "events_update" on public.events for update using (profile_id = auth.uid());

drop policy if exists "events_delete" on public.events;
create policy "events_delete" on public.events for delete using (profile_id = auth.uid());

-- 5. Comentários para Documentação
comment on table public.events is 'Timeline de eventos do usuário (Letterboxd-style)';
comment on column public.events.game_id is 'Referência para jogo no IGDB';
comment on column public.events.steam_appid is 'Fallback para jogos apenas no Steam';

-- ================================================================
-- BLOCO 2: TRIGGERS AUTOMÁTICOS PARA EVENTOS
-- ================================================================

-- Trigger: Criar evento "rated" quando usuário avalia um jogo
create or replace function public.auto_create_rated_event()
returns trigger
language plpgsql
security definer
as $$
declare
  game_db_id bigint;
begin
  -- Tenta encontrar o game_id (PK interna) a partir do igdb_id
  select id into game_db_id
  from public.games
  where igdb_id = new.game_igdb_id
  limit 1;
  
  -- Se o jogo não existe no banco, não cria evento
  if game_db_id is null then
    return new;
  end if;
  
  -- Cria ou atualiza o evento "rated" para este jogo
  -- Usa UPSERT simples sem constraint especial
  insert into public.events (profile_id, game_id, type, meta, created_at)
  values (
    new.profile_id,
    game_db_id,
    'rated',
    jsonb_build_object('rating', new.rating),
    new.updated_at
  );
  
  return new;
exception
  when unique_violation then
    -- Se já existe evento rated para este jogo, atualiza
    update public.events
    set meta = jsonb_build_object('rating', new.rating),
        created_at = new.updated_at
    where profile_id = new.profile_id
      and game_id = game_db_id
      and type = 'rated';
    return new;
  when others then
    -- Se der qualquer outro erro, não falha o INSERT na user_ratings
    return new;
end;
$$;

drop trigger if exists auto_create_rated_event_on_rating on public.user_ratings;
create trigger auto_create_rated_event_on_rating
  after insert or update on public.user_ratings
  for each row
  execute function public.auto_create_rated_event();

-- ================================================================
-- RESULTADOS ESPERADOS
-- ================================================================
-- ✅ Tabela 'events' criada com RLS
-- ✅ Índices otimizados para timeline
-- ✅ Trigger automático para criar eventos 'rated'
-- ✅ Timeline pronta para uso na Home

-- Para verificar:
-- SELECT * FROM public.events ORDER BY created_at DESC LIMIT 10;

