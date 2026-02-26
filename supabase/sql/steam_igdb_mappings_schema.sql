-- ================================================================
-- STEAM TO IGDB MAPPING TABLE
-- ================================================================
-- Esta tabela mapeia Steam App IDs para IGDB Game IDs
-- Permite criar eventos da timeline para jogos Steam
-- ================================================================

CREATE TABLE IF NOT EXISTS public.steam_igdb_mappings (
  steam_appid BIGINT PRIMARY KEY,
  igdb_id BIGINT NOT NULL,
  name TEXT NOT NULL, -- Nome do jogo para debug
  confidence SMALLINT DEFAULT 100 CHECK (confidence BETWEEN 0 AND 100),
  source TEXT DEFAULT 'manual', -- 'manual', 'steam_map_igdb', 'auto'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS steam_igdb_mappings_igdb_idx ON public.steam_igdb_mappings(igdb_id);

-- RLS
ALTER TABLE public.steam_igdb_mappings ENABLE ROW LEVEL SECURITY;

-- Leitura pública
DROP POLICY IF EXISTS "steam_igdb_mappings_select" ON public.steam_igdb_mappings;
CREATE POLICY "steam_igdb_mappings_select" ON public.steam_igdb_mappings
FOR SELECT USING (true);

-- Escrita apenas para autenticados (edge functions)
DROP POLICY IF EXISTS "steam_igdb_mappings_insert" ON public.steam_igdb_mappings;
CREATE POLICY "steam_igdb_mappings_insert" ON public.steam_igdb_mappings
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "steam_igdb_mappings_update" ON public.steam_igdb_mappings;
CREATE POLICY "steam_igdb_mappings_update" ON public.steam_igdb_mappings
FOR UPDATE USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

COMMENT ON TABLE public.steam_igdb_mappings IS 'Mapeamento de Steam App IDs para IGDB Game IDs para integração da timeline';
COMMENT ON COLUMN public.steam_igdb_mappings.confidence IS 'Confiança do mapeamento (0-100), útil para filtrar mapeamentos duvidosos';
