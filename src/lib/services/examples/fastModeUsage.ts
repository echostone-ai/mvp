/**
 * Fast Mode Optimizer Usage Examples
 * 
 * Demonstrates how to use the fast mode optimizer for sub-200ms responses
 * with caching, parallel retrieval, and selective loading.
 */

import { createContextRetrievalEngine } from '../contextRetrievalEngine';
import { createFastModeOptimizer, FastModeOptions } from '../fastModeOptimizer';

/**
 * Example 1: Basic fast mode usage
 */
export async function basicFastModeExample() {
  const contextEngine = createContextRetrievalEngine();
  const fastOptimizer = createFastModeOptimizer(contextEngine);
  
  const avatarId = 'user-avatar-123';
  const query = 'Hello, how are you?';
  
  try {
    const { context, metadata } = await fastOptimizer.retrieveContextFast(
      avatarId,
      query,
      {
        maxResponseTimeMs: 200,
        aggressiveCaching: true,
        skipMemoryForSimpleQueries: true
      }
    );
    
    console.log('Fast mode result:', {
      responseTime: metadata.responseTimeMs,
      success: metadata.success,
      cacheHitRate: metadata.cacheHitRate,
      optimizations: metadata.optimizationsApplied,
      quickFactsCount: context.quickFacts.length,
      memoryFragmentsCount: context.memoryFragments.length
    });
    
    return context;
  } catch (error) {
    console.error('Fast mode failed:', error);
    throw error;
  }
}

/**
 * Example 2: Ultra-fast mode for simple queries
 */
export async function ultraFastModeExample() {
  const contextEngine = createContextRetrievalEngine();
  const fastOptimizer = createFastModeOptimizer(contextEngine);
  
  const avatarId = 'user-avatar-123';
  const simpleQueries = [
    'Hi',
    'Hello',
    'Thanks',
    'Good morning',
    'How are you?'
  ];
  
  const results = [];
  
  for (const query of simpleQueries) {
    const startTime = performance.now();
    
    const { context, metadata } = await fastOptimizer.retrieveContextFast(
      avatarId,
      query,
      {
        maxResponseTimeMs: 100, // Ultra-fast target
        aggressiveCaching: true,
        skipMemoryForSimpleQueries: true,
        parallelismLevel: 'high'
      }
    );
    
    const actualTime = performance.now() - startTime;
    
    results.push({
      query,
      targetTime: 100,
      actualTime,
      reportedTime: metadata.responseTimeMs,
      success: metadata.success,
      optimizations: metadata.optimizationsApplied
    });
  }
  
  console.log('Ultra-fast mode results:', results);
  return results;
}

/**
 * Example 3: Complex query with selective optimization
 */
export async function complexQueryExample() {
  const contextEngine = createContextRetrievalEngine();
  const fastOptimizer = createFastModeOptimizer(contextEngine);
  
  const avatarId = 'user-avatar-123';
  const complexQuery = 'Tell me about the story you remember from last week about my family';
  
  const { context, metadata } = await fastOptimizer.retrieveContextFast(
    avatarId,
    complexQuery,
    {
      maxResponseTimeMs: 300, // More time for complex queries
      aggressiveCaching: false, // Less aggressive for complex queries
      skipMemoryForSimpleQueries: false, // Need memory fragments
      parallelismLevel: 'high'
    }
  );
  
  console.log('Complex query result:', {
    query: complexQuery,
    responseTime: metadata.responseTimeMs,
    success: metadata.success,
    optimizations: metadata.optimizationsApplied,
    dataRetrieved: {
      quickFacts: context.quickFacts.length,
      memoryFragments: context.memoryFragments.length,
      conversationHistory: context.conversationHistory.length
    }
  });
  
  return context;
}

/**
 * Example 4: Cache warming and performance monitoring
 */
