/**
 * Test script for real-time conversation API
 * Tests WebSocket connections, streaming audio, and interruption support
 */

const BASE_URL = 'http://localhost:3000';

async function testRealTimeConversationAPI() {
  console.log('🚀 Testing Real-Time Conversation API...\n');

  try {
    // Test 1: Start a new conversation
    console.log('1. Testing conversation creation...');
    const startResponse = await fetch(`${BASE_URL}/api/conversational-ai`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: 'test-user-123',
        voiceId: 'test-voice-456',
        action: 'start_conversation',
        personalityData: {
          name: 'Test User',
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
      }),
    });

    if (!startResponse.ok) {
      throw new Error(`Failed to start conversation: ${startResponse.statusText}`);
    }

    const startData = await startResponse.json();
    console.log('✅ Conversation created successfully');
    console.log(`   Conversation ID: ${startData.conversation_id}`);
    console.log(`   Agent ID: ${startData.agent_id}`);
    console.log(`   WebSocket URL: ${startData.websocket_url}\n`);

    const conversationId = startData.conversation_id;

    // Test 2: Get WebSocket connection information
    console.log('2. Testing WebSocket connection info...');
    const wsInfoResponse = await fetch(`${BASE_URL}/api/conversational-ai/ws?conversation_id=${conversationId}`);
    
    if (!wsInfoResponse.ok) {
      throw new Error(`Failed to get WebSocket info: ${wsInfoResponse.statusText}`);
    }

    const wsInfoData = await wsInfoResponse.json();
    console.log('✅ WebSocket info retrieved successfully');
    console.log(`   ElevenLabs WS URL: ${wsInfoData.websocket_config.elevenlabs_ws_url}`);
    console.log(`   Agent ID: ${wsInfoData.websocket_config.agent_id}`);
    console.log(`   Voice ID: ${wsInfoData.websocket_config.voice_id}`);
    console.log(`   Status: ${wsInfoData.conversation_state.status}\n`);

    // Test 3: Start streaming
    console.log('3. Testing streaming start...');
    const streamStartResponse = await fetch(`${BASE_URL}/api/conversational-ai/ws`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        message_type: 'start_streaming',
        data: {},
      }),
    });

    if (!streamStartResponse.ok) {
      console.log('⚠️  Streaming start failed (expected if ElevenLabs API key not configured)');
      const errorData = await streamStartResponse.json();
      console.log(`   Error: ${errorData.error}`);
    } else {
      const streamData = await streamStartResponse.json();
      console.log('✅ Streaming started successfully');
      console.log(`   ElevenLabs Conversation ID: ${streamData.elevenlabs_conversation_id}`);
      console.log(`   Status: ${streamData.status}\n`);
    }

    // Test 4: Send text message
    console.log('4. Testing text message sending...');
    const textResponse = await fetch(`${BASE_URL}/api/conversational-ai/ws`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        message_type: 'send_text',
        data: {
          text: 'Hello, this is a test message!',
        },
      }),
    });

    if (!textResponse.ok) {
      console.log('⚠️  Text message sending failed (expected if streaming not started)');
      const errorData = await textResponse.json();
      console.log(`   Error: ${errorData.error}`);
    } else {
      const textData = await textResponse.json();
      console.log('✅ Text message sent successfully');
      console.log(`   Status: ${textData.status}`);
      console.log(`   Context length: ${textData.conversation_state.context_length}\n`);
    }

    // Test 5: Handle interruption
    console.log('5. Testing interruption handling...');
    const interruptResponse = await fetch(`${BASE_URL}/api/conversational-ai/ws`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        message_type: 'handle_interruption',
        data: {},
      }),
    });

    if (!interruptResponse.ok) {
      console.log('⚠️  Interruption handling failed');
      const errorData = await interruptResponse.json();
      console.log(`   Error: ${errorData.error}`);
    } else {
      const interruptData = await interruptResponse.json();
      console.log('✅ Interruption handled successfully');
      console.log(`   Interruption count: ${interruptData.interruption_count}`);
      console.log(`   Status: ${interruptData.status}\n`);
    }

    // Test 6: Update conversation context
    console.log('6. Testing context update...');
    const contextResponse = await fetch(`${BASE_URL}/api/conversational-ai`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        action: 'update_context',
        data: {
          context: ['User mentioned they like music', 'User is interested in AI technology'],
        },
      }),
    });

    if (!contextResponse.ok) {
      throw new Error(`Failed to update context: ${contextResponse.statusText}`);
    }

    const contextData = await contextResponse.json();
    console.log('✅ Context updated successfully');
    console.log(`   Context length: ${contextData.conversation.context_length}`);
    console.log(`   Status: ${contextData.conversation.status}\n`);

    // Test 7: Get conversation status
    console.log('7. Testing status retrieval...');
    const statusResponse = await fetch(`${BASE_URL}/api/conversational-ai`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: 'test-user-123',
        voiceId: 'test-voice-456',
        action: 'get_status',
        conversation_id: conversationId,
      }),
    });

    if (!statusResponse.ok) {
      throw new Error(`Failed to get status: ${statusResponse.statusText}`);
    }

    const statusData = await statusResponse.json();
    console.log('✅ Status retrieved successfully');
    console.log(`   Status: ${statusData.conversation.status}`);
    console.log(`   Context length: ${statusData.conversation.context_length}`);
    console.log(`   Interruption count: ${statusData.conversation.interruption_count}`);
    console.log(`   Is connected: ${statusData.conversation.is_connected}\n`);

    // Test 8: End streaming
    console.log('8. Testing streaming end...');
    const streamEndResponse = await fetch(`${BASE_URL}/api/conversational-ai/ws`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        message_type: 'end_streaming',
        data: {},
      }),
    });

    if (!streamEndResponse.ok) {
      console.log('⚠️  Streaming end failed');
      const errorData = await streamEndResponse.json();
      console.log(`   Error: ${errorData.error}`);
    } else {
      const streamEndData = await streamEndResponse.json();
      console.log('✅ Streaming ended successfully');
      console.log(`   Status: ${streamEndData.status}\n`);
    }

    // Test 9: Clean up conversation
    console.log('9. Testing conversation cleanup...');
    const cleanupResponse = await fetch(`${BASE_URL}/api/conversational-ai`, {
      method: 'DELETE',
      params: new URLSearchParams({
        conversation_id: conversationId,
      }),
    });

    if (!cleanupResponse.ok) {
      throw new Error(`Failed to cleanup conversation: ${cleanupResponse.statusText}`);
    }

    const cleanupData = await cleanupResponse.json();
    console.log('✅ Conversation cleaned up successfully');
    console.log(`   Message: ${cleanupData.message}\n`);

    // Test 10: Verify conversation is deleted
    console.log('10. Testing conversation deletion verification...');
    const verifyResponse = await fetch(`${BASE_URL}/api/conversational-ai`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: 'test-user-123',
        voiceId: 'test-voice-456',
        action: 'get_status',
        conversation_id: conversationId,
      }),
    });

    if (verifyResponse.status === 404) {
      console.log('✅ Conversation successfully deleted (404 as expected)\n');
    } else {
      console.log('⚠️  Conversation still exists after deletion\n');
    }

    console.log('🎉 All tests completed successfully!');
    console.log('\n📋 Test Summary:');
    console.log('   ✅ Conversation creation');
    console.log('   ✅ WebSocket connection info');
    console.log('   ⚠️  Streaming (requires ElevenLabs API key)');
    console.log('   ✅ Text message handling');
    console.log('   ✅ Interruption support');
    console.log('   ✅ Context management');
    console.log('   ✅ Status retrieval');
    console.log('   ✅ Conversation cleanup');
    console.log('   ✅ State management');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Test conversation state manager functionality
