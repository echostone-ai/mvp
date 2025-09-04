#!/usr/bin/env node

/**
 * Apply Essential Functions
 * Creates the missing get_enhanced_memories function
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyEssentialFunctions() {
  console.log('🔧 Applying essential database functions...\n');
  
  try {
    // Read the SQL file
    const sqlContent = fs.readFileSync('apply-essential-functions.sql', 'utf8');
    
    // Split into individual statements
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`${i + 1}. Executing: ${statement.substring(0, 50)}...`);
        
        const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
        
        if (error) {
          // Try direct execution if rpc fails
          const { error: directError } = await supabase
            .from('_temp_sql_exec')
            .select('*')
            .limit(0);
          
          if (directError) {
            console.log(`   ⚠️  RPC not available, trying alternative approach...`);
            // For function creation, we'll use a different approach
            if (statement.includes('CREATE OR REPLACE FUNCTION')) {
              console.log(`   ✅ Function creation statement prepared (manual execution may be needed)`);
            }
          }
        } else {
          console.log(`   ✅ Success`);
        }
      }
    }
    
    // Test the function
    console.log('\n🧪 Testing get_enhanced_memories function...');
    const { data, error } = await supabase.rpc('get_enhanced_memories', {
      target_user_id: null,
      target_avatar_id: '0585f43b-4b49-4e16-b2a7-91c8e1e3850c',
      search_query: 'Tyler',
      match_count: 5,
      similarity_threshold: 0.25
    });
    
    if (error) {
      console.log(`❌ Function test failed: ${error.message}`);
      console.log('\n📋 Manual SQL execution required:');
      console.log('Copy the contents of apply-essential-functions.sql to Supabase SQL Editor');
    } else {
      console.log(`✅ Function test successful: ${data?.length || 0} results`);
    }
    
  } catch (error) {
    console.error('💥 Error applying functions:', error.message);
    console.log('\n📋 Manual SQL execution required:');
    console.log('Copy the contents of apply-essential-functions.sql to Supabase SQL Editor');
  }
}

// Run the application
if (require.main === module) {
  applyEssentialFunctions()
    .catch(error => {
      console.error('Application failed:', error);
      process.exit(1);
    });
}

module.exports = { applyEssentialFunctions };