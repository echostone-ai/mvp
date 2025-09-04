#!/usr/bin/env node

/**
 * Test Demo Chat API Directly to see if identity resolution is fixed
 */

async function testDemoChatAPI() {
  console.log('🚀 Testing Demo Chat API with Fixed Identity Resolution\n');

  const testQueries = [
    {
      name: 'Favorite Music Query',
      message: "What's your favorite music?",
      expected: 'Should mention Nirvana with rich details'
    },
    {
      name: 'Dog Count Query', 
      message: "How many dogs have you had?",
      expected: 'Should enumerate Romeo, Bucky, George, Olive with details'
    },
    {
      name: 'Current Dog Query',
      message: "Tell me about Romeo.",
      expected: 'Should describe Romeo as toy poodle born Valentine\'s Day 2024'
    }
  ];

  for (const query of testQueries) {
    console.log(`📝 Testing: ${query.name}`);
    console.log(`Query: "${query.message}"`);
    console.log(`Expected: ${query.expected}\n`);

    try {
      const response = await fetch('http://localhost:3000/api/demo-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: query.message,
          debug: true
        })
      });

      if (!response.ok) {
        console.error(`❌ API request failed: ${response.status} ${response.statusText}`);
        
        // Try to read error response
        try {
          const errorText = await response.text();
          console.error(`Error details: ${errorText}`);
        } catch (e) {
          console.error('Could not read error response');
        }
        continue;
      }

      // Read the streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        console.error('❌ No response body reader available');
        continue;
      }

      let fullResponse = '';
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        fullResponse += chunk;
      }

      console.log(`✅ Response received (${fullResponse.length} chars):`);
      console.log(`"${fullResponse}"`);
      
      // Check for rich content vs basic responses
      const lowerResponse = fullResponse.toLowerCase();
      let hasRichContent = false;
      let hasBasicContent = false;
      
      if (query.name.includes('Music')) {
        hasRichContent = lowerResponse.includes('nirvana') && 
                        (lowerResponse.includes('sound') || lowerResponse.includes('emotion') || lowerResponse.includes('kurt'));
        hasBasicContent = lowerResponse.includes('nirvana') && fullResponse.length < 50;
      } else if (query.name.includes('Count')) {
        hasRichContent = (lowerResponse.includes('romeo') && lowerResponse.includes('bucky')) &&
                        (lowerResponse.includes('four') || lowerResponse.includes('total')) &&
                        fullResponse.length > 100;
        hasBasicContent = lowerResponse.includes('dog') && fullResponse.length < 50;
      } else if (query.name.includes('Romeo')) {
        hasRichContent = lowerResponse.includes('romeo') && 
                        (lowerResponse.includes('poodle') || lowerResponse.includes('valentine')) &&
                        fullResponse.length > 80;
        hasBasicContent = lowerResponse.includes('romeo') && fullResponse.length < 50;
      }
      
      if (hasRichContent) {
        console.log(`✅ RICH CONTENT: Response contains detailed information`);
      } else if (hasBasicContent) {
        console.log(`⚠️  BASIC CONTENT: Response is too brief/generic`);
      } else {
        console.log(`❌ MISSING CONTENT: Response doesn't contain expected information`);
      }
      
    } catch (error) {
      console.error(`❌ Test failed for "${query.name}":`, error.message);
    }
    
    console.log('\n' + '='.repeat(80) + '\n');
  }
}

async function runTest() {
  console.log('🎯 Demo Chat API Test - Rich Memory Content Validation\n');
  
  try {
    await testDemoChatAPI();
  } catch (error) {
    console.log('⚠️ API tests failed - server may not be running');
    console.log('   Start the development server with: npm run dev');
    console.log('   Then run this test again to validate API endpoints');
    console.log(`   Error: ${error.message}`);
  }

  console.log('\n🎉 Demo Chat API test completed!');
}

// Run test
runTest().catch(console.error);