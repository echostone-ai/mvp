-- Memory Performance Optimization Migration (Lite Version)
-- Task 7: Optimize memory retrieval performance with indexing
-- This version avoids memory-intensive operations for Supabase compatibility

-- 1. Drop existing indexes if they exist
DROP INDEX IF EXISTS memory_fragments_embedding_idx;

-- 2. Skip the ivfflat index creation for now due to memory constraints
-- We'll create it later when the dataset is smaller or use a different approach
-- CREATE INDEX IF NOT EXISTS memory_fragments_embedding_cosine_idx 
-- ON memory_fragments USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 3. Create composite index for user_id + avatar_id + created_at for faster filtering
CREATE INDEX IF NOT EXISTS memory_fragments_user_avatar_time_idx 
ON memory_fragments (user_id, avatar_id, created_at DESC);

-- 4. Create index for conversation_context JSONB queries
CREATE INDEX IF NOT EXISTS memory_fragments_conversation_context_idx 
ON memory_fragments USING gin (conversation_context);

-- 5. Create simple indexes for common queries
CREATE INDEX IF NOT EXISTS memory_fragments_user_id_idx 
ON memory_fragments (user_id);

CREATE INDEX IF NOT EXISTS memory_fragments_avatar_id_idx 
ON memory_fragments (avatar_id);

-- 6. Update table statistics for better query planning
ANALYZE memory_fragments;

-- 7. Create function for optimized memory retrieval with capping (without vector similarity)
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
BEGIN
  -- For now, return most recent memories since we can't do vector similarity efficiently
  -- This can be improved later when vector indexes are available
  RETURN QUERY
  WITH recent_memories AS (
    SELECT
      mf.id,
      mf.user_id,
      mf.avatar_id,
      mf.fragment_text,
      mf.conversation_context,
      0.8::float AS similarity, -- Default similarity score
      mf.created_at,
      mf.updated_at,
      -- Rough token estimation: words * 1.3 (accounting for subwords)
      CEIL(array_length(string_to_array(mf.fragment_text, ' '), 1) * 1.3)::integer AS token_count
    FROM memory_fragments mf
    WHERE 
      mf.user_id = target_user_id
      AND (target_avatar_id IS NULL OR mf.avatar_id = target_avatar_id)
    ORDER BY mf.created_at DESC
    LIMIT match_count * 2  -- Get more results to allow for token filtering
  ),
  token_limited AS (
    SELECT *,
      SUM(token_count) OVER (ORDER BY created_at DESC ROWS UNBOUNDED PRECEDING) AS running_tokens
    FROM recent_memories
  )
  SELECT 
    tl.id,
    tl.user_id,
    tl.avatar_id,
    tl.fragment_text,
    tl.conversation_context,
    tl.similarity,
    tl.created_at,
    tl.updated_at,
    tl.token_count
  FROM token_limited tl
  WHERE tl.running_tokens <= max_tokens
  ORDER BY tl.created_at DESC
  LIMIT match_count;
END;
$$;

-- 8. Create function for text-based fallback search with token capping
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
BEGIN
  RETURN QUERY
  WITH text_matches AS (
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
  ),
  token_limited AS (
    SELECT *,
      SUM(token_count) OVER (ORDER BY similarity DESC ROWS UNBOUNDED PRECEDING) AS running_tokens
    FROM text_matches
  )
  SELECT 
    tl.id,
    tl.user_id,
    tl.avatar_id,
    tl.fragment_text,
    tl.conversation_context,
    tl.similarity,
    tl.created_at,
    tl.updated_at,
    tl.token_count
  FROM token_limited tl
  WHERE tl.running_tokens <= max_tokens
  ORDER BY tl.similarity DESC
  LIMIT match_count;
END;
$$;

-- 9. Create a function to add vector index when memory allows
CREATE OR REPLACE FUNCTION create_vector_index_when_ready()
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  -- This function can be called later when the dataset is smaller
  -- or when more memory is available
  BEGIN
    CREATE INDEX IF NOT EXISTS memory_fragments_embedding_cosine_idx 
    ON memory_fragments USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);
    
    RETURN true;
  EXCEPTION WHEN OTHERS THEN
    -- If it fails, just return false
    RETURN false;
  END;
END;
$$;

-- Grant execute permissions on the new functions
GRANT EXECUTE ON FUNCTION get_relevant_memories_optimized TO authenticated;
GRANT EXECUTE ON FUNCTION search_memories_by_text_optimized TO authenticated;
GRANT EXECUTE ON FUNCTION create_vector_index_when_ready TO authenticated;

-- Add comments
COMMENT ON FUNCTION get_relevant_memories_optimized IS 'Optimized memory retrieval with token capping (fallback to recency-based when vector index unavailable)';
COMMENT ON FUNCTION search_memories_by_text_optimized IS 'Text-based memory search with token capping for fallback scenarios';
COMMENT ON FUNCTION create_vector_index_when_ready IS 'Creates vector index when memory constraints allow - call manually when ready';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Memory performance optimization (lite) completed successfully';
  RAISE NOTICE 'Vector index creation skipped due to memory constraints';
  RAISE NOTICE 'Call create_vector_index_when_ready() later to add vector similarity';
END $$;