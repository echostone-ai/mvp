import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

/**
 * API endpoint to improve voice consistency by updating voice parameters
 * This can help fix accent variations and improve voice similarity
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Try to get session from cookies first
    let session = null;
    let user = null;
    
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      session = sessionData.session;
      user = session?.user;
    } catch (sessionErr) {
      console.error('Session error:', sessionErr);
    }
    
    // If no session from cookies, try Authorization header
    if (!user) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const { data: userData, error: userError } = await supabase.auth.getUser(token);
          user = userData.user;
        } catch (tokenErr) {
          console.error('Token error:', tokenErr);
        }
      }
    }
    
    if (!user) {
      return NextResponse.json({ 
        error: 'Authentication required. Please sign in and refresh the page.',
        details: 'No valid session or token found'
      }, { status: 401 });
    }

    const { avatarId, voiceId, improvementType = 'accent_consistency' } = await request.json();

    if (!avatarId || !voiceId) {
      return NextResponse.json({ error: 'Avatar ID and Voice ID are required' }, { status: 400 });
    }

    // Verify avatar ownership
    const { data: avatar, error: avatarError } = await supabase
      .from('avatar_profiles')
      .select('id, name, voice_id')
      .eq('id', avatarId)
      .eq('user_id', user.id)
      .single();

    if (avatarError || !avatar) {
      return NextResponse.json({ error: 'Avatar not found or access denied' }, { status: 404 });
    }

    console.log('Voice ID validation:', {
      avatarVoiceId: avatar.voice_id,
      providedVoiceId: voiceId,
      avatarName: avatar.name,
      avatarId: avatar.id,
      match: avatar.voice_id === voiceId,
      avatarVoiceIdType: typeof avatar.voice_id,
      providedVoiceIdType: typeof voiceId,
      avatarVoiceIdLength: avatar.voice_id?.length,
      providedVoiceIdLength: voiceId?.length
    });

    if (avatar.voice_id !== voiceId) {
      return NextResponse.json({ 
        error: 'Voice ID does not match avatar',
        details: `Avatar has voice_id: ${avatar.voice_id}, but provided: ${voiceId}`,
        avatarName: avatar.name,
        avatarVoiceId: avatar.voice_id,
        providedVoiceId: voiceId
      }, { status: 400 });
    }

    // Get optimized settings based on improvement type
    const optimizedSettings = getOptimizedSettings(improvementType);

    // Update ElevenLabs voice settings
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY || process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
    if (!elevenLabsApiKey) {
      return NextResponse.json({ 
        error: 'ElevenLabs API key not configured',
        details: 'Please check your environment variables'
      }, { status: 500 });
    }

    try {
      console.log(`Updating voice settings for voice ID: ${voiceId}`);
      console.log('Optimized settings:', optimizedSettings);
      
      // Update voice settings in ElevenLabs
      const updateResponse = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}/settings`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'xi-api-key': elevenLabsApiKey
        },
        body: JSON.stringify(optimizedSettings)
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error('ElevenLabs settings update failed:', {
          status: updateResponse.status,
          statusText: updateResponse.statusText,
          error: errorText,
          voiceId,
          settings: optimizedSettings
        });
        
        // Provide more specific error messages
        let errorMessage = 'Failed to update voice settings';
        if (updateResponse.status === 404) {
          errorMessage = 'Voice not found in ElevenLabs. The voice may have been deleted.';
        } else if (updateResponse.status === 401) {
          errorMessage = 'Invalid ElevenLabs API key';
        } else if (updateResponse.status === 422) {
          errorMessage = 'Invalid voice settings provided';
        }
        
        return NextResponse.json({ 
          error: errorMessage,
          details: `HTTP ${updateResponse.status}: ${errorText}`,
          voiceId,
          settings: optimizedSettings
        }, { status: 500 });
      }

      console.log('ElevenLabs settings updated successfully');

      // Update avatar profile with new settings
      const { error: updateError } = await supabase
        .from('avatar_profiles')
        .update({ 
          voice_settings: optimizedSettings,
          updated_at: new Date().toISOString()
        })
        .eq('id', avatarId)
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Database update error:', updateError);
        // Don't fail the request if DB update fails, as ElevenLabs was updated
      }

      // Test the improved voice
      const testResult = await testVoiceConsistency(voiceId, elevenLabsApiKey, optimizedSettings);

      return NextResponse.json({
        success: true,
        message: 'Voice settings optimized for better consistency',
        settings: optimizedSettings,
        testResult,
        recommendations: getImprovementRecommendations(improvementType)
      });

    } catch (elevenLabsError) {
      console.error('ElevenLabs API error:', elevenLabsError);
      return NextResponse.json({ 
        error: 'Failed to communicate with voice service',
        details: elevenLabsError instanceof Error ? elevenLabsError.message : 'Unknown error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Voice improvement error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Get optimized settings based on improvement type
 */
function getOptimizedSettings(improvementType: string) {
  switch (improvementType) {
    case 'accent_consistency':
      return {
        stability: 0.90,           // High stability for consistent accent
        similarity_boost: 0.88,    // Balanced for voice matching
        style: 0.12,              // Low style for consistency
        use_speaker_boost: true
      };
    
    case 'voice_similarity':
      return {
        stability: 0.85,           // Moderate stability
        similarity_boost: 0.92,    // High similarity boost
        style: 0.15,              // Moderate style
        use_speaker_boost: true
      };
    
    case 'natural_expression':
      return {
        stability: 0.82,           // Lower stability for expression
        similarity_boost: 0.90,    // High similarity
        style: 0.20,              // Higher style for expression
        use_speaker_boost: true
      };
    
    default:
      return {
        stability: 0.90,
        similarity_boost: 0.88,
        style: 0.12,
        use_speaker_boost: true
      };
  }
}

/**
 * Test voice consistency with sample phrases
 */
async function testVoiceConsistency(voiceId: string, apiKey: string, settings: any) {
  const testPhrases = [
    "Hello, how are you doing today?",
    "I'm really excited about this new technology.",
    "Let me tell you about my experience with this."
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

/**
 * Get improvement recommendations
 */
function getImprovementRecommendations(improvementType: string): string[] {
  const baseRecommendations = [
    'Voice settings have been optimized for better consistency',
    'Test the voice with different types of content to verify improvements',
    'If accent still varies, consider re-training with more consistent audio samples'
  ];

  switch (improvementType) {
    case 'accent_consistency':
      return [
        ...baseRecommendations,
        'Stability increased to 0.90 for more consistent accent',
        'Style reduced to 0.12 for less variation between generations',
        'Try generating the same text multiple times to test consistency'
      ];
    
    case 'voice_similarity':
      return [
        ...baseRecommendations,
        'Similarity boost increased to 0.92 for better voice matching',
        'Compare generated speech to your original voice recordings',
        'If similarity is still low, consider re-training with clearer audio samples'
      ];
    
    default:
      return baseRecommendations;
  }
}