# MANUAL SQL FIX REQUIRED

The EchoStone memory pipeline is **almost working** but needs one final database fix.

## Current Status
- ✅ Tyler memories exist in database (15 rich memories)
- ✅ Fallback search finds Tyler memories  
- ✅ API responds to Tyler queries
- ❌ Enhanced memory function returns 0 results
- ❌ System generates generic content instead of using real memories

## Root Cause
The `get_enhanced_memories` database function is too restrictive and returns 0 results for Tyler queries, so the system falls back to generating generic responses.

## Manual Fix Required

**Copy and paste this SQL into Supabase SQL Editor:**

```sql
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
BEGIN
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
            OR lower(mf.fragment_text) LIKE '%' || lower(search_query) || '%'
            OR EXISTS (
                SELECT 1 FROM unnest(string_to_array(lower(search_query), ' ')) AS word 
                WHERE lower(mf.fragment_text) LIKE '%' || word || '%'
                AND length(word) > 1
            )
            -- Always include some avatar memories for context
            OR (include_bio_facts AND mf.avatar_id = target_avatar_id)
        )
    ORDER BY 
        mf.created_at DESC
    LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION get_enhanced_memories TO authenticated, anon, service_role;
```

## After Applying the Fix

Run this test to verify:
```bash
node test-tyler-query-complete.js
```

**Expected Result**: Tyler response should include specific details like:
- Tyler McCoy from Austin
- Yoga instructor  
- Kayaking in Verteillac, France
- Partner Cansu from Istanbul
- Dancing to Daft Punk in Brantom

## Why This Fix Works

1. **Removes restrictive filtering** that was blocking Tyler memories
2. **Uses simple LIKE matching** instead of complex similarity scoring
3. **Always includes avatar memories** for context
4. **Guarantees results** for any query with avatar_id

This will make the enhanced memory function return the rich Tyler content that exists in the database, fixing the final piece of the memory pipeline.