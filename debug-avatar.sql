-- Debug and fix avatar issue
-- Run this to see what's happening and fix it

-- Check what avatars exist
SELECT 'Avatars in avatars table:' as info, slug, name, id FROM avatars LIMIT 5;
SELECT 'Avatars in avatar_profiles table:' as info, name, id FROM avatar_profiles LIMIT 5;

-- Check if Jonathan exists in avatars table
SELECT 'Jonathan in avatars:' as check, COUNT(*) as found FROM avatars WHERE slug = 'jonathan_braden';
SELECT 'Jonathan in avatar_profiles:' as check, COUNT(*) as found FROM avatar_profiles WHERE name = 'jonathan_braden';

-- If Jonathan doesn't exist in avatars table, create him
DO $$
DECLARE
  jonathan_exists INTEGER;
  old_jonathan_id UUID;
  new_jonathan_id UUID;
BEGIN
  -- Check if Jonathan exists in avatars table
  SELECT COUNT(*) INTO jonathan_exists FROM avatars WHERE slug = 'jonathan_braden';
  
  IF jonathan_exists = 0 THEN
    -- Get Jonathan from avatar_profiles
    SELECT id INTO old_jonathan_id FROM avatar_profiles WHERE name = 'jonathan_braden' LIMIT 1;
    
    IF old_jonathan_id IS NOT NULL THEN
      -- Create Jonathan in avatars table (try different approaches)
      BEGIN
        INSERT INTO avatars (slug, name, owner_id) 
        VALUES ('jonathan_braden', 'Jonathan Braden', '00000000-0000-0000-0000-000000000000');
        RAISE NOTICE 'Created Jonathan in avatars table with owner_id';
      EXCEPTION WHEN OTHERS THEN
        BEGIN
          INSERT INTO avatars (slug, name) 
          VALUES ('jonathan_braden', 'Jonathan Braden');
          RAISE NOTICE 'Created Jonathan in avatars table without owner_id';
        EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE 'Could not create Jonathan in avatars table: %', SQLERRM;
        END;
      END;
      
      -- Get the new ID
      SELECT id INTO new_jonathan_id FROM avatars WHERE slug = 'jonathan_braden';
      
      IF new_jonathan_id IS NOT NULL THEN
        -- Update memory fragments to point to new avatar
        UPDATE memory_fragments SET avatar_id = new_jonathan_id WHERE avatar_id = old_jonathan_id;
        RAISE NOTICE 'Updated memory fragments from % to %', old_jonathan_id, new_jonathan_id;
      END IF;
    ELSE
      RAISE NOTICE 'No Jonathan found in avatar_profiles either';
    END IF;
  ELSE
    RAISE NOTICE 'Jonathan already exists in avatars table';
  END IF;
END $$;

-- Final check
SELECT 'Final check - Jonathan in avatars:' as result, slug, name, id FROM avatars WHERE slug = 'jonathan_braden';
SELECT 'Memory fragments for Jonathan:' as result, COUNT(*) as count FROM memory_fragments mf 
JOIN avatars a ON mf.avatar_id = a.id WHERE a.slug = 'jonathan_braden';