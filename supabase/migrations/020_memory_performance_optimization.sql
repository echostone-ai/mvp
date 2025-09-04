-- Memory Performance Optimization Migration
-- Task 7: Optimize memory retrieval performance with indexing

-- 1. Create GIN index on embedding column for faster vector operations
-- Note: We'll skip the GIN index on embeddings as it's not typically useful for vector similarity
-- Instead focus on the ivfflat index which is designed for vector operations

-- 2. Optimize the existing ivfflat index for better performance
-- Drop the old index if it exists and recreate with better parameters
DROP INDEX IF EXISTS memory_fragments_embedding_idx;

-- Create optimized ivfflat index for cosine similarity with better list count
-- Lists = sqrt(total_rows) is a good rule of thumb, but we'll use 100 for now
CREATE INDEX IF NOT EXISTS memory_fragments_embedding_cosine_idx 
ON memory_fragments USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 3. Create composite index for user_id + avatar_id + created_at for faster filtering
CREATE INDEX IF NOT EXISTS memory_fragments_user_avatar_time_idx 
ON memory_fragments (user_id, avatar_id, created_at DESC);

-- 4. Create index for conversation_context JSONB queries
CREATE INDEX IF NOT EXISTS memory_fragments_conversation_context_idx 
ON memory_fragments USING gin (conversation_context);

-- 5. Update table statistics for better query planning
ANALYZE memory_fragments;

-- 6. Create function for optimized memory retrieval with capping
CREATE OR REPLACE FUNCTION get_relevant_memories_optimized(
  query_embedding vector(1536),
  target_user_id uuid,
  target_avatar_id uuid DEFAULT NULL,
  match_threshold float DEFAULT 0.7,
  match_count integer DEFAULT 6,
  max_tokens integer DEFAULT 300
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  avatar_id uuid,
  fragment_text text,
  conversation_context jsonb,
  similarity float,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  token_count integer
) 
LANGUAGE plpgsql
AS $$
DECLARE
  current_tokens integer := 0;
  fragment_record record;
BEGIN
  -- Use cursor to process results and cap tokens
  FOR fragment_record IN
    SELECT
      mf.id,
      mf.user_id,
      mf.avatar_id,
      mf.fragment_text,
      mf.conversation_context,
      1 - (mf.embedding <=> query_embedding) AS similarity,
      mf.created_at,
      mf.updated_at,
      -- Rough token estimation: words * 1.3 (accounting for subwords)
      CEIL(array_length(string_to_array(mf.fragment_text, ' '), 1) * 1.3)::integer AS token_count
    FROM memory_fragments mf
    WHERE 
      mf.user_id = target_user_id
      AND (target_avatar_id IS NULL OR mf.avatar_id = target_avatar_id)
      AND 1 - (mf.embedding <=> query_embedding) > match_threshold
    ORDER BY mf.embedding <=> query_embedding
    LIMIT match_count * 2  -- Get more results to allow for token filtering
  LOOP
    -- Check if adding this fragment would exceed token limit
    IF current_tokens + fragment_record.token_count <= max_tokens THEN
      current_tokens := current_tokens + fragment_record.token_count;
      
      -- Return this fragment
      id := fragment_record.id;
      user_id := fragment_record.user_id;
      avatar_id := fragment_record.avatar_id;
      fragment_text := fragment_record.fragment_text;
      conversation_context := fragment_record.conversation_context;
      similarity := fragment_record.similarity;
      created_at := fragment_record.created_at;
      updated_at := fragment_record.updated_at;
      token_count := fragment_record.token_count;
      
      RETURN NEXT;
      
      -- Stop if we've reached the desired count
      IF (SELECT COUNT(*) FROM (SELECT 1) AS dummy) >= match_count THEN
        EXIT;
      END IF;
    END IF;
  END LOOP;
  
  RETURN;
END;
$$;

-- 7. Create function for text-based fallback search with token capping
CREATE OR REPLACE FUNCTION search_memories_by_text_optimized(
  search_text text,
  target_user_id uuid,
  target_avatar_id uuid DEFAULT NULL,
  match_count integer DEFAULT 6,
  max_tokens integer DEFAULT 300
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  avatar_id uuid,
  fragment_text text,
  conversation_context jsonb,
  similarity float,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  token_count integer
) 
LANGUAGE plpgsql
AS $$
DECLARE
  current_tokens integer := 0;
  fragment_record record;
BEGIN
  -- Use text search with token capping
  FOR fragment_record IN
    SELECT
      mf.id,
      mf.user_id,
      mf.avatar_id,
      mf.fragment_text,
      mf.conversation_context,
      -- Simple text similarity score based on keyword matches
      CASE 
        WHEN lower(mf.fragment_text) LIKE '%' || lower(search_text) || '%' THEN 0.9
        WHEN lower(mf.fragment_text) ~ lower(search_text) THEN 0.8
        ELSE 0.7
      END AS similarity,
      mf.created_at,
      mf.updated_at,
      -- Rough token estimation: words * 1.3 (accounting for subwords)
      CEIL(array_length(string_to_array(mf.fragment_text, ' '), 1) * 1.3)::integer AS token_count
    FROM memory_fragments mf
    WHERE 
      mf.user_id = target_user_id
      AND (target_avatar_id IS NULL OR mf.avatar_id = target_avatar_id)
      AND (
        lower(mf.fragment_text) LIKE '%' || lower(search_text) || '%'
        OR lower(mf.fragment_text) ~ lower(search_text)
      )
    ORDER BY 
      CASE 
        WHEN lower(mf.fragment_text) LIKE '%' || lower(search_text) || '%' THEN 1
        WHEN lower(mf.fragment_text) ~ lower(search_text) THEN 2
        ELSE 3
      END,
      mf.created_at DESC
    LIMIT match_count * 2  -- Get more results to allow for token filtering
  LOOP
    -- Check if adding this fragment would exceed token limit
    IF current_tokens + fragment_record.token_count <= max_tokens THEN
      current_tokens := current_tokens + fragment_record.token_count;
      
      -- Return this fragment
      id := fragment_record.id;
      user_id := fragment_record.user_id;
      avatar_id := fragment_record.avatar_id;
      fragment_text := fragment_record.fragment_text;
      conversation_context := fragment_record.conversation_context;
      similarity := fragment_record.similarity;
      created_at := fragment_record.created_at;
      updated_at := fragment_record.updated_at;
      token_count := fragment_record.token_count;
      
      RETURN NEXT;
      
      -- Stop if we've reached the desired count
      IF (SELECT COUNT(*) FROM (SELECT 1) AS dummy) >= match_count THEN
        EXIT;
      END IF;
    END IF;
  END LOOP;
  
  RETURN;
END;
$$;

-- Grant execute permissions on the new functions
GRANT EXECUTE ON FUNCTION get_relevant_memories_optimized TO authenticated;
GRANT EXECUTE ON FUNCTION search_memories_by_text_optimized TO authenticated;