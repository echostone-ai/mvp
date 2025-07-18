-- Complete EchoStone Database Setup
-- Run this entire script in your Supabase SQL Editor

-- Enable the pgvector extension for vector operations
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the profiles table for user data
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_data JSONB DEFAULT '{}'::jsonb,
  voice_id TEXT,
  voice_settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique index on user_id to ensure one profile per user
CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_unique ON profiles (user_id);

-- Create indexes for profiles table
CREATE INDEX IF NOT EXISTS profiles_voice_id_idx ON profiles (voice_id);
CREATE INDEX IF NOT EXISTS profiles_created_at_idx ON profiles (created_at);

-- Create the memory_fragments table
CREATE TABLE IF NOT EXISTS memory_fragments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fragment_text TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  conversation_context JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create the conversations table for persistent chat history
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for memory_fragments
CREATE INDEX IF NOT EXISTS memory_fragments_embedding_idx ON memory_fragments 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS memory_fragments_user_id_idx ON memory_fragments (user_id);
CREATE INDEX IF NOT EXISTS memory_fragments_created_at_idx ON memory_fragments (created_at);

-- Create indexes for conversations
CREATE INDEX IF NOT EXISTS conversations_user_id_idx ON conversations (user_id);
CREATE INDEX IF NOT EXISTS conversations_last_active_idx ON conversations (last_active);
CREATE INDEX IF NOT EXISTS conversations_user_last_active_idx ON conversations (user_id, last_active DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_fragments ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for memory_fragments
DROP POLICY IF EXISTS "Users can only access their own memory fragments" ON memory_fragments;
CREATE POLICY "Users can only access their own memory fragments" ON memory_fragments
  FOR ALL USING (auth.uid() = user_id);

-- Create RLS policies for profiles
DROP POLICY IF EXISTS "Users can only access their own profile" ON profiles;
CREATE POLICY "Users can only access their own profile" ON profiles
  FOR ALL USING (auth.uid() = user_id);

-- Create RLS policies for conversations
DROP POLICY IF EXISTS "Users can only access their own conversations" ON conversations;
CREATE POLICY "Users can only access their own conversations" ON conversations
  FOR ALL USING (auth.uid() = user_id);

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update the updated_at column
DROP TRIGGER IF EXISTS update_memory_fragments_updated_at ON memory_fragments;
CREATE TRIGGER update_memory_fragments_updated_at 
    BEFORE UPDATE ON memory_fragments 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at 
    BEFORE UPDATE ON conversations 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create a function to automatically create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $
BEGIN
  INSERT INTO public.profiles (user_id, created_at, updated_at)
  VALUES (NEW.id, NOW(), NOW());
  RETURN NEW;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to automatically create profiles for new users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update existing users who might not have profiles
INSERT INTO profiles (user_id, created_at, updated_at)
SELECT id, created_at, updated_at 
FROM auth.users 
WHERE id NOT IN (SELECT user_id FROM profiles)
ON CONFLICT (user_id) DO NOTHING;

-- Drop existing function first to avoid return type conflicts
DROP FUNCTION IF EXISTS match_memory_fragments(vector, double precision, integer, uuid);
DROP FUNCTION IF EXISTS match_memory_fragments(vector, float, integer, uuid);

-- Function to perform vector similarity search for memory fragments
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
  created_at timestamptz,
  updated_at timestamptz,
  embedding vector(1536)
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
    memory_fragments.created_at,
    memory_fragments.updated_at,
    memory_fragments.embedding
  FROM memory_fragments
  WHERE 
    (target_user_id IS NULL OR memory_fragments.user_id = target_user_id)
    AND 1 - (memory_fragments.embedding <=> query_embedding) > match_threshold
  ORDER BY memory_fragments.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Verify setup
DO $$
BEGIN
  -- Check if pgvector extension is enabled
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    RAISE EXCEPTION 'pgvector extension is not enabled';
  END IF;
  
  -- Check if tables exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    RAISE EXCEPTION 'profiles table does not exist';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'memory_fragments') THEN
    RAISE EXCEPTION 'memory_fragments table does not exist';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversations') THEN
    RAISE EXCEPTION 'conversations table does not exist';
  END IF;
  
  -- Check if function exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'match_memory_fragments') THEN
    RAISE EXCEPTION 'match_memory_fragments function does not exist';
  END IF;
  
  RAISE NOTICE '✅ EchoStone database setup completed successfully!';
  RAISE NOTICE '✅ pgvector extension enabled';
  RAISE NOTICE '✅ profiles table created';
  RAISE NOTICE '✅ memory_fragments table created';
  RAISE NOTICE '✅ conversations table created';
  RAISE NOTICE '✅ match_memory_fragments function created';
  RAISE NOTICE '✅ All indexes and policies configured';
  RAISE NOTICE '✅ Auto-profile creation trigger enabled';
  RAISE NOTICE '🎉 Your EchoStone system is ready to use!';
END
$$;