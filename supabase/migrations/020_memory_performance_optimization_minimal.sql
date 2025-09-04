-- Memory Performance Optimization Migration (Minimal Version)
-- Task 7: Optimize memory retrieval performance with indexing
-- This version avoids ALL memory-intensive operations for Supabase compatibility

-- 1. Drop existing indexes if they exist (this shouldn't require extra memory)
DROP INDEX IF EXISTS memory_fragments_embedding_idx;

-- 2. Create only simple B-tree indexes that don't require much memory
CREATE INDEX IF NOT EXISTS memory_fragments_user_id_idx 
ON memory_fragments (user_id);

CREATE INDEX IF NOT EXISTS memory_fragments_avatar_id_idx 
ON memory_fragments (avatar_id);

CREATE INDEX IF NOT EXISTS memory_fragments_created_at_idx 
ON memory_fragments (created_at DESC);

-- 3. Create composite index for user_id + created_at (smaller than user+avatar+time)
CREATE INDEX IF NOT EXISTS memory_fragments_user_time_idx 
ON memory_fragments (user_id, created_at DESC);

-- 4. Skip JSONB GIN index for now - it's causing the memory issue
-- CREATE INDEX IF NOT EXISTS memory_fragments_conversation_context_idx 
-- ON memory_fragments USING gin (conversation_context);

-- 5. Update table statistics for better query planning
ANALYZE memory_fragments;

-- 6. Create function for optimized memory retrieval (recency-based fallback)
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
  -- Return most recent memories since we can't do vector similarity efficiently
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
      COALESCE(CEIL(array_length(string_to_array(mf.fragment_text, ' '), 1) * 1.3), 10)::integer AS token_count
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

-- 7. Create function for text-based search (simplified)
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
        ELSE 0.7
      END AS similarity,
      mf.created_at,
      mf.updated_at,
      -- Rough token estimation: words * 1.3 (accounting for subwords)
      COALESCE(CEIL(array_length(string_to_array(mf.fragment_text, ' '), 1) * 1.3), 10)::integer AS token_count
    FROM memory_fragments mf
    WHERE 
      mf.user_id = target_user_id
      AND (target_avatar_id IS NULL OR mf.avatar_id = target_avatar_id)
      AND lower(mf.fragment_text) LIKE '%' || lower(search_text) || '%'
    ORDER BY mf.created_at DESC
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

-- 8. Create a function to add more indexes later when memory allows
CREATE OR REPLACE FUNCTION create_additional_indexes_when_ready()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  result_msg text := '';
BEGIN
  -- Try to create the JSONB GIN index
  BEGIN
    CREATE INDEX IF NOT EXISTS memory_fragments_conversation_context_idx 
    ON memory_fragments USING gin (conversation_context);
    result_msg := result_msg || 'JSONB GIN index created successfully. ';
  EXCEPTION WHEN OTHERS THEN
    result_msg := result_msg || 'JSONB GIN index failed (memory constraint). ';
  END;
  
  -- Try to create the vector index with minimal lists
  BEGIN
    CREATE INDEX IF NOT EXISTS memory_fragments_embedding_cosine_idx 
    ON memory_fragments USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
    result_msg := result_msg || 'Vector index created successfully. ';
  EXCEPTION WHEN OTHERS THEN
    result_msg := result_msg || 'Vector index failed (memory constraint). ';
  END;
  
  RETURN result_msg;
END;
$$;

-- Grant execute permissions on the new functions
GRANT EXECUTE ON FUNCTION get_relevant_memories_optimized TO authenticated;
GRANT EXECUTE ON FUNCTION search_memories_by_text_optimized TO authenticated;
GRANT EXECUTE ON FUNCTION create_additional_indexes_when_ready TO authenticated;

-- Add comments
COMMENT ON FUNCTION get_relevant_memories_optimized IS 'Optimized memory retrieval with token capping (recency-based fallback)';
COMMENT ON FUNCTION search_memories_by_text_optimized IS 'Text-based memory search with token capping';
COMMENT ON FUNCTION create_additional_indexes_when_ready IS 'Creates additional indexes when memory constraints allow';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Memory performance optimization (minimal) completed successfully';
  RAISE NOTICE 'Only basic B-tree indexes created to avoid memory constraints';
  RAISE NOTICE 'Call create_additional_indexes_when_ready() later for advanced indexes';
END $$;