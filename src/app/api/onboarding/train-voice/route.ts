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

    // Always use ElevenLabs voices - no need to check API key for voice selection
    console.log('🎤 Selecting ElevenLabs voice for:', avatarName);
    
    // Use a default ElevenLabs voice ID since we don't have audio files to train with
    // In a full implementation, you would:
    // 1. Upload the stitched audio files
    // 2. Create a voice clone with the audio samples
    // 3. Wait for training completion
    
    const defaultVoiceIds = [
      'EXAVITQu4vr4xnSDxMaL', // Bella - warm female voice
      'ErXwobaYiN019PkySvjV', // Antoni - professional male voice
      'MF3mGyEYCl7XYWbV9V6O', // Elli - young female voice
      'TxGEqnHWrfWFTfGW9XjX', // Josh - young male voice
      'VR6AewLTigWG4xSOukaG', // Arnold - mature male voice
      'pNInz6obpgDQGcFmaJgB', // Adam - narrative male voice
      'yoZ06aMxZJJ28mfd3POQ', // Sam - narrative male voice
    ];
    
    // Select voice based on tone or randomly
    let selectedVoiceId;
    if (dominantTone === 'warm' || dominantTone === 'friendly') {
      selectedVoiceId = 'EXAVITQu4vr4xnSDxMaL'; // Bella - warm female voice
    } else if (dominantTone === 'professional' || dominantTone === 'confident') {
      selectedVoiceId = 'ErXwobaYiN019PkySvjV'; // Antoni - professional male voice
    } else if (dominantTone === 'energetic' || dominantTone === 'enthusiastic') {
      selectedVoiceId = 'MF3mGyEYCl7XYWbV9V6O'; // Elli - energetic female voice
    } else {
      selectedVoiceId = defaultVoiceIds[Math.floor(Math.random() * defaultVoiceIds.length)];
    }
    
    console.log('✅ Selected ElevenLabs voice ID:', selectedVoiceId, 'for tone:', dominantTone);

    return NextResponse.json({
      success: true,
      voice_model_id: selectedVoiceId,
      tone: dominantTone,
      keywords: topKeywords,
      message: 'Voice model assigned successfully with ElevenLabs',
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