export async function cacheWarmingExample() {
  const contextEngine = createContextRetrievalEngine();
  const fastOptimizer = createFastModeOptimizer(contextEngine);
  
  const avatarId = 'user-avatar-123';
  
  // Step 1: Preload cache
  console.log('Preloading cache...');
  await fastOptimizer.preloadCache(avatarId);
  
  // Step 2: Test common queries with warm cache
  const commonQueries = [
    'Hello',
    'How are you?',
    'What is my name?',
    'Tell me about yourself'
  ];
  
  const results = [];
  
  for (const query of commonQueries) {
    const { context, metadata } = await fastOptimizer.retrieveContextFast(
      avatarId,
      query,
      { aggressiveCaching: true }
    );
    
    results.push({
      query,
      responseTime: metadata.responseTimeMs,
      cacheHitRate: metadata.cacheHitRate,
      success: metadata.success
    });
  }
  
  // Step 3: Get cache statistics
  const cacheStats = fastOptimizer.getCacheStats();
  
  console.log('Cache warming results:', {
    results,
    cacheStats,
    avgResponseTime: results.reduce((sum, r) => sum + r.responseTime, 0) / results.length,
    avgCacheHitRate: results.reduce((sum, r) => sum + r.cacheHitRate, 0) / results.length
  });
  
  return { results, cacheStats };
}

/**
 * Example 5: Performance comparison between standard and fast mode
 */
export async function performanceComparisonExample() {
  const contextEngine = createContextRetrievalEngine();
  const fastOptimizer = createFastModeOptimizer(contextEngine);
  
  const avatarId = 'user-avatar-123';
  const testQueries = [
    'Hello',
    'How are you today?',
    'What is my name?',
    'Tell me about my family',
    'Remember our conversation yesterday?'
  ];
  
  const standardResults = [];
  const fastResults = [];
  
  // Test standard mode
  for (const query of testQueries) {
    const startTime = performance.now();
    
    const context = await contextEngine.retrieveContext(avatarId, query, {
      fastMode: false,
      memoryLimit: 20,
      historyLimit: 10
    });
    
    const responseTime = performance.now() - startTime;
    standardResults.push({ query, responseTime, mode: 'standard' });
  }
  
  // Test fast mode
  for (const query of testQueries) {
    const startTime = performance.now();
    
    const { context, metadata } = await fastOptimizer.retrieveContextFast(
      avatarId,
      query,
      {
        maxResponseTimeMs: 200,
        aggressiveCaching: true
      }
    );
    
    const responseTime = performance.now() - startTime;
    fastResults.push({ 
      query, 
      responseTime, 
      mode: 'fast',
      optimizations: metadata.optimizationsApplied,
      cacheHitRate: metadata.cacheHitRate
    });
  }
  
  // Calculate improvements
  const comparison = testQueries.map((query, i) => ({
    query,
    standardTime: standardResults[i].responseTime,
    fastTime: fastResults[i].responseTime,
    improvement: ((standardResults[i].responseTime - fastResults[i].responseTime) / standardResults[i].responseTime * 100).toFixed(1) + '%',
    optimizations: fastResults[i].optimizations
  }));
  
  console.log('Performance comparison:', comparison);
  
  const avgImprovement = comparison.reduce((sum, c) => {
    const improvement = parseFloat(c.improvement.replace('%', ''));
    return sum + improvement;
  }, 0) / comparison.length;
  
  console.log(`Average performance improvement: ${avgImprovement.toFixed(1)}%`);
  
  return comparison;
}

/**
 * Example 6: Handling different parallelism levels
 */
export async function parallelismLevelExample() {
  const contextEngine = createContextRetrievalEngine();
  const fastOptimizer = createFastModeOptimizer(contextEngine);
  
  const avatarId = 'user-avatar-123';
  const query = 'Tell me about my recent activities';
  
  const parallelismLevels: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];
  const results = [];
  
  for (const level of parallelismLevels) {
    const startTime = performance.now();
    
    const { context, metadata } = await fastOptimizer.retrieveContextFast(
      avatarId,
      query,
      {
        parallelismLevel: level,
        maxResponseTimeMs: 250
      }
    );
    
    const responseTime = performance.now() - startTime;
    
    results.push({
      parallelismLevel: level,
      responseTime,
      success: metadata.success,
      optimizations: metadata.optimizationsApplied,
      dataRetrieved: {
        quickFacts: context.quickFacts.length,
        memoryFragments: context.memoryFragments.length,
        conversationHistory: context.conversationHistory.length
      }
    });
  }
  
  console.log('Parallelism level comparison:', results);
  return results;
}

/**
 * Example 7: Error handling and fallback scenarios
 */
