import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const avatarId = searchParams.get('id');
    
    if (!avatarId) {
      return NextResponse.json({ error: 'Avatar ID is required' }, { status: 400 });
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get avatar without user filter to see if it exists at all
    const { data: avatar, error } = await adminSupabase
      .from('avatar_profiles')
      .select('*')
      .eq('id', avatarId)
      .single();

    return NextResponse.json({
      success: true,
      avatar,
      error: error?.message,
      exists: !!avatar
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}