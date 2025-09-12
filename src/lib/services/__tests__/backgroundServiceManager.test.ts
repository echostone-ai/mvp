/**
 * Unit tests for BackgroundServiceManager
 * 
 * Tests service initialization, health monitoring, and graceful shutdown
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock the fact promotion service
const mockFactPromotionService = {
  startProcessor: vi.fn(),
  stopProcessor: vi.fn(),
  isHealthy: vi.fn().mockReturnValue(true),
  getStatus: vi.fn().mockResolvedValue({
    processor: {
      isRunning: true,
      activeJobs: 0,
      successRate: 100,
      avgProcessingTime: 150,
      isHealthy: true,
      stats: {
        jobs_processed: 10,
        jobs_succeeded: 10,
        jobs_failed: 0
      }
    },
    queue: {
      pending_jobs: 0,
      processing_jobs: 0,
      completed_jobs: 10,
      failed_jobs: 0
    }
  })
};

// Mock the service
vi.mock('../factPromotionService', () => ({
  factPromotionService: mockFactPromotionService
}));

describe('BackgroundServiceManager', () => {
  let BackgroundServiceManager: any;
  let manager: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Import after mocks are set up
    const module = await import('../backgroundServiceManager');
    BackgroundServiceManager = module.BackgroundServiceManager;
    
    // Create a fresh instance for each test
    manager = new BackgroundServiceManager();
  });

  afterEach(async () => {
    if (manager) {
      await manager.shutdown();
    }
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize services with default config', async () => {
      await manager.initialize();

      expect(mockFactPromotionService.startProcessor).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
          batchSize: 10,
          processingIntervalMs: 1000,
          maxConcurrentJobs: 5
        })
      );

      expect(manager.isReady()).toBe(true);
    });

    it('should initialize services with custom config', async () => {
      const customConfig = {
        factPromotion: {
          enabled: true,
          batchSize: 5,
          processingIntervalMs: 2000,
          maxConcurrentJobs: 3,
          enableRetries: false,
          maxRetryAttempts: 2,
          processingTimeoutMs: 3000
        }
      };

      await manager.initialize(customConfig);

      expect(mockFactPromotionService.startProcessor).toHaveBeenCalledWith(
        customConfig.factPromotion
      );
    });

    it('should not initialize if already initialized', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await manager.initialize();
      await manager.initialize(); // Second call should warn

      expect(consoleSpy).toHaveBeenCalledWith('Background services already initialized');
      expect(mockFactPromotionService.startProcessor).toHaveBeenCalledTimes(1);

      consoleSpy.mockRestore();
    });

    it('should skip fact promotion if disabled', async () => {
      await manager.initialize({
        factPromotion: {
          enabled: false,
          batchSize: 10,
          processingIntervalMs: 1000,
          maxConcurrentJobs: 5,
          enableRetries: true,
          maxRetryAttempts: 3,
          processingTimeoutMs: 5000
        }
      });

      expect(mockFactPromotionService.startProcessor).not.toHaveBeenCalled();
      expect(manager.isReady()).toBe(true);
    });
  });

  describe('health monitoring', () => {
    it('should return health status', async () => {
      await manager.initialize();

      const health = await manager.getHealthStatus();

      expect(health).toEqual({
        initialized: true,
        services: {
          factPromotion: {
            enabled: true,
            healthy: true,
            status: expect.any(Object)
          }
        }
      });
    });

    it('should return health status when not initialized', async () => {
      const health = await manager.getHealthStatus();

      expect(health.initialized).toBe(false);
      expect(health.services.factPromotion.enabled).toBe(true);
      expect(health.services.factPromotion.status).toBeNull();
    });
  });

  describe('shutdown', () => {
    it('should gracefully shutdown services', async () => {
      await manager.initialize();
      expect(manager.isReady()).toBe(true);

      await manager.shutdown();

      expect(mockFactPromotionService.stopProcessor).toHaveBeenCalled();
      expect(manager.isReady()).toBe(false);
    });

    it('should handle shutdown when not initialized', async () => {
      await manager.shutdown(); // Should not throw
      expect(mockFactPromotionService.stopProcessor).not.toHaveBeenCalled();
    });
  });

  describe('configuration management', () => {
    it('should update configuration', () => {
      const newConfig = {
        factPromotion: {
          enabled: false,
          batchSize: 20,
          processingIntervalMs: 500,
          maxConcurrentJobs: 10,
          enableRetries: false,
          maxRetryAttempts: 1,
          processingTimeoutMs: 2000
        }
      };

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      manager.updateConfig(newConfig);

      const config = manager.getConfig();
      expect(config.factPromotion.batchSize).toBe(20);
      expect(config.factPromotion.enabled).toBe(false);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Service configuration updated. Restart required for changes to take effect.'
      );

      consoleSpy.mockRestore();
    });

    it('should return current configuration', () => {
      const config = manager.getConfig();

      expect(config).toHaveProperty('factPromotion');
      expect(config.factPromotion).toHaveProperty('enabled');
      expect(config.factPromotion).toHaveProperty('batchSize');
      expect(config.factPromotion).toHaveProperty('processingIntervalMs');
    });
  });

  describe('error handling', () => {
    it('should handle initialization errors', async () => {
      mockFactPromotionService.startProcessor.mockImplementation(() => {
        throw new Error('Service startup failed');
      });

      await expect(manager.initialize()).rejects.toThrow('Service startup failed');
      expect(manager.isReady()).toBe(false);
    });

    it('should handle service health check failures', async () => {
      mockFactPromotionService.isHealthy.mockReturnValue(false);

      await manager.initialize();

      const health = await manager.getHealthStatus();
      expect(health.services.factPromotion.healthy).toBe(false);
    });
  });

  describe('environment configuration', () => {
    it('should use environment variables for default config', () => {
      // Mock environment variables
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        FACT_PROMOTION_ENABLED: 'true',
        FACT_PROMOTION_BATCH_SIZE: '15',
        FACT_PROMOTION_INTERVAL_MS: '2000',
        FACT_PROMOTION_MAX_CONCURRENT: '8'
      };

      // Create new manager to pick up env vars
      const envManager = new BackgroundServiceManager();
      const config = envManager.getConfig();

      expect(config.factPromotion.enabled).toBe(true);
      expect(config.factPromotion.batchSize).toBe(15);
      expect(config.factPromotion.processingIntervalMs).toBe(2000);
      expect(config.factPromotion.maxConcurrentJobs).toBe(8);

      // Restore environment
      process.env = originalEnv;
    });
  });
});