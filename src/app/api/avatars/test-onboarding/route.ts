import { NextResponse } from 'next/server';
import { AvatarOnboardingService } from '@/lib/services/avatarOnboardingService';
import { MemoryInjectionService } from '@/lib/services/memoryInjectionService';

/**
 * Test Onboarding Integration API
 * 
 * Tests the complete onboarding flow to ensure facts are immediately available
 * for the first conversation and properly categorized/prioritized.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { testType = 'full', userId = 'test_user' } = body;

    if (testType === 'validation') {
      return await testFactValidation(body);
    } else if (testType === 'context') {
      return await testContextPreparation(body);
    } else {
      return await testFullOnboardingFlow(body, userId);
    }

  } catch (error) {
    console.error('Onboarding test error:', error);
    return NextResponse.json({
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function testFactValidation(body: any) {
  const { facts = [] } = body;
  
  const testFacts = facts.length > 0 ? facts : [
    { key: 'full_name', value: 'Test Avatar', priority: 1 },
    { key: 'speaking_style', value: 'Friendly and casual' },
    { key: 'pet_name', value: 'Buddy', priority: 2 },
    { key: 'pet_type', value: 'golden retriever', priority: 3 },
    { key: 'invalid_priority', value: 'test', priority: 15 }, // Should fail
    { key: 'invalid_confidence', value: 'test', confidence: 1.5 } // Should fail
  ];

  const validation = MemoryInjectionService.validateOnboardingFacts(testFacts);

  return NextResponse.json({
    test: 'fact_validation',
    input: testFacts,
    result: validation,
    summary: {
      totalFacts: testFacts.length,
      validFacts: validation.categorizedFacts.length,
      errors: validation.errors.length,
      warnings: validation.warnings.length,
      passed: validation.isValid
    }
  });
}

async function testContextPreparation(body: any) {
  const { avatarId } = body;
  
  if (!avatarId) {
    return NextResponse.json({
      error: 'avatarId is required for context test'
    }, { status: 400 });
  }

  const onboardingData = {
    name: 'Test Avatar',
    speaking_style: 'Warm and friendly',
    expressions: ['awesome!', 'that\'s great!'],
    catchphrases: ['you know what I mean?'],
    address_terms: { male_friend: ['buddy', 'friend'] },
    core_facts: [
      { key: 'full_name', value: 'Test Avatar', priority: 1 },
      { key: 'pet_name', value: 'Max', priority: 2 }
    ]
  };

  const { context, factCount, errors } = await MemoryInjectionService.prepareOnboardingContext(
    avatarId, 
    onboardingData
  );

  return NextResponse.json({
    test: 'context_preparation',
    avatarId,
    result: {
      context,
      factCount,
      errors,
      contextLength: context.length,
      hasInstructions: context.includes('FIRST CONVERSATION INSTRUCTIONS'),
      hasCoreIdentity: context.includes('CORE IDENTITY'),
      hasPersonalityStyle: context.includes('PERSONALITY & STYLE')
    },
    summary: {
      passed: errors.length === 0 && factCount > 0 && context.length > 0
    }
  });
}

async function testFullOnboardingFlow(body: any, userId: string) {
  const testData = {
    name: `test-avatar-${Date.now()}`,
    speaking_style: 'Casual, warm, and personable with a touch of humor',
    expressions: [
      'that\'s fantastic!',
      'oh wow!',
      'absolutely!'
    ],
    catchphrases: [
      'you know what I mean?',
      'that\'s the thing',
      'wild!'
    ],
    address_terms: {
      male_friend: ['buddy', 'my friend', 'dude']
    },
    core_facts: [
      { key: 'full_name', value: 'Test Avatar Johnson', priority: 1 },
      { key: 'profession', value: 'Software Tester', priority: 2 },
      { key: 'current_location', value: 'Test City, TC', priority: 2 },
      { key: 'pet_name', value: 'TestPet', priority: 2 },
      { key: 'pet_type', value: 'test breed', priority: 3 },
      { key: 'hobby_primary', value: 'testing software', priority: 3 },
      { key: 'favorite_food', value: 'test cuisine', priority: 4 }
    ],
    ...body // Allow override from request
  };

  // Step 1: Create avatar with onboarding
  const createResult = await AvatarOnboardingService.createAvatarWithStyle(testData, userId);

  if (!createResult.success) {
    return NextResponse.json({
      test: 'full_onboarding_flow',
      step: 'avatar_creation',
      passed: false,
      error: 'Avatar creation failed',
      details: createResult
    }, { status: 500 });
  }

  // Step 2: Test immediate fact availability
  const { context, factCount, errors } = await MemoryInjectionService.prepareOnboardingContext(
    createResult.avatarId,
    testData
  );

  // Step 3: Validate context quality
  const contextTests = {
    hasContent: context.length > 0,
    hasCoreIdentity: context.includes('CORE IDENTITY'),
    hasPersonalityStyle: context.includes('PERSONALITY & STYLE'),
    hasInstructions: context.includes('FIRST CONVERSATION INSTRUCTIONS'),
    factsAvailable: factCount > 0,
    noErrors: errors.length === 0,
    includesName: context.includes('Test Avatar Johnson'),
    includesPet: context.includes('TestPet'),
    includesStyle: context.includes('Casual, warm, and personable')
  };

  const allTestsPassed = Object.values(contextTests).every(test => test === true);

  return NextResponse.json({
    test: 'full_onboarding_flow',
    passed: allTestsPassed,
    steps: {
      avatar_creation: {
        passed: createResult.success,
        avatarId: createResult.avatarId,
        factCount: createResult.factCount,
        errors: createResult.errors,
        warnings: createResult.warnings
      },
      context_preparation: {
        passed: errors.length === 0 && factCount > 0,
        factCount,
        contextLength: context.length,
        errors
      },
      context_validation: {
        passed: allTestsPassed,
        tests: contextTests
      }
    },
    summary: {
      totalFactsStored: createResult.factCount,
      factsAvailableForConversation: factCount,
      contextReady: allTestsPassed,
      readyForFirstConversation: allTestsPassed && createResult.success
    },
    sampleContext: context.substring(0, 500) + (context.length > 500 ? '...' : '')
  });
}

export async function GET() {
  return NextResponse.json({
    message: 'Onboarding Integration Test API',
    description: 'Tests the complete avatar onboarding flow for GPT-5 integration',
    endpoints: {
      'POST /': 'Run full onboarding test',
      'POST / with testType=validation': 'Test fact validation only',
      'POST / with testType=context': 'Test context preparation only (requires avatarId)'
    },
    test_examples: {
      full_test: {
        method: 'POST',
        body: {
          testType: 'full',
          userId: 'test_user'
        }
      },
      validation_test: {
        method: 'POST',
        body: {
          testType: 'validation',
          facts: [
            { key: 'full_name', value: 'Test User', priority: 1 },
            { key: 'speaking_style', value: 'Friendly' }
          ]
        }
      },
      context_test: {
        method: 'POST',
        body: {
          testType: 'context',
          avatarId: 'your-avatar-id-here'
        }
      }
    },
    expected_behavior: {
      immediate_availability: 'Facts stored during onboarding are immediately available for first conversation',
      proper_categorization: 'Facts are automatically categorized and prioritized correctly',
      context_preparation: 'Context is properly formatted for GPT-5 consumption',
      seamless_transition: 'No gap between setup completion and conversation readiness'
    }
  });
}