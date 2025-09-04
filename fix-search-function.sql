-- Fix the search function to be more flexible
-- Run this to make the search work better

DROP FUNCTION IF EXISTS search_memories(text, text, integer);

CREATE OR REPLACE FUNCTION public.search_memories(
  p_slug TEXT,
  p_query TEXT,
  p_limit INT DEFAULT 8
) RETURNS TABLE(
  id UUID,
  avatar_id UUID,
  fragment_text TEXT,
  score DOUBLE PRECISION,
  conversation_context JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_avatar_id UUID;
  search_words TEXT[];
  word TEXT;
BEGIN
  -- Try to find avatar in avatars table first
  SELECT a.id INTO target_avatar_id 
  FROM avatars a 
  WHERE a.slug = p_slug;
  
  -- If not found, try avatar_profiles table
  IF target_avatar_id IS NULL THEN
    SELECT ap.id INTO target_avatar_id 
    FROM avatar_profiles ap 
    WHERE ap.name = p_slug;
  END IF;
  
  -- If still not found, return empty
  IF target_avatar_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Split query into individual words for better matching
  search_words := string_to_array(lower(p_query), ' ');
  
  -- Return memory fragments for this avatar
  RETURN QUERY
  SELECT 
    mf.id,
    mf.avatar_id,
    mf.fragment_text,
    (CASE 
      -- Exact phrase match gets highest score
      WHEN lower(mf.fragment_text) LIKE '%' || lower(p_query) || '%' THEN 1.0
      -- Individual word matches
      WHEN EXISTS (
        SELECT 1 FROM unnest(search_words) AS word 
        WHERE word != '' AND lower(mf.fragment_text) LIKE '%' || word || '%'
      ) THEN 0.8
      -- Context matches
      WHEN lower(mf.conversation_context::text) LIKE '%' || lower(p_query) || '%' THEN 0.6
      -- Default for empty query
      WHEN p_query = '' THEN 0.5
      ELSE 0.0
    END)::DOUBLE PRECISION as score,
    mf.conversation_context
  FROM memory_fragments mf
  WHERE mf.avatar_id = target_avatar_id
    AND (
      -- Exact phrase match
      lower(mf.fragment_text) LIKE '%' || lower(p_query) || '%'
      -- OR any word matches
      OR EXISTS (
        SELECT 1 FROM unnest(search_words) AS word 
        WHERE word != '' AND lower(mf.fragment_text) LIKE '%' || word || '%'
      )
      -- OR context matches
      OR lower(mf.conversation_context::text) LIKE '%' || lower(p_query) || '%'
      -- OR empty query (return all)
      OR p_query = ''
    )
  ORDER BY score DESC, mf.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION search_memories(TEXT, TEXT, INT) TO anon;
GRANT EXECUTE ON FUNCTION search_memories(TEXT, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION search_memories(TEXT, TEXT, INT) TO service_role;

-- Test the improved search
SELECT 'Testing improved search with "when did you move to maine":' as test;
SELECT fragment_text, score FROM search_memories('jonathan_braden', 'when did you move to maine', 3);

SELECT 'Testing with just "maine":' as test;
SELECT fragment_text, score FROM search_memories('jonathan_braden', 'maine', 3);