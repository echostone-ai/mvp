/**
 * Background Service Manager
 * 
 * Manages background services including fact promotion processing.
 * Handles service lifecycle, health monitoring, and graceful shutdown.
 * 
 * Requirements: 9.1, 9.7 - Background job processing and monitoring
 */

import { factPromotionService } from './factPromotionService';

export interface ServiceConfig {
  factPromotion: {
    enabled: boolean;
    batchSize: number;
    processingIntervalMs: number;
    maxConcurrentJobs: number;
    enableRetries: boolean;
    maxRetryAttempts: number;
    processingTimeoutMs: number;
  };
}

export class BackgroundServiceManager {
  private static instance: BackgroundServiceManager | null = null;
  private isInitialized: boolean = false;
  private config: ServiceConfig;
  private shutdownHandlers: Array<() => Promise<void>> = [];

  private constructor() {
    this.config = this.getDefaultConfig();
    this.setupGracefulShutdown();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): BackgroundServiceManager {
    if (!BackgroundServiceManager.instance) {
      BackgroundServiceManager.instance = new BackgroundServiceManager();
    }
    return BackgroundServiceManager.instance;
  }

  /**
   * Initialize all background services
   */
  async initialize(config?: Partial<ServiceConfig>): Promise<void> {
    if (this.isInitialized) {
      console.warn('Background services already initialized');
      return;
    }

    // Merge provided config with defaults
    if (config) {
      this.config = { ...this.config, ...config };
    }

    console.log('Initializing background services...', {
      factPromotionEnabled: this.config.factPromotion.enabled
    });

    try {
      // Initialize fact promotion service if enabled
      if (this.config.factPromotion.enabled) {
        await this.initializeFactPromotionService();
      }

      this.isInitialized = true;
      console.log('Background services initialized successfully');

    } catch (error) {
      console.error('Failed to initialize background services:', error);
      throw error;
    }
  }

  /**
   * Initialize the fact promotion background service
   */
  private async initializeFactPromotionService(): Promise<void> {
    try {
      console.log('Starting fact promotion service...');
      
      factPromotionService.startProcessor(this.config.factPromotion);
      
      // Add shutdown handler
      this.shutdownHandlers.push(async () => {
        console.log('Stopping fact promotion service...');
        await factPromotionService.stopProcessor();
      });

      // Verify service health after startup (skip in test environment)
      if (process.env.NODE_ENV !== 'test') {
        await this.waitForServiceHealth();
      }

      console.log('Fact promotion service started successfully');

    } catch (error) {
      console.error('Failed to initialize fact promotion service:', error);
      throw error;
    }
  }

  /**
   * Wait for services to become healthy
   */
  private async waitForServiceHealth(maxWaitMs: number = 5000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitMs) {
      if (factPromotionService.isHealthy()) {
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.warn('Services may not be fully healthy after startup');
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    initialized: boolean;
    services: {
      factPromotion: {
        enabled: boolean;
        healthy: boolean;
        status?: any;
      };
    };
  }> {
    const factPromotionStatus = this.config.factPromotion.enabled 
      ? await factPromotionService.getStatus()
      : null;

    return {
      initialized: this.isInitialized,
      services: {
        factPromotion: {
          enabled: this.config.factPromotion.enabled,
          healthy: this.config.factPromotion.enabled ? factPromotionService.isHealthy() : true,
          status: factPromotionStatus
        }
      }
    };
  }

  /**
   * Gracefully shutdown all services
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    console.log('Shutting down background services...');

    // Execute all shutdown handlers
    await Promise.allSettled(
      this.shutdownHandlers.map(handler => handler())
    );

    this.isInitialized = false;
    this.shutdownHandlers = [];

    console.log('Background services shut down');
  }

  /**
   * Setup graceful shutdown handlers for process signals
   */
  private setupGracefulShutdown(): void {
    // Skip setting up process handlers in test environment
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    const shutdownHandler = async (signal: string) => {
      console.log(`Received ${signal}, shutting down gracefully...`);
      await this.shutdown();
      process.exit(0);
    };

    // Handle various shutdown signals
    process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
    process.on('SIGINT', () => shutdownHandler('SIGINT'));
    process.on('SIGUSR2', () => shutdownHandler('SIGUSR2')); // Nodemon restart

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      console.error('Uncaught exception:', error);
      await this.shutdown();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      console.error('Unhandled rejection at:', promise, 'reason:', reason);
      await this.shutdown();
      process.exit(1);
    });
  }

  /**
   * Get default service configuration
   */
  private getDefaultConfig(): ServiceConfig {
    return {
      factPromotion: {
        enabled: process.env.FACT_PROMOTION_ENABLED !== 'false', // Enabled by default
        batchSize: parseInt(process.env.FACT_PROMOTION_BATCH_SIZE || '10'),
        processingIntervalMs: parseInt(process.env.FACT_PROMOTION_INTERVAL_MS || '1000'),
        maxConcurrentJobs: parseInt(process.env.FACT_PROMOTION_MAX_CONCURRENT || '5'),
        enableRetries: process.env.FACT_PROMOTION_ENABLE_RETRIES !== 'false',
        maxRetryAttempts: parseInt(process.env.FACT_PROMOTION_MAX_RETRIES || '3'),
        processingTimeoutMs: parseInt(process.env.FACT_PROMOTION_TIMEOUT_MS || '5000')
      }
    };
  }

  /**
   * Update service configuration (requires restart)
   */
  updateConfig(newConfig: Partial<ServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Service configuration updated. Restart required for changes to take effect.');
  }

  /**
   * Get current configuration
   */
  getConfig(): ServiceConfig {
    return { ...this.config };
  }

  /**
   * Check if services are initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}

// Export singleton instance
export const backgroundServiceManager = BackgroundServiceManager.getInstance();