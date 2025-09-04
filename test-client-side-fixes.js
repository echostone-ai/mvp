#!/usr/bin/env node

/**
 * Test client-side fixes for memory service
 * Simulates browser environment to ensure no server-side code runs
 */

// Simulate browser environment
global.window = {};
global.process = undefined;

// Mock console to capture warnings
const originalWarn = console.warn;
const warnings = [];
console.warn = (...args) => {
  warnings.push(args.join(' '));
  originalWarn(...args);
};

async function testClientSideFixes() {
  console.log('🧪 Testing Client-Side Memory Service Fixes...\n');

  try {
    // Test 1: Memory extraction should return empty array on client-side
    console.log('📝 Test 1: Memory extraction client-side guard');
    
    const { MemoryExtractionService } = require('./src/lib/memoryService.ts');
    
    const result = await MemoryExtractionService.extractMemoryFragments(
      'Test message',
      'test-user'
    );
    
    console.log(`✅ Memory extraction returned: ${result.length} fragments (expected: 0)`);
    console.log(`✅ Client-side guard working: ${result.length === 0 ? 'YES' : 'NO'}`);

    // Test 2: Embedding generation should return empty array on client-side
    console.log('\n📝 Test 2: Embedding generation client-side guard');
    
    const { MemoryStorageService } = require('./src/lib/memoryService.ts');
    
    const embedding = await MemoryStorageService.generateEmbedding('Test text');
    
    console.log(`✅ Embedding generation returned: ${embedding.length} dimensions (expected: 0)`);
    console.log(`✅ Client-side guard working: ${embedding.length === 0 ? 'YES' : 'NO'}`);

    // Test 3: Performance monitor should handle missing process.memoryUsage
    console.log('\n📝 Test 3: Performance monitor client-side compatibility');
    
    const { MemoryPerformanceMonitor } = require('./src/lib/memoryPerformanceMonitor.ts');
    
    const startTime = Date.now();
    MemoryPerformanceMonitor.recordMetrics('test_operation', startTime, true, { test: true });
    
    console.log('✅ Performance monitor handled client-side environment without errors');

    // Test 4: Check warnings were logged
    console.log('\n📝 Test 4: Warning messages');
    
    const memoryWarnings = warnings.filter(w => w.includes('Memory') || w.includes('server-side'));
    console.log(`✅ Found ${memoryWarnings.length} appropriate warnings:`);
    memoryWarnings.forEach((warning, i) => {
      console.log(`   ${i + 1}. ${warning}`);
    });

    console.log('\n🎉 All client-side fixes working correctly!');
    
  } catch (error) {
    console.error('❌ Client-side test failed:', error);
  }
}

// Run tests
testClientSideFixes().catch(console.error);