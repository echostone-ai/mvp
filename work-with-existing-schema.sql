-- Work with existing avatars table schema
-- Run this in your Supabase SQL Editor

-- First, let's see what the avatars table structure actually is
SELECT 'Checking avatars table structure...' as status;

-- Check if Jonathan already exists in avatars table
DO $$
DECLARE
  jonathan_avatar_id UUID;
  old_avatar_id UUID;
  updated_count INTEGER;
  dummy_owner_id UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
  -- Check if Jonathan exists in avatars table
  SELECT id INTO jonathan_avatar_id FROM avatars WHERE slug = 'jonathan_braden' LIMIT 1;
  
  IF jonathan_avatar_id IS NOT NULL THEN
    RAISE NOTICE 'Jonathan already exists in avatars table with ID: %', jonathan_avatar_id;
  ELSE
    -- Try to insert Jonathan with a dummy owner_id
    BEGIN
      INSERT INTO avatars (slug, name, owner_id)
      VALUES ('jonathan_braden', 'Jonathan Braden', dummy_owner_id);
      
      SELECT id INTO jonathan_avatar_id FROM avatars WHERE slug = 'jonathan_braden';
      RAISE NOTICE 'Created Jonathan in avatars table with ID: %', jonathan_avatar_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not create Jonathan in avatars table: %', SQLERRM;
      -- Try without owner_id
      BEGIN
        INSERT INTO avatars (slug, name)
        VALUES ('jonathan_braden', 'Jonathan Braden');
        
        SELECT id INTO jonathan_avatar_id FROM avatars WHERE slug = 'jonathan_braden';
        RAISE NOTICE 'Created Jonathan in avatars table (no owner_id) with ID: %', jonathan_avatar_id;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Still could not create Jonathan: %', SQLERRM;
      END;
    END;
  END IF;
  
  -- Get old ID from avatar_profiles if it exists
  SELECT id INTO old_avatar_id FROM avatar_profiles WHERE name = 'jonathan_braden' LIMIT 1;
  
  IF old_avatar_id IS NOT NULL THEN
    RAISE NOTICE 'Found old Jonathan avatar_id in avatar_profiles: %', old_avatar_id;
    
    -- Update memory fragments to point to the new avatar_id
    IF jonathan_avatar_id IS NOT NULL THEN
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
  ELSE
    RAISE NOTICE 'No old avatar found in avatar_profiles';
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
  
  RAISE NOTICE 'Found avatar_id % for slug %', target_avatar_id, p_slug;
  
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
SELECT fragment_text FROM search_memories('jonathan_braden', 'who are you', 3);

-- Show final status
SELECT 'Final status - Avatars:' as info, slug, name, id FROM avatars WHERE slug = 'jonathan_braden';
SELECT 'Final status - Memory count:' as info, COUNT(*)::text as count FROM memory_fragments mf 
JOIN avatars a ON mf.avatar_id = a.id WHERE a.slug = 'jonathan_braden';