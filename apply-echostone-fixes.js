#!/usr/bin/env node

/**
 * Apply EchoStone Memory Pipeline Fixes
 * 
 * This script applies the comprehensive database fixes for:
 * 1. RLS policy for fact promotion
 * 2. Enhanced memory retrieval function
 * 3. Count enumeration function
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function applySQLFile(filePath) {
  console.log(`📄 Reading SQL file: ${filePath}`);
  
  try {
    const sqlContent = fs.readFileSync(filePath, 'utf8');
    
    // Split SQL content into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('/*'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comments and empty statements
      if (statement.startsWith('--') || statement.trim().length === 0) {
        continue;
      }
      
      console.log(`${i + 1}/${statements.length} Executing: ${statement.substring(0, 60)}...`);
      
      try {
        const { data, error } = await supabase.rpc('exec_sql', {
          sql: statement + ';'
        });
        
        if (error) {
          console.log(`❌ Error: ${error.message}`);
          errorCount++;
        } else {
          console.log(`✅ Success`);
          successCount++;
        }
      } catch (err) {
        console.log(`❌ Exception: ${err.message}`);
        errorCount++;
      }
      
      // Small delay between statements
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\n📊 Results: ${successCount} successful, ${errorCount} errors`);
    return errorCount === 0;
    
  } catch (error) {
    console.error(`❌ Failed to read or process SQL file: ${error.message}`);
    return false;
  }
}

async function testDatabaseFunctions() {
  console.log('\n🧪 Testing Database Functions\n');
  
  const JONATHAN_AVATAR_ID = '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';
  
  // Test enhanced memory retrieval function
  console.log('1. Testing get_enhanced_memories function...');
  try {
    const { data, error } = await supabase.rpc('get_enhanced_memories', {
      target_user_id: null,
      target_avatar_id: JONATHAN_AVATAR_ID,
      search_query: 'favorite music',
      match_count: 10,
      similarity_threshold: 0.2,
      include_bio_facts: true
    });
    
    if (error) {
      console.log(`❌ Function error: ${error.message}`);
    } else {
      console.log(`✅ Function working: returned ${data.length} results`);
    }
  } catch (err) {
    console.log(`❌ Function test failed: ${err.message}`);
  }
  
  // Test count enumeration function
  console.log('\n2. Testing enumerate_items_from_memories function...');
  try {
    const testMemories = [
      {
        id: 'test-1',
        fragment_text: 'Romeo is my current toy poodle',
        created_at: new Date().toISOString()
      },
      {
        id: 'test-2', 
        fragment_text: 'I had Bucky before Romeo',
        created_at: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];
    
    const { data, error } = await supabase.rpc('enumerate_items_from_memories', {
      memories_json: JSON.stringify(testMemories),
      item_patterns: ['dog', 'dogs', 'pet', 'pets']
    });
    
    if (error) {
      console.log(`❌ Function error: ${error.message}`);
    } else {
      console.log(`✅ Function working: ${JSON.stringify(data[0], null, 2)}`);
    }
  } catch (err) {
    console.log(`❌ Function test failed: ${err.message}`);
  }
  
  // Test RLS policy
  console.log('\n3. Testing fact_promotion_queue RLS policy...');
  try {
    const { data, error } = await supabase
      .from('fact_promotion_queue')
      .select('count')
      .limit(1);
      
    if (error) {
      console.log(`❌ RLS policy error: ${error.message}`);
    } else {
      console.log(`✅ RLS policy allows access`);
    }
  } catch (err) {
    console.log(`❌ RLS test failed: ${err.message}`);
  }
}

async function applyEchoStoneFixes() {
  console.log('🚀 Applying EchoStone Memory Pipeline Fixes\n');
  console.log('=' .repeat(60) + '\n');
  
  // Check if SQL file exists
  const sqlFilePath = path.join(__dirname, 'ECHOSTONE_MEMORY_PIPELINE_FIX.sql');
  
  if (!fs.existsSync(sqlFilePath)) {
    console.error(`❌ SQL file not found: ${sqlFilePath}`);
    console.log('Please ensure ECHOSTONE_MEMORY_PIPELINE_FIX.sql is in the current directory');
    return;
  }
  
  // Apply SQL fixes
  console.log('📋 Step 1: Applying Database Fixes\n');
  const sqlSuccess = await applySQLFile(sqlFilePath);
  
  if (!sqlSuccess) {
    console.log('\n⚠️  Some SQL statements failed. Please check the errors above.');
    console.log('You may need to run the SQL manually in Supabase SQL Editor.');
  }
  
  // Test functions
  await testDatabaseFunctions();
  
  console.log('\n' + '='.repeat(60));
  console.log('\n🎯 EchoStone Memory Pipeline Fixes Applied!');
  
  if (sqlSuccess) {
    console.log('\n✅ All database fixes applied successfully');
    console.log('\n📝 Next Steps:');
    console.log('1. Run: node test-echostone-memory-fixes.js');
    console.log('2. Test the demo chat API with acceptance criteria queries');
    console.log('3. Monitor deep lane behavior for profile queries');
  } else {
    console.log('\n⚠️  Some fixes may need manual application');
    console.log('\n🔧 Manual Steps:');
    console.log('1. Open Supabase SQL Editor');
    console.log('2. Copy and paste ECHOSTONE_MEMORY_PIPELINE_FIX.sql');
    console.log('3. Execute the SQL statements');
    console.log('4. Run the test script to validate');
  }
}

// Run the application
applyEchoStoneFixes().catch(console.error);