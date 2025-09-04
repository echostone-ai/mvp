#!/usr/bin/env node

/**
 * Simple test to verify the EnhancedPromptBuilder is working
 */

const { EnhancedPromptBuilder } = require('./src/lib/services/enhancedPromptBuilder.ts');

async function testEnhancedBuilder() {
  console.log('🧪 Testing EnhancedPromptBuilder...\n');
  
  try {
    const builder = new EnhancedPromptBuilder();
    
    // Test the main method
    const result = await builder.buildEnhancedSystemPromptWithStyle(
      'jonathan-demo',
      'How is Romeo doing?',
      [],
      {
        fastMode: true,
        debug: true
      }
    );
    
    console.log('✅ Enhanced builder working!');
    console.log('📊 Metadata:', JSON.stringify(result.metadata, null, 2));
    console.log('📝 Prompt preview:', result.prompt.substring(0, 200) + '...');
    
    if (result.debug) {
      console.log('🐛 Debug info:', JSON.stringify(result.debug, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testEnhancedBuilder();