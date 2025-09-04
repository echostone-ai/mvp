-- Fix for Jonathan Demo - Create missing tables and search_memories function
-- Run this in your Supabase SQL Editor

-- First, create the avatar_profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS avatar_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  profile_data JSONB DEFAULT '{}'::jsonb,
  voice_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for avatar_profiles
CREATE INDEX IF NOT EXISTS avatar_profiles_name_idx ON avatar_profiles (name);
CREATE INDEX IF NOT EXISTS avatar_profiles_created_at_idx ON avatar_profiles (created_at);

-- Add avatar_id to memory_fragments if it doesn't exist
ALTER TABLE memory_fragments 
ADD COLUMN IF NOT EXISTS avatar_id UUID REFERENCES avatar_profiles(id);

-- Create indexes for faster queries with avatar_id
CREATE INDEX IF NOT EXISTS memory_fragments_avatar_id_idx ON memory_fragments(avatar_id);
CREATE INDEX IF NOT EXISTS memory_fragments_user_avatar_idx ON memory_fragments(user_id, avatar_id);

-- Enable Row Level Security for avatar_profiles
ALTER TABLE avatar_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for avatar_profiles
DROP POLICY IF EXISTS "Authenticated users can access all avatars" ON avatar_profiles;
CREATE POLICY "Authenticated users can access all avatars" ON avatar_profiles
  FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Create trigger for avatar_profiles updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_avatar_profiles_updated_at ON avatar_profiles;
CREATE TRIGGER update_avatar_profiles_updated_at 
    BEFORE UPDATE ON avatar_profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Drop any existing search_memories function
DROP FUNCTION IF EXISTS search_memories(text, text, integer);

-- Now create the search_memories function that the API expects
CREATE OR REPLACE FUNCTION search_memories(
  p_slug TEXT,
  p_query TEXT,
  p_limit INTEGER DEFAULT 18
)
RETURNS TABLE (
  fragment_text TEXT,
  conversation_context JSONB,
  rank INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  avatar_uuid UUID;
BEGIN
  -- Find the avatar by slug/name
  SELECT id INTO avatar_uuid 
  FROM avatar_profiles 
  WHERE LOWER(name) = LOWER(p_slug) OR id::text = p_slug
  LIMIT 1;
  
  -- If no avatar found, return empty results
  IF avatar_uuid IS NULL THEN
    RETURN;
  END IF;
  
  -- Return memory fragments for this avatar
  -- Since we don't have embeddings for the query, we'll do text-based search
  RETURN QUERY
  SELECT 
    mf.fragment_text,
    mf.conversation_context,
    ROW_NUMBER()::INTEGER AS rank
  FROM memory_fragments mf
  WHERE mf.avatar_id = avatar_uuid
    AND (
      mf.fragment_text ILIKE '%' || p_query || '%' 
      OR mf.conversation_context::text ILIKE '%' || p_query || '%'
    )
  ORDER BY mf.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Grant execute permission to anon and authenticated users
GRANT EXECUTE ON FUNCTION search_memories(TEXT, TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION search_memories(TEXT, TEXT, INTEGER) TO authenticated;

-- Create Jonathan Braden avatar if it doesn't exist
INSERT INTO avatar_profiles (name, description, profile_data, voice_id)
VALUES (
  'jonathan_braden',
  'Jonathan Braden - Witty, quick, warm personality with playful sarcasm',
  '{
    "personality": "witty, quick, warm; playful sarcasm when it fits",
    "style": "conversational, concise responses (2-6 sentences)",
    "identity": "Jonathan Braden for Echostone demo"
  }'::jsonb,
  'CO6pxVrMZfyL61ZIglyr'
)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  profile_data = EXCLUDED.profile_data,
  voice_id = EXCLUDED.voice_id,
  updated_at = NOW();

-- Ensure embedding column exists for future use
DO $$
BEGIN
  -- First check if embedding column exists, if not add it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'memory_fragments' AND column_name = 'embedding'
  ) THEN
    -- Enable vector extension if not already enabled
    CREATE EXTENSION IF NOT EXISTS vector;
    -- Add embedding column
    ALTER TABLE memory_fragments ADD COLUMN embedding vector(1536);
    -- Create index for vector similarity search
    CREATE INDEX IF NOT EXISTS memory_fragments_embedding_idx ON memory_fragments 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
    RAISE NOTICE 'Added embedding column to memory_fragments';
  END IF;
END $$;

-- Verify the setup
SELECT 
  'Avatar created: ' || name as status,
  'ID: ' || id::text as avatar_id,
  'Memories: ' || (
    SELECT COUNT(*) FROM memory_fragments WHERE avatar_id = avatar_profiles.id
  )::text as memory_count
FROM avatar_profiles 
WHERE name = 'jonathan_braden';