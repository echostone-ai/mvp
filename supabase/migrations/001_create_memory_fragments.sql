-- Enable the pgvector extension for vector operations
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the memory_fragments table
CREATE TABLE memory_fragments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fragment_text TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  conversation_context JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient vector similarity search using cosine distance
CREATE INDEX memory_fragments_embedding_idx ON memory_fragments 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Create index for user-specific queries
CREATE INDEX memory_fragments_user_id_idx ON memory_fragments (user_id);

-- Create index for timestamp-based queries
CREATE INDEX memory_fragments_created_at_idx ON memory_fragments (created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE memory_fragments ENABLE ROW LEVEL SECURITY;

-- Create RLS policy to ensure users can only access their own memory fragments
CREATE POLICY "Users can only access their own memory fragments" ON memory_fragments
  FOR ALL USING (auth.uid() = user_id);

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update the updated_at column
CREATE TRIGGER update_memory_fragments_updated_at 
    BEFORE UPDATE ON memory_fragments 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();