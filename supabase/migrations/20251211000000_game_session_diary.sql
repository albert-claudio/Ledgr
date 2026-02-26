-- ================================================================
-- LEDGR - GAME SESSION DIARY SYSTEM
-- ================================================================
-- Sistema completo de diário por sessão de jogo
-- Permite registrar: progresso, estado, humor, marcadores e mídia
-- ================================================================

-- ================================================================
-- PASSO 1: ENUMS
-- ================================================================

-- Estado do jogo
do $$ begin
  create type public.game_state as enum (
    'playing',      -- Jogando
    'paused',       -- Encostado
    'dropped',      -- Dropei
    'completed',    -- Zerei
    'ng_plus',      -- NG+
    'platinum'      -- Platinei
  );
exception when duplicate_object then null;
end $$;

-- Tipo de humor durante a sessão
do $$ begin
  create type public.mood_type as enum (
    'happy',        -- Feliz 😊
    'tilted',       -- Tiltado 😤
    'relaxed',      -- Relaxado 😌
    'excited',      -- Emocionado 🤩
    'bored'         -- Entediado 😴
  );
exception when duplicate_object then null;
end $$;

-- Marcadores/Tags de eventos importantes
do $$ begin
  create type public.marker_type as enum (
    'boss_killed',      -- Boss morto 👹
    'mission_stuck',    -- Missão travada ⚠️
    'new_character',    -- Personagem novo 👤
    'moral_choice',     -- Decisão moral 🤔
    'new_weapon',       -- Arma nova ⚔️
    'build',            -- Build 🏗️
    'coop',             -- Co-op 👥
    'pvp'               -- PvP ⚔️
  );
exception when duplicate_object then null;
end $$;

-- ================================================================
-- PASSO 2: TABELA PRINCIPAL
-- ================================================================

