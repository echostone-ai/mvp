import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { streamId, sessionId, text, voiceId } = await request.json();

    if (!streamId || !sessionId || !text || !voiceId) {
      return NextResponse.json({ error: 'streamId, sessionId, text, and voiceId are required' }, { status: 400 });
    }

    if (!process.env.DID_API_KEY || !process.env.ELEVENLABS_API_KEY) {
      return NextResponse.json({ error: 'API keys not configured' }, { status: 500 });
    }

    console.log('🎤 Generating speech and sending to D-ID...');

    // First, generate audio with ElevenLabs
    const audioResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
          style: 0.0,
          use_speaker_boost: true
        }
      }),
    });

    if (!audioResponse.ok) {
      throw new Error('Failed to generate audio');
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');

    // Send audio to D-ID stream
    const response = await fetch(`https://api.d-id.com/talks/streams/${streamId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${process.env.DID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId,
        script: {
          type: 'audio',
          audio_url: `data:audio/mp3;base64,${audioBase64}`,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('D-ID send audio error:', errorText);
      return NextResponse.json({ error: 'Failed to send audio to D-ID stream' }, { status: 500 });
    }

    const result = await response.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('D-ID send audio error:', error);
    return NextResponse.json({ error: 'Failed to send audio to D-ID stream' }, { status: 500 });
  }
}