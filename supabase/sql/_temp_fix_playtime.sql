-- ================================================================
-- SQL TEMPORÁRIO: Força Atualização de Playtime
-- ================================================================
-- Execute este SQL apenas UMA VEZ para forçar recálculo do playtime
-- DEPOIS DELETE este arquivo para não ficar bagunçado
-- ================================================================

-- 1. Ver o estado atual do Cyberpunk 2077
SELECT 
  ug.id,
  ug.profile_id,
  g.name,
  ug.minutes_played as playtime_user_games,
  sug.playtime_forever as playtime_steam,
  ug.last_session_at
FROM user_games ug
JOIN games g ON g.id = ug.game_id
LEFT JOIN steam_user_games sug ON sug.profile_id = ug.profile_id 
  AND g.igdb_id = (SELECT igdb_id FROM steam_igdb_mappings WHERE steam_appid = sug.steam_appid LIMIT 1)
WHERE g.name ILIKE '%cyberpunk%'
  AND ug.profile_id = auth.uid()
ORDER BY ug.updated_at DESC;

-- 2. Se os valores estiverem diferentes, force atualização:
-- IMPORTANTE: Rode este UPDATE apenas se o playtime_steam for diferente de playtime_user_games

UPDATE user_games
SET 
  minutes_played = (
    SELECT sug.playtime_forever
    FROM steam_user_games sug
    JOIN steam_igdb_mappings sim ON sim.steam_appid = sug.steam_appid
    JOIN games g ON g.igdb_id = sim.igdb_id
    WHERE g.id = user_games.game_id
      AND sug.profile_id = user_games.profile_id
    LIMIT 1
  ),
  updated_at = now()
WHERE user_games.profile_id = auth.uid()
  AND EXISTS (
    SELECT 1 
    FROM steam_user_games sug
    JOIN steam_igdb_mappings sim ON sim.steam_appid = sug.steam_appid
    JOIN games g ON g.igdb_id = sim.igdb_id
    WHERE g.id = user_games.game_id
      AND sug.profile_id = user_games.profile_id
      AND sug.playtime_forever != user_games.minutes_played
  );

-- 3. Verificar se atualizou
SELECT 
  g.name,
  ug.minutes_played,
  ROUND(ug.minutes_played / 60.0, 1) as hours_played,
  ug.updated_at
FROM user_games ug
JOIN games g ON g.id = ug.game_id
WHERE g.name ILIKE '%cyberpunk%'
  AND ug.profile_id = auth.uid();

-- ================================================================
-- RESULTADO ESPERADO:
-- Cyberpunk 2077 deve mostrar ~1638 minutos (27,3 horas)
-- updated_at deve ser agora (timestamp recente)
-- ================================================================
