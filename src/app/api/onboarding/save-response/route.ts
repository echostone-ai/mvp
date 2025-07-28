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

    // Try to save the response to the database
    let data = null;
    try {
      const result = await supabase
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

      if (result.error) {
        console.warn('Database response save failed:', result.error.message);
        // Create mock data for fallback
        data = {
          session_id: sessionId,
          question_index: questionIndex,
          transcript,
          analysis
        };
      } else {
        data = result.data;
      }
    } catch (dbError) {
      console.warn('Database not available for responses:', dbError);
      data = {
        session_id: sessionId,
        question_index: questionIndex,
        transcript,
        analysis
      };
    }

    // Try to update session progress
    try {
      const { error: sessionError } = await supabase
        .from('onboarding_sessions')
        .upsert({
          id: sessionId,
          avatar_id: avatarId,
          current_question: questionIndex + 1,
          total_questions: 6, // Updated for dynamic onboarding questions
          is_complete: questionIndex >= 5, // 0-based index, so 5 means 6 questions completed
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        });

      if (sessionError) {
        console.warn('Session update failed:', sessionError.message);
      }
    } catch (sessionUpdateError) {
      console.warn('Session update not available:', sessionUpdateError);
    }

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