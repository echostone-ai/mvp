import { NextRequest, NextResponse } from 'next/server';

// Unified API endpoint for hub operations
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const hubId = url.searchParams.get('hubId');
  const action = url.searchParams.get('action') || 'details';
  
  if (!hubId) {
    return NextResponse.json({ error: 'Hub ID is required' }, { status: 400 });
  }
  
  // Handle different actions
  switch (action) {
    case 'details':
      // Get hub details with published avatar info
      const hub = {
        id: hubId,
        name: hubId === 'example-1' ? 'Chat with Jonathan' : 'Meet Sarah',
        description: hubId === 'example-1' 
          ? 'Interact with Jonathan\'s digital avatar - ask him about his travels, experiences, and memories.'
          : 'Have a conversation with Sarah\'s avatar and learn about her life and stories.',
        isPublished: hubId === 'example-1',
        createdAt: new Date().toISOString(),
        ownerId: 'user-123',
        publishedAvatar: {
          id: hubId === 'example-1' ? 'avatar-jonathan' : 'avatar-sarah',
          name: hubId === 'example-1' ? 'Jonathan' : 'Sarah',
          voiceId: hubId === 'example-1' ? 'CO6pxVrMZfyL61ZIglyr' : null,
          profileData: hubId === 'example-1' ? { /* Jonathan's personality data */ } : {},
          hasVoice: hubId === 'example-1'
        },
        _count: {
          conversations: hubId === 'example-1' ? 12 : 3,
          visitors: hubId === 'example-1' ? 5 : 1
        }
      };
      return NextResponse.json({ hub });
      
    case 'conversations':
      // Get visitor conversations with the avatar
      const conversations = [];
      if (hubId === 'example-1') {
        conversations.push(
          {
            id: '1',
            visitorName: 'Emily',
            lastMessage: 'Tell me about your time in Bulgaria',
            avatarResponse: 'Sofia is such a beautiful city! I love the cobblestone streets and morning coffee culture...',
            createdAt: '2024-01-15T14:30:00Z',
            messageCount: 8
          },
          {
            id: '2',
            visitorName: 'Michael',
            lastMessage: 'What was your favorite travel destination?',
            avatarResponse: 'That\'s a tough question! Each place had its own magic, but I have a soft spot for...',
            createdAt: '2024-01-14T10:15:00Z',
            messageCount: 12
          }
        );
      }
      return NextResponse.json({ conversations });
      
    case 'invites':
      // Get invites for this hub
      return NextResponse.json({ invites: [] });
      
    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { hubId, action, ...data } = body;
    
    // Special case for hub creation which doesn't require a hubId
    if (action === 'create') {
      // Create a new hub
      const newHub = {
        id: Math.random().toString(36).substring(2, 9),
        name: data.name || 'Untitled Hub',
        description: data.description || '',
        isPublished: data.isPublished || false,
        createdAt: new Date().toISOString(),
        ownerId: 'user-123',
        _count: {
          memories: 0,
          viewers: 0
        }
      };
      
      return NextResponse.json({ success: true, hub: newHub }, { status: 201 });
    }
    
    // For all other actions, hubId is required
    if (!hubId) {
      return NextResponse.json({ error: 'Hub ID is required' }, { status: 400 });
    }
    
    // Handle different actions
    switch (action) {
      case 'update':
        // Update hub details
        const updatedHub = {
          id: hubId,
          ...data,
          updatedAt: new Date().toISOString()
        };
        return NextResponse.json({ success: true, hub: updatedHub });
        
      case 'add-memory':
        // Add a new memory
        const newMemory = {
          id: Math.random().toString(36).substring(2, 9),
          title: data.title || 'Untitled Memory',
          content: data.content || '',
          createdAt: new Date().toISOString(),
          createdBy: 'Current User'
        };
        return NextResponse.json({ success: true, memory: newMemory });
        
      case 'add-invite':
        // Add a new invite
        const newInvite = {
          id: Math.random().toString(36).substring(2, 9),
          email: data.email || '',
          hubId,
          status: 'pending',
          createdAt: new Date().toISOString()
        };
        return NextResponse.json({ success: true, invite: newInvite });
        
      case 'delete':
        // Delete the hub
        return NextResponse.json({ success: true, message: `Hub ${hubId} deleted successfully` });
        
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error processing hub request:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}