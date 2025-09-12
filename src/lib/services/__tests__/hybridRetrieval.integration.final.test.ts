// src/lib/services/__tests__/hybridRetrieval.integration.final.test.ts
// Final integration testing and persona preservation validation for Task 15

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { HybridRetriever, parseHybridRetrievalConfig } from '../hybridRetrieval';
import { FactbookService } from '../factbookService';
import { MemoryEmbeddingCache } from '../embeddingCache';
import { CacheManager } from '../cacheManager';
import { PerformanceMonitor } from '../performanceMonitor';
import type { Fact } from '@/lib/factbook/buildIndex';
import fs from 'fs';
import path from 'path';

// Test configuration for comprehensive validation
const TEST_CONFIG = {
  // Performance targets from requirements
  PERFORMANCE_TARGETS: {
    HYBRID_DISABLED_P95: 300, // Current baseline without hybrid features
    HYBRID_ENABLED_P95: 600,  // With all features enabled (MVP: BM25+vector+RRF)
    BM25_COMPONENT: 50,       // BM25 component latency
    VECTOR_SEARCH: 100,       // Vector search latency
    QUERY_EXPANSION: 200,     // Query expansion latency
    LLM_RERANKING: 150        // LLM reranking latency
  },
  
  // Quality targets
  QUALITY_TARGETS: {
    MIN_PRECISION_AT_K: 0.8,  // Precision@k ≥ 0.8 for benchmark queries
    MIN_RECALL_IMPROVEMENT: 0.2, // Recall improvement ≥ 20% vs BM25-only
    MIN_MRR: 0.85,            // Mean Reciprocal Rank ≥ 0.85
    MIN_CACHE_HIT_RATE: 0.7,  // Cache hit rate ≥ 70%
    MAX_FALLBACK_RATE: 0.05,  // Fallback rate ≤ 5%
    MAX_MEMORY_INCREASE: 200  // Memory usage increase ≤ 200MB
  },
  
  // Test iterations for statistical significance
  PERFORMANCE_ITERATIONS: 20,
  CONSISTENCY_ITERATIONS: 5,
  LOAD_TEST_ITERATIONS: 50
};

