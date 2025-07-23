import { NextRequest, NextResponse } from 'next/server';
import { MemoryService } from '@/lib/memoryService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const avatarId = searchParams.get('avatarId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    console.log('[api/memories] GET request:', { userId, avatarId, limit, offset });

    const memories = await MemoryService.Retrieval.getUserMemories(userId, {
      limit,
      offset,
      avatarId: avatarId || undefined
    });

    const stats = await MemoryService.Retrieval.getMemoryStats(userId, avatarId || undefined);

    return NextResponse.json({
      success: true,
      memories,
      stats,
      pagination: {
        limit,
        offset,
        total: stats.totalFragments
      }
    });
  } catch (error: any) {
    console.error('[api/memories] GET error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to retrieve memories'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, avatarId, content, source } = body;

    if (!userId || !content) {
      return NextResponse.json({ error: 'userId and content are required' }, { status: 400 });
    }

    console.log('[api/memories] POST request:', { userId, avatarId, contentLength: content.length });

    // Create a memory fragment manually
    const fragment = {
      userId,
      avatarId: avatarId || 'default',
      fragmentText: content,
      conversationContext: {
        timestamp: new Date().toISOString(),
        messageContext: content,
        source: source || 'manual'
      }
    };

    const fragmentId = await MemoryService.Storage.storeMemoryFragment(fragment);

    return NextResponse.json({
      success: true,
      memoryId: fragmentId,
      message: 'Memory created successfully'
    });
  } catch (error: any) {
    console.error('[api/memories] POST error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to create memory'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, memoryId, avatarId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    console.log('[api/memories] DELETE request:', { userId, memoryId, avatarId });

    if (memoryId) {
      // Delete specific memory
      await MemoryService.Storage.deleteMemoryFragment(memoryId, userId);
      return NextResponse.json({
        success: true,
        message: 'Memory deleted successfully'
      });
    } else {
      // Delete all memories for user (optionally filtered by avatarId)
      await MemoryService.Storage.deleteAllUserMemories(userId, avatarId || undefined);
      return NextResponse.json({
        success: true,
        message: 'All memories deleted successfully'
      });
    }
  } catch (error: any) {
    console.error('[api/memories] DELETE error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to delete memories'
    }, { status: 500 });
  }
}

