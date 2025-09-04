/**
 * Fact Promotion Background Processor
 * 
 * Processes queued fact promotion jobs from the database trigger system.
 * Handles retry logic, error recovery, and performance monitoring.
 * 
 * Requirements: 9.1, 9.7 - Background job processing within 200ms target
 */

import { FactPromotionEngine, PromotionResult } from './factPromotionEngine';
import { createClient } from '@supabase/supabase-js';

export interface PromotionJob {
  id: string;
  fragment_id: string;
  avatar_id: string;
  fragment_text: string;
  attempts: number;
  created_at: Date;
}

export interface ProcessorStats {
  jobs_processed: number;
  jobs_succeeded: number;
  jobs_failed: number;
  average_processing_time_ms: number;
  total_facts_promoted: number;
  total_facts_updated: number;
  last_processed_at: Date | null;
}

export interface ProcessorConfig {
  batchSize: number;
  processingIntervalMs: number;
  maxConcurrentJobs: number;
  enableRetries: boolean;
  maxRetryAttempts: number;
  processingTimeoutMs: number;
}

export class FactPromotionProcessor {
  private promotionEngine: FactPromotionEngine;
  private supabase: ReturnType<typeof createClient>;
  private config: ProcessorConfig;
  private stats: ProcessorStats;
  private isRunning: boolean = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private activeJobs: Set<string> = new Set();

  constructor(config?: Partial<ProcessorConfig>) {
    this.promotionEngine = new FactPromotionEngine();
    
    // Initialize Supabase client with service role
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    this.config = {
      batchSize: 10,
      processingIntervalMs: 1000, // Check for jobs every second
      maxConcurrentJobs: 5,
      enableRetries: true,
      maxRetryAttempts: 3,
      processingTimeoutMs: 5000, // 5 seconds max per job
      ...config
    };

    this.stats = {
      jobs_processed: 0,
      jobs_succeeded: 0,
      jobs_failed: 0,
      average_processing_time_ms: 0,
      total_facts_promoted: 0,
      total_facts_updated: 0,
      last_processed_at: null
    };
  }

