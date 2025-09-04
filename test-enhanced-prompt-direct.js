// Test the enhanced prompt builder directly
require('dotenv').config({ path: '.env.local' });

async function testEnhancedPromptDirect() {
  console.log('=== Testing Enhanced Prompt Builder Directly ===\n');

  try {
    // Import the enhanced prompt builder
    const { EnhancedPromptBuilder } = await import('./src/lib/services/enhancedPromptBuilder.js');
    const { createClient } = await import('@supabase/supabase-js');
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );

    const builder = new EnhancedPromptBuilder(supabase);
    
    console.log('Testing marriage query with enhanced prompt builder...');
    
    const result = await builder.buildEnhancedSystemPromptWithStyle(
      'jonathan_braden',
      'have you ever been married?',
      [],
      {
        priorityFilter: 6,
        memoryLimit: 8,
        trackExpressions: true,
        fastMode: true,
        debug: true,
        demoMode: {
          isDemo: true,
          conversationId: 'jonathan-demo',
          visitorId: process.env.DEMO_SYSTEM_USER_ID
        }
      }
    );
    
    console.log('\n=== RESULTS ===');
    console.log(`Memories found: ${result.metadata.memories_count}`);
    console.log(`Facts found: ${result.metadata.facts_count}`);
    console.log(`Processing time: ${result.metadata.processing_time_ms}ms`);
    
    if (result.debug) {
      console.log('\n=== DEBUG INFO ===');
      console.log(`Memories preview: ${JSON.stringify(result.debug.memoriesPreview, null, 2)}`);
      console.log(`Facts preview: ${JSON.stringify(result.debug.factsPreview?.slice(0, 5), null, 2)}`);
    }
    
    // Check if the prompt mentions marriage
    const promptLower = result.prompt.toLowerCase();
    if (promptLower.includes('married') || promptLower.includes('tia')) {
      console.log('\n✅ SUCCESS: Prompt includes marriage information');
    } else {
      console.log('\n❌ ISSUE: Prompt does not include marriage information');
    }
    
    console.log('\n=== PROMPT PREVIEW ===');
    console.log(result.prompt.substring(0, 1000) + '...');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testEnhancedPromptDirect();