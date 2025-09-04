-- Simple Memory Fix - Apply this in Supabase SQL Editor
-- This makes the enhanced memory function much more permissive

CREATE OR REPLACE FUNCTION get_enhanced_memories(
    target_user_id uuid DEFAULT NULL,
    target_avatar_id uuid DEFAULT NULL,
    search_query text DEFAULT '',
    match_count integer DEFAULT 64,
    similarity_threshold float DEFAULT 0.1,
    include_bio_facts boolean DEFAULT true
)
RETURNS TABLE (
    id uuid,
    user_id uuid,
    avatar_id uuid,
    fragment_text text,
    conversation_context jsonb,
    similarity_score float,
    match_type text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
) 
LANGUAGE plpgsql
AS $$
DECLARE
    query_words text[];
BEGIN
    -- Split query into words
    query_words := string_to_array(lower(search_query), ' ');
    
    RETURN QUERY
    SELECT 
        mf.id,
        mf.user_id,
        mf.avatar_id,
        mf.fragment_text,
        mf.conversation_context,
        0.8::float AS similarity_score,
        'permissive_match'::text AS match_type,
        mf.created_at,
        mf.updated_at
    FROM memory_fragments mf
    WHERE 
        -- Include avatar memories
        (target_avatar_id IS NULL OR mf.avatar_id = target_avatar_id)
        -- Include user memories if specified
        AND (target_user_id IS NULL OR mf.user_id = target_user_id)
        -- Very permissive text matching
        AND (
            search_query = ''
            -- Exact phrase match
            OR lower(mf.fragment_text) LIKE '%' || lower(search_query) || '%'
            -- Individual word matching
            OR EXISTS (
                SELECT 1 FROM unnest(query_words) AS word 
                WHERE lower(mf.fragment_text) LIKE '%' || word || '%'
                AND length(word) > 1
                AND word NOT IN ('do', 'you', 'can', 'the', 'a', 'an', 'is', 'are', 'what', 'how', 'when', 'where', 'why', 'who')
            )
            -- Always include some avatar memories for context
            OR (include_bio_facts AND mf.avatar_id = target_avatar_id AND mf.user_id IS NULL)
        )
    ORDER BY 
        -- Prioritize exact matches
        CASE 
            WHEN lower(mf.fragment_text) LIKE '%' || lower(search_query) || '%' THEN 1
            ELSE 2
        END,
        mf.created_at DESC
    LIMIT match_count;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_enhanced_memories TO authenticated, anon, service_role;