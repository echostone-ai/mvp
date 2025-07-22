import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { avatarId: string } }
) {
  const avatarId = params.avatarId;
  
  console.log('Avatar API called with ID:', avatarId);
  
  try {
    // In a real app, fetch from database
    // For now, return mock data
    const mockAvatar = {
      id: avatarId,
      name: avatarId === 'avatar-jonathan' ? 'Jonathan' : 'Avatar ' + avatarId.substring(0, 4),
      description: avatarId === 'avatar-jonathan' 
        ? 'Travel enthusiast and storyteller from Bulgaria' 
        : 'A digital avatar with unique personality',
      hasVoice: avatarId === 'avatar-jonathan',
      voiceId: avatarId === 'avatar-jonathan' ? 'CO6pxVrMZfyL61ZIglyr' : null,
      created_at: new Date().toISOString(),
      photo_url: null
    };
    
    console.log('Returning mock avatar:', mockAvatar);
    
    return NextResponse.json({ 
      success: true, 
      avatar: mockAvatar 
    });
  } catch (error) {
    console.error('Error fetching avatar:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch avatar details' 
    }, { status: 500 });
  }
}