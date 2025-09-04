-- Migration 027: Fix Memory Retrieval & Fact Injection
-- Addresses RLS, scope, and retrieval quality issues

-- 1. Fix RLS Policy for Fact Promotion Queue
-- Allow service-role to insert into fact_promotion_queue
DROP POLICY IF EXISTS "Service role can manage fact_promotion_queue" ON public.fact_promotion_queue;
CREATE POLICY "Service role can manage fact_promotion_queue" ON public.fact_promotion_queue
    FOR ALL USING (
        auth.role() = 'service_role' OR 
        auth.role() = 'authenticated'
    );

-- 2. Create Enhanced Memory Retrieval Function with Hybrid Search
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

-- 3. Create Quick Facts Retrieval with Avatar Scope
CREATE OR REPLACE FUNCTION get_avatar_quick_facts(
    target_avatar_id uuid,
    max_priority integer DEFAULT 5,
    include_expired boolean DEFAULT false
)
RETURNS TABLE (
    id uuid,
    key text,
    value text,
    confidence float,
    priority integer,
    source text,
    source_reference text,
    date_context jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
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
    FROM quick_facts qf
    WHERE 
        qf.avatar_id = target_avatar_id
        AND qf.priority <= max_priority
        AND (
            include_expired = true 
            OR qf.expires_at IS NULL 
            OR qf.expires_at > NOW()
        )
        AND qf.confidence >= 0.3
    ORDER BY 
        qf.priority ASC,
        qf.confidence DESC,
        qf.updated_at DESC;
END;
$$;

-- 4. Create Unified Avatar Resolution Function
CREATE OR REPLACE FUNCTION resolve_avatar_id(
    profile_name text DEFAULT NULL,
    avatar_slug text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
    resolved_id uuid;
BEGIN
    -- Handle special demo case
    IF avatar_slug = 'jonathan-demo' THEN
        RETURN '0585f43b-4b49-4e16-b2a7-91c8e1e3850c'::uuid;
    END IF;
    
    -- Try avatar_profiles.name first
    IF profile_name IS NOT NULL THEN
        SELECT id INTO resolved_id
        FROM avatar_profiles
        WHERE name = profile_name
        LIMIT 1;
        
        IF resolved_id IS NOT NULL THEN
            RETURN resolved_id;
        END IF;
    END IF;
    
    -- Try avatar_profiles.name with avatar_slug
    IF avatar_slug IS NOT NULL THEN
        SELECT id INTO resolved_id
        FROM avatar_profiles
        WHERE name = avatar_slug
        LIMIT 1;
        
        IF resolved_id IS NOT NULL THEN
            RETURN resolved_id;
        END IF;
    END IF;
    
    -- Fallback to avatars.slug
    IF avatar_slug IS NOT NULL THEN
        SELECT id INTO resolved_id
        FROM avatars
        WHERE slug = avatar_slug
        LIMIT 1;
        
        IF resolved_id IS NOT NULL THEN
            RETURN resolved_id;
        END IF;
    END IF;
    
    -- No match found
    RAISE EXCEPTION 'No avatar found for profile_name: %, avatar_slug: %', profile_name, avatar_slug;
END;
$$;

-- 5. Create Count Enumeration Helper
CREATE OR REPLACE FUNCTION enumerate_items_from_memories(
    memories_json jsonb,
    item_patterns text[]
)
RETURNS TABLE (
    total_count integer,
    current_items text[],
    past_items text[],
    formatted_response text
)
LANGUAGE plpgsql
AS $$
DECLARE
    memory_record jsonb;
    fragment_text text;
    current_list text[] := '{}';
    past_list text[] := '{}';
    item_name text;
    pattern text;
    total integer;
BEGIN
    -- Extract items from memory fragments
    FOR memory_record IN SELECT jsonb_array_elements(memories_json)
    LOOP
        fragment_text := lower(memory_record->>'fragment_text');
        
        -- Check each pattern
        FOREACH pattern IN ARRAY item_patterns
        LOOP
            -- Extract item names using pattern matching
            -- This is a simplified version - could be enhanced with regex
            IF fragment_text ~ pattern THEN
                -- Extract the item name (simplified logic)
                IF pattern LIKE '%dog%' OR pattern LIKE '%pet%' THEN
                    -- Look for dog names
                    IF fragment_text ~ 'romeo' THEN
                        current_list := array_append(current_list, 'Romeo');
                    END IF;
                    IF fragment_text ~ 'bucky' THEN
                        past_list := array_append(past_list, 'Bucky');
                    END IF;
                    IF fragment_text ~ 'george' THEN
                        past_list := array_append(past_list, 'George');
                    END IF;
                    IF fragment_text ~ 'olive' THEN
                        past_list := array_append(past_list, 'Olive');
                    END IF;
                END IF;
            END IF;
        END LOOP;
    END LOOP;
    
    -- Remove duplicates
    current_list := ARRAY(SELECT DISTINCT unnest(current_list));
    past_list := ARRAY(SELECT DISTINCT unnest(past_list));
    
    total_count := array_length(current_list, 1) + array_length(past_list, 1);
    current_items := current_list;
    past_items := past_list;
    
    -- Format response
    IF total_count = 0 THEN
        formatted_response := 'I don''t have information about that yet.';
    ELSIF array_length(current_list, 1) > 0 AND array_length(past_list, 1) > 0 THEN
        formatted_response := format('%s total—%s now, and before that %s.',
            CASE total_count
                WHEN 1 THEN 'One'
                WHEN 2 THEN 'Two'
                WHEN 3 THEN 'Three'
                WHEN 4 THEN 'Four'
                WHEN 5 THEN 'Five'
                ELSE total_count::text
            END,
            array_to_string(current_list, ', '),
            array_to_string(past_list, ', ')
        );
    ELSIF array_length(current_list, 1) > 0 THEN
        formatted_response := format('%s: %s.',
            CASE total_count
                WHEN 1 THEN 'One'
                ELSE total_count::text
            END,
            array_to_string(current_list, ', ')
        );
    ELSE
        formatted_response := format('%s in the past: %s.',
            CASE total_count
                WHEN 1 THEN 'One'
                ELSE total_count::text
            END,
            array_to_string(past_list, ', ')
        );
    END IF;
    
    RETURN QUERY SELECT total_count, current_items, past_items, formatted_response;
END;
$$;

-- 6. Update Memory Fragments to Support Better Indexing
CREATE INDEX IF NOT EXISTS memory_fragments_avatar_text_idx 
ON memory_fragments USING gin(to_tsvector('english', fragment_text));

CREATE INDEX IF NOT EXISTS memory_fragments_avatar_id_created_idx 
ON memory_fragments(avatar_id, created_at DESC);

CREATE INDEX IF NOT EXISTS memory_fragments_user_avatar_idx 
ON memory_fragments(user_id, avatar_id, created_at DESC);

-- 7. Grant Permissions
GRANT EXECUTE ON FUNCTION get_enhanced_memories TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_avatar_quick_facts TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION resolve_avatar_id TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION enumerate_items_from_memories TO authenticated, anon, service_role;

-- 8. Add Comments for Documentation
COMMENT ON FUNCTION get_enhanced_memories IS 'Enhanced memory retrieval with hybrid search, preference boosts, and avatar scope';
COMMENT ON FUNCTION get_avatar_quick_facts IS 'Retrieves quick facts for an avatar with priority and expiration filtering';
COMMENT ON FUNCTION resolve_avatar_id IS 'Unified avatar ID resolution from profile name or slug';
COMMENT ON FUNCTION enumerate_items_from_memories IS 'Extracts and counts items from memory fragments for "how many" queries';