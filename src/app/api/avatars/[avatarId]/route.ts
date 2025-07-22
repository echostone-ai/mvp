import { NextRequest, NextResponse } from 'next/server';
import { getAvatarById } from '@/lib/avatarDataService';

export async function GET(
  request: NextRequest,
  { params }: { params: { avatarId: string } }
) {
  const avatarId = params.avatarId;
  
  console.log('Avatar API called with ID:', avatarId);
  
  try {
    // Get the REAL avatar data from the database
    const avatar = await getAvatarById(avatarId);
    
    if (!avatar) {
      console.log('Avatar not found:', avatarId);
      return NextResponse.json({ 
        error: 'Avatar not found' 
      }, { status: 404 });
    }
    
    // Transform the data for the API response
    const avatarResponse = {
      id: avatar.id,
      name: avatar.name,
      description: avatar.description || 'A digital avatar',
      hasVoice: !!avatar.voice_id,
      voiceId: avatar.voice_id,
      created_at: avatar.created_at,
      photo_url: avatar.photo_url,
      profile_data: avatar.profile_data
    };
    
    console.log('Returning REAL avatar:', avatarResponse.name, 'with voice:', avatarResponse.hasVoice);
    
    return NextResponse.json({ 
      success: true, 
      avatar: avatarResponse 
    });
  } catch (error) {
    console.error('Error fetching avatar:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch avatar details' 
    }, { status: 500 });
  }
}