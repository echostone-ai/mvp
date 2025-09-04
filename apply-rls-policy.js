#!/usr/bin/env node

/**
 * Apply RLS Policy for fact_promotion_queue - Service Role Only
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false
    }
  }
);

async function applyRLSPolicy() {
  console.log('🔒 Applying RLS Policy for fact_promotion_queue (Service Role Only)');
  
  try {
    // Enable RLS
    console.log('📋 Step 1: Enabling RLS on fact_promotion_queue');
    const { error: enableError } = await supabase.rpc('exec_sql', {
      sql_query: 'ALTER TABLE public.fact_promotion_queue ENABLE ROW LEVEL SECURITY;'
    });
    
    if (enableError) {
      console.log('⚠️  RLS enable failed (may already be enabled):', enableError.message);
    } else {
      console.log('✅ RLS enabled');
    }
    
    // Drop existing policies
    console.log('📋 Step 2: Dropping existing policies');
    const policiesToDrop = [
      'service_role_full_access',
      'Service role can manage fact_promotion_queue',
      'Users can manage their own fact promotion queue',
      'Allow fact promotion access'
    ];
    
    for (const policy of policiesToDrop) {
      const { error } = await supabase.rpc('exec_sql', {
        sql_query: `DROP POLICY IF EXISTS "${policy}" ON public.fact_promotion_queue;`
      });
      
      if (error) {
        console.log(`⚠️  Drop policy "${policy}" failed:`, error.message);
      } else {
        console.log(`✅ Dropped policy: ${policy}`);
      }
    }
    
    // Create new service-role only policy
    console.log('📋 Step 3: Creating service-role only policy');
    const { error: createError } = await supabase.rpc('exec_sql', {
      sql_query: `
        CREATE POLICY "service_role_full_access"
        ON public.fact_promotion_queue
        FOR ALL
        USING (auth.role() = 'service_role')
        WITH CHECK (auth.role() = 'service_role');
      `
    });
    
    if (createError) {
      console.error('❌ Create policy failed:', createError.message);
      return false;
    } else {
      console.log('✅ Created service-role only policy');
    }
    
    // Grant permissions
    console.log('📋 Step 4: Granting permissions to service role');
    const { error: grantError } = await supabase.rpc('exec_sql', {
      sql_query: 'GRANT ALL ON public.fact_promotion_queue TO service_role;'
    });
    
    if (grantError) {
      console.log('⚠️  Grant permissions failed:', grantError.message);
    } else {
      console.log('✅ Granted permissions to service role');
    }
    
    console.log('\n🎉 RLS Policy successfully applied!');
    console.log('✅ Only service role can now access fact_promotion_queue');
    
    return true;
    
  } catch (error) {
    console.error('❌ RLS Policy application failed:', error.message);
    return false;
  }
}

// Run the application
applyRLSPolicy().then(success => {
  if (success) {
    console.log('\n🚀 Ready for political query testing!');
    process.exit(0);
  } else {
    console.log('\n💥 Manual application required in Supabase SQL Editor');
    process.exit(1);
  }
}).catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});