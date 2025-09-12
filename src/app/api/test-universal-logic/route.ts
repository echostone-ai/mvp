import { NextRequest, NextResponse } from 'next/server';
import { EnhancedPromptBuilder } from '@/lib/services/enhancedPromptBuilder';
import { AvatarOnboardingService } from '@/lib/services/avatarOnboardingService';

/**
 * Test endpoint to verify universal natural conversation logic
 * Creates a test avatar and shows how it handles natural queries
 */
export async function POST(req: NextRequest) {
  try {
    const { 
      avatarName = 'test-avatar',
      petName = 'Fluffy',
      petType = 'cat',
      testQuery = `who's ${petName}?`
    } = await req.json();

    // Create a test avatar with basic facts
    console.log(`Creating test avatar: ${avatarName}...`);
    const result = await AvatarOnboardingService.createAvatarWithStyle({
      name: avatarName,
      speaking_style: 'Friendly and warm',
      expressions: ['that\'s great!', 'awesome!'],
      catchphrases: ['you know', 'totally'],
      core_facts: [
        { key: 'full_name', value: 'Test Avatar', priority: 1 },
        { key: 'pet_name', value: petName, priority: 2 },
        { key: 'pet_type', value: petType, priority: 3 },
        { key: 'pet_description', value: `${petName} is my ${petType} and best friend`, priority: 3 }
      ]
    }, 'demo');

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: 'Failed to create test avatar',
        details: result.errors
      }, { status: 500 });
    }

    // Test the enhanced prompt builder
    const enhancedBuilder = new EnhancedPromptBuilder();
    const promptResult = await enhancedBuilder.buildEnhancedSystemPromptWithStyle(
      avatarName,
      testQuery,
      [],
      { priorityFilter: 6, memoryLimit: 8, trackExpressions: true }
    );

    // Check if the prompt includes natural response guidance
    const hasNaturalGuidance = promptResult.prompt.includes('Connect related facts naturally');
    const hasNameContext = promptResult.prompt.includes('QUERY CONTEXT');
    const hasPetFacts = promptResult.prompt.includes(petName);

    return NextResponse.json({
      success: true,
      message: 'Universal natural conversation logic test completed',
      test_results: {
        avatar_created: result.success,
        avatar_name: avatarName,
        test_query: testQuery,
        natural_guidance_included: hasNaturalGuidance,
        name_context_detected: hasNameContext,
        pet_facts_included: hasPetFacts,
        facts_count: promptResult.metadata.facts_count,
        expressions_available: promptResult.metadata.expressions_available,
        catchphrases_available: promptResult.metadata.catchphrases_available
      },
      expected_behavior: {
        query: testQuery,
        expected_response: `${petName} is my ${petType} and best friend! [Natural, warm response about the pet]`,
        not_expected: 'I don\'t have that yet'
      },
      prompt_preview: promptResult.prompt.substring(0, 1000) + '...',
      cleanup_note: `Test avatar "${avatarName}" was created. You may want to clean it up after testing.`
    });

  } catch (error) {
    console.error('Universal logic test error:', error);
    return NextResponse.json({
      success: false,
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Universal Natural Conversation Logic Test',
    description: 'Tests that any avatar gets the same natural conversation abilities as jonathan-demo',
    usage: 'POST to this endpoint to create a test avatar and verify natural conversation logic',
    example_request: {
      avatarName: 'my-test-avatar',
      petName: 'Buddy',
      petType: 'dog',
      testQuery: 'who\'s Buddy?'
    },
    what_it_tests: [
      'Avatar creation with natural conversation support',
      'Smart fact connection (pet names, relationships)',
      'Name-based query context detection',
      'Natural response guidance in prompts',
      'Expression and catchphrase management'
    ]
  });
}