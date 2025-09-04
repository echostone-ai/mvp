/**
 * Validate Hybrid Streaming Implementation
 * Quick checks to ensure all components are properly integrated
 */

const fs = require('fs');
const path = require('path');

function validateImplementation() {
  console.log('🔍 Validating Hybrid Streaming Implementation...\n');

  const checks = [
    {
      name: 'Session Cache Module',
      path: 'src/lib/services/sessionCache.ts',
      required: ['SessionContext', 'SessionCache', 'sessionCache', 'deriveSessionId']
    },
    {
      name: 'Fast Lane Seed Module', 
      path: 'src/lib/services/fastLaneSeed.ts',
      required: ['composeFastLaneSeed', 'createMinimalPersonaSeed']
    },
    {
      name: 'Deep Lane Orchestrator',
      path: 'src/lib/services/deepLaneOrchestrator.ts', 
      required: ['runDeepLane', 'buildSessionContext']
    },
    {
      name: 'Streaming Coordinator',
      path: 'src/lib/services/streamingCoordinator.ts',
      required: ['hybridStream', 'createStreamResponse']
    },
    {
      name: 'Hybrid Streaming Handler',
      path: 'src/lib/services/hybridStreamingHandler.ts',
      required: ['handleHybridStreaming']
    },
    {
      name: 'Main Route Integration',
      path: 'src/app/api/chat/route.ts',
      required: ['FEATURE_HYBRID_STREAMING', 'fastHelloFromCacheOrTemplate', 'deepLane', 'encodeSSE']
    },
    {
      name: 'Environment Configuration',
      path: '.env.local',
      required: ['FEATURE_HYBRID_STREAMING=true']
    }
  ];

  let allPassed = true;

  for (const check of checks) {
    console.log(`📋 Checking: ${check.name}`);
    
    try {
      if (!fs.existsSync(check.path)) {
        console.log(`   ❌ File missing: ${check.path}`);
        allPassed = false;
        continue;
      }

      const content = fs.readFileSync(check.path, 'utf8');
      const missing = [];

      for (const required of check.required) {
        if (!content.includes(required)) {
          missing.push(required);
        }
      }

      if (missing.length > 0) {
        console.log(`   ⚠️  Missing: ${missing.join(', ')}`);
        allPassed = false;
      } else {
        console.log(`   ✅ All required components found`);
      }

    } catch (error) {
      console.log(`   ❌ Error reading file: ${error.message}`);
      allPassed = false;
    }
  }

  // Architecture validation
  console.log('\n🏗️  Architecture Validation');
  console.log('==========================');

  const architectureChecks = [
    {
      name: 'Session Context TTL (10 min)',
      check: () => {
        const handler = fs.readFileSync('src/lib/services/hybridStreamingHandler.ts', 'utf8');
        return handler.includes('10 * 60 * 1000') || handler.includes('SESSION_TTL_MS');
      }
    },
    {
      name: 'Demo Mode Fencing',
      check: () => {
        const handler = fs.readFileSync('src/lib/services/hybridStreamingHandler.ts', 'utf8');
        return handler.includes('jonathan-demo') && handler.includes('DEMO_COOKIE_NAME');
      }
    },
    {
      name: 'Fast Lane Token Limits',
      check: () => {
        const coordinator = fs.readFileSync('src/lib/services/streamingCoordinator.ts', 'utf8');
        return coordinator.includes('maxFastTokens') || coordinator.includes('max_tokens');
      }
    },
    {
      name: 'Memory Write Fire-and-Forget',
      check: () => {
        const handler = fs.readFileSync('src/lib/services/hybridStreamingHandler.ts', 'utf8');
        return handler.includes('queueMemoryWrite') && handler.includes('async ()');
      }
    }
  ];

  for (const check of architectureChecks) {
    try {
      const passed = check.check();
      console.log(`   ${passed ? '✅' : '❌'} ${check.name}`);
      if (!passed) allPassed = false;
    } catch (error) {
      console.log(`   ❌ ${check.name} - Error: ${error.message}`);
      allPassed = false;
    }
  }

  // Success criteria validation
  console.log('\n🎯 Success Criteria Check');
  console.log('=========================');

  const criteria = [
    'Fast Lane: first token <200ms target',
    'Deep Lane: seamless merge within ~1s',
    'Session Cache: <100ms cache hit with 10min TTL',
    'Demo isolation: separate cookie/memory spaces',
    'Graceful fallback: Fast Lane completes if Deep Lane fails'
  ];

  for (const criterion of criteria) {
    console.log(`   📋 ${criterion}`);
  }

  console.log(`\n${allPassed ? '🎉' : '⚠️ '} Implementation ${allPassed ? 'VALID' : 'NEEDS ATTENTION'}`);
  
  if (allPassed) {
    console.log('\n🚀 Ready to test! Run: node test-hybrid-streaming.js');
  } else {
    console.log('\n🔧 Please fix the issues above before testing.');
  }

  return allPassed;
}

// Component dependency check
function checkDependencies() {
  console.log('\n📦 Checking Dependencies...');
  
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const required = ['@supabase/supabase-js', 'openai', 'uuid'];
  
  for (const dep of required) {
    const hasIt = packageJson.dependencies?.[dep] || packageJson.devDependencies?.[dep];
    console.log(`   ${hasIt ? '✅' : '❌'} ${dep}`);
  }
}

if (require.main === module) {
  const isValid = validateImplementation();
  checkDependencies();
  
  if (isValid) {
    console.log('\n🎯 Next Steps:');
    console.log('1. Start your development server: npm run dev');
    console.log('2. Run tests: node test-hybrid-streaming.js');
    console.log('3. Monitor performance in browser dev tools');
    console.log('4. Check session cache stats in debug mode');
  }
}

module.exports = { validateImplementation };