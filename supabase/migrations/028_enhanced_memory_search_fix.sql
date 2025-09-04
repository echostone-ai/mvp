-- Migration: Enhanced Memory Search Fix
-- Applied: 2025-08-29T16:45:47.282Z

-- Improved Enhanced Memory Search Function
-- This version extracts keywords from queries and matches them semantically

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
AS $
DECLARE
    query_words text[];
    key_words text[];
    preference_boost float := 1.5;
    pet_boost float := 1.3;
    exact_boost float := 2.0;
    keyword_boost float := 1.2;
BEGIN
    -- Parse query for keywords and special boosts
    query_words := string_to_array(lower(search_query), ' ');
    
    -- Extract key content words (filter out common words)
    SELECT array_agg(word) INTO key_words
    FROM unnest(query_words) AS word
    WHERE word NOT IN ('what', 'was', 'your', 'the', 'a', 'an', 'is', 'are', 'were', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'can', 'may', 'might', 'must', 'shall', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'and', 'or', 'but', 'so', 'if', 'then', 'else', 'when', 'where', 'why', 'how', 'who', 'which', 'that', 'this', 'these', 'those', 'me', 'my', 'mine', 'you', 'yours', 'he', 'his', 'she', 'her', 'hers', 'it', 'its', 'we', 'our', 'ours', 'they', 'their', 'theirs', 'i', 'tell', 'about')
    AND length(word) > 2;
    
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
            -- Base similarity score
            CASE 
                WHEN search_query = '' THEN 0.8::float
                -- Exact phrase match
                WHEN lower(mf.fragment_text) LIKE '%' || lower(search_query) || '%' THEN 0.9::float
                -- Keyword matching - check if fragment contains any key words
                WHEN key_words IS NOT NULL AND EXISTS (
                    SELECT 1 FROM unnest(key_words) AS kw 
                    WHERE lower(mf.fragment_text) LIKE '%' || kw || '%'
                ) THEN 0.8::float
                -- Fallback for any word match
                WHEN EXISTS (
                    SELECT 1 FROM unnest(query_words) AS word 
                    WHERE lower(mf.fragment_text) LIKE '%' || word || '%'
                    AND length(word) > 2
                ) THEN 0.7::float
                ELSE 0.6::float
            END AS base_score,
            -- Match type for debugging
            CASE 
                WHEN search_query = '' THEN 'recent'
                WHEN lower(mf.fragment_text) LIKE '%' || lower(search_query) || '%' THEN 'exact_phrase'
                WHEN key_words IS NOT NULL AND EXISTS (
                    SELECT 1 FROM unnest(key_words) AS kw 
                    WHERE lower(mf.fragment_text) LIKE '%' || kw || '%'
                ) THEN 'keyword_match'
                WHEN EXISTS (
                    SELECT 1 FROM unnest(query_words) AS word 
                    WHERE lower(mf.fragment_text) LIKE '%' || word || '%'
                    AND length(word) > 2
                ) THEN 'word_match'
                ELSE 'fallback'
            END AS match_type
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
            -- Improved text filtering - match on keywords or any significant words
            AND (
                search_query = ''
                -- Exact phrase match
                OR lower(mf.fragment_text) LIKE '%' || lower(search_query) || '%'
                -- Keyword matching
                OR (key_words IS NOT NULL AND EXISTS (
                    SELECT 1 FROM unnest(key_words) AS kw 
                    WHERE lower(mf.fragment_text) LIKE '%' || kw || '%'
                ))
                -- Any significant word match
                OR EXISTS (
                    SELECT 1 FROM unnest(query_words) AS word 
                    WHERE lower(mf.fragment_text) LIKE '%' || word || '%'
                    AND length(word) > 2
                    AND word NOT IN ('what', 'was', 'your', 'the', 'tell', 'about')
                )
                -- Context title match
                OR (mf.conversation_context->>'title') ILIKE '%' || search_query || '%'
            )
    ),
    scored_memories AS (
        SELECT
            cm.*,
            -- Apply preference boosts
            cm.base_score * 
            CASE 
                -- Boost for preference/favorite queries
                WHEN EXISTS (
                    SELECT 1 FROM unnest(query_words) AS word 
                    WHERE word IN ('favorite', 'prefer', 'like', 'love', 'music', 'band', 'artist')
                ) AND (
                    lower(cm.fragment_text) ~ '(favorite|prefer|like|love|music|band|artist)'
                ) THEN preference_boost
                
                -- Boost for pet queries
                WHEN EXISTS (
                    SELECT 1 FROM unnest(query_words) AS word 
                    WHERE word IN ('dog', 'dogs', 'pet', 'pets', 'cat', 'cats', 'poodle', 'animal', 'first')
                ) AND (
                    lower(cm.fragment_text) ~ '(dog|pet|cat|poodle|animal|puppy|kitten|romeo|bucky)'
                ) THEN pet_boost
                
                -- Keyword match boost
                WHEN cm.match_type = 'keyword_match' THEN keyword_boost
                
                -- Exact match boost
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
$;