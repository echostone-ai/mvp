import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { 
      sessionId, 
      avatarId, 
      questionIndex, 
      question, 
      transcript, 
      analysis, 
      audioUrl 
    } = await request.json();

    if (!sessionId || questionIndex === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Save the response to the database
    const { data, error } = await supabase
      .from('onboarding_responses')
      .upsert({
        session_id: sessionId,
        avatar_id: avatarId,
        question_index: questionIndex,
        question,
        transcript,
        analysis,
        audio_url: audioUrl,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'session_id,question_index'
      })
      .select()
      .single();

    if (error) throw error;

    // Update session progress
    const { error: sessionError } = await supabase
      .from('onboarding_sessions')
      .upsert({
        id: sessionId,
        avatar_id: avatarId,
        current_question: questionIndex + 1,
        total_questions: 4, // Based on onboardingQuestions length
        is_complete: questionIndex >= 3,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      });

    if (sessionError) throw sessionError;

    return NextResponse.json({
      success: true,
      response: data,
      isComplete: questionIndex >= 3
    });
  } catch (error) {
    console.error('Save response error:', error);
    return NextResponse.json(
      { error: 'Failed to save response' },
      { status: 500 }
    );
  }
}