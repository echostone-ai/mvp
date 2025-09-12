/**
 * Conversation Export API
 * Provides endpoints for exporting and sharing conversations
 */

import { NextRequest, NextResponse } from 'next/server';
import { ConversationExportService } from '@/lib/services/conversationExportService';

const exportService = ConversationExportService.getInstance();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const shareId = searchParams.get('shareId');

    switch (action) {
      case 'get_shared':
        if (!shareId) {
          return NextResponse.json(
            { error: 'shareId is required' },
            { status: 400 }
          );
        }
        const sharedConversation = exportService.getSharedConversation(shareId);
        if (!sharedConversation) {
          return NextResponse.json(
            { error: 'Shared conversation not found' },
            { status: 404 }
          );
        }
        return NextResponse.json({ conversation: sharedConversation });

      default:
        return NextResponse.json(
          { error: 'Invalid action parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Export API GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'export_conversation':
        const { conversationId, userId, options } = body;
        if (!conversationId || !userId || !options) {
          return NextResponse.json(
            { error: 'conversationId, userId, and options are required' },
            { status: 400 }
          );
        }
        
        const exportResult = await exportService.exportConversation(conversationId, userId, options);
        return NextResponse.json({ export: exportResult });

      case 'share_conversation':
        const { conversationId: shareConversationId, userId: shareUserId, shareOptions } = body;
        if (!shareConversationId || !shareUserId || !shareOptions) {
          return NextResponse.json(
            { error: 'conversationId, userId, and shareOptions are required' },
            { status: 400 }
          );
        }
        
        const shareResult = await exportService.shareConversation(shareConversationId, shareUserId, shareOptions);
        return NextResponse.json({ shared: shareResult });

      case 'generate_summary':
        const { conversationId: summaryConversationId } = body;
        if (!summaryConversationId) {
          return NextResponse.json(
            { error: 'conversationId is required' },
            { status: 400 }
          );
        }
        
        const summary = exportService.generateConversationSummary(summaryConversationId);
        return NextResponse.json({ summary });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Export API POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}