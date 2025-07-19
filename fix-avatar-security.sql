-- Fix Avatar Security - Add Row Level Security
-- This prevents users from accessing other users' avatars at the database level

-- Enable RLS on avatar_profiles table
ALTER TABLE avatar_profiles ENABLE ROW LEVEL SECURITY;

-- Create policy to only allow users to see their own avatars
CREATE POLICY "Users can only see their own avatars" ON avatar_profiles
    FOR SELECT USING (auth.uid() = user_id);

-- Create policy to only allow users to insert their own avatars
CREATE POLICY "Users can only create their own avatars" ON avatar_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create policy to only allow users to update their own avatars
CREATE POLICY "Users can only update their own avatars" ON avatar_profiles
    FOR UPDATE USING (auth.uid() = user_id);

-- Create policy to only allow users to delete their own avatars
CREATE POLICY "Users can only delete their own avatars" ON avatar_profiles
    FOR DELETE USING (auth.uid() = user_id);

-- Verify the policies are in place
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'avatar_profiles';