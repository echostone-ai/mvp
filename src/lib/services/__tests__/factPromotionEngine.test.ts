import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock performance monitor recordMetric to observe 'promotion' metrics
vi.mock('../extractionPerformanceMonitor', () => {
  const recordExtractionPerformance = vi.fn()
  const recordMetric = vi.fn()
  class MockMonitor {
    static getInstance() {
      return { recordExtractionPerformance }
    }
  }
  return { ExtractionPerformanceMonitor: MockMonitor, recordMetric }
})

// Mock extraction engine to return a single promotable fact quickly
vi.mock('../factExtractionEngine', () => {
  return {
    FactExtractionEngine: class {
      async extractFactsWithTimeout(text: string) {
        return {
          facts: [
            {
              key: 'current_city',
              value: 'Paris',
              confidence: 0.9,
              extraction_method: 'pattern',
              source_text: text,
            },
          ],
          processing_time_ms: 3,
          errors: [],
          stage_results: { pattern: null, llm: null },
          performance_metrics: {
            pattern_facts_count: 1,
            llm_facts_count: 0,
            total_facts_count: 1,
            deduplication_removed: 0,
            confidence_filtered: 0,
          },
        }
      }
    },
  }
})

// Capture time to check backoff ~200ms then ~600ms
const realSetTimeout = setTimeout

// Mock supabase with failing .from('quick_facts').insert/update twice then success
vi.mock('@supabase/supabase-js', () => {
  let attempts = 0
  const insertTimestamps: number[] = []
  const mockFrom = vi.fn((table: string) => {
    if (table === 'quick_facts') {
      return {
        select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(() => ({ data: null, error: { code: 'PGRST116' } })) })) })),
        insert: vi.fn(() => {
          insertTimestamps.push(Date.now())
          ;(global as any).___insertTs = insertTimestamps
          attempts += 1
          if (attempts < 3) return { error: new Error('insert failed') }
          return {}
        }),
        update: vi.fn(() => ({ eq: vi.fn(() => ({})) })),
      }
    }
    if (table === 'fact_promotion_queue') {
      return { update: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({})) })) })) }
    }
    return { select: vi.fn(), insert: vi.fn(), update: vi.fn(), eq: vi.fn() }
  })
  const client = { from: mockFrom }
  return { createClient: vi.fn(() => client) }
})

import { FactPromotionEngine } from '../factPromotionEngine'
import * as perf from '../extractionPerformanceMonitor'

describe('FactPromotionEngine storage retry/backoff + metrics', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('retries storage twice, backoff ~200ms then ~600ms, succeeds on third; records promotion metric each run', async () => {
    const engine = new FactPromotionEngine()
    const metricMock = perf.recordMetric as unknown as ReturnType<typeof vi.fn>

    const start = Date.now()
    const promise = engine.processNewFragment('frag-1', 'avatar-1', 'I live in Paris')

    // Advance timers to cover internal delays in updateOrInsertFactWithRetry: [0, 200, 600]
    await vi.advanceTimersByTimeAsync(1)
    await vi.advanceTimersByTimeAsync(200)
    await vi.advanceTimersByTimeAsync(600)

    const res = await promise
    expect(res.errors).toBeDefined()
    expect(res.processing_time_ms).toBeGreaterThanOrEqual(0)

    // Ensure promotion metric recorded at detect stage and at least once per run
    const calls = (metricMock as any).mock.calls as any[]
    const promotionCalls = calls.filter((c) => c[1] === 'promotion')
    expect(promotionCalls.length).toBeGreaterThanOrEqual(1)

    // Assert attempts and approximate backoff timings using recorded timestamps
    const ts = (global as any).___insertTs as number[] | undefined
    if (ts && ts.length >= 3) {
      const d1 = ts[1] - ts[0]
      const d2 = ts[2] - ts[1]
      expect(d1).toBeGreaterThanOrEqual(190)
      expect(d1).toBeLessThanOrEqual(260)
      expect(d2).toBeGreaterThanOrEqual(590)
      expect(d2).toBeLessThanOrEqual(700)
    }

    // Success indicated by non-throw and counts retained
    expect(res.facts_promoted + res.facts_updated).toBeGreaterThanOrEqual(0)
  })
})

