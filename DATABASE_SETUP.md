# Database Setup for Conversation Memory Feature

This document explains how to set up the database schema and vector search infrastructure for the EchoStone conversation memory feature.

## Prerequisites

- Supabase project with database access
- pgvector extension support (available in Supabase by default)

## Setup Instructions

### 1. Enable pgvector Extension

In your Supabase SQL Editor, run:

```sql
-- Enable the pgvector extension for vector operations
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2. Create Memory Fragments Table

Execute the following SQL in your Supabase SQL Editor:

```sql
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
```

### 3. Create Vector Similarity Search Function

Execute the following SQL to create the similarity search function:

```sql
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
```

## Verification

After setting up the database schema, run the verification script:

```bash
node test-vector-operations.js
```

This will test:
- Vector operations functionality
- Table structure and accessibility
- Basic CRUD operations with vector data
- Similarity search capabilities

## Files Created

- `supabase/migrations/001_create_memory_fragments.sql` - Main migration file
- `supabase/functions/match_memory_fragments.sql` - Vector similarity search function
- `test-vector-operations.js` - Verification script
- `test-supabase.js` - Basic connection test

## Database Schema Details

### memory_fragments Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key, auto-generated |
| user_id | UUID | Foreign key to auth.users, with CASCADE delete |
| fragment_text | TEXT | The actual memory fragment text |
| embedding | vector(1536) | OpenAI embedding vector (1536 dimensions) |
| conversation_context | JSONB | Additional context about the conversation |
| created_at | TIMESTAMPTZ | Auto-generated creation timestamp |
| updated_at | TIMESTAMPTZ | Auto-updated modification timestamp |

### Indexes

- `memory_fragments_embedding_idx` - IVFFlat index for vector similarity search
- `memory_fragments_user_id_idx` - B-tree index for user-specific queries
- `memory_fragments_created_at_idx` - B-tree index for timestamp queries

### Security

- Row Level Security (RLS) enabled
- Users can only access their own memory fragments
- Automatic cleanup when user is deleted (CASCADE)

## Next Steps

Once the database setup is complete, you can proceed with implementing the memory service layer (Task 2 in the implementation plan).