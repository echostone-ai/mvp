import { NextRequest, NextResponse } from 'next/server';

// Simple route handler without dynamic segments
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const hubId = url.searchParams.get('hubId');
  
  if (!hubId) {
    return NextResponse.json({ error: 'Hub ID is required' }, { status: 400 });
  }
  
  // Mock invites data
  const invites = [];
  
  return NextResponse.json({ invites, hubId });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { hubId, email } = body;
    
    if (!hubId || !email) {
      return NextResponse.json({ error: 'Hub ID and email are required' }, { status: 400 });
    }
    
    // Mock creating a new invite
    const newInvite = {
      id: Math.random().toString(36).substring(2, 9),
      email,
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