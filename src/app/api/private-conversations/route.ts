import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const avatarId = url.searchParams.get('avatarId');
    const shareToken = url.searchParams.get('shareToken');
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
    console.log('[api/private-conversations] Fetching conversation for user:', userId, 'avatar:', avatarId);
    
    // For shared avatars, we'll use a simple conversation storage approach
    // In a full implementation, you'd have a proper conversations table
    
    // For now, return a basic conversation structure
    // The actual conversation history will be maintained by the ChatInterface
    const conversation = {
      id: `${userId}_${avatarId || 'default'}`,
      userId,
      avatarId,
      messages: [], // Messages will be loaded from localStorage or other storage
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    return NextResponse.json({ 
      success: true, 
      conversation 
    });
    
  } catch (error) {
    console.error('[api/private-conversations] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, avatarId, message, shareToken } = body;
    
    if (!userId || !message) {
      return NextResponse.json({ error: 'User ID and message are required' }, { status: 400 });
    }
    
    console.log('[api/private-conversations] Saving message for user:', userId, 'avatar:', avatarId);
    
    // In a full implementation, you'd save the message to a conversations table
    // For now, we'll just return success since the ChatInterface handles message storage
    
    return NextResponse.json({ 
      success: true, 
      message: 'Message saved successfully' 
    });
    
  } catch (error) {
    console.error('[api/private-conversations] Error saving message:', error);
    return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
  }
}