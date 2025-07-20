-- Add avatar_id column to memory_fragments table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'memory_fragments'
        AND column_name = 'avatar_id'
    ) THEN
        ALTER TABLE memory_fragments ADD COLUMN avatar_id UUID REFERENCES avatar_profiles(id) ON DELETE CASCADE;
        
        -- Create index for avatar-specific queries
        CREATE INDEX memory_fragments_avatar_id_idx ON memory_fragments (avatar_id);
    END IF;
END $$;