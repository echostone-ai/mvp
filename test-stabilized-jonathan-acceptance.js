#!/usr/bin/env node

/**
 * Stabilized Jonathan Demo Acceptance Tests
 * 
 * Tests the 4 critical acceptance probes:
 * A) "Where does your friend Tyler live?" → includes stored Tyler city or abstains then deep merges it
 * B) "Tell me about Olive." → includes stored pet details  
 * C) "What do you think of Trump?" → opinion path, no crash
 * D) "How long were you in Austin?" → returns "2009–2018" (from bio)
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const ACCEPTANCE_PROBES = [
  {
    id: 'A',
    query: "Where does your friend Tyler live?",
    expectedIntent: 'people',
    expectedSlots: ['tyler', 'city', 'location'],
    mustNotHallucinate: true
  },
  {
    id: 'B', 
    query: "Tell me about Olive.",
    expectedIntent: 'pets',
    expectedSlots: ['olive', 'pet', 'dog'],
    mustNotHallucinate: true
  },
  {
    id: 'C',
    query: "What do you think of Trump?",
    expectedIntent: 'opinion',
    expectedSlots: ['trump', 'opinion', 'politics'],
    mustNotHallucinate: false // Opinion can be generated
  },
  {
    id: 'D',
    query: "How long were you in Austin?",
    expectedIntent: 'travel',
    expectedSlots: ['austin', '2009', '2018'],
    mustNotHallucinate: true,
    expectedResponse: /2009.*2018|2009–2018|nine years|9 years/i
  }
];

class AcceptanceValidator {
  constructor() {
    this.results = [];
    this.totalRuns = 0;
    this.successfulRuns = 0;
  }

  async runSingleProbe(probe, runNumber = 1) {
    const startTime = Date.now();
    console.log(`\n🧪 Probe ${probe.id} (Run ${runNumber}): "${probe.query}"`);
    
    try {
      const response = await fetch(`${BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          avatarSlug: 'jonathan-demo',
          message: probe.query
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseText = await response.text();
      const lines = responseText.split('\n').filter(line => line.trim());
      
      let fastContent = '';
      let deepContent = '';
      let metadata = null;
      let deepMerge = false;
      let tDeepStarted = null;
      let pinnedCount = 0;
      let intent = null;

      // Parse SSE response
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        
        try {
          const data = JSON.parse(line.slice(6));
          
          if (data.channel === 'fast') {
            fastContent += data.delta || '';
          } else if (data.channel === 'deep') {
            deepContent += data.delta || '';
            deepMerge = true;
          } else if (data.event === 'meta') {
            metadata = data;
            tDeepStarted = data.t_deep_started_ms;
            pinnedCount = data.pinned_count || 0;
            intent = data.intent;
            deepMerge = data.deep_merge || deepMerge;
          }
        } catch (e) {
          // Skip malformed JSON
        }
      }

      const totalTime = Date.now() - startTime;
      const fullResponse = fastContent + deepContent;
      
      // Validate response
      const validation = this.validateProbeResponse(probe, {
        fastContent,
        deepContent,
        fullResponse,
        metadata,
        deepMerge,
        tDeepStarted,
        pinnedCount,
        intent,
        totalTime
      });

      console.log(`   Intent: ${intent} (expected: ${probe.expectedIntent})`);
      console.log(`   Deep started: ${tDeepStarted}ms`);
      console.log(`   Pinned memories: ${pinnedCount}`);
      console.log(`   Deep merge: ${deepMerge}`);
      console.log(`   Total time: ${totalTime}ms`);
      console.log(`   Response: "${fullResponse.substring(0, 100)}..."`);
      
      if (validation.success) {
        console.log(`   ✅ PASS`);
      } else {
        console.log(`   ❌ FAIL: ${validation.reason}`);
      }

      return validation;

    } catch (error) {
      console.log(`   💥 ERROR: ${error.message}`);
      return {
        success: false,
        reason: `Request failed: ${error.message}`,
        error: error.message
      };
    }
  }

  validateProbeResponse(probe, response) {
    const { fastContent, deepContent, fullResponse, metadata, deepMerge, tDeepStarted, pinnedCount, intent, totalTime } = response;

    // Check for crashes
    if (response.error) {
      return { success: false, reason: `Request crashed: ${response.error}` };
    }

    // Check intent detection
    if (intent !== probe.expectedIntent) {
      return { success: false, reason: `Wrong intent: got ${intent}, expected ${probe.expectedIntent}` };
    }

    // Check deep lane started quickly
    if (tDeepStarted === null || tDeepStarted > 100) {
      return { success: false, reason: `Deep lane started too late: ${tDeepStarted}ms (should be < 100ms)` };
    }

    // For Austin query, check for specific response pattern
    if (probe.id === 'D' && probe.expectedResponse) {
      if (!probe.expectedResponse.test(fullResponse)) {
        // If fast lane abstained, check if deep provided the answer
        if (fastContent.includes("checking my notes") && deepContent.includes("2009")) {
          console.log(`   📝 Fast abstained correctly, deep provided answer`);
        } else {
          return { success: false, reason: `Austin years not found in response. Got: "${fullResponse}"` };
        }
      }
    }

    // Check hallucination guard for critical intents
    if (probe.mustNotHallucinate && pinnedCount === 0 && !deepMerge) {
      if (!fastContent.includes("checking my notes") && !fastContent.includes("not sure")) {
        return { success: false, reason: `Fast lane should abstain when no pinned memories and no deep merge` };
      }
    }

    // Check for slot presence (at least one expected slot should be present)
    const hasExpectedSlot = probe.expectedSlots.some(slot => 
      fullResponse.toLowerCase().includes(slot.toLowerCase())
    );
    
    if (!hasExpectedSlot && deepMerge) {
      return { success: false, reason: `No expected slots found: ${probe.expectedSlots.join(', ')}` };
    }

    // Success criteria met
    return { success: true, reason: 'All validation checks passed' };
  }

  async runSequentialTest(runs = 5) {
    console.log(`🚀 Running ${runs} sequential acceptance tests...\n`);
    
    let totalSuccess = 0;
    let totalTests = 0;

    for (let run = 1; run <= runs; run++) {
      console.log(`\n📋 === RUN ${run}/${runs} ===`);
      
      let runSuccess = 0;
      
      for (const probe of ACCEPTANCE_PROBES) {
        const result = await this.runSingleProbe(probe, run);
        totalTests++;
        
        if (result.success) {
          runSuccess++;
          totalSuccess++;
        }
        
        this.results.push({
          run,
          probe: probe.id,
          query: probe.query,
          success: result.success,
          reason: result.reason,
          error: result.error
        });
        
        // Small delay between probes
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      console.log(`\n   Run ${run} Summary: ${runSuccess}/${ACCEPTANCE_PROBES.length} probes passed`);
      
      // Delay between runs
      if (run < runs) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    this.totalRuns = runs;
    this.successfulRuns = totalSuccess;
    
    return this.generateReport();
  }

  generateReport() {
    const successRate = (this.successfulRuns / (this.totalRuns * ACCEPTANCE_PROBES.length)) * 100;
    
    console.log(`\n\n📊 === FINAL REPORT ===`);
    console.log(`Total Tests: ${this.totalRuns * ACCEPTANCE_PROBES.length}`);
    console.log(`Successful: ${this.successfulRuns}`);
    console.log(`Success Rate: ${successRate.toFixed(1)}%`);
    
    // Per-probe breakdown
    console.log(`\n📈 Per-Probe Success Rates:`);
    for (const probe of ACCEPTANCE_PROBES) {
      const probeResults = this.results.filter(r => r.probe === probe.id);
      const probeSuccess = probeResults.filter(r => r.success).length;
      const probeRate = (probeSuccess / probeResults.length) * 100;
      console.log(`   ${probe.id}: ${probeSuccess}/${probeResults.length} (${probeRate.toFixed(1)}%) - "${probe.query}"`);
    }
    
    // Failure analysis
    const failures = this.results.filter(r => !r.success);
    if (failures.length > 0) {
      console.log(`\n❌ Failure Analysis:`);
      const failureReasons = {};
      failures.forEach(f => {
        failureReasons[f.reason] = (failureReasons[f.reason] || 0) + 1;
      });
      
      Object.entries(failureReasons).forEach(([reason, count]) => {
        console.log(`   ${count}x: ${reason}`);
      });
    }
    
    // Success criteria
    const meetsSuccessCriteria = successRate >= 95 && 
      this.results.filter(r => !r.success && r.error?.includes('crash')).length === 0;
    
    console.log(`\n🎯 Success Criteria:`);
    console.log(`   ✅ 0 crashes: ${this.results.filter(r => r.error?.includes('crash')).length === 0 ? 'PASS' : 'FAIL'}`);
    console.log(`   ${successRate >= 95 ? '✅' : '❌'} ≥95% success rate: ${successRate.toFixed(1)}%`);
    console.log(`   ${meetsSuccessCriteria ? '✅' : '❌'} Overall: ${meetsSuccessCriteria ? 'PASS' : 'FAIL'}`);
    
    return {
      successRate,
      totalTests: this.totalRuns * ACCEPTANCE_PROBES.length,
      successfulTests: this.successfulRuns,
      meetsSuccessCriteria,
      results: this.results
    };
  }
}

// Run the tests
async function main() {
  const validator = new AcceptanceValidator();
  
  const runs = process.argv[2] ? parseInt(process.argv[2]) : 5;
  const report = await validator.runSequentialTest(runs);
  
  process.exit(report.meetsSuccessCriteria ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { AcceptanceValidator, ACCEPTANCE_PROBES };