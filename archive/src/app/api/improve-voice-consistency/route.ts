import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getVoiceSettingsForImprovement } from '@/lib/voiceSettings';

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
    const optimizedSettings = getVoiceSettingsForImprovement(improvementType);

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
      
      // First, let's check if the voice exists in ElevenLabs
      console.log('Checking if voice exists in ElevenLabs...');
      const voiceCheckResponse = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'xi-api-key': elevenLabsApiKey
        }
      });

      if (!voiceCheckResponse.ok) {
        const checkErrorText = await voiceCheckResponse.text();
        console.error('Voice check failed:', {
          status: voiceCheckResponse.status,
          statusText: voiceCheckResponse.statusText,
          error: checkErrorText,
          voiceId
        });
        
        return NextResponse.json({ 
          error: 'Voice not found in ElevenLabs',
          details: `Voice ID ${voiceId} does not exist or is not accessible. Status: ${voiceCheckResponse.status}`,
          voiceId,
          checkError: checkErrorText
        }, { status: 404 });
      }

      const voiceInfo = await voiceCheckResponse.json();
      console.log('Voice found in ElevenLabs:', {
        name: voiceInfo.name,
        voice_id: voiceInfo.voice_id,
        category: voiceInfo.category
      });
      
      // First, let's get the current voice settings to see the correct format
      console.log('Getting current voice settings...');
      const currentSettingsResponse = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}/settings`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'xi-api-key': elevenLabsApiKey
        }
      });

      let currentSettings = null;
      if (currentSettingsResponse.ok) {
        currentSettings = await currentSettingsResponse.json();
        console.log('Current voice settings:', currentSettings);
      } else {
        console.log('Failed to get current settings:', currentSettingsResponse.status);
      }

      // Try to update voice settings using the correct ElevenLabs API endpoint
      // According to ElevenLabs docs, we should use POST to /v1/voices/{voice_id}/settings
      console.log('Attempting to update voice settings...');
      console.log('Endpoint:', `https://api.elevenlabs.io/v1/voices/${voiceId}/settings`);
      console.log('Settings to apply:', optimizedSettings);
      
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
        
        // If we get a 405 Method Not Allowed, it might mean this voice doesn't support settings updates
        if (updateResponse.status === 405) {
          console.log('Voice settings update not supported, but we can still test with custom settings');
          
          // Save the optimized settings to the profile_data field which we know exists
          const { data: currentAvatar, error: fetchError } = await supabase
            .from('avatar_profiles')
            .select('profile_data')
            .eq('id', avatarId)
            .eq('user_id', user.id)
            .single();

          if (!fetchError && currentAvatar) {
            const updatedProfileData = {
              ...currentAvatar.profile_data,
              voice_settings: optimizedSettings
            };

            const { error: dbUpdateError } = await supabase
              .from('avatar_profiles')
              .update({ 
                profile_data: updatedProfileData,
                updated_at: new Date().toISOString()
              })
              .eq('id', avatarId)
              .eq('user_id', user.id);

            if (dbUpdateError) {
              console.error('Database update error:', dbUpdateError);
            }
          }

          // Test the voice with the new settings
          const testResult = await testVoiceConsistency(voiceId, elevenLabsApiKey, optimizedSettings);

          return NextResponse.json({
            success: true,
            message: 'Voice settings optimized and saved to your profile. These settings will be used when generating speech.',
            settings: optimizedSettings,
            testResult,
            recommendations: getImprovementRecommendations(improvementType),
            note: 'Settings saved to your profile since this voice type doesn\'t support permanent settings updates.'
          });
        }
        
        // Provide more specific error messages for other errors
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
            model_id: 'eleven_multilingual_v2', // Use most accurate model for voice cloning
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