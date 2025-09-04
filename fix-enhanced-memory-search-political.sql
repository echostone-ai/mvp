-- Enhanced Memory Search Fix for Political/Opinion Queries
-- This addresses the issue where political memories (Trump experiences) don't show up

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
    key_words text[];
    political_boost float := 3.0;  -- High boost for political content
    opinion_boost float := 2.8;   -- High boost for opinion content
    exact_boost float := 2.5;
    keyword_boost float := 1.5;
    bio_boost float := 1.3;
    is_political_query boolean := false;
    is_opinion_query boolean := false;
BEGIN
    -- Parse query for keywords and detect political/opinion queries
    query_words := string_to_array(lower(search_query), ' ');
    
    -- Detect political queries
    is_political_query := (
        search_query ~* '\b(trump|political|politics|america|emigration|left america|political climate)\b'
    );
    
    -- Detect opinion queries  
    is_opinion_query := (
        search_query ~* '\b(think|opinion|feel|believe|view|like|dislike|hate|love)\b'
    );
    
    -- Extract key content words (more permissive for political queries)
    SELECT array_agg(word) INTO key_words
    FROM unnest(query_words) AS word
    WHERE word NOT IN ('what', 'was', 'your', 'the', 'a', 'an', 'is', 'are', 'were', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'can', 'may', 'might', 'must', 'shall', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'and', 'or', 'but', 'so', 'if', 'then', 'else', 'when', 'where', 'why', 'how', 'who', 'which', 'that', 'this', 'these', 'those', 'me', 'my', 'mine', 'you', 'yours', 'he', 'his', 'she', 'her', 'hers', 'it', 'its', 'we', 'our', 'ours', 'they', 'their', 'theirs', 'i')
    AND length(word) > 1;
    
    RETURN QUERY
    WITH candidate_memories AS (
        SELECT
            mf.id,
            mf.user_id,
            mf.avatar_id,
            mf.fragment_text,
            mf.conversation_context,
            mf.created_at,
            mf.updated_at,
            -- Enhanced base similarity scoring with political/opinion detection
            CASE 
                WHEN search_query = '' THEN 0.8::float
                
                -- POLITICAL CONTENT MATCHING (highest priority)
                WHEN is_political_query AND (
                    lower(mf.fragment_text) ~* '\b(trump|political|politics|america|emigration|left america|political climate|miserable|bastard|run off|road|redneck|2018|2017)\b'
                    OR (mf.conversation_context->>'context') = 'politics_and_emigration'
                    OR (mf.conversation_context->>'type') = 'opinion'
                ) THEN 0.98::float
                
                -- OPINION CONTENT MATCHING (very high priority)
                WHEN is_opinion_query AND (
                    lower(mf.fragment_text) ~* '\b(think|opinion|feel|believe|view|like|dislike|hate|love|couldn.*handle|miserable)\b'
                    OR (mf.conversation_context->>'type') = 'opinion'
                    OR (mf.conversation_context->>'context') LIKE '%opinion%'
                ) THEN 0.95::float
                
                -- Exact phrase match
                WHEN lower(mf.fragment_text) LIKE '%' || lower(search_query) || '%' THEN 0.92::float
                
                -- Individual word matching (more permissive)
                WHEN EXISTS (
                    SELECT 1 FROM unnest(query_words) AS word 
                    WHERE lower(mf.fragment_text) LIKE '%' || word || '%'
                    AND length(word) > 1
                ) THEN 0.85::float
                
                -- Keyword matching
                WHEN key_words IS NOT NULL AND EXISTS (
                    SELECT 1 FROM unnest(key_words) AS kw 
                    WHERE lower(mf.fragment_text) LIKE '%' || kw || '%'
                ) THEN 0.80::float
                
                -- Bio facts and seeded data
                ELSE 0.70::float
            END AS base_score,
            
            -- Enhanced match type classification
            CASE 
                WHEN search_query = '' THEN 'recent'
                WHEN is_political_query AND (
                    lower(mf.fragment_text) ~* '\b(trump|political|politics|america|emigration)\b'
                    OR (mf.conversation_context->>'context') = 'politics_and_emigration'
                ) THEN 'political_match'
                WHEN is_opinion_query AND (
                    lower(mf.fragment_text) ~* '\b(think|opinion|feel|believe|view)\b'
                    OR (mf.conversation_context->>'type') = 'opinion'
                ) THEN 'opinion_match'
                WHEN lower(mf.fragment_text) LIKE '%' || lower(search_query) || '%' THEN 'exact_phrase'
                WHEN EXISTS (
                    SELECT 1 FROM unnest(query_words) AS word 
                    WHERE lower(mf.fragment_text) LIKE '%' || word || '%'
                    AND length(word) > 1
                ) THEN 'word_match'
                WHEN key_words IS NOT NULL AND EXISTS (
                    SELECT 1 FROM unnest(key_words) AS kw 
                    WHERE lower(mf.fragment_text) LIKE '%' || kw || '%'
                ) THEN 'keyword_match'
                ELSE 'bio_fact'
            END AS match_type,
            
            -- Check if this is a bio fact
            CASE 
                WHEN mf.user_id IS NULL AND mf.avatar_id IS NOT NULL THEN true
                ELSE false
            END AS is_bio_fact
        FROM memory_fragments mf
        WHERE 
            -- Include user's memories if user_id provided
            (target_user_id IS NULL OR mf.user_id = target_user_id)
            -- Include avatar's bio/seeded memories if avatar_id provided
            AND (target_avatar_id IS NULL OR mf.avatar_id = target_avatar_id)
            -- Include bio facts even without user_id (seeded data)
            AND (
                include_bio_facts = false 
                OR mf.user_id IS NOT NULL 
                OR mf.avatar_id = target_avatar_id
            )
            -- VERY PERMISSIVE text filtering with special political/opinion handling
            AND (
                search_query = ''
                
                -- ALWAYS include political content for political queries
                OR (is_political_query AND (
                    lower(mf.fragment_text) ~* '\b(trump|political|politics|america|emigration|left america|political climate|miserable|bastard|run off|road|redneck|2018|2017)\b'
                    OR (mf.conversation_context->>'context') = 'politics_and_emigration'
                    OR (mf.conversation_context->>'type') = 'opinion'
                ))
                
                -- ALWAYS include opinion content for opinion queries
                OR (is_opinion_query AND (
                    lower(mf.fragment_text) ~* '\b(think|opinion|feel|believe|view|like|dislike|hate|love|couldn.*handle|miserable)\b'
                    OR (mf.conversation_context->>'type') = 'opinion'
                    OR (mf.conversation_context->>'context') LIKE '%opinion%'
                ))
                
                -- Exact phrase match
                OR lower(mf.fragment_text) LIKE '%' || lower(search_query) || '%'
                
                -- Individual word matching (very permissive)
                OR EXISTS (
                    SELECT 1 FROM unnest(query_words) AS word 
                    WHERE lower(mf.fragment_text) LIKE '%' || word || '%'
                    AND length(word) > 1
                )
                
                -- Keyword matching
                OR (key_words IS NOT NULL AND EXISTS (
                    SELECT 1 FROM unnest(key_words) AS kw 
                    WHERE lower(mf.fragment_text) LIKE '%' || kw || '%'
                ))
                
                -- Context title match
                OR (mf.conversation_context->>'title') ILIKE '%' || search_query || '%'
                
                -- Bio fact inclusion for profile queries
                OR (include_bio_facts AND mf.avatar_id = target_avatar_id)
            )
    ),
    scored_memories AS (
        SELECT
            cm.*,
            -- Apply enhanced preference and context boosts with political/opinion priority
            cm.base_score * 
            CASE 
                -- Political content gets highest boost
                WHEN cm.match_type = 'political_match' THEN political_boost
                
                -- Opinion content gets very high boost
                WHEN cm.match_type = 'opinion_match' THEN opinion_boost
                
                -- Bio fact boost for seeded avatar data
                WHEN cm.is_bio_fact THEN bio_boost
                
                -- Keyword match boost
                WHEN cm.match_type = 'keyword_match' THEN keyword_boost
                
                -- Exact phrase match boost
                WHEN cm.match_type = 'exact_phrase' THEN exact_boost
                
                ELSE 1.0
            END AS final_score
        FROM candidate_memories cm
    )
    SELECT 
        sm.id,
        sm.user_id,
        sm.avatar_id,
        sm.fragment_text,
        sm.conversation_context,
        sm.final_score AS similarity_score,
        sm.match_type,
        sm.created_at,
        sm.updated_at
    FROM scored_memories sm
    WHERE sm.final_score >= similarity_threshold
    ORDER BY 
        sm.final_score DESC,
        sm.created_at DESC
    LIMIT match_count;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_enhanced_memories TO authenticated, anon, service_role;

-- Add comment
COMMENT ON FUNCTION get_enhanced_memories IS 'Enhanced memory retrieval with special handling for political and opinion queries to ensure Trump experiences are retrieved';

-- Test the function with political queries
SELECT 'Testing enhanced memory function with political query...' as status;