export async function errorHandlingExample() {
  const contextEngine = createContextRetrievalEngine();
  const fastOptimizer = createFastModeOptimizer(contextEngine);
  
  const avatarId = 'user-avatar-123';
  const query = 'Hello world';
  
  try {
    // Test with very aggressive time constraints
    const { context, metadata } = await fastOptimizer.retrieveContextFast(
      avatarId,
      query,
      {
        maxResponseTimeMs: 50, // Very aggressive
        aggressiveCaching: true
      }
    );
    
    console.log('Aggressive timing result:', {
      success: metadata.success,
      responseTime: metadata.responseTimeMs,
      fallbackUsed: metadata.fallbackUsed,
      optimizations: metadata.optimizationsApplied
    });
    
    return context;
    
  } catch (error) {
    console.error('Fast mode error handling:', error);
    
    // Fallback to standard mode
    const fallbackContext = await contextEngine.retrieveContext(avatarId, query, {
      fastMode: false
    });
    
    console.log('Fallback successful');
    return fallbackContext;
  }
}

/**
 * Example 8: Real-time performance monitoring
 */
export async function performanceMonitoringExample() {
  const contextEngine = createContextRetrievalEngine();
  const fastOptimizer = createFastModeOptimizer(contextEngine);
  
  const avatarId = 'user-avatar-123';
  const queries = Array(20).fill(null).map((_, i) => `Query ${i}`);
  
  const performanceMetrics = {
    totalQueries: 0,
    successfulQueries: 0,
    failedQueries: 0,
    totalResponseTime: 0,
    minResponseTime: Infinity,
    maxResponseTime: 0,
    cacheHitRates: [] as number[],
    optimizationsUsed: new Map<string, number>()
  };
  
  for (const query of queries) {
    try {
      const startTime = performance.now();
      
      const { context, metadata } = await fastOptimizer.retrieveContextFast(
        avatarId,
        query,
        {
          maxResponseTimeMs: 200,
          aggressiveCaching: true
        }
      );
      
      const responseTime = performance.now() - startTime;
      
      // Update metrics
      performanceMetrics.totalQueries++;
      performanceMetrics.successfulQueries++;
      performanceMetrics.totalResponseTime += responseTime;
      performanceMetrics.minResponseTime = Math.min(performanceMetrics.minResponseTime, responseTime);
      performanceMetrics.maxResponseTime = Math.max(performanceMetrics.maxResponseTime, responseTime);
      performanceMetrics.cacheHitRates.push(metadata.cacheHitRate);
      
      // Track optimizations
      metadata.optimizationsApplied.forEach(opt => {
        performanceMetrics.optimizationsUsed.set(
          opt,
          (performanceMetrics.optimizationsUsed.get(opt) || 0) + 1
        );
      });
      
    } catch (error) {
      performanceMetrics.totalQueries++;
      performanceMetrics.failedQueries++;
      console.error(`Query failed: ${query}`, error);
    }
  }
  
  // Calculate final metrics
  const avgResponseTime = performanceMetrics.totalResponseTime / performanceMetrics.successfulQueries;
  const avgCacheHitRate = performanceMetrics.cacheHitRates.reduce((a, b) => a + b, 0) / performanceMetrics.cacheHitRates.length;
  const successRate = (performanceMetrics.successfulQueries / performanceMetrics.totalQueries) * 100;
  
  const finalMetrics = {
    totalQueries: performanceMetrics.totalQueries,
    successRate: `${successRate.toFixed(1)}%`,
    avgResponseTime: `${avgResponseTime.toFixed(1)}ms`,
    minResponseTime: `${performanceMetrics.minResponseTime.toFixed(1)}ms`,
    maxResponseTime: `${performanceMetrics.maxResponseTime.toFixed(1)}ms`,
    avgCacheHitRate: `${(avgCacheHitRate * 100).toFixed(1)}%`,
    optimizationsUsed: Object.fromEntries(performanceMetrics.optimizationsUsed),
    sub200msTarget: avgResponseTime < 200 ? '✅ ACHIEVED' : '❌ MISSED'
  };
  
  console.log('Performance monitoring results:', finalMetrics);
  return finalMetrics;
}

// Export all examples for easy testing
export const fastModeExamples = {
  basicFastModeExample,
  ultraFastModeExample,
  complexQueryExample,
  cacheWarmingExample,
  performanceComparisonExample,
  parallelismLevelExample,
  errorHandlingExample,
  performanceMonitoringExample
};