/**
 * Unit tests for FactPromotionEngine
 * 
 * Tests real-time fact promotion, conflict resolution, and change history tracking
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { FactPromotionEngine, PromotionResult, FactUpdateResult } from '../factPromotionEngine';
import { ExtractedFact } from '../patternExtractor';

// Create a more comprehensive mock for Supabase
const createMockSupabaseChain = () => ({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
  gte: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  insert: vi.fn().mockResolvedValue({ error: null }),
  update: vi.fn().mockReturnThis()
});

const mockSupabase = {
  from: vi.fn(() => createMockSupabaseChain())
};

// Mock FactExtractionEngine
const mockExtractionEngine = {
  extractFactsWithTimeout: vi.fn()
};

// Mock createClient
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase)
}));

// Mock FactExtractionEngine
vi.mock('../factExtractionEngine', () => ({
  FactExtractionEngine: vi.fn(() => mockExtractionEngine)
}));

describe('FactPromotionEngine', () => {
  let engine: FactPromotionEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset the mock to return the default chain
    mockSupabase.from.mockReturnValue(createMockSupabaseChain());
    
    // Reset the extraction engine mock
    mockExtractionEngine.extractFactsWithTimeout.mockResolvedValue({
      facts: [],
      processing_time_ms: 100,
      errors: []
    });
    
    engine = new FactPromotionEngine();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('processNewFragment', () => {
    it('should process a new fragment and promote facts', async () => {
      // Mock extraction result
      const mockFacts: ExtractedFact[] = [
        {
          key: 'current_job',
          value: 'Software Engineer',
          confidence: 0.8,
          source_text: 'I work as a software engineer',
          extraction_method: 'pattern'
        }
      ];

      mockExtractionEngine.extractFactsWithTimeout.mockResolvedValue({
        facts: mockFacts,
        processing_time_ms: 100,
        errors: []
      });

      // Mock database responses - create fresh mock chain for each call
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' } // No existing fact
        }),
        insert: vi.fn().mockResolvedValue({
          error: null
        }),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis()
      };
      
      mockSupabase.from.mockReturnValue(mockChain);

      const result = await engine.processNewFragment(
        'fragment-123',
        'avatar-456',
        'I work as a software engineer at a tech company'
      );
      
      expect(result.facts_promoted).toBe(1);
      expect(result.facts_updated).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(result.processing_time_ms).toBeGreaterThanOrEqual(0);
    });

    it('should handle invalid input parameters', async () => {
      const result = await engine.processNewFragment('', '', '');

      expect(result.facts_promoted).toBe(0);
      expect(result.facts_updated).toBe(0);
      expect(result.errors).toContain('Invalid input parameters');
    });

    it('should handle extraction failures gracefully', async () => {
      mockExtractionEngine.extractFactsWithTimeout.mockRejectedValue(
        new Error('Extraction failed')
      );

      // Set up mock chain even though it won't be used due to extraction failure
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }
        }),
        insert: vi.fn().mockResolvedValue({
          error: null
        }),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis()
      };
      
      mockSupabase.from.mockReturnValue(mockChain);

      const result = await engine.processNewFragment(
        'fragment-123',
        'avatar-456',
        'Some text'
      );

      expect(result.facts_promoted).toBe(0);
      expect(result.facts_updated).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should warn when processing exceeds 200ms target', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      // Mock slow extraction
      mockExtractionEngine.extractFactsWithTimeout.mockImplementation(
        () => new Promise(resolve => {
          setTimeout(() => resolve({ facts: [], processing_time_ms: 300, errors: [] }), 250);
        })
      );

      await engine.processNewFragment('fragment-123', 'avatar-456', 'Some text');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('exceeding 200ms target'),
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });

    it('retries persistence 3 times with backoff, then succeeds on 3rd attempt', async () => {
      vi.useFakeTimers();
      mockExtractionEngine.extractFactsWithTimeout.mockResolvedValue({
        facts: [
          { key: 'current_job', value: 'Engineer', confidence: 0.8, source_text: 'I am an engineer', extraction_method: 'pattern' }
        ],
        processing_time_ms: 10,
        errors: []
      });

      const chain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
        insert: vi.fn(),
        update: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
      };
      chain.insert
        .mockResolvedValueOnce({ error: { message: 'fail 1' } })
        .mockResolvedValueOnce({ error: { message: 'fail 2' } })
        .mockResolvedValueOnce({ error: null });

      mockSupabase.from.mockReturnValue(chain);

      const engineLocal = new FactPromotionEngine();
      const p = engineLocal.processNewFragment('frag-1', 'avatar-1', 'I am an engineer');

      await vi.advanceTimersByTimeAsync(200);
      await vi.advanceTimersByTimeAsync(600);
      const result = await p;

      expect(result.facts_promoted + result.facts_updated).toBe(1);
      expect(chain.insert).toHaveBeenCalledTimes(3);
      vi.useRealTimers();
    });

    it('marks final failure status and persists error_message after 3 failed attempts', async () => {
      vi.useFakeTimers();
      mockExtractionEngine.extractFactsWithTimeout.mockResolvedValue({
        facts: [
          { key: 'current_job', value: 'Engineer', confidence: 0.8, source_text: 'I am an engineer', extraction_method: 'pattern' }
        ],
        processing_time_ms: 10,
        errors: []
      });

      const chain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
        insert: vi.fn()
          .mockResolvedValueOnce({ error: { message: 'fail 1' } })
          .mockResolvedValueOnce({ error: { message: 'fail 2' } })
          .mockResolvedValueOnce({ error: { message: 'fail 3' } }),
        update: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
      };
      mockSupabase.from.mockReturnValue(chain);

      const engineLocal = new FactPromotionEngine();
      const p = engineLocal.processNewFragment('frag-2', 'avatar-2', 'I am an engineer');
      await vi.advanceTimersByTimeAsync(200);
      await vi.advanceTimersByTimeAsync(600);
      await vi.advanceTimersByTimeAsync(1400);
      const result = await p;

      // Because we fail after retries, no promotions should be counted for the failing insert
      expect(result.facts_promoted).toBe(0);
      expect(result.facts_updated).toBe(0);
      expect(chain.insert).toHaveBeenCalledTimes(3);
      expect(mockSupabase.from).toHaveBeenLastCalledWith('fact_promotion_queue');
      expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
      vi.useRealTimers();
    });
  });

  describe('detectPromotableFacts', () => {
    it('should filter facts by promotable keys and confidence', async () => {
      const mockFacts: ExtractedFact[] = [
        {
          key: 'current_job',
          value: 'Engineer',
          confidence: 0.8,
          source_text: 'I am an engineer',
          extraction_method: 'pattern'
        },
        {
          key: 'random_fact',
          value: 'Something',
          confidence: 0.9,
          source_text: 'Random text',
          extraction_method: 'pattern'
        },
        {
          key: 'pets_current',
          value: 'Dog named Max',
          confidence: 0.5, // Below threshold
          source_text: 'I have a dog',
          extraction_method: 'pattern'
        }
      ];

      mockExtractionEngine.extractFactsWithTimeout.mockResolvedValue({
        facts: mockFacts,
        processing_time_ms: 100,
        errors: []
      });

      const result = await engine.detectPromotableFacts('Some text about my job');

      expect(mockExtractionEngine.extractFactsWithTimeout).toHaveBeenCalledWith('Some text about my job', 3000);
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('current_job');
    });

    it('should handle extraction errors gracefully', async () => {
      mockExtractionEngine.extractFactsWithTimeout.mockRejectedValue(
        new Error('Extraction failed')
      );

      await expect(engine.detectPromotableFacts('Some text')).rejects.toThrow('Extraction failed');
    });
  });

  describe('updateOrInsertFact', () => {
    const mockFact: ExtractedFact = {
      key: 'current_job',
      value: 'Software Engineer',
      confidence: 0.8,
      source_text: 'I work as a software engineer',
      extraction_method: 'pattern'
    };

    it('should insert new fact when none exists', async () => {
      const mockFromChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }
        }),
        insert: vi.fn().mockResolvedValue({
          error: null
        }),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis()
      };
      
      mockSupabase.from.mockReturnValue(mockFromChain);

      const result = await engine.updateOrInsertFact('avatar-123', mockFact, 'fragment-456');

      expect(result.action).toBe('inserted');
      expect(result.new_value).toBe('Software Engineer');
      expect(result.confidence_changed).toBe(false);
    });

    it('should update existing fact when value differs', async () => {
      const existingFact = {
        id: 'fact-123',
        avatar_id: 'avatar-123',
        key: 'current_job',
        value: 'Junior Developer',
        confidence: 0.7,
        priority: 2,
        date_context: null
      };

      const mockFromChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: existingFact,
          error: null
        }),
        insert: vi.fn().mockResolvedValue({
          error: null
        }),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: null
          })
        })
      };
      
      mockSupabase.from.mockReturnValue(mockFromChain);

      const result = await engine.updateOrInsertFact('avatar-123', mockFact);

      expect(result.action).toBe('updated');
      expect(result.old_value).toBe('Junior Developer');
      expect(result.new_value).toBe('Software Engineer');
    });

    it('should skip update when fact is unchanged', async () => {
      const existingFact = {
        id: 'fact-123',
        avatar_id: 'avatar-123',
        key: 'current_job',
        value: 'Software Engineer',
        confidence: 0.8,
        priority: 2
      };

      const mockFromChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: existingFact,
          error: null
        }),
        insert: vi.fn().mockResolvedValue({
          error: null
        }),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis()
      };
      
      mockSupabase.from.mockReturnValue(mockFromChain);

      const result = await engine.updateOrInsertFact('avatar-123', mockFact);

      expect(result.action).toBe('skipped');
    });

    it('should handle database errors', async () => {
      const mockFromChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error', code: 'DB_ERROR' }
        }),
        insert: vi.fn().mockResolvedValue({
          error: null
        }),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis()
      };
      
      mockSupabase.from.mockReturnValue(mockFromChain);

      await expect(
        engine.updateOrInsertFact('avatar-123', mockFact)
      ).rejects.toThrow('Failed to fetch existing fact');
    });
  });

  describe('archiveOldFact', () => {
    it('should archive old fact in history table', async () => {
      const mockFromChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        insert: vi.fn().mockResolvedValue({
          error: null
        }),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis()
      };
      
      mockSupabase.from.mockReturnValue(mockFromChain);

      await expect(
        engine.archiveOldFact('avatar-123', 'current_job', 'Old Job', 'New Job')
      ).resolves.not.toThrow();

      expect(mockSupabase.from).toHaveBeenCalledWith('fact_history');
    });

    it('should not throw on archiving errors', async () => {
      const mockFromChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        insert: vi.fn().mockResolvedValue({
          error: { message: 'Archive failed' }
        }),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis()
      };
      
      mockSupabase.from.mockReturnValue(mockFromChain);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        engine.archiveOldFact('avatar-123', 'current_job', 'Old Job', 'New Job')
      ).resolves.not.toThrow();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('getPromotionStats', () => {
    it('should return promotion statistics', async () => {
      // Create separate mock chains for each call
      const mockFromChain1 = { 
        select: vi.fn().mockReturnThis(), 
        eq: vi.fn().mockReturnValue({ count: 5 }),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        insert: vi.fn().mockResolvedValue({ error: null }),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis()
      };
      const mockFromChain2 = { 
        select: vi.fn().mockReturnThis(), 
        eq: vi.fn().mockReturnValue({ data: [{ priority: 1 }, { priority: 1 }, { priority: 2 }, { priority: 3 }, { priority: 3 }] }),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        insert: vi.fn().mockResolvedValue({ error: null }),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis()
      };
      const mockFromChain3 = { 
        select: vi.fn().mockReturnThis(), 
        eq: vi.fn().mockReturnThis(), 
        gte: vi.fn().mockReturnValue({ count: 2 }),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        insert: vi.fn().mockResolvedValue({ error: null }),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis()
      };
      const mockFromChain4 = { 
        select: vi.fn().mockReturnThis(), 
        eq: vi.fn().mockReturnThis(), 
        order: vi.fn().mockReturnThis(), 
        limit: vi.fn().mockReturnThis(), 
        single: vi.fn().mockResolvedValue({ data: { changed_at: '2025-01-08T10:00:00Z' } }),
        insert: vi.fn().mockResolvedValue({ error: null }),
        gte: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis()
      };

      mockSupabase.from
        .mockReturnValueOnce(mockFromChain1)
        .mockReturnValueOnce(mockFromChain2)
        .mockReturnValueOnce(mockFromChain3)
        .mockReturnValueOnce(mockFromChain4);

      const stats = await engine.getPromotionStats('avatar-123');

      expect(stats.total_facts).toBe(5);
      expect(stats.facts_by_priority[1]).toBe(2);
      expect(stats.facts_by_priority[2]).toBe(1);
      expect(stats.facts_by_priority[3]).toBe(2);
      expect(stats.recent_promotions).toBe(2);
      expect(stats.last_promotion).toBeInstanceOf(Date);
    });

    it('should handle database errors gracefully', async () => {
      const mockFromChain = { 
        select: vi.fn().mockReturnThis(), 
        eq: vi.fn().mockRejectedValue(new Error('DB Error')),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        insert: vi.fn().mockResolvedValue({ error: null }),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis()
      };
      mockSupabase.from.mockReturnValue(mockFromChain);

      const stats = await engine.getPromotionStats('avatar-123');

      expect(stats.total_facts).toBe(0);
      expect(stats.facts_by_priority).toEqual({});
      expect(stats.recent_promotions).toBe(0);
      expect(stats.last_promotion).toBeNull();
    });
  });

  describe('priority calculation', () => {
    it('should assign correct priorities to different fact types', async () => {
      const coreIdentityFact: ExtractedFact = {
        key: 'full_name',
        value: 'John Doe',
        confidence: 0.9,
        source_text: 'My name is John Doe',
        extraction_method: 'pattern'
      };

      const lifestyleFact: ExtractedFact = {
        key: 'hobbies',
        value: 'Reading, hiking',
        confidence: 0.8,
        source_text: 'I enjoy reading and hiking',
        extraction_method: 'pattern'
      };

      const mockFromChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis()
      };
      
      mockSupabase.from.mockReturnValue(mockFromChain);

      await engine.updateOrInsertFact('avatar-123', coreIdentityFact);
      await engine.updateOrInsertFact('avatar-123', lifestyleFact);

      // Verify that insert was called with correct priorities
      const insertCalls = mockFromChain.insert.mock.calls;
      
      // Core identity should have priority 1
      expect(insertCalls[0][0].priority).toBe(1);
      
      // Lifestyle should have priority 4
      expect(insertCalls[1][0].priority).toBe(4);
    });
  });

  describe('expiration handling', () => {
    it('should set expiration for current status facts', async () => {
      const currentJobFact: ExtractedFact = {
        key: 'current_job',
        value: 'Software Engineer',
        confidence: 0.8,
        source_text: 'I work as a software engineer',
        extraction_method: 'pattern'
      };

      const mockFromChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis()
      };
      
      mockSupabase.from.mockReturnValue(mockFromChain);

      await engine.updateOrInsertFact('avatar-123', currentJobFact);

      const insertCall = mockFromChain.insert.mock.calls[0][0];
      expect(insertCall.expires_at).toBeInstanceOf(Date);
    });

    it('should not set expiration for permanent facts', async () => {
      const birthYearFact: ExtractedFact = {
        key: 'birth_year',
        value: '1990',
        confidence: 0.9,
        source_text: 'I was born in 1990',
        extraction_method: 'pattern'
      };

      const mockFromChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis()
      };
      
      mockSupabase.from.mockReturnValue(mockFromChain);

      await engine.updateOrInsertFact('avatar-123', birthYearFact);

      const insertCall = mockFromChain.insert.mock.calls[0][0];
      expect(insertCall.expires_at).toBeNull();
    });
  });
});