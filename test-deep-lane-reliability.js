#!/usr/bin/env node

/**
 * Test Deep Lane Reliability and Pinned Memories
 * Tests the exact requirements for political query handling
 */

const http = require('http');

function makeRequest(message) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      message,
      avatar: 'jonathan-demo',
      debug: false
    });

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

function parseSSELogs(body) {
  const logs = {
    t_deep_started_ms: null,
    deep_micro_budget_ms: null,
    deep_merge: null,
    fast_pinned_injected: null,
    pinned_memories_count: null,
    deep_spawned: null,
    deep_skip_reason: null,
    political_query: null,
    opinion_query: null
  };
  
  const lines = body.split('\n');
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      try {
        const data = JSON.parse(line.slice(6));
        
        // Extract metrics from the data
        if (data.t_deep_started_ms !== undefined) logs.t_deep_started_ms = data.t_deep_started_ms;
        if (data.deep_micro_budget_ms !== undefined) logs.deep_micro_budget_ms = data.deep_micro_budget_ms;
        if (data.deep_merge !== undefined) logs.deep_merge = data.deep_merge;
        if (data.fast_pinned_injected !== undefined) logs.fast_pinned_injected = data.fast_pinned_injected;
        if (data.pinned_memories_count !== undefined) logs.pinned_memories_count = data.pinned_memories_count;
        if (data.deep_spawned !== undefined) logs.deep_spawned = data.deep_spawned;
        if (data.deep_skip_reason !== undefined) logs.deep_skip_reason = data.deep_skip_reason;
        if (data.political_query !== undefined) logs.political_query = data.political_query;
        if (data.opinion_query !== undefined) logs.opinion_query = data.opinion_query;
        
      } catch (e) {
        // Ignore parse errors
      }
    }
  }
  
  return logs;
}

function checkResponseContent(response, expectedTerms) {
  const responseLower = response.toLowerCase();
  const foundTerms = expectedTerms.filter(term => responseLower.includes(term.toLowerCase()));
  return {
    found: foundTerms,
    missing: expectedTerms.filter(term => !foundTerms.includes(term))
  };
}

async function runAcceptanceTests() {
  console.log('🚀 Testing Deep Lane Reliability and Pinned Memories');
  console.log('   Implementing exact requirements from the specification\n');
  
  const tests = [
    {
      name: 'Test A: "What do you think of Trump?"',
      query: 'What do you think of Trump?',
      expectedLogs: {
        t_deep_started_ms: { max: 100 },
        deep_micro_budget_ms: { min: 600 },
        political_query: true,
        opinion_query: true
      },
      expectedContent: ['2018', 'left America', 'methhead redneck', 'miserable mother fucker', 'rat bastard'],
      requiresDeepOrPinned: true
    },
    {
      name: 'Test B: "Why did you leave America?"',
      query: 'Why did you leave America?',
      expectedLogs: {
        t_deep_started_ms: { max: 100 },
        deep_micro_budget_ms: { min: 600 },
        political_query: true
      },
      expectedContent: ['political climate', '2017 incident'],
      requiresDeepOrPinned: true
    },
    {
      name: 'Test C: "Tell me about all the dogs you\'ve had"',
      query: 'Tell me about all the dogs you\'ve had',
      expectedLogs: {
        deep_spawned: false,
        deep_skip_reason: 'not_needed'
      },
      expectedContent: ['dogs', 'pets'],
      requiresDeepOrPinned: false
    }
  ];

  let passedTests = 0;
  const results = [];

  for (const test of tests) {
    console.log(`\n=== ${test.name} ===`);
    console.log(`Query: "${test.query}"`);
    
    try {
      const result = await makeRequest(test.query);
      
      if (result.statusCode !== 200) {
        console.log(`❌ API Error: ${result.statusCode}`);
        results.push({ test: test.name, passed: false, reason: 'API Error' });
        continue;
      }
      
      const logs = parseSSELogs(result.body);
      const responseText = result.body.split('data: ').map(line => {
        try {
          const data = JSON.parse(line);
          return data.delta || '';
        } catch {
          return '';
        }
      }).join('');
      
      console.log('\n📊 Extracted Logs:');
      console.log(JSON.stringify(logs, null, 2));
      
      let passed = true;
      const issues = [];
      
      // Check expected logs
      for (const [key, expected] of Object.entries(test.expectedLogs)) {
        const actual = logs[key];
        
        if (typeof expected === 'object' && expected.max !== undefined) {
          if (actual === null || actual > expected.max) {
            passed = false;
            issues.push(`${key}: expected ≤ ${expected.max}, got ${actual}`);
          } else {
            console.log(`✅ ${key}: ${actual} ≤ ${expected.max}`);
          }
        } else if (typeof expected === 'object' && expected.min !== undefined) {
          if (actual === null || actual < expected.min) {
            passed = false;
            issues.push(`${key}: expected ≥ ${expected.min}, got ${actual}`);
          } else {
            console.log(`✅ ${key}: ${actual} ≥ ${expected.min}`);
          }
        } else {
          if (actual !== expected) {
            passed = false;
            issues.push(`${key}: expected ${expected}, got ${actual}`);
          } else {
            console.log(`✅ ${key}: ${actual}`);
          }
        }
      }
      
      // Check deep merge OR fast pinned injection requirement
      if (test.requiresDeepOrPinned) {
        const hasDeepMerge = logs.deep_merge === true;
        const hasFastPinned = logs.fast_pinned_injected === true && logs.pinned_memories_count >= 3;
        
        if (!hasDeepMerge && !hasFastPinned) {
          passed = false;
          issues.push('Required: (deep_merge:true) OR (fast_pinned_injected:true AND pinned_memories_count ≥ 3)');
        } else {
          console.log(`✅ Deep contribution: deep_merge=${hasDeepMerge}, fast_pinned=${hasFastPinned}`);
        }
      }
      
      // Check response content
      const contentCheck = checkResponseContent(responseText, test.expectedContent);
      if (contentCheck.found.length === 0 && test.expectedContent.length > 0) {
        console.log(`⚠️  Expected content not found: ${test.expectedContent.join(', ')}`);
        console.log(`Response preview: "${responseText.substring(0, 200)}..."`);
      } else if (contentCheck.found.length > 0) {
        console.log(`✅ Found expected content: ${contentCheck.found.join(', ')}`);
      }
      
      if (passed && issues.length === 0) {
        console.log(`\n✅ ${test.name}: PASSED`);
        passedTests++;
        results.push({ test: test.name, passed: true });
      } else {
        console.log(`\n❌ ${test.name}: FAILED`);
        issues.forEach(issue => console.log(`   - ${issue}`));
        results.push({ test: test.name, passed: false, issues });
      }
      
    } catch (error) {
      console.log(`❌ Test failed: ${error.message}`);
      results.push({ test: test.name, passed: false, reason: error.message });
    }
  }
  
  console.log(`\n📊 Final Results: ${passedTests}/${tests.length} tests passed`);
  
  if (passedTests === tests.length) {
    console.log('\n🎉 ALL ACCEPTANCE TESTS PASSED!');
    console.log('✅ Deep lane reliability implemented correctly');
    console.log('✅ Pinned memories working for political queries');
    console.log('✅ Non-political queries skip deep appropriately');
  } else {
    console.log('\n⚠️  Some tests failed. Check the logs above for details.');
  }
  
  return results;
}

// Run the tests
runAcceptanceTests().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});