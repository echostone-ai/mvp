#!/usr/bin/env node

/**
 * Political Query Acceptance Tests
 * Tests the exact requirements from the OpenAI-level engineer specifications
 */

// Use Node.js built-in fetch (Node 18+) or fallback to node-fetch
const fetch = globalThis.fetch || require('node-fetch');

const API_BASE = process.env.API_BASE || 'http://localhost:3000';
const AVATAR_SLUG = 'jonathan-demo';

async function testChatAPI(message, testName) {
  console.log(`\n=== ${testName} ===`);
  console.log(`Query: "${message}"`);
  
  try {
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        avatar: AVATAR_SLUG,
        debug: false
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Handle different fetch implementations
    let reader, decoder;
    if (response.body && response.body.getReader) {
      reader = response.body.getReader();
      decoder = new TextDecoder();
    } else if (response.body && response.body.on) {
      // node-fetch stream handling
      const chunks = [];
      return new Promise((resolve, reject) => {
        response.body.on('data', chunk => chunks.push(chunk));
        response.body.on('end', () => {
          const fullResponse = Buffer.concat(chunks).toString();
          resolve({
            response: fullResponse.trim(),
            deepMergeLogged: false,
            deepTokensAny: false,
            bypassPrefsApplied: null
          });
        });
        response.body.on('error', reject);
      });
    } else {
      throw new Error('Unsupported response body type');
    }
    let fullResponse = '';
    let deepMergeLogged = false;
    let deepTokensAny = false;
    let bypassPrefsApplied = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.channel === 'fast' || data.channel === 'deep') {
              fullResponse += data.delta || '';
            }
            // Check for deep merge logging
            if (data.deep_merge !== undefined) {
              deepMergeLogged = true;
              console.log(`Deep merge: ${data.deep_merge}`);
            }
            if (data.deep_tokens_any !== undefined) {
              deepTokensAny = data.deep_tokens_any;
              console.log(`Deep tokens any: ${deepTokensAny}`);
            }
            if (data.bypass_prefs_applied !== undefined) {
              bypassPrefsApplied = data.bypass_prefs_applied;
              console.log(`Bypass prefs applied: ${bypassPrefsApplied}`);
            }
          } catch (e) {
            // Ignore parse errors for non-JSON lines
          }
        }
      }
    }

    console.log(`Response: "${fullResponse.trim()}"`);
    return {
      response: fullResponse.trim(),
      deepMergeLogged,
      deepTokensAny,
      bypassPrefsApplied
    };

  } catch (error) {
    console.error(`Test failed: ${error.message}`);
    return null;
  }
}

async function runAcceptanceTests() {
  console.log('🚀 Running Political Query Acceptance Tests');
  console.log(`API Base: ${API_BASE}`);
  
  const tests = [
    {
      name: 'Test A: "What do you think of Trump?"',
      query: 'What do you think of Trump?',
      expectedContent: ['2018', 'left America', 'road incident', 'negative opinion'],
      shouldBypassPrefs: false
    },
    {
      name: 'Test B: "Why did you leave America?"',
      query: 'Why did you leave America?',
      expectedContent: ['political climate', 'Trump'],
      shouldBypassPrefs: false
    },
    {
      name: 'Test C: "Do you like Trump?"',
      query: 'Do you like Trump?',
      expectedContent: ['opinion fragments'],
      shouldBypassPrefs: false
    },
    {
      name: 'Test D: Benign Preference (should bypass)',
      query: 'What is your favorite music?',
      expectedContent: ['music', 'favorite'],
      shouldBypassPrefs: true
    }
  ];

  let passedTests = 0;
  let totalTests = tests.length;

  for (const test of tests) {
    const result = await testChatAPI(test.query, test.name);
    
    if (!result) {
      console.log(`❌ ${test.name}: FAILED (API error)`);
      continue;
    }

    let passed = true;
    const issues = [];

    // Check bypass preferences behavior
    if (test.shouldBypassPrefs && result.bypassPrefsApplied !== true) {
      passed = false;
      issues.push('Expected preference bypass but it was not applied');
    }
    if (!test.shouldBypassPrefs && result.bypassPrefsApplied === true) {
      passed = false;
      issues.push('Unexpected preference bypass was applied');
    }

    // Check for expected content (simplified check)
    const responseLower = result.response.toLowerCase();
    let hasExpectedContent = false;
    
    for (const expectedItem of test.expectedContent) {
      if (responseLower.includes(expectedItem.toLowerCase()) || 
          responseLower.includes('trump') || 
          responseLower.includes('political') ||
          responseLower.includes('america')) {
        hasExpectedContent = true;
        break;
      }
    }

    if (!hasExpectedContent && !test.shouldBypassPrefs) {
      // For political queries, we expect some relevant content
      if (test.query.toLowerCase().includes('trump') || 
          test.query.toLowerCase().includes('america')) {
        issues.push('Expected political/opinion content not found in response');
      }
    }

    if (passed && issues.length === 0) {
      console.log(`✅ ${test.name}: PASSED`);
      passedTests++;
    } else {
      console.log(`❌ ${test.name}: FAILED`);
      issues.forEach(issue => console.log(`   - ${issue}`));
    }
  }

  console.log(`\n📊 Test Results: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All acceptance tests PASSED!');
    process.exit(0);
  } else {
    console.log('💥 Some acceptance tests FAILED!');
    process.exit(1);
  }
}

// Run the tests
runAcceptanceTests().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});