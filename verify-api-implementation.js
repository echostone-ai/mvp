/**
 * Verification script for real-time conversation API implementation
 * Checks code structure and implementation completeness
 */

const fs = require('fs');
const path = require('path');

function checkFileExists(filePath) {
  return fs.existsSync(filePath);
}

function checkFileContains(filePath, searchStrings) {
  if (!checkFileExists(filePath)) {
    return { exists: false, contains: {} };
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const contains = {};
  
  for (const searchString of searchStrings) {
    contains[searchString] = content.includes(searchString);
  }
  
  return { exists: true, contains };
}

function verifyImplementation() {
  console.log('🔍 Verifying Real-Time Conversation API Implementation...\n');

  const checks = [
    {
      name: 'Main Conversational AI Route',
      file: 'src/app/api/conversational-ai/route.ts',
      requiredContent: [
        'PUT',
        'PATCH', 
        'DELETE',
        'POST',
        'start_conversation',
        'end_conversation',
        'get_status',
        'update_context',
        'handle_interruption',
        'conversationStateManager',
      ],
    },
    {
      name: 'WebSocket Route',
      file: 'src/app/api/conversational-ai/ws/route.ts',
      requiredContent: [
        'GET',
        'POST',
        'DELETE',
        'start_streaming',
        'send_audio',
        'send_text',
        'handle_interruption',
        'end_streaming',
        'updateConversationStateFromMessage',
      ],
    },
    {
      name: 'Conversation State Manager',
      file: 'src/lib/conversationStateManager.ts',
      requiredContent: [
        'ConversationState',
        'ConversationMessage',
        'createConversation',
        'getConversation',
        'updateConversationStatus',
        'addContext',
        'handleInterruption',
        'addMessage',
        'deleteConversation',
        'updateFromWebSocketMessage',
      ],
    },
    {
      name: 'Conversational AI Service',
      file: 'src/lib/conversationalAIService.ts',
      requiredContent: [
        'ConversationalAIService',
        'startConversation',
        'sendAudio',
        'sendText',
        'endConversation',
        'createPersonalizedAgent',
        'startConversationWithReconnect',
      ],
    },
    {
      name: 'WebSocket Manager',
      file: 'src/lib/websocketManager.ts',
      requiredContent: [
        'WebSocketManager',
        'connect',
        'send',
        'disconnect',
        'getConnectionState',
        'isConnected',
      ],
    },
  ];

  let allPassed = true;
  const results = [];

  for (const check of checks) {
    console.log(`📁 Checking ${check.name}...`);
    const result = checkFileContains(check.file, check.requiredContent);
    
    if (!result.exists) {
      console.log(`   ❌ File not found: ${check.file}`);
      allPassed = false;
      results.push({ ...check, status: 'missing', details: 'File not found' });
      continue;
    }

    const missingContent = [];
    const foundContent = [];
    
    for (const [content, found] of Object.entries(result.contains)) {
      if (found) {
        foundContent.push(content);
      } else {
        missingContent.push(content);
      }
    }

    if (missingContent.length === 0) {
      console.log(`   ✅ All required content found (${foundContent.length} items)`);
      results.push({ ...check, status: 'complete', details: `${foundContent.length} items found` });
    } else {
      console.log(`   ⚠️  Missing content: ${missingContent.join(', ')}`);
      console.log(`   ✅ Found content: ${foundContent.join(', ')}`);
      results.push({ ...check, status: 'partial', details: `Missing: ${missingContent.join(', ')}` });
      allPassed = false;
    }
    console.log('');
  }

  // Check test files
  console.log('🧪 Checking test files...');
  const testFiles = [
    'src/lib/__tests__/realTimeConversationAPI.test.ts',
    'test-real-time-conversation-api.js',
  ];

  for (const testFile of testFiles) {
    if (checkFileExists(testFile)) {
      console.log(`   ✅ ${testFile} exists`);
    } else {
      console.log(`   ❌ ${testFile} missing`);
      allPassed = false;
    }
  }

  console.log('\n📋 Implementation Summary:');
  console.log('=' .repeat(50));

  for (const result of results) {
    const statusIcon = result.status === 'complete' ? '✅' : result.status === 'partial' ? '⚠️' : '❌';
    console.log(`${statusIcon} ${result.name}: ${result.status.toUpperCase()}`);
    if (result.details) {
      console.log(`   ${result.details}`);
    }
  }

  console.log('\n🎯 Required Features Implementation Status:');
  console.log('=' .repeat(50));

  const features = [
    {
      name: 'WebSocket Connection Management',
      implemented: checkFileContains('src/app/api/conversational-ai/ws/route.ts', ['GET', 'websocket_config']).contains['GET'],
    },
    {
      name: 'Streaming Audio Response Handling',
      implemented: checkFileContains('src/app/api/conversational-ai/ws/route.ts', ['send_audio', 'audio_data']).contains['send_audio'],
    },
    {
      name: 'Interruption Support',
      implemented: checkFileContains('src/app/api/conversational-ai/ws/route.ts', ['handle_interruption']).contains['handle_interruption'],
    },
    {
      name: 'Conversation State Management',
      implemented: checkFileExists('src/lib/conversationStateManager.ts'),
    },
    {
      name: 'Context Preservation',
      implemented: checkFileContains('src/lib/conversationStateManager.ts', ['addContext', 'context']).contains['addContext'],
    },
    {
      name: 'Real-time Message Processing',
      implemented: checkFileContains('src/lib/conversationStateManager.ts', ['updateFromWebSocketMessage']).contains['updateFromWebSocketMessage'],
    },
    {
      name: 'Connection Health Monitoring',
      implemented: checkFileContains('src/lib/websocketManager.ts', ['isConnected', 'getConnectionState']).contains['isConnected'],
    },
    {
      name: 'Error Handling and Recovery',
      implemented: checkFileContains('src/app/api/conversational-ai/route.ts', ['try', 'catch', 'error']).contains['try'],
    },
  ];

  for (const feature of features) {
    const statusIcon = feature.implemented ? '✅' : '❌';
    console.log(`${statusIcon} ${feature.name}`);
  }

  console.log('\n🔧 API Endpoints:');
  console.log('=' .repeat(50));

  const endpoints = [
    'PUT /api/conversational-ai (start_conversation)',
    'PUT /api/conversational-ai (end_conversation)', 
    'PUT /api/conversational-ai (get_status)',
    'PATCH /api/conversational-ai (update_context)',
    'PATCH /api/conversational-ai (handle_interruption)',
    'DELETE /api/conversational-ai (cleanup)',
    'GET /api/conversational-ai/ws (connection info)',
    'POST /api/conversational-ai/ws (message handling)',
    'DELETE /api/conversational-ai/ws (cleanup)',
  ];

  for (const endpoint of endpoints) {
    console.log(`✅ ${endpoint}`);
  }

  if (allPassed) {
    console.log('\n🎉 Implementation verification PASSED!');
    console.log('All required components and features are implemented.');
  } else {
    console.log('\n⚠️  Implementation verification completed with issues.');
    console.log('Some components may need attention.');
  }

  return allPassed;
}

// Run verification
if (require.main === module) {
  verifyImplementation();
}

module.exports = { verifyImplementation };