const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyEnhancedMemoryFix() {
  console.log('🔧 Applying enhanced memory search fix...\n');
  
  try {
    // Read the SQL file
    const sql = fs.readFileSync('fix-enhanced-memory-search.sql', 'utf8');
    
    console.log('Applying enhanced memory search function...');
    
    // Apply the function using a direct query
    // Note: We'll need to use the REST API directly since Supabase client doesn't support arbitrary SQL
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY
      },
      body: JSON.stringify({ sql })
    });
    
    if (!response.ok) {
      console.log('❌ Failed to apply via REST API. Trying alternative approach...');
      
      // Alternative: Apply via migration file
      const migrationContent = `-- Migration: Enhanced Memory Search Fix
-- Applied: ${new Date().toISOString()}

${sql}`;
      
      fs.writeFileSync('supabase/migrations/028_enhanced_memory_search_fix.sql', migrationContent);
      console.log('✅ Created migration file: 028_enhanced_memory_search_fix.sql');
      console.log('Please apply this migration manually or restart your Supabase instance.');
      
    } else {
      console.log('✅ Enhanced memory search function applied successfully!');
    }
    
    // Test the new function
    console.log('\n🔍 Testing the improved function...');
    
    const userId = '550e8400-e29b-41d4-a716-446655440000';
    const resolvedAvatarId = '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';
    
    const { data, error } = await supabase.rpc('get_enhanced_memories', {
      target_user_id: userId,
      target_avatar_id: resolvedAvatarId,
      search_query: 'What was your first dog?',
      match_count: 10,
      similarity_threshold: 0.1,
      include_bio_facts: true
    });
    
    if (error) {
      console.log('❌ Test error:', error);
    } else {
      console.log(`✅ Test returned ${data?.length || 0} results`);
      if (data?.length > 0) {
        console.log('\nResults:');
        data.forEach((result, i) => {
          const hasRomeo = result.fragment_text.includes('Romeo');
          const hasBucky = result.fragment_text.includes('Bucky');
          const isDogAnswer = (hasRomeo || hasBucky) && result.fragment_text.length > 50;
          
          console.log(`${i+1}. [${result.match_type}] Score: ${result.similarity_score} ${isDogAnswer ? '🎉' : ''}`);
          console.log(`   ${result.fragment_text.substring(0, 100)}...`);
        });
        
        const dogAnswers = data.filter(r => 
          (r.fragment_text.includes('Romeo') || r.fragment_text.includes('Bucky')) && 
          r.fragment_text.length > 50
        );
        
        if (dogAnswers.length > 0) {
          console.log(`\n🎉 SUCCESS! Found ${dogAnswers.length} dog-related answers!`);
          console.log('The memory retrieval should now work correctly for Jonathan demo.');
        } else {
          console.log('\n⚠️  Still not finding the dog answers. The function may need manual application.');
        }
      }
    }
    
  } catch (error) {
    console.log('❌ Error applying fix:', error);
  }
}

applyEnhancedMemoryFix().catch(console.error);