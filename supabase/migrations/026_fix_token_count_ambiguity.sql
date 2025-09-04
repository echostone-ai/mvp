-- Fix for ambiguous token_count column reference
-- Migration 026: Fix token_count column ambiguity in memory functions

-- Drop existing functions that have the ambiguous column reference
DROP FUNCTION IF EXISTS get_relevant_memories_optimized(vector, uuid, uuid, float, integer, integer);
DROP FUNCTION IF EXISTS search_memories_by_text_optimized(text, uuid, uuid, integer, integer);

-- Recreate get_relevant_memories_optimized with fixed column references
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
  -- Return most recent memories with proper column aliasing to avoid ambiguity
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
      CEIL(array_length(string_to_array(mf.fragment_text, ' '), 1) * 1.3)::integer AS fragment_tokens
    FROM memory_fragments mf
    WHERE 
      mf.user_id = target_user_id
      AND (target_avatar_id IS NULL OR mf.avatar_id = target_avatar_id)
    ORDER BY mf.created_at DESC
    LIMIT match_count * 2  -- Get more results to allow for token filtering
  ),
  token_limited AS (
    SELECT 
      rm.id,
      rm.user_id,
      rm.avatar_id,
      rm.fragment_text,
      rm.conversation_context,
      rm.similarity,
      rm.created_at,
      rm.updated_at,
      rm.fragment_tokens,
      SUM(rm.fragment_tokens) OVER (ORDER BY rm.created_at DESC ROWS UNBOUNDED PRECEDING) AS running_tokens
    FROM recent_memories rm
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
    tl.fragment_tokens AS token_count
  FROM token_limited tl
  WHERE tl.running_tokens <= max_tokens
  ORDER BY tl.created_at DESC
  LIMIT match_count;
END;
$$;

-- Recreate search_memories_by_text_optimized with fixed column references
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
      CEIL(array_length(string_to_array(mf.fragment_text, ' '), 1) * 1.3)::integer AS fragment_tokens
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
    SELECT 
      tm.id,
      tm.user_id,
      tm.avatar_id,
      tm.fragment_text,
      tm.conversation_context,
      tm.similarity,
      tm.created_at,
      tm.updated_at,
      tm.fragment_tokens,
      SUM(tm.fragment_tokens) OVER (ORDER BY tm.similarity DESC ROWS UNBOUNDED PRECEDING) AS running_tokens
    FROM text_matches tm
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
    tl.fragment_tokens AS token_count
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
COMMENT ON FUNCTION get_relevant_memories_optimized IS 'Optimized memory retrieval with token capping (fixed column ambiguity issue)';
COMMENT ON FUNCTION search_memories_by_text_optimized IS 'Text-based memory search with token capping (fixed column ambiguity issue)';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 026: Fixed token_count column ambiguity in memory functions';
END $$;