-- Add avatar_id column to memory_fragments table
ALTER TABLE memory_fragments ADD COLUMN avatar_id UUID REFERENCES avatar_profiles(id) ON DELETE CASCADE;

-- Create index for avatar-specific queries
CREATE INDEX memory_fragments_avatar_id_idx ON memory_fragments (avatar_id);

-- Update RLS policy to ensure users can only access their own memory fragments
DROP POLICY IF EXISTS "Users can only access their own memory fragments" ON memory_fragments;
CREATE POLICY "Users can only access their own memory fragments" ON memory_fragments
  FOR ALL USING (auth.uid() = user_id);