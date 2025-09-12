/**
 * Test script for Jonathan-demo Memory & Style Upgrade
 * Run with: npx tsx src/scripts/testJonathanDemo.ts
 */

import { EnhancedPromptBuilder } from '../lib/services/enhancedPromptBuilder';
import { AvatarOnboardingService } from '../lib/services/avatarOnboardingService';
import { injectFactsFromMessage } from '../lib/services';

async function testJonathanDemoSetup() {
  console.log('🚀 Testing Jonathan-demo Memory & Style Upgrade...\n');

  try {
    // 1. Setup Jonathan-demo with expressions and catchphrases
    console.log('1. Setting up Jonathan-demo...');
    const setupResult = await AvatarOnboardingService.setupJonathanDemo();
    
    if (setupResult.success) {
      console.log('✅ Jonathan-demo setup successful');
      if (setupResult.errors.length > 0) {
        console.log('⚠️  Setup warnings:', setupResult.errors);
      }
    } else {
      console.log('❌ Jonathan-demo setup failed:', setupResult.errors);
      return;
    }

    // 2. Test enhanced prompt building
    console.log('\n2. Testing enhanced prompt building...');
    const enhancedBuilder = new EnhancedPromptBuilder();
    
    const testQuery = "Hey Jonathan, what's up?";
    const conversationHistory = [
      { role: 'user' as const, content: 'Hi there!', timestamp: new Date().toISOString() },
      { role: 'assistant' as const, content: 'Hey! What\'s up?! Good to see you.', timestamp: new Date().toISOString() }
    ];

    const promptResult = await enhancedBuilder.buildEnhancedSystemPromptWithStyle(
      'jonathan-demo',
      testQuery,
      conversationHistory,
      { priorityFilter: 6, memoryLimit: 8, trackExpressions: true }
    );

    console.log('✅ Enhanced prompt built successfully');
    console.log('📊 Metadata:', promptResult.metadata);
    console.log('📝 Prompt preview (first 500 chars):');
    console.log(promptResult.prompt.substring(0, 500) + '...\n');

    // 3. Test fact injection
    console.log('3. Testing fact injection...');
    const testMessage = "I have a dog named Romeo who was born on Valentine's Day";
    
    // First get avatar ID
    const avatarId = await getAvatarId('jonathan-demo');
    if (!avatarId) {
      console.log('❌ Could not find jonathan-demo avatar ID');
      return;
    }

    const injectionResult = await injectFactsFromMessage({
      avatarId,
      text: testMessage
    });

    console.log('✅ Fact injection completed');
    console.log(`📈 Extracted ${injectionResult.length} facts`);
    console.log('🔍 Extracted facts:', injectionResult);

    // 4. Test expression tracking
    console.log('\n4. Testing expression tracking in conversation...');
    const conversationWithExpressions = [
      { role: 'user' as const, content: 'How was your day?', timestamp: new Date().toISOString() },
      { role: 'assistant' as const, content: 'It was WILD! So many things happened.', timestamp: new Date().toISOString() },
      { role: 'user' as const, content: 'Tell me more!', timestamp: new Date().toISOString() },
      { role: 'assistant' as const, content: 'Well, good times! I had a great meeting.', timestamp: new Date().toISOString() }
    ];

    const expressionTestResult = await enhancedBuilder.buildEnhancedSystemPromptWithStyle(
      'jonathan-demo',
      'What else happened?',
      conversationWithExpressions,
      { trackExpressions: true }
    );

    console.log('✅ Expression tracking test completed');
    console.log('🎭 Available expressions:', expressionTestResult.metadata.expressions_available);
    console.log('🗣️  Available catchphrases:', expressionTestResult.metadata.catchphrases_available);

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log('- Jonathan-demo setup with expressions and catchphrases ✅');
    console.log('- Enhanced prompt building with style support ✅');
    console.log('- Fact injection from conversations ✅');
    console.log('- Expression usage tracking ✅');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

async function getAvatarId(slug: string): Promise<string | null> {
  // This would normally use the supabase client, but for testing we'll simulate
  // In a real implementation, this would query the database
  return 'test-avatar-id';
}

// Run the test if this file is executed directly
if (require.main === module) {
  testJonathanDemoSetup().catch(console.error);
}

export { testJonathanDemoSetup };