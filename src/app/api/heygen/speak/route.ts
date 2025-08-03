import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, text, voiceId } = await request.json();

    if (!sessionId || !text) {
      return NextResponse.json({ error: 'sessionId and text are required' }, { status: 400 });
    }

    if (!process.env.HEYGEN_API_KEY || !process.env.ELEVENLABS_API_KEY) {
      return NextResponse.json({ error: 'API keys not configured' }, { status: 500 });
    }

    console.log('🎤 Generating speech and sending to HeyGen avatar...');

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
      throw new Error('Failed to generate audio with ElevenLabs');
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');

    // Send audio to HeyGen for lip-sync
    const heygenResponse = await fetch('https://api.heygen.com/v1/streaming.task', {
      method: 'POST',
      headers: {
        'X-Api-Key': process.env.HEYGEN_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId,
        text: text,
        audio_url: `data:audio/mpeg;base64,${audioBase64}`,
      }),
    });

    if (!heygenResponse.ok) {
      const errorText = await heygenResponse.text();
      console.error('HeyGen speak error:', errorText);
      return NextResponse.json({ error: 'Failed to send speech to HeyGen' }, { status: 500 });
    }

    const result = await heygenResponse.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('HeyGen speak error:', error);
    return NextResponse.json({ error: 'Failed to make avatar speak' }, { status: 500 });
  }
}