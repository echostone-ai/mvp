-- Add avatar_id column to conversations table
ALTER TABLE conversations ADD COLUMN avatar_id UUID REFERENCES avatar_profiles(id) ON DELETE CASCADE;

-- Create index for avatar-specific queries
CREATE INDEX conversations_avatar_id_idx ON conversations (avatar_id);

-- Update RLS policy to ensure users can only access their own conversations
DROP POLICY IF EXISTS "Users can only access their own conversations" ON conversations;
CREATE POLICY "Users can only access their own conversations" ON conversations
  FOR ALL USING (auth.uid() = user_id);