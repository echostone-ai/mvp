/**
 * Application Startup Utilities
 * 
 * Handles initialization of background services and system components
 * during application startup.
 * 
 * Requirements: 9.1, 9.7 - Background service initialization
 */

import { backgroundServiceManager } from './services/backgroundServiceManager';

/**
 * Initialize all application services
 */
export async function initializeServices(): Promise<void> {
  try {
    console.log('Starting application services initialization...');

    // Initialize background services
    await backgroundServiceManager.initialize();

    console.log('Application services initialized successfully');

  } catch (error) {
    console.error('Failed to initialize application services:', error);
    throw error;
  }
}

/**
 * Gracefully shutdown all services
 */
export async function shutdownServices(): Promise<void> {
  try {
    console.log('Shutting down application services...');

    await backgroundServiceManager.shutdown();

    console.log('Application services shut down successfully');

  } catch (error) {
    console.error('Error during service shutdown:', error);
    throw error;
  }
}

/**
 * Check if all services are healthy and ready
 */
export async function checkServiceHealth(): Promise<{
  healthy: boolean;
  details: any;
}> {
  try {
    const health = await backgroundServiceManager.getHealthStatus();
    
    const healthy = health.initialized && 
      health.services.factPromotion.healthy;

    return {
      healthy,
      details: health
    };

  } catch (error) {
    console.error('Health check failed:', error);
    return {
      healthy: false,
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

/**
 * Auto-initialize services if not already done
 * This can be called from API routes to ensure services are running
 */
export async function ensureServicesInitialized(): Promise<void> {
  if (!backgroundServiceManager.isReady()) {
    console.log('Services not initialized, starting initialization...');
    await initializeServices();
  }
}