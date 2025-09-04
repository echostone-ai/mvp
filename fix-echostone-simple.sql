-- Simple EchoStone schema fix - step by step approach
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

-- 2. Create supporting tables
CREATE TABLE IF NOT EXISTS chat_contexts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  avatar_id UUID NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
  context_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quick_facts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  avatar_id UUID NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(avatar_id, key)
);

CREATE TABLE IF NOT EXISTS personality_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  avatar_id UUID NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
  trait TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS voice_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  avatar_id UUID NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  voice_id TEXT NOT NULL,
  default_speed DECIMAL DEFAULT 1.0,
  sample_rate INTEGER DEFAULT 22050,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create Jonathan Braden avatar
INSERT INTO avatars (slug, display_name, status)
VALUES ('jonathan_braden', 'Jonathan Braden', 'active')
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  status = EXCLUDED.status,
  updated_at = NOW();

-- 4. Get the new avatar ID and show it
DO $$
DECLARE
  jonathan_id UUID;
  old_avatar_id UUID;
  memory_count INTEGER;
BEGIN
  -- Get Jonathan's new ID
  SELECT id INTO jonathan_id FROM avatars WHERE slug = 'jonathan_braden';
  
  -- Check if there are existing memories from avatar_profiles
  SELECT id INTO old_avatar_id FROM avatar_profiles WHERE name = 'jonathan_braden' LIMIT 1;
  
  IF old_avatar_id IS NOT NULL THEN
    -- Count existing memories
    SELECT COUNT(*) INTO memory_count FROM memory_fragments WHERE avatar_id = old_avatar_id;
    RAISE NOTICE 'Found % existing memories with old avatar_id %', memory_count, old_avatar_id;
    RAISE NOTICE 'New avatar_id is %', jonathan_id;
  END IF;
  
  -- Insert hot data
  INSERT INTO chat_contexts (avatar_id, context_text)
  VALUES (
    jonathan_id,
    'Jonathan Braden: 6''7" Canadian-American entrepreneur, founder of EchoStone.ai. Lives in Sofia, Bulgaria. Witty, sarcastic, warm personality. Left America in 2018 due to politics. Loves history, abstract painting, and his poodle Romeo. Speaks multiple languages.'
  )
  ON CONFLICT DO NOTHING;
  
  -- Insert quick facts
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
  
  -- Insert personality profiles
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
  
  RAISE NOTICE 'Jonathan Braden avatar setup complete. New avatar_id: %', jonathan_id;
END $$;

-- 5. Show current state
SELECT 'Current avatars:' as info, slug, display_name, id FROM avatars;
SELECT 'Memory fragments count:' as info, COUNT(*) as count FROM memory_fragments;

-- 6. Create the search function
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
  RETURN QUERY
  SELECT 
    mf.id,
    mf.avatar_id,
    mf.fragment_text,
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
      OR p_query = ''
    )
  ORDER BY score DESC, mf.created_at DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION search_memories(TEXT, TEXT, INT) TO anon;
GRANT EXECUTE ON FUNCTION search_memories(TEXT, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION search_memories(TEXT, TEXT, INT) TO service_role;