// Test script to verify repetition guard integration
const fetch = require('node-fetch');

async function testRepetitionGuard() {
  console.log('Testing repetition guard integration...');
  
  try {
    // Test with a query that might cause repetition
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        avatarSlug: 'jonathan_braden',
        message: 'Tell me about Austin',
        debug: false
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log('Response received, checking for repetition guard logs...');
    
    // Read the streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fastContent = '';
    let deepContent = '';
    let repetitionAnalysisLogged = false;
    let regenerationTriggered = false;
    
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
            }
            
            if (data.channel === 'deep' && data.delta) {
              deepContent += data.delta;
            }
          } catch (e) {
            // Skip non-JSON lines
          }
        }
        
        // Look for repetition guard logging
        if (line.includes('repetition_analysis')) {
          repetitionAnalysisLogged = true;
          console.log('✓ Repetition analysis detected in logs');
        }
        
        if (line.includes('deep_regeneration_triggered')) {
          regenerationTriggered = true;
          console.log('✓ Deep lane regeneration triggered');
        }
      }
    }
    
    console.log('\n=== REPETITION GUARD TEST RESULTS ===');
    console.log('Fast content:', fastContent);
    console.log('Deep content:', deepContent);
    console.log('Repetition analysis logged:', repetitionAnalysisLogged);
    console.log('Regeneration triggered:', regenerationTriggered);
    
    // Check if repetition guard is working
    if (fastContent && deepContent) {
      console.log('✓ Both fast and deep lanes produced content');
      
      if (repetitionAnalysisLogged) {
        console.log('✓ Repetition guard is integrated and working!');
      } else {
        console.log('⚠ Repetition guard may not be fully integrated (no analysis logs detected)');
      }
      
      if (regenerationTriggered) {
        console.log('✓ Regeneration system is working (triggered in this test)');
      } else {
        console.log('ℹ No regeneration needed for this test case');
      }
    } else {
      console.log('⚠ One or both lanes did not produce content');
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
    console.log('Make sure the development server is running on localhost:3000');
  }
}

testRepetitionGuard();