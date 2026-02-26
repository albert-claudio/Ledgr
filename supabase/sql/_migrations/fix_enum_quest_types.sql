-- ================================================================
-- FIX: Adicionar novos valores ao enum quest_type
-- ================================================================
-- IMPORTANTE: Execute cada comando INDIVIDUALMENTE no Supabase SQL Editor
-- O PostgreSQL não permite ALTER TYPE ADD VALUE dentro de transações
-- ================================================================

-- 1. Adicionar 'opened_app'
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid  
        WHERE t.typname = 'quest_type' AND e.enumlabel = 'opened_app'
    ) THEN
        ALTER TYPE public.quest_type ADD VALUE 'opened_app';
    END IF;
END $$;

-- 2. Adicionar 'play_15_minutes'
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid  
        WHERE t.typname = 'quest_type' AND e.enumlabel = 'play_15_minutes'
    ) THEN
        ALTER TYPE public.quest_type ADD VALUE 'play_15_minutes';
    END IF;
END $$;

-- 3. Adicionar 'write_review'
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid  
        WHERE t.typname = 'quest_type' AND e.enumlabel = 'write_review'
    ) THEN
        ALTER TYPE public.quest_type ADD VALUE 'write_review';
    END IF;
END $$;

-- 4. Adicionar 'play_old_game'
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid  
        WHERE t.typname = 'quest_type' AND e.enumlabel = 'play_old_game'
    ) THEN
        ALTER TYPE public.quest_type ADD VALUE 'play_old_game';
    END IF;
END $$;

-- ================================================================
-- VERIFICAÇÃO: Ver todos os valores do enum
-- ================================================================

SELECT e.enumlabel as quest_type
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname = 'quest_type'
ORDER BY e.enumsortorder;

-- Esperado: 6 valores
-- played
-- added_to_collection
-- opened_app
-- play_15_minutes
-- write_review
-- play_old_game
