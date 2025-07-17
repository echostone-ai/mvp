// test-memory-api-direct.js
// Test the memory API directly to see what's happening

require('dotenv').config({ path: '.env.local' });

async function testMemoryAPI() {
  console.log('🔍 Testing Memory API Directly...\n');

  // Test the chat API with memory processing
  const testMessage = "I love hiking with my dog Max every weekend. He's a golden retriever and gets so excited when he sees the leash.";
  const testUserId = "test-user-12345"; // This will fail, but we'll see the exact error

  console.log('Testing chat API with memory processing...');
  console.log('Message:', testMessage);
  console.log('User ID:', testUserId);

  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: testMessage,
        userId: testUserId,
        profileData: {
          personal_snapshot: {
            full_legal_name: "Test User"
          }
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Chat API error:', response.status, errorText);
      return;
    }

    const data = await response.json();
    console.log('✅ Chat API response received');
    console.log('Answer:', data.answer?.substring(0, 100) + '...');
    
    if (data.memoriesUsed) {
      console.log('Memories used:', data.memoriesUsed.length);
    } else {
      console.log('No memories used (expected for new user)');
    }

    // Wait a moment for background memory processing
    console.log('\nWaiting 3 seconds for background memory processing...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Now test the memories API
    console.log('Testing memories API...');
    const memoriesResponse = await fetch('http://localhost:3000/api/memories', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!memoriesResponse.ok) {
      const errorText = await memoriesResponse.text();
      console.log('❌ Memories API error:', memoriesResponse.status, errorText);
      return;
    }

    const memoriesData = await memoriesResponse.json();
    console.log('✅ Memories API response received');
    console.log('Total memories:', memoriesData.stats?.totalFragments || 0);
    
    if (memoriesData.memories && memoriesData.memories.length > 0) {
      console.log('Recent memories:');
      memoriesData.memories.slice(0, 3).forEach((memory, index) => {
        console.log(`  ${index + 1}. "${memory.fragmentText}"`);
      });
    } else {
      console.log('No memories found - this confirms the issue');
    }

  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

// Run the test
testMemoryAPI().then(() => {
  console.log('\n🏁 Memory API test completed');
}).catch(error => {
  console.error('💥 Test crashed:', error);
});