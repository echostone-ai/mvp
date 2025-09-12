// src/lib/services/examples/hybridRetrievalExample.ts
// Example demonstrating hybrid retrieval system usage

import { HybridRetriever, parseHybridRetrievalConfig } from '../hybridRetrieval';
import { FactbookService } from '../factbookService';

/**
 * Example demonstrating basic hybrid retrieval usage
 */
export async function basicHybridRetrievalExample() {
  console.log('=== Basic Hybrid Retrieval Example ===');
  
  // 1. Parse configuration from environment variables
  const config = parseHybridRetrievalConfig();
  console.log('Configuration:', {
    embeddings: config.enableEmbeddings,
    expansion: config.enableExpansion,
    reranking: config.enableReranking,
    timeout: config.timeoutMs
  });
  
  // 2. Create hybrid retriever instance
  const retriever = new HybridRetriever(config);
  
  // 3. Load sample factbook data
  const factbookService = FactbookService.getInstance();
  const sampleFactbook = {
    pets: {
      olive: {
        id: 'pets.olive',
        text: 'Olive is a Puerto Rican street dog who loves adventures and treats.',
        topics: ['pets', 'dogs', 'olive'],
        keywords: ['olive', 'puerto', 'rican', 'street', 'dog', 'adventures', 'treats']
      },
      romeo: {
        id: 'pets.romeo',
        text: 'Romeo is a playful cat who enjoys sunny windowsills.',
        topics: ['pets', 'cats', 'romeo'],
        keywords: ['romeo', 'cat', 'playful', 'sunny', 'windowsills']
      }
    },
    places: {
      morocco: {
        id: 'places.morocco',
        text: 'In Morocco, I encountered a cobra during a desert expedition.',
        topics: ['places', 'morocco', 'travel'],
        keywords: ['morocco', 'cobra', 'desert', 'expedition', 'snake']
      }
    }
  };
  
  await factbookService.loadFactbook(sampleFactbook);
  
  // 4. Warmup the retriever
  await retriever.warmup();
  
  // 5. Check health status
  const healthStatus = retriever.getHealthStatus();
  console.log('Health Status:', healthStatus.status);
  console.log('Component Status:', healthStatus.components);
  
  // 6. Perform some example queries
  const queries = [
    'olive dog',
    'snake story',
    'playful cat',
    'desert adventure'
  ];
  
  for (const query of queries) {
    console.log(`\n--- Query: "${query}" ---`);
    
    const result = await retriever.retrieve(query);
    
    console.log('Results:', result.results.length);
    result.results.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.snippet.id}: ${r.snippet.text.substring(0, 60)}...`);
      console.log(`     Score: ${r.score}, Source: ${r.source}, Confidence: ${r.confidence}`);
    });
    
    console.log('Metrics:', {
      totalTime: result.metrics.totalTimeMs + 'ms',
      bm25Time: result.metrics.bm25TimeMs + 'ms',
      methodsUsed: result.metrics.methodsUsed,
      confidence: result.metrics.confidenceScore
    });
  }
}

/**
 * Example demonstrating configuration management
 */
export async function configurationExample() {
  console.log('\n=== Configuration Management Example ===');
  
  // 1. Create retriever with default config
  const defaultConfig = parseHybridRetrievalConfig();
  const retriever = new HybridRetriever(defaultConfig);
  
  console.log('Default Config:', {
    maxResults: defaultConfig.maxResults,
    enableReranking: defaultConfig.enableReranking,
    timeoutMs: defaultConfig.timeoutMs
  });
  
  // 2. Update configuration at runtime
  retriever.updateConfig({
    maxResults: 5,
    enableReranking: true,
    timeoutMs: 1000
  });
  
  const updatedConfig = retriever.getConfig();
  console.log('Updated Config:', {
    maxResults: updatedConfig.maxResults,
    enableReranking: updatedConfig.enableReranking,
    timeoutMs: updatedConfig.timeoutMs
  });
  
  // 3. Check health status after config change
  const healthStatus = retriever.getHealthStatus();
  console.log('Health after config change:', healthStatus.status);
}

/**
 * Example demonstrating error handling and fallbacks
 */
export async function errorHandlingExample() {
  console.log('\n=== Error Handling Example ===');
  
  const config = parseHybridRetrievalConfig();
  const retriever = new HybridRetriever(config);
  
  // 1. Try to use retriever without loading factbook
  try {
    await retriever.warmup();
  } catch (error) {
    console.log('Expected warmup error:', error instanceof Error ? error.message : error);
  }
  
  // 2. Load factbook and try again
  const factbookService = FactbookService.getInstance();
  await factbookService.loadFactbook({
    test: {
      item: {
        id: 'test.item',
        text: 'Test item for error handling example.',
        topics: ['test'],
        keywords: ['test', 'item', 'example']
      }
    }
  });
  
  await retriever.warmup();
  console.log('Warmup successful after loading factbook');
  
  // 3. Test retrieval with various queries
  const testQueries = ['valid query', '', 'nonexistent topic'];
  
  for (const query of testQueries) {
    const result = await retriever.retrieve(query);
    console.log(`Query "${query}":`, {
      results: result.results.length,
      errors: result.metrics.errors.length,
      fallbackUsed: result.metrics.fallbackUsed
    });
  }
}

/**
 * Run all examples
 */
export async function runHybridRetrievalExamples() {
  try {
    await basicHybridRetrievalExample();
    await configurationExample();
    await errorHandlingExample();
    
    console.log('\n=== All Examples Completed Successfully ===');
  } catch (error) {
    console.error('Example failed:', error);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  runHybridRetrievalExamples();
}