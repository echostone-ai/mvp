import { NextRequest, NextResponse } from 'next/server';

// API endpoint for managing private conversations with shared avatars
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'create':
        // Create a new conversation
        const { userId, avatarId, shareToken, initialMessage } = data;
        
        if (!userId || !avatarId) {
          return NextResponse.json({ 
            error: 'User ID and Avatar ID are required' 
          }, { status: 400 });
        }

        // Generate a new conversation ID
        const conversationId = Math.random().toString(36).substring(2, 15);
        
        // Create conversation record (in real app, this would be saved to database)
        const newConversation = {
          id: conversationId,
          userId,
          avatarId,
          shareToken: shareToken || null, // Track if this is a shared avatar conversation
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: initialMessage ? [
            {
              id: Math.random().toString(36).substring(2, 15),
              role: 'user',
              content: initialMessage,
              timestamp: new Date().toISOString()
            }
          ] : [],
          messageCount: initialMessage ? 1 : 0
        };

        return NextResponse.json({ 
          success: true, 
          conversation: newConversation
        });

      case 'add-message':
        // Add a message to an existing conversation
        const { conversationId: convId, message } = data;
        
        if (!convId || !message || !message.content || !message.role) {
          return NextResponse.json({ 
            error: 'Conversation ID and valid message are required' 
          }, { status: 400 });
        }

        // In a real app, you would:
        // 1. Validate the conversation exists and user has access
        // 2. Add message to database
        // 3. Update conversation metadata

        const newMessage = {
          id: Math.random().toString(36).substring(2, 15),
          ...message,
          timestamp: new Date().toISOString()
        };

        return NextResponse.json({ 
          success: true, 
          message: newMessage,
          conversationId: convId
        });

      case 'get-conversation':
        // Get a specific conversation
        const { conversationId: requestedConvId, userId: requestingUserId } = data;
        
        if (!requestedConvId || !requestingUserId) {
          return NextResponse.json({ 
            error: 'Conversation ID and User ID are required' 
          }, { status: 400 });
        }

        // Mock conversation data (in real app, fetch from database)
        const conversation = {
          id: requestedConvId,
          userId: requestingUserId,
          avatarId: 'avatar-jonathan',
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:30:00Z',
          messages: [
            {
              id: '1',
              role: 'user',
              content: 'Hi Jonathan, tell me about your travels.',
              timestamp: '2024-01-15T10:00:00Z'
            },
            {
              id: '2',
              role: 'assistant',
              content: 'I\'ve been to over 30 countries! My favorites include Bulgaria, Japan, and New Zealand. Each place has its own unique charm and stories.',
              timestamp: '2024-01-15T10:00:30Z'
            },
            {
              id: '3',
              role: 'user',
              content: 'Tell me more about Bulgaria.',
              timestamp: '2024-01-15T10:15:00Z'
            },
            {
              id: '4',
              role: 'assistant',
              content: 'Bulgaria is amazing! Sofia has this incredible mix of ancient history and modern city life. The food is fantastic - banitsa for breakfast became my daily ritual. And the people are so welcoming!',
              timestamp: '2024-01-15T10:15:30Z'
            }
          ],
          messageCount: 4
        };

        return NextResponse.json({ 
          success: true, 
          conversation
        });

      case 'list-conversations':
        // List all conversations for a user with a specific avatar
        const { userId: listUserId, avatarId: listAvatarId, shareToken: listShareToken } = data;
        
        if (!listUserId) {
          return NextResponse.json({ 
            error: 'User ID is required' 
          }, { status: 400 });
        }

        // Mock conversation list (in real app, query from database)
        const conversations = [
          {
            id: 'conv-1',
            userId: listUserId,
            avatarId: listAvatarId || 'avatar-jonathan',
            shareToken: listShareToken || null,
            createdAt: '2024-01-15T10:00:00Z',
            updatedAt: '2024-01-15T10:30:00Z',
            lastMessage: 'Tell me more about Bulgaria.',
            lastResponse: 'Bulgaria is amazing! Sofia has this incredible mix of ancient history and modern city life...',
            messageCount: 4
          },
          {
            id: 'conv-2',
            userId: listUserId,
            avatarId: listAvatarId || 'avatar-jonathan',
            shareToken: listShareToken || null,
            createdAt: '2024-01-10T14:00:00Z',
            updatedAt: '2024-01-10T14:45:00Z',
            lastMessage: 'What foods do you recommend in Japan?',
            lastResponse: 'Oh, Japanese cuisine is incredible! Beyond just sushi, you should try okonomiyaki in Osaka...',
            messageCount: 8
          }
        ];

        return NextResponse.json({ 
          success: true, 
          conversations
        });

      case 'delete':
        // Delete a conversation
        const { conversationId: deleteConvId, userId: deleteUserId } = data;
        
        if (!deleteConvId || !deleteUserId) {
          return NextResponse.json({ 
            error: 'Conversation ID and User ID are required' 
          }, { status: 400 });
        }

        // In a real app, validate ownership and delete from database

        return NextResponse.json({ 
          success: true, 
          message: 'Conversation deleted successfully'
        });

      default:
        return NextResponse.json({ 
          error: 'Invalid action' 
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Private conversation error:', error);
    return NextResponse.json({ 
      error: 'Failed to process conversation request' 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  const avatarId = url.searchParams.get('avatarId');
  const shareToken = url.searchParams.get('shareToken');
  const conversationId = url.searchParams.get('conversationId');

  if (!userId) {
    return NextResponse.json({ 
      error: 'User ID is required' 
    }, { status: 400 });
  }

  if (conversationId) {
    // Get specific conversation
    // Mock conversation data (in real app, fetch from database)
    const conversation = {
      id: conversationId,
      userId,
      avatarId: avatarId || 'avatar-jonathan',
      shareToken: shareToken || null,
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:30:00Z',
      messages: [
        {
          id: '1',
          role: 'user',
          content: 'Hi Jonathan, tell me about your travels.',
          timestamp: '2024-01-15T10:00:00Z'
        },
        {
          id: '2',
          role: 'assistant',
          content: 'I\'ve been to over 30 countries! My favorites include Bulgaria, Japan, and New Zealand. Each place has its own unique charm and stories.',
          timestamp: '2024-01-15T10:00:30Z'
        }
      ],
      messageCount: 2
    };

    return NextResponse.json({ 
      success: true, 
      conversation
    });
  } else {
    // List conversations
    // Mock conversation list (in real app, query from database)
    const conversations = [
      {
        id: 'conv-1',
        userId,
        avatarId: avatarId || 'avatar-jonathan',
        shareToken: shareToken || null,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:30:00Z',
        lastMessage: 'Tell me more about Bulgaria.',
        lastResponse: 'Bulgaria is amazing! Sofia has this incredible mix of ancient history and modern city life...',
        messageCount: 4
      }
    ];

    return NextResponse.json({ 
      success: true, 
      conversations
    });
  }
}