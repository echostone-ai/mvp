/**
 * Manual test script for Stories API endpoints
 * Run with: node test-stories-api.js
 */

const BASE_URL = 'http://localhost:3000';

async function testStoriesAPI() {
  console.log('🧪 Testing Stories API endpoints...\n');

  // Test 1: GET stories without avatarId (should fail)
  console.log('1. Testing GET /api/stories without avatarId...');
  try {
    const response = await fetch(`${BASE_URL}/api/stories`);
    const data = await response.json();
    console.log(`   Status: ${response.status}`);
    console.log(`   Response:`, data);
    console.log(`   ✅ Expected 400 error: ${response.status === 400 ? 'PASS' : 'FAIL'}\n`);
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }

  // Test 2: GET stories with avatarId (should work if feature flag enabled)
  console.log('2. Testing GET /api/stories with avatarId...');
  try {
    const response = await fetch(`${BASE_URL}/api/stories?avatarId=test-avatar-123`);
    const data = await response.json();
    console.log(`   Status: ${response.status}`);
    console.log(`   Response:`, data);
    
    if (response.status === 404) {
      console.log(`   ⚠️  Feature flag disabled (STORIES_ENABLED=false)\n`);
    } else if (response.status === 200) {
      console.log(`   ✅ GET endpoint working: PASS\n`);
    } else {
      console.log(`   ❌ Unexpected status: FAIL\n`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }

  // Test 3: POST stories without auth (should fail)
  console.log('3. Testing POST /api/stories without authentication...');
  try {
    const formData = new FormData();
    formData.append('title', 'Test Story');
    formData.append('category', 'memory');
    formData.append('triggers', 'test,story');
    
    const response = await fetch(`${BASE_URL}/api/stories`, {
      method: 'POST',
      body: formData
    });
    const data = await response.json();
    console.log(`   Status: ${response.status}`);
    console.log(`   Response:`, data);
    
    if (response.status === 404) {
      console.log(`   ⚠️  Feature flag disabled (STORIES_ENABLED=false)\n`);
    } else if (response.status === 401) {
      console.log(`   ✅ Auth required: PASS\n`);
    } else {
      console.log(`   ❌ Unexpected status: FAIL\n`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }

  // Test 4: Check rate limiting headers
  console.log('4. Testing rate limiting headers...');
  try {
    const response = await fetch(`${BASE_URL}/api/stories?avatarId=test-avatar-123`);
    
    console.log(`   Status: ${response.status}`);
    console.log(`   Rate Limit Headers:`);
    console.log(`     X-RateLimit-Limit: ${response.headers.get('X-RateLimit-Limit')}`);
    console.log(`     X-RateLimit-Remaining: ${response.headers.get('X-RateLimit-Remaining')}`);
    console.log(`     X-RateLimit-Reset: ${response.headers.get('X-RateLimit-Reset')}`);
    
    const hasRateLimitHeaders = response.headers.get('X-RateLimit-Limit') !== null;
    console.log(`   ✅ Rate limit headers present: ${hasRateLimitHeaders ? 'PASS' : 'FAIL'}\n`);
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }

  console.log('🏁 Stories API test complete!');
  console.log('\n📝 To enable the Stories API:');
  console.log('   1. Set STORIES_ENABLED=true in your .env file');
  console.log('   2. Restart your development server');
  console.log('   3. Ensure the database migration has been run');
}

// Run the tests
testStoriesAPI().catch(console.error);