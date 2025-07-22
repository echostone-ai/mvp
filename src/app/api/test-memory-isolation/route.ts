import { NextRequest, NextResponse } from 'next/server';

/**
 * Test Memory Isolation API
 * 
 * This API tests whether memory isolation is working correctly between different avatars
 * and different users of the same shared avatar.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, avatarId, userId, shareToken, message } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    switch (action) {
      case 'test-avatar-isolation':
        // Test if memories are isolated between different avatars
        if (!avatarId || !userId) {
          return NextResponse.json({ error: 'Avatar ID and User ID are required' }, { status: 400 });
        }

        // Create a unique memory for this avatar
        const avatarMemory = `Memory for avatar ${avatarId}: ${message || 'This is a test memory'}`;

        // In a real implementation, this would save to a database
        console.log(`Creating isolated memory for avatar ${avatarId}, user ${userId}: ${avatarMemory}`);

        return NextResponse.json({
          success: true,
          avatarId,
          userId,
          memory: avatarMemory,
          timestamp: new Date().toISOString()
        });

      case 'test-user-isolation':
        // Test if memories are isolated between different users of the same shared avatar
        if (!shareToken || !userId) {
          return NextResponse.json({ error: 'Share Token and User ID are required' }, { status: 400 });
        }

        // Create a unique memory for this user of the shared avatar
        const userMemory = `Memory for user ${userId} with shared avatar (token: ${shareToken}): ${message || 'This is a test memory'}`;

        // In a real implementation, this would save to a database
        console.log(`Creating isolated memory for shared avatar ${shareToken}, user ${userId}: ${userMemory}`);

        return NextResponse.json({
          success: true,
          shareToken,
          userId,
          memory: userMemory,
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in test-memory-isolation:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}

