import { NextRequest, NextResponse } from 'next/server';

// API endpoint for managing private memories with shared avatars
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'create':
        // Create a new memory
        const { userId, avatarId, shareToken, content, source } = data;
        
        if (!userId || !avatarId || !content) {
          return NextResponse.json({ 
            error: 'User ID, Avatar ID, and content are required' 
          }, { status: 400 });
        }

        // Create memory record (in real app, this would be saved to database)
        const newMemory = {
          id: Math.random().toString(36).substring(2, 15),
          userId,
          avatarId,
          shareToken: shareToken || null, // Track if this is a shared avatar memory
          content,
          source: source || 'manual', // 'conversation', 'manual', etc.
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isPrivate: true // Always private for shared avatars
        };

        return NextResponse.json({ 
          success: true, 
          memory: newMemory
        });

      case 'update':
        // Update an existing memory
        const { memoryId, content: updatedContent } = data;
        
        if (!memoryId || !updatedContent) {
          return NextResponse.json({ 
            error: 'Memory ID and content are required' 
          }, { status: 400 });
        }

        // In a real app, you would:
        // 1. Validate the memory exists and user has access
        // 2. Update memory in database

        const updatedMemory = {
          id: memoryId,
          content: updatedContent,
          updatedAt: new Date().toISOString()
        };

        return NextResponse.json({ 
          success: true, 
          memory: updatedMemory
        });

      case 'get':
        // Get a specific memory
        const { memoryId: requestedMemoryId, userId: requestingUserId } = data;
        
        if (!requestedMemoryId || !requestingUserId) {
          return NextResponse.json({ 
            error: 'Memory ID and User ID are required' 
          }, { status: 400 });
        }

        // Mock memory data (in real app, fetch from database)
        const memory = {
          id: requestedMemoryId,
          userId: requestingUserId,
          avatarId: 'avatar-jonathan',
          content: 'Jonathan mentioned he lived in Bulgaria for 6 months and loved the local cuisine.',
          source: 'conversation',
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
          isPrivate: true
        };

        return NextResponse.json({ 
          success: true, 
          memory
        });

      case 'list':
        // List all memories for a user with a specific avatar
        const { userId: listUserId, avatarId: listAvatarId, shareToken: listShareToken } = data;
        
        if (!listUserId) {
          return NextResponse.json({ 
            error: 'User ID is required' 
          }, { status: 400 });
        }

        // Mock memory list (in real app, query from database)
        const memories = [
          {
            id: 'mem-1',
            userId: listUserId,
            avatarId: listAvatarId || 'avatar-jonathan',
            shareToken: listShareToken || null,
            content: 'Jonathan mentioned he lived in Bulgaria for 6 months and loved the local cuisine.',
            source: 'conversation',
            createdAt: '2024-01-15T10:00:00Z',
            updatedAt: '2024-01-15T10:00:00Z',
            isPrivate: true
          },
          {
            id: 'mem-2',
            userId: listUserId,
            avatarId: listAvatarId || 'avatar-jonathan',
            shareToken: listShareToken || null,
            content: 'Jonathan\'s favorite travel destination is Japan, particularly Kyoto.',
            source: 'conversation',
            createdAt: '2024-01-10T14:00:00Z',
            updatedAt: '2024-01-10T14:00:00Z',
            isPrivate: true
          }
        ];

        return NextResponse.json({ 
          success: true, 
          memories
        });

      case 'delete':
        // Delete a memory
        const { memoryId: deleteMemoryId, userId: deleteUserId } = data;
        
        if (!deleteMemoryId || !deleteUserId) {
          return NextResponse.json({ 
            error: 'Memory ID and User ID are required' 
          }, { status: 400 });
        }

        // In a real app, validate ownership and delete from database

        return NextResponse.json({ 
          success: true, 
          message: 'Memory deleted successfully'
        });

      default:
        return NextResponse.json({ 
          error: 'Invalid action' 
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Private memory error:', error);
    return NextResponse.json({ 
      error: 'Failed to process memory request' 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  const avatarId = url.searchParams.get('avatarId');
  const shareToken = url.searchParams.get('shareToken');
  const memoryId = url.searchParams.get('memoryId');

  if (!userId) {
    return NextResponse.json({ 
      error: 'User ID is required' 
    }, { status: 400 });
  }

  if (memoryId) {
    // Get specific memory
    // Mock memory data (in real app, fetch from database)
    const memory = {
      id: memoryId,
      userId,
      avatarId: avatarId || 'avatar-jonathan',
      shareToken: shareToken || null,
      content: 'Jonathan mentioned he lived in Bulgaria for 6 months and loved the local cuisine.',
      source: 'conversation',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
      isPrivate: true
    };

    return NextResponse.json({ 
      success: true, 
      memory
    });
  } else {
    // List memories
    // Mock memory list (in real app, query from database)
    const memories = [
      {
        id: 'mem-1',
        userId,
        avatarId: avatarId || 'avatar-jonathan',
        shareToken: shareToken || null,
        content: 'Jonathan mentioned he lived in Bulgaria for 6 months and loved the local cuisine.',
        source: 'conversation',
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
        isPrivate: true
      },
      {
        id: 'mem-2',
        userId,
        avatarId: avatarId || 'avatar-jonathan',
        shareToken: shareToken || null,
        content: 'Jonathan\'s favorite travel destination is Japan, particularly Kyoto.',
        source: 'conversation',
        createdAt: '2024-01-10T14:00:00Z',
        updatedAt: '2024-01-10T14:00:00Z',
        isPrivate: true
      }
    ];

    return NextResponse.json({ 
      success: true, 
      memories
    });
  }
}