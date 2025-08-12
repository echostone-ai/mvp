/**
 * Clean Voice API - Minimal ElevenLabs Implementation
 * 
 * This uses ElevenLabs with ZERO custom settings for most natural voice
 */

import { NextResponse } from 'next/server'

export const runtime = 'edge'

export async function POST(req: Request) {
  try {
    const { text, voiceId } = await req.json()
    
    if (!text || !voiceId) {
      return NextResponse.json({ error: 'Text and voiceId are required' }, { status: 400 })
    }

    console.log('Clean voice generation:', { 
      textLength: text.length,
      voiceId: voiceId.substring(0, 8) + '...',
    })
    
    const apiKey = process.env.ELEVENLABS_API_KEY || process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY
    
    if (!apiKey) {
      console.error('ElevenLabs API key not configured');
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }
    
    // Call ElevenLabs with MINIMAL settings
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text: text, // Send text exactly as received - NO processing
          model_id: 'eleven_multilingual_v2',
          // NO voice_settings - let ElevenLabs use defaults
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', response.status, errorText);
      return NextResponse.json({ 
        error: `ElevenLabs API failed: ${response.status}` 
      }, { status: response.status })
    }
    
    const audioBuffer = await response.arrayBuffer();
    console.log('Generated audio buffer size:', audioBuffer.byteLength);
    
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error: any) {
    console.error('Clean voice API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}