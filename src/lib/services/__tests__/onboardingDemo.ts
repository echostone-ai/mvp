/**
 * Onboarding Integration Demo
 * 
 * Demonstrates the complete onboarding integration without requiring database access.
 * Shows how facts are validated, categorized, and prepared for immediate conversation use.
 */

import { MemoryInjectionService } from '../memoryInjectionService';

// Demo data representing a typical onboarding scenario
const demoOnboardingData = {
  name: 'Sarah Johnson',
  speaking_style: 'Warm, professional, with a touch of humor',
  expressions: [
    'that\'s fantastic!',
    'oh wow!',
    'absolutely!',
    'I love that!',
    'how exciting!'
  ],
  catchphrases: [
    'you know what I mean?',
    'that\'s the thing',
    'exactly right'
  ],
  address_terms: {
    male_friend: ['buddy', 'my friend', 'dude']
  },
  core_facts: [
    { key: 'full_name', value: 'Sarah Johnson', priority: 1 },
    { key: 'profession', value: 'Software Engineer', priority: 2 },
    { key: 'current_location', value: 'San Francisco, CA', priority: 2 },
    { key: 'pet_name', value: 'Whiskers', priority: 2 },
    { key: 'pet_type', value: 'tabby cat', priority: 3 },
    { key: 'hobby_primary', value: 'rock climbing', priority: 3 },
    { key: 'favorite_food', value: 'Thai cuisine', priority: 4 },
    { key: 'birth_year', value: '1990', priority: 4 }
  ]
};

/**
 * Demonstrate fact validation and categorization
 */
function demonstrateFactValidation() {
  console.log('=== FACT VALIDATION DEMO ===\n');
  
  // Prepare all facts for validation
  const allFacts = [
    ...demoOnboardingData.core_facts,
    { key: 'speaking_style', value: demoOnboardingData.speaking_style },
    { key: 'address_male_friend', value: demoOnboardingData.address_terms.male_friend.join(' | ') },
    ...demoOnboardingData.expressions.slice(0, 3).map((expr, i) => ({
      key: `expression_${expr.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`,
      value: expr
    })),
    ...demoOnboardingData.catchphrases.slice(0, 3).map((phrase, i) => ({
      key: `catchphrase_${phrase.split(' ')[0].toLowerCase()}`,
      value: phrase
    }))
  ];

  console.log('Input facts:');
  allFacts.forEach((fact, i) => {
    console.log(`  ${i + 1}. ${fact.key}: "${fact.value}" (priority: ${fact.priority || 'auto'})`);
  });

  // Validate facts
  const validation = MemoryInjectionService.validateOnboardingFacts(allFacts);

  console.log('\nValidation Results:');
  console.log(`  Valid: ${validation.isValid}`);
  console.log(`  Errors: ${validation.errors.length}`);
  console.log(`  Warnings: ${validation.warnings.length}`);
  console.log(`  Categorized facts: ${validation.categorizedFacts.length}`);

  if (validation.errors.length > 0) {
    console.log('\nErrors:');
    validation.errors.forEach(error => console.log(`  - ${error}`));
  }

  if (validation.warnings.length > 0) {
    console.log('\nWarnings:');
    validation.warnings.forEach(warning => console.log(`  - ${warning}`));
  }

  console.log('\nCategorized Facts:');
  const categories = ['identity', 'style', 'relationships', 'general'];
  categories.forEach(category => {
    const categoryFacts = validation.categorizedFacts.filter(f => f.category === category);
    if (categoryFacts.length > 0) {
      console.log(`\n  ${category.toUpperCase()}:`);
      categoryFacts
        .sort((a, b) => a.priority - b.priority)
        .forEach(fact => {
          console.log(`    ${fact.key}: "${fact.value}" (priority: ${fact.priority}, confidence: ${fact.confidence})`);
        });
    }
  });

  return validation;
}

/**
 * Demonstrate context preparation for first conversation
 */
