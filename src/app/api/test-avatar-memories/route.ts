// Test endpoint to check if avatar memory system is working
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    const avatarId = url.searchParams.get('avatarId');
    
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
    }
    
    // Test 1: Check if avatar_profiles table exists and has data
    const { data: avatars, error: avatarError } = await supabase
      .from('avatar_profiles')
      .select('*')
      .limit(5);
    
    // Test 2: Check if memory_fragments table has avatar_id column
    const { data: memories, error: memoryError } = await supabase
      .from('memory_fragments')
      .select('id, user_id, avatar_id, fragment_text')
      .eq('user_id', userId)
      .limit(5);
    
    // Test 3: Check if the match_memory_fragments function exists with avatar support
    let functionTest = null;
    try {
      const { data: funcData, error: funcError } = await supabase.rpc('match_memory_fragments', {
        query_embedding: new Array(1536).fill(0), // Dummy embedding
        match_threshold: 0.5,
        match_count: 1,
        target_user_id: userId,
        target_avatar_id: avatarId
      });
      functionTest = { success: true, error: null };
    } catch (error: any) {
      functionTest = { success: false, error: error.message };
    }
    
    return NextResponse.json({
      tests: {
        avatarTable: {
          success: !avatarError,
          error: avatarError?.message,
          data: avatars?.length || 0
        },
        memoryTable: {
          success: !memoryError,
          error: memoryError?.message,
          hasAvatarColumn: memories && memories.length > 0 ? 'avatar_id' in memories[0] : 'unknown',
          totalMemories: memories?.length || 0,
          avatarSpecificMemories: memories?.filter(m => m.avatar_id === avatarId).length || 0
        },
        vectorFunction: functionTest
      },
      summary: {
        avatarSystemReady: !avatarError && !memoryError && functionTest?.success,
        issues: [
          avatarError && 'Avatar table not accessible',
          memoryError && 'Memory table not accessible', 
          !functionTest?.success && 'Vector search function not working with avatar support'
        ].filter(Boolean)
      }
    });
  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Test failed', 
      details: error.message 
    }, { status: 500 });
  }
}