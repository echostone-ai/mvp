// src/lib/services/examples/vectorRetrieverExample.ts
// Example usage of VectorRetriever for semantic search

import { VectorRetriever, VectorConfig } from '../vectorRetriever';
import { EmbeddingCache } from '../embeddingCache';
import { FactbookSnippet } from '../factbookService';

/**
 * Example demonstrating VectorRetriever usage for semantic search
 * This example shows how to:
 * 1. Initialize VectorRetriever with configuration
 * 2. Build vector index from factbook snippets
 * 3. Perform semantic searches
 * 4. Handle results and similarity scores
 */

// Example factbook snippets for demonstration
const exampleSnippets: FactbookSnippet[] = [
  {
    id: 'snake_morocco',
    path: 'experiences.morocco_cobra',
    text: 'I encountered a cobra in Morocco during my travels. The snake was coiled and ready to strike.',
    topics: ['travel', 'animals', 'morocco'],
    keywords: ['cobra', 'snake', 'morocco', 'travel']
  },
  {
    id: 'sxsw_bill_murray',
    path: 'experiences.sxsw_bill_murray',
    text: 'Met Bill Murray at SXSW music festival. He was incredibly funny and down to earth.',
    topics: ['music', 'festivals', 'celebrities'],
    keywords: ['bill', 'murray', 'sxsw', 'music', 'festival']
  },
  {
    id: 'sxsw_gza_concert',
    path: 'experiences.sxsw_gza',
    text: 'Attended GZA concert at SXSW. The Wu-Tang member put on an amazing show.',
    topics: ['music', 'festivals', 'concerts'],
    keywords: ['gza', 'wu-tang', 'sxsw', 'concert', 'music']
  },
  {
    id: 'tyler_info',
    path: 'relationships.tyler',
    text: 'Tyler is my close friend from college. We studied computer science together.',
    topics: ['friends', 'college', 'relationships'],
    keywords: ['tyler', 'friend', 'college', 'computer', 'science']
  },
  {
    id: 'tyler_cansu',
    path: 'relationships.tyler_partner',
    text: 'Tyler is dating Cansu, who is a talented artist from Turkey.',
    topics: ['relationships', 'friends'],
    keywords: ['tyler', 'cansu', 'partner', 'artist', 'turkey']
  },
  {
    id: 'olive_pet',
    path: 'pets.olive',
    text: 'Olive is my rescue dog, a Puerto Rican street dog with lots of personality.',
    topics: ['pets', 'dogs'],
    keywords: ['olive', 'dog', 'rescue', 'puerto', 'rican', 'street']
  },
  {
    id: 'george_pet',
    path: 'pets.george',
    text: 'George is my cat, a fluffy orange tabby who loves to sleep in sunny spots.',
    topics: ['pets', 'cats'],
    keywords: ['george', 'cat', 'orange', 'tabby', 'fluffy']
  }
];

// Example semantic queries that should work
const exampleQueries = [
  {
    query: 'snake story',
    expectedSnippet: 'snake_morocco',
    description: 'Should find Morocco cobra story through semantic similarity'
  },
  {
    query: 'meetings at SXSW',
    expectedSnippets: ['sxsw_bill_murray', 'sxsw_gza_concert'],
    description: 'Should find SXSW-related experiences'
  },
  {
    query: 'Who is Tyler?',
    expectedSnippet: 'tyler_info',
    description: 'Should find Tyler information'
  },
  {
    query: 'Tyler partner',
    expectedSnippet: 'tyler_cansu',
    description: 'Should connect Tyler to Cansu relationship'
  },
  {
    query: 'pet stories',
    expectedSnippets: ['olive_pet', 'george_pet'],
    description: 'Should find pet-related memories'
  }
];

/**
 * Example function demonstrating VectorRetriever initialization and usage
 */
export async function demonstrateVectorRetriever(): Promise<void> {
  console.log('=== VectorRetriever Example ===\n');

  // Check if OpenAI API key is available
  if (!process.env.OPENAI_API_KEY) {
    console.log('⚠️  OpenAI API key not found. This example requires OPENAI_API_KEY environment variable.');
    console.log('   Set it with: export OPENAI_API_KEY="your-api-key-here"');
    console.log('   For testing purposes, you can use the mock implementation instead.\n');
    return;
  }

  try {
    // 1. Initialize configuration
    console.log('1. Initializing VectorRetriever configuration...');
    const config: VectorConfig = VectorRetriever.getDefaultConfig();
    console.log(`   Model: ${config.model}`);
    console.log(`   Dimensions: ${config.dimensions}`);
    console.log(`   Max Results: ${config.maxResults}`);
    console.log(`   Similarity Threshold: ${config.similarityThreshold}\n`);

    // 2. Create embedding cache (simple in-memory for example)
    const cache: EmbeddingCache = {
      cache: new Map<string, number[]>(),
      
      async get(text: string): Promise<number[] | null> {
        return this.cache.get(text) || null;
      },
      
      async set(text: string, embedding: number[]): Promise<void> {
        this.cache.set(text, embedding);
      },
      
      async clear(): Promise<void> {
        this.cache.clear();
      },
      
      getStats() {
        return {
          size: this.cache.size,
          hitRate: 0,
          totalRequests: 0
        };
      }
    } as any;

    // 3. Initialize VectorRetriever
    console.log('2. Creating VectorRetriever instance...');
    const vectorRetriever = new VectorRetriever(config, cache);
    console.log('   ✅ VectorRetriever initialized\n');

    // 4. Build vector index from factbook snippets
    console.log('3. Building vector index from factbook snippets...');
    console.log(`   Processing ${exampleSnippets.length} snippets...`);
    
    const startTime = Date.now();
    await vectorRetriever.buildIndex(exampleSnippets);
    const buildTime = Date.now() - startTime;
    
    const stats = vectorRetriever.getIndexStats();
    console.log(`   ✅ Index built in ${buildTime}ms`);
    console.log(`   Index size: ${stats.size} vectors`);
    console.log(`   Dimensions: ${stats.dimensions}`);
    console.log(`   Model: ${stats.model}\n`);

    // 5. Perform semantic searches
    console.log('4. Performing semantic searches...\n');
    
    for (const example of exampleQueries) {
      console.log(`Query: "${example.query}"`);
      console.log(`Expected: ${example.description}`);
      
      try {
        const searchStart = Date.now();
        const results = await vectorRetriever.search(example.query, 3);
        const searchTime = Date.now() - searchStart;
        
        console.log(`Results (${results.length} found in ${searchTime}ms):`);
        
        if (results.length === 0) {
          console.log('   No results found above similarity threshold');
        } else {
          results.forEach((result, index) => {
            console.log(`   ${index + 1}. ${result.snippet.id} (similarity: ${result.similarity.toFixed(3)})`);
            console.log(`      "${result.snippet.text.substring(0, 80)}..."`);
          });
          
          // Check if expected results were found
          const foundIds = results.map(r => r.snippet.id);
          if (example.expectedSnippet && foundIds.includes(example.expectedSnippet)) {
            console.log('   ✅ Expected snippet found');
          } else if (example.expectedSnippets && 
                     example.expectedSnippets.some(id => foundIds.includes(id))) {
            console.log('   ✅ Expected snippets found');
          } else {
            console.log('   ⚠️  Expected results not in top matches');
          }
        }
        
      } catch (error) {
        console.log(`   ❌ Search failed: ${error instanceof Error ? error.message : error}`);
      }
      
      console.log('');
    }

    // 6. Demonstrate health check
    console.log('5. Checking VectorRetriever health...');
    const health = await vectorRetriever.getHealthStatus();
    console.log(`   Status: ${health.status}`);
    health.details.forEach(detail => {
      console.log(`   - ${detail}`);
    });
    console.log('');

    // 7. Show cache statistics
    console.log('6. Cache statistics:');
    const cacheStats = cache.getStats();
    console.log(`   Cache size: ${cacheStats.size} embeddings`);
    console.log(`   Hit rate: ${(cacheStats.hitRate * 100).toFixed(1)}%`);
    console.log('');

    console.log('=== Example completed successfully! ===');

  } catch (error) {
    console.error('❌ Example failed:', error instanceof Error ? error.message : error);
    
    if (error instanceof Error && error.message.includes('API key')) {
      console.log('\n💡 Tip: Make sure your OpenAI API key is valid and has sufficient credits.');
    }
  }
}

/**
 * Example function for testing VectorRetriever with mock data
 * This can be used when OpenAI API is not available
 */
export function demonstrateVectorRetrieverMock(): void {
  console.log('=== VectorRetriever Mock Example ===\n');
  
  console.log('This example demonstrates the VectorRetriever interface and expected behavior:');
  console.log('');
  
  // Show configuration options
  console.log('1. Configuration Options:');
  const defaultConfig = VectorRetriever.getDefaultConfig();
  const largeConfig = VectorRetriever.getLargeModelConfig();
  
  console.log('   Default (text-embedding-3-small):');
  console.log(`     - Dimensions: ${defaultConfig.dimensions}`);
  console.log(`     - Max Results: ${defaultConfig.maxResults}`);
  console.log(`     - Similarity Threshold: ${defaultConfig.similarityThreshold}`);
  
  console.log('   Large Model (text-embedding-3-large):');
  console.log(`     - Dimensions: ${largeConfig.dimensions}`);
  console.log(`     - Max Results: ${largeConfig.maxResults}`);
  console.log(`     - Similarity Threshold: ${largeConfig.similarityThreshold}`);
  console.log('');
  
  // Show semantic test cases
  console.log('2. Semantic Connection Test Cases:');
  exampleQueries.forEach((example, index) => {
    console.log(`   ${index + 1}. Query: "${example.query}"`);
    console.log(`      Expected: ${example.description}`);
  });
  console.log('');
  
  // Show factbook snippets
  console.log('3. Example Factbook Snippets:');
  exampleSnippets.forEach((snippet, index) => {
    console.log(`   ${index + 1}. ${snippet.id} (${snippet.topics.join(', ')})`);
    console.log(`      "${snippet.text.substring(0, 60)}..."`);
  });
  console.log('');
  
  console.log('4. Expected Semantic Connections:');
  console.log('   - "snake story" → Morocco cobra memory (semantic: snake ≈ cobra)');
  console.log('   - "meetings at SXSW" → Bill Murray & GZA encounters (context: SXSW events)');
  console.log('   - "Tyler partner" → Cansu information (relationship: Tyler → Cansu)');
  console.log('   - "pet stories" → Olive & George memories (category: pets)');
  console.log('');
  
  console.log('=== Mock example completed! ===');
  console.log('To run with real embeddings, set OPENAI_API_KEY and use demonstrateVectorRetriever()');
}

// Export for use in other examples or tests
export {
  exampleSnippets,
  exampleQueries,
  VectorConfig
};