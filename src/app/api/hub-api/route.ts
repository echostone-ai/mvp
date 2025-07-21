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
      // Get hub details
      const hub = {
        id: hubId,
        name: hubId === 'example-1' ? 'Family Memories' : 'Travel Adventures',
        description: hubId === 'example-1' 
          ? 'A collection of family memories and stories from our adventures together.'
          : 'Memories from my travels around the world.',
        isPublished: hubId === 'example-1',
        createdAt: new Date().toISOString(),
        ownerId: 'user-123',
        _count: {
          memories: hubId === 'example-1' ? 5 : 10,
          viewers: hubId === 'example-1' ? 2 : 0
        }
      };
      return NextResponse.json({ hub });
      
    case 'memories':
      // Get memories for this hub
      const memories = [];
      if (hubId === 'example-1') {
        memories.push(
          {
            id: '1',
            title: 'Summer Vacation 2023',
            content: 'We had an amazing time at the beach house. The kids loved building sandcastles and swimming in the ocean.',
            createdAt: '2023-07-15T12:00:00Z',
            createdBy: 'John Doe'
          },
          {
            id: '2',
            title: 'Grandma\'s Birthday',
            content: 'We celebrated Grandma\'s 80th birthday with a surprise party. Everyone from the family was there!',
            createdAt: '2023-05-22T14:30:00Z',
            createdBy: 'Jane Smith'
          }
        );
      }
      return NextResponse.json({ memories });
      
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