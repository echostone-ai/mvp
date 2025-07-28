import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { avatarId, userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Generate a unique session ID using crypto.randomUUID()
    const sessionId = crypto.randomUUID();

    // Create new onboarding session
    const { data: session, error } = await supabase
      .from('onboarding_sessions')
      .insert({
        id: sessionId,
        avatar_id: avatarId,
        user_id: userId,
        current_question: 0,
        total_questions: 6,
        is_complete: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      session,
      sessionId
    });
  } catch (error) {
    console.error('Create session error:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}