-- Debug why memories aren't being used
-- Run this to see what's happening with the search

-- Test the search function with the exact query
SELECT 'Testing search with "born":' as test;
SELECT fragment_text FROM search_memories('jonathan_braden', 'born', 5);

-- Test with "birth"
SELECT 'Testing search with "birth":' as test;
SELECT fragment_text FROM search_memories('jonathan_braden', 'birth', 5);

-- Test with empty query (should return some results)
SELECT 'Testing with empty query:' as test;
SELECT fragment_text FROM search_memories('jonathan_braden', '', 5);

-- Check what memories actually contain birth/born info
SELECT 'Memories containing "born":' as test;
SELECT fragment_text FROM memory_fragments mf
JOIN avatars a ON mf.avatar_id = a.id 
WHERE a.slug = 'jonathan_braden' 
AND mf.fragment_text ILIKE '%born%'
LIMIT 3;

-- Check what memories actually contain "March" (his birth month)
SELECT 'Memories containing "March":' as test;
SELECT fragment_text FROM memory_fragments mf
JOIN avatars a ON mf.avatar_id = a.id 
WHERE a.slug = 'jonathan_braden' 
AND mf.fragment_text ILIKE '%March%'
LIMIT 3;