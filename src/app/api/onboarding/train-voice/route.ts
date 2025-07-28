import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { profileData } = await request.json();

    if (!profileData?.responses) {
      return NextResponse.json({ error: 'No profile data provided' }, { status: 400 });
    }

    const responses = profileData.responses;
    const tones = responses.map((r: any) => r.analysis?.tone).filter(Boolean);
    const allKeywords = responses.flatMap((r: any) => r.analysis?.keywords || []);
    
    const dominantTone = tones[0] || 'warm';
    const topKeywords = [...new Set(allKeywords)].slice(0, 10);
    const avatarName = profileData.avatarName || 'Avatar';

    // Try to create a voice clone with ElevenLabs
    if (process.env.ELEVENLABS_API_KEY) {
      try {
        const voiceName = `${avatarName}_${Date.now()}`;
        
        // Create a voice clone using ElevenLabs API
        const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'xi-api-key': process.env.ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: voiceName,
            description: `Custom voice for ${avatarName}`,
            labels: {
              accent: 'american',
              age: 'young_adult',
              gender: 'neutral',
              use_case: 'conversational'
            }
          }),
        });

        if (response.ok) {
          const voiceData = await response.json();
          return NextResponse.json({
            success: true,
            voice_model_id: voiceData.voice_id,
            tone: dominantTone,
            keywords: topKeywords,
            message: 'Voice clone created successfully',
          });
        } else {
          console.error('ElevenLabs API error:', await response.text());
        }
      } catch (error) {
        console.error('Voice cloning failed:', error);
      }
    }

    // Fallback to preset voices
    const defaultVoiceIds = [
      'EXAVITQu4vr4xnSDxMaL', // Bella
      'ErXwobaYiN019PkySvjV', // Antoni  
      'MF3mGyEYCl7XYWbV9V6O', // Elli
      'TxGEqnHWrfWFTfGW9XjX', // Josh
    ];
    
    const selectedVoiceId = defaultVoiceIds[Math.floor(Math.random() * defaultVoiceIds.length)];
    
    return NextResponse.json({
      success: true,
      voice_model_id: selectedVoiceId,
      tone: dominantTone,
      keywords: topKeywords,
      message: 'Using preset voice (clone creation failed)',
    });

  } catch (error) {
    console.error('Voice training error:', error);
    return NextResponse.json(
      { error: 'Failed to train voice model' },
      { status: 500 }
    );
  }
}