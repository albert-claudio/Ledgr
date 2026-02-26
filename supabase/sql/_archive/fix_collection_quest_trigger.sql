-- ================================================================
-- FIX: Adicionar trigger para user_collection_games
-- ================================================================
-- Execute este script para corrigir o problema de quest não completar
-- quando adiciona jogo em coleção personalizada

-- O trigger agora detecta INSERTs em AMBAS as tabelas:
-- • user_games (quando adiciona jogo à biblioteca principal)
-- • user_collection_games (quando adiciona a coleçõespersonalizadas)

drop trigger if exists auto_complete_collection_on_collection_insert on public.user_collection_games;
create trigger auto_complete_collection_on_collection_insert
  after insert on public.user_collection_games
  for each row
  execute function public.auto_complete_collection_quest();

-- Verificar se os triggers foram criados
SELECT 
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE '%collection%'
  AND event_object_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- Deve retornar:
-- auto_complete_collection_on_insert | user_games
-- auto_complete_collection_on_collection_insert | user_collection_games
