import { NextRequest, NextResponse } from 'next/server';
import { getAvatarProfile, getAvatarForSharing } from '@/lib/avatarDataService';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { avatarId: string } }
) {
  const avatarId = params.avatarId;
  
  console.log('Avatar API called with ID:', avatarId);
  
  try {
    // First try to get the avatar from the database
    const avatar = await getAvatarProfile(avatarId);
    
    // If not found in database, try to get from Supabase directly
    if (!avatar) {
      console.log('Avatar not found in service, trying direct Supabase query:', avatarId);
      
      // Direct query to Supabase
      const { data, error } = await supabase
        .from('avatar_profiles')
        .select('*')
        .eq('id', avatarId)
        .single();
        
      if (error || !data) {
        console.log('Avatar not found in Supabase:', avatarId);
        
        // Use fallback data
        const fallbackAvatar = {
          id: avatarId,
          name: `Avatar ${avatarId.substring(0, 6)}`,
          description: 'A digital avatar',
          hasVoice: false,
          voiceId: null,
          created_at: new Date().toISOString(),
          photo_url: null,
          profile_data: {
            name: `Avatar ${avatarId.substring(0, 6)}`,
            personality: 'Friendly and helpful',
            languageStyle: { description: 'Natural conversational style' },
            humorStyle: { description: 'Light and appropriate' },
            catchphrases: []
          }
        };
        
        console.log('Using fallback avatar data:', fallbackAvatar.name);
        
        return NextResponse.json({ 
          success: true, 
          avatar: fallbackAvatar 
        });
      }
      
      // Transform the data for the API response
      const avatarResponse = {
        id: data.id,
        name: data.name,
        description: data.description || 'A digital avatar',
        hasVoice: !!data.voice_id,
        voiceId: data.voice_id,
        created_at: data.created_at,
        photo_url: data.photo_url,
        profile_data: data.profile_data
      };
      
      console.log('Found avatar in Supabase:', avatarResponse.name);
      
      return NextResponse.json({ 
        success: true, 
        avatar: avatarResponse 
      });
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