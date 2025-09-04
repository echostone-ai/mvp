#!/usr/bin/env node

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function testFixedChat() {
  console.log('Testing fixed chat implementation...');
  
  const testQueries = [
    "How long were you in Austin?",
    "Where does your friend Tyler live?", 
    "Tell me about Olive.",
    "What do you think of Trump?"
  ];
  
  for (const query of testQueries) {
    console.log(`\n🧪 Testing: "${query}"`);
    
    try {
      const response = await fetch(`${BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          avatarSlug: 'jonathan-demo',
          message: query
        })
      });

      if (!response.ok) {
        console.log(`   ❌ HTTP ${response.status}: ${response.statusText}`);
        continue;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        console.log('   ❌ No response body');
        continue;
      }

      let fastContent = '';
      let deepContent = '';
      let metadata = null;
      let streamEnded = false;
      
      const decoder = new TextDecoder();
      const timeout = setTimeout(() => {
        console.log('   ⏰ Timeout after 10s');
        reader.cancel();
      }, 10000);
      
      try {
        while (!streamEnded) {
          const { done, value } = await reader.read();
          if (done) {
            streamEnded = true;
            break;
          }
          
          const text = decoder.decode(value);
          const lines = text.split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.channel === 'fast') {
                fastContent += data.delta || '';
              } else if (data.channel === 'deep') {
                deepContent += data.delta || '';
              } else if (data.event === 'meta') {
                metadata = data;
              } else if (data.event === 'end') {
                streamEnded = true;
                break;
              }
            } catch (e) {
              // Skip malformed JSON
            }
          }
        }
      } finally {
        clearTimeout(timeout);
      }
      
      const totalResponse = fastContent + deepContent;
      
      console.log(`   Intent: ${metadata?.intent}`);
      console.log(`   Deep started: ${metadata?.t_deep_started_ms}ms`);
      console.log(`   Deep merge: ${metadata?.deep_merge}`);
      console.log(`   Pinned count: ${metadata?.pinned_count}`);
      console.log(`   Response: "${totalResponse.substring(0, 100)}..."`);
      
      // Validate key criteria
      const validations = [];
      
      if (metadata?.t_deep_started_ms < 100) {
        validations.push('✅ Deep started quickly');
      } else {
        validations.push('❌ Deep started too late');
      }
      
      if (totalResponse.length > 0) {
        validations.push('✅ Got response');
      } else {
        validations.push('❌ No response');
      }
      
      if (query.includes('Austin') && totalResponse.includes('2009')) {
        validations.push('✅ Austin years found');
      } else if (query.includes('Austin')) {
        validations.push('❌ Austin years missing');
      }
      
      console.log(`   ${validations.join(', ')}`);
      
    } catch (error) {
      console.log(`   💥 ERROR: ${error.message}`);
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

testFixedChat().catch(console.error);