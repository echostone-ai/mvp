import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const avatarId = searchParams.get('id');
    
    if (!avatarId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Avatar ID is required' 
      });
    }
    
    // Get the current user from Supabase auth
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'Authentication required' 
      });
    }
    
    // Get avatar details
    const { data: avatar, error } = await supabase
      .from('avatar_profiles')
      .select('*')
      .eq('id', avatarId)
      .eq('user_id', user.id)
      .single();
    
    if (error) {
      return NextResponse.json({ 
        success: false, 
        error: `Failed to get avatar: ${error.message}` 
      });
    }
    
    if (!avatar) {
      return NextResponse.json({ 
        success: false, 
        error: 'Avatar not found' 
      });
    }
    
    return NextResponse.json({
      success: true,
      avatar: {
        id: avatar.id,
        name: avatar.name,
        description: avatar.description,
        voice_id: avatar.voice_id,
        user_id: avatar.user_id,
        created_at: avatar.created_at
      }
    });
    
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'An unexpected error occurred' 
    });
  }
}