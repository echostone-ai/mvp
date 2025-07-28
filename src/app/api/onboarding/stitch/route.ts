import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { audioFiles } = await request.json();

    if (!audioFiles || audioFiles.length === 0) {
      return NextResponse.json({ error: 'No audio files provided' }, { status: 400 });
    }

    console.log('🎵 Stitching', audioFiles.length, 'audio files');

    // Convert base64 audio files to buffers
    const audioBuffers = audioFiles.map((base64Audio: string) => {
      // Remove data URL prefix (data:audio/wav;base64,)
      const base64Data = base64Audio.split(',')[1];
      return Buffer.from(base64Data, 'base64');
    });

    // Simple concatenation approach (not ideal but functional)
    // In a production system, you'd use FFmpeg or Web Audio API for proper stitching
    const totalLength = audioBuffers.reduce((sum, buffer) => sum + buffer.length, 0);
    const stitchedBuffer = Buffer.alloc(totalLength);
    
    let offset = 0;
    audioBuffers.forEach(buffer => {
      buffer.copy(stitchedBuffer, offset);
      offset += buffer.length;
    });

    // Convert back to base64 for response
    const stitchedBase64 = `data:audio/wav;base64,${stitchedBuffer.toString('base64')}`;

    console.log('✅ Audio stitching completed, total size:', stitchedBuffer.length, 'bytes');

    return NextResponse.json({
      success: true,
      stitchedAudio: stitchedBase64,
      originalCount: audioFiles.length,
      totalSize: stitchedBuffer.length,
      message: 'Audio files stitched successfully',
    });
  } catch (error) {
    console.error('❌ Audio stitching error:', error);
    return NextResponse.json(
      { error: 'Failed to stitch audio files' },
      { status: 500 }
    );
  }
}