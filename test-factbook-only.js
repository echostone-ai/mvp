#!/usr/bin/env node

/**
 * Test factbook-only mode with a simple query
 */

async function testFactbookOnly() {
  console.log('🔍 Testing factbook-only mode...');
  
  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        avatarSlug: 'jonathan-demo',
        message: 'Where were you born?'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';

    console.log('📡 Streaming response:');
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            if (data.delta) {
              process.stdout.write(data.delta);
              fullResponse += data.delta;
            }
            
            if (data.event === 'end') {
              console.log('\n\n✅ Response completed');
              console.log(`📝 Full response: "${fullResponse.trim()}"`);
              
              // Check if response contains factbook content
              const hasFactbookContent = fullResponse.toLowerCase().includes('saanichton') || 
                                       fullResponse.toLowerCase().includes('vancouver') ||
                                       fullResponse.toLowerCase().includes('july') ||
                                       fullResponse.toLowerCase().includes('1979');
              
              console.log(`🎯 Contains factbook content: ${hasFactbookContent ? 'YES' : 'NO'}`);
              return;
            }
          } catch (e) {
            // Skip malformed JSON
          }
        }
      }
    }

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

testFactbookOnly();