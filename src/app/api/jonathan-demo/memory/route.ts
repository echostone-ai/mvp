import { NextRequest, NextResponse } from 'next/server';
import { JonathanDemoMemoryService } from '@/lib/jonathanDemoMemoryService';

export async function POST(request: NextRequest) {
  try {
    const { action, ...params } = await request.json();
    
    switch (action) {
      case 'warmCache':
        await JonathanDemoMemoryService.warmMemoryCache(params.avatarSlug);
        return NextResponse.json({ success: true });
        
      case 'getMemoryContext':
        const result = await JonathanDemoMemoryService.getComprehensiveMemoryContext(
          params.text, 
          params.avatarSlug
        );
        return NextResponse.json(result);
        
      case 'storeConversationTurn':
        JonathanDemoMemoryService.storeConversationTurnAsync(
          params.userMessage,
          params.assistantResponse,
          params.avatarSlug,
          params.conversationId
        );
        return NextResponse.json({ success: true });
        
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Memory API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}