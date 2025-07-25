import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('[TEST TRAIN VOICE] API called');
    
    // Test basic functionality
    const body = await request.json();
    console.log('[TEST TRAIN VOICE] Request body:', body);
    
    // Test environment variables
    const hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    const hasSupabaseKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    const hasElevenLabsKey = !!(process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY);
    
    console.log('[TEST TRAIN VOICE] Environment check:', {
      hasSupabaseUrl,
      hasSupabaseKey,
      hasElevenLabsKey
    });
    
    return NextResponse.json({
      success: true,
      message: 'Test endpoint working',
      environment: {
        hasSupabaseUrl,
        hasSupabaseKey,
        hasElevenLabsKey
      },
      receivedData: body
    });
    
  } catch (error: any) {
    console.error('[TEST TRAIN VOICE] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Test endpoint is working'
  });
}