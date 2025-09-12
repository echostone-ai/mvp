// src/lib/services/__tests__/hybridRetrieval.golden.test.ts
// Comprehensive test suite with golden query set for hybrid retrieval system

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HybridRetriever, parseHybridRetrievalConfig } from '../hybridRetrieval';
import { FactbookService } from '../factbookService';
import type { Fact } from '@/lib/factbook/buildIndex';

// Golden Query Set - Real questions that should work with the system
const GOLDEN_QUERIES = [
  {
    id: 'childhood_location',
    query: 'Where did you grow up?',
    expectedSnippets: ['timeline.childhood', 'places.vancouver_island', 'timeline.coombs_years'],
    description: 'Should find childhood location information'
  },
  {
    id: 'snake_story',
    query: 'What happened with the snake?',
    expectedSnippets: ['places.morocco', 'quirks.snake_phobia'],
    description: 'Should connect snake story to Morocco cobra encounter and phobia'
  },
  {
    id: 'brother_info',
    query: 'Tell me about your brother',
    expectedSnippets: ['family.brother'],
    description: 'Should find brother information'
  },
  {
    id: 'current_pet',
    query: 'Tell me about Romeo',
    expectedSnippets: ['pets.romeo', 'identity.romeo'],
    description: 'Should find current pet Romeo information'
  },
  {
    id: 'past_pets',
    query: 'Who were George and Olive?',
    expectedSnippets: ['pets.george', 'pets.olive', 'timeline.maine_period'],
    description: 'Should find past pet information'
  },
  {
    id: 'current_location',
    query: 'Where do you live now?',
    expectedSnippets: ['identity.current_location', 'places.sofia_current'],
    description: 'Should find current location in Sofia'
  },
  {
    id: 'partner_info',
    query: 'Tell me about Krissy',
    expectedSnippets: ['relationships.krissy', 'relationships.krissy_nicknames', 'relationships.krissy_appearance'],
    description: 'Should find partner information'
  },
  {
    id: 'music_interests',
    query: 'What music do you like?',
    expectedSnippets: ['interests.music', 'interests.music_early', 'interests.music_encounters'],
    description: 'Should find music interests and experiences'
  },
  {
    id: 'project_echostone',
    query: 'What is Echostone?',
    expectedSnippets: ['projects.echostone', 'projects.echostone_vision'],
    description: 'Should find Echostone project information'
  },
  {
    id: 'political_opinions',
    query: 'What do you think about Trump?',
    expectedSnippets: ['opinions.trump'],
    description: 'Should find political opinions'
  },
  {
    id: 'celebrity_encounters',
    query: 'Have you met any famous people?',
    expectedSnippets: ['memories.bill_murray', 'memories.thom_yorke', 'memories.barack_obama', 'memories.acl_celebrities'],
    description: 'Should find celebrity encounter memories'
  },
  {
    id: 'friend_tyler',
    query: 'Who is Tyler?',
    expectedSnippets: ['relationships.tyler', 'relationships.tyler_partner'],
    description: 'Should find Tyler friend information'
  }
];

// Core semantic connection test cases from requirements
const SEMANTIC_CONNECTION_TESTS = [
  {
    id: 'snake_cobra_connection',
    query: 'snake story',
    expectedSnippets: ['places.morocco'], // Morocco cobra memory
    description: 'Should connect snake → cobra semantically'
  },
  {
    id: 'sxsw_concerts_connection',
    query: 'meetings at SXSW',
    expectedSnippets: ['memories.bill_murray'], // Bill Murray & GZA concert entries
    description: 'Should find SXSW-related memories'
  },
  {
    id: 'sxsw_concert_variation',
    query: 'SXSW concert',
    expectedSnippets: ['memories.bill_murray'], // Bill Murray & GZA entries
    description: 'Should find SXSW concert memories'
  },
  {
    id: 'tyler_identity',
    query: 'Who is Tyler?',
    expectedSnippets: ['relationships.tyler'],
    description: 'Should retrieve Tyler facts'
  },
  {
    id: 'tyler_partner_connection',
    query: 'Tyler partner',
    expectedSnippets: ['relationships.tyler_partner'], // Cansu information
    description: 'Should connect Tyler → Cansu relationship'
  },
  {
    id: 'olive_pet_memory',
    query: 'Olive',
    expectedSnippets: ['pets.olive'],
    description: 'Should retrieve precise pet memories for Olive'
  },
  {
    id: 'george_pet_memory',
    query: 'George',
    expectedSnippets: ['pets.george'],
    description: 'Should retrieve precise pet memories for George'
  }
];

