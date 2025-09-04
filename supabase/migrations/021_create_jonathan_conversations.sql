-- Migration: Create Jonathan Demo Conversation Tables
-- Task 8: Add conversation state management and persistence
-- Creates tables for conversation state tracking and turn history

-- Create jonathan_conversations table for conversation state
CREATE TABLE IF NOT EXISTS jonathan_conversations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  avatar_id TEXT NOT NULL DEFAULT 'jonathan-demo',
  user_id TEXT,
  visitor_id TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  last_activity TIMESTAMPTZ NOT NULL,
  memory_context TEXT DEFAULT '',
  voice_settings JSONB,
  expression_pack_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  turn_count INTEGER NOT NULL DEFAULT 0,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create jonathan_conversation_turns table for conversation history
CREATE TABLE IF NOT EXISTS jonathan_conversation_turns (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES jonathan_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  audio_latency INTEGER, -- milliseconds
  expressions_used TEXT[], -- array of expression IDs used
  memory_fragments_referenced TEXT[], -- array of memory fragment IDs referenced
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_jonathan_conversations_session_id ON jonathan_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_jonathan_conversations_avatar_id ON jonathan_conversations(avatar_id);
CREATE INDEX IF NOT EXISTS idx_jonathan_conversations_is_active ON jonathan_conversations(is_active);
CREATE INDEX IF NOT EXISTS idx_jonathan_conversations_last_activity ON jonathan_conversations(last_activity);
CREATE INDEX IF NOT EXISTS idx_jonathan_conversations_user_id ON jonathan_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_jonathan_conversations_visitor_id ON jonathan_conversations(visitor_id);

CREATE INDEX IF NOT EXISTS idx_jonathan_conversation_turns_conversation_id ON jonathan_conversation_turns(conversation_id);
CREATE INDEX IF NOT EXISTS idx_jonathan_conversation_turns_timestamp ON jonathan_conversation_turns(timestamp);
CREATE INDEX IF NOT EXISTS idx_jonathan_conversation_turns_role ON jonathan_conversation_turns(role);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_jonathan_conversations_active_recent 
  ON jonathan_conversations(is_active, last_activity DESC) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_jonathan_conversation_turns_conv_timestamp 
  ON jonathan_conversation_turns(conversation_id, timestamp);

-- Add RLS (Row Level Security) policies if needed
ALTER TABLE jonathan_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE jonathan_conversation_turns ENABLE ROW LEVEL SECURITY;

-- Policy for jonathan_conversations - allow all operations for now (can be restricted later)
DROP POLICY IF EXISTS "Allow all operations on jonathan_conversations" ON jonathan_conversations;
CREATE POLICY "Allow all operations on jonathan_conversations" 
  ON jonathan_conversations FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Policy for jonathan_conversation_turns - allow all operations for now (can be restricted later)
DROP POLICY IF EXISTS "Allow all operations on jonathan_conversation_turns" ON jonathan_conversation_turns;
CREATE POLICY "Allow all operations on jonathan_conversation_turns" 
  ON jonathan_conversation_turns FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_jonathan_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_jonathan_conversations_updated_at ON jonathan_conversations;
CREATE TRIGGER trigger_update_jonathan_conversations_updated_at
  BEFORE UPDATE ON jonathan_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_jonathan_conversations_updated_at();

-- Create function to automatically update turn_count
CREATE OR REPLACE FUNCTION update_conversation_turn_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE jonathan_conversations 
    SET turn_count = turn_count + 1,
        last_activity = NEW.timestamp,
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE jonathan_conversations 
    SET turn_count = turn_count - 1,
        updated_at = NOW()
    WHERE id = OLD.conversation_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update turn_count
DROP TRIGGER IF EXISTS trigger_update_conversation_turn_count ON jonathan_conversation_turns;
CREATE TRIGGER trigger_update_conversation_turn_count
  AFTER INSERT OR DELETE ON jonathan_conversation_turns
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_turn_count();

-- Create function for conversation cleanup (can be called by cron job)
CREATE OR REPLACE FUNCTION cleanup_old_jonathan_conversations(
  inactive_hours INTEGER DEFAULT 48,
  archive_hours INTEGER DEFAULT 168 -- 1 week
)
RETURNS INTEGER AS $$
DECLARE
  archived_count INTEGER := 0;
  deleted_count INTEGER := 0;
BEGIN
  -- Archive conversations that have been inactive for specified hours
  UPDATE jonathan_conversations 
  SET is_active = false, 
      archived_at = NOW(),
      updated_at = NOW()
  WHERE is_active = true 
    AND last_activity < NOW() - INTERVAL '1 hour' * inactive_hours;
  
  GET DIAGNOSTICS archived_count = ROW_COUNT;
  
  -- Delete very old archived conversations (optional - uncomment if needed)
  -- DELETE FROM jonathan_conversations 
  -- WHERE is_active = false 
  --   AND archived_at < NOW() - INTERVAL '1 hour' * archive_hours;
  -- 
  -- GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RAISE NOTICE 'Archived % conversations, deleted % conversations', archived_count, deleted_count;
  RETURN archived_count + deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create view for conversation analytics
CREATE OR REPLACE VIEW jonathan_conversation_analytics AS
SELECT 
  DATE_TRUNC('day', start_time) as conversation_date,
  COUNT(*) as total_conversations,
  COUNT(*) FILTER (WHERE is_active = true) as active_conversations,
  AVG(turn_count) as avg_turns_per_conversation,
  AVG(EXTRACT(EPOCH FROM (last_activity - start_time))) as avg_duration_seconds,
  SUM(turn_count) as total_turns
FROM jonathan_conversations
GROUP BY DATE_TRUNC('day', start_time)
ORDER BY conversation_date DESC;

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON jonathan_conversations TO authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON jonathan_conversation_turns TO authenticated;
-- GRANT SELECT ON jonathan_conversation_analytics TO authenticated;

COMMENT ON TABLE jonathan_conversations IS 'Stores conversation state for Jonathan demo sessions with persistence across browser sessions';
COMMENT ON TABLE jonathan_conversation_turns IS 'Stores individual conversation turns with memory fragment associations';
COMMENT ON FUNCTION cleanup_old_jonathan_conversations IS 'Cleanup function for archiving old conversations - can be called by cron job';
COMMENT ON VIEW jonathan_conversation_analytics IS 'Analytics view for conversation metrics and usage patterns';