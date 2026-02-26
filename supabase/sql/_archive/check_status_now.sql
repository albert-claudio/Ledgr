-- DIAGNÓSTICO RÁPIDO
-- Verifique o que está no banco AGORA

SELECT 
  'MAPPING' as type,
  steam_appid,
  igdb_id,
  confidence
FROM steam_igdb_mappings
WHERE steam_appid = 1201940;

SELECT 
  'GAME_PROJECT_SPEED' as type,
  id,
  igdb_id,
  name
FROM games
WHERE igdb_id = 127458;

SELECT 
  'GAME_CYBERPUNK' as type,
  id,
  igdb_id,
  name
FROM games
WHERE igdb_id = 119171;
