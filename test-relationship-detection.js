/**
 * Test script for relationship detection and personalization
 */

const { relationshipPersonalizationService } = require('./src/lib/services/relationshipPersonalizationService.ts');

async function testRelationshipDetection() {
  console.log('🧪 Testing Relationship Detection and Personalization\n');

  const testCases = [
    {
      message: "Hey! It's your brother!",
      expected: "Geoff Braden (Boris)"
    },
    {
      message: "Hi, it's me, Tyler",
      expected: "Tyler McCoy (T)"
    },
    {
      message: "It's Krissy, your girlfriend",
      expected: "Krissy (babe)"
    },
    {
      message: "This is Eric from New York",
      expected: "Eric (E)"
    },
    {
      message: "Hey dad, how are you?",
      expected: "Eric Braden (Dad)"
    },
    {
      message: "Hi mom!",
      expected: "Mary Braden (Mom)"
    },
    {
      message: "Just a random person saying hello",
      expected: "No detection"
    }
  ];

  for (const testCase of testCases) {
    console.log(`📝 Testing: "${testCase.message}"`);
    
    const detectedPerson = relationshipPersonalizationService.detectKnownPerson(testCase.message);
    const personalizationContext = relationshipPersonalizationService.generatePersonalizationContext(
      testCase.message,
      detectedPerson
    );

    if (detectedPerson) {
      console.log(`✅ Detected: ${detectedPerson.name} (${detectedPerson.nickname || 'no nickname'})`);
      console.log(`   Relationship: ${detectedPerson.relationship}`);
      console.log(`   Intimacy Level: ${personalizationContext.intimacyLevel}`);
      console.log(`   Personalized Greeting: "${personalizationContext.personalizedGreeting}"`);
      
      if (personalizationContext.conversationStarters?.length > 0) {
        console.log(`   Conversation Starters: ${personalizationContext.conversationStarters.slice(0, 2).join(', ')}`);
      }
    } else {
      console.log(`❌ No person detected`);
    }
    
    console.log('');
  }

  // Test system prompt generation
  console.log('🎭 Testing System Prompt Generation\n');
  
  const brotherDetection = relationshipPersonalizationService.detectKnownPerson("Hey! It's your brother!");
  const brotherContext = relationshipPersonalizationService.generatePersonalizationContext(
    "Hey! It's your brother!",
    brotherDetection
  );
  
  if (brotherDetection) {
    const systemPromptAddition = relationshipPersonalizationService.generateSystemPromptAddition(brotherContext);
    console.log('System Prompt Addition for Brother:');
    console.log(systemPromptAddition);
  }

  console.log('\n✨ Relationship detection test completed!');
}

// Run the test
testRelationshipDetection().catch(console.error);