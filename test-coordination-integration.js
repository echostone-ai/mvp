// Test script to verify coordination integration in chat route
const fetch = require('node-fetch');

async function testCoordination() {
  console.log('Testing coordination integration...');
  
  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        avatarSlug: 'jonathan_braden',
        message: 'What do you think about Austin?',
        debug: false
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log('Response received, checking for coordination...');
    
    // Read the streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fastContent = '';
    let deepContent = '';
    let coordinationLogged = false;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            if (data.channel === 'fast' && data.delta) {
              fastContent += data.delta;
              console.log('Fast lane:', data.delta);
            }
            
            if (data.channel === 'deep' && data.delta) {
              deepContent += data.delta;
              console.log('Deep lane:', data.delta);
            }
            
            // Look for coordination logging
            if (line.includes('fast_hook_selected')) {
              coordinationLogged = true;
              console.log('✓ Coordination logging detected');
            }
          } catch (e) {
            // Skip non-JSON lines
          }
        }
      }
    }
    
    console.log('\n=== COORDINATION TEST RESULTS ===');
    console.log('Fast content:', fastContent);
    console.log('Deep content:', deepContent);
    console.log('Coordination logged:', coordinationLogged);
    
    // Check if coordination is working
    if (fastContent && deepContent) {
      console.log('✓ Both fast and deep lanes produced content');
      
      // Simple check for repetition (this is basic, the real system does more sophisticated checking)
      const fastWords = fastContent.toLowerCase().split(/\s+/);
      const deepWords = deepContent.toLowerCase().split(/\s+/);
      const commonWords = fastWords.filter(word => deepWords.includes(word) && word.length > 3);
      
      console.log('Common words between lanes:', commonWords);
      
      if (coordinationLogged) {
        console.log('✓ Coordination integration is working!');
      } else {
        console.log('⚠ Coordination may not be fully integrated (no coordination logs detected)');
      }
    } else {
      console.log('⚠ One or both lanes did not produce content');
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
    console.log('Make sure the development server is running on localhost:3000');
  }
}

testCoordination();