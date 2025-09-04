/**
 * Test Austin Query - Debug hallucination issue
 */

require('dotenv').config({ path: '.env.local' });

async function testAustinQuery() {
  console.log('🧪 Testing Austin Query for Hallucination');
  console.log('=' .repeat(50));
  
  const startTime = Date.now();
  
  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        avatarSlug: 'jonathan-demo',
        message: 'How long were you in Austin?'
      })
    });

    if (!response.ok) {
      console.error('❌ Request failed:', response.status);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let metaData = null;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            if (data.delta) {
              fullResponse += data.delta;
            }
            
            if (data.event === 'meta') {
              metaData = data;
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }
    
    const responseTime = Date.now() - startTime;
    
    console.log('📊 Results:');
    console.log('- Response time:', responseTime, 'ms');
    console.log('- Response length:', fullResponse.length, 'chars');
    console.log('- Deep merge:', metaData?.deep_merge);
    console.log('- Trace ID:', metaData?.trace_id);
    
    console.log('\n📄 Full Response:');
    console.log(fullResponse);
    
    // Check for correct vs incorrect details
    const correctDetails = [
      '2009-2018',
      '2009 to 2018', 
      'electric aquatic',
      'boat parties',
      'nine years'
    ];
    
    const incorrectDetails = [
      '2009-2013',
      '2009 to 2013',
      'college',
      'sixth street',
      'four years',
      'few years'
    ];
    
    const responseText = fullResponse.toLowerCase();
    
    const foundCorrect = correctDetails.filter(detail => 
      responseText.includes(detail.toLowerCase())
    );
    
    const foundIncorrect = incorrectDetails.filter(detail => 
      responseText.includes(detail.toLowerCase())
    );
    
    console.log('\n🔍 Analysis:');
    console.log('✅ Correct details found:', foundCorrect.length, '/', correctDetails.length);
    if (foundCorrect.length > 0) {
      console.log('   -', foundCorrect.join(', '));
    }
    
    console.log('❌ Incorrect details found:', foundIncorrect.length);
    if (foundIncorrect.length > 0) {
      console.log('   -', foundIncorrect.join(', '));
    }
    
    if (foundIncorrect.length > 0) {
      console.log('\n⚠️  HALLUCINATION DETECTED - System is generating false information');
    } else if (foundCorrect.length > 0) {
      console.log('\n✅ MEMORY RETRIEVAL WORKING - Using actual stored memories');
    } else {
      console.log('\n❓ UNCLEAR - No specific details found');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAustinQuery();