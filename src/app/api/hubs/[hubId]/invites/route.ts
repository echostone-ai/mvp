import { NextRequest, NextResponse } from 'next/server';

// GET handler for invites
export async function GET(
  req: NextRequest,
  context: { params: { hubId: string } }
) {
  const { hubId } = context.params;
  
  // Mock invites data
  const invites = [];
  
  return NextResponse.json({ invites });
}

// POST handler for invites
export async function POST(
  req: NextRequest,
  context: { params: { hubId: string } }
) {
  try {
    const { hubId } = context.params;
    const body = await req.json();
    
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