-- Add avatar_id column to conversations table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'conversations'
        AND column_name = 'avatar_id'
    ) THEN
        ALTER TABLE conversations ADD COLUMN avatar_id UUID REFERENCES avatar_profiles(id) ON DELETE CASCADE;
        
        -- Create index for avatar-specific queries
        CREATE INDEX conversations_avatar_id_idx ON conversations (avatar_id);
    END IF;
END $$;