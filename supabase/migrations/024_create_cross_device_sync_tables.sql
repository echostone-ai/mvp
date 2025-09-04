-- Cross-Device Conversation Synchronization Tables
-- Migration: 024_create_cross_device_sync_tables.sql

-- Table to store device information for each user
CREATE TABLE IF NOT EXISTS user_devices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    device_id TEXT NOT NULL,
    device_info JSONB NOT NULL,
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id, device_id)
);

-- Table to store conversation synchronization state
CREATE TABLE IF NOT EXISTS conversation_sync_state (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID NOT NULL,
    user_id UUID NOT NULL,
    sync_state JSONB NOT NULL,
    sync_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(conversation_id, user_id)
);

-- Table to store real-time conversation updates
CREATE TABLE IF NOT EXISTS conversation_updates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID NOT NULL,
    update_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table to store device handoff requests and history
CREATE TABLE IF NOT EXISTS device_handoffs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID NOT NULL,
    source_device_id TEXT NOT NULL,
    target_device_id TEXT NOT NULL,
    handoff_data JSONB,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_device_id ON user_devices(device_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_last_seen ON user_devices(last_seen);

CREATE INDEX IF NOT EXISTS idx_conversation_sync_state_conversation_id ON conversation_sync_state(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_sync_state_user_id ON conversation_sync_state(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_sync_state_updated_at ON conversation_sync_state(updated_at);

CREATE INDEX IF NOT EXISTS idx_conversation_updates_conversation_id ON conversation_updates(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_updates_created_at ON conversation_updates(created_at);

CREATE INDEX IF NOT EXISTS idx_device_handoffs_conversation_id ON device_handoffs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_device_handoffs_status ON device_handoffs(status);
CREATE INDEX IF NOT EXISTS idx_device_handoffs_created_at ON device_handoffs(created_at);

-- RLS Policies
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_handoffs ENABLE ROW LEVEL SECURITY;

-- User devices policies
CREATE POLICY "Users can view their own devices" ON user_devices
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own devices" ON user_devices
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own devices" ON user_devices
    FOR UPDATE USING (auth.uid() = user_id);

-- Conversation sync state policies
CREATE POLICY "Users can view their own conversation sync state" ON conversation_sync_state
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own conversation sync state" ON conversation_sync_state
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversation sync state" ON conversation_sync_state
    FOR UPDATE USING (auth.uid() = user_id);

-- Conversation updates policies (need broader access for real-time sync)
CREATE POLICY "Users can view updates for their conversations" ON conversation_updates
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM conversation_sync_state css 
            WHERE css.conversation_id = conversation_updates.conversation_id 
            AND css.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert updates for their conversations" ON conversation_updates
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM conversation_sync_state css 
            WHERE css.conversation_id = conversation_updates.conversation_id 
            AND css.user_id = auth.uid()
        )
    );

-- Device handoffs policies
CREATE POLICY "Users can view handoffs for their conversations" ON device_handoffs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM conversation_sync_state css 
            WHERE css.conversation_id = device_handoffs.conversation_id 
            AND css.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create handoffs for their conversations" ON device_handoffs
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM conversation_sync_state css 
            WHERE css.conversation_id = device_handoffs.conversation_id 
            AND css.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update handoffs for their conversations" ON device_handoffs
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM conversation_sync_state css 
            WHERE css.conversation_id = device_handoffs.conversation_id 
            AND css.user_id = auth.uid()
        )
    );

-- Function to clean up old conversation updates (keep last 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_conversation_updates()
RETURNS void AS $$
BEGIN
    DELETE FROM conversation_updates 
    WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Function to update device last_seen timestamp
CREATE OR REPLACE FUNCTION update_device_last_seen()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update timestamps
CREATE TRIGGER update_user_devices_updated_at
    BEFORE UPDATE ON user_devices
    FOR EACH ROW
    EXECUTE FUNCTION update_device_last_seen();

CREATE TRIGGER update_conversation_sync_state_updated_at
    BEFORE UPDATE ON conversation_sync_state
    FOR EACH ROW
    EXECUTE FUNCTION update_device_last_seen();

-- Function to handle device cleanup when user leaves
CREATE OR REPLACE FUNCTION cleanup_inactive_devices()
RETURNS void AS $$
BEGIN
    -- Mark devices as inactive if not seen for 5 minutes
    UPDATE user_devices 
    SET device_info = jsonb_set(device_info, '{isActive}', 'false'::jsonb)
    WHERE last_seen < NOW() - INTERVAL '5 minutes'
    AND (device_info->>'isActive')::boolean = true;
    
    -- Remove devices not seen for 24 hours
    DELETE FROM user_devices 
    WHERE last_seen < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to run cleanup (if pg_cron is available)
-- SELECT cron.schedule('cleanup-devices', '*/5 * * * *', 'SELECT cleanup_inactive_devices();');
-- SELECT cron.schedule('cleanup-updates', '0 * * * *', 'SELECT cleanup_old_conversation_updates();');