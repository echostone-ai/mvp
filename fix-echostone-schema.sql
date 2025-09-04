-- Fix EchoStone schema to match the actual architecture
-- Run this in your Supabase SQL Editor

-- 1. Create the proper avatars table with slug
CREATE TABLE IF NOT EXISTS avatars (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create chat_contexts (hot data)
CREATE TABLE IF NOT EXISTS chat_contexts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  avatar_id UUID NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
  context_text TEXT NOT NULL, -- Short bio + rules (~300-600 chars)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create quick_facts (hot data)
CREATE TABLE IF NOT EXISTS quick_facts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  avatar_id UUID NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(avatar_id, key)
);

-- 4. Create personality_profiles (warm data)
CREATE TABLE IF NOT EXISTS personality_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  avatar_id UUID NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
  trait TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create voice_assets (cold data)
CREATE TABLE IF NOT EXISTS voice_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  avatar_id UUID NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  voice_id TEXT NOT NULL,
  default_speed DECIMAL DEFAULT 1.0,
  sample_rate INTEGER DEFAULT 22050,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Update memory_fragments to reference avatars table properly
-- First drop the old constraint if it exists
ALTER TABLE memory_fragments DROP CONSTRAINT IF EXISTS memory_fragments_avatar_id_fkey;

-- Add the correct foreign key constraint
ALTER TABLE memory_fragments 
ADD CONSTRAINT memory_fragments_avatar_id_fkey 
FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE CASCADE;

-- 7. Create the proper search_memories function
CREATE OR REPLACE FUNCTION public.search_memories(
  p_slug TEXT,
  p_query TEXT,
  p_limit INT DEFAULT 8
) RETURNS TABLE(
  id UUID,
  avatar_id UUID,
  fragment_text TEXT,
  score DOUBLE PRECISION,
  conversation_context JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_avatar_id UUID;
BEGIN
  -- Resolve slug to avatar_id
  SELECT a.id INTO target_avatar_id 
  FROM avatars a 
  WHERE a.slug = p_slug;
  
  -- If no avatar found, return empty
  IF target_avatar_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Return memory fragments for this avatar
  -- Using text search since we don't have vector embeddings set up for the query
  RETURN QUERY
  SELECT 
    mf.id,
    mf.avatar_id,
    mf.fragment_text,
    -- Simple scoring based on text match
    CASE 
      WHEN mf.fragment_text ILIKE '%' || p_query || '%' THEN 0.9
      WHEN mf.conversation_context::text ILIKE '%' || p_query || '%' THEN 0.7
      ELSE 0.5
    END as score,
    mf.conversation_context
  FROM memory_fragments mf
  WHERE mf.avatar_id = target_avatar_id
    AND (
      mf.fragment_text ILIKE '%' || p_query || '%' 
      OR mf.conversation_context::text ILIKE '%' || p_query || '%'
      OR p_query = '' -- Return all memories for empty query
    )
  ORDER BY score DESC, mf.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION search_memories(TEXT, TEXT, INT) TO anon;
GRANT EXECUTE ON FUNCTION search_memories(TEXT, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION search_memories(TEXT, TEXT, INT) TO service_role;

-- 8. Create Jonathan Braden avatar with proper slug
INSERT INTO avatars (slug, display_name, status)
VALUES ('jonathan_braden', 'Jonathan Braden', 'active')
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  status = EXCLUDED.status,
  updated_at = NOW();

-- 9. Get the avatar ID and set up hot data
DO $$
DECLARE
  jonathan_id UUID;
BEGIN
  -- Get Jonathan's ID
  SELECT id INTO jonathan_id FROM avatars WHERE slug = 'jonathan_braden';
  
  -- Insert chat context (hot data)
  INSERT INTO chat_contexts (avatar_id, context_text)
  VALUES (
    jonathan_id,
    'Jonathan Braden: 6''7" Canadian-American entrepreneur, founder of EchoStone.ai. Lives in Sofia, Bulgaria. Witty, sarcastic, warm personality. Left America in 2018 due to politics. Loves history, abstract painting, and his poodle Romeo. Speaks multiple languages.'
  )
  ON CONFLICT DO NOTHING;
  
  -- Insert quick facts (hot data)
  INSERT INTO quick_facts (avatar_id, key, value) VALUES
  (jonathan_id, 'Height', '6''7" (very tall)'),
  (jonathan_id, 'Nationality', 'Canadian-American'),
  (jonathan_id, 'Current Location', 'Sofia, Bulgaria'),
  (jonathan_id, 'Company', 'EchoStone.ai (founder)'),
  (jonathan_id, 'Pet', 'Romeo (toy poodle, born Valentine''s Day 2024)'),
  (jonathan_id, 'Girlfriend', 'Krissy (looks like Mona Lisa, sounds like Mickey Mouse)'),
  (jonathan_id, 'Catchphrases', 'Wild!, That''s a trip, Man time flies'),
  (jonathan_id, 'Languages', 'English, French, Spanish, Bulgarian, Hungarian, Romanian'),
  (jonathan_id, 'Hobbies', 'Abstract painting with hands, guitar, stand-up comedy')
  ON CONFLICT (avatar_id, key) DO UPDATE SET value = EXCLUDED.value;
  
  -- Insert personality profiles (warm data)
  INSERT INTO personality_profiles (avatar_id, trait, detail) VALUES
  (jonathan_id, 'Humor Style', 'Sharp, quick, sarcastic but never mean. Self-deprecating. Says "Puns are my cardio"'),
  (jonathan_id, 'Communication', 'Warm, engaging, touch irreverent. Balances curiosity with humor'),
  (jonathan_id, 'Values', 'Inclusive, open to all backgrounds. Canadian politeness. Says sorry a lot'),
  (jonathan_id, 'Politics', 'Left America due to Trump. Hates Putin. Wants more women in leadership'),
  (jonathan_id, 'Expressions', 'Says "Wild!" when surprised, "well fuuuuuck!" when things get absurd')
  ON CONFLICT DO NOTHING;
  
  -- Insert voice assets
  INSERT INTO voice_assets (avatar_id, provider, voice_id, default_speed, sample_rate)
  VALUES (jonathan_id, 'elevenlabs', 'CO6pxVrMZfyL61ZIglyr', 1.0, 22050)
  ON CONFLICT DO NOTHING;
  
  -- Update existing memory fragments to use the correct avatar_id
  -- First, get the old avatar_id from avatar_profiles
  DECLARE old_avatar_id UUID;
  SELECT id INTO old_avatar_id FROM avatar_profiles WHERE name = 'jonathan_braden';
  
  IF old_avatar_id IS NOT NULL THEN
    UPDATE memory_fragments 
    SET avatar_id = jonathan_id 
    WHERE avatar_id = old_avatar_id;
    
    RAISE NOTICE 'Updated memory fragments from old avatar_id % to new avatar_id %', old_avatar_id, jonathan_id;
  END IF;
  
  RAISE NOTICE 'Jonathan Braden avatar setup complete with proper EchoStone schema';
END $$;

-- 10. Test the search function
SELECT 'Testing search_memories function:' as test;
SELECT * FROM search_memories('jonathan_braden', 'who are you', 3);