  /**
   * Start the background processor
   */
  start(): void {
    if (this.isRunning) {
      console.warn('Fact promotion processor is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting fact promotion processor', {
      batchSize: this.config.batchSize,
      intervalMs: this.config.processingIntervalMs,
      maxConcurrent: this.config.maxConcurrentJobs
    });

    this.processingInterval = setInterval(
      () => this.processJobs(),
      this.config.processingIntervalMs
    );
  }

  /**
   * Stop the background processor
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('Stopping fact promotion processor...');
    this.isRunning = false;

    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    // Wait for active jobs to complete
    while (this.activeJobs.size > 0) {
      console.log(`Waiting for ${this.activeJobs.size} active jobs to complete...`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('Fact promotion processor stopped');
  }

  /**
   * Process a batch of pending promotion jobs
   */
  private async processJobs(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Don't fetch new jobs if we're at max concurrent capacity
      if (this.activeJobs.size >= this.config.maxConcurrentJobs) {
        return;
      }

      const availableSlots = this.config.maxConcurrentJobs - this.activeJobs.size;
      const batchSize = Math.min(this.config.batchSize, availableSlots);

      // Get pending jobs from the database
      const { data: jobs, error } = await this.supabase
        .rpc('get_pending_promotion_jobs', { batch_size: batchSize });

      if (error) {
        console.error('Failed to fetch pending promotion jobs:', error);
        this.logProcessingError('fetch_jobs_failed', error.message);
        return;
      }

      if (!jobs || jobs.length === 0) {
        return; // No jobs to process
      }

      console.log(`Processing ${jobs.length} fact promotion jobs`);

      // Process each job concurrently
      const jobPromises = jobs.map((job: PromotionJob) => this.processJob(job));
      const results = await Promise.allSettled(jobPromises);

      // Log any job failures for monitoring
      const failures = results.filter(result => result.status === 'rejected');
      if (failures.length > 0) {
        console.warn(`${failures.length} out of ${jobs.length} jobs failed processing`);
        failures.forEach((failure, index) => {
          if (failure.status === 'rejected') {
            this.logProcessingError('job_processing_failed', failure.reason?.message || 'Unknown error', jobs[index]?.id);
          }
        });
      }

    } catch (error) {
      console.error('Error in job processing loop:', error);
      this.logProcessingError('processing_loop_failed', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Process a single promotion job
   */
  private async processJob(job: PromotionJob): Promise<void> {
    const jobId = job.id;
    this.activeJobs.add(jobId);

    try {
      // Mark job as processing
      const { data: started } = await this.supabase
        .rpc('start_promotion_job', { job_id: jobId });

      if (!started) {
        console.warn(`Failed to start job ${jobId} - may have been claimed by another processor`);
        return;
      }

      const startTime = Date.now();

      // Process the job with timeout
      const promotionResult = await Promise.race([
        this.promotionEngine.processNewFragment(
          job.fragment_id,
          job.avatar_id,
          job.fragment_text
        ),
        this.createTimeoutPromise(this.config.processingTimeoutMs)
      ]);

      const processingTime = Date.now() - startTime;

      // Check if processing exceeded target time
      if (processingTime > 200) {
        console.warn(`Job ${jobId} took ${processingTime}ms, exceeding 200ms target`, {
          fragmentId: job.fragment_id,
          avatarId: job.avatar_id,
          factsPromoted: promotionResult.facts_promoted,
          factsUpdated: promotionResult.facts_updated
        });
      }

      // Handle promotion errors
      if (promotionResult.errors.length > 0) {
        const errorMessage = promotionResult.errors.join('; ');
        console.error(`Job ${jobId} completed with errors:`, errorMessage);
        
        // Mark as failed if there were critical errors
        if (promotionResult.facts_promoted === 0 && promotionResult.facts_updated === 0) {
          await this.supabase.rpc('fail_promotion_job', {
            job_id: jobId,
            error_msg: errorMessage
          });
          
          this.updateStats(false, processingTime, 0, 0);
          return;
        }
      }

      // Mark job as completed
      await this.supabase.rpc('complete_promotion_job', {
        job_id: jobId,
        processing_time_ms: processingTime
      });

      this.updateStats(
        true,
        processingTime,
        promotionResult.facts_promoted,
        promotionResult.facts_updated
      );

      console.log(`Job ${jobId} completed successfully`, {
        processingTime: `${processingTime}ms`,
        factsPromoted: promotionResult.facts_promoted,
        factsUpdated: promotionResult.facts_updated
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Job ${jobId} failed:`, errorMessage);

      // Mark job as failed
      await this.supabase.rpc('fail_promotion_job', {
        job_id: jobId,
        error_msg: errorMessage
      });

      this.updateStats(false, Date.now() - Date.now(), 0, 0);

    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  /**
   * Create a timeout promise for job processing
   */
  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Job processing timeout after ${timeoutMs}ms`)), timeoutMs);
    });
  }

  /**
   * Update processor statistics
   */
  private updateStats(
    success: boolean,
    processingTime: number,
    factsPromoted: number,
    factsUpdated: number
  ): void {
    this.stats.jobs_processed++;
    
    if (success) {
      this.stats.jobs_succeeded++;
    } else {
      this.stats.jobs_failed++;
    }

    // Update running average for processing time
    const totalTime = this.stats.average_processing_time_ms * (this.stats.jobs_processed - 1) + processingTime;
    this.stats.average_processing_time_ms = totalTime / this.stats.jobs_processed;

    this.stats.total_facts_promoted += factsPromoted;
    this.stats.total_facts_updated += factsUpdated;
    this.stats.last_processed_at = new Date();
  }

  /**
   * Get current processor statistics
   */
  getStats(): ProcessorStats {
    return { ...this.stats };
  }

  /**
   * Get queue statistics from database
   */
  async getQueueStats(): Promise<{
    pending_jobs: number;
    processing_jobs: number;
    completed_jobs: number;
    failed_jobs: number;
    avg_processing_time_ms: number;
    oldest_pending_job: Date | null;
  }> {
    try {
      const { data, error } = await this.supabase.rpc('get_promotion_queue_stats');

      if (error) {
        throw new Error(`Failed to get queue stats: ${error.message}`);
      }

      const stats = data[0];
      return {
        pending_jobs: stats.pending_jobs || 0,
        processing_jobs: stats.processing_jobs || 0,
        completed_jobs: stats.completed_jobs || 0,
        failed_jobs: stats.failed_jobs || 0,
        avg_processing_time_ms: parseFloat(stats.avg_processing_time_ms) || 0,
        oldest_pending_job: stats.oldest_pending_job ? new Date(stats.oldest_pending_job) : null
      };

    } catch (error) {
      console.error('Failed to get queue statistics:', error);
      return {
        pending_jobs: 0,
        processing_jobs: 0,
        completed_jobs: 0,
        failed_jobs: 0,
        avg_processing_time_ms: 0,
        oldest_pending_job: null
      };
    }
  }

  /**
   * Clean up old completed jobs
   */
  async cleanupOldJobs(olderThanDays: number = 7): Promise<number> {
    try {
      const { data: deletedCount } = await this.supabase
        .rpc('cleanup_promotion_jobs', { older_than_days: olderThanDays });

      console.log(`Cleaned up ${deletedCount} old promotion jobs`);
      return deletedCount || 0;

    } catch (error) {
      console.error('Failed to cleanup old jobs:', error);
      return 0;
    }
  }

  /**
   * Get processor health status
   */
  getHealthStatus(): {
    isRunning: boolean;
    activeJobs: number;
    successRate: number;
    avgProcessingTime: number;
    isHealthy: boolean;
  } {
    const successRate = this.stats.jobs_processed > 0 
      ? (this.stats.jobs_succeeded / this.stats.jobs_processed) * 100 
      : 0;

    const isHealthy = this.isRunning && 
      successRate >= 80 && 
      this.stats.average_processing_time_ms < 1000 &&
      this.activeJobs.size < this.config.maxConcurrentJobs;

    return {
      isRunning: this.isRunning,
      activeJobs: this.activeJobs.size,
      successRate,
      avgProcessingTime: this.stats.average_processing_time_ms,
      isHealthy
    };
  }

  /**
   * Reset processor statistics
   */
  resetStats(): void {
    this.stats = {
      jobs_processed: 0,
      jobs_succeeded: 0,
      jobs_failed: 0,
      average_processing_time_ms: 0,
      total_facts_promoted: 0,
      total_facts_updated: 0,
      last_processed_at: null
    };
  }

  /**
   * Log processing errors for monitoring and debugging
   */
  private logProcessingError(errorType: string, errorMessage: string, jobId?: string): void {
    const errorLog = {
      timestamp: new Date().toISOString(),
      errorType,
      errorMessage,
      jobId,
      processorStats: this.getStats(),
      activeJobs: this.activeJobs.size
    };

    console.error('Fact promotion processing error:', errorLog);

    // In production, you might want to send this to a monitoring service
    // Example: sendToMonitoringService(errorLog);
  }

  /**
   * Get detailed performance metrics
   */
  getPerformanceMetrics(): {
    processingStats: ProcessorStats;
    performanceIndicators: {
      successRate: number;
      averageProcessingTime: number;
      jobsPerMinute: number;
      isWithinTargetTime: boolean;
      healthScore: number;
    };
    systemHealth: {
      isRunning: boolean;
      activeJobs: number;
      maxConcurrentJobs: number;
      utilizationRate: number;
    };
  } {
    const stats = this.getStats();
    const successRate = stats.jobs_processed > 0 
      ? (stats.jobs_succeeded / stats.jobs_processed) * 100 
      : 0;

    const jobsPerMinute = stats.last_processed_at 
      ? (stats.jobs_processed / ((Date.now() - stats.last_processed_at.getTime()) / 60000)) || 0
      : 0;

    const isWithinTargetTime = stats.average_processing_time_ms <= 200; // 200ms target
    
    // Calculate health score (0-100)
    let healthScore = 0;
    if (this.isRunning) healthScore += 25;
    if (successRate >= 95) healthScore += 25;
    else if (successRate >= 80) healthScore += 15;
    if (isWithinTargetTime) healthScore += 25;
    if (this.activeJobs.size < this.config.maxConcurrentJobs) healthScore += 25;

    return {
      processingStats: stats,
      performanceIndicators: {
        successRate,
        averageProcessingTime: stats.average_processing_time_ms,
        jobsPerMinute,
        isWithinTargetTime,
        healthScore
      },
      systemHealth: {
        isRunning: this.isRunning,
        activeJobs: this.activeJobs.size,
        maxConcurrentJobs: this.config.maxConcurrentJobs,
        utilizationRate: (this.activeJobs.size / this.config.maxConcurrentJobs) * 100
      }
    };
  }

  /**
   * Process a single job immediately (for testing or manual processing)
   */
  async processJobById(jobId: string): Promise<PromotionResult | null> {
    try {
      // Get the specific job
      const { data: jobs } = await this.supabase
        .from('fact_promotion_queue')
        .select('*')
        .eq('id', jobId)
        .eq('status', 'pending')
        .single();

      if (!jobs) {
        console.warn(`Job ${jobId} not found or not in pending status`);
        return null;
      }

      // Process the job
      await this.processJob(jobs);
      
      // Return the promotion result (this is simplified - in practice you'd need to track the result)
      return {
        facts_promoted: 0,
        facts_updated: 0,
        processing_time_ms: 0,
        errors: []
      };

    } catch (error) {
      console.error(`Failed to process job ${jobId}:`, error);
      return null;
    }
  }
}