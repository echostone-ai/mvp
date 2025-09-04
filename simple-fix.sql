-- Simple fix - just get it working
-- Run this in your Supabase SQL Editor

-- Drop the existing function first
DROP FUNCTION IF EXISTS search_memories(text, text, integer);

-- Create the search_memories function with the correct return type
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
  
  -- Return memory fragments for this avatar
  RETURN QUERY
  SELECT 
    mf.id,
    mf.avatar_id,
    mf.fragment_text,
    (CASE 
      WHEN mf.fragment_text ILIKE '%' || p_query || '%' THEN 0.9
      WHEN mf.conversation_context::text ILIKE '%' || p_query || '%' THEN 0.7
      ELSE 0.5
    END)::DOUBLE PRECISION as score,
    mf.conversation_context
  FROM memory_fragments mf
  WHERE mf.avatar_id = target_avatar_id
    AND (
      mf.fragment_text ILIKE '%' || p_query || '%' 
      OR mf.conversation_context::text ILIKE '%' || p_query || '%'
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

-- Test it
SELECT 'Testing search:' as test, COUNT(*) as found FROM search_memories('jonathan_braden', 'who are you', 3);