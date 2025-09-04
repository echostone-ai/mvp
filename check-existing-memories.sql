-- Check what memories actually exist for Jonathan
-- Run this to see what we have

-- Show some sample memories
SELECT 'Sample memories for Jonathan:' as info;
SELECT fragment_text FROM memory_fragments mf
JOIN avatars a ON mf.avatar_id = a.id 
WHERE a.slug = 'jonathan_braden' 
LIMIT 5;

-- Check for any identity/bio memories
SELECT 'Identity/bio memories:' as info;
SELECT fragment_text FROM memory_fragments mf
JOIN avatars a ON mf.avatar_id = a.id 
WHERE a.slug = 'jonathan_braden' 
AND (mf.conversation_context->>'type' = 'identity' OR mf.conversation_context->>'type' = 'bio')
LIMIT 3;