-- CRITICAL SECURITY FIX: Add user_id column to avatar_profiles table
-- This is essential for user isolation

-- Add user_id column to avatar_profiles table
ALTER TABLE avatar_profiles 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS avatar_profiles_user_id_idx ON avatar_profiles (user_id);

-- Update existing avatars to have a user_id (this is a temporary fix)
-- In production, you'd need to assign these to the correct users
UPDATE avatar_profiles 
SET user_id = (SELECT id FROM auth.users LIMIT 1)
WHERE user_id IS NULL;

-- Make user_id NOT NULL after updating existing records
ALTER TABLE avatar_profiles 
ALTER COLUMN user_id SET NOT NULL;

-- Enable Row Level Security
ALTER TABLE avatar_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can only see their own avatars" ON avatar_profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can only create their own avatars" ON avatar_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own avatars" ON avatar_profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own avatars" ON avatar_profiles
    FOR DELETE USING (auth.uid() = user_id);

-- Verify the table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'avatar_profiles' 
ORDER BY ordinal_position;