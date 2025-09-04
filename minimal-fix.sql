-- Minimal fix to get Jonathan working with existing schema
-- Run this in your Supabase SQL Editor

-- First, let's see what we're working with
SELECT 'Checking existing tables...' as status;

-- Check if avatars table exists and what it looks like
DO $$
BEGIN
  -- Try to select from avatars table to see if it exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'avatars') THEN
    RAISE NOTICE 'avatars table exists';
  ELSE
    RAISE NOTICE 'avatars table does not exist';
  END IF;
  
  -- Check avatar_profiles
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'avatar_profiles') THEN
    RAISE NOTICE 'avatar_profiles table exists';
  ELSE
    RAISE NOTICE 'avatar_profiles table does not exist';
  END IF;
END $$;

-- Create a simple avatars table if it doesn't exist
CREATE TABLE IF NOT EXISTS avatars (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert Jonathan into avatars table
INSERT INTO avatars (slug, name)
VALUES ('jonathan_braden', 'Jonathan Braden')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name;

-- Get Jonathan's avatar ID from the avatars table
DO $$
DECLARE
  jonathan_avatar_id UUID;
  old_avatar_id UUID;
  updated_count INTEGER;
BEGIN
  -- Get Jonathan's ID from avatars table
  SELECT id INTO jonathan_avatar_id FROM avatars WHERE slug = 'jonathan_braden';
  
  -- Get old ID from avatar_profiles if it exists
  SELECT id INTO old_avatar_id FROM avatar_profiles WHERE name = 'jonathan_braden' LIMIT 1;
  
  RAISE NOTICE 'New Jonathan avatar_id: %', jonathan_avatar_id;
  RAISE NOTICE 'Old Jonathan avatar_id: %', old_avatar_id;
  
  -- Update memory fragments to point to the new avatar_id
  IF old_avatar_id IS NOT NULL THEN
    -- Temporarily drop the foreign key constraint
    ALTER TABLE memory_fragments DROP CONSTRAINT IF EXISTS memory_fragments_avatar_id_fkey;
    
    -- Update the memory fragments
    UPDATE memory_fragments 
    SET avatar_id = jonathan_avatar_id 
    WHERE avatar_id = old_avatar_id;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % memory fragments to new avatar_id', updated_count;
    
    -- Add the foreign key constraint back, pointing to avatars table
    ALTER TABLE memory_fragments 
    ADD CONSTRAINT memory_fragments_avatar_id_fkey 
    FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create the search_memories function
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
  -- Resolve slug to avatar_id from avatars table
  SELECT a.id INTO target_avatar_id 
  FROM avatars a 
  WHERE a.slug = p_slug;
  
  -- If no avatar found, return empty
  IF target_avatar_id IS NULL THEN
    RAISE NOTICE 'No avatar found for slug: %', p_slug;
    RETURN;
  END IF;
  
  -- Return memory fragments for this avatar
  RETURN QUERY
  SELECT 
    mf.id,
    mf.avatar_id,
    mf.fragment_text,
    CASE 
      WHEN mf.fragment_text ILIKE '%' || p_query || '%' THEN 0.9
      WHEN mf.conversation_context::text ILIKE '%' || p_query || '%' THEN 0.7
      ELSE 0.5
    END as score,
    mf.conversation_context
  FROM memory_fragments mf
  WHERE mf.avatar_id = target_avatar_id
    AND (
      mf.fragment_text ILIKE '%' || p_query || '%' 
      OR mf.conversation_context::text ILIKE '%' || p_query || '%'
      OR p_query = '' -- Return all memories for empty query
    )
  ORDER BY score DESC, mf.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION search_memories(TEXT, TEXT, INT) TO anon;
GRANT EXECUTE ON FUNCTION search_memories(TEXT, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION search_memories(TEXT, TEXT, INT) TO service_role;

-- Test the function
SELECT 'Testing search_memories function:' as test;
SELECT COUNT(*) as memory_count FROM search_memories('jonathan_braden', '', 10);

-- Show final status
SELECT 'Final status:' as info;
SELECT 'Avatar:' as type, slug, name, id FROM avatars WHERE slug = 'jonathan_braden';
SELECT 'Memory count:' as type, COUNT(*)::text as value, ''::text as extra FROM memory_fragments mf 
JOIN avatars a ON mf.avatar_id = a.id WHERE a.slug = 'jonathan_braden';