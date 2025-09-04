const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyRLSFix() {
  console.log('🔧 Applying RLS policy fix for fact_promotion_queue...\n');
  
  try {
    // Drop existing policy
    console.log('1. Dropping existing policy...');
    const { error: dropError } = await supabase.rpc('exec_sql', {
      sql: 'DROP POLICY IF EXISTS "Service role can manage fact_promotion_queue" ON public.fact_promotion_queue;'
    });
    
    if (dropError && !dropError.message.includes('does not exist')) {
      console.log('Drop policy error:', dropError);
    } else {
      console.log('✅ Policy dropped successfully');
    }
    
    // Create new policy
    console.log('2. Creating new policy...');
    const { error: createError } = await supabase.rpc('exec_sql', {
      sql: `CREATE POLICY "Service role can manage fact_promotion_queue" ON public.fact_promotion_queue
            FOR ALL USING (
                auth.role() = 'service_role' OR 
                auth.role() = 'authenticated'
            );`
    });
    
    if (createError) {
      console.log('Create policy error:', createError);
    } else {
      console.log('✅ New policy created successfully');
    }
    
    // Test access
    console.log('3. Testing access...');
    const { data: testData, error: testError } = await supabase
      .from('fact_promotion_queue')
      .select('count')
      .limit(1);
      
    if (testError) {
      console.log('❌ Test access failed:', testError);
    } else {
      console.log('✅ Access test successful');
    }
    
  } catch (error) {
    console.log('❌ Error applying RLS fix:', error);
    
    // Try alternative approach - direct SQL execution
    console.log('\n4. Trying alternative approach...');
    
    const sqlCommands = [
      'DROP POLICY IF EXISTS "Service role can manage fact_promotion_queue" ON public.fact_promotion_queue;',
      `CREATE POLICY "Service role can manage fact_promotion_queue" ON public.fact_promotion_queue
       FOR ALL USING (
           auth.role() = 'service_role' OR 
           auth.role() = 'authenticated'
       );`
    ];
    
    for (const sql of sqlCommands) {
      console.log(`Executing: ${sql.substring(0, 50)}...`);
      const { error } = await supabase.rpc('exec_sql', { sql });
      if (error) {
        console.log('Error:', error.message);
      } else {
        console.log('✅ Success');
      }
    }
  }
}

applyRLSFix().catch(console.error);