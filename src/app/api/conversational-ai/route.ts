/**
 * Conversational AI API Endpoint
 * Handles WebSocket connections and real-time streaming conversations
 */

import { NextRequest, NextResponse } from 'next/server';
import { createEnhancedVoiceSystem, EnhancedVoiceSystemConfig } from '@/lib/enhancedVoiceSystem';
import { HybridVoiceConfig } from '@/lib/hybridVoiceService';
import { ConversationalAIService, PersonalityIntegration, WebSocketMessage } from '@/lib/conversationalAIService';
import { WebSocketManager } from '@/lib/websocketManager';
import conversationStateManager from '@/lib/conversationStateManager';

// Global instances for managing WebSocket connections
const wsManager = new WebSocketManager();

// GET endpoint for testing system initialization
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const voiceId = searchParams.get('voiceId');

    if (!userId || !voiceId) {
      return NextResponse.json(
        { error: 'Missing required parameters: userId, voiceId' },
        { status: 400 }
      );
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      );
    }

    // Create test configuration
    const voiceConfig: HybridVoiceConfig = {
      conversational_ai_enabled: true,
      fallback_to_turbo: true,
      voice_id: voiceId,
      personality_integration: {
        profile_data: {
          id: userId,
          name: 'Test User',
          preferences: {},
          memory_context: [],
        },
        conversation_style: {
          formality: 'casual',
          humor_level: 0.7,
          empathy_level: 0.8,
          response_length: 'medium',
        },
        emotional_preferences: {
          default_emotion: 'neutral',
          emotional_range: 0.8,
          context_sensitivity: 0.7,
          adaptation_speed: 0.6,
        },
        knowledge_base_entries: [
          'This is a test conversation with EchoStone\'s enhanced voice system.',
        ],
      },
    };

    const systemConfig: EnhancedVoiceSystemConfig = {
      apiKey,
      userId,
      voiceConfig,
    };

    // Initialize the voice system
    const voiceSystem = createEnhancedVoiceSystem(systemConfig);
    await voiceSystem.initialize();

    return NextResponse.json({
      success: true,
      message: 'Enhanced Voice System initialized successfully',
      userId,
      voiceId,
      features: {
        conversational_ai: voiceConfig.conversational_ai_enabled,
        fallback_enabled: voiceConfig.fallback_to_turbo,
        personality_integration: true,
      },
    });

  } catch (error) {
    console.error('Error in conversational AI endpoint:', error);
    return NextResponse.json(
      { 
        error: 'Failed to initialize Enhanced Voice System',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// PUT endpoint for starting WebSocket conversations
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, voiceId, personalityData, action } = body;

    if (!userId || !voiceId) {
      return NextResponse.json(
        { error: 'Missing required parameters: userId, voiceId' },
        { status: 400 }
      );
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      );
    }

    const conversationalAI = new ConversationalAIService(apiKey);

    switch (action) {
      case 'start_conversation': {
        // Create personality integration from user data
        const personalityIntegration: PersonalityIntegration = {
          profile_data: {
            id: userId,
            name: personalityData?.name || 'User',
            preferences: personalityData?.preferences || {},
            memory_context: personalityData?.memory_context || [],
          },
          conversation_style: {
            formality: personalityData?.conversation_style?.formality || 'casual',
            humor_level: personalityData?.conversation_style?.humor_level || 0.7,
            empathy_level: personalityData?.conversation_style?.empathy_level || 0.8,
            response_length: personalityData?.conversation_style?.response_length || 'medium',
          },
          emotional_preferences: {
            default_emotion: personalityData?.emotional_preferences?.default_emotion || 'neutral',
            emotional_range: personalityData?.emotional_preferences?.emotional_range || 0.8,
            context_sensitivity: personalityData?.emotional_preferences?.context_sensitivity || 0.7,
            adaptation_speed: personalityData?.emotional_preferences?.adaptation_speed || 0.6,
          },
          knowledge_base_entries: personalityData?.knowledge_base_entries || [],
        };

        // Create or get agent
        let agentId = personalityData?.agent_id;
        if (!agentId) {
          agentId = await conversationalAI.createPersonalizedAgent(voiceId, personalityIntegration);
        }

        // Generate conversation ID
        const conversationId = `conv_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Initialize conversation state using the state manager
        const conversationState = conversationStateManager.createConversation(
          conversationId,
          userId,
          voiceId,
          agentId
        );

        return NextResponse.json({
          success: true,
          conversation_id: conversationId,
          agent_id: agentId,
          websocket_url: `/api/conversational-ai/ws?conversation_id=${conversationId}`,
          status: 'ready',
        });
      }

      case 'end_conversation': {
        const conversationId = body.conversation_id;
        if (!conversationId) {
          return NextResponse.json(
            { error: 'Missing conversation_id' },
            { status: 400 }
          );
        }

        // Clean up conversation
        wsManager.disconnect(conversationId);
        conversationStateManager.deleteConversation(conversationId);

        return NextResponse.json({
          success: true,
          message: 'Conversation ended successfully',
        });
      }

      case 'get_status': {
        const conversationId = body.conversation_id;
        if (!conversationId) {
          return NextResponse.json(
            { error: 'Missing conversation_id' },
            { status: 400 }
          );
        }

        const state = conversationStateManager.getConversation(conversationId);
        if (!state) {
          return NextResponse.json(
            { error: 'Conversation not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          conversation: {
            id: state.id,
            status: state.status,
            created_at: state.created_at,
            last_activity: state.last_activity,
            context_length: state.context.length,
            interruption_count: state.interruption_count,
            is_connected: wsManager.isConnected(conversationId),
          },
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error in conversational AI WebSocket endpoint:', error);
    return NextResponse.json(
      { 
        error: 'Failed to handle WebSocket request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// PATCH endpoint for conversation management
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversation_id, action, data } = body;

    if (!conversation_id) {
      return NextResponse.json(
        { error: 'Missing conversation_id' },
        { status: 400 }
      );
    }

    const state = conversationStateManager.getConversation(conversation_id);
    if (!state) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    switch (action) {
      case 'update_context': {
        if (data?.context) {
          conversationStateManager.addContext(conversation_id, data.context);
        }
        break;
      }

      case 'handle_interruption': {
        conversationStateManager.handleInterruption(conversation_id);
        
        // Send interruption signal through WebSocket if connected
        if (wsManager.isConnected(conversation_id)) {
          wsManager.send(conversation_id, {
            type: 'interruption',
            data: { 
              interruption_count: state.interruption_count,
              timestamp: Date.now()
            },
          });
        }
        break;
      }

      case 'update_status': {
        if (data?.status) {
          conversationStateManager.updateConversationStatus(conversation_id, data.status);
        }
        break;
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    // Get updated state
    const updatedState = conversationStateManager.getConversation(conversation_id);
    
    return NextResponse.json({
      success: true,
      conversation: {
        id: updatedState!.id,
        status: updatedState!.status,
        context_length: updatedState!.context.length,
        interruption_count: updatedState!.interruption_count,
      },
    });

  } catch (error) {
    console.error('Error updating conversation:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update conversation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// DELETE endpoint for cleanup
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const conversationId = searchParams.get('conversation_id');
    const userId = searchParams.get('userId');

    if (conversationId) {
      // Clean up specific conversation
      wsManager.disconnect(conversationId);
      conversationStateManager.deleteConversation(conversationId);
      
      return NextResponse.json({
        success: true,
        message: 'Conversation cleaned up successfully',
      });
    } else if (userId) {
      // Clean up all conversations for user
      const cleanedCount = conversationStateManager.deleteUserConversations(userId);
      
      // Also disconnect WebSocket connections for the user
      const userConversations = conversationStateManager.getUserConversations(userId);
      for (const conversation of userConversations) {
        wsManager.disconnect(conversation.id);
      }
      
      return NextResponse.json({
        success: true,
        message: `Cleaned up ${cleanedCount} conversations for user`,
      });
    } else {
      return NextResponse.json(
        { error: 'Missing conversation_id or userId' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Error cleaning up conversations:', error);
    return NextResponse.json(
      { 
        error: 'Failed to cleanup conversations',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST endpoint for voice generation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, voiceId, text, emotionalContext, conversationContext } = body;

    if (!userId || !voiceId || !text) {
      return NextResponse.json(
        { error: 'Missing required parameters: userId, voiceId, text' },
        { status: 400 }
      );
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      );
    }

    // Create voice system configuration
    const voiceConfig: HybridVoiceConfig = {
      conversational_ai_enabled: true,
      fallback_to_turbo: true,
      voice_id: voiceId,
      personality_integration: {
        profile_data: {
          id: userId,
          name: 'User',
          preferences: {},
          memory_context: [],
        },
        conversation_style: {
          formality: 'casual',
          humor_level: 0.7,
          empathy_level: 0.8,
          response_length: 'medium',
        },
        emotional_preferences: {
          default_emotion: emotionalContext || 'neutral',
          emotional_range: 0.8,
          context_sensitivity: 0.7,
          adaptation_speed: 0.6,
        },
        knowledge_base_entries: [],
      },
    };

    const systemConfig: EnhancedVoiceSystemConfig = {
      apiKey,
      userId,
      voiceConfig,
    };

    // Generate voice response
    const voiceSystem = createEnhancedVoiceSystem(systemConfig);
    await voiceSystem.initialize();

    const response = await voiceSystem.generateVoiceResponse({
      text,
      voice_id: voiceId,
      emotional_context: emotionalContext,
      conversation_context: conversationContext,
      use_conversational_ai: conversationContext === 'real-time',
    });

    // Clean up
    voiceSystem.cleanup();

    return NextResponse.json({
      success: true,
      response: {
        text: response.text,
        generation_method: response.generation_method,
        emotional_context: response.emotional_context,
        has_audio: !!response.audio_data || !!response.audio_url,
      },
    });

  } catch (error) {
    console.error('Error generating voice response:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate voice response',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}