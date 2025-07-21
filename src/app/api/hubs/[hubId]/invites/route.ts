import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { hubId: string } }
) {
  const hubId = params.hubId;
  
  // Mock invites data
  const invites = [];
  
  return NextResponse.json({ invites });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { hubId: string } }
) {
  try {
    const hubId = params.hubId;
    const body = await request.json();
    
    // Mock creating a new invite
    const newInvite = {
      id: Math.random().toString(36).substring(2, 9),
      email: body.email,
      hubId,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    return NextResponse.json({ success: true, invite: newInvite }, { status: 201 });
  } catch (error) {
    console.error('Error creating invite:', error);
    return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
  }
}