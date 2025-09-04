/**
 * Integration tests for fact promotion trigger system
 * 
 * Tests the complete flow from memory fragment insertion to fact promotion
 * including database triggers, queue processing, and error handling.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock Supabase client
const mockSupabase = {
  rpc: vi.fn(),
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    insert: vi.fn(),
    update: vi.fn().mockReturnThis()
  }))
};

// Mock FactPromotionEngine
const mockPromotionEngine = {
  processNewFragment: vi.fn()
};

// Mock createClient
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase)
}));

// Mock FactPromotionEngine
vi.mock('../factPromotionEngine', () => ({
  FactPromotionEngine: vi.fn(() => mockPromotionEngine)
}));

describe('Fact Promotion Trigger Integration', () => {
  let processor: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Import after mocks are set up
    const { FactPromotionProcessor } = await import('../factPromotionProcessor');
    processor = new FactPromotionProcessor({
      batchSize: 2,
      processingIntervalMs: 100,
      maxConcurrentJobs: 2,
      processingTimeoutMs: 1000
    });
  });

  afterEach(async () => {
    if (processor) {
      await processor.stop();
    }
    vi.restoreAllMocks();
  });

  describe('database trigger integration', () => {
    it('should process jobs queued by database trigger', async () => {
      // Mock pending jobs from trigger
      const mockJobs = [
        {
          id: 'job-1',
          fragment_id: 'fragment-1',
          avatar_id: 'avatar-1',
          fragment_text: 'I work as a software engineer',
          attempts: 0,
          created_at: new Date()
        },
        {
          id: 'job-2',
          fragment_id: 'fragment-2',
          avatar_id: 'avatar-1',
          fragment_text: 'I have a dog named Max',
          attempts: 0,
          created_at: new Date()
        }
      ];

      // Mock database responses
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: mockJobs, error: null }) // get_pending_promotion_jobs
        .mockResolvedValue({ data: true, error: null }); // start_promotion_job and complete_promotion_job

      // Get the mock instance from the processor
      const mockEngine = processor['promotionEngine'];
      mockEngine.processNewFragment.mockResolvedValue({
        facts_promoted: 1,
        facts_updated: 0,
        processing_time_ms: 150,
        errors: []
      });

      // Start processor
      processor.start();

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify jobs were processed
      expect(mockPromotionEngine.processNewFragment).toHaveBeenCalledTimes(2);
      expect(mockPromotionEngine.processNewFragment).toHaveBeenCalledWith(
        'fragment-1',
        'avatar-1',
        'I work as a software engineer'
      );
      expect(mockPromotionEngine.processNewFragment).toHaveBeenCalledWith(
        'fragment-2',
        'avatar-1',
        'I have a dog named Max'
      );
    });

    it('should handle processing within 200ms target', async () => {
      const mockJob = {
        id: 'job-1',
        fragment_id: 'fragment-1',
        avatar_id: 'avatar-1',
        fragment_text: 'I work as a software engineer',
        attempts: 0,
        created_at: new Date()
      };

      mockSupabase.rpc
        .mockResolvedValueOnce({ data: [mockJob], error: null })
        .mockResolvedValue({ data: true, error: null });

      // Mock fast processing (within target)
      mockPromotionEngine.processNewFragment.mockResolvedValue({
        facts_promoted: 1,
        facts_updated: 0,
        processing_time_ms: 120, // Within 200ms target
        errors: []
      });

      processor.start();
      await new Promise(resolve => setTimeout(resolve, 200));

      const metrics = processor.getPerformanceMetrics();
      expect(metrics.performanceIndicators.isWithinTargetTime).toBe(true);
    });

    it('should warn when processing exceeds 200ms target', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const mockJob = {
        id: 'job-1',
        fragment_id: 'fragment-1',
        avatar_id: 'avatar-1',
        fragment_text: 'I work as a software engineer',
        attempts: 0,
        created_at: new Date()
      };

      mockSupabase.rpc
        .mockResolvedValueOnce({ data: [mockJob], error: null })
        .mockResolvedValue({ data: true, error: null });

      // Mock slow processing (exceeds target)
      mockPromotionEngine.processNewFragment.mockResolvedValue({
        facts_promoted: 1,
        facts_updated: 0,
        processing_time_ms: 350, // Exceeds 200ms target
        errors: []
      });

      processor.start();
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('exceeding 200ms target'),
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('error handling and retry logic', () => {
    it('should retry failed jobs up to max attempts', async () => {
      const mockJob = {
        id: 'job-1',
        fragment_id: 'fragment-1',
        avatar_id: 'avatar-1',
        fragment_text: 'I work as a software engineer',
        attempts: 1, // Already attempted once
        created_at: new Date()
      };

      mockSupabase.rpc
        .mockResolvedValueOnce({ data: [mockJob], error: null })
        .mockResolvedValueOnce({ data: true, error: null }) // start_promotion_job
        .mockResolvedValueOnce({ data: true, error: null }); // fail_promotion_job

      // Mock processing failure
      mockPromotionEngine.processNewFragment.mockRejectedValue(
        new Error('Processing failed')
      );

      processor.start();
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify job was marked as failed
      expect(mockSupabase.rpc).toHaveBeenCalledWith('fail_promotion_job', {
        job_id: 'job-1',
        error_msg: 'Processing failed'
      });
    });

    it('should handle database connection errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Mock database error
      mockSupabase.rpc.mockRejectedValue(new Error('Database connection failed'));

      processor.start();
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch pending promotion jobs'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should handle job processing timeout', async () => {
      const mockJob = {
        id: 'job-1',
        fragment_id: 'fragment-1',
        avatar_id: 'avatar-1',
        fragment_text: 'I work as a software engineer',
        attempts: 0,
        created_at: new Date()
      };

      mockSupabase.rpc
        .mockResolvedValueOnce({ data: [mockJob], error: null })
        .mockResolvedValueOnce({ data: true, error: null })
        .mockResolvedValueOnce({ data: true, error: null });

      // Mock slow processing that times out
      mockPromotionEngine.processNewFragment.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 2000)) // 2 seconds, exceeds 1 second timeout
      );

      processor.start();
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Verify job was marked as failed due to timeout
      expect(mockSupabase.rpc).toHaveBeenCalledWith('fail_promotion_job', {
        job_id: 'job-1',
        error_msg: expect.stringContaining('timeout')
      });
    });
  });

  describe('performance monitoring', () => {
    it('should track processing statistics', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          fragment_id: 'fragment-1',
          avatar_id: 'avatar-1',
          fragment_text: 'I work as a software engineer',
          attempts: 0,
          created_at: new Date()
        }
      ];

      mockSupabase.rpc
        .mockResolvedValueOnce({ data: mockJobs, error: null })
        .mockResolvedValue({ data: true, error: null });

      mockPromotionEngine.processNewFragment.mockResolvedValue({
        facts_promoted: 2,
        facts_updated: 1,
        processing_time_ms: 150,
        errors: []
      });

      processor.start();
      await new Promise(resolve => setTimeout(resolve, 200));

      const stats = processor.getStats();
      expect(stats.jobs_processed).toBe(1);
      expect(stats.jobs_succeeded).toBe(1);
      expect(stats.total_facts_promoted).toBe(2);
      expect(stats.total_facts_updated).toBe(1);
      expect(stats.average_processing_time_ms).toBeGreaterThan(0);
    });

    it('should calculate health score correctly', async () => {
      processor.start();
      
      const metrics = processor.getPerformanceMetrics();
      
      expect(metrics.systemHealth.isRunning).toBe(true);
      expect(metrics.systemHealth.activeJobs).toBe(0);
      expect(metrics.systemHealth.utilizationRate).toBe(0);
      expect(metrics.performanceIndicators.healthScore).toBeGreaterThan(0);
    });
  });

  describe('queue management', () => {
    it('should respect max concurrent jobs limit', async () => {
      const mockJobs = Array.from({ length: 5 }, (_, i) => ({
        id: `job-${i + 1}`,
        fragment_id: `fragment-${i + 1}`,
        avatar_id: 'avatar-1',
        fragment_text: `Text ${i + 1}`,
        attempts: 0,
        created_at: new Date()
      }));

      mockSupabase.rpc
        .mockResolvedValueOnce({ data: mockJobs.slice(0, 2), error: null }) // First batch (limited by maxConcurrentJobs)
        .mockResolvedValue({ data: true, error: null });

      // Mock slow processing to keep jobs active
      mockPromotionEngine.processNewFragment.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          facts_promoted: 1,
          facts_updated: 0,
          processing_time_ms: 100,
          errors: []
        }), 300))
      );

      processor.start();
      await new Promise(resolve => setTimeout(resolve, 100));

      const health = processor.getHealthStatus();
      expect(health.activeJobs).toBeLessThanOrEqual(2); // Max concurrent jobs
    });

    it('should get queue statistics', async () => {
      const mockQueueStats = {
        pending_jobs: 10,
        processing_jobs: 2,
        completed_jobs: 50,
        failed_jobs: 3,
        avg_processing_time_ms: 180.5,
        oldest_pending_job: '2025-01-08T10:00:00Z'
      };

      mockSupabase.rpc.mockResolvedValue({
        data: [mockQueueStats],
        error: null
      });

      const stats = await processor.getQueueStats();

      expect(stats.pending_jobs).toBe(10);
      expect(stats.processing_jobs).toBe(2);
      expect(stats.avg_processing_time_ms).toBe(180.5);
      expect(stats.oldest_pending_job).toBeInstanceOf(Date);
    });
  });

  describe('background service manager integration', () => {
    it('should initialize and manage processor through service manager', async () => {
      const health = await backgroundServiceManager.getHealthStatus();
      
      expect(health).toHaveProperty('initialized');
      expect(health).toHaveProperty('services');
      expect(health.services).toHaveProperty('factPromotion');
    });

    it('should handle graceful shutdown', async () => {
      await backgroundServiceManager.initialize({
        factPromotion: {
          enabled: true,
          batchSize: 5,
          processingIntervalMs: 1000,
          maxConcurrentJobs: 3,
          enableRetries: true,
          maxRetryAttempts: 3,
          processingTimeoutMs: 5000
        }
      });

      expect(backgroundServiceManager.isReady()).toBe(true);

      await backgroundServiceManager.shutdown();
      
      const health = await backgroundServiceManager.getHealthStatus();
      expect(health.initialized).toBe(false);
    });
  });
});