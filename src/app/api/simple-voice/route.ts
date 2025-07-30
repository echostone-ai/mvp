/**
 * Simple Voice API - Clean, Reliable Voice Generation
 * 
 * This replaces the complex voice-stream API with a simple, direct approach
 */

import { NextResponse } from 'next/server'
import { generateVoice, getOptimalVoiceSettings } from '@/lib/simpleVoice'

export const runtime = 'edge'

export async function POST(req: Request) {
  try {
    const { text, voiceId, settings } = await req.json()
    
    if (!text || !voiceId) {
      return NextResponse.json({ error: 'Text and voiceId are required' }, { status: 400 })
    }

    console.log('Simple voice generation:', { 
      textLength: text.length,
      voiceId: voiceId.substring(0, 8) + '...',
    })
    
    const apiKey = process.env.ELEVENLABS_API_KEY || process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY
    
    if (!apiKey) {
      console.warn('ElevenLabs API key not configured');
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }
    
    // Use optimal settings for natural voice
    const voiceSettings = settings || getOptimalVoiceSettings();
    
    // Generate voice with minimal processing
    const audioBuffer = await generateVoice(text, voiceId, voiceSettings);
    
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error: any) {
    console.error('Simple voice generation error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}