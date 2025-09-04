/**
 * Debug Contradictory Response Issue
 * Analyze why system gives conflicting information
 */

require('dotenv').config({ path: '.env.local' });

async function debugContradictoryResponse() {
  console.log('🔍 Debugging Contradictory Austin Response');
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
        message: 'When did you live in Austin?'
      })
    });

    if (!response.ok) {
      console.error('❌ Request failed:', response.status);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let fastContent = '';
    let deepContent = '';
    let metaData = null;
    let deepMergeDetected = false;
    
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
              
              // Track which channel content comes from
              if (data.channel === 'fast') {
                fastContent += data.delta;
              } else if (data.channel === 'deep') {
                deepContent += data.delta;
                deepMergeDetected = true;
              }
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
    
    console.log('📊 Response Analysis:');
    console.log('- Total response time:', responseTime, 'ms');
    console.log('- Total response length:', fullResponse.length, 'chars');
    console.log('- Fast content length:', fastContent.length, 'chars');
    console.log('- Deep content length:', deepContent.length, 'chars');
    console.log('- Deep merge detected in stream:', deepMergeDetected);
    console.log('- Meta deep_merge:', metaData?.deep_merge);
    console.log('- Trace ID:', metaData?.trace_id);
    
    console.log('\n📄 Full Response:');
    console.log(fullResponse);
    
    if (fastContent) {
      console.log('\n🚀 Fast Channel Content:');
      console.log(fastContent);
    }
    
    if (deepContent) {
      console.log('\n🔍 Deep Channel Content:');
      console.log(deepContent);
    }
    
    // Analyze contradictions
    const responseText = fullResponse.toLowerCase();
    const hasNeverLived = responseText.includes('never lived');
    const hasLivedThere = responseText.includes('lived in austin') || responseText.includes('lived there');
    const hasDifferentDates = responseText.includes('2015') || responseText.includes('2018');
    const hasCorrectDates = responseText.includes('2009');
    
    console.log('\n🔍 Contradiction Analysis:');
    console.log('- Says "never lived": ', hasNeverLived);
    console.log('- Says "lived in Austin":', hasLivedThere);
    console.log('- Has incorrect dates (2015-2018):', hasDifferentDates);
    console.log('- Has correct dates (2009):', hasCorrectDates);
    
    if (hasNeverLived && hasLivedThere) {
      console.log('\n⚠️  CRITICAL: Contradictory information detected!');
      console.log('   System is both denying and confirming Austin residence');
      
      if (fastContent && deepContent) {
        console.log('   This suggests fast path and deep path are giving different answers');
      } else if (!deepMergeDetected) {
        console.log('   This suggests multiple responses from same path (possible caching issue)');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

debugContradictoryResponse();