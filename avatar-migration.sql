-- Avatar support migration
-- Create avatar_profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS avatar_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  profile_data JSONB DEFAULT '{}'::jsonb,
  voice_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add avatar_id to memory_fragments
ALTER TABLE memory_fragments ADD COLUMN IF NOT EXISTS avatar_id UUID REFERENCES avatar_profiles(id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS memory_fragments_avatar_id_idx ON memory_fragments(avatar_id);

-- Create compound index for user+avatar queries
CREATE INDEX IF NOT EXISTS memory_fragments_user_avatar_idx ON memory_fragments(user_id, avatar_id);

-- Update the vector search function to include avatarId
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