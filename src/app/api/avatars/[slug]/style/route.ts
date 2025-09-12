import { NextRequest, NextResponse } from 'next/server';
import { AvatarOnboardingService } from '@/lib/services/avatarOnboardingService';

export async function PUT(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const body = await req.json();
    
    const { expressions, catchphrases, address_terms } = body;

    if (!expressions && !catchphrases && !address_terms) {
      return NextResponse.json({
        error: 'At least one of expressions, catchphrases, or address_terms must be provided'
      }, { status: 400 });
    }

    const result = await AvatarOnboardingService.updateAvatarStyle(slug, {
      expressions,
      catchphrases,
      address_terms
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Avatar ${slug} style updated successfully`,
        errors: result.errors
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Failed to update avatar style',
        errors: result.errors
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error updating avatar style:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  return NextResponse.json({
    message: `PUT to this endpoint to update style for avatar: ${params.slug}`,
    example: {
      expressions: ['what\'s up?!', 'it was WILD!', 'good times!'],
      catchphrases: ['man time flies', 'that\'s a trip'],
      address_terms: {
        male_friend: ['man', 'my man']
      }
    }
  });
}