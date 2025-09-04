-- Check the full text of the Maine memory
-- Run this to see the complete memory

SELECT 'Full Maine memory:' as info;
SELECT fragment_text FROM memory_fragments mf
JOIN avatars a ON mf.avatar_id = a.id 
WHERE a.slug = 'jonathan_braden' 
AND mf.fragment_text ILIKE '%maine%'
AND mf.fragment_text ILIKE '%1994%';