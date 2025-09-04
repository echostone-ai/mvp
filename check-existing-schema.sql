-- Check what tables and columns already exist
-- Run this to see the current schema

-- Check if avatars table exists and what columns it has
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name IN ('avatars', 'avatar_profiles', 'memory_fragments')
ORDER BY table_name, ordinal_position;

-- Check what avatars currently exist
SELECT 'Current avatars in avatars table:' as info;
SELECT * FROM avatars LIMIT 5;

SELECT 'Current avatars in avatar_profiles table:' as info;  
SELECT * FROM avatar_profiles LIMIT 5;

-- Check memory fragments
SELECT 'Memory fragments count:' as info, COUNT(*) as count FROM memory_fragments;