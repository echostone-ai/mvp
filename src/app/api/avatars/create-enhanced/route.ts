import { NextResponse } from 'next/server';
import { AvatarOnboardingService, AvatarOnboardingData } from '@/lib/services/avatarOnboardingService';

/**
 * Enhanced Avatar Creation API - Creates avatars with natural conversation support
 * 
 * This endpoint creates avatars with the same friendly, personalized logic as jonathan-demo:
 * - Natural fact connection (e.g., "who's [pet name]?" gets proper responses)
 * - Expression and catchphrase management
 * - Smart conversation memory
 * - Organized fact presentation
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      name,
      speaking_style = 'Casual, warm, and personable',
      expressions = [],
      catchphrases = [],
      address_terms = {},
      core_facts = [],
      userId = 'demo'
    } = body;

    if (!name) {
      return NextResponse.json({ 
        error: 'Avatar name is required',
        example: {
          name: 'My Avatar',
          speaking_style: 'Friendly and enthusiastic',
          expressions: ['awesome!', 'that\'s great!'],
          catchphrases: ['no way!', 'totally'],
          address_terms: {
            male_friend: ['buddy', 'dude']
          },
          core_facts: [
            { key: 'full_name', value: 'Avatar Name', priority: 1 },
            { key: 'pet_name', value: 'Fluffy', priority: 2 },
            { key: 'pet_type', value: 'cat', priority: 3 }
          ]
        }
      }, { status: 400 });
    }

    const onboardingData: AvatarOnboardingData = {
      name,
      speaking_style,
      expressions: expressions.length > 0 ? expressions : undefined,
      catchphrases: catchphrases.length > 0 ? catchphrases : undefined,
      address_terms: Object.keys(address_terms).length > 0 ? address_terms : undefined,
      core_facts: core_facts.length > 0 ? core_facts : undefined
    };

    const result = await AvatarOnboardingService.createAvatarWithStyle(onboardingData, userId);

    if (result.success) {
      return NextResponse.json({
        success: true,
        avatarId: result.avatarId,
        message: `Avatar "${name}" created successfully with GPT-5 onboarding integration`,
        factCount: result.factCount,
        warnings: result.warnings.length > 0 ? result.warnings : undefined,
        features: [
          'Immediate fact availability for first conversation',
          'Validated fact categorization and prioritization',
          'Natural fact connection (e.g., pet names, family members)',
          'Expression and catchphrase management',
          'Smart conversation memory',
          'Organized fact presentation',
          'Context-aware responses',
          'Seamless transition from setup to conversation mode'
        ],
        errors: result.errors.length > 0 ? result.errors : undefined
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Failed to create avatar',
        errors: result.errors,
        warnings: result.warnings.length > 0 ? result.warnings : undefined,
        factCount: result.factCount
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Enhanced avatar creation error:', error);
    return NextResponse.json({
      error: 'Failed to create avatar',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Enhanced Avatar Creation API',
    description: 'Creates avatars with natural conversation support like jonathan-demo',
    features: [
      'Natural fact connection - avatars understand relationships between facts',
      'Expression management - avatars use expressions sparingly and naturally',
      'Smart name recognition - "who\'s [name]?" gets proper responses',
      'Organized fact presentation - facts grouped by category for better understanding',
      'Context-aware responses - avatars connect related information naturally'
    ],
    example_request: {
      name: 'Sarah',
      speaking_style: 'Warm, professional, with a touch of humor',
      expressions: [
        'that\'s fantastic!',
        'oh wow!',
        'absolutely!'
      ],
      catchphrases: [
        'you know what I mean?',
        'that\'s the thing'
      ],
      address_terms: {
        male_friend: ['buddy', 'my friend']
      },
      core_facts: [
        { key: 'full_name', value: 'Sarah Johnson', priority: 1 },
        { key: 'profession', value: 'Software Engineer', priority: 2 },
        { key: 'current_location', value: 'San Francisco, CA', priority: 2 },
        { key: 'pet_name', value: 'Whiskers', priority: 2 },
        { key: 'pet_type', value: 'tabby cat', priority: 3 },
        { key: 'hobby_primary', value: 'rock climbing', priority: 3 },
        { key: 'favorite_food', value: 'Thai cuisine', priority: 4 }
      ]
    },
    expected_behavior: {
      'who_is_whiskers': 'Whiskers is my tabby cat! She\'s such a sweetheart.',
      'do_you_have_pets': 'Yes! I have a tabby cat named Whiskers. She keeps me company.',
      'what_do_you_do': 'I\'m a software engineer here in San Francisco. I love building things that help people!',
      'expressions_usage': 'Uses "that\'s fantastic!" and other expressions naturally, not too frequently'
    }
  });
}