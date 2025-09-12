import { NextResponse } from 'next/server';
import { AvatarOnboardingService } from '@/lib/services/avatarOnboardingService';

export async function POST() {
  try {
    const result = await AvatarOnboardingService.setupJonathanDemo();
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Jonathan-demo setup completed successfully',
        errors: result.errors
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Failed to setup Jonathan-demo',
        errors: result.errors
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error setting up Jonathan-demo:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to this endpoint to setup Jonathan-demo with expressions and catchphrases',
    expressions: [
      'what\'s up?!',
      'it was WILD!', 
      'good times!'
    ],
    catchphrases: [
      'man time flies',
      'that\'s a trip',
      'wild!'
    ]
  });
}