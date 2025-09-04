-- Migration: Create helper functions for quick_facts retrieval and management
-- These functions provide optimized access patterns for the fact extraction pipeline

-- Function to fetch quick facts with priority filtering and expiration handling
CREATE OR REPLACE FUNCTION public.fetch_quick_facts(
    in_avatar_id UUID,
    max_priority INTEGER DEFAULT 10,
    include_expired BOOLEAN DEFAULT false
)
RETURNS TABLE (
    id UUID,
    key TEXT,
    value TEXT,
    confidence FLOAT,
    priority INTEGER,
    source TEXT,
    source_reference TEXT,
    date_context JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT 
        qf.id,
        qf.key,
        qf.value,
        qf.confidence,
        qf.priority,
        qf.source,
        qf.source_reference,
        qf.date_context,
        qf.created_at,
        qf.updated_at
    FROM public.quick_facts qf
    WHERE qf.avatar_id = in_avatar_id
    AND qf.priority <= max_priority
    AND (include_expired OR qf.expires_at IS NULL OR qf.expires_at > NOW())
    ORDER BY qf.priority ASC, qf.confidence DESC, qf.created_at ASC;
$$;

-- Function to fetch style profile facts (priority 1-2)
CREATE OR REPLACE FUNCTION public.fetch_style_profile(
    in_avatar_id UUID
)
RETURNS TABLE (
    speaking_style TEXT,
    humor_style TEXT,
    emotional_expression TEXT,
    signature_phrases TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT 
        MAX(CASE WHEN key = 'speaking_style' THEN value END) as speaking_style,
        MAX(CASE WHEN key = 'humor_style' THEN value END) as humor_style,
        MAX(CASE WHEN key = 'emotional_expression' THEN value END) as emotional_expression,
        MAX(CASE WHEN key = 'signature_phrases' THEN value END) as signature_phrases
    FROM public.quick_facts
    WHERE avatar_id = in_avatar_id
    AND priority <= 2
    AND (expires_at IS NULL OR expires_at > NOW());
$$;

-- Function to upsert (insert or update) a quick fact
CREATE OR REPLACE FUNCTION public.upsert_quick_fact(
    in_avatar_id UUID,
    in_key TEXT,
    in_value TEXT,
    in_confidence FLOAT DEFAULT 1.0,
    in_priority INTEGER DEFAULT 5,
    in_source TEXT DEFAULT 'extraction',
    in_source_reference TEXT DEFAULT NULL,
    in_date_context JSONB DEFAULT NULL,
    in_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    fact_id UUID;
BEGIN
    -- Validate inputs
    IF in_confidence < 0.0 OR in_confidence > 1.0 THEN
        RAISE EXCEPTION 'Confidence must be between 0.0 and 1.0';
    END IF;
    
    IF in_priority < 1 OR in_priority > 10 THEN
        RAISE EXCEPTION 'Priority must be between 1 and 10';
    END IF;
    
    -- Insert or update the fact
    INSERT INTO public.quick_facts (
        avatar_id, key, value, confidence, priority, 
        source, source_reference, date_context, expires_at
    ) VALUES (
        in_avatar_id, in_key, in_value, in_confidence, in_priority,
        in_source, in_source_reference, in_date_context, in_expires_at
    )
    ON CONFLICT (avatar_id, key) DO UPDATE SET
        value = EXCLUDED.value,
        confidence = EXCLUDED.confidence,
        priority = EXCLUDED.priority,
        source = EXCLUDED.source,
        source_reference = EXCLUDED.source_reference,
        date_context = EXCLUDED.date_context,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW()
    RETURNING id INTO fact_id;
    
    RETURN fact_id;
END;
$$;

-- Function to get fact statistics for debugging
CREATE OR REPLACE FUNCTION public.get_fact_statistics(
    in_avatar_id UUID
)
RETURNS TABLE (
    total_facts INTEGER,
    core_identity_facts INTEGER,
    style_facts INTEGER,
    life_context_facts INTEGER,
    expired_facts INTEGER,
    avg_confidence FLOAT,
    last_updated TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT 
        COUNT(*)::INTEGER as total_facts,
        COUNT(CASE WHEN priority <= 2 THEN 1 END)::INTEGER as core_identity_facts,
        COUNT(CASE WHEN priority = 1 THEN 1 END)::INTEGER as style_facts,
        COUNT(CASE WHEN priority BETWEEN 3 AND 5 THEN 1 END)::INTEGER as life_context_facts,
        COUNT(CASE WHEN expires_at IS NOT NULL AND expires_at <= NOW() THEN 1 END)::INTEGER as expired_facts,
        ROUND(AVG(confidence)::numeric, 3)::FLOAT as avg_confidence,
        MAX(updated_at) as last_updated
    FROM public.quick_facts
    WHERE avatar_id = in_avatar_id;
$$;

-- Grant execute permissions to authenticated users for read functions
GRANT EXECUTE ON FUNCTION public.fetch_quick_facts(UUID, INTEGER, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_style_profile(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_fact_statistics(UUID) TO authenticated;

-- Grant execute permissions to service role for write functions
GRANT EXECUTE ON FUNCTION public.upsert_quick_fact(UUID, TEXT, TEXT, FLOAT, INTEGER, TEXT, TEXT, JSONB, TIMESTAMPTZ) TO service_role;

-- Add helpful comments for documentation
COMMENT ON FUNCTION public.fetch_quick_facts(UUID, INTEGER, BOOLEAN) IS 'Fetches quick facts with priority filtering and expiration handling';
COMMENT ON FUNCTION public.fetch_style_profile(UUID) IS 'Fetches speaking style and personality facts for prompt building';
COMMENT ON FUNCTION public.upsert_quick_fact(UUID, TEXT, TEXT, FLOAT, INTEGER, TEXT, TEXT, JSONB, TIMESTAMPTZ) IS 'Inserts or updates a quick fact with validation';
COMMENT ON FUNCTION public.get_fact_statistics(UUID) IS 'Returns statistics about an avatar\'s facts for debugging';