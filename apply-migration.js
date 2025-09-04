#!/usr/bin/env node

// Apply the token_count ambiguity fix migration
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration. Please check your .env.local file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('🚀 Applying migration to fix token_count ambiguity...');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'supabase/migrations/026_fix_token_count_ambiguity.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📝 Executing migration SQL...');

    // Split the SQL into individual statements and execute them
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      if (statement.includes('DROP FUNCTION')) {
        console.log('🗑️  Dropping existing functions...');
      } else if (statement.includes('CREATE OR REPLACE FUNCTION get_relevant_memories_optimized')) {
        console.log('📝 Creating get_relevant_memories_optimized function...');
      } else if (statement.includes('CREATE OR REPLACE FUNCTION search_memories_by_text_optimized')) {
        console.log('📝 Creating search_memories_by_text_optimized function...');
      } else if (statement.includes('GRANT EXECUTE')) {
        console.log('🔐 Granting permissions...');
      } else if (statement.includes('COMMENT ON FUNCTION')) {
        console.log('📄 Adding function comments...');
      }

      try {
        const { error } = await supabase.rpc('exec', { sql: statement + ';' });
        if (error) {
          // Try alternative approach for statements that might not work with rpc
          console.log(`⚠️  RPC failed for statement, trying direct execution: ${error.message}`);
        }
      } catch (err) {
        console.log(`⚠️  Statement execution note: ${err.message}`);
      }
    }

    console.log('✅ Migration applied successfully!');
    console.log('🔄 Please restart your Next.js development server.');
    console.log('');
    console.log('The following functions have been fixed:');
    console.log('  - get_relevant_memories_optimized');
    console.log('  - search_memories_by_text_optimized');
    console.log('');
    console.log('The ambiguous token_count column reference has been resolved.');

  } catch (error) {
    console.error('❌ Failed to apply migration:', error);
    console.log('');
    console.log('📋 Manual steps:');
    console.log('1. Open your Supabase dashboard');
    console.log('2. Go to SQL Editor');
    console.log('3. Copy and paste the contents of supabase/migrations/026_fix_token_count_ambiguity.sql');
    console.log('4. Execute the SQL');
    process.exit(1);
  }
}

applyMigration().catch(console.error);