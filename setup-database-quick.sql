-- Quick Database Setup for Memory System
-- Copy and paste this entire script into your Supabase SQL Editor and run it

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create conversations table (for persistent chat)
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create indexes for conversations
CREATE INDEX IF NOT EXISTS conversations_user_id_idx ON conversations (user_id);
CREATE INDEX IF NOT EXISTS conversations_last_active_idx ON conversations (last_active);
CREATE INDEX IF NOT EXISTS conversations_user_last_active_idx ON conversations (user_id, last_active DESC);

-- 4. Enable RLS for conversations
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policy for conversations
DROP POLICY IF EXISTS "Users can only access their own conversations" ON conversations;
CREATE POLICY "Users can only access their own conversations" ON conversations
  FOR ALL USING (auth.uid() = user_id);

-- 6. Create trigger for conversations updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at 
    BEFORE UPDATE ON conversations 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 7. Verify memory_fragments table exists (should already exist)
-- If this fails, you need to run the memory fragments migration first

-- 8. Create/update the vector search function
CREATE OR REPLACE FUNCTION match_memory_fragments(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.78,
  match_count int DEFAULT 10,
  target_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  fragment_text text,
  conversation_context jsonb,
  similarity float,
  created_at timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    memory_fragments.id,
    memory_fragments.user_id,
    memory_fragments.fragment_text,
    memory_fragments.conversation_context,
    1 - (memory_fragments.embedding <=> query_embedding) AS similarity,
    memory_fragments.created_at
  FROM memory_fragments
  WHERE 
    (target_user_id IS NULL OR memory_fragments.user_id = target_user_id)
    AND 1 - (memory_fragments.embedding <=> query_embedding) > match_threshold
  ORDER BY memory_fragments.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Success message
SELECT 'Database setup complete! Memory system should now work.' as status;