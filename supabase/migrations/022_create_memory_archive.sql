-- Migration: Create memory archive table for Task 13
-- Task 13: Add advanced memory ranking and relevance scoring

-- Create memory_archive table for storing archived memories
CREATE TABLE IF NOT EXISTS memory_archive (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_memory_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  avatar_id UUID, -- No foreign key constraint since avatars table may not exist
  fragment_text TEXT NOT NULL,
  original_score FLOAT DEFAULT 0,
  archival_reason TEXT NOT NULL,
  archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  original_created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  conversation_context JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS memory_archive_user_id_idx ON memory_archive (user_id);
CREATE INDEX IF NOT EXISTS memory_archive_avatar_id_idx ON memory_archive (avatar_id);
CREATE INDEX IF NOT EXISTS memory_archive_archived_at_idx ON memory_archive (archived_at);
CREATE INDEX IF NOT EXISTS memory_archive_original_score_idx ON memory_archive (original_score);
CREATE INDEX IF NOT EXISTS memory_archive_archival_reason_idx ON memory_archive (archival_reason);
CREATE INDEX IF NOT EXISTS memory_archive_user_avatar_idx ON memory_archive (user_id, avatar_id);

-- Enable Row Level Security (RLS)
ALTER TABLE memory_archive ENABLE ROW LEVEL SECURITY;

-- Create RLS policy to ensure users can only access their own archived memories
CREATE POLICY "Users can only access their own archived memories" ON memory_archive
  FOR ALL USING (auth.uid() = user_id);

-- Create trigger to automatically update the updated_at column
CREATE TRIGGER update_memory_archive_updated_at 
    BEFORE UPDATE ON memory_archive 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE memory_archive IS 'Stores archived memory fragments that have been removed from active memory due to age, low relevance, or memory limits';
COMMENT ON COLUMN memory_archive.original_memory_id IS 'ID of the original memory fragment before archival';
COMMENT ON COLUMN memory_archive.original_score IS 'Final relevance score of the memory when it was archived';
COMMENT ON COLUMN memory_archive.archival_reason IS 'Reason for archival: age_threshold_exceeded, low_relevance_score, memory_limit_exceeded, etc.';
COMMENT ON COLUMN memory_archive.archived_at IS 'Timestamp when the memory was archived';
COMMENT ON COLUMN memory_archive.original_created_at IS 'Original creation timestamp of the memory fragment';

-- Create function to get archival statistics
CREATE OR REPLACE FUNCTION get_memory_archival_stats(
  target_user_id UUID DEFAULT NULL,
  target_avatar_id UUID DEFAULT NULL
)
RETURNS TABLE (
  total_archived BIGINT,
  archived_this_week BIGINT,
  archived_this_month BIGINT,
  average_score_archived FLOAT,
  top_archival_reasons JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  week_ago TIMESTAMP WITH TIME ZONE := NOW() - INTERVAL '7 days';
  month_ago TIMESTAMP WITH TIME ZONE := NOW() - INTERVAL '30 days';
BEGIN
  RETURN QUERY
  WITH archival_data AS (
    SELECT 
      ma.original_score,
      ma.archival_reason,
      ma.archived_at
    FROM memory_archive ma
    WHERE 
      (target_user_id IS NULL OR ma.user_id = target_user_id)
      AND (target_avatar_id IS NULL OR ma.avatar_id = target_avatar_id)
  ),
  reason_counts AS (
    SELECT 
      archival_reason,
      COUNT(*) as count
    FROM archival_data
    GROUP BY archival_reason
    ORDER BY count DESC
    LIMIT 5
  )
  SELECT
    (SELECT COUNT(*) FROM archival_data)::BIGINT as total_archived,
    (SELECT COUNT(*) FROM archival_data WHERE archived_at > week_ago)::BIGINT as archived_this_week,
    (SELECT COUNT(*) FROM archival_data WHERE archived_at > month_ago)::BIGINT as archived_this_month,
    (SELECT AVG(original_score) FROM archival_data WHERE original_score IS NOT NULL)::FLOAT as average_score_archived,
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('reason', archival_reason, 'count', count)), '[]'::jsonb) FROM reason_counts) as top_archival_reasons;
END;
$$;

-- Create function to restore archived memory
CREATE OR REPLACE FUNCTION restore_archived_memory(
  archive_id UUID,
  target_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  archived_memory RECORD;
  new_memory_id UUID;
  new_embedding vector(1536);
BEGIN
  -- Get the archived memory
  SELECT * INTO archived_memory
  FROM memory_archive
  WHERE id = archive_id AND user_id = target_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Archived memory not found or access denied';
  END IF;
  
  -- Generate a placeholder embedding (in practice, this would be regenerated)
  new_embedding := array_fill(0.0, ARRAY[1536])::vector;
  
  -- Insert back into active memories
  INSERT INTO memory_fragments (
    user_id,
    avatar_id,
    fragment_text,
    embedding,
    conversation_context,
    created_at
  ) VALUES (
    archived_memory.user_id,
    archived_memory.avatar_id,
    archived_memory.fragment_text,
    new_embedding,
    archived_memory.conversation_context,
    archived_memory.original_created_at
  ) RETURNING id INTO new_memory_id;
  
  -- Remove from archive
  DELETE FROM memory_archive WHERE id = archive_id AND user_id = target_user_id;
  
  RETURN new_memory_id;
END;
$$;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON memory_archive TO authenticated;
GRANT EXECUTE ON FUNCTION get_memory_archival_stats TO authenticated;
GRANT EXECUTE ON FUNCTION restore_archived_memory TO authenticated;

-- Add validation check
DO $$
BEGIN
  -- Verify the table was created successfully
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'memory_archive') THEN
    RAISE EXCEPTION 'memory_archive table was not created successfully';
  END IF;
  
  -- Verify indexes were created
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'memory_archive' AND indexname = 'memory_archive_user_id_idx') THEN
    RAISE EXCEPTION 'memory_archive indexes were not created successfully';
  END IF;
  
  -- Verify functions were created
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_memory_archival_stats') THEN
    RAISE EXCEPTION 'get_memory_archival_stats function was not created successfully';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'restore_archived_memory') THEN
    RAISE EXCEPTION 'restore_archived_memory function was not created successfully';
  END IF;
  
  RAISE NOTICE '✅ Memory archive system setup completed successfully!';
  RAISE NOTICE '✅ memory_archive table created with proper indexes and RLS';
  RAISE NOTICE '✅ Archival statistics and restore functions created';
  RAISE NOTICE '✅ Task 13 database components ready for advanced memory ranking';
END $$;