import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      return NextResponse.json({ 
        error: 'No audio file provided' 
      }, { status: 400 });
    }
    
    // Basic file validation
    const analysis = {
      fileSize: audioFile.size,
      fileType: audioFile.type,
      fileName: audioFile.name,
      duration: null, // Would need audio processing library to get actual duration
      quality: 'unknown',
      warnings: [] as string[],
      recommendations: [] as string[]
    };
    
    // File size checks
    if (audioFile.size < 100000) { // Less than 100KB
      analysis.warnings.push('File is very small - may be too short for good voice training');
      analysis.recommendations.push('Record at least 30 seconds of clear speech');
    }
    
    if (audioFile.size > 50 * 1024 * 1024) { // More than 50MB
      analysis.warnings.push('File is very large - may cause upload issues');
      analysis.recommendations.push('Consider compressing the audio or splitting into smaller files');
    }
    
    // File type checks
    const supportedTypes = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/m4a', 'audio/flac', 'audio/ogg', 'audio/webm'];
    if (!supportedTypes.includes(audioFile.type)) {
      analysis.warnings.push('File type may not be optimal for voice training');
      analysis.recommendations.push('Use MP3, WAV, or M4A format for best results');
    }
    
    // File name analysis (basic heuristics)
    const fileName = audioFile.name.toLowerCase();
    if (fileName.includes('generated') || fileName.includes('synthetic') || fileName.includes('ai') || fileName.includes('tts')) {
      analysis.warnings.push('File name suggests this might be AI-generated audio');
      analysis.recommendations.push('Only use original recordings of your own voice');
    }
    
    // Determine overall quality assessment
    if (analysis.warnings.length === 0) {
      analysis.quality = 'good';
    } else if (analysis.warnings.length <= 2) {
      analysis.quality = 'fair';
    } else {
      analysis.quality = 'poor';
    }
    
    return NextResponse.json({
      success: true,
      analysis
    });
    
  } catch (error: any) {
    console.error('[ANALYZE VOICE QUALITY] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to analyze audio',
      details: error.message 
    }, { status: 500 });
  }
}