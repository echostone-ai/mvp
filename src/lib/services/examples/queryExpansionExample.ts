// src/lib/services/examples/queryExpansionExample.ts
// Example demonstrating query expansion functionality

import { QueryExpander } from '../queryExpander';
import { HybridRetriever, parseHybridRetrievalConfig } from '../hybridRetrieval';
import { FactbookService } from '../factbookService';

// Example factbook data for testing
const exampleFactbook = {
  travel: {
    morocco: {
      id: 'morocco-cobra-1',
      text: 'In Morocco, I encountered a cobra on the street. It was a terrifying but fascinating experience.',
      topics: ['travel', 'morocco', 'animals'],
      keywords: ['morocco', 'cobra', 'snake', 'street', 'encounter']
    }
  },
  pets: {
    snake: {
      id: 'pet-snake-1',
      text: 'I once had a pet snake named Slither. He was a ball python and very gentle.',
      topics: ['pets', 'reptiles'],
      keywords: ['pet', 'snake', 'python', 'slither', 'gentle']
    }
  }
};

async function demonstrateQueryExpansion() {
  console.log('=== Query Expansion Example ===\n');

  try {
    // Initialize factbook service
    const factbookService = FactbookService.getInstance();
    await factbookService.loadFactbook(exampleFactbook);

    // Create hybrid retriever with expansion enabled
    const config = parseHybridRetrievalConfig();
    config.enableExpansion = 'auto';
    config.lowConfidenceThreshold = 0.35;
    config.minResultsThreshold = 2;

    console.log('Configuration:', {
      expansion_enabled: config.enableExpansion,
      low_confidence_threshold: config.lowConfidenceThreshold,
      min_results_threshold: config.minResultsThreshold
    });

    // Test query that should trigger expansion
    const testQuery = 'snake story';
    console.log(`\nTesting query: "${testQuery}"`);

    // This would require actual OpenAI API key and embedding cache
    // For demonstration purposes, we'll show the configuration
    console.log('\nQuery expansion would be triggered when:');
    console.log('- Top result score < 0.35 OR');
    console.log('- Fewer than 2 results above similarity threshold (0.3)');

    console.log('\nExpansion process:');
    console.log('1. Detect low confidence results');
    console.log('2. Send query to GPT-4 for expansion');
    console.log('3. Generate alternates and related concepts');
    console.log('4. Re-run BM25 and vector search with expanded terms');
    console.log('5. Combine and deduplicate results');

    console.log('\nExample expansion for "snake story":');
    console.log('- Canonical query: "snake story"');
    console.log('- Alternates: ["serpent story", "cobra tale"]');
    console.log('- Related concepts: ["morocco", "travel", "reptile"]');
    console.log('- Expanded query: "snake story serpent story cobra tale morocco travel reptile"');

    console.log('\nThis would help find the Morocco cobra story even if the original');
    console.log('query "snake story" had low BM25 scores.');

  } catch (error) {
    console.error('Error in query expansion example:', error);
  }
}

// Run example if this file is executed directly
if (require.main === module) {
  demonstrateQueryExpansion().catch(console.error);
}

export { demonstrateQueryExpansion };