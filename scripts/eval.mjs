#!/usr/bin/env node

/**
 * EchoStone Factbook-Only Evaluation Script
 * Tests latency and persona accuracy for factbook-only mode
 */

const TEST_PROMPTS = [
  "What's something unique about Jonathan's childhood?",
  "Who is Krissy to Jonathan?", 
  "Tell the short story about moving to Europe.",
  "What languages is Jonathan learning?",
  "Where do his parents live?"
];

const FACTBOOK_KEYWORDS = [
  'jonathan', 'krissy', 'tyler', 'olive', 'romeo', 'austin', 'texas', 
  'maine', 'bulgaria', 'sofia', 'spanish', 'english', 'trump', 'biden',
  'dog', 'pet', 'parents', 'childhood', 'europe', 'languages'
];

async function testChatEndpoint(prompt, baseUrl = 'http://localhost:3000') {
  const startTime = Date.now();
  let firstTokenTime = null;
  let totalTime = null;
  let response = '';
  let hasFactbookContent = false;
  let modelFlags = { fast: false, deep: false };

  try {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        avatarSlug: 'jonathan-demo',
        message: prompt
      })
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            if (data.delta) {
              if (firstTokenTime === null) {
                firstTokenTime = Date.now() - startTime;
              }
              response += data.delta;
              
              // Track model flags
              if (data.channel === 'fast') modelFlags.fast = true;
              if (data.channel === 'deep') modelFlags.deep = true;
            }
            
            if (data.event === 'end') {
              totalTime = Date.now() - startTime;
            }
          } catch (e) {
            // Skip malformed JSON
          }
        }
      }
    }

    // Check for factbook content
    const responseLower = response.toLowerCase();
    hasFactbookContent = FACTBOOK_KEYWORDS.some(keyword => 
      responseLower.includes(keyword.toLowerCase())
    );

    return {
      prompt,
      firstTokenLatency: firstTokenTime,
      totalTime: totalTime || (Date.now() - startTime),
      response: response.trim(),
      hasFactbookContent,
      modelFlags,
      success: true
    };

  } catch (error) {
    return {
      prompt,
      firstTokenLatency: null,
      totalTime: Date.now() - startTime,
      response: '',
      hasFactbookContent: false,
      modelFlags,
      success: false,
      error: error.message
    };
  }
}

async function runEvaluation() {
  console.log('🚀 Starting EchoStone Factbook-Only Evaluation');
  console.log('=' .repeat(60));
  
  const results = [];
  
  for (let i = 0; i < TEST_PROMPTS.length; i++) {
    const prompt = TEST_PROMPTS[i];
    console.log(`\n📝 Test ${i + 1}/${TEST_PROMPTS.length}: "${prompt}"`);
    
    const result = await testChatEndpoint(prompt);
    results.push(result);
    
    if (result.success) {
      console.log(`✅ First token: ${result.firstTokenLatency}ms`);
      console.log(`⏱️  Total time: ${result.totalTime}ms`);
      console.log(`🎯 Factbook content: ${result.hasFactbookContent ? 'YES' : 'NO'}`);
      console.log(`🤖 Model flags: Fast=${result.modelFlags.fast}, Deep=${result.modelFlags.deep}`);
      console.log(`💬 Response preview: ${result.response.substring(0, 100)}...`);
    } else {
      console.log(`❌ Failed: ${result.error}`);
    }
  }
  
  // Calculate statistics
  const successfulResults = results.filter(r => r.success && r.firstTokenLatency !== null);
  
  if (successfulResults.length === 0) {
    console.log('\n❌ No successful results to analyze');
    return;
  }
  
  const firstTokenLatencies = successfulResults.map(r => r.firstTokenLatency);
  const totalTimes = successfulResults.map(r => r.totalTime);
  const factbookHits = successfulResults.filter(r => r.hasFactbookContent).length;
  
  const medianFirstToken = median(firstTokenLatencies);
  const medianTotal = median(totalTimes);
  
  console.log('\n📊 EVALUATION RESULTS');
  console.log('=' .repeat(60));
  console.log(`✅ Successful tests: ${successfulResults.length}/${results.length}`);
  console.log(`⚡ First token latency (median): ${medianFirstToken}ms`);
  console.log(`⏱️  Total time (median): ${medianTotal}ms`);
  console.log(`🎯 Factbook content hits: ${factbookHits}/${successfulResults.length}`);
  
  // Success criteria check
  console.log('\n🎯 SUCCESS CRITERIA CHECK');
  console.log('=' .repeat(60));
  
  const firstTokenPass = medianFirstToken < 350;
  const totalTimePass = medianTotal < 2800;
  const factbookPass = factbookHits >= Math.ceil(successfulResults.length * 0.8); // 80% should have factbook content
  
  console.log(`First token < 350ms: ${firstTokenPass ? '✅' : '❌'} (${medianFirstToken}ms)`);
  console.log(`Total time < 2.8s: ${totalTimePass ? '✅' : '❌'} (${medianTotal}ms)`);
  console.log(`Factbook content: ${factbookPass ? '✅' : '❌'} (${factbookHits}/${successfulResults.length})`);
  
  const overallPass = firstTokenPass && totalTimePass && factbookPass;
  console.log(`\n🏆 OVERALL: ${overallPass ? '✅ PASS' : '❌ FAIL'}`);
  
  if (!overallPass) {
    process.exit(1);
  }
}

function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 
    ? (sorted[mid - 1] + sorted[mid]) / 2 
    : sorted[mid];
}

// Run evaluation
runEvaluation().catch(error => {
  console.error('❌ Evaluation failed:', error);
  process.exit(1);
});