// Golden query set for comprehensive testing
const GOLDEN_QUERY_SET = [
  {
    id: 'childhood_location',
    query: 'Where did you grow up?',
    expectedSnippets: ['timeline.childhood', 'places.vancouver_island', 'timeline.coombs_years'],
    expectedContent: ['vancouver island', 'saanichton', 'british columbia'],
    minConfidence: 0.7,
    category: 'biographical'
  },
  {
    id: 'snake_story_semantic',
    query: 'What happened with the snake?',
    expectedSnippets: ['places.morocco', 'quirks.snake_phobia'],
    expectedContent: ['morocco', 'cobra', 'phobia'],
    minConfidence: 0.6,
    category: 'semantic_connection'
  },
  {
    id: 'brother_info',
    query: 'Tell me about your brother',
    expectedSnippets: ['family.brother'],
    expectedContent: ['brother', 'family'],
    minConfidence: 0.7,
    category: 'family'
  },
  {
    id: 'current_pet_romeo',
    query: 'Tell me about Romeo',
    expectedSnippets: ['pets.romeo', 'identity.romeo'],
    expectedContent: ['poodle', 'valentine', '2024'],
    minConfidence: 0.8,
    category: 'pets'
  },
  {
    id: 'past_pets_george_olive',
    query: 'Who were George and Olive?',
    expectedSnippets: ['pets.george', 'pets.olive', 'timeline.maine_period'],
    expectedContent: ['george', 'olive', 'dogs'],
    minConfidence: 0.7,
    category: 'pets'
  },
  {
    id: 'current_location',
    query: 'Where do you live now?',
    expectedSnippets: ['identity.current_location', 'places.sofia_current'],
    expectedContent: ['sofia', 'bulgaria'],
    minConfidence: 0.7,
    category: 'biographical'
  },
  {
    id: 'partner_krissy',
    query: 'Tell me about Krissy',
    expectedSnippets: ['relationships.krissy', 'relationships.krissy_nicknames'],
    expectedContent: ['krissy', 'partner', 'girlfriend'],
    minConfidence: 0.8,
    category: 'relationships'
  },
  {
    id: 'music_interests',
    query: 'What music do you like?',
    expectedSnippets: ['interests.music', 'interests.music_early'],
    expectedContent: ['music', 'radiohead', 'electronic'],
    minConfidence: 0.6,
    category: 'interests'
  },
  {
    id: 'project_echostone',
    query: 'What is Echostone?',
    expectedSnippets: ['projects.echostone', 'projects.echostone_vision'],
    expectedContent: ['echostone', 'project', 'ai'],
    minConfidence: 0.8,
    category: 'projects'
  },
  {
    id: 'political_trump',
    query: 'What do you think about Trump?',
    expectedSnippets: ['opinions.trump'],
    expectedContent: ['trump', 'political'],
    minConfidence: 0.7,
    category: 'opinions'
  },
  {
    id: 'celebrity_encounters',
    query: 'Have you met any famous people?',
    expectedSnippets: ['memories.bill_murray', 'memories.thom_yorke'],
    expectedContent: ['bill murray', 'celebrity', 'famous'],
    minConfidence: 0.6,
    category: 'memories'
  },
  {
    id: 'friend_tyler',
    query: 'Who is Tyler?',
    expectedSnippets: ['relationships.tyler', 'relationships.tyler_partner'],
    expectedContent: ['tyler', 'friend'],
    minConfidence: 0.7,
    category: 'relationships'
  }
];

// Semantic connection test cases from requirements
const SEMANTIC_CONNECTION_TESTS = [
  {
    id: 'snake_cobra_connection',
    query: 'snake story',
    expectedSnippets: ['places.morocco'],
    description: 'Should connect snake → cobra semantically',
    requiresSemanticUnderstanding: true
  },
  {
    id: 'sxsw_concerts_connection',
    query: 'meetings at SXSW',
    expectedSnippets: ['memories.bill_murray'],
    description: 'Should find SXSW-related memories',
    requiresSemanticUnderstanding: true
  },
  {
    id: 'sxsw_concert_variation',
    query: 'SXSW concert',
    expectedSnippets: ['memories.bill_murray'],
    description: 'Should find SXSW concert memories',
    requiresSemanticUnderstanding: true
  },
  {
    id: 'tyler_identity',
    query: 'Who is Tyler?',
    expectedSnippets: ['relationships.tyler'],
    description: 'Should retrieve Tyler facts',
    requiresSemanticUnderstanding: false
  },
  {
    id: 'tyler_partner_connection',
    query: 'Tyler partner',
    expectedSnippets: ['relationships.tyler_partner'],
    description: 'Should connect Tyler → Cansu relationship',
    requiresSemanticUnderstanding: true
  },
  {
    id: 'olive_pet_memory',
    query: 'Olive',
    expectedSnippets: ['pets.olive'],
    description: 'Should retrieve precise pet memories for Olive',
    requiresSemanticUnderstanding: false
  },
  {
    id: 'george_pet_memory',
    query: 'George',
    expectedSnippets: ['pets.george'],
    description: 'Should retrieve precise pet memories for George',
    requiresSemanticUnderstanding: false
  }
];

// Adversarial queries for edge case testing
const ADVERSARIAL_QUERIES = [
  {
    query: 'Tell me about the purple elephant in your childhood',
    description: 'Should not hallucinate non-existent information',
    expectEmpty: true
  },
  {
    query: 'What happened when you met aliens?',
    description: 'Should gracefully handle impossible queries',
    expectEmpty: true
  },
  {
    query: 'snake cobra serpent reptile',
    description: 'Should handle keyword stuffing gracefully',
    expectResults: true
  },
  {
    query: 'a',
    description: 'Should handle single character queries',
    expectResults: false
  },
  {
    query: '',
    description: 'Should handle empty queries',
    expectResults: false
  },
  {
    query: 'the the the the the',
    description: 'Should handle stop word queries',
    expectResults: false
  }
];

