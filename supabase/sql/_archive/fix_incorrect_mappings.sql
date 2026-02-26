-- ==========================================
-- CLEANUP: Remove Incorrect Mappings and Games
-- ==========================================

-- 1. Delete Star Wars game that was incorrectly added
-- First delete events referencing this game
DELETE FROM events  
WHERE game_id IN (SELECT id FROM games WHERE igdb_id = 156);

-- Then delete from user_games
DELETE FROM user_games 
WHERE game_id IN (SELECT id FROM games WHERE igdb_id = 156);

-- Finally delete the game itself
DELETE FROM games WHERE igdb_id = 156;

-- 2. Remove incorrect mapping for L.A. Noire
DELETE FROM steam_igdb_mappings  
WHERE steam_appid = 110800 AND igdb_id = 156;

-- 3. Optional: Check for other suspicious mappings
-- Mappings with low or missing confidence scores may be incorrect
SELECT * FROM steam_igdb_mappings  
WHERE confidence < 50 OR confidence IS NULL
ORDER BY confidence ASC;

-- 4. Optional: Find all mappings that might be old/unverified
SELECT steam_appid, igdb_id, confidence, last_verified_at
FROM steam_igdb_mappings
WHERE last_verified_at IS NULL 
   OR last_verified_at < NOW() - INTERVAL '6 months'
ORDER BY last_verified_at ASC NULLS FIRST
LIMIT 100;
