#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🎯 EchoStone Memory Retrieval - Final Validation\n');

// Test all three acceptance criteria
const tests = [
  {
    name: 'First Dog Query',
    query: 'What was your first dog?',
    expectedKeywords: ['Bucky', 'poodle', 'first', '18'],
    description: 'Should mention Bucky as first dog with details'
  },
  {
    name: 'Dog Count Query', 
    query: 'How many dogs have you had?',
    expectedKeywords: ['four', 'Bucky', 'George', 'Olive', 'Romeo'],
    description: 'Should enumerate all four dogs'
  },
  {
    name: 'Music Preferences',
    query: 'What is your favorite music?',
    expectedKeywords: ['Nirvana', 'music', 'grunge'],
    description: 'Should mention music preferences including Nirvana'
  }
];

let allPassed = true;

for (const test of tests) {
  console.log(`🧪 Testing: ${test.name}`);
  console.log(`   Query: "${test.query}"`);
  
  try {
    const response = execSync(`curl -s -X POST http://localhost:3000/api/demo-chat \
      -H "Content-Type: application/json" \
      -d '{"message": "${test.query}", "debug": true}'`, 
      { encoding: 'utf8', timeout: 10000 }
    );
    
    const data = JSON.parse(response);
    const text = data.text.toLowerCase();
    const memoriesCount = data.metadata?.memories_count || 0;
    
    console.log(`   Response: "${data.text.substring(0, 100)}..."`);
    console.log(`   Memories Retrieved: ${memoriesCount}`);
    
    // Check if expected keywords are present
    const foundKeywords = test.expectedKeywords.filter(keyword => 
      text.includes(keyword.toLowerCase())
    );
    
    const passed = foundKeywords.length >= Math.ceil(test.expectedKeywords.length * 0.6) && memoriesCount > 0;
    
    if (passed) {
      console.log(`   ✅ PASSED - Found ${foundKeywords.length}/${test.expectedKeywords.length} keywords`);
      console.log(`   Keywords found: ${foundKeywords.join(', ')}`);
    } else {
      console.log(`   ❌ FAILED - Only found ${foundKeywords.length}/${test.expectedKeywords.length} keywords`);
      console.log(`   Keywords found: ${foundKeywords.join(', ')}`);
      console.log(`   Missing: ${test.expectedKeywords.filter(k => !foundKeywords.includes(k.toLowerCase())).join(', ')}`);
      allPassed = false;
    }
    
  } catch (error) {
    console.log(`   ❌ FAILED - Error: ${error.message}`);
    allPassed = false;
  }
  
  console.log('');
}

// Performance test
console.log('⚡ Performance Test');
try {
  const start = Date.now();
  const response = execSync(`curl -s -X POST http://localhost:3000/api/demo-chat \
    -H "Content-Type: application/json" \
    -d '{"message": "Tell me about your dogs", "debug": true}'`, 
    { encoding: 'utf8', timeout: 10000 }
  );
  const elapsed = Date.now() - start;
  
  const data = JSON.parse(response);
  const processingTime = data.metadata?.processing_time_ms || elapsed;
  
  console.log(`   Response Time: ${elapsed}ms`);
  console.log(`   Processing Time: ${processingTime}ms`);
  console.log(`   Memories Retrieved: ${data.metadata?.memories_count || 0}`);
  
  if (elapsed < 5000 && (data.metadata?.memories_count || 0) > 0) {
    console.log('   ✅ PASSED - Good performance with memory retrieval');
  } else {
    console.log('   ❌ FAILED - Performance or memory retrieval issue');
    allPassed = false;
  }
} catch (error) {
  console.log(`   ❌ FAILED - Error: ${error.message}`);
  allPassed = false;
}

console.log('\n' + '='.repeat(60));
if (allPassed) {
  console.log('🎉 ALL TESTS PASSED! EchoStone memory retrieval is working perfectly!');
  console.log('\n✅ Key Achievements:');
  console.log('   - Memory retrieval finding bio facts');
  console.log('   - Profile queries getting detailed responses');
  console.log('   - Performance within acceptable limits');
  console.log('   - All three acceptance criteria met');
} else {
  console.log('❌ Some tests failed. Check the output above for details.');
}
console.log('='.repeat(60));