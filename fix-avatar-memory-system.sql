-- Fix Avatar Memory System
-- Run this script in your Supabase SQL Editor to ensure avatar memory isolation works

-- Step 1: Ensure avatar_profiles table exists
CREATE TABLE IF NOT EXISTS avatar_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  profile_data JSONB DEFAULT '{}'::jsonb,
  voice_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Add avatar_id column to memory_fragments if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'memory_fragments' AND column_name = 'avatar_id') THEN
        ALTER TABLE memory_fragments ADD COLUMN avatar_id UUID REFERENCES avatar_profiles(id);
    END IF;
END $$;

-- Step 3: Create indexes for better performance
CREATE INDEX IF NOT EXISTS memory_fragments_avatar_id_idx ON memory_fragments(avatar_id);
CREATE INDEX IF NOT EXISTS memory_fragments_user_avatar_idx ON memory_fragments(user_id, avatar_id);

-- Step 4: Update the match_memory_fragments function to support avatar isolation
DROP FUNCTION IF EXISTS match_memory_fragments(vector, float, integer, uuid, uuid);
DROP FUNCTION IF EXISTS match_memory_fragments(vector, float, integer, uuid);

CREATE OR REPLACE FUNCTION match_memory_fragments(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.78,
  match_count int DEFAULT 10,
  target_user_id uuid DEFAULT NULL,
  target_avatar_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  avatar_id uuid,
  fragment_text text,
  conversation_context jsonb,
  similarity float,
  created_at timestamptz,
  updated_at timestamptz,
  embedding vector(1536)
)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    memory_fragments.id,
    memory_fragments.user_id,
    memory_fragments.avatar_id,
    memory_fragments.fragment_text,
    memory_fragments.conversation_context,
    1 - (memory_fragments.embedding <=> query_embedding) AS similarity,
    memory_fragments.created_at,
    memory_fragments.updated_at,
    memory_fragments.embedding
  FROM memory_fragments
  WHERE 
    (target_user_id IS NULL OR memory_fragments.user_id = target_user_id)
    AND (target_avatar_id IS NULL OR memory_fragments.avatar_id = target_avatar_id)
    AND 1 - (memory_fragments.embedding <=> query_embedding) > match_threshold
  ORDER BY memory_fragments.embedding <=> query_embedding
  LIMIT match_count;
END;
$function$;

-- Step 5: Test the function
DO $function$
DECLARE
    test_embedding vector(1536);
    test_result RECORD;
BEGIN
    -- Create a dummy embedding for testing
    test_embedding := array_fill(0.0, ARRAY[1536])::vector;
    
    -- Test the function
    SELECT COUNT(*) as count INTO test_result
    FROM match_memory_fragments(
        test_embedding,
        0.5,
        10,
        NULL,
        NULL
    );
    
    RAISE NOTICE '✅ Avatar memory function test completed. Found % memory fragments.', test_result.count;
END
$function$;

-- Step 6: Show current status
DO $function$
DECLARE
    avatar_count INTEGER;
    memory_count INTEGER;
    avatar_memory_count INTEGER;
BEGIN
    -- Count avatars
    SELECT COUNT(*) INTO avatar_count FROM avatar_profiles;
    
    -- Count total memories
    SELECT COUNT(*) INTO memory_count FROM memory_fragments;
    
    -- Count memories with avatar_id
    SELECT COUNT(*) INTO avatar_memory_count FROM memory_fragments WHERE avatar_id IS NOT NULL;
    
    RAISE NOTICE '📊 Current Status:';
    RAISE NOTICE '   - Avatars: %', avatar_count;
    RAISE NOTICE '   - Total Memories: %', memory_count;
    RAISE NOTICE '   - Avatar-Specific Memories: %', avatar_memory_count;
    
    IF avatar_count > 0 AND memory_count > 0 THEN
        RAISE NOTICE '✅ Avatar memory system is ready!';
    ELSE
        RAISE NOTICE '⚠️  Create some avatars and have conversations to test the system.';
    END IF;
END
$function$;