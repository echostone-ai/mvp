/**
 * Test Current Deep Lane Status
 * Check if the deep lane is actually starting and contributing
 */

require('dotenv').config({ path: '.env.local' });

async function testDeepLaneStatus() {
  console.log('🧪 Testing Current Deep Lane Status');
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
        message: 'Where does your friend Tyler live?'
      })
    });

    if (!response.ok) {
      console.error('❌ Request failed:', response.status);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let deepMergeDetected = false;
    let deepSpawnedDetected = false;
    let metaData = null;
    let serverLogs = [];
    
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
            
            if (data.event === 'deep_merge_log' || data.channel === 'deep') {
              deepMergeDetected = true;
            }
            
            // Look for server logs
            if (data.event === 'log' || data.type === 'log') {
              serverLogs.push(data);
            }
            
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }
    
    const totalTime = Date.now() - startTime;
    
    console.log('📊 Results:');
    console.log('- Response time:', totalTime, 'ms');
    console.log('- Response length:', fullResponse.length, 'chars');
    console.log('- Deep merge detected:', deepMergeDetected);
    console.log('- Meta deep_merge:', metaData?.deep_merge);
    console.log('- Meta deep_spawned:', metaData?.deep_spawned);
    console.log('- Server logs count:', serverLogs.length);
    
    if (serverLogs.length > 0) {
      console.log('\n📝 Server Logs:');
      serverLogs.forEach(log => console.log('  -', log));
    }
    
    console.log('\n📄 Response preview:');
    console.log(fullResponse.substring(0, 200) + '...');
    
    // Check if response contains specific Tyler content
    const hasSpecificContent = fullResponse.toLowerCase().includes('tyler') && 
                              (fullResponse.toLowerCase().includes('portland') || 
                               fullResponse.toLowerCase().includes('sofia'));
    
    console.log('\n🎯 Analysis:');
    console.log('- Contains specific Tyler content:', hasSpecificContent);
    console.log('- Deep lane should contribute for people intent');
    
    if (hasSpecificContent && !deepMergeDetected) {
      console.log('⚠️  ISSUE: Getting specific content but deep lane not contributing');
      console.log('   This suggests fast path is working but deep lane is not starting');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testDeepLaneStatus();