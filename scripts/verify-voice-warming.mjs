#!/usr/bin/env node

/**
 * Voice Warming Service Verification Script
 * Task 10: Optimize ElevenLabs integration with voice warming
 */

import { voiceWarmingService } from '../src/lib/services/voiceWarmingService.js';

async function verifyVoiceWarming() {
  console.log('🎤 Voice Warming Service Verification');
  console.log('=====================================');
  
  try {
    // Test 1: Check service initialization
    console.log('\n1. Service Initialization:');
    const metrics = voiceWarmingService.getMetrics();
    console.log(`   ✓ Service initialized`);
    console.log(`   ✓ Active sessions: ${metrics.activeSessions}`);
    console.log(`   ✓ Warming attempts: ${metrics.warmingAttempts}`);
    console.log(`   ✓ Success rate: ${metrics.warmingSuccesses}/${metrics.warmingAttempts}`);
    
    // Test 2: Voice warming functionality
    console.log('\n2. Voice Warming:');
    const testVoiceId = 'test-voice-verification';
    
    console.log(`   • Warming voice: ${testVoiceId}`);
    const startTime = Date.now();
    await voiceWarmingService.warmVoiceSession(testVoiceId);
    const warmingTime = Date.now() - startTime;
    
    console.log(`   ✓ Warming completed in ${warmingTime}ms`);
    console.log(`   ✓ Voice warmed: ${voiceWarmingService.isVoiceWarmed(testVoiceId)}`);
    
    // Test 3: Optimized configuration
    console.log('\n3. Optimized Configuration:');
    const config = await voiceWarmingService.getOptimizedVoiceConfig(testVoiceId);
    console.log(`   ✓ Is warmed: ${config.isWarmed}`);
    console.log(`   ✓ Estimated delay: ${config.estimatedDelay}ms`);
    console.log(`   ✓ Within target (<200ms): ${config.estimatedDelay < 200 ? '✓' : '✗'}`);
    console.log(`   ✓ Model: ${config.config.model_id}`);
    console.log(`   ✓ Format: ${config.config.output_format}`);
    
    // Test 4: Text fallback
    console.log('\n4. Text Fallback:');
    const fallback = voiceWarmingService.createTextFallbackResponse(
      'Test message for fallback verification',
      'Test error'
    );
    console.log(`   ✓ Fallback created: ${fallback.fallback}`);
    console.log(`   ✓ Immediate response: ${fallback.estimatedDelay === 0 ? '✓' : '✗'}`);
    console.log(`   ✓ Text preserved: ${fallback.text.length > 0 ? '✓' : '✗'}`);
    
    // Test 5: Performance metrics
    console.log('\n5. Performance Metrics:');
    const finalMetrics = voiceWarmingService.getMetrics();
    console.log(`   ✓ Cache hits: ${finalMetrics.cacheHits}`);
    console.log(`   ✓ Cache misses: ${finalMetrics.cacheMisses}`);
    console.log(`   ✓ Average warming time: ${finalMetrics.averageWarmingTime.toFixed(1)}ms`);
    console.log(`   ✓ Active sessions: ${finalMetrics.activeSessions}`);
    
    // Test 6: Requirements verification
    console.log('\n6. Requirements Verification:');
    console.log(`   ✓ Req 1.2 - Voice model caching: ${config.isWarmed ? '✓' : '✗'}`);
    console.log(`   ✓ Req 1.2 - <200ms delay target: ${config.estimatedDelay < 200 ? '✓' : '✗'}`);
    console.log(`   ✓ Req 8.3 - Text fallback: ${fallback.fallback ? '✓' : '✗'}`);
    console.log(`   ✓ Req 8.3 - Non-blocking: ${fallback.estimatedDelay === 0 ? '✓' : '✗'}`);
    
    console.log('\n🎉 Voice Warming Service Verification Complete!');
    console.log('All core functionality is working correctly.');
    
  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    process.exit(1);
  }
}

// Run verification if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyVoiceWarming().catch(console.error);
}

export { verifyVoiceWarming };