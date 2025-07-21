import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { hubId: string } }
) {
  const hubId = params.hubId;
  
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { hubId: string } }
) {
  try {
    const hubId = params.hubId;
    const body = await request.json();
    
    // Mock updating a hub
    const updatedHub = {
      id: hubId,
      ...body,
      updatedAt: new Date().toISOString()
    };
    
    return NextResponse.json({ success: true, hub: updatedHub });
  } catch (error) {
    console.error('Error updating hub:', error);
    return NextResponse.json({ error: 'Failed to update hub' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { hubId: string } }
) {
  try {
    const hubId = params.hubId;
    
    // Mock deleting a hub
    return NextResponse.json({ success: true, message: `Hub ${hubId} deleted successfully` });
  } catch (error) {
    console.error('Error deleting hub:', error);
    return NextResponse.json({ error: 'Failed to delete hub' }, { status: 500 });
  }
}