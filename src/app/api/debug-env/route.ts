import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const debugInfo = `
🔍 SERVER-SIDE ENVIRONMENT CHECK:
=====================================

Voice Configuration:
- ELEVENLABS_VOICE_ID: ${process.env.ELEVENLABS_VOICE_ID || 'NOT SET'}
- NEXT_PUBLIC_ELEVENLABS_VOICE_ID: ${process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID || 'NOT SET'}
- Expected: CO6pxVrMZfyL61ZIglyr
- Private match: ${process.env.ELEVENLABS_VOICE_ID === 'CO6pxVrMZfyL61ZIglyr' ? '✅' : '❌'}
- Public match: ${process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID === 'CO6pxVrMZfyL61ZIglyr' ? '✅' : '❌'}

API Key Configuration:
- ELEVENLABS_API_KEY: ${process.env.ELEVENLABS_API_KEY ? `Set (${process.env.ELEVENLABS_API_KEY.length} chars)` : 'NOT SET'}
- NEXT_PUBLIC_ELEVENLABS_API_KEY: ${process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY ? `Set (${process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY.length} chars)` : 'NOT SET'}
- Private key starts with 'sk_': ${process.env.ELEVENLABS_API_KEY?.startsWith('sk_') ? '✅' : '❌'}
- Public key starts with 'sk_': ${process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY?.startsWith('sk_') ? '✅' : '❌'}
- Private key masked: ${process.env.ELEVENLABS_API_KEY?.includes('*') ? '⚠️  YES (needs real key)' : '✅ No'}
- Public key masked: ${process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY?.includes('*') ? '⚠️  YES (needs real key)' : '✅ No'}

Other Environment:
- NODE_ENV: ${process.env.NODE_ENV}
- Runtime: ${process.env.VERCEL ? 'Vercel' : 'Local'}

Voice API Fallback Logic:
1. Provided voiceId parameter
2. process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID (${process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID || 'NOT SET'})
3. process.env.ELEVENLABS_VOICE_ID (${process.env.ELEVENLABS_VOICE_ID || 'NOT SET'})
4. Hardcoded fallback: CO6pxVrMZfyL61ZIglyr

API Key Fallback Logic:
1. process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY (${process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY ? 'SET' : 'NOT SET'})
2. process.env.ELEVENLABS_API_KEY (${process.env.ELEVENLABS_API_KEY ? 'SET' : 'NOT SET'})

🔧 RECOMMENDATIONS:
${!process.env.ELEVENLABS_API_KEY?.startsWith('sk_') ? '❌ Replace masked API key with real ElevenLabs API key' : '✅ API key format looks correct'}
${process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID !== 'CO6pxVrMZfyL61ZIglyr' ? '❌ Set NEXT_PUBLIC_ELEVENLABS_VOICE_ID to CO6pxVrMZfyL61ZIglyr' : '✅ Voice ID is correctly set'}
${!process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY ? '❌ Set NEXT_PUBLIC_ELEVENLABS_API_KEY for client-side access' : '✅ Public API key is set'}
    `.trim()

    return NextResponse.json({ debug: debugInfo })
  } catch (error) {
    return NextResponse.json({ 
      error: 'Debug failed', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 })
  }
}