import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({ 
        success: false, 
        error: 'ElevenLabs API key not configured' 
      });
    }
    
    // Call ElevenLabs API to get user info
    const response = await fetch('https://api.elevenlabs.io/v1/user', {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
      },
    });
    
    if (!response.ok) {
      return NextResponse.json({ 
        success: false, 
        error: `ElevenLabs API error: ${response.status}` 
      });
    }
    
    const userData = await response.json();
    
    // Get voices count
    const voicesResponse = await fetch('https://api.elevenlabs.io/v1/voices', {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
      },
    });
    
    let voiceCount = 'Unknown';
    if (voicesResponse.ok) {
      const voicesData = await voicesResponse.json();
      voiceCount = voicesData.voices?.length || 0;
    }
    
    return NextResponse.json({
      success: true,
      tier: userData.subscription?.tier || 'Unknown',
      characterQuota: userData.subscription?.character_count || 'Unknown',
      characterLimit: userData.subscription?.character_limit || 'Unknown',
      voiceCount,
    });
    
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'An unexpected error occurred' 
    });
  }
}