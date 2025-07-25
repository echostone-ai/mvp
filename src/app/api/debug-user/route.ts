import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
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
    
    console.log('[DEBUG USER] Current user:', user?.id);

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get user's avatars
    let userAvatars = [];
    if (user?.id) {
      const { data: avatars, error } = await adminSupabase
        .from('avatar_profiles')
        .select('id, name, voice_id, created_at')
        .eq('user_id', user.id);
      
      userAvatars = avatars || [];
      console.log('[DEBUG USER] User avatars:', userAvatars.length);
    }

    return NextResponse.json({
      success: true,
      user: user ? {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      } : null,
      avatars: userAvatars,
      debug: {
        hasUser: !!user,
        userId: user?.id,
        avatarCount: userAvatars.length,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL
      }
    });

  } catch (error: any) {
    console.error('[DEBUG USER] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}