const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkFunctions() {
  console.log('🔍 Checking available database functions...\n');
  
  // Try to get function list from information_schema
  const { data: functions, error } = await supabase
    .from('information_schema.routines')
    .select('routine_name, routine_type')
    .eq('routine_schema', 'public')
    .like('routine_name', '%memor%');
    
  if (error) {
    console.log('Error getting functions:', error);
    
    // Try alternative approach - check specific functions
    console.log('\nTrying specific function calls...');
    
    const testFunctions = [
      'search_memories',
      'get_enhanced_memories', 
      'get_memories_with_ranking',
      'search_memory_fragments',
      'get_user_memories'
    ];
    
    for (const funcName of testFunctions) {
      try {
        const { error: testError } = await supabase.rpc(funcName, {});
        if (testError) {
          if (testError.code === 'PGRST202') {
            console.log(`❌ ${funcName} - does not exist`);
          } else {
            console.log(`✅ ${funcName} - exists (got parameter error: ${testError.message})`);
          }
        } else {
          console.log(`✅ ${funcName} - exists and works`);
        }
      } catch (e) {
        console.log(`❌ ${funcName} - error: ${e.message}`);
      }
    }
  } else {
    console.log('Available memory-related functions:');
    functions.forEach(f => {
      console.log(`- ${f.routine_name} (${f.routine_type})`);
    });
  }
}

checkFunctions().catch(console.error);