create table if not exists public.session_notes (
  id bigserial primary key,
  
  -- Relacionamentos
  event_id bigint references public.events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  game_id bigint not null references public.games(id) on delete cascade,
  
  -- Campos do diário
  progress_text text,                     -- Ex: "Capítulo 3", "Level 18", "Main story 45%"
  game_state public.game_state,          -- Estado atual do jogo
  mood public.mood_type,                 -- Humor durante a sessão
  markers public.marker_type[],          -- Array de marcadores
  note_text text,                        -- Anotação livre do usuário
  media_urls text[],                     -- URLs de mídia no Supabase Storage
  
  -- Metadados
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ================================================================
-- PASSO 3: ÍNDICES PARA PERFORMANCE
-- ================================================================

-- Timeline do usuário (query mais comum)
create index if not exists session_notes_profile_created_idx 
  on public.session_notes(profile_id, created_at desc);

-- Diário por jogo (página do jogo)
create index if not exists session_notes_game_created_idx 
  on public.session_notes(game_id, created_at desc);

-- Link com evento (1:1 relationship)
create index if not exists session_notes_event_idx 
  on public.session_notes(event_id);

-- Busca por humor (analytics)
create index if not exists session_notes_mood_idx 
  on public.session_notes(mood) 
  where mood is not null;

-- Busca por estado (analytics)
create index if not exists session_notes_state_idx 
  on public.session_notes(game_state) 
  where game_state is not null;

-- ================================================================
-- PASSO 4: TRIGGER PARA UPDATED_AT
-- ================================================================

create or replace function public.update_session_notes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists update_session_notes_updated_at on public.session_notes;
create trigger update_session_notes_updated_at
  before update on public.session_notes
  for each row
  execute function public.update_session_notes_updated_at();

-- ================================================================
-- PASSO 5: RLS (Row Level Security)
-- ================================================================

alter table public.session_notes enable row level security;

-- SELECT: Dono ou perfil público
drop policy if exists "session_notes_select" on public.session_notes;
create policy "session_notes_select" on public.session_notes
  for select using (
    profile_id = auth.uid() 
    or exists (
      select 1 from public.profiles p 
      where p.id = session_notes.profile_id 
        and p.is_public = true
    )
  );

-- INSERT: Apenas dono
drop policy if exists "session_notes_insert" on public.session_notes;
create policy "session_notes_insert" on public.session_notes
  for insert with check (profile_id = auth.uid());

-- UPDATE: Apenas dono
drop policy if exists "session_notes_update" on public.session_notes;
create policy "session_notes_update" on public.session_notes
  for update using (profile_id = auth.uid());

-- DELETE: Apenas dono
drop policy if exists "session_notes_delete" on public.session_notes;
create policy "session_notes_delete" on public.session_notes
  for delete using (profile_id = auth.uid());

-- ================================================================
-- PASSO 6: STORAGE BUCKET PARA MÍDIA
-- ================================================================

-- Cria bucket público para screenshots/vídeos
insert into storage.buckets (id, name, public)
values ('session-media', 'session-media', true)
on conflict (id) do nothing;

-- RLS para storage

-- SELECT: Qualquer um pode ver (bucket público)
drop policy if exists "session_media_public_select" on storage.objects;
create policy "session_media_public_select"
  on storage.objects for select
  using (bucket_id = 'session-media');

-- INSERT: Apenas arquivos na pasta do próprio usuário
drop policy if exists "session_media_insert" on storage.objects;
create policy "session_media_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'session-media' 
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- DELETE: Apenas arquivos do próprio usuário
drop policy if exists "session_media_delete" on storage.objects;
create policy "session_media_delete"
  on storage.objects for delete
  using (
    bucket_id = 'session-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ================================================================
-- PASSO 7: FUNÇÕES HELPER
-- ================================================================

-- Função: Buscar diário completo de um jogo
create or replace function public.get_game_diary(
  p_game_id bigint,
  p_limit int default 50
)
returns table (
  id bigint,
  event_id bigint,
  profile_id uuid,
  game_id bigint,
  progress_text text,
  game_state public.game_state,
  mood public.mood_type,
  markers public.marker_type[],
  note_text text,
  media_urls text[],
  created_at timestamptz,
  -- Join com event para pegar horas jogadas
  hours_played numeric
)
language plpgsql
stable
security definer
as $$
begin
  return query
  select 
    sn.id,
    sn.event_id,
    sn.profile_id,
    sn.game_id,
    sn.progress_text,
    sn.game_state,
    sn.mood,
    sn.markers,
    sn.note_text,
    sn.media_urls,
    sn.created_at,
    (e.meta->>'hours_added')::numeric as hours_played
  from public.session_notes sn
  left join public.events e on e.id = sn.event_id
  where sn.game_id = p_game_id
    and (
      sn.profile_id = auth.uid()
      or exists (
        select 1 from public.profiles p
        where p.id = sn.profile_id and p.is_public = true
      )
    )
  order by sn.created_at desc
  limit p_limit;
end;
$$;

-- Função: Estatísticas de humor de um jogo
create or replace function public.get_game_mood_stats(p_game_id bigint)
returns table (
  mood public.mood_type,
  count bigint,
  percentage numeric
)
language plpgsql
stable
security definer
as $$
declare
  total_count bigint;
begin
  -- Conta total de notas com mood
  select count(*) into total_count
  from public.session_notes
  where game_id = p_game_id
    and mood is not null
    and profile_id = auth.uid();
  
  if total_count = 0 then
    return;
  end if;
  
  return query
  select 
    sn.mood,
    count(*) as count,
    round((count(*)::numeric / total_count) * 100, 1) as percentage
  from public.session_notes sn
  where sn.game_id = p_game_id
    and sn.mood is not null
    and sn.profile_id = auth.uid()
  group by sn.mood
  order by count desc;
end;
$$;

-- ================================================================
-- PASSO 8: COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ================================================================

comment on table public.session_notes is 'Diário de sessões de jogo com progresso, humor e anotações';
comment on column public.session_notes.progress_text is 'Progresso livre: "Capítulo 3", "Level 18", etc';
comment on column public.session_notes.game_state is 'Estado atual: playing, paused, dropped, completed, ng_plus, platinum';
comment on column public.session_notes.mood is 'Humor durante sessão: happy, tilted, relaxed, excited, bored';
comment on column public.session_notes.markers is 'Tags de eventos: boss_killed, mission_stuck, new_character, etc';
comment on column public.session_notes.media_urls is 'URLs de screenshots/vídeos no Supabase Storage';

-- ================================================================
-- VERIFICAÇÃO
-- ================================================================

-- 1. Verificar enums criados
select typname 
from pg_type 
where typname in ('game_state', 'mood_type', 'marker_type');

-- 2. Verificar tabela criada
select table_name 
from information_schema.tables 
where table_name = 'session_notes' 
  and table_schema = 'public';

-- 3. Verificar bucket criado
select * from storage.buckets where id = 'session-media';

-- 4. Verificar funções helper
select routine_name 
from information_schema.routines 
where routine_name in ('get_game_diary', 'get_game_mood_stats');

-- ================================================================
-- RESULTADO ESPERADO
-- ================================================================
-- ✅ 3 enums criados (game_state, mood_type, marker_type)
-- ✅ Tabela session_notes criada com RLS
-- ✅ 5 índices para performance
-- ✅ Bucket session-media criado com RLS
-- ✅ 2 funções helper (diário + estatísticas)
-- ✅ Sistema pronto para uso
-- ================================================================
