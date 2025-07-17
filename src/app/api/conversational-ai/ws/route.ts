/**
 * WebSocket endpoint for real-time conversational AI streaming
 * Handles WebSocket connections, audio streaming, and interruption support
 * 
 * Note: This is a Next.js API route that provides WebSocket connection information
 * The actual WebSocket connection is handled client-side using the WebSocketManager
 */

import { NextRequest, NextResponse } from 'next/server';
import { ConversationalAIService, WebSocketMessage } from '@/lib/conversationalAIService';
import conversationStateManager from '@/lib/conversationStateManager';

// Global conversational AI service instances
const conversationalAIInstances = new Map<string, ConversationalAIService>();

// GET endpoint to get WebSocket connection information
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const conversationId = searchParams.get('conversation_id');

  if (!conversationId) {
    return NextResponse.json(
      { error: 'Missing conversation_id' },
      { status: 400 }
    );
  }

  const conversationState = conversationStateManager.getConversation(conversationId);
  if (!conversationState) {
    return NextResponse.json(
      { error: 'Conversation not found' },
      { status: 404 }
    );
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ElevenLabs API key not configured' },
      { status: 500 }
    );
  }

  try {
    // Initialize conversational AI service if not exists
    if (!conversationalAIInstances.has(conversationId)) {
      const conversationalAI = new ConversationalAIService(apiKey);
      conversationalAIInstances.set(conversationId, conversationalAI);
    }

    return NextResponse.json({
      success: true,
      conversation_id: conversationId,
      websocket_config: {
        // For client-side WebSocket connection to ElevenLabs
        elevenlabs_ws_url: 'wss://api.elevenlabs.io/v1/convai/conversation',
        agent_id: conversationState.agentId,
        voice_id: conversationState.voiceId,
      },
      conversation_state: {
        status: conversationState.status,
        context_length: conversationState.context.length,
        interruption_count: conversationState.interruption_count,
        last_activity: conversationState.last_activity,
      },
    });

  } catch (error) {
    console.error('Error getting WebSocket info:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get WebSocket information',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST endpoint for WebSocket message handling
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversation_id, message_type, data } = body;

    if (!conversation_id) {
      return NextResponse.json(
        { error: 'Missing conversation_id' },
        { status: 400 }
      );
    }

    const conversationState = conversationStateManager.getConversation(conversation_id);
    if (!conversationState) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    const conversationalAI = conversationalAIInstances.get(conversation_id);
    if (!conversationalAI) {
      return NextResponse.json(
        { error: 'Conversational AI service not initialized' },
        { status: 500 }
      );
    }

    let response: any = { success: true };

    switch (message_type) {
      case 'start_streaming': {
        // Start ElevenLabs conversation
        try {
          const elevenlabsConversationId = await conversationalAI.startConversationWithReconnect(
            conversationState.agentId!,
            conversationState.voiceId,
            (message: WebSocketMessage) => {
              // Store message for client polling or use Server-Sent Events
              updateConversationStateFromMessage(conversation_id, message);
            },
            (error: Error) => {
              console.error('ElevenLabs WebSocket error:', error);
              conversationStateManager.updateConversationStatus(conversation_id, 'error');
            }
          );

          conversationStateManager.updateConversationStatus(conversation_id, 'idle');
          response.elevenlabs_conversation_id = elevenlabsConversationId;
          response.status = 'streaming_started';

        } catch (error) {
          console.error('Error starting ElevenLabs conversation:', error);
          conversationStateManager.updateConversationStatus(conversation_id, 'error');
          return NextResponse.json(
            { 
              error: 'Failed to start streaming',
              details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
          );
        }
        break;
      }

      case 'send_audio': {
        if (data?.audio_data) {
          conversationStateManager.updateConversationStatus(conversation_id, 'processing');
          
          // Convert base64 audio to ArrayBuffer if needed
          let audioData = data.audio_data;
          if (typeof audioData === 'string') {
            audioData = Uint8Array.from(atob(audioData), c => c.charCodeAt(0)).buffer;
          }
          
          // Send audio to ElevenLabs
          conversationalAI.sendAudio(conversation_id, audioData);
          
          // Add to context
          conversationStateManager.addContext(conversation_id, `[Audio input at ${new Date().toISOString()}]`);
          response.status = 'audio_sent';
        }
        break;
      }

      case 'send_text': {
        if (data?.text) {
          conversationStateManager.updateConversationStatus(conversation_id, 'processing');
          
          // Send text to ElevenLabs
          conversationalAI.sendText(conversation_id, data.text);
          
          // Add to context
          conversationStateManager.addContext(conversation_id, `User: ${data.text}`);
          response.status = 'text_sent';
        }
        break;
      }

      case 'handle_interruption': {
        conversationStateManager.handleInterruption(conversation_id);
        
        // Send interruption signal to ElevenLabs
        conversationalAI.sendText(conversation_id, '[INTERRUPT]');
        
        const updatedState = conversationStateManager.getConversation(conversation_id);
        response.interruption_count = updatedState?.interruption_count || 0;
        response.status = 'interruption_handled';
        break;
      }

      case 'end_streaming': {
        // End ElevenLabs conversation
        conversationalAI.endConversation(conversation_id);
        conversationStateManager.updateConversationStatus(conversation_id, 'idle');
        response.status = 'streaming_ended';
        break;
      }

      default:
        return NextResponse.json(
          { error: 'Invalid message_type' },
          { status: 400 }
        );
    }

    // Include current conversation state in response
    const updatedState = conversationStateManager.getConversation(conversation_id);
    response.conversation_state = {
      status: updatedState?.status || 'error',
      context_length: updatedState?.context.length || 0,
      interruption_count: updatedState?.interruption_count || 0,
      last_activity: updatedState?.last_activity || new Date(),
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error handling WebSocket message:', error);
    return NextResponse.json(
      { 
        error: 'Failed to handle message',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// DELETE endpoint for cleanup
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const conversationId = searchParams.get('conversation_id');

  if (!conversationId) {
    return NextResponse.json(
      { error: 'Missing conversation_id' },
      { status: 400 }
    );
  }

  try {
    // Clean up conversational AI service
    const conversationalAI = conversationalAIInstances.get(conversationId);
    if (conversationalAI) {
      conversationalAI.endConversation(conversationId);
      conversationalAI.cleanup();
      conversationalAIInstances.delete(conversationId);
    }

    // Clean up conversation state
    conversationStateManager.deleteConversation(conversationId);

    return NextResponse.json({
      success: true,
      message: 'WebSocket connection cleaned up successfully',
    });

  } catch (error) {
    console.error('Error cleaning up WebSocket:', error);
    return NextResponse.json(
      { 
        error: 'Failed to cleanup WebSocket connection',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Update conversation state based on ElevenLabs message
 */
function updateConversationStateFromMessage(conversationId: string, message: WebSocketMessage) {
  conversationStateManager.updateFromWebSocketMessage(
    conversationId,
    message.type,
    message.data
  );
}