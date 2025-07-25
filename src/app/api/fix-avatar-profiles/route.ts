import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    // Create admin client
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Get all avatars with missing or incomplete profile_data
    const { data: avatars, error: fetchError } = await adminSupabase
      .from('avatar_profiles')
      .select('*')
      .or('profile_data.is.null,profile_data->name.is.null');
    
    if (fetchError) {
      throw fetchError;
    }
    
    if (!avatars || avatars.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No avatars need fixing',
        updated: 0
      });
    }
    
    let updated = 0;
    
    // Update each avatar with proper profile data
    for (const avatar of avatars) {
      const profileData = {
        name: avatar.name,
        personality: avatar.description || `I am ${avatar.name}, a unique digital avatar with my own personality and voice.`,
        languageStyle: { description: 'Natural and conversational' },
        humorStyle: { description: 'Friendly with occasional wit' },
        catchphrases: [],
        // Preserve any existing profile data
        ...avatar.profile_data
      };
      
      const { error: updateError } = await adminSupabase
        .from('avatar_profiles')
        .update({ profile_data: profileData })
        .eq('id', avatar.id);
      
      if (updateError) {
        console.error(`Failed to update avatar ${avatar.id}:`, updateError);
      } else {
        updated++;
        console.log(`Updated avatar ${avatar.id} (${avatar.name})`);
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Updated ${updated} avatars`,
      updated,
      total: avatars.length
    });
    
  } catch (error: any) {
    console.error('[FIX AVATAR PROFILES] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to fix avatar profiles',
      details: error.message 
    }, { status: 500 });
  }
}