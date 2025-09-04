/**
 * Fact Promotion Service
 * 
 * High-level service for managing fact promotion system including
 * background processing, monitoring, and manual operations.
 * 
 * Requirements: 9.1, 9.7 - Service management and monitoring
 */

import { FactPromotionProcessor, ProcessorConfig } from './factPromotionProcessor';
import { FactPromotionEngine } from './factPromotionEngine';

export class FactPromotionService {
  private static instance: FactPromotionService | null = null;
  private processor: FactPromotionProcessor | null = null;
  private engine: FactPromotionEngine;

  private constructor() {
    this.engine = new FactPromotionEngine();
  }

  /**
   * Get singleton instance of the service
   */
  static getInstance(): FactPromotionService {
    if (!FactPromotionService.instance) {
      FactPromotionService.instance = new FactPromotionService();
    }
    return FactPromotionService.instance;
  }

  /**
   * Start the background fact promotion processor
   */
  startProcessor(config?: Partial<ProcessorConfig>): void {
    if (this.processor?.getHealthStatus().isRunning) {
      console.warn('Fact promotion processor is already running');
      return;
    }

    this.processor = new FactPromotionProcessor(config);
    this.processor.start();
    
    console.log('Fact promotion service started');
  }

  /**
   * Stop the background processor
   */
  async stopProcessor(): Promise<void> {
    if (!this.processor) {
      return;
    }

    await this.processor.stop();
    console.log('Fact promotion service stopped');
  }

  /**
   * Get processor health and statistics
   */
  async getStatus(): Promise<{
    processor: {
      isRunning: boolean;
      activeJobs: number;
      successRate: number;
      avgProcessingTime: number;
      isHealthy: boolean;
      stats: any;
    };
    queue: {
      pending_jobs: number;
      processing_jobs: number;
      completed_jobs: number;
      failed_jobs: number;
      avg_processing_time_ms: number;
      oldest_pending_job: Date | null;
    };
  }> {
    const processorHealth = this.processor?.getHealthStatus() || {
      isRunning: false,
      activeJobs: 0,
      successRate: 0,
      avgProcessingTime: 0,
      isHealthy: false
    };

    const processorStats = this.processor?.getStats() || {
      jobs_processed: 0,
      jobs_succeeded: 0,
      jobs_failed: 0,
      average_processing_time_ms: 0,
      total_facts_promoted: 0,
      total_facts_updated: 0,
      last_processed_at: null
    };

    const queueStats = await this.processor?.getQueueStats() || {
      pending_jobs: 0,
      processing_jobs: 0,
      completed_jobs: 0,
      failed_jobs: 0,
      avg_processing_time_ms: 0,
      oldest_pending_job: null
    };

    return {
      processor: {
        ...processorHealth,
        stats: processorStats
      },
      queue: queueStats
    };
  }

  /**
   * Process a specific memory fragment immediately (bypass queue)
   */
  async processFragmentImmediately(
    fragmentId: string,
    avatarId: string,
    text: string
  ): Promise<any> {
    try {
      const result = await this.engine.processNewFragment(fragmentId, avatarId, text);
      
      console.log('Immediate fact promotion completed', {
        fragmentId,
        avatarId,
        factsPromoted: result.facts_promoted,
        factsUpdated: result.facts_updated,
        processingTime: result.processing_time_ms
      });

      return result;
    } catch (error) {
      console.error('Immediate fact promotion failed:', error);
      throw error;
    }
  }

  /**
   * Clean up old completed jobs
   */
  async cleanupOldJobs(olderThanDays: number = 7): Promise<number> {
    if (!this.processor) {
      throw new Error('Processor not initialized');
    }

    return await this.processor.cleanupOldJobs(olderThanDays);
  }

  /**
   * Reset processor statistics
   */
  resetStats(): void {
    this.processor?.resetStats();
  }

  /**
   * Check if the service is healthy and ready to process jobs
   */
  isHealthy(): boolean {
    return this.processor?.getHealthStatus().isHealthy || false;
  }

  /**
   * Get promotion statistics for a specific avatar
   */
  async getAvatarPromotionStats(avatarId: string): Promise<any> {
    return await this.engine.getPromotionStats(avatarId);
  }

  /**
   * Get detailed performance metrics
   */
  getPerformanceMetrics(): any {
    if (!this.processor) {
      return {
        processingStats: null,
        performanceIndicators: null,
        systemHealth: {
          isRunning: false,
          activeJobs: 0,
          maxConcurrentJobs: 0,
          utilizationRate: 0
        }
      };
    }

    return this.processor.getPerformanceMetrics();
  }

  /**
   * Get queue backlog information
   */
  async getQueueBacklog(): Promise<{
    pendingJobs: number;
    oldestPendingJob: Date | null;
    estimatedProcessingTime: number;
    isBacklogged: boolean;
  }> {
    if (!this.processor) {
      return {
        pendingJobs: 0,
        oldestPendingJob: null,
        estimatedProcessingTime: 0,
        isBacklogged: false
      };
    }

    const queueStats = await this.processor.getQueueStats();
    const performanceMetrics = this.processor.getPerformanceMetrics();
    
    const estimatedProcessingTime = queueStats.pending_jobs > 0 
      ? (queueStats.pending_jobs * performanceMetrics.performanceIndicators.averageProcessingTime) / 1000
      : 0;

    const isBacklogged = queueStats.pending_jobs > 50 || // More than 50 pending jobs
      (queueStats.oldest_pending_job && 
       Date.now() - queueStats.oldest_pending_job.getTime() > 300000); // Oldest job > 5 minutes

    return {
      pendingJobs: queueStats.pending_jobs,
      oldestPendingJob: queueStats.oldest_pending_job,
      estimatedProcessingTime,
      isBacklogged
    };
  }
}

// Export singleton instance for easy access
export const factPromotionService = FactPromotionService.getInstance();