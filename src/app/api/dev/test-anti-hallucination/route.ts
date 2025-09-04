import { NextRequest, NextResponse } from 'next/server';
import { EnhancedPromptBuilder } from '@/lib/services/enhancedPromptBuilder';

/**
 * Test endpoint to verify anti-hallucination rules are properly included in prompts
 */
export async function POST(req: NextRequest) {
  try {
    const { avatarSlug = 'jonathan-demo', query = 'tell me a story' } = await req.json();

    const enhancedBuilder = new EnhancedPromptBuilder();
    const result = await enhancedBuilder.buildEnhancedSystemPromptWithStyle(
      avatarSlug,
      query,
      [],
      { priorityFilter: 6, memoryLimit: 8, trackExpressions: true }
    );

    // Check if anti-hallucination rules are present
    const prompt = result.prompt;
    const hasAntiHallucinationRules = {
      has_critical_warning: prompt.includes('🚨 CRITICAL: NEVER MAKE UP STORIES'),
      has_memory_only_rule: prompt.includes('ONLY reference experiences from your Core Identity'),
      has_no_fictional_details: prompt.includes('Do NOT invent fictional details'),
      has_documented_only: prompt.includes('Stick to documented facts and memories ONLY'),
      has_style_rules: prompt.includes('ONLY use memories from your Relevant Memories section'),
      has_fallback_response: prompt.includes('I don\'t have specific memories about that to share')
    };

    const allRulesPresent = Object.values(hasAntiHallucinationRules).every(rule => rule);

    return NextResponse.json({
      success: true,
      avatar_slug: avatarSlug,
      query,
      anti_hallucination_check: hasAntiHallucinationRules,
      all_rules_present: allRulesPresent,
      prompt_preview: prompt.substring(0, 800) + '...',
      metadata: result.metadata,
      recommendation: allRulesPresent 
        ? 'All anti-hallucination rules are properly included'
        : 'Some anti-hallucination rules are missing - check prompt structure'
    });

  } catch (error) {
    console.error('Anti-hallucination test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Anti-Hallucination Test Endpoint',
    description: 'Tests that anti-hallucination rules are properly included in avatar prompts',
    usage: 'POST with avatarSlug and query to test prompt structure',
    example_request: {
      avatarSlug: 'jonathan-demo',
      query: 'tell me a story about your time in Austin'
    },
    expected_behavior: {
      with_memories: 'Should only reference actual memories from database',
      without_memories: 'Should say "I don\'t have specific memories about that to share"',
      never: 'Should never make up fictional stories, conversations, or details'
    }
  });
}