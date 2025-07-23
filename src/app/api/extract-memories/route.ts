import { NextRequest, NextResponse } from 'next/server';
import { MemoryService } from '@/lib/memoryService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, userId, avatarId, conversationContext, extractionThreshold } = body;

    if (!message || !userId) {
      return NextResponse.json({ 
        error: 'message and userId are required' 
      }, { status: 400 });
    }

    console.log('[api/extract-memories] Processing message:', { 
      userId, 
      avatarId, 
      messageLength: message.length 
    });

    // Extract memory fragments from the message
    const fragments = await MemoryService.Extraction.extractMemoryFragments(
      message,
      userId,
      conversationContext || {
        timestamp: new Date().toISOString(),
        messageContext: message,
        avatarId: avatarId || 'default'
      },
      extractionThreshold
    );

    console.log(`[api/extract-memories] Extracted ${fragments.length} memory fragments`);

    return NextResponse.json({
      success: true,
      fragments,
      count: fragments.length
    });
  } catch (error: any) {
    console.error('[api/extract-memories] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to extract memories'
    }, { status: 500 });
  }
}

