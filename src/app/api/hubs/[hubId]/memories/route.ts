import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { hubId: string } }
) {
  const hubId = params.hubId;
  
  // Mock memories data
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
}

export async function POST(
  request: NextRequest,
  { params }: { params: { hubId: string } }
) {
  try {
    const hubId = params.hubId;
    const body = await request.json();
    
    // Mock creating a new memory
    const newMemory = {
      id: Math.random().toString(36).substring(2, 9),
      ...body,
      createdAt: new Date().toISOString(),
      createdBy: 'Current User'
    };
    
    return NextResponse.json({ success: true, memory: newMemory }, { status: 201 });
  } catch (error) {
    console.error('Error creating memory:', error);
    return NextResponse.json({ error: 'Failed to create memory' }, { status: 500 });
  }
}