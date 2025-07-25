import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    console.log('Setting up avatar sharing table...');
    
    // First, let's check if the table exists
    const { data: existingTable, error: checkError } = await supabase
      .from('avatar_shares')
      .select('id')
      .limit(1);
    
    if (!checkError) {
      return NextResponse.json({ 
        success: true, 
        message: 'Avatar sharing table already exists' 
      });
    }
    
    // If table doesn't exist (error code 42P01), we need to create it
    if (checkError.code === '42P01') {
      console.log('Table does not exist, need to create it manually in Supabase dashboard');
      
      const createTableSQL = `
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
      `;
      
      return NextResponse.json({ 
        success: false,
        message: 'Table needs to be created manually. Please run this SQL in your Supabase SQL editor:',
        sql: createTableSQL
      });
    }
    
    return NextResponse.json({ 
      success: false, 
      error: 'Unexpected error checking table existence',
      details: checkError
    });
    
  } catch (error) {
    console.error('Error setting up avatar sharing:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to setup avatar sharing' 
    }, { status: 500 });
  }
}