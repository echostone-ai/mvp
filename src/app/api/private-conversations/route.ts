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
    
    console.log('[api/private-conversations] Fetching conversations for user:', userId, 'avatar:', avatarId);
    
    // Build query - filter by avatar_id if provided
    let query = supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId);
    
    if (avatarId) {
      query = query.eq('avatar_id', avatarId);
    }
    
    const { data: conversations, error } = await query.order('last_active', { ascending: false });
    
    if (error) {
      console.error('[api/private-conversations] Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
    }
    
    console.log('[api/private-conversations] Found conversations:', conversations?.length || 0);
    
    // Transform conversations to include summary data for the UI
    const formattedConversations = conversations?.map(conv => {
      const messages = conv.messages || [];
      const messageCount = messages.length;
      
      // Get the last user message and avatar response
      let lastMessage = '';
      let lastResponse = '';
      
      if (messages.length > 0) {
        // Find the last user message
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === 'user') {
            lastMessage = messages[i].content;
            break;
          }
        }
        
        // Find the last assistant message
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === 'assistant') {
            lastResponse = messages[i].content;
            break;
          }
        }
      }
      
      return {
        id: conv.id,
        userId: conv.user_id,
        messages: messages,
        messageCount,
        lastMessage: lastMessage || 'No messages yet',
        lastResponse: lastResponse || 'No response yet',
        createdAt: conv.created_at,
        updatedAt: conv.updated_at,
        lastActive: conv.last_active
      };
    }) || [];
    
    return NextResponse.json({ 
      success: true, 
      conversations: formattedConversations
    });
    
  } catch (error) {
    console.error('[api/private-conversations] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, conversationId, userId, avatarId, message, shareToken } = body;
    
    if (!userId || !message) {
      return NextResponse.json({ error: 'User ID and message are required' }, { status: 400 });
    }
    
    console.log('[api/private-conversations] Saving message for user:', userId, 'avatar:', avatarId, 'action:', action);
    
    let currentConversationId = conversationId;
    
    if (action === 'add-message') {
      // If we have a conversation ID, update the existing conversation
      if (currentConversationId) {
        // Get the current conversation
        const { data: existingConv, error: fetchError } = await supabase
          .from('conversations')
          .select('messages')
          .eq('id', currentConversationId)
          .eq('user_id', userId)
          .single();
        
        if (fetchError) {
          console.error('[api/private-conversations] Error fetching conversation:', fetchError);
          return NextResponse.json({ error: 'Failed to fetch conversation' }, { status: 500 });
        }
        
        // Add the new message to the existing messages
        const updatedMessages = [...(existingConv.messages || []), message];
        
        // Update the conversation
        const { error: updateError } = await supabase
          .from('conversations')
          .update({
            messages: updatedMessages,
            last_active: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', currentConversationId)
          .eq('user_id', userId);
        
        if (updateError) {
          console.error('[api/private-conversations] Error updating conversation:', updateError);
          return NextResponse.json({ error: 'Failed to update conversation' }, { status: 500 });
        }
      } else {
        // Create a new conversation
        const { data: newConv, error: createError } = await supabase
          .from('conversations')
          .insert({
            user_id: userId,
            avatar_id: avatarId,
            messages: [message],
            last_active: new Date().toISOString()
          })
          .select('id')
          .single();
        
        if (createError) {
          console.error('[api/private-conversations] Error creating conversation:', createError);
          console.error('[api/private-conversations] Insert data was:', { user_id: userId, avatar_id: avatarId, messages: [message] });
          return NextResponse.json({ error: 'Failed to create conversation', details: createError.message }, { status: 500 });
        }
        
        currentConversationId = newConv.id;
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      conversationId: currentConversationId,
      message: 'Message saved successfully' 
    });
    
  } catch (error) {
    console.error('[api/private-conversations] Error saving message:', error);
    console.error('[api/private-conversations] Full error details:', JSON.stringify(error, null, 2));
    return NextResponse.json({ error: 'Failed to save message', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}