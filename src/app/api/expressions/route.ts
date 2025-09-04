import { NextRequest, NextResponse } from 'next/server';
import { ExpressionStorageService } from '@/lib/services/expressionStorageService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const avatarId = searchParams.get('avatarId');
    const ownerType = searchParams.get('ownerType') || 'avatar';
    
    if (!avatarId) {
      return NextResponse.json({ error: 'avatarId is required' }, { status: 400 });
    }

    console.log(`[ExpressionsAPI] Fetching expressions for avatar: ${avatarId}, ownerType: ${ownerType}`);
    
    // Get expressions from database
    const expressions = await ExpressionStorageService.getExpressionsByOwner(avatarId, ownerType as 'user' | 'avatar');
    
    console.log(`[ExpressionsAPI] Found ${expressions.length} expressions for ${avatarId}`);
    
    return NextResponse.json({
      success: true,
      expressions,
      count: expressions.length
    });
    
  } catch (error) {
    console.error('[ExpressionsAPI] Error fetching expressions:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      expressions: [],
      count: 0
    }, { status: 500 });
  }
}