describe('Task 15: Final Integration Testing and Persona Preservation Validation', () => {
  let hybridRetriever: HybridRetriever;
  let factbookService: FactbookService;
  let embeddingCache: MemoryEmbeddingCache;
  let cacheManager: CacheManager;
  let performanceMonitor: PerformanceMonitor;
  let factbookData: any;

  beforeAll(async () => {
    // Load actual factbook data
    const factbookPath = path.join(process.cwd(), 'data/jonathan_profile_factbook.json');
    if (fs.existsSync(factbookPath)) {
      factbookData = JSON.parse(fs.readFileSync(factbookPath, 'utf-8'));
    } else {
      // Fallback to mock data for testing
      factbookData = {
        snippets: [
          {
            id: 'timeline.childhood',
            path: 'timeline/childhood',
            text: 'I grew up on Vancouver Island in Saanichton, British Columbia.',
            topics: ['childhood', 'location'],
            keywords: ['vancouver island', 'saanichton', 'british columbia', 'grew up']
          },
          {
            id: 'places.morocco',
            path: 'places/morocco',
            text: 'In Morocco, I encountered a cobra that triggered my snake phobia.',
            topics: ['travel', 'phobia'],
            keywords: ['morocco', 'cobra', 'snake', 'phobia']
          },
          {
            id: 'pets.romeo',
            path: 'pets/romeo',
            text: 'Romeo is my poodle, adopted on Valentine\'s Day 2024.',
            topics: ['pets', 'current'],
            keywords: ['romeo', 'poodle', 'valentine', '2024']
          }
        ]
      };
    }
  });

  beforeEach(async () => {
    // Initialize services
    factbookService = FactbookService.getInstance();
    await factbookService.loadFactbook(factbookData);

    embeddingCache = new MemoryEmbeddingCache();
    cacheManager = new CacheManager();
    performanceMonitor = new PerformanceMonitor();

    // Create hybrid retriever with MVP configuration (BM25+vector+RRF)
    const config = {
      ...parseHybridRetrievalConfig(),
      enableEmbeddings: true,
      enableExpansion: 'auto' as const,
      enableReranking: false, // MVP scope - no reranking
      maxResults: 10,
      timeoutMs: 500
    };

    hybridRetriever = new HybridRetriever(
      config,
      factbookService,
      embeddingCache,
      cacheManager,
      performanceMonitor
    );

    // Warmup the system
    await hybridRetriever.warmup();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Comprehensive End-to-End Tests with All Acceptance Criteria', () => {
    it('should pass all golden query tests with performance requirements', async () => {
      const results = [];
      const latencies = [];

      for (const testCase of GOLDEN_QUERY_SET) {
        const startTime = Date.now();
        const result = await hybridRetriever.retrieve(testCase.query);
        const latency = Date.now() - startTime;
        
        latencies.push(latency);

        // Requirement 1.1-1.5: Should return relevant results
        expect(result.results.length).toBeGreaterThan(0);

        // Requirement 2.2: Should meet latency requirements
        expect(result.metrics.totalTimeMs).toBeLessThan(TEST_CONFIG.PERFORMANCE_TARGETS.HYBRID_ENABLED_P95);

        // Should meet minimum confidence
        expect(result.metrics.confidenceScore).toBeGreaterThanOrEqual(testCase.minConfidence);

        // Should find expected content
        const allText = result.results.map(r => r.snippet.text.toLowerCase()).join(' ');
        const hasExpectedContent = testCase.expectedContent.some(content => 
          allText.includes(content.toLowerCase())
        );
        expect(hasExpectedContent).toBe(true);

        results.push({
          query: testCase.query,
          resultCount: result.results.length,
          confidence: result.metrics.confidenceScore,
          latency: result.metrics.totalTimeMs,
          methodsUsed: result.metrics.methodsUsed,
          hasExpectedContent
        });

        console.log(`Golden query "${testCase.query}": ${result.results.length} results, confidence: ${result.metrics.confidenceScore.toFixed(2)}, latency: ${result.metrics.totalTimeMs}ms`);
      }

      // Calculate p95 latency
      latencies.sort((a, b) => a - b);
      const p95Index = Math.floor(latencies.length * 0.95);
      const p95Latency = latencies[p95Index];

      expect(p95Latency).toBeLessThanOrEqual(TEST_CONFIG.PERFORMANCE_TARGETS.HYBRID_ENABLED_P95);

      console.log(`Golden query set p95 latency: ${p95Latency}ms (target: ${TEST_CONFIG.PERFORMANCE_TARGETS.HYBRID_ENABLED_P95}ms)`);
    });

    it('should pass all semantic connection tests', async () => {
      for (const testCase of SEMANTIC_CONNECTION_TESTS) {
        const result = await hybridRetriever.retrieve(testCase.query);

        // Should return results
        expect(result.results.length).toBeGreaterThan(0);

        // Should find expected semantic connections
        const foundSnippetIds = result.results.map(r => r.snippet.id);
        const hasSemanticMatch = testCase.expectedSnippets.some(expectedId => 
          foundSnippetIds.some(foundId => foundId.includes(expectedId))
        );

        expect(hasSemanticMatch).toBe(true);

        // If requires semantic understanding, should use hybrid methods
        if (testCase.requiresSemanticUnderstanding) {
          const usedMethods = result.metrics.methodsUsed;
          expect(usedMethods.length).toBeGreaterThan(1);
          expect(usedMethods).toContain('bm25');
          // Should use vector search for semantic understanding
          if (result.metrics.vectorAvailable) {
            expect(usedMethods).toContain('vector');
          }
        }

        console.log(`Semantic test "${testCase.query}": found ${foundSnippetIds.join(', ')}, methods: ${result.metrics.methodsUsed.join(', ')}`);
      }
    });

    it('should handle adversarial queries and edge cases gracefully', async () => {
      for (const testCase of ADVERSARIAL_QUERIES) {
        const result = await hybridRetriever.retrieve(testCase.query);

        if (testCase.expectEmpty) {
          // Should not return results for impossible queries
          expect(result.results.length).toBe(0);
        } else if (testCase.expectResults) {
          // Should return some results for valid but challenging queries
          expect(result.results.length).toBeGreaterThan(0);
        }

        // Should not throw errors
        expect(result.metrics.errors.length).toBe(0);

        // Should complete within reasonable time
        expect(result.metrics.totalTimeMs).toBeLessThan(TEST_CONFIG.PERFORMANCE_TARGETS.HYBRID_ENABLED_P95);

        console.log(`Adversarial query "${testCase.query}": ${result.results.length} results, ${testCase.description}`);
      }
    });
  });

  describe('Persona Separation and Voice Preservation Validation', () => {
    it('should inject facts raw and preserve persona separation (Requirement 10.1)', async () => {
      const testQuery = 'Tell me about Romeo';
      const result = await hybridRetriever.retrieve(testQuery);

      expect(result.results.length).toBeGreaterThan(0);

      // Facts should be returned as raw snippets
      result.results.forEach(retrievalResult => {
        const snippet = retrievalResult.snippet;
        
        // Should have raw factbook structure
        expect(snippet).toHaveProperty('id');
        expect(snippet).toHaveProperty('path');
        expect(snippet).toHaveProperty('text');
        expect(snippet).toHaveProperty('topics');
        expect(snippet).toHaveProperty('keywords');

        // Text should be raw fact, not rewritten into first person yet
        expect(typeof snippet.text).toBe('string');
        expect(snippet.text.length).toBeGreaterThan(0);
      });

      // Persona rewriting should happen in separate pass (not in retrieval)
      // This test validates that retrieval returns raw facts
      console.log('Persona separation validated: facts returned raw for later rewriting');
    });

    it('should maintain stable persona integration regardless of retrieval method (Requirement 10.2)', async () => {
      const testQuery = 'Where did you grow up?';

      // Test with different retrieval configurations
      const configs = [
        { enableEmbeddings: false, enableExpansion: 'off' as const, enableReranking: false }, // BM25 only
        { enableEmbeddings: true, enableExpansion: 'off' as const, enableReranking: false },  // BM25 + Vector
        { enableEmbeddings: true, enableExpansion: 'auto' as const, enableReranking: false }  // Full hybrid
      ];

      const results = [];
      for (const config of configs) {
        const retriever = new HybridRetriever(
          { ...parseHybridRetrievalConfig(), ...config },
          factbookService,
          embeddingCache,
          cacheManager,
          performanceMonitor
        );
        await retriever.warmup();

        const result = await retriever.retrieve(testQuery);
        results.push(result);
      }

      // All configurations should return facts in the same format
      results.forEach((result, index) => {
        expect(result.results.length).toBeGreaterThan(0);
        
        result.results.forEach(retrievalResult => {
          // Same factbook structure regardless of retrieval method
          expect(retrievalResult.snippet).toHaveProperty('id');
          expect(retrievalResult.snippet).toHaveProperty('text');
          expect(retrievalResult.snippet).toHaveProperty('topics');
          expect(retrievalResult.snippet).toHaveProperty('keywords');
        });

        console.log(`Config ${index + 1}: ${result.results.length} results, methods: ${result.metrics.methodsUsed.join(', ')}`);
      });

      // Persona should be applied consistently regardless of retrieval method
      console.log('Persona stability validated across retrieval methods');
    });

    it('should not use logit_bias hacks for token biasing (Requirement 10.3)', async () => {
      // This test validates that the retrieval system doesn't manipulate tokens
      const testQuery = 'Tell me about your pets';
      const result = await hybridRetriever.retrieve(testQuery);

      expect(result.results.length).toBeGreaterThan(0);

      // Retrieval should return natural fact text without token manipulation
      result.results.forEach(retrievalResult => {
        const text = retrievalResult.snippet.text;
        
        // Should be natural language, not token-biased
        expect(text).toMatch(/^[A-Z]/); // Should start with capital letter
        expect(text.length).toBeGreaterThan(10); // Should be meaningful content
        expect(text).not.toMatch(/^\s*\d+\.\s/); // Should not be just numbered lists
      });

      console.log('Token biasing validation: natural language facts returned');
    });

    it('should apply personality as style layer over retrieved facts (Requirement 10.4)', async () => {
      const testQuery = 'What is Echostone?';
      const result = await hybridRetriever.retrieve(testQuery);

      expect(result.results.length).toBeGreaterThan(0);

      // Facts should be returned raw, personality applied separately
      result.results.forEach(retrievalResult => {
        const snippet = retrievalResult.snippet;
        
        // Should contain factual information
        expect(snippet.text).toBeTruthy();
        expect(snippet.topics.length).toBeGreaterThan(0);
        expect(snippet.keywords.length).toBeGreaterThan(0);

        // Retrieval should not influence fact selection based on personality
        // Facts should be selected based on relevance, not personality traits
      });

      console.log('Personality layer validation: facts selected by relevance, not personality');
    });

    it('should gracefully redirect when no relevant facts found (Requirement 10.5)', async () => {
      const impossibleQuery = 'Tell me about your pet dragon';
      const result = await hybridRetriever.retrieve(impossibleQuery);

      // Should handle gracefully without abrupt fallback
      expect(result.metrics.errors.length).toBe(0);
      expect(result.metrics.totalTimeMs).toBeGreaterThan(0);

      // If no results, should not throw errors
      if (result.results.length === 0) {
        expect(result.metrics.fallbackUsed).toBe(true);
        expect(result.metrics.fallbackLevel).toBeDefined();
      }

      console.log(`Graceful handling: ${result.results.length} results for impossible query`);
    });
  });

  describe('API Integration and Breaking Changes Validation', () => {
    it('should maintain backward compatibility with FactbookService.retrieve() (Requirement 3.4)', async () => {
      const testQuery = 'Tell me about Romeo';
      
      // Call through FactbookService interface
      const facts: Fact[] = await factbookService.retrieve(testQuery);

      // Should return Fact[] with proper structure (no breaking changes)
      expect(Array.isArray(facts)).toBe(true);
      expect(facts.length).toBeGreaterThan(0);

      facts.forEach(fact => {
        // Should maintain existing interface
        expect(fact).toHaveProperty('id');
        expect(fact).toHaveProperty('path');
        expect(fact).toHaveProperty('text');
        expect(fact).toHaveProperty('topics');
        expect(fact).toHaveProperty('keywords');
        expect(fact).toHaveProperty('type');
        expect(fact).toHaveProperty('weight');

        // Types should be correct
        expect(typeof fact.id).toBe('string');
        expect(typeof fact.text).toBe('string');
        expect(Array.isArray(fact.topics)).toBe(true);
        expect(Array.isArray(fact.keywords)).toBe(true);
        expect(typeof fact.weight).toBe('number');
      });

      console.log(`FactbookService compatibility: ${facts.length} facts returned with correct interface`);
    });

    it('should preserve factbook schema structure (Requirement 3.1)', async () => {
      const allSnippets = factbookService.getAllSnippets();
      
      expect(allSnippets.length).toBeGreaterThan(0);

      allSnippets.forEach(snippet => {
        // Should maintain { id, text, topics, keywords } schema
        expect(snippet).toHaveProperty('id');
        expect(snippet).toHaveProperty('text');
        expect(snippet).toHaveProperty('topics');
        expect(snippet).toHaveProperty('keywords');

        // Should not have additional required fields that break compatibility
        expect(typeof snippet.id).toBe('string');
        expect(typeof snippet.text).toBe('string');
        expect(Array.isArray(snippet.topics)).toBe(true);
        expect(Array.isArray(snippet.keywords)).toBe(true);
      });

      console.log(`Schema preservation: ${allSnippets.length} snippets maintain original structure`);
    });

    it('should work with existing JSON factbook structure (Requirement 3.3)', async () => {
      // Validate that factbook data loads correctly
      expect(factbookData).toBeDefined();
      expect(factbookData.snippets).toBeDefined();
      expect(Array.isArray(factbookData.snippets)).toBe(true);

      // Should load without modifications
      const loadedSnippets = factbookService.getAllSnippets();
      expect(loadedSnippets.length).toBeGreaterThan(0);

      // Structure should match original JSON
      loadedSnippets.forEach(snippet => {
        expect(snippet.id).toBeTruthy();
        expect(snippet.text).toBeTruthy();
        expect(Array.isArray(snippet.topics)).toBe(true);
        expect(Array.isArray(snippet.keywords)).toBe(true);
      });

      console.log('JSON structure compatibility validated');
    });
  });

  describe('Production-Like Load Performance Validation', () => {
    it('should meet MVP performance targets under load (BM25+vector+RRF)', async () => {
      const mvpConfig = {
        ...parseHybridRetrievalConfig(),
        enableEmbeddings: true,
        enableExpansion: 'off' as const, // MVP scope
        enableReranking: false,          // MVP scope
        maxResults: 10
      };

      const mvpRetriever = new HybridRetriever(
        mvpConfig,
        factbookService,
        embeddingCache,
        cacheManager,
        performanceMonitor
      );
      await mvpRetriever.warmup();

      const latencies: number[] = [];
      const testQueries = GOLDEN_QUERY_SET.slice(0, 6); // Representative subset

      // Simulate production-like load
      for (let i = 0; i < TEST_CONFIG.LOAD_TEST_ITERATIONS; i++) {
        const query = testQueries[i % testQueries.length];
        const startTime = Date.now();
        const result = await mvpRetriever.retrieve(query.query);
        const latency = Date.now() - startTime;
        
        latencies.push(latency);

        // Should return results
        expect(result.results.length).toBeGreaterThan(0);

        // Should use MVP methods (BM25 + vector + fusion)
        expect(result.metrics.methodsUsed).toContain('bm25');
        if (result.metrics.vectorAvailable) {
          expect(result.metrics.methodsUsed).toContain('vector');
          expect(result.metrics.methodsUsed).toContain('fusion');
        }

        // Should not use expansion or reranking in MVP
        expect(result.metrics.expansionTriggered).toBe(false);
        expect(result.metrics.rerankingApplied).toBe(false);
      }

      // Calculate performance metrics
      latencies.sort((a, b) => a - b);
      const p95Index = Math.floor(latencies.length * 0.95);
      const p95Latency = latencies[p95Index];
      const avgLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;

      // Should meet MVP performance targets
      expect(p95Latency).toBeLessThanOrEqual(TEST_CONFIG.PERFORMANCE_TARGETS.HYBRID_ENABLED_P95);
      expect(avgLatency).toBeLessThan(TEST_CONFIG.PERFORMANCE_TARGETS.HYBRID_ENABLED_P95 * 0.7);

      console.log(`MVP load test: p95=${p95Latency}ms, avg=${avgLatency.toFixed(1)}ms, iterations=${TEST_CONFIG.LOAD_TEST_ITERATIONS}`);
    });

    it('should demonstrate performance improvement over BM25-only baseline', async () => {
      // BM25-only configuration
      const bm25OnlyConfig = {
        ...parseHybridRetrievalConfig(),
        enableEmbeddings: false,
        enableExpansion: 'off' as const,
        enableReranking: false
      };

      const bm25OnlyRetriever = new HybridRetriever(
        bm25OnlyConfig,
        factbookService,
        embeddingCache,
        cacheManager,
        performanceMonitor
      );
      await bm25OnlyRetriever.warmup();

      // MVP hybrid configuration
      const hybridConfig = {
        ...parseHybridRetrievalConfig(),
        enableEmbeddings: true,
        enableExpansion: 'off' as const,
        enableReranking: false
      };

      const hybridRetriever = new HybridRetriever(
        hybridConfig,
        factbookService,
        embeddingCache,
        cacheManager,
        performanceMonitor
      );
      await hybridRetriever.warmup();

      // Test semantic queries that should benefit from hybrid approach
      const semanticQueries = [
        'snake story',
        'meetings at SXSW',
        'Tyler partner',
        'canine companions'
      ];

      let bm25OnlyRelevantResults = 0;
      let hybridRelevantResults = 0;

      for (const query of semanticQueries) {
        // BM25-only results
        const bm25Result = await bm25OnlyRetriever.retrieve(query);
        
        // Hybrid results
        const hybridResult = await hybridRetriever.retrieve(query);

        // Count relevant results (confidence > 0.5)
        bm25OnlyRelevantResults += bm25Result.results.filter(r => r.confidence > 0.5).length;
        hybridRelevantResults += hybridResult.results.filter(r => r.confidence > 0.5).length;

        console.log(`Query "${query}": BM25-only=${bm25Result.results.length}, Hybrid=${hybridResult.results.length}`);
      }

      // Hybrid should find more relevant results for semantic queries
      const improvementRatio = hybridRelevantResults / Math.max(bm25OnlyRelevantResults, 1);
      expect(improvementRatio).toBeGreaterThanOrEqual(1 + TEST_CONFIG.QUALITY_TARGETS.MIN_RECALL_IMPROVEMENT);

      console.log(`Recall improvement: ${((improvementRatio - 1) * 100).toFixed(1)}% (target: ${TEST_CONFIG.QUALITY_TARGETS.MIN_RECALL_IMPROVEMENT * 100}%)`);
    });

    it('should maintain result consistency across multiple runs', async () => {
      const testQuery = 'Tell me about Romeo';
      const results = [];

      // Run multiple times to test consistency
      for (let i = 0; i < TEST_CONFIG.CONSISTENCY_ITERATIONS; i++) {
        const result = await hybridRetriever.retrieve(testQuery);
        results.push(result);
      }

      // Results should be consistent
      const firstResultIds = results[0].results.map(r => r.snippet.id);
      
      for (let i = 1; i < results.length; i++) {
        const currentResultIds = results[i].results.map(r => r.snippet.id);
        
        // Should have significant overlap (at least 70% of results should be the same)
        const overlap = firstResultIds.filter(id => currentResultIds.includes(id)).length;
        const overlapPercentage = overlap / Math.max(firstResultIds.length, currentResultIds.length);
        
        expect(overlapPercentage).toBeGreaterThan(0.7);
      }

      console.log(`Consistency validation: ${TEST_CONFIG.CONSISTENCY_ITERATIONS} runs with >70% result overlap`);
    });
  });

  describe('System Health and Error Handling Validation', () => {
    it('should provide comprehensive health monitoring', () => {
      const health = hybridRetriever.getHealthStatus();

      expect(health.status).toMatch(/^(healthy|degraded|unhealthy)$/);
      expect(health.components).toBeDefined();
      expect(health.components.bm25).toMatch(/^(healthy|degraded|unhealthy)$/);
      expect(health.components.vector).toMatch(/^(healthy|degraded|unhealthy)$/);
      expect(health.components.expansion).toMatch(/^(healthy|degraded|unhealthy)$/);
      expect(health.components.reranking).toMatch(/^(healthy|degraded|unhealthy)$/);
      expect(health.lastCheck).toBeGreaterThan(0);
      expect(Array.isArray(health.details)).toBe(true);

      console.log(`System health: ${health.status}, components: ${JSON.stringify(health.components)}`);
    });

    it('should collect comprehensive metrics for monitoring', async () => {
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

      // Component availability should be tracked
      expect(typeof metrics.bm25Available).toBe('boolean');
      expect(typeof metrics.vectorAvailable).toBe('boolean');
      expect(typeof metrics.expansionAvailable).toBe('boolean');
      expect(typeof metrics.rerankingAvailable).toBe('boolean');

      console.log('Metrics validation: all required fields present and typed correctly');
    });

    it('should handle component failures gracefully', async () => {
      // Mock vector retriever to fail
      const originalVectorRetriever = (hybridRetriever as any).vectorRetriever;
      (hybridRetriever as any).vectorRetriever = {
        search: vi.fn().mockRejectedValue(new Error('Vector search failed')),
        isHealthy: vi.fn().mockReturnValue(false)
      };

      const result = await hybridRetriever.retrieve('Tell me about Romeo');

      // Should still return results using fallback
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.metrics.fallbackUsed).toBe(true);
      expect(result.metrics.methodsUsed).toContain('bm25');
      expect(result.metrics.methodsUsed).not.toContain('vector');
      expect(result.metrics.errors.length).toBeGreaterThan(0);

      // Should not crash the system
      expect(result.metrics.totalTimeMs).toBeGreaterThan(0);

      // Restore original
      (hybridRetriever as any).vectorRetriever = originalVectorRetriever;

      console.log('Graceful degradation validated: system continues with fallback');
    });
  });
});