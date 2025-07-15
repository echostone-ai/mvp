import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const audioFile = formData.get('audio') as File | null
    
    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 })
    }

    // Basic audio analysis
    const analysis = {
      quality: 'good' as 'good' | 'fair' | 'poor',
      suggestions: [] as string[],
      fileSize: audioFile.size,
      duration: null as number | null,
      format: audioFile.type
    }

    // File size analysis
    if (audioFile.size < 50000) { // Less than 50KB
      analysis.quality = 'poor'
      analysis.suggestions.push('🔊 Audio file seems too small - try recording for longer')
    } else if (audioFile.size > 10000000) { // More than 10MB
      analysis.suggestions.push('📦 Large file size - consider compressing for faster upload')
    }

    // Format analysis
    if (!audioFile.type.includes('audio')) {
      analysis.quality = 'poor'
      analysis.suggestions.push('🎵 File doesn\'t appear to be audio format')
    }

    // Duration estimation (rough)
    if (audioFile.size < 100000) {
      analysis.suggestions.push('⏱️ Try recording for at least 30 seconds for better voice cloning')
    }

    // Quality recommendations
    if (analysis.quality === 'good') {
      analysis.suggestions.push('✅ Audio looks good for voice cloning!')
    } else if (analysis.quality === 'fair') {
      analysis.suggestions.push('⚠️ Audio quality is acceptable but could be improved')
    }

    // General tips
    if (analysis.suggestions.length === 0 || analysis.quality === 'good') {
      analysis.suggestions.push('💡 For best results: quiet room, clear speech, natural pace')
    }

    return NextResponse.json(analysis)

  } catch (err: any) {
    console.error('Analysis error:', err)
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}