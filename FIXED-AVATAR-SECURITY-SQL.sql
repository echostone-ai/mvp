-- STEP 1: Add user_id column (allows NULL initially)
ALTER TABLE avatar_profiles 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- STEP 2: Update existing avatars to assign them to the first user
-- (You'll need to manually assign these to the correct users later)
UPDATE avatar_profiles 
SET user_id = (
  SELECT id FROM auth.users 
  ORDER BY created_at ASC 
  LIMIT 1
)
WHERE user_id IS NULL;

-- STEP 3: Now make user_id NOT NULL (after updating existing records)
ALTER TABLE avatar_profiles 
ALTER COLUMN user_id SET NOT NULL;

-- STEP 4: Create index for performance
CREATE INDEX IF NOT EXISTS avatar_profiles_user_id_idx ON avatar_profiles (user_id);

-- STEP 5: Enable Row Level Security
ALTER TABLE avatar_profiles ENABLE ROW LEVEL SECURITY;

-- STEP 6: Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can only see their own avatars" ON avatar_profiles;
DROP POLICY IF EXISTS "Users can only create their own avatars" ON avatar_profiles;
DROP POLICY IF EXISTS "Users can only update their own avatars" ON avatar_profiles;
DROP POLICY IF EXISTS "Users can only delete their own avatars" ON avatar_profiles;

-- STEP 7: Create security policies
CREATE POLICY "Users can only see their own avatars" ON avatar_profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can only create their own avatars" ON avatar_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own avatars" ON avatar_profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own avatars" ON avatar_profiles
    FOR DELETE USING (auth.uid() = user_id);

-- STEP 8: Verify the fix
SELECT 
  id, 
  name, 
  user_id,
  created_at 
FROM avatar_profiles 
ORDER BY created_at;

-- STEP 9: Check policies are active
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  cmd 
FROM pg_policies 
WHERE tablename = 'avatar_profiles';