const fetch = require('node-fetch');

async function testChat() {
  console.log('Testing chat API...');
  
  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        avatarSlug: 'jonathan-demo',
        message: 'what do you think of trump?'
      })
    });
    
    if (!response.ok) {
      console.error('HTTP Error:', response.status, response.statusText);
      const text = await response.text();
      console.error('Response:', text.substring(0, 500));
      return;
    }
    
    console.log('✅ Chat API is working');
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testChat();