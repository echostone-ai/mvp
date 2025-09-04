-- Migration 028: Unified Avatar Context RPC
-- Single RPC to fetch all avatar context (facts, memories, style) in one call

-- Create unified avatar context function
CREATE OR REPLACE FUNCTION get_avatar_context(
    avatar_id uuid,
    query_text text DEFAULT '',
    memory_limit integer DEFAULT 64,
    similarity_threshold float DEFAULT 0.6,
    priority_filter integer DEFAULT 6
)
RETURNS TABLE (
    facts jsonb,
    memories jsonb,
    style jsonb
) 
LANGUAGE plpgsql
AS $$
DECLARE
    facts_result jsonb;
    memories_result jsonb;
    style_result jsonb;
BEGIN
    -- Fetch quick facts
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', qf.id,
            'key', qf.key,
            'value', qf.value,
            'confidence', qf.confidence,
            'priority', qf.priority,
            'source', qf.source,
            'source_reference', qf.source_reference,
            'date_context', qf.date_context,
            'created_at', qf.created_at,
            'updated_at', qf.updated_at
        )
    ) INTO facts_result
    FROM quick_facts qf
    WHERE 
        qf.avatar_id = get_avatar_context.avatar_id
        AND qf.priority <= priority_filter
        AND (qf.expires_at IS NULL OR qf.expires_at > NOW())
        AND qf.confidence >= 0.3
    ORDER BY 
        qf.priority ASC,
        qf.confidence DESC,
        qf.updated_at DESC
    LIMIT 25;

    -- Fetch memories using enhanced search
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', em.id,
            'user_id', em.user_id,
            'avatar_id', em.avatar_id,
            'fragment_text', em.fragment_text,
            'conversation_context', em.conversation_context,
            'similarity_score', em.similarity_score,
            'match_type', em.match_type,
            'created_at', em.created_at,
            'updated_at', em.updated_at
        )
    ) INTO memories_result
    FROM get_enhanced_memories(
        NULL, -- target_user_id
        get_avatar_context.avatar_id,
        query_text,
        memory_limit,
        similarity_threshold,
        true -- include_bio_facts
    ) em;

    -- Fetch style profile from quick facts
    SELECT jsonb_build_object(
        'speaking_style', MAX(CASE WHEN qf.key = 'speaking_style' THEN qf.value END),
        'humor_style', MAX(CASE WHEN qf.key = 'humor_style' THEN qf.value END),
        'emotional_expression', MAX(CASE WHEN qf.key = 'emotional_expression' THEN qf.value END),
        'signature_phrases', MAX(CASE WHEN qf.key = 'signature_phrases' THEN qf.value END),
        'address_male_friend', MAX(CASE WHEN qf.key = 'address_male_friend' THEN qf.value END)
    ) INTO style_result
    FROM quick_facts qf
    WHERE 
        qf.avatar_id = get_avatar_context.avatar_id
        AND qf.key IN ('speaking_style', 'humor_style', 'emotional_expression', 'signature_phrases', 'address_male_friend')
        AND (qf.expires_at IS NULL OR qf.expires_at > NOW());

    -- Return all results
    RETURN QUERY SELECT 
        COALESCE(facts_result, '[]'::jsonb) as facts,
        COALESCE(memories_result, '[]'::jsonb) as memories,
        COALESCE(style_result, '{}'::jsonb) as style;
END;
$$;

-- Create optimized indexes for the unified query
CREATE INDEX IF NOT EXISTS idx_quick_facts_avatar_priority 
ON quick_facts(avatar_id, priority, confidence DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_quick_facts_style_keys 
ON quick_facts(avatar_id, key) 
WHERE key IN ('speaking_style', 'humor_style', 'emotional_expression', 'signature_phrases', 'address_male_friend');

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_avatar_context TO authenticated, anon, service_role;

-- Add comment for documentation
COMMENT ON FUNCTION get_avatar_context IS 'Unified avatar context retrieval - fetches facts, memories, and style in a single RPC call';