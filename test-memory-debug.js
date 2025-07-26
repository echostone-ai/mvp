const { v4: uuidv4 } = require('uuid');
const { spawn } = require('child_process');

async function testMemoryWithLogs() {
  console.log('🧠 Testing Memory System with Debug Logs...\n');
  
  const testUserId = uuidv4();
  const testAvatarId = 'ee817868-7288-4dc4-9242-0b470a5bdb3d';
  
  console.log('Starting dev server with logs...');
  
  // Start dev server and capture logs
  const server = spawn('npm', ['run', 'dev'], { 
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  // Capture server output
  server.stdout.on('data', (data) => {
    const output = data.toString();
    if (output.includes('memory') || output.includes('Memory') || output.includes('api/chat')) {
      console.log('📝 Server log:', output.trim());
    }
  });
  
  server.stderr.on('data', (data) => {
    const output = data.toString();
    if (output.includes('memory') || output.includes('Memory') || output.includes('error')) {
      console.log('❌ Server error:', output.trim());
    }
  });
  
  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 8000));
  
  console.log('\n📡 Sending test message...');
  
  const testMessage = "Hi! My name is Sarah and I have a guinea pig named Otis.";
  
  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: testMessage,
        history: [],
        profileData: {
          name: 'Boris',
          personality: 'A man of many talents.',
          languageStyle: { description: 'Natural and conversational' },
          humorStyle: { description: 'Friendly with occasional wit' },
          catchphrases: []
        },
        userId: testUserId,
        avatarId: testAvatarId,
        visitorName: 'Sarah',
        isSharedAvatar: true,
        shareToken: 'ecerviembn5tbpmhvk9t'
      })
    });
    
    const data = await response.json();
    console.log('\n✅ Response received');
    console.log('Answer:', data.answer.substring(0, 100) + '...');
    
    // Wait for memory processing
    console.log('\n⏳ Waiting for memory processing logs...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
  
  // Kill server
  server.kill();
  console.log('\n🔚 Test complete');
}

testMemoryWithLogs().catch(console.error);