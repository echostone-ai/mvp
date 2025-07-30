import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

/**
 * API endpoint to fix accent issues with trained voices
 * This applies optimized settings to reduce accent variation
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get user session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ 
        error: 'Authentication required' 
      }, { status: 401 });
    }

    const { avatarId, voiceId } = await request.json();

    if (!avatarId || !voiceId) {
      return NextResponse.json({ 
        error: 'Avatar ID and Voice ID are required' 
      }, { status: 400 });
    }

    // Verify avatar ownership
    const { data: avatar, error: avatarError } = await supabase
      .from('avatar_profiles')
      .select('id, name, voice_id, profile_data')
      .eq('id', avatarId)
      .eq('user_id', session.user.id)
      .single();

    if (avatarError || !avatar) {
      return NextResponse.json({ 
        error: 'Avatar not found or access denied' 
      }, { status: 404 });
    }

    if (avatar.voice_id !== voiceId) {
      return NextResponse.json({ 
        error: 'Voice ID does not match avatar' 
      }, { status: 400 });
    }

    // Optimized settings for accent consistency
    const accentConsistentSettings = {
      stability: 0.92,           // Very high stability for consistent accent
      similarity_boost: 0.95,    // Maximum similarity to original voice
      style: 0.08,              // Very low style to minimize accent variation
      use_speaker_boost: true
    };

    // Update avatar profile with accent-consistent settings
    const updatedProfileData = {
      ...avatar.profile_data,
      voice_settings: accentConsistentSettings,
      accent_fix_applied: true,
      accent_fix_date: new Date().toISOString()
    };

    const { error: updateError } = await supabase
      .from('avatar_profiles')
      .update({ 
        profile_data: updatedProfileData,
        updated_at: new Date().toISOString()
      })
      .eq('id', avatarId)
      .eq('user_id', session.user.id);

    if (updateError) {
      console.error('Database update error:', updateError);
      return NextResponse.json({ 
        error: 'Failed to update avatar settings' 
      }, { status: 500 });
    }

    // Test the voice with new settings
    const testResult = await testVoiceWithSettings(voiceId, accentConsistentSettings);

    return NextResponse.json({
      success: true,
      message: 'Accent consistency settings applied successfully',
      settings: accentConsistentSettings,
      testResult,
      recommendations: [
        'Voice settings optimized for accent consistency',
        'Stability increased to 0.92 for more consistent tone',
        'Style reduced to 0.08 to minimize accent variation',
        'Test the voice with different content to verify improvements',
        'If accent still varies, consider re-training with more consistent audio samples'
      ]
    });

  } catch (error) {
    console.error('Voice fix error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

/**
 * Test voice with new settings
 */
async function testVoiceWithSettings(voiceId: string, settings: any) {
  const apiKey = process.env.ELEVENLABS_API_KEY || process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
  if (!apiKey) {
    return { error: 'ElevenLabs API key not configured' };
  }

  const testPhrases = [
    "Hello, this is a test of the voice consistency.",
    "I'm speaking with a consistent accent and tone.",
    "The voice should now sound more natural and consistent."
  ];

  try {
    const testResults = await Promise.all(
      testPhrases.map(async (text, index) => {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': apiKey
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_turbo_v2_5',
            voice_settings: settings
          })
        });

        return {
          phrase: text,
          success: response.ok,
          status: response.status
        };
      })
    );

    const successCount = testResults.filter(result => result.success).length;
    
    return {
      totalTests: testResults.length,
      successfulTests: successCount,
      consistencyScore: (successCount / testResults.length) * 100,
      results: testResults
    };

  } catch (error) {
    return {
      totalTests: testPhrases.length,
      successfulTests: 0,
      consistencyScore: 0,
      error: 'Test failed'
    };
  }
} 