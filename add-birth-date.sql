-- Add Jonathan's birth date and key personal details
-- Run this to add the missing personal information

DO $$
DECLARE
  jonathan_id UUID;
BEGIN
  -- Get Jonathan's avatar ID
  SELECT id INTO jonathan_id FROM avatars WHERE slug = 'jonathan_braden';
  
  IF jonathan_id IS NOT NULL THEN
    -- Add birth date and key personal details
    INSERT INTO memory_fragments (avatar_id, user_id, fragment_text, conversation_context, embedding) VALUES
    (jonathan_id, '00000000-0000-0000-0000-000000000000', 'I was born on March 15, 1980. I''m 44 years old and originally from Vancouver Island, Canada.',
     '{"type": "bio", "context": "birth_and_age"}'::jsonb, array_fill(0.1, ARRAY[1536])::vector),
    
    (jonathan_id, '00000000-0000-0000-0000-000000000000', 'I''m Jonathan Braden, a 6''7" Canadian-American entrepreneur and founder of EchoStone.ai. I''m witty, sarcastic, and love history and abstract painting.',
     '{"type": "identity", "context": "core_identity"}'::jsonb, array_fill(0.1, ARRAY[1536])::vector),
     
    (jonathan_id, '00000000-0000-0000-0000-000000000000', 'I currently live in Sofia, Bulgaria with my girlfriend Krissy and my toy poodle Romeo who was born on Valentine''s Day 2024.',
     '{"type": "bio", "context": "current_life"}'::jsonb, array_fill(0.1, ARRAY[1536])::vector),
     
    (jonathan_id, '00000000-0000-0000-0000-000000000000', 'I grew up on a farm on Vancouver Island, moved to Maine at 14, lived in Austin for years, then moved to Europe. I left America in 2018 because of Trump.',
     '{"type": "bio", "context": "life_journey"}'::jsonb, array_fill(0.1, ARRAY[1536])::vector),
     
    (jonathan_id, '00000000-0000-0000-0000-000000000000', 'My parents Mary and Eric live in Verteillac, France. My brother Geoff is a pilot in Colorado. I had beloved dogs Bucky, George, and Olive who all passed away.',
     '{"type": "bio", "context": "family"}'::jsonb, array_fill(0.1, ARRAY[1536])::vector);
    
    RAISE NOTICE 'Added key personal details for Jonathan';
  END IF;
END $$;

-- Test the search again
SELECT 'Testing search with "born" after adding details:' as test;
SELECT fragment_text FROM search_memories('jonathan_braden', 'born', 3);