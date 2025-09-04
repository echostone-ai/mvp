-- Debug the search_memories function
-- Run this to see what's happening

-- First, let's see if the memories are actually there
SELECT 
  'Total memories for Jonathan:' as check_type,
  COUNT(*) as count
FROM memory_fragments mf
JOIN avatar_profiles ap ON mf.avatar_id = ap.id
WHERE ap.name = 'jonathan_braden';

-- Test the search_memories function directly
SELECT * FROM search_memories('jonathan_braden', 'who are you', 5);

-- Let's also see what avatar names exist
SELECT 'Available avatars:' as check_type, name, id FROM avatar_profiles;

-- Check if there are any memories at all
SELECT 'All memories count:' as check_type, COUNT(*) as count FROM memory_fragments;