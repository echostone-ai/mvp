/**
 * Context Retrieval Engine Usage Examples
 * 
 * Demonstrates how to use the ContextRetrievalEngine for fetching and merging
 * avatar context data with confidence-based filtering and performance optimization.
 */

import { createContextRetrievalEngine, RetrievalOptions } from '../contextRetrievalEngine';

/**
 * Example: Basic context retrieval
 */
export async function basicContextRetrieval() {
  const engine = createContextRetrievalEngine();
  const avatarId = 'avatar-123';
  const userQuery = 'Tell me about my hobbies';

  try {
    const context = await engine.retrieveContext(avatarId, userQuery);
    
    console.log('Retrieved Context:');
    console.log(`- Quick Facts: ${context.quickFacts.length}`);
    console.log(`- Memory Fragments: ${context.memoryFragments.length}`);
    console.log(`- Conversation History: ${context.conversationHistory.length}`);
    console.log(`- Retrieval Time: ${context.retrievalMetadata.retrievalTimeMs}ms`);
    
    return context;
  } catch (error) {
    console.error('Context retrieval failed:', error);
    throw error;
  }
}

/**
 * Example: Fast mode retrieval for quick responses
 */
export async function fastModeRetrieval() {
  const engine = createContextRetrievalEngine();
  const avatarId = 'avatar-123';
  const userQuery = 'Hi there!';

  const options: RetrievalOptions = {
    fastMode: true,
    memoryLimit: 5,
    historyLimit: 3,
    confidenceThreshold: 0.4 // Higher threshold for fast mode
  };

  try {
    const context = await engine.retrieveContext(avatarId, userQuery, options);
    
    console.log('Fast Mode Context:');
    console.log(`- Optimizations: ${context.retrievalMetadata.queryOptimizations.join(', ')}`);
    console.log(`- Cache Hits: ${context.retrievalMetadata.cacheHits.join(', ')}`);
    console.log(`- Retrieval Time: ${context.retrievalMetadata.retrievalTimeMs}ms`);
    
    return context;
  } catch (error) {
    console.error('Fast mode retrieval failed:', error);
    throw error;
  }
}

/**
 * Example: Filtered context retrieval with specific criteria
 */
export async function filteredContextRetrieval() {
  const engine = createContextRetrievalEngine();
  const avatarId = 'avatar-123';
  const userQuery = 'What do you know about my work?';

  const options: RetrievalOptions = {
    categoryFilter: ['work', 'career', 'job'],
    confidenceThreshold: 0.5,
    timeRangeFilter: {
      startDate: '2024-01-01T00:00:00Z',
      endDate: '2024-12-31T23:59:59Z'
    },
    memoryLimit: 15
  };

  try {
    const context = await engine.retrieveContext(avatarId, userQuery, options);
    
    console.log('Filtered Context:');
    context.quickFacts.forEach(fact => {
      console.log(`- ${fact.key}: ${fact.value} (confidence: ${fact.confidence})`);
    });
    
    return context;
  } catch (error) {
    console.error('Filtered retrieval failed:', error);
    throw error;
  }
}

/**
 * Example: Context merging demonstration
 */
export async function contextMergingDemo() {
  const engine = createContextRetrievalEngine();
  const avatarId = 'avatar-123';
  const userQuery = 'Tell me about my family and recent conversations';

  try {
    const context = await engine.retrieveContext(avatarId, userQuery);
    
    console.log('Context Merging Order:');
    console.log('1. Quick Facts (highest priority):');
    context.quickFacts
      .sort((a, b) => (a.priority || 10) - (b.priority || 10))
      .forEach(fact => {
        console.log(`   - ${fact.key}: ${fact.value} (priority: ${fact.priority})`);
      });
    
    console.log('2. Memory Fragments (experiential data):');
    context.memoryFragments
      .slice(0, 3) // Show first 3
      .forEach(fragment => {
        console.log(`   - ${fragment.fragmentText.substring(0, 50)}...`);
      });
    
    console.log('3. Conversation History (session context):');
    context.conversationHistory
      .slice(0, 3) // Show first 3
      .forEach(turn => {
        console.log(`   - ${turn.role}: ${turn.content.substring(0, 50)}...`);
      });
    
    return context;
  } catch (error) {
    console.error('Context merging demo failed:', error);
    throw error;
  }
}

/**
 * Example: Performance monitoring
 */
export async function performanceMonitoring() {
  const engine = createContextRetrievalEngine();
  const avatarId = 'avatar-123';
  const queries = [
    'Simple greeting',
    'Tell me about my childhood memories and family history',
    'What are my hobbies?'
  ];

  const results = [];

  for (const query of queries) {
    try {
      const startTime = Date.now();
      const context = await engine.retrieveContext(avatarId, query);
      const totalTime = Date.now() - startTime;
      
      results.push({
        query,
        retrievalTime: context.retrievalMetadata.retrievalTimeMs,
        totalTime,
        quickFactsCount: context.quickFacts.length,
        memoryFragmentsCount: context.memoryFragments.length,
        optimizations: context.retrievalMetadata.queryOptimizations
      });
      
    } catch (error) {
      console.error(`Query failed: ${query}`, error);
    }
  }

  console.log('Performance Results:');
  results.forEach(result => {
    console.log(`Query: "${result.query}"`);
    console.log(`  Retrieval: ${result.retrievalTime}ms, Total: ${result.totalTime}ms`);
    console.log(`  Data: ${result.quickFactsCount} facts, ${result.memoryFragmentsCount} memories`);
    console.log(`  Optimizations: ${result.optimizations.join(', ')}`);
    console.log('');
  });

  return results;
}

/**
 * Example: Cache management
 */
export async function cacheManagementDemo() {
  const engine = createContextRetrievalEngine();
  const avatarId = 'avatar-123';

  console.log('Initial cache stats:', engine.getCacheStats());

  // Make some requests to populate cache
  await engine.retrieveContext(avatarId, 'test query 1', { fastMode: true });
  await engine.retrieveContext(avatarId, 'test query 2', { fastMode: true });

  console.log('Cache stats after requests:', engine.getCacheStats());

  // Clear cache
  engine.clearCache();
  console.log('Cache stats after clear:', engine.getCacheStats());
}

/**
 * Example: Error handling and graceful degradation
 */
export async function errorHandlingDemo() {
  const engine = createContextRetrievalEngine();
  const avatarId = 'non-existent-avatar';

  try {
    const context = await engine.retrieveContext(avatarId, 'test query');
    console.log('Retrieved context for non-existent avatar:', context);
  } catch (error) {
    console.log('Expected error for non-existent avatar:', error.message);
  }

  // Test with invalid options
  try {
    const context = await engine.retrieveContext('valid-avatar', 'test', {
      confidenceThreshold: -1, // Invalid threshold
      memoryLimit: -5 // Invalid limit
    });
    console.log('Context with invalid options:', context);
  } catch (error) {
    console.log('Error with invalid options:', error.message);
  }
}

// Export all examples for easy testing
export const examples = {
  basicContextRetrieval,
  fastModeRetrieval,
  filteredContextRetrieval,
  contextMergingDemo,
  performanceMonitoring,
  cacheManagementDemo,
  errorHandlingDemo
};