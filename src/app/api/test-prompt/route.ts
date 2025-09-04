import { NextRequest, NextResponse } from 'next/server';
import { EnhancedPromptBuilder } from '@/lib/services/enhancedPromptBuilder';

export async function POST(req: NextRequest) {
  try {
    const { 
      query = "who's romeo?", 
      avatarSlug = 'jonathan-demo',
      conversationHistory = []
    } = await req.json();

    const enhancedBuilder = new EnhancedPromptBuilder();
    const result = await enhancedBuilder.buildEnhancedSystemPromptWithStyle(
      avatarSlug,
      query,
      conversationHistory,
      { priorityFilter: 6, memoryLimit: 8, trackExpressions: true }
    );

    return NextResponse.json({
      success: true,
      query,
      conversationHistory,
      prompt: result.prompt,
      metadata: result.metadata
    });
  } catch (error) {
    console.error('Test prompt error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to this endpoint to test prompt generation',
    example: {
      query: "who's romeo?",
      avatarSlug: "jonathan-demo"
    }
  });
}