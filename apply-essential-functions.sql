-- Apply essential database functions for enhanced memory retrieval
-- Run this in Supabase SQL Editor

-- 1. Fix RLS Policy for Fact Promotion Queue
DROP POLICY IF EXISTS "Service role can manage fact_promotion_queue" ON public.fact_promotion_queue;
CREATE POLICY "Service role can manage fact_promotion_queue" ON public.fact_promotion_queue
    FOR ALL USING (
        auth.role() = 'service_role' OR 
        auth.role() = 'authenticated'
    );

-- 2. Create Enhanced Memory Retrieval Function
CREATE OR REPLACE FUNCTION get_enhanced_memories(
    target_user_id uuid DEFAULT NULL,
    target_avatar_id uuid DEFAULT NULL,
    search_query text DEFAULT '',
    match_count integer DEFAULT 64,
    similarity_threshold float DEFAULT 0.6,
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
    preference_boost float := 1.5;
    pet_boost float := 1.3;
    exact_boost float := 2.0;
BEGIN
    -- Parse query for special boosts
    query_words := string_to_array(lower(search_query), ' ');
    
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
                WHEN lower(mf.fragment_text) LIKE '%' || lower(search_query) || '%' THEN 0.9::float
                ELSE 0.7::float
            END AS base_score,
            -- Match type for debugging
            CASE 
                WHEN search_query = '' THEN 'recent'
                WHEN lower(mf.fragment_text) LIKE '%' || lower(search_query) || '%' THEN 'text_match'
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
            -- Text filtering
            AND (
                search_query = ''
                OR lower(mf.fragment_text) LIKE '%' || lower(search_query) || '%'
                OR lower(mf.fragment_text) ~ lower(search_query)
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
                    WHERE word IN ('dog', 'dogs', 'pet', 'pets', 'cat', 'cats', 'poodle', 'animal')
                ) AND (
                    lower(cm.fragment_text) ~ '(dog|pet|cat|poodle|animal|puppy|kitten)'
                ) THEN pet_boost
                
                -- Exact match boost
                WHEN lower(cm.fragment_text) LIKE '%' || lower(search_query) || '%' 
                    AND length(search_query) > 3 THEN exact_boost
                
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

-- 3. Grant permissions
GRANT EXECUTE ON FUNCTION get_enhanced_memories TO authenticated, anon, service_role;

-- 4. Add comment
COMMENT ON FUNCTION get_enhanced_memories IS 'Enhanced memory retrieval with hybrid search, preference boosts, and avatar scope for EchoStone fixes';