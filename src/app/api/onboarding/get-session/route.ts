import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const avatarId = searchParams.get('avatarId');

    if (!sessionId && !avatarId) {
      return NextResponse.json({ error: 'Missing sessionId or avatarId' }, { status: 400 });
    }

    let session = null;
    let responses = [];

    if (sessionId) {
      // Get existing session
      const { data: sessionData, error: sessionError } = await supabase
        .from('onboarding_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError && sessionError.code !== 'PGRST116') throw sessionError;
      session = sessionData;

      if (session) {
        // Get responses for this session
        const { data: responseData, error: responseError } = await supabase
          .from('onboarding_responses')
          .select('*')
          .eq('session_id', sessionId)
          .order('question_index');

        if (responseError) throw responseError;
        responses = responseData || [];
      }
    } else if (avatarId) {
      // Check if there's an existing incomplete session for this avatar
      const { data: sessionData, error: sessionError } = await supabase
        .from('onboarding_sessions')
        .select('*')
        .eq('avatar_id', avatarId)
        .eq('is_complete', false)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (sessionError && sessionError.code !== 'PGRST116') throw sessionError;
      session = sessionData;

      if (session) {
        // Get responses for this session
        const { data: responseData, error: responseError } = await supabase
          .from('onboarding_responses')
          .select('*')
          .eq('session_id', session.id)
          .order('question_index');

        if (responseError) throw responseError;
        responses = responseData || [];
      }
    }

    return NextResponse.json({
      success: true,
      session,
      responses,
      currentQuestion: session?.current_question || 0,
      isComplete: session?.is_complete || false
    });
  } catch (error) {
    console.error('Get session error:', error);
    return NextResponse.json(
      { error: 'Failed to get session' },
      { status: 500 }
    );
  }
}