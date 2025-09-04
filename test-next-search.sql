-- Test what search finds for "where did you go next"
-- Run this to see what memories are returned

SELECT 'Search results for "where did you go next":' as test;
SELECT fragment_text, score FROM search_memories('jonathan_braden', 'where did you go next', 5);

-- Check for Austin memories
SELECT 'Austin memories:' as test;
SELECT fragment_text FROM memory_fragments mf
JOIN avatars a ON mf.avatar_id = a.id 
WHERE a.slug = 'jonathan_braden' 
AND mf.fragment_text ILIKE '%austin%'
LIMIT 3;

-- Check for college memories
SELECT 'College memories:' as test;
SELECT fragment_text FROM memory_fragments mf
JOIN avatars a ON mf.avatar_id = a.id 
WHERE a.slug = 'jonathan_braden' 
AND (mf.fragment_text ILIKE '%college%' OR mf.fragment_text ILIKE '%becker%')
LIMIT 3;