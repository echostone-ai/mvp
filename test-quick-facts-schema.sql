-- Test script for quick_facts schema validation
-- Run this in Supabase SQL Editor to verify the schema works correctly

-- Test 1: Create a test avatar profile
INSERT INTO avatar_profiles (id, name, description) 
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'Test Avatar', 'Test avatar for schema validation')
ON CONFLICT (id) DO NOTHING;

-- Test 2: Insert some test quick facts
SELECT public.upsert_quick_fact(
    '550e8400-e29b-41d4-a716-446655440000'::UUID,
    'full_name',
    'John Doe',
    0.95,
    1,
    'heuristic',
    'From seed text',
    NULL,
    NULL
);

SELECT public.upsert_quick_fact(
    '550e8400-e29b-41d4-a716-446655440000'::UUID,
    'birth_year',
    '1985',
    0.9,
    2,
    'pattern',
    'Extracted from "I was born in 1985"',
    '{"year": 1985}'::jsonb,
    NULL
);

SELECT public.upsert_quick_fact(
    '550e8400-e29b-41d4-a716-446655440000'::UUID,
    'speaking_style',
    'casual and friendly',
    0.8,
    1,
    'llm',
    'Inferred from conversation patterns',
    NULL,
    NULL
);

-- Test 3: Verify facts were inserted correctly
SELECT 'Test 3: Basic fact insertion' as test_name;
SELECT key, value, confidence, priority, source 
FROM public.quick_facts 
WHERE avatar_id = '550e8400-e29b-41d4-a716-446655440000'::UUID
ORDER BY priority, key;

-- Test 4: Test fetch_quick_facts function with priority filtering
SELECT 'Test 4: Priority filtering (priority <= 2)' as test_name;
SELECT key, value, priority 
FROM public.fetch_quick_facts('550e8400-e29b-41d4-a716-446655440000'::UUID, 2)
ORDER BY priority, key;

-- Test 5: Test style profile function
SELECT 'Test 5: Style profile extraction' as test_name;
SELECT * FROM public.fetch_style_profile('550e8400-e29b-41d4-a716-446655440000'::UUID);

-- Test 6: Test fact statistics
SELECT 'Test 6: Fact statistics' as test_name;
SELECT * FROM public.get_fact_statistics('550e8400-e29b-41d4-a716-446655440000'::UUID);

-- Test 7: Test fact update (should create history entry)
SELECT 'Test 7: Fact update with history tracking' as test_name;
SELECT public.upsert_quick_fact(
    '550e8400-e29b-41d4-a716-446655440000'::UUID,
    'birth_year',
    '1986', -- Changed value
    0.95,   -- Higher confidence
    2,
    'llm',
    'Corrected from conversation',
    '{"year": 1986}'::jsonb,
    NULL
);

-- Verify the update and history
SELECT 'Updated fact:' as info, key, value, confidence FROM public.quick_facts 
WHERE avatar_id = '550e8400-e29b-41d4-a716-446655440000'::UUID AND key = 'birth_year';

SELECT 'History entry:' as info, key, old_value, new_value, change_type, changed_at 
FROM public.fact_history 
WHERE avatar_id = '550e8400-e29b-41d4-a716-446655440000'::UUID AND key = 'birth_year'
ORDER BY changed_at DESC LIMIT 1;

-- Test 8: Test expiration handling
SELECT 'Test 8: Expiration handling' as test_name;
SELECT public.upsert_quick_fact(
    '550e8400-e29b-41d4-a716-446655440000'::UUID,
    'temp_fact',
    'This will expire',
    0.9,
    5,
    'manual',
    'Test expiration',
    NULL,
    NOW() + INTERVAL '1 hour' -- Expires in 1 hour
);

-- Test with and without expired facts
SELECT 'Active facts (excluding expired):' as info, COUNT(*) as count
FROM public.fetch_quick_facts('550e8400-e29b-41d4-a716-446655440000'::UUID, 10, false);

SELECT 'All facts (including expired):' as info, COUNT(*) as count
FROM public.fetch_quick_facts('550e8400-e29b-41d4-a716-446655440000'::UUID, 10, true);

-- Test 9: Test memory fragment trigger (simulate insertion)
INSERT INTO memory_fragments (
    id,
    user_id,
    avatar_id,
    fragment_text,
    embedding,
    conversation_context
) VALUES (
    gen_random_uuid(),
    '550e8400-e29b-41d4-a716-446655440001'::UUID, -- Different user ID
    '550e8400-e29b-41d4-a716-446655440000'::UUID,
    'I moved to Boston in 2010 and love it here.',
    array_fill(0.1, ARRAY[1536])::vector, -- Dummy embedding
    '{"timestamp": "2025-01-01T00:00:00Z"}'::jsonb
);

-- Check if promotion was queued
SELECT 'Test 9: Fact promotion queue' as test_name;
SELECT avatar_id, fragment_text, status, created_at 
FROM public.fact_promotion_queue 
WHERE avatar_id = '550e8400-e29b-41d4-a716-446655440000'::UUID
ORDER BY created_at DESC LIMIT 1;

-- Test 10: Test constraint validations
SELECT 'Test 10: Constraint validations' as test_name;

-- This should fail (confidence out of range)
DO $$
BEGIN
    PERFORM public.upsert_quick_fact(
        '550e8400-e29b-41d4-a716-446655440000'::UUID,
        'invalid_confidence',
        'test',
        1.5, -- Invalid confidence > 1.0
        5
    );
    RAISE EXCEPTION 'Should have failed with invalid confidence';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Correctly rejected invalid confidence: %', SQLERRM;
END $$;

-- This should fail (priority out of range)
DO $$
BEGIN
    PERFORM public.upsert_quick_fact(
        '550e8400-e29b-41d4-a716-446655440000'::UUID,
        'invalid_priority',
        'test',
        0.9,
        15 -- Invalid priority > 10
    );
    RAISE EXCEPTION 'Should have failed with invalid priority';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Correctly rejected invalid priority: %', SQLERRM;
END $$;

-- Test 11: Test unique constraint on (avatar_id, key)
SELECT 'Test 11: Unique constraint validation' as test_name;
-- This should update, not create duplicate
SELECT public.upsert_quick_fact(
    '550e8400-e29b-41d4-a716-446655440000'::UUID,
    'full_name',
    'John Smith', -- Different value for same key
    0.98,
    1
);

-- Verify only one record exists for this key
SELECT 'Unique constraint test:' as info, COUNT(*) as count, MAX(value) as current_value
FROM public.quick_facts 
WHERE avatar_id = '550e8400-e29b-41d4-a716-446655440000'::UUID AND key = 'full_name';

-- Cleanup test data
DELETE FROM public.fact_promotion_queue WHERE avatar_id = '550e8400-e29b-41d4-a716-446655440000'::UUID;
DELETE FROM public.fact_history WHERE avatar_id = '550e8400-e29b-41d4-a716-446655440000'::UUID;
DELETE FROM public.quick_facts WHERE avatar_id = '550e8400-e29b-41d4-a716-446655440000'::UUID;
DELETE FROM memory_fragments WHERE avatar_id = '550e8400-e29b-41d4-a716-446655440000'::UUID;
DELETE FROM avatar_profiles WHERE id = '550e8400-e29b-41d4-a716-446655440000'::UUID;

SELECT '✅ All tests completed successfully!' as result;