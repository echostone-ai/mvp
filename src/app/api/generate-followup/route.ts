import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { userResponse, conversationHistory, avatarName } = await request.json();

    if (!userResponse) {
      return NextResponse.json({ error: 'User response is required' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    console.log('🤖 Generating follow-up for:', userResponse.substring(0, 50) + '...');

    // Build conversation context
    const conversationContext = conversationHistory
      .map(turn => `${turn.type === 'ai' ? 'AI' : 'User'}: ${turn.text}`)
      .join('\n');

    // Create a prompt for generating follow-up questions
    const prompt = `You are an AI interviewer helping to create a personality profile for an avatar named "${avatarName}". You're having a natural, engaging conversation to learn about this person's personality, experiences, interests, and values.

Previous conversation:
${conversationContext}

User just said: "${userResponse}"

Generate a natural, engaging follow-up question that:
1. Shows you were listening and understood what they shared
2. Digs deeper into their personality, values, or experiences
3. Feels conversational, not like an interview
4. Helps build a rich personality profile
5. Is warm and encouraging

Keep it to 1-2 sentences maximum. Make it feel like a friend asking, not a formal interview.

Examples of good follow-ups:
- "That sounds amazing! What is it about that experience that made it so meaningful to you?"
- "I can hear the passion in your voice when you talk about that. How did you first discover this interest?"
- "That's such an interesting perspective. Can you tell me about a time when that belief really guided a decision you made?"

Follow-up question:`;

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a skilled conversationalist creating engaging follow-up questions for avatar personality profiling. Keep responses natural, warm, and concise.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      return NextResponse.json({ error: 'Failed to generate follow-up' }, { status: 500 });
    }

    const data = await response.json();
    const followUpQuestion = data.choices[0]?.message?.content?.trim() || "That's fascinating! Tell me more about that.";

    console.log('✅ Generated follow-up:', followUpQuestion);

    return NextResponse.json({
      success: true,
      followUpQuestion
    });

  } catch (error) {
    console.error('Follow-up generation error:', error);
    return NextResponse.json({ error: 'Failed to generate follow-up' }, { status: 500 });
  }
}