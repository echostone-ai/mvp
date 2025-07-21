import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Return mock data for demonstration
  const hubs = [
    {
      id: '1',
      name: 'Family Memories',
      description: 'A collection of family memories and stories',
      isPublished: true,
      createdAt: new Date().toISOString(),
      ownerId: 'user-123',
      _count: {
        memories: 5,
        viewers: 2
      }
    },
    {
      id: '2',
      name: 'Travel Adventures',
      description: 'Memories from my travels around the world',
      isPublished: false,
      createdAt: new Date().toISOString(),
      ownerId: 'user-123',
      _count: {
        memories: 10,
        viewers: 0
      }
    }
  ];

  return NextResponse.json({ hubs });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Mock creating a new hub
    const newHub = {
      id: Math.random().toString(36).substring(2, 9),
      ...body,
      createdAt: new Date().toISOString(),
      ownerId: 'user-123',
      _count: {
        memories: 0,
        viewers: 0
      }
    };
    
    return NextResponse.json({ success: true, hub: newHub }, { status: 201 });
  } catch (error) {
    console.error('Error creating hub:', error);
    return NextResponse.json({ error: 'Failed to create hub' }, { status: 500 });
  }
}