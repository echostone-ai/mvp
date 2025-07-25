const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('Creating avatar_shares table...');
    
    // Create the table
    const { error: tableError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS avatar_shares (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            avatar_id UUID NOT NULL REFERENCES avatar_profiles(id) ON DELETE CASCADE,
            owner_id UUID NOT NULL,
            share_token TEXT UNIQUE NOT NULL,
            shared_with_email TEXT NOT NULL,
            permissions JSONB DEFAULT '["chat", "viewMemories", "createMemories"]'::jsonb,
            status TEXT DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
            last_accessed_at TIMESTAMP WITH TIME ZONE,
            
            UNIQUE(avatar_id, shared_with_email)
        );
      `
    });

    if (tableError) {
      console.error('Failed to create table:', tableError);
      // Try direct query instead
      const { error: directError } = await supabase
        .from('avatar_shares')
        .select('id')
        .limit(1);
      
      if (directError && directError.code === '42P01') {
        // Table doesn't exist, let's create it manually
        console.log('Table does not exist, creating manually...');
        
        // We'll need to use a different approach
        console.log('Please run this SQL manually in your Supabase SQL editor:');
        console.log(fs.readFileSync('supabase/migrations/004_create_avatar_shares.sql', 'utf8'));
        return;
      }
    }
    
    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Error running migration:', err);
    console.log('Please run this SQL manually in your Supabase SQL editor:');
    console.log(fs.readFileSync('supabase/migrations/004_create_avatar_shares.sql', 'utf8'));
  }
}

runMigration();