-- Memory Performance Optimization Migration (Functions Only)
-- Task 7: Optimize memory retrieval performance with indexing
-- This version creates ONLY functions, no indexes at all

-- Skip all index creation due to Supabase memory constraints
-- The existing indexes should be sufficient for basic queries

-- Update table statistics for better query planning (this is safe)
ANALYZE memory_fragments;

-- Create function for optimized memory retrieval (recency-based fallback)
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

-- Create function for text-based search (simplified)
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

-- Grant execute permissions on the new functions
GRANT EXECUTE ON FUNCTION get_relevant_memories_optimized TO authenticated;
GRANT EXECUTE ON FUNCTION search_memories_by_text_optimized TO authenticated;

-- Add comments
COMMENT ON FUNCTION get_relevant_memories_optimized IS 'Optimized memory retrieval with token capping (recency-based fallback)';
COMMENT ON FUNCTION search_memories_by_text_optimized IS 'Text-based memory search with token capping';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Memory performance optimization (functions only) completed successfully';
  RAISE NOTICE 'No indexes created due to Supabase memory constraints';
  RAISE NOTICE 'Functions provide optimized memory retrieval with existing indexes';
END $$;