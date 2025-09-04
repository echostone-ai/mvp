import { metricsService } from './metricsService';

/**
 * Integration utilities for adding metrics to existing services
 * This provides a clean way to instrument existing code without major refactoring
 */

// Decorator for measuring function execution time
export function measurePerformance(metricName: string, component: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      const attributes = { component, method: propertyName };

      try {
        const result = await method.apply(this, args);
        const duration = Date.now() - startTime;

        // Record the metric based on the metric name
        switch (metricName) {
          case 'tts_first_byte':
            metricsService.recordTTSFirstByte(duration, attributes);
            break;
          case 'memory_fetch':
            metricsService.recordMemoryFetch(duration, attributes);
            break;
          case 'expression_timing':
            metricsService.recordExpressionTiming(duration, attributes);
            break;
          default:
            // Generic timing metric
            console.log(`${metricName}: ${duration}ms`, attributes);
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        metricsService.incrementErrors('operation_failure', component, {
          method: propertyName,
          error: error instanceof Error ? error.message : 'unknown',
        });
        throw error;
      }
    };

    return descriptor;
  };
}

// Utility class for manual metrics recording
export class MetricsRecorder {
  private startTimes: Map<string, number> = new Map();

  startTiming(operationId: string): void {
    this.startTimes.set(operationId, Date.now());
  }

  endTiming(operationId: string, metricType: 'tts' | 'memory' | 'expression', attributes?: Record<string, string>): void {
    const startTime = this.startTimes.get(operationId);
    if (!startTime) {
      console.warn(`No start time found for operation: ${operationId}`);
      return;
    }

    const duration = Date.now() - startTime;
    this.startTimes.delete(operationId);

    switch (metricType) {
      case 'tts':
        metricsService.recordTTSFirstByte(duration, attributes);
        break;
      case 'memory':
        metricsService.recordMemoryFetch(duration, attributes);
        break;
      case 'expression':
        metricsService.recordExpressionTiming(duration, attributes);
        break;
    }
  }

  recordOverlayInjection(expressionType?: string): void {
    metricsService.incrementOverlayInjections({ expression_type: expressionType || 'unknown' });
  }

  recordOverlayDropped(reason: string, expressionType?: string): void {
    metricsService.incrementOverlayDropped(reason, { expression_type: expressionType || 'unknown' });
  }

  recordStreamInterrupt(cause: string): void {
    metricsService.incrementStreamInterrupts(cause);
  }

  recordError(errorType: string, component: string, details?: Record<string, string>): void {
    metricsService.incrementErrors(errorType, component, details);
  }
}

// Singleton instance for easy access
export const metricsRecorder = new MetricsRecorder();

// Helper functions for common operations
export const MetricsHelpers = {
  // TTS metrics
  async measureTTSOperation<T>(
    operation: () => Promise<T>,
    attributes?: Record<string, string>
  ): Promise<T> {
    return metricsService.measureOperation('tts_synthesis', operation, attributes);
  },

  // Memory metrics
  async measureMemoryOperation<T>(
    operation: () => Promise<T>,
    attributes?: Record<string, string>
  ): Promise<T> {
    return metricsService.measureOperation('memory_fetch', operation, attributes);
  },

  // Expression metrics
  async measureExpressionOperation<T>(
    operation: () => Promise<T>,
    attributes?: Record<string, string>
  ): Promise<T> {
    return metricsService.measureOperation('expression_scheduling', operation, attributes);
  },

  // Batch metrics recording for API endpoints
  recordBatchMetrics(metrics: {
    tts_first_byte_ms?: number;
    memory_fetch_ms?: number;
    expression_timing_ms?: number;
    overlay_injections_count?: number;
    overlay_dropped_count?: number;
    stream_interrupts?: number;
    error_count?: number;
  }): void {
    if (metrics.tts_first_byte_ms !== undefined) {
      metricsService.recordTTSFirstByte(metrics.tts_first_byte_ms);
    }
    if (metrics.memory_fetch_ms !== undefined) {
      metricsService.recordMemoryFetch(metrics.memory_fetch_ms);
    }
    if (metrics.expression_timing_ms !== undefined) {
      metricsService.recordExpressionTiming(metrics.expression_timing_ms);
    }
    if (metrics.overlay_injections_count !== undefined) {
      for (let i = 0; i < metrics.overlay_injections_count; i++) {
        metricsService.incrementOverlayInjections();
      }
    }
    if (metrics.overlay_dropped_count !== undefined) {
      for (let i = 0; i < metrics.overlay_dropped_count; i++) {
        metricsService.incrementOverlayDropped('batch_report');
      }
    }
    if (metrics.stream_interrupts !== undefined) {
      for (let i = 0; i < metrics.stream_interrupts; i++) {
        metricsService.incrementStreamInterrupts('batch_report');
      }
    }
  },

  // Send metrics to dashboard API
  async sendMetricsToDashboard(metrics: Record<string, any>): Promise<void> {
    try {
      const response = await fetch('/api/metrics/dashboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metrics),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to send metrics to dashboard:', error);
      // Don't throw - metrics failures shouldn't break the application
    }
  },
};

// Initialize metrics service on module load
if (typeof window === 'undefined') {
  // Server-side initialization
  metricsService.initialize().catch(error => {
    console.error('Failed to initialize metrics service:', error);
  });
}