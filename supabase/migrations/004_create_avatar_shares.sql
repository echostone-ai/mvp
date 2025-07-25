-- Create avatar_shares table for sharing avatars with other users
CREATE TABLE IF NOT EXISTS avatar_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    avatar_id UUID NOT NULL REFERENCES avatar_profiles(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL, -- References auth.users
    share_token TEXT UNIQUE NOT NULL,
    shared_with_email TEXT NOT NULL,
    permissions JSONB DEFAULT '["chat", "viewMemories", "createMemories"]'::jsonb,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    
    -- Indexes for performance
    UNIQUE(avatar_id, shared_with_email)
);

-- Create indexes
CREATE INDEX idx_avatar_shares_avatar_id ON avatar_shares(avatar_id);
CREATE INDEX idx_avatar_shares_owner_id ON avatar_shares(owner_id);
CREATE INDEX idx_avatar_shares_token ON avatar_shares(share_token);
CREATE INDEX idx_avatar_shares_email ON avatar_shares(shared_with_email);
CREATE INDEX idx_avatar_shares_status ON avatar_shares(status);

-- Enable RLS
ALTER TABLE avatar_shares ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Avatar owners can manage their shares
CREATE POLICY "Avatar owners can manage their shares" ON avatar_shares
    FOR ALL USING (
        owner_id = auth.uid()
    );

-- Shared users can view their shares
CREATE POLICY "Shared users can view their shares" ON avatar_shares
    FOR SELECT USING (
        shared_with_email = auth.email() AND status = 'active'
    );

-- Function to generate share tokens
CREATE OR REPLACE FUNCTION generate_share_token()
RETURNS TEXT AS $$
BEGIN
    RETURN encode(gen_random_bytes(16), 'base64url');
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired shares
CREATE OR REPLACE FUNCTION cleanup_expired_shares()
RETURNS void AS $$
BEGIN
    UPDATE avatar_shares 
    SET status = 'expired' 
    WHERE expires_at < NOW() AND status = 'active';
END;
$$ LANGUAGE plpgsql;