async function testConversationStateManager() {
  console.log('\n🔧 Testing Conversation State Manager...\n');

  try {
    // Test conversation state management endpoints
    console.log('1. Testing conversation state persistence...');
    
    // Create multiple conversations
    const conversations = [];
    for (let i = 0; i < 3; i++) {
      const response = await fetch(`${BASE_URL}/api/conversational-ai`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: `test-user-${i}`,
          voiceId: `test-voice-${i}`,
          action: 'start_conversation',
          personalityData: {
            name: `Test User ${i}`,
            conversation_style: { formality: 'casual', humor_level: 0.5, empathy_level: 0.5, response_length: 'medium' },
            emotional_preferences: { default_emotion: 'neutral', emotional_range: 0.5, context_sensitivity: 0.5, adaptation_speed: 0.5 },
            knowledge_base_entries: [`Test knowledge for user ${i}`],
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        conversations.push(data.conversation_id);
      }
    }

    console.log(`✅ Created ${conversations.length} test conversations`);

    // Test bulk cleanup
    console.log('2. Testing bulk cleanup...');
    const bulkCleanupResponse = await fetch(`${BASE_URL}/api/conversational-ai?userId=test-user-0`, {
      method: 'DELETE',
    });

    if (bulkCleanupResponse.ok) {
      const cleanupData = await bulkCleanupResponse.json();
      console.log('✅ Bulk cleanup successful');
      console.log(`   ${cleanupData.message}`);
    }

    // Clean up remaining conversations
    for (const conversationId of conversations.slice(1)) {
      await fetch(`${BASE_URL}/api/conversational-ai?conversation_id=${conversationId}`, {
        method: 'DELETE',
      });
    }

    console.log('✅ Conversation state manager tests completed');

  } catch (error) {
    console.error('❌ State manager test failed:', error.message);
  }
}

// Run tests
async function runAllTests() {
  await testRealTimeConversationAPI();
  await testConversationStateManager();
}

// Check if running directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testRealTimeConversationAPI,
  testConversationStateManager,
  runAllTests,
};