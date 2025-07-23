import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAvatars } from '@/lib/services/avatarService';

/**
 * API endpoint for listing avatars
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    
    // Call the service function with the userId parameter
    return getAvatars({ userId: userId || undefined }, request);
  } catch (error) {
    console.error('Error in avatars API:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}