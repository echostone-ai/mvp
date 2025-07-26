const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConversationsTable() {
  console.log('🔍 Testing conversations table...');
  
  try {
    // Test if the table exists by trying to select from it
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ Error accessing conversations table:', error);
      return;
    }
    
    console.log('✅ Conversations table exists and is accessible');
    console.log('📊 Sample data:', data);
    
    // Check the table structure
    const { data: tableInfo, error: tableError } = await supabase
      .rpc('get_table_info', { table_name: 'conversations' });
    
    if (tableError) {
      console.log('⚠️  Could not get table structure info:', tableError.message);
    } else {
      console.log('📋 Table structure:', tableInfo);
    }
    
  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

testConversationsTable();