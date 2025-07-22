import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * API endpoint for listing avatars
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    
    // If userId is provided, fetch avatars for that user
    if (userId) {
      const { data, error } = await supabase
        .from('avatar_profiles')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('Error fetching avatars:', error);
        return NextResponse.json({ error: 'Failed to fetch avatars' }, { status: 500 });
      }
      
      return NextResponse.json({ 
        success: true, 
        avatars: data || [] 
      });
    }
    
    // If no userId, return mock avatars
    const mockAvatars = [
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
    });
  } catch (error) {
    console.error('Error in avatars API:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}