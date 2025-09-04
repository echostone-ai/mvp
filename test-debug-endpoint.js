// Simple test script for the debug endpoint
const DEBUG_SECRET = process.env.DEBUG_SECRET || 'test-secret';

async function testDebugEndpoint() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('Testing JD Debug Endpoint...\n');
  
  // Test 1: Missing DEBUG_SECRET
  console.log('Test 1: Missing DEBUG_SECRET header');
  try {
    const response = await fetch(`${baseUrl}/api/debug/jd?profileName=jonathan-demo`);
    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, data);
    console.log('Expected: 401 Unauthorized\n');
  } catch (error) {
    console.log('Error:', error.message, '\n');
  }
  
  // Test 2: Wrong DEBUG_SECRET
  console.log('Test 2: Wrong DEBUG_SECRET header');
  try {
    const response = await fetch(`${baseUrl}/api/debug/jd?profileName=jonathan-demo`, {
      headers: { 'DEBUG_SECRET': 'wrong-secret' }
    });
    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, data);
    console.log('Expected: 401 Unauthorized\n');
  } catch (error) {
    console.log('Error:', error.message, '\n');
  }
  
  // Test 3: Missing query parameters
  console.log('Test 3: Missing query parameters');
  try {
    const response = await fetch(`${baseUrl}/api/debug/jd`, {
      headers: { 'DEBUG_SECRET': DEBUG_SECRET }
    });
    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, data);
    console.log('Expected: 400 Bad Request\n');
  } catch (error) {
    console.log('Error:', error.message, '\n');
  }
  
  // Test 4: Valid request with profileName
  console.log('Test 4: Valid request with profileName');
  try {
    const response = await fetch(`${baseUrl}/api/debug/jd?profileName=jonathan-demo`, {
      headers: { 'DEBUG_SECRET': DEBUG_SECRET }
    });
    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, JSON.stringify(data, null, 2));
    console.log('Expected: 200 OK with debug data\n');
  } catch (error) {
    console.log('Error:', error.message, '\n');
  }
  
  // Test 5: Valid request with avatarSlug (if different from profileName)
  console.log('Test 5: Valid request with avatarSlug');
  try {
    const response = await fetch(`${baseUrl}/api/debug/jd?avatarSlug=jonathan-demo`, {
      headers: { 'DEBUG_SECRET': DEBUG_SECRET }
    });
    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, JSON.stringify(data, null, 2));
    console.log('Expected: 200 OK with debug data\n');
  } catch (error) {
    console.log('Error:', error.message, '\n');
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testDebugEndpoint().catch(console.error);
}

module.exports = { testDebugEndpoint };