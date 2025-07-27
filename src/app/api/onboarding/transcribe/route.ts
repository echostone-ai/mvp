import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioBlob = formData.get('audioBlob') as File;

    if (!audioBlob) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // Transcribe with OpenAI Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: audioBlob,
      model: 'whisper-1',
      response_format: 'text',
    });

    // Analyze the transcript with Claude/GPT
    const analysisPrompt = `
You're an AI helping build a memory-based digital profile. Given this transcript, summarize the story, detect the speaker's tone, and list life insights. Return JSON with summary, tone, memories, keywords, and candidate_profile_fields.

Transcript: "${transcription}"

Return a JSON object with:
- summary: Brief summary of what was shared
- tone: Emotional tone (nostalgic, excited, thoughtful, etc.)
- keywords: Array of key people, places, activities mentioned
- insights: Array of personality insights or values expressed
`;

    const analysisResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at analyzing personal stories and extracting meaningful insights. Always respond with valid JSON.',
        },
        {
          role: 'user',
          content: analysisPrompt,
        },
      ],
      temperature: 0.3,
    });

    let analysis;
    try {
      analysis = JSON.parse(analysisResponse.choices[0].message.content || '{}');
    } catch (parseError) {
      console.error('Error parsing analysis JSON:', parseError);
      analysis = {
        summary: transcription.substring(0, 100) + '...',
        tone: 'neutral',
        keywords: [],
        insights: [],
      };
    }

    return NextResponse.json({
      text: transcription,
      analysis,
    });
  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json(
      { error: 'Failed to transcribe audio' },
      { status: 500 }
    );
  }
}