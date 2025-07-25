import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { clearCache } from '@/lib/cache';

export async function POST(request: NextRequest) {
  try {
    const { avatarId, voiceId, userId } = await request.json();
    
    if (!avatarId || !voiceId) {
      return NextResponse.json({ 
        error: 'avatarId and voiceId are required' 
      }, { status: 400 });
    }
    
    // Create admin client
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    console.log(`[UPDATE AVATAR VOICE] Updating avatar ${avatarId} with voice ${voiceId} for user ${userId}`);
    
    // Update the avatar
    let query = adminSupabase
      .from('avatar_profiles')
      .update({ voice_id: voiceId })
      .eq('id', avatarId);
      
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query.select();
    
    if (error) {
      console.error('[UPDATE AVATAR VOICE] Update failed:', error);
      return NextResponse.json({ 
        error: 'Failed to update avatar',
        details: error.message 
      }, { status: 500 });
    }
    
    console.log(`[UPDATE AVATAR VOICE] Update successful:`, data);
    
    // Clear cache
    if (userId) {
      clearCache(`avatars:${userId}`);
      console.log(`[UPDATE AVATAR VOICE] Cleared cache for user ${userId}`);
    }
    
    // Verify the update
    const { data: verifyData } = await adminSupabase
      .from('avatar_profiles')
      .select('voice_id, name')
      .eq('id', avatarId)
      .single();
    
    return NextResponse.json({ 
      success: true,
      updated: data?.length || 0,
      verification: verifyData
    });
    
  } catch (error: any) {
    console.error('[UPDATE AVATAR VOICE] Error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 });
  }
}