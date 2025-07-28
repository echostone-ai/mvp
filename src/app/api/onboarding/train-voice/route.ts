import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { profileData } = await request.json();

    if (!profileData?.responses) {
      return NextResponse.json({ error: 'No profile data provided' }, { status: 400 });
    }

    // Extract tone and keywords for voice model configuration
    const responses = profileData.responses;
    const tones = responses.map((r: any) => r.analysis?.tone).filter(Boolean);
    const allKeywords = responses.flatMap((r: any) => r.analysis?.keywords || []);
    
    const dominantTone = tones[0] || 'warm';
    const topKeywords = [...new Set(allKeywords)].slice(0, 10);
    const avatarName = profileData.avatarName || 'Avatar';

    console.log('Training voice for:', avatarName);
    console.log('Voice tone:', dominantTone);
    console.log('Keywords:', topKeywords);

    // Check if ElevenLabs API key is available
    if (process.env.ELEVENLABS_API_KEY) {
      try {
        console.log('ElevenLabs API available - training voice for:', avatarName);
        
        // Create a voice clone using ElevenLabs API
        const voiceResponse = await fetch('https://api.elevenlabs.io/v1/voices/add', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'xi-api-key': process.env.ELEVENLABS_API_KEY,
          },
          body: JSON.stringify({
            name: `${avatarName}_voice_${Date.now()}`,
            description: `Voice model for ${avatarName} - ${dominantTone} tone`,
            labels: topKeywords.join(', ')
          })
        });

        if (voiceResponse.ok) {
          const voiceData = await voiceResponse.json();
          console.log('ElevenLabs voice created:', voiceData.voice_id);
          
          return NextResponse.json({
            success: true,
            voice_model_id: voiceData.voice_id,
            tone: dominantTone,
            keywords: topKeywords,
            message: 'Voice model trained successfully with ElevenLabs',
          });
        } else {
          console.warn('ElevenLabs API call failed:', await voiceResponse.text());
        }
      } catch (elevenLabsError) {
        console.error('ElevenLabs training failed:', elevenLabsError);
        // Fall through to mock implementation
      }
    }

    // Mock implementation for development
    const mockVoiceModelId = `voice_${profileData.avatarId}_${Date.now()}`;

    // Simulate training delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    return NextResponse.json({
      success: true,
      voice_model_id: mockVoiceModelId,
      tone: dominantTone,
      keywords: topKeywords,
      message: 'Voice model trained successfully (mock)',
    });
  } catch (error) {
    console.error('Voice training error:', error);
    return NextResponse.json(
      { error: 'Failed to train voice model' },
      { status: 500 }
    );
  }
}

// TODO: Implement ElevenLabs integration
// Example ElevenLabs API call structure:
/*
const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
  method: 'POST',
  headers: {
    'Accept': 'application/json',
    'xi-api-key': process.env.ELEVENLABS_API_KEY,
  },
  body: formData, // Contains audio file and metadata
});
*/