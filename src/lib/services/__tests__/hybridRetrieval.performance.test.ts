// src/lib/services/__tests__/hybridRetrieval.performance.test.ts
// Performance regression tests for hybrid retrieval system

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HybridRetriever, parseHybridRetrievalConfig } from '../hybridRetrieval';
import { FactbookService } from '../factbookService';

// Performance targets from requirements
const PERFORMANCE_TARGETS = {
  HYBRID_DISABLED_P95: 300, // Current baseline without hybrid features
  HYBRID_ENABLED_P95: 600,  // With all features enabled (≤600ms requirement)
  BM25_COMPONENT: 50,       // BM25 component latency (≤50ms requirement)
  VECTOR_SEARCH: 100,       // Vector search latency (≤100ms requirement)
  QUERY_EXPANSION: 200,     // Query expansion latency (≤200ms requirement)
  LLM_RERANKING: 150        // LLM reranking latency (≤150ms requirement)
};

// Test queries for performance testing
const PERFORMANCE_TEST_QUERIES = [
  'Where did you grow up?',
  'Tell me about Romeo',
  'What happened with the snake?',
  'Who is Tyler?',
  'Tell me about your brother',
  'What is Echostone?',
  'Where do you live now?',
  'What music do you like?',
  'Tell me about Krissy',
  'Have you met any famous people?'
];