// Performance test configuration
const PERFORMANCE_TARGETS = {
  HYBRID_DISABLED_P95: 300, // Current baseline without hybrid features
  HYBRID_ENABLED_P95: 600,  // With all features enabled
  BM25_COMPONENT: 50,       // BM25 component latency
  VECTOR_SEARCH: 100,       // Vector search latency
  QUERY_EXPANSION: 200,     // Query expansion latency
  LLM_RERANKING: 150        // LLM reranking latency
};

describe('Hybrid Retrieval Golden Query Test Suite', () => {
  let hybridRetriever: HybridRetriever;
  let factbookService: FactbookService;

  beforeEach(async () => {
    // Load the actual factbook data
    factbookService = FactbookService.getInstance();
    
    // Load factbook from the actual data file
    const factbookData = await import('@/data/jonathan_profile_factbook.json');
    await factbookService.loadFactbook(factbookData.default);

    // Create hybrid retriever with default config
    const config = parseHybridRetrievalConfig();
    hybridRetriever = new HybridRetriever(config, factbookService);
    
    // Warmup the system
    await hybridRetriever.warmup();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Golden Query Set Tests', () => {
    GOLDEN_QUERIES.forEach(({ id, query, expectedSnippets, description }) => {
      it(`should handle golden query: ${id} - ${description}`, async () => {
        const result = await hybridRetriever.retrieve(query);

        // Should return results
        expect(result.results.length).toBeGreaterThan(0);

        // Should find at least one expected snippet
        const foundSnippetIds = result.results.map(r => r.snippet.id);
        const hasExpectedSnippet = expectedSnippets.some(expectedId => 
          foundSnippetIds.some(foundId => foundId.includes(expectedId))
        );

        expect(hasExpectedSnippet).toBe(true);

        // Should have reasonable confidence
        expect(result.metrics.confidenceScore).toBeGreaterThan(0.3);

        // Should complete within reasonable time
        expect(result.metrics.totalTimeMs).toBeLessThan(PERFORMANCE_TARGETS.HYBRID_ENABLED_P95);

        console.log(`Golden query "${query}": ${result.results.length} results, confidence: ${result.metrics.confidenceScore.toFixed(2)}, time: ${result.metrics.totalTimeMs}ms`);
      });
    });

    it('should maintain consistent results across multiple runs', async () => {
      const testQuery = GOLDEN_QUERIES[0];
      const runs = 3;
      const results = [];

      for (let i = 0; i < runs; i++) {
        const result = await hybridRetriever.retrieve(testQuery.query);
        results.push(result);
      }

      // Results should be consistent
      const firstResultIds = results[0].results.map(r => r.snippet.id);
      
      for (let i = 1; i < runs; i++) {
        const currentResultIds = results[i].results.map(r => r.snippet.id);
        
        // Should have significant overlap (at least 70% of results should be the same)
        const overlap = firstResultIds.filter(id => currentResultIds.includes(id)).length;
        const overlapPercentage = overlap / Math.max(firstResultIds.length, currentResultIds.length);
        
        expect(overlapPercentage).toBeGreaterThan(0.7);
      }
    });
  });

  describe('Core Semantic Connection Tests', () => {
    SEMANTIC_CONNECTION_TESTS.forEach(({ id, query, expectedSnippets, description }) => {
      it(`should pass semantic test: ${id} - ${description}`, async () => {
        const result = await hybridRetriever.retrieve(query);

        // Should return results
        expect(result.results.length).toBeGreaterThan(0);

        // Should find expected semantic connections
        const foundSnippetIds = result.results.map(r => r.snippet.id);
        const hasSemanticMatch = expectedSnippets.some(expectedId => 
          foundSnippetIds.some(foundId => foundId.includes(expectedId))
        );

        expect(hasSemanticMatch).toBe(true);

        // Should use hybrid methods (not just BM25)
        const usedMethods = result.metrics.methodsUsed;
        expect(usedMethods.length).toBeGreaterThan(1);

        console.log(`Semantic test "${query}": found ${foundSnippetIds.join(', ')}, methods: ${usedMethods.join(', ')}`);
      });
    });

    it('should demonstrate semantic understanding over keyword matching', async () => {
      // Test queries that require semantic understanding
      const semanticTests = [
        { query: 'serpent encounter', expectedTopic: 'morocco' }, // Should find snake/cobra story
        { query: 'music festival meetings', expectedTopic: 'sxsw' }, // Should find SXSW memories
        { query: 'canine companions', expectedTopic: 'pets' }, // Should find dog information
        { query: 'romantic partner', expectedTopic: 'krissy' } // Should find relationship info
      ];

      for (const test of semanticTests) {
        const result = await hybridRetriever.retrieve(test.query);
        
        expect(result.results.length).toBeGreaterThan(0);
        
        // Should find semantically related content
        const hasSemanticMatch = result.results.some(r => 
          r.snippet.text.toLowerCase().includes(test.expectedTopic) ||
          r.snippet.topics.some(topic => topic.includes(test.expectedTopic)) ||
          r.snippet.keywords.some(keyword => keyword.includes(test.expectedTopic))
        );

        expect(hasSemanticMatch).toBe(true);
      }
    });
  });

  describe('Performance Regression Tests', () => {
    it('should meet p95 latency limits with hybrid features disabled', async () => {
      // Configure with minimal features
      const minimalConfig = {
        ...parseHybridRetrievalConfig(),
        enableEmbeddings: false,
        enableExpansion: 'off' as const,
        enableReranking: false
      };

      const minimalRetriever = new HybridRetriever(minimalConfig, factbookService);
      await minimalRetriever.warmup();

      const latencies: number[] = [];
      const testQueries = GOLDEN_QUERIES.slice(0, 5); // Test subset for performance

      // Run multiple iterations to get p95
      for (let i = 0; i < 20; i++) {
        const query = testQueries[i % testQueries.length];
        const result = await minimalRetriever.retrieve(query.query);
        latencies.push(result.metrics.totalTimeMs);
      }

      latencies.sort((a, b) => a - b);
      const p95Index = Math.floor(latencies.length * 0.95);
      const p95Latency = latencies[p95Index];

      expect(p95Latency).toBeLessThanOrEqual(PERFORMANCE_TARGETS.HYBRID_DISABLED_P95);

      console.log(`Minimal config p95 latency: ${p95Latency}ms (target: ${PERFORMANCE_TARGETS.HYBRID_DISABLED_P95}ms)`);
    });

    it('should meet p95 latency limits with all hybrid features enabled', async () => {
      // Configure with all features enabled
      const fullConfig = {
        ...parseHybridRetrievalConfig(),
        enableEmbeddings: true,
        enableExpansion: 'auto' as const,
        enableReranking: true
      };

      const fullRetriever = new HybridRetriever(fullConfig, factbookService);
      await fullRetriever.warmup();

      const latencies: number[] = [];
      const testQueries = GOLDEN_QUERIES.slice(0, 5);

      // Run multiple iterations to get p95
      for (let i = 0; i < 20; i++) {
        const query = testQueries[i % testQueries.length];
        const result = await fullRetriever.retrieve(query.query);
        latencies.push(result.metrics.totalTimeMs);
      }

      latencies.sort((a, b) => a - b);
      const p95Index = Math.floor(latencies.length * 0.95);
      const p95Latency = latencies[p95Index];

      expect(p95Latency).toBeLessThanOrEqual(PERFORMANCE_TARGETS.HYBRID_ENABLED_P95);

      console.log(`Full config p95 latency: ${p95Latency}ms (target: ${PERFORMANCE_TARGETS.HYBRID_ENABLED_P95}ms)`);
    });

    it('should meet component-level performance targets', async () => {
      const testQuery = 'Tell me about Romeo';
      const result = await hybridRetriever.retrieve(testQuery);

      // BM25 component should be fast
      if (result.metrics.bm25TimeMs !== undefined) {
        expect(result.metrics.bm25TimeMs).toBeLessThanOrEqual(PERFORMANCE_TARGETS.BM25_COMPONENT);
      }

      // Vector search should be reasonable
      if (result.metrics.vectorTimeMs !== undefined) {
        expect(result.metrics.vectorTimeMs).toBeLessThanOrEqual(PERFORMANCE_TARGETS.VECTOR_SEARCH);
      }

      // Query expansion should be within limits
      if (result.metrics.expansionTimeMs !== undefined) {
        expect(result.metrics.expansionTimeMs).toBeLessThanOrEqual(PERFORMANCE_TARGETS.QUERY_EXPANSION);
      }

      // Reranking should be fast
      if (result.metrics.rerankTimeMs !== undefined) {
        expect(result.metrics.rerankTimeMs).toBeLessThanOrEqual(PERFORMANCE_TARGETS.LLM_RERANKING);
      }

      console.log('Component timings:', {
        bm25: result.metrics.bm25TimeMs,
        vector: result.metrics.vectorTimeMs,
        expansion: result.metrics.expansionTimeMs,
        rerank: result.metrics.rerankTimeMs
      });
    });

    it('should show performance improvement with caching', async () => {
      const testQuery = 'Where did you grow up?';

      // First call - cache miss
      const firstResult = await hybridRetriever.retrieve(testQuery);
      const firstTime = firstResult.metrics.totalTimeMs;

      // Second call - should benefit from caching
      const secondResult = await hybridRetriever.retrieve(testQuery);
      const secondTime = secondResult.metrics.totalTimeMs;

      // Second call should be faster (or at least not significantly slower)
      expect(secondTime).toBeLessThanOrEqual(firstTime * 1.2); // Allow 20% variance

      console.log(`Cache performance: ${firstTime}ms → ${secondTime}ms`);
    });
  });

  describe('Golden Output Validation Tests', () => {
    const GOLDEN_OUTPUTS = [
      {
        query: 'Where did you grow up?',
        expectedContent: ['vancouver island', 'saanichton', 'british columbia'],
        minResults: 1,
        minConfidence: 0.7
      },
      {
        query: 'Tell me about Romeo',
        expectedContent: ['poodle', 'valentine', '2024'],
        minResults: 1,
        minConfidence: 0.8
      },
      {
        query: 'What happened with the snake?',
        expectedContent: ['morocco', 'cobra', 'phobia'],
        minResults: 1,
        minConfidence: 0.6
      }
    ];

    GOLDEN_OUTPUTS.forEach(({ query, expectedContent, minResults, minConfidence }) => {
      it(`should validate golden output for: "${query}"`, async () => {
        const result = await hybridRetriever.retrieve(query);

        // Should meet minimum result count
        expect(result.results.length).toBeGreaterThanOrEqual(minResults);

        // Should meet minimum confidence
        expect(result.metrics.confidenceScore).toBeGreaterThanOrEqual(minConfidence);

        // Should contain expected content
        const allText = result.results.map(r => r.snippet.text.toLowerCase()).join(' ');
        const hasExpectedContent = expectedContent.some(content => 
          allText.includes(content.toLowerCase())
        );

        expect(hasExpectedContent).toBe(true);

        console.log(`Golden output "${query}": ${result.results.length} results, confidence: ${result.metrics.confidenceScore.toFixed(2)}`);
      });
    });

    it('should maintain result quality across different query phrasings', async () => {
      const queryVariations = [
        'Where did you grow up?',
        'What was your childhood location?',
        'Tell me about where you lived as a kid',
        'Your hometown?'
      ];

      const results = [];
      for (const query of queryVariations) {
        const result = await hybridRetriever.retrieve(query);
        results.push(result);
      }

      // All variations should return reasonable results
      results.forEach((result, index) => {
        expect(result.results.length).toBeGreaterThan(0);
        expect(result.metrics.confidenceScore).toBeGreaterThan(0.3);
        
        console.log(`Query variation "${queryVariations[index]}": ${result.results.length} results, confidence: ${result.metrics.confidenceScore.toFixed(2)}`);
      });

      // Should have some consistency in top results
      const topResultIds = results.map(r => r.results[0]?.snippet.id);
      const uniqueTopResults = new Set(topResultIds);
      
      // Should not have completely different top results for similar queries
      expect(uniqueTopResults.size).toBeLessThanOrEqual(queryVariations.length * 0.7);
    });
  });

  describe('Fallback Behavior Tests', () => {
    it('should gracefully degrade when vector search fails', async () => {
      // Mock vector retriever to fail
      const originalVectorRetriever = (hybridRetriever as any).vectorRetriever;
      (hybridRetriever as any).vectorRetriever = {
        search: vi.fn().mockRejectedValue(new Error('Vector search failed')),
        isHealthy: vi.fn().mockReturnValue(false)
      };

      const result = await hybridRetriever.retrieve('Tell me about Romeo');

      // Should still return results using BM25
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.metrics.fallbackUsed).toBe(true);
      expect(result.metrics.methodsUsed).toContain('bm25');
      expect(result.metrics.methodsUsed).not.toContain('vector');
      expect(result.metrics.errors.length).toBeGreaterThan(0);

      // Restore original
      (hybridRetriever as any).vectorRetriever = originalVectorRetriever;
    });

    it('should gracefully degrade when query expansion fails', async () => {
      // Mock query expander to fail
      const originalQueryExpander = (hybridRetriever as any).queryExpander;
      (hybridRetriever as any).queryExpander = {
        expandQuery: vi.fn().mockRejectedValue(new Error('Expansion failed')),
        isHealthy: vi.fn().mockReturnValue(false)
      };

      // Use a query that would normally trigger expansion (low confidence)
      const result = await hybridRetriever.retrieve('obscure topic that should trigger expansion');

      // Should still return results without expansion
      expect(result.metrics.fallbackUsed).toBe(true);
      expect(result.metrics.expansionTriggered).toBe(false);
      expect(result.metrics.errors.length).toBeGreaterThan(0);

      // Restore original
      (hybridRetriever as any).queryExpander = originalQueryExpander;
    });

    it('should gracefully degrade when reranking fails', async () => {
      // Enable reranking first
      hybridRetriever.updateConfig({ enableReranking: true });

      // Mock result reranker to fail
      const originalResultReranker = (hybridRetriever as any).resultReranker;
      (hybridRetriever as any).resultReranker = {
        rerank: vi.fn().mockRejectedValue(new Error('Reranking failed')),
        isHealthy: vi.fn().mockReturnValue(false)
      };

      const result = await hybridRetriever.retrieve('Tell me about Romeo');

      // Should still return results without reranking
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.metrics.fallbackUsed).toBe(true);
      expect(result.metrics.rerankingApplied).toBe(false);
      expect(result.metrics.errors.length).toBeGreaterThan(0);

      // Restore original
      (hybridRetriever as any).resultReranker = originalResultReranker;
    });

    it('should fallback to empty results when all components fail', async () => {
      // Mock all components to fail
      const originalBM25Retriever = (hybridRetriever as any).bm25Retriever;
      const originalVectorRetriever = (hybridRetriever as any).vectorRetriever;

      (hybridRetriever as any).bm25Retriever = {
        search: vi.fn().mockRejectedValue(new Error('BM25 failed')),
        isHealthy: vi.fn().mockReturnValue(false)
      };

      (hybridRetriever as any).vectorRetriever = {
        search: vi.fn().mockRejectedValue(new Error('Vector failed')),
        isHealthy: vi.fn().mockReturnValue(false)
      };

      const result = await hybridRetriever.retrieve('test query');

      // Should return empty results gracefully
      expect(result.results.length).toBe(0);
      expect(result.metrics.fallbackUsed).toBe(true);
      expect(result.metrics.errors.length).toBeGreaterThan(0);

      // Should not throw errors
      expect(result.metrics.totalTimeMs).toBeGreaterThan(0);

      // Restore originals
      (hybridRetriever as any).bm25Retriever = originalBM25Retriever;
      (hybridRetriever as any).vectorRetriever = originalVectorRetriever;
    });

    it('should handle timeout scenarios gracefully', async () => {
      // Mock components to be very slow
      const originalBM25Retriever = (hybridRetriever as any).bm25Retriever;
      
      (hybridRetriever as any).bm25Retriever = {
        search: vi.fn().mockImplementation(() => 
          new Promise(resolve => setTimeout(() => resolve([]), 2000)) // 2 second delay
        ),
        isHealthy: vi.fn().mockReturnValue(true)
      };

      // Set a short timeout
      hybridRetriever.updateConfig({ timeoutMs: 100 });

      const result = await hybridRetriever.retrieve('test query');

      // Should handle timeout gracefully
      expect(result.metrics.totalTimeMs).toBeLessThan(200); // Should timeout quickly
      expect(result.metrics.fallbackUsed).toBe(true);

      // Restore original
      (hybridRetriever as any).bm25Retriever = originalBM25Retriever;
    });
  });

  describe('Integration with FactbookService', () => {
    it('should integrate seamlessly with FactbookService.retrieve()', async () => {
      const testQuery = 'Tell me about Romeo';
      
      // Call through FactbookService
      const facts: Fact[] = await factbookService.retrieve(testQuery);

      // Should return Fact[] with proper structure
      expect(Array.isArray(facts)).toBe(true);
      expect(facts.length).toBeGreaterThan(0);

      facts.forEach(fact => {
        expect(fact).toHaveProperty('id');
        expect(fact).toHaveProperty('path');
        expect(fact).toHaveProperty('text');
        expect(fact).toHaveProperty('topics');
        expect(fact).toHaveProperty('keywords');
        expect(fact).toHaveProperty('type');
        expect(fact).toHaveProperty('weight');
      });

      // Should find Romeo information
      const hasRomeoInfo = facts.some(fact => 
        fact.text.toLowerCase().includes('romeo') ||
        fact.keywords.includes('romeo')
      );

      expect(hasRomeoInfo).toBe(true);
    });

    it('should maintain backward compatibility with existing API', async () => {
      const queries = [
        'Where did you grow up?',
        'Tell me about your pets',
        'What is Echostone?'
      ];

      for (const query of queries) {
        const facts = await factbookService.retrieve(query);
        
        // Should maintain the same interface
        expect(Array.isArray(facts)).toBe(true);
        
        if (facts.length > 0) {
          const fact = facts[0];
          expect(typeof fact.id).toBe('string');
          expect(typeof fact.text).toBe('string');
          expect(Array.isArray(fact.topics)).toBe(true);
          expect(Array.isArray(fact.keywords)).toBe(true);
          expect(typeof fact.weight).toBe('number');
        }
      }
    });
  });

  describe('System Health and Monitoring', () => {
    it('should provide comprehensive health status', () => {
      const health = hybridRetriever.getHealthStatus();

      expect(health.status).toMatch(/^(healthy|degraded|unhealthy)$/);
      expect(health.components).toBeDefined();
      expect(health.components.bm25).toMatch(/^(healthy|degraded|unhealthy)$/);
      expect(health.components.vector).toMatch(/^(healthy|degraded|unhealthy)$/);
      expect(health.components.expansion).toMatch(/^(healthy|degraded|unhealthy)$/);
      expect(health.components.reranking).toMatch(/^(healthy|degraded|unhealthy)$/);
      expect(health.lastCheck).toBeGreaterThan(0);
      expect(Array.isArray(health.details)).toBe(true);
    });

    it('should collect comprehensive metrics', async () => {
      const result = await hybridRetriever.retrieve('Tell me about Romeo');
      const metrics = result.metrics;

      // Should have all required metrics
      expect(typeof metrics.totalTimeMs).toBe('number');
      expect(typeof metrics.resultCount).toBe('number');
      expect(typeof metrics.confidenceScore).toBe('number');
      expect(typeof metrics.expansionTriggered).toBe('boolean');
      expect(typeof metrics.rerankingApplied).toBe('boolean');
      expect(typeof metrics.fallbackUsed).toBe('boolean');
      expect(Array.isArray(metrics.methodsUsed)).toBe(true);
      expect(Array.isArray(metrics.errors)).toBe(true);
      expect(Array.isArray(metrics.warnings)).toBe(true);

      // Component timings should be present when components are used
      if (metrics.methodsUsed.includes('bm25')) {
        expect(typeof metrics.bm25TimeMs).toBe('number');
      }
      if (metrics.methodsUsed.includes('vector')) {
        expect(typeof metrics.vectorTimeMs).toBe('number');
      }
    });
  });
});