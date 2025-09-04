-- Test search for Maine-related memories
-- Run this to see what the search finds

-- Test search with "maine"
SELECT 'Search results for "maine":' as test;
SELECT fragment_text FROM search_memories('jonathan_braden', 'maine', 5);

-- Check what memories actually contain "maine"
SELECT 'All memories containing "maine":' as test;
SELECT fragment_text FROM memory_fragments mf
JOIN avatars a ON mf.avatar_id = a.id 
WHERE a.slug = 'jonathan_braden' 
AND mf.fragment_text ILIKE '%maine%'
LIMIT 5;

-- Check what memories contain "1994"
SELECT 'Memories containing "1994":' as test;
SELECT fragment_text FROM memory_fragments mf
JOIN avatars a ON mf.avatar_id = a.id 
WHERE a.slug = 'jonathan_braden' 
AND mf.fragment_text ILIKE '%1994%'
LIMIT 3;