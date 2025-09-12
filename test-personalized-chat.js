/**
 * Test script for personalized chat responses
 * Tests the full integration of relationship detection with the jonathan-demo
 */

async function testPersonalizedChat() {
  console.log('🎭 Testing Personalized Chat Integration\n');

  const testMessages = [
    {
      message: "Hey! It's your brother!",
      expectedPersonalization: "Should detect Geoff (Boris) and ask about nephews"
    },
    {
      message: "Hi, it's me, Tyler from Austin",
      expectedPersonalization: "Should detect Tyler and ask about Cansu or yoga"
    },
    {
      message: "It's Krissy, how are you?",
      expectedPersonalization: "Should detect Krissy and be intimate/loving"
    },
    {
      message: "Hey dad!",
      expectedPersonalization: "Should detect Eric Braden and ask about France/Mom"
    },
    {
      message: "Just a regular person asking about your music taste",
      expectedPersonalization: "Should respond normally without personalization"
    }
  ];

  for (const test of testMessages) {
    console.log(`📝 Testing: "${test.message}"`);
    console.log(`   Expected: ${test.expectedPersonalization}`);
    
    try {
      // Simulate the API call
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': `test-session-${Date.now()}`,
          'x-has-interacted': 'false'
        },
        body: JSON.stringify({
          avatarSlug: 'jonathan-demo',
          message: test.message,
          visitorId: `test-visitor-${Date.now()}`
        })
      });

      if (response.ok) {
        const reader = response.body?.getReader();
        let fullResponse = '';
        
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = new TextDecoder().decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.delta) {
                    fullResponse += data.delta;
                  }
                } catch (e) {
                  // Ignore parsing errors for non-JSON lines
                }
              }
            }
          }
        }
        
        console.log(`   ✅ Response: "${fullResponse.trim()}"`);
      } else {
        console.log(`   ❌ Error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.log(`   ❌ Network Error: ${error.message}`);
      console.log('   💡 Make sure the development server is running: npm run dev');
    }
    
    console.log('');
  }

  console.log('✨ Personalized chat test completed!');
  console.log('💡 To run this test, start the dev server first: npm run dev');
}

// Check if we're running in a browser environment
if (typeof window === 'undefined') {
  // Node.js environment - just show the test structure
  console.log('🎭 Personalized Chat Test Structure');
  console.log('This test requires a running development server.');
  console.log('To test:');
  console.log('1. Run: npm run dev');
  console.log('2. Open browser console and run this script');
  console.log('3. Or use a tool like curl to test the API endpoints');
  
  // Show example curl commands
  console.log('\nExample curl commands:');
  console.log('curl -X POST http://localhost:3000/api/chat \\');
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -H "x-session-id: test-session" \\');
  console.log('  -d \'{"avatarSlug": "jonathan-demo", "message": "Hey! It\'s your brother!", "visitorId": "test-visitor"}\'');
} else {
  // Browser environment - run the actual test
  testPersonalizedChat().catch(console.error);
}

// Export for browser use
if (typeof window !== 'undefined') {
  window.testPersonalizedChat = testPersonalizedChat;
}