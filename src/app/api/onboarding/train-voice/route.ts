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
        
        console.log('🎤 Creating voice clone for:', avatarName);
        console.log('📝 Processing', responses.length, 'audio responses');
        
        // Extract base64 audio from responses
        const audioFiles = responses
          .filter((r: any) => r.audioBase64)
          .map((r: any) => r.audioBase64);
        
        if (audioFiles.length === 0) {
          console.warn('⚠️ No audio data found in responses');
        } else {
          console.log('🎵 Found', audioFiles.length, 'audio files, stitching...');
          
          // Stitch audio files together
          const stitchResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/onboarding/stitch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audioFiles }),
          });
          
          if (stitchResponse.ok) {
            const stitchData = await stitchResponse.json();
            console.log('✅ Audio stitched successfully');
            
            // Convert base64 to blob for upload
            const base64Data = stitchData.stitchedAudio.split(',')[1];
            const audioBuffer = Buffer.from(base64Data, 'base64');
            
            // Create FormData for ElevenLabs upload
            const formData = new FormData();
            formData.append('name', voiceName);
            formData.append('description', `Custom voice for ${avatarName} created from onboarding`);
            formData.append('labels', JSON.stringify({
              accent: 'american',
              age: 'young_adult',
              gender: 'neutral',
              use_case: 'conversational'
            }));
            
            // Add the stitched audio file
            const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
            formData.append('files', audioBlob, `${voiceName}.wav`);
            
            // Create voice clone with ElevenLabs
            const voiceResponse = await fetch('https://api.elevenlabs.io/v1/voices/add', {
              method: 'POST',
              headers: {
                'Accept': 'application/json',
                'xi-api-key': process.env.ELEVENLABS_API_KEY,
              },
              body: formData,
            });
            
            if (voiceResponse.ok) {
              const voiceData = await voiceResponse.json();
              console.log('🎉 Voice clone created successfully:', voiceData.voice_id);
              
              return NextResponse.json({
                success: true,
                voice_model_id: voiceData.voice_id,
                tone: dominantTone,
                keywords: topKeywords,
                message: 'Voice clone created successfully with stitched audio',
                audioFilesUsed: audioFiles.length,
              });
            } else {
              const errorText = await voiceResponse.text();
              console.error('❌ ElevenLabs voice creation failed:', errorText);
            }
          } else {
            console.error('❌ Audio stitching failed');
          }
        }
      } catch (error) {
        console.error('❌ Voice cloning failed:', error);
      }
    } else {
      console.warn('⚠️ ELEVENLABS_API_KEY not found');
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