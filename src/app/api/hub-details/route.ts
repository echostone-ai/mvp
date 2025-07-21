import { NextRequest, NextResponse } from 'next/server';

// Simple route handler without dynamic segments
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const hubId = url.searchParams.get('id');
  
  if (!hubId) {
    return NextResponse.json({ error: 'Hub ID is required' }, { status: 400 });
  }
  
  // Mock hub data
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
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { hubId, ...updates } = body;
    
    if (!hubId) {
      return NextResponse.json({ error: 'Hub ID is required' }, { status: 400 });
    }
    
    // Mock updating a hub
    const updatedHub = {
      id: hubId,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    return NextResponse.json({ success: true, hub: updatedHub });
  } catch (error) {
    console.error('Error updating hub:', error);
    return NextResponse.json({ error: 'Failed to update hub' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const url = new URL(request.url);
  const hubId = url.searchParams.get('id');
  
  if (!hubId) {
    return NextResponse.json({ error: 'Hub ID is required' }, { status: 400 });
  }
  
  // Mock deleting a hub
  return NextResponse.json({ success: true, message: `Hub ${hubId} deleted successfully` });
}