function demonstrateContextPreparation() {
  console.log('\n\n=== CONTEXT PREPARATION DEMO ===\n');

  // Simulate the facts that would be stored in the database
  const storedFacts = [
    { key: 'full_name', value: 'Sarah Johnson', priority: 1, confidence: 1.0, created_at: new Date().toISOString() },
    { key: 'speaking_style', value: 'Warm, professional, with a touch of humor', priority: 1, confidence: 1.0, created_at: new Date().toISOString() },
    { key: 'profession', value: 'Software Engineer', priority: 2, confidence: 1.0, created_at: new Date().toISOString() },
    { key: 'current_location', value: 'San Francisco, CA', priority: 2, confidence: 1.0, created_at: new Date().toISOString() },
    { key: 'pet_name', value: 'Whiskers', priority: 2, confidence: 1.0, created_at: new Date().toISOString() },
    { key: 'pet_type', value: 'tabby cat', priority: 3, confidence: 1.0, created_at: new Date().toISOString() },
    { key: 'hobby_primary', value: 'rock climbing', priority: 3, confidence: 1.0, created_at: new Date().toISOString() },
    { key: 'expression_that_s_fantastic', value: 'that\'s fantastic!', priority: 4, confidence: 1.0, created_at: new Date().toISOString() },
    { key: 'catchphrase_you_know', value: 'you know what I mean?', priority: 4, confidence: 1.0, created_at: new Date().toISOString() },
    { key: 'address_male_friend', value: 'buddy | my friend | dude', priority: 4, confidence: 1.0, created_at: new Date().toISOString() }
  ];

  // Create a mock context preparation (without database calls)
  const contextSections: string[] = [];

  // Core identity section
  const coreIdentityFacts = storedFacts.filter(f => f.priority <= 2);
  if (coreIdentityFacts.length > 0) {
    contextSections.push('=== CORE IDENTITY ===');
    coreIdentityFacts.forEach(fact => {
      contextSections.push(`${fact.key}: ${fact.value}`);
    });
    contextSections.push('');
  }

  // Style and personality section
  const styleFacts = storedFacts.filter(f => 
    f.key.includes('speaking_style') || 
    f.key.includes('expression_') || 
    f.key.includes('catchphrase_') ||
    f.key.includes('address_')
  );
  
  if (styleFacts.length > 0) {
    contextSections.push('=== PERSONALITY & STYLE ===');
    styleFacts.forEach(fact => {
      contextSections.push(`${fact.key}: ${fact.value}`);
    });
    contextSections.push('');
  }

  // Other contextual facts
  const otherFacts = storedFacts.filter(f => 
    f.priority > 2 && 
    !f.key.includes('expression_') && 
    !f.key.includes('catchphrase_') &&
    !f.key.includes('address_') &&
    !f.key.includes('speaking_style')
  );

  if (otherFacts.length > 0) {
    contextSections.push('=== ADDITIONAL CONTEXT ===');
    otherFacts.forEach(fact => {
      contextSections.push(`${fact.key}: ${fact.value}`);
    });
    contextSections.push('');
  }

  // First conversation instructions
  contextSections.push('=== FIRST CONVERSATION INSTRUCTIONS ===');
  contextSections.push('- This is your first conversation after setup');
  contextSections.push('- You already know all the information above - do not ask for it again');
  contextSections.push('- Reference your knowledge naturally to show you remember the setup');
  contextSections.push('- Be warm and welcoming, showing you\'re ready to have meaningful conversations');
  contextSections.push('- If asked about yourself, confidently share what you know');

  const context = contextSections.join('\n');

  console.log('Generated Context for First Conversation:');
  console.log('─'.repeat(60));
  console.log(context);
  console.log('─'.repeat(60));

  console.log(`\nContext Statistics:`);
  console.log(`  Total length: ${context.length} characters`);
  console.log(`  Total facts: ${storedFacts.length}`);
  console.log(`  Core identity facts: ${coreIdentityFacts.length}`);
  console.log(`  Style facts: ${styleFacts.length}`);
  console.log(`  Additional facts: ${otherFacts.length}`);

  return { context, factCount: storedFacts.length };
}

/**
 * Demonstrate the complete onboarding flow
 */
function demonstrateCompleteFlow() {
  console.log('\n\n=== COMPLETE ONBOARDING FLOW DEMO ===\n');

  console.log('1. Avatar Setup Data:');
  console.log(`   Name: ${demoOnboardingData.name}`);
  console.log(`   Speaking Style: ${demoOnboardingData.speaking_style}`);
  console.log(`   Expressions: ${demoOnboardingData.expressions.length} provided`);
  console.log(`   Catchphrases: ${demoOnboardingData.catchphrases.length} provided`);
  console.log(`   Core Facts: ${demoOnboardingData.core_facts.length} provided`);

  console.log('\n2. Fact Validation & Categorization:');
  const validation = demonstrateFactValidation();

  console.log('\n3. Context Preparation for First Conversation:');
  const { context, factCount } = demonstrateContextPreparation();

  console.log('\n4. Readiness Assessment:');
  const readinessChecks = {
    factsValidated: validation.isValid,
    contextGenerated: context.length > 0,
    coreIdentityPresent: context.includes('CORE IDENTITY'),
    personalityStylePresent: context.includes('PERSONALITY & STYLE'),
    instructionsIncluded: context.includes('FIRST CONVERSATION INSTRUCTIONS'),
    nameIncluded: context.includes('Sarah Johnson'),
    petIncluded: context.includes('Whiskers'),
    professionIncluded: context.includes('Software Engineer')
  };

  console.log('   Readiness Checks:');
  Object.entries(readinessChecks).forEach(([check, passed]) => {
    console.log(`     ${check}: ${passed ? '✅' : '❌'}`);
  });

  const allChecksPassed = Object.values(readinessChecks).every(check => check === true);
  
  console.log(`\n   Overall Status: ${allChecksPassed ? '✅ READY FOR FIRST CONVERSATION' : '❌ NOT READY'}`);

  if (allChecksPassed) {
    console.log('\n5. Sample First Conversation Scenarios:');
    console.log('\n   User: "Hi! What\'s your name?"');
    console.log('   Expected Response: "Hi there! I\'m Sarah Johnson. It\'s great to meet you!"');
    
    console.log('\n   User: "Do you have any pets?"');
    console.log('   Expected Response: "Yes! I have a tabby cat named Whiskers. She\'s such a sweetheart."');
    
    console.log('\n   User: "What do you do for work?"');
    console.log('   Expected Response: "I\'m a software engineer here in San Francisco. I love building things that help people!"');
    
    console.log('\n   User: "What do you like to do for fun?"');
    console.log('   Expected Response: "I\'m really into rock climbing! There are some amazing spots around the Bay Area. That\'s fantastic exercise and such a rush!"');
  }

  return {
    validation,
    context,
    factCount,
    readinessChecks,
    ready: allChecksPassed
  };
}

// Run the demonstration
if (require.main === module) {
  console.log('🚀 AVATAR ONBOARDING INTEGRATION DEMONSTRATION\n');
  console.log('This demo shows how the GPT-5 avatar onboarding system works:');
  console.log('- Validates and categorizes setup facts');
  console.log('- Prepares context for immediate first conversation');
  console.log('- Ensures seamless transition from setup to conversation\n');

  const result = demonstrateCompleteFlow();

  console.log('\n📊 SUMMARY:');
  console.log(`   Facts processed: ${result.factCount}`);
  console.log(`   Validation passed: ${result.validation.isValid}`);
  console.log(`   Context ready: ${result.context.length > 0}`);
  console.log(`   Ready for conversation: ${result.ready}`);
  
  if (result.ready) {
    console.log('\n🎉 SUCCESS: Avatar is ready for personalized conversations immediately after onboarding!');
  } else {
    console.log('\n⚠️  Issues detected that need to be resolved before first conversation.');
  }
}

export {
  demonstrateFactValidation,
  demonstrateContextPreparation,
  demonstrateCompleteFlow
};