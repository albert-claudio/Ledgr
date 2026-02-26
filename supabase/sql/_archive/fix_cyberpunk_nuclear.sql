-- FIX NUCLEAR - CYBERPUNK 2077
-- Use isso se o anterior não funcionou.

BEGIN;

-- 1. Forçar remoção do Project Speed (IGDB 127458)
-- Removemos referências em cascata manualmente para garantir

-- Remover da biblioteca
DELETE FROM user_games 
WHERE game_id IN (SELECT id FROM games WHERE igdb_id = 127458);

-- Remover da timeline
DELETE FROM events 
WHERE game_id IN (SELECT id FROM games WHERE igdb_id = 127458);

-- Remover das coleções
DELETE FROM user_collection_games 
WHERE game_id IN (SELECT id FROM games WHERE igdb_id = 127458);

-- Remover avaliações e comentários
DELETE FROM user_ratings WHERE game_igdb_id = 127458;
DELETE FROM comments WHERE game_igdb_id = 127458;

-- DELETAR O JOGO
DELETE FROM games WHERE igdb_id = 127458;

-- 2. Garantir Cyberpunk 2077 (IGDB 119171)
INSERT INTO games (igdb_id, name, slug, cover_image_id)
VALUES (119171, 'Cyberpunk 2077', 'cyberpunk-2077', 'co2of5')
ON CONFLICT (igdb_id) DO UPDATE
SET name = 'Cyberpunk 2077', slug = 'cyberpunk-2077', cover_image_id = 'co2of5';

-- 3. Corrigir Mapping Steam (1201940 -> 119171)
DELETE FROM steam_igdb_mappings WHERE steam_appid = 1201940;
INSERT INTO steam_igdb_mappings (steam_appid, igdb_id, confidence)
VALUES (1201940, 119171, 100);

-- 4. Re-adicionar Cyberpunk à biblioteca do usuário (baseado no Steam)
INSERT INTO user_games (profile_id, game_id, status, minutes_played)
SELECT 
  sug.profile_id,
  (SELECT id FROM games WHERE igdb_id = 119171),
  'playing',
  sug.playtime_forever
FROM steam_user_games sug
WHERE sug.steam_appid = 1201940
ON CONFLICT (profile_id, game_id) DO UPDATE
SET minutes_played = EXCLUDED.minutes_played;

COMMIT;

SELECT 'FIX COMPLETO' as status;