describe('Hybrid Retrieval Performance Regression Tests', () => {
  let hybridRetriever: HybridRetriever;
  let factbookService: FactbookService;

  beforeEach(async () => {
    // Load test factbook data
    factbookService = FactbookService.getInstance();
    
    // Load a comprehensive test factbook
    const testFactbook = {
      identity: {
        full_name: {
          id: 'identity.full_name',
          text: 'Jonathan Braden (Jon, JB, Braden), born July 26, 1979 in Saanichton, Vancouver Island, British Columbia, Canada.',
          topics: ['identity', 'name', 'birthday'],
          keywords: ['jonathan', 'braden', 'jon', 'jb', 'july', '1979', 'saanichton', 'vancouver', 'island']
        },
        current_location: {
          id: 'identity.current_location',
          text: 'Lives in Sofia, Bulgaria, exploring cobblestone streets, post-communist architecture, cafes, and hiking on Vitosha Mountain.',
          topics: ['identity', 'places', 'current'],
          keywords: ['sofia', 'bulgaria', 'vitosha', 'mountain', 'cafes']
        },
        romeo: {
          id: 'identity.romeo',
          text: 'Romeo is Jonathan\'s toy poodle, born Valentine\'s Day 2024. Very energetic and fascinated by his poodle cousins Gus and Una in France.',
          topics: ['identity', 'pets'],
          keywords: ['romeo', 'poodle', 'valentine', '2024', 'energetic', 'gus', 'una']
        }
      },
      family: {
        brother: {
          id: 'family.brother',
          text: 'Geoff Braden (Boris), born 1976 in Victoria, BC. Pilot near Denver, Colorado. Partner Georgette, sons Jason and Justin, bulldog Harley.',
          topics: ['family', 'brother'],
          keywords: ['geoff', 'boris', '1976', 'victoria', 'pilot', 'denver', 'georgette', 'jason', 'justin', 'harley']
        }
      },
      relationships: {
        krissy: {
          id: 'relationships.krissy',
          text: 'Krissy, partner since April 22, 2023 in Sofia. Born April 1999, law student, loves yoga and pilates.',
          topics: ['relationships', 'partner'],
          keywords: ['krissy', 'april', '2023', 'sofia', '1999', 'law', 'student', 'yoga', 'pilates']
        },
        tyler: {
          id: 'relationships.tyler',
          text: 'Tyler McCoy, 46, originally from St. Louis, now in Austin. Yoga instructor, tech enthusiast, foodie, world traveler.',
          topics: ['relationships', 'friends'],
          keywords: ['tyler', 'mccoy', 'st', 'louis', 'austin', 'yoga', 'instructor', 'tech', 'foodie', 'traveler']
        }
      },
      places: {
        morocco: {
          id: 'places.morocco',
          text: 'In Morocco, I encountered a cobra during a desert expedition. It was terrifying but fascinating.',
          topics: ['places', 'morocco', 'travel'],
          keywords: ['morocco', 'cobra', 'desert', 'expedition', 'snake', 'terrifying']
        }
      },
      projects: {
        echostone: {
          id: 'projects.echostone',
          text: 'Echostone is Jonathan\'s AI-driven platform preserving stories, voices, and personalities through interactive memorials.',
          topics: ['projects', 'ai', 'technology'],
          keywords: ['echostone', 'ai', 'platform', 'stories', 'voices', 'personalities', 'memorials']
        }
      },
      interests: {
        music: {
          id: 'interests.music',
          text: 'Music journey spans Beatles, Hendrix, Doors, Nirvana, techno, classical, Philip Glass, Velvet Underground, The Voidz, Orthodox chants.',
          topics: ['interests', 'music'],
          keywords: ['music', 'beatles', 'hendrix', 'doors', 'nirvana', 'techno', 'classical', 'philip', 'glass', 'velvet', 'underground', 'voidz', 'orthodox']
        }
      },
      memories: {
        bill_murray: {
          id: 'memories.bill_murray',
          text: 'Met Bill Murray during South By Southwest at a GZA concert, where Jonathan also met GZA.',
          topics: ['memories', 'celebrities', 'music'],
          keywords: ['bill', 'murray', 'south', 'by', 'southwest', 'sxsw', 'gza', 'concert']
        }
      }
    };
    
    await factbookService.loadFactbook(testFactbook);

    // Create hybrid retriever with default config
    const config = parseHybridRetrievalConfig();
    hybridRetriever = new HybridRetriever(config, factbookService);
    
    // Warmup the system
    await hybridRetriever.warmup();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('P95 Latency Requirements', () => {
    it('should meet p95 latency ≤300ms with hybrid features disabled', async () => {
      // Configure with minimal features (baseline)
      const minimalConfig = {
        ...parseHybridRetrievalConfig(),
        enableEmbeddings: false,
        enableExpansion: 'off' as const,
        enableReranking: false
      };

      const minimalRetriever = new HybridRetriever(minimalConfig, factbookService);
      await minimalRetriever.warmup();

      const latencies: number[] = [];
      const iterations = 20;

      // Run multiple iterations to get reliable p95
      for (let i = 0; i < iterations; i++) {
        const query = PERFORMANCE_TEST_QUERIES[i % PERFORMANCE_TEST_QUERIES.length];
        const startTime = Date.now();
        const result = await minimalRetriever.retrieve(query);
        const latency = Date.now() - startTime;
        
        latencies.push(latency);
        
        // Verify result quality isn't compromised
        expect(result.metrics.errors.length).toBe(0);
      }

      // Calculate p95
      latencies.sort((a, b) => a - b);
      const p95Index = Math.floor(latencies.length * 0.95);
      const p95Latency = latencies[p95Index];
      const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;

      console.log(`Minimal config - P95: ${p95Latency}ms, Avg: ${avgLatency.toFixed(1)}ms, Range: ${latencies[0]}-${latencies[latencies.length - 1]}ms`);

      expect(p95Latency).toBeLessThanOrEqual(PERFORMANCE_TARGETS.HYBRID_DISABLED_P95);
    });

    it('should meet p95 latency ≤600ms with all hybrid features enabled', async () => {
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
      const iterations = 20;

      // Run multiple iterations to get reliable p95
      for (let i = 0; i < iterations; i++) {
        const query = PERFORMANCE_TEST_QUERIES[i % PERFORMANCE_TEST_QUERIES.length];
        const startTime = Date.now();
        const result = await fullRetriever.retrieve(query);
        const latency = Date.now() - startTime;
        
        latencies.push(latency);
        
        // Verify result quality
        expect(result.results.length).toBeGreaterThanOrEqual(0);
        expect(result.metrics.totalTimeMs).toBeGreaterThan(0);
      }

      // Calculate p95
      latencies.sort((a, b) => a - b);
      const p95Index = Math.floor(latencies.length * 0.95);
      const p95Latency = latencies[p95Index];
      const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;

      console.log(`Full config - P95: ${p95Latency}ms, Avg: ${avgLatency.toFixed(1)}ms, Range: ${latencies[0]}-${latencies[latencies.length - 1]}ms`);

      expect(p95Latency).toBeLessThanOrEqual(PERFORMANCE_TARGETS.HYBRID_ENABLED_P95);
    });

    it('should show performance difference between configurations', async () => {
      // Test minimal config
      const minimalConfig = {
        ...parseHybridRetrievalConfig(),
        enableEmbeddings: false,
        enableExpansion: 'off' as const,
        enableReranking: false
      };

      const minimalRetriever = new HybridRetriever(minimalConfig, factbookService);
      await minimalRetriever.warmup();

      // Test full config
      const fullConfig = {
        ...parseHybridRetrievalConfig(),
        enableEmbeddings: true,
        enableExpansion: 'auto' as const,
        enableReranking: true
      };

      const fullRetriever = new HybridRetriever(fullConfig, factbookService);
      await fullRetriever.warmup();

      const testQuery = 'Tell me about Romeo';
      const iterations = 10;

      // Measure minimal config performance
      const minimalLatencies: number[] = [];
      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        await minimalRetriever.retrieve(testQuery);
        minimalLatencies.push(Date.now() - startTime);
      }

      // Measure full config performance
      const fullLatencies: number[] = [];
      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        await fullRetriever.retrieve(testQuery);
        fullLatencies.push(Date.now() - startTime);
      }

      const minimalAvg = minimalLatencies.reduce((sum, lat) => sum + lat, 0) / minimalLatencies.length;
      const fullAvg = fullLatencies.reduce((sum, lat) => sum + lat, 0) / fullLatencies.length;

      console.log(`Performance comparison - Minimal: ${minimalAvg.toFixed(1)}ms, Full: ${fullAvg.toFixed(1)}ms, Overhead: ${(fullAvg - minimalAvg).toFixed(1)}ms`);

      // Full config should be slower but within acceptable limits
      expect(fullAvg).toBeGreaterThan(minimalAvg);
      expect(fullAvg).toBeLessThanOrEqual(PERFORMANCE_TARGETS.HYBRID_ENABLED_P95);
    });
  });

  describe('Component-Level Performance Requirements', () => {
    it('should meet BM25 component latency ≤50ms', async () => {
      const iterations = 10;
      const bm25Times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const query = PERFORMANCE_TEST_QUERIES[i % PERFORMANCE_TEST_QUERIES.length];
        const result = await hybridRetriever.retrieve(query);
        
        if (result.metrics.bm25TimeMs !== undefined) {
          bm25Times.push(result.metrics.bm25TimeMs);
        }
      }

      if (bm25Times.length > 0) {
        const avgBM25Time = bm25Times.reduce((sum, time) => sum + time, 0) / bm25Times.length;
        const maxBM25Time = Math.max(...bm25Times);

        console.log(`BM25 performance - Avg: ${avgBM25Time.toFixed(1)}ms, Max: ${maxBM25Time}ms`);

        expect(maxBM25Time).toBeLessThanOrEqual(PERFORMANCE_TARGETS.BM25_COMPONENT);
        expect(avgBM25Time).toBeLessThanOrEqual(PERFORMANCE_TARGETS.BM25_COMPONENT * 0.8); // Average should be well under limit
      }
    });

    it('should meet vector search latency ≤100ms when enabled', async () => {
      // Enable vector search
      hybridRetriever.updateConfig({ enableEmbeddings: true });

      const iterations = 10;
      const vectorTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const query = PERFORMANCE_TEST_QUERIES[i % PERFORMANCE_TEST_QUERIES.length];
        const result = await hybridRetriever.retrieve(query);
        
        if (result.metrics.vectorTimeMs !== undefined) {
          vectorTimes.push(result.metrics.vectorTimeMs);
        }
      }

      if (vectorTimes.length > 0) {
        const avgVectorTime = vectorTimes.reduce((sum, time) => sum + time, 0) / vectorTimes.length;
        const maxVectorTime = Math.max(...vectorTimes);

        console.log(`Vector search performance - Avg: ${avgVectorTime.toFixed(1)}ms, Max: ${maxVectorTime}ms`);

        expect(maxVectorTime).toBeLessThanOrEqual(PERFORMANCE_TARGETS.VECTOR_SEARCH);
        expect(avgVectorTime).toBeLessThanOrEqual(PERFORMANCE_TARGETS.VECTOR_SEARCH * 0.8);
      }
    });

    it('should meet query expansion latency ≤200ms when triggered', async () => {
      // Enable expansion
      hybridRetriever.updateConfig({ enableExpansion: 'auto' });

      const iterations = 10;
      const expansionTimes: number[] = [];

      // Use queries that might trigger expansion (low confidence)
      const lowConfidenceQueries = [
        'obscure topic that might not match',
        'very specific unusual query',
        'random words that should not match well'
      ];

      for (let i = 0; i < iterations; i++) {
        const query = lowConfidenceQueries[i % lowConfidenceQueries.length];
        const result = await hybridRetriever.retrieve(query);
        
        if (result.metrics.expansionTimeMs !== undefined) {
          expansionTimes.push(result.metrics.expansionTimeMs);
        }
      }

      if (expansionTimes.length > 0) {
        const avgExpansionTime = expansionTimes.reduce((sum, time) => sum + time, 0) / expansionTimes.length;
        const maxExpansionTime = Math.max(...expansionTimes);

        console.log(`Query expansion performance - Avg: ${avgExpansionTime.toFixed(1)}ms, Max: ${maxExpansionTime}ms`);

        expect(maxExpansionTime).toBeLessThanOrEqual(PERFORMANCE_TARGETS.QUERY_EXPANSION);
        expect(avgExpansionTime).toBeLessThanOrEqual(PERFORMANCE_TARGETS.QUERY_EXPANSION * 0.8);
      }
    });

    it('should meet LLM reranking latency ≤150ms when enabled', async () => {
      // Enable reranking
      hybridRetriever.updateConfig({ enableReranking: true });

      const iterations = 10;
      const rerankTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const query = PERFORMANCE_TEST_QUERIES[i % PERFORMANCE_TEST_QUERIES.length];
        const result = await hybridRetriever.retrieve(query);
        
        if (result.metrics.rerankTimeMs !== undefined) {
          rerankTimes.push(result.metrics.rerankTimeMs);
        }
      }

      if (rerankTimes.length > 0) {
        const avgRerankTime = rerankTimes.reduce((sum, time) => sum + time, 0) / rerankTimes.length;
        const maxRerankTime = Math.max(...rerankTimes);

        console.log(`LLM reranking performance - Avg: ${avgRerankTime.toFixed(1)}ms, Max: ${maxRerankTime}ms`);

        expect(maxRerankTime).toBeLessThanOrEqual(PERFORMANCE_TARGETS.LLM_RERANKING);
        expect(avgRerankTime).toBeLessThanOrEqual(PERFORMANCE_TARGETS.LLM_RERANKING * 0.8);
      }
    });

    it('should show component timing breakdown', async () => {
      // Enable all features for comprehensive timing
      hybridRetriever.updateConfig({
        enableEmbeddings: true,
        enableExpansion: 'auto',
        enableReranking: true
      });

      const query = 'Tell me about Romeo';
      const result = await hybridRetriever.retrieve(query);

      console.log('Component timing breakdown:', {
        total: result.metrics.totalTimeMs,
        bm25: result.metrics.bm25TimeMs,
        vector: result.metrics.vectorTimeMs,
        expansion: result.metrics.expansionTimeMs,
        rerank: result.metrics.rerankTimeMs,
        methods: result.metrics.methodsUsed
      });

      // Verify timing consistency
      const componentSum = (result.metrics.bm25TimeMs || 0) +
                          (result.metrics.vectorTimeMs || 0) +
                          (result.metrics.expansionTimeMs || 0) +
                          (result.metrics.rerankTimeMs || 0);

      // Total time should be at least the sum of components (allowing for overhead)
      expect(result.metrics.totalTimeMs).toBeGreaterThanOrEqual(componentSum * 0.8);
    });
  });

  describe('Caching Performance Impact', () => {
    it('should show performance improvement with caching', async () => {
      const testQuery = 'Tell me about Romeo';
      const iterations = 5;

      // First run - cache miss
      const firstRunTimes: number[] = [];
      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        await hybridRetriever.retrieve(testQuery);
        firstRunTimes.push(Date.now() - startTime);
      }

      // Second run - should benefit from caching
      const secondRunTimes: number[] = [];
      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        await hybridRetriever.retrieve(testQuery);
        secondRunTimes.push(Date.now() - startTime);
      }

      const firstAvg = firstRunTimes.reduce((sum, time) => sum + time, 0) / firstRunTimes.length;
      const secondAvg = secondRunTimes.reduce((sum, time) => sum + time, 0) / secondRunTimes.length;

      console.log(`Cache performance - First run: ${firstAvg.toFixed(1)}ms, Second run: ${secondAvg.toFixed(1)}ms`);

      // Second run should be faster or at least not significantly slower
      expect(secondAvg).toBeLessThanOrEqual(firstAvg * 1.2); // Allow 20% variance
    });

    it('should maintain performance with cache warming', async () => {
      // Warm up with multiple queries
      const warmupQueries = PERFORMANCE_TEST_QUERIES.slice(0, 5);
      
      for (const query of warmupQueries) {
        await hybridRetriever.retrieve(query);
      }

      // Now test performance on warmed cache
      const testTimes: number[] = [];
      for (let i = 0; i < 10; i++) {
        const query = warmupQueries[i % warmupQueries.length];
        const startTime = Date.now();
        await hybridRetriever.retrieve(query);
        testTimes.push(Date.now() - startTime);
      }

      const avgTime = testTimes.reduce((sum, time) => sum + time, 0) / testTimes.length;
      const maxTime = Math.max(...testTimes);

      console.log(`Warmed cache performance - Avg: ${avgTime.toFixed(1)}ms, Max: ${maxTime}ms`);

      // Performance should be good with warmed cache
      expect(avgTime).toBeLessThanOrEqual(PERFORMANCE_TARGETS.HYBRID_ENABLED_P95 * 0.7);
      expect(maxTime).toBeLessThanOrEqual(PERFORMANCE_TARGETS.HYBRID_ENABLED_P95);
    });
  });

  describe('Load and Stress Testing', () => {
    it('should maintain performance under concurrent load', async () => {
      const concurrentRequests = 5;
      const iterations = 3;

      for (let iter = 0; iter < iterations; iter++) {
        const promises = [];
        const startTime = Date.now();

        // Create concurrent requests
        for (let i = 0; i < concurrentRequests; i++) {
          const query = PERFORMANCE_TEST_QUERIES[i % PERFORMANCE_TEST_QUERIES.length];
          promises.push(hybridRetriever.retrieve(query));
        }

        const results = await Promise.all(promises);
        const totalTime = Date.now() - startTime;

        // All requests should complete successfully
        expect(results.length).toBe(concurrentRequests);
        results.forEach(result => {
          expect(result.metrics.errors.length).toBe(0);
          expect(result.metrics.totalTimeMs).toBeLessThanOrEqual(PERFORMANCE_TARGETS.HYBRID_ENABLED_P95);
        });

        const avgTimePerRequest = totalTime / concurrentRequests;
        console.log(`Concurrent load test ${iter + 1} - Total: ${totalTime}ms, Avg per request: ${avgTimePerRequest.toFixed(1)}ms`);

        // Average time per request should be reasonable
        expect(avgTimePerRequest).toBeLessThanOrEqual(PERFORMANCE_TARGETS.HYBRID_ENABLED_P95);
      }
    });

    it('should handle sustained load without degradation', async () => {
      const testDuration = 3000; // 3 seconds
      const requestInterval = 100; // Request every 100ms
      const responses: any[] = [];
      const startTime = Date.now();

      let requestCount = 0;
      while (Date.now() - startTime < testDuration) {
        const query = PERFORMANCE_TEST_QUERIES[requestCount % PERFORMANCE_TEST_QUERIES.length];
        
        try {
          const response = await hybridRetriever.retrieve(query);
          responses.push({
            ...response,
            timestamp: Date.now() - startTime
          });
          requestCount++;
        } catch (error) {
          console.error('Sustained load test request failed:', error);
        }

        await new Promise(resolve => setTimeout(resolve, requestInterval));
      }

      expect(responses.length).toBeGreaterThan(10); // Should handle multiple requests

      // Analyze performance over time
      const firstHalf = responses.slice(0, Math.floor(responses.length / 2));
      const secondHalf = responses.slice(Math.floor(responses.length / 2));

      const firstHalfAvg = firstHalf.reduce((sum, r) => sum + r.metrics.totalTimeMs, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, r) => sum + r.metrics.totalTimeMs, 0) / secondHalf.length;

      console.log(`Sustained load test - ${responses.length} requests, First half: ${firstHalfAvg.toFixed(1)}ms, Second half: ${secondHalfAvg.toFixed(1)}ms`);

      // Performance shouldn't degrade significantly over time
      expect(secondHalfAvg).toBeLessThanOrEqual(firstHalfAvg * 1.5); // Allow 50% degradation
      expect(secondHalfAvg).toBeLessThanOrEqual(PERFORMANCE_TARGETS.HYBRID_ENABLED_P95);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should maintain reasonable memory usage during operation', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform many operations
      for (let i = 0; i < 50; i++) {
        const query = PERFORMANCE_TEST_QUERIES[i % PERFORMANCE_TEST_QUERIES.length];
        await hybridRetriever.retrieve(query);
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      console.log(`Memory usage - Initial: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(1)}MB, Final: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(1)}MB, Increase: ${(memoryIncrease / 1024 / 1024).toFixed(1)}MB`);

      // Memory increase should be reasonable (less than 200MB as per requirements)
      expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024); // 200MB limit
    });

    it('should show performance characteristics across query types', async () => {
      const queryTypes = [
        { type: 'simple', queries: ['Romeo', 'Tyler', 'Sofia'] },
        { type: 'medium', queries: ['Tell me about Romeo', 'Where did you grow up?', 'What is Echostone?'] },
        { type: 'complex', queries: ['Tell me about your childhood and family relationships', 'What are your thoughts on politics and society?'] }
      ];

      for (const { type, queries } of queryTypes) {
        const times: number[] = [];
        
        for (const query of queries) {
          const result = await hybridRetriever.retrieve(query);
          times.push(result.metrics.totalTimeMs);
        }

        const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
        const maxTime = Math.max(...times);

        console.log(`${type} queries - Avg: ${avgTime.toFixed(1)}ms, Max: ${maxTime}ms`);

        // All query types should meet performance requirements
        expect(maxTime).toBeLessThanOrEqual(PERFORMANCE_TARGETS.HYBRID_ENABLED_P95);
      }
    });
  });

  describe('Performance Monitoring and Alerting', () => {
    it('should provide performance metrics for monitoring', async () => {
      const results = [];
      
      // Collect metrics from multiple queries
      for (let i = 0; i < 10; i++) {
        const query = PERFORMANCE_TEST_QUERIES[i % PERFORMANCE_TEST_QUERIES.length];
        const result = await hybridRetriever.retrieve(query);
        results.push(result);
      }

      // Analyze collected metrics
      const totalTimes = results.map(r => r.metrics.totalTimeMs);
      const avgTotalTime = totalTimes.reduce((sum, time) => sum + time, 0) / totalTimes.length;
      const p95TotalTime = totalTimes.sort((a, b) => a - b)[Math.floor(totalTimes.length * 0.95)];

      const methodUsage = results.reduce((acc, r) => {
        r.metrics.methodsUsed.forEach(method => {
          acc[method] = (acc[method] || 0) + 1;
        });
        return acc;
      }, {} as Record<string, number>);

      const errorRate = results.filter(r => r.metrics.errors.length > 0).length / results.length;
      const fallbackRate = results.filter(r => r.metrics.fallbackUsed).length / results.length;

      console.log('Performance monitoring metrics:', {
        avgTotalTime: avgTotalTime.toFixed(1),
        p95TotalTime,
        methodUsage,
        errorRate: (errorRate * 100).toFixed(1) + '%',
        fallbackRate: (fallbackRate * 100).toFixed(1) + '%'
      });

      // Verify metrics are within acceptable ranges
      expect(p95TotalTime).toBeLessThanOrEqual(PERFORMANCE_TARGETS.HYBRID_ENABLED_P95);
      expect(errorRate).toBeLessThan(0.05); // Less than 5% error rate
      expect(fallbackRate).toBeLessThan(0.1); // Less than 10% fallback rate
    });

    it('should detect performance regressions', async () => {
      // Baseline measurement
      const baselineResults = [];
      for (let i = 0; i < 5; i++) {
        const result = await hybridRetriever.retrieve('Tell me about Romeo');
        baselineResults.push(result.metrics.totalTimeMs);
      }

      const baselineAvg = baselineResults.reduce((sum, time) => sum + time, 0) / baselineResults.length;

      // Simulate potential regression by adding artificial delay
      const originalRetrieve = hybridRetriever.retrieve.bind(hybridRetriever);
      hybridRetriever.retrieve = async function(query: string) {
        await new Promise(resolve => setTimeout(resolve, 50)); // Add 50ms delay
        return originalRetrieve(query);
      };

      // Regression measurement
      const regressionResults = [];
      for (let i = 0; i < 5; i++) {
        const result = await hybridRetriever.retrieve('Tell me about Romeo');
        regressionResults.push(result.metrics.totalTimeMs);
      }

      const regressionAvg = regressionResults.reduce((sum, time) => sum + time, 0) / regressionResults.length;

      console.log(`Regression detection - Baseline: ${baselineAvg.toFixed(1)}ms, Regression: ${regressionAvg.toFixed(1)}ms`);

      // Should detect the artificial regression
      expect(regressionAvg).toBeGreaterThan(baselineAvg * 1.2); // At least 20% slower

      // Restore original method
      hybridRetriever.retrieve = originalRetrieve;
    });
  });
});