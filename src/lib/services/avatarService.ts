import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getCached, setCached } from '@/lib/cache';

export interface Avatar {
  id: string;
  name: string;
  description?: string;
  voice_id?: string | null;
  hasVoice: boolean;
  created_at: string;
  user_id: string;
}

export async function getAvatars(data: {
  userId?: string;
}, request: NextRequest): Promise<NextResponse> {
  const { userId } = data;
  
  try {
    // If userId is provided, fetch avatars for that user
    if (userId) {
      const cacheKey = `avatars:${userId}`;
      const cached = getCached<Avatar[]>(cacheKey);
      
      if (cached) {
        return NextResponse.json({ 
          success: true, 
          avatars: cached 
        });
      }

      const { data: avatarData, error } = await supabase
        .from('avatar_profiles')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('Error fetching avatars:', error);
        return NextResponse.json({ error: 'Failed to fetch avatars' }, { status: 500 });
      }
      
      const avatars = (avatarData || []).map(avatar => ({
        ...avatar,
        hasVoice: !!avatar.voice_id
      }));

      setCached(cacheKey, avatars, 300000); // Cache for 5 minutes
      
      return NextResponse.json({ 
        success: true, 
        avatars 
      });
    }
    
    // If no userId, return mock avatars
    const mockAvatars: Avatar[] = [
      {
        id: 'avatar-jonathan',
        name: 'Jonathan',
        description: 'Travel enthusiast and storyteller from Bulgaria',
        voice_id: 'CO6pxVrMZfyL61ZIglyr',
        hasVoice: true,
        created_at: '2024-01-01T00:00:00Z',
        user_id: 'user-123'
      },
      {
        id: 'avatar-boris',
        name: 'Boris',
        description: 'Tech enthusiast and programmer',
        voice_id: null,
        hasVoice: false,
        created_at: '2024-01-02T00:00:00Z',
        user_id: 'user-123'
      }
    ];
    
    return NextResponse.json({ 
      success: true, 
      avatars: mockAvatars 
    }, {
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300'
      }
    });
  } catch (error) {
    console.error('Error in avatars service:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}