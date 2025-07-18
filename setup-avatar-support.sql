-- Avatar Support Migration for EchoStone
-- Run this script in your Supabase SQL Editor to add avatar support

-- Create avatar_profiles table
CREATE TABLE IF NOT EXISTS avatar_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  profile_data JSONB DEFAULT '{}'::jsonb,
  voice_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for avatar_profiles
CREATE INDEX IF NOT EXISTS avatar_profiles_name_idx ON avatar_profiles (name);
CREATE INDEX IF NOT EXISTS avatar_profiles_created_at_idx ON avatar_profiles (created_at);

-- Add avatar_id to memory_fragments
ALTER TABLE memory_fragments 
ADD COLUMN IF NOT EXISTS avatar_id UUID REFERENCES avatar_profiles(id);

-- Create indexes for faster queries with avatar_id
CREATE INDEX IF NOT EXISTS memory_fragments_avatar_id_idx ON memory_fragments(avatar_id);
CREATE INDEX IF NOT EXISTS memory_fragments_user_avatar_idx ON memory_fragments(user_id, avatar_id);

-- Update the conversation_context schema to include avatarId
COMMENT ON COLUMN memory_fragments.conversation_context IS 'JSON structure that can include timestamp, messageContext, emotionalTone, and avatarId';

-- Drop existing function to update with avatar support
DROP FUNCTION IF EXISTS match_memory_fragments(vector, float, integer, uuid);

-- Create updated function with avatar support
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

-- Create trigger for avatar_profiles updated_at
DROP TRIGGER IF EXISTS update_avatar_profiles_updated_at ON avatar_profiles;
CREATE TRIGGER update_avatar_profiles_updated_at 
    BEFORE UPDATE ON avatar_profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security for avatar_profiles
ALTER TABLE avatar_profiles ENABLE ROW LEVEL SECURITY;

-- For the prototype, we'll use a simple RLS policy that allows all authenticated users to access all avatars
DROP POLICY IF EXISTS "Authenticated users can access all avatars" ON avatar_profiles;
CREATE POLICY "Authenticated users can access all avatars" ON avatar_profiles
  FOR ALL USING (auth.role() = 'authenticated');

-- Verify avatar support setup
DO $function$
BEGIN
  -- Check if avatar_profiles table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'avatar_profiles') THEN
    RAISE EXCEPTION 'avatar_profiles table does not exist';
  END IF;
  
  -- Check if memory_fragments has avatar_id column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'memory_fragments' AND column_name = 'avatar_id') THEN
    RAISE EXCEPTION 'memory_fragments table does not have avatar_id column';
  END IF;
  
  -- Check if updated match_memory_fragments function exists with correct parameters
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'match_memory_fragments' 
    AND pronargs = 5
  ) THEN
    RAISE EXCEPTION 'Updated match_memory_fragments function does not exist';
  END IF;
  
  RAISE NOTICE '✅ Avatar support setup completed successfully!';
  RAISE NOTICE '✅ avatar_profiles table created';
  RAISE NOTICE '✅ memory_fragments table updated with avatar_id';
  RAISE NOTICE '✅ match_memory_fragments function updated for avatar support';
  RAISE NOTICE '✅ All indexes and policies configured';
  RAISE NOTICE '🎉 Your EchoStone avatar system is ready to use!';
END
$function$;