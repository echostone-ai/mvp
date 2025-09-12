// src/lib/services/retrievalLogger.ts
// Comprehensive logging infrastructure for hybrid retrieval system

import { RetrievalMetrics, RetrievalResult, HybridRetrievalConfig } from './hybridRetrieval';

/**
 * Structured log entry for retrieval operations
 */
export interface RetrievalLogEntry {
  // Basic request info
  timestamp: number;
  query: string;
  queryHash: string;
  sessionId?: string;
  userId?: string;
  
  // Timing breakdown
  totalTimeMs: number;
  bm25TimeMs: number;
  vectorTimeMs?: number;
  expansionTimeMs?: number;
  rerankTimeMs?: number;
  fusionTimeMs?: number;
  cacheTimeMs?: number;
  
  // Results and scoring
  resultCount: number;
  hitIds: string[];
  confidenceScores: number[];
  topScore?: number;
  averageScore?: number;
  
  // Method usage
  methodsUsed: string[];
  fallbackLevel?: 'none' | 'basic_hybrid' | 'bm25_only' | 'empty';
  expansionTriggered: boolean;
  rerankingApplied: boolean;
  
  // Cache performance
  cacheHit: boolean;
  embeddingCacheHits?: number;
  expansionCacheHits?: number;
  
  // Component health
  componentStatus: {
    bm25: 'healthy' | 'degraded' | 'failed';
    vector: 'healthy' | 'degraded' | 'failed' | 'disabled';
    expansion: 'healthy' | 'degraded' | 'failed' | 'disabled';
    reranking: 'healthy' | 'degraded' | 'failed' | 'disabled';
  };
  
  // Error tracking
  errors: string[];
  warnings: string[];
  
  // Decision context
  expansionReason?: 'low_top_score' | 'few_results' | 'empty_results';
  fallbackReason?: string;
  
  // Performance context
  memoryUsageMB?: number;
  timeoutOccurred?: boolean;
  
  // Configuration snapshot
  config: {
    enableEmbeddings: boolean;
    enableExpansion: string;
    enableReranking: boolean;
    expansionThreshold: number;
    maxResults: number;
  };
}

/**
 * Log levels for different types of retrieval events
 */
export enum RetrievalLogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

/**
 * Structured logger for retrieval operations with timing, scoring, and decision tracking
 */
export class RetrievalLogger {
  private logBuffer: RetrievalLogEntry[] = [];
  private maxBufferSize: number = 1000;
  private enableConsoleOutput: boolean = true;
  private enableStructuredLogging: boolean = true;
  
  constructor(options?: {
    maxBufferSize?: number;
    enableConsoleOutput?: boolean;
    enableStructuredLogging?: boolean;
  }) {
    this.maxBufferSize = options?.maxBufferSize || 1000;
    this.enableConsoleOutput = options?.enableConsoleOutput !== false;
    this.enableStructuredLogging = options?.enableStructuredLogging !== false;
  }
  
  /**
   * Log a complete retrieval operation with full context
   */
  logRetrieval(
    query: string,
    results: RetrievalResult[],
    metrics: RetrievalMetrics,
    config: HybridRetrievalConfig,
    context?: {
      sessionId?: string;
      userId?: string;
      expansionReason?: string;
      fallbackReason?: string;
    }
  ): void {
    const logEntry: RetrievalLogEntry = {
      // Basic request info
      timestamp: Date.now(),
      query,
      queryHash: this.hashQuery(query),
      sessionId: context?.sessionId,
      userId: context?.userId,
      
      // Timing breakdown
      totalTimeMs: metrics.totalTimeMs,
      bm25TimeMs: metrics.bm25TimeMs,
      vectorTimeMs: metrics.vectorTimeMs,
      expansionTimeMs: metrics.expansionTimeMs,
      rerankTimeMs: metrics.rerankTimeMs,
      fusionTimeMs: metrics.fusionTimeMs,
      
      // Results and scoring
      resultCount: results.length,
      hitIds: results.map(r => r.snippet.id),
      confidenceScores: results.map(r => r.confidence),
      topScore: results.length > 0 ? results[0].score : undefined,
      averageScore: results.length > 0 
        ? results.reduce((sum, r) => sum + r.score, 0) / results.length 
        : undefined,
      
      // Method usage
      methodsUsed: metrics.methodsUsed,
      fallbackLevel: metrics.fallbackLevel,
      expansionTriggered: metrics.expansionTriggered,
      rerankingApplied: metrics.rerankingApplied,
      
      // Cache performance
      cacheHit: metrics.cacheHit,
      embeddingCacheHits: metrics.embeddingCacheHits,
      expansionCacheHits: metrics.expansionCacheHits,
      
      // Component health
      componentStatus: {
        bm25: metrics.bm25Available ? 'healthy' : 'failed',
        vector: !config.enableEmbeddings ? 'disabled' : 
                metrics.vectorAvailable ? 'healthy' : 'failed',
        expansion: config.enableExpansion === 'off' ? 'disabled' :
                  metrics.expansionAvailable ? 'healthy' : 'failed',
        reranking: !config.enableReranking ? 'disabled' :
                  metrics.rerankingAvailable ? 'healthy' : 'failed'
      },
      
      // Error tracking
      errors: metrics.errors,
      warnings: metrics.warnings,
      
      // Decision context
      expansionReason: context?.expansionReason as any,
      fallbackReason: context?.fallbackReason,
      
      // Performance context
      memoryUsageMB: metrics.memoryUsageMB,
      timeoutOccurred: metrics.timeoutOccurred,
      
      // Configuration snapshot
      config: {
        enableEmbeddings: config.enableEmbeddings,
        enableExpansion: config.enableExpansion,
        enableReranking: config.enableReranking,
        expansionThreshold: config.expansionThreshold,
        maxResults: config.maxResults
      }
    };
    
    // Add to buffer
    this.addToBuffer(logEntry);
    
    // Console output
    if (this.enableConsoleOutput) {
      this.logToConsole(logEntry);
    }
    
    // Structured logging output
    if (this.enableStructuredLogging) {
      this.logStructured(logEntry);
    }
  }
  
  /**
   * Log component-specific events (BM25, vector search, expansion, etc.)
   */
  logComponent(
    component: 'bm25' | 'vector' | 'expansion' | 'reranking' | 'fusion',
    level: RetrievalLogLevel,
    message: string,
    context: Record<string, any>
  ): void {
    const logData = {
      timestamp: Date.now(),
      component,
      level,
      message,
      ...context
    };
    
    if (this.enableConsoleOutput) {
      const logMethod = level === 'error' ? console.error :
                       level === 'warn' ? console.warn :
                       level === 'debug' ? console.debug :
                       console.log;
      
      logMethod(`[${component.toUpperCase()}] ${message}`, context);
    }
    
    if (this.enableStructuredLogging) {
      console.log(JSON.stringify({
        type: 'component_log',
        ...logData
      }));
    }
  }
  
  /**
   * Log expansion trigger decisions with detailed reasoning
   */
  logExpansionDecision(
    query: string,
    results: RetrievalResult[],
    shouldExpand: boolean,
    reason: string,
    thresholds: {
      topScore: number;
      resultsAboveThreshold: number;
      lowConfidenceThreshold: number;
      minResultsThreshold: number;
    }
  ): void {
    const logData = {
      timestamp: Date.now(),
      query,
      queryHash: this.hashQuery(query),
      shouldExpand,
      reason,
      topScore: results.length > 0 ? results[0].score : 0,
      resultCount: results.length,
      resultsAboveThreshold: thresholds.resultsAboveThreshold,
      lowConfidenceThreshold: thresholds.lowConfidenceThreshold,
      minResultsThreshold: thresholds.minResultsThreshold,
      confidenceScores: results.slice(0, 5).map(r => r.confidence)
    };
    
    this.logComponent('expansion', RetrievalLogLevel.INFO, 
      `Expansion decision: ${shouldExpand ? 'EXPAND' : 'NO_EXPAND'} - ${reason}`, 
      logData
    );
  }
  
  /**
   * Log fallback usage with detailed context
   */
  logFallback(
    query: string,
    fromLevel: string,
    toLevel: string,
    reason: string,
    error?: Error
  ): void {
    const logData = {
      timestamp: Date.now(),
      query,
      queryHash: this.hashQuery(query),
      fromLevel,
      toLevel,
      reason,
      error: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : undefined
    };
    
    this.logComponent('fallback', RetrievalLogLevel.WARN,
      `Fallback from ${fromLevel} to ${toLevel}: ${reason}`,
      logData
    );
  }
  
  /**
   * Get recent log entries for debugging
   */
  getRecentLogs(count: number = 50): RetrievalLogEntry[] {
    return this.logBuffer.slice(-count);
  }
  
  /**
   * Get logs filtered by criteria
   */
  getFilteredLogs(filter: {
    query?: string;
    timeRangeMs?: number;
    hasErrors?: boolean;
    fallbackUsed?: boolean;
    expansionTriggered?: boolean;
  }): RetrievalLogEntry[] {
    const now = Date.now();
    
    return this.logBuffer.filter(entry => {
      if (filter.query && !entry.query.toLowerCase().includes(filter.query.toLowerCase())) {
        return false;
      }
      
      if (filter.timeRangeMs && (now - entry.timestamp) > filter.timeRangeMs) {
        return false;
      }
      
      if (filter.hasErrors !== undefined && (entry.errors.length > 0) !== filter.hasErrors) {
        return false;
      }
      
      if (filter.fallbackUsed !== undefined && 
          (entry.fallbackLevel !== 'none') !== filter.fallbackUsed) {
        return false;
      }
      
      if (filter.expansionTriggered !== undefined && 
          entry.expansionTriggered !== filter.expansionTriggered) {
        return false;
      }
      
      return true;
    });
  }
  
  /**
   * Export logs in various formats for analysis
   */
  exportLogs(format: 'json' | 'csv' | 'tsv' = 'json'): string {
    switch (format) {
      case 'json':
        return JSON.stringify(this.logBuffer, null, 2);
      
      case 'csv':
        return this.exportAsCSV();
      
      case 'tsv':
        return this.exportAsCSV('\t');
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }
  
  /**
   * Clear log buffer
   */
  clearLogs(): void {
    this.logBuffer = [];
  }
  
  /**
   * Get log statistics for monitoring
   */
  getLogStats(): {
    totalEntries: number;
    timeRange: { start: number; end: number } | null;
    errorRate: number;
    fallbackRate: number;
    expansionRate: number;
    averageLatency: number;
    componentHealth: Record<string, number>;
  } {
    if (this.logBuffer.length === 0) {
      return {
        totalEntries: 0,
        timeRange: null,
        errorRate: 0,
        fallbackRate: 0,
        expansionRate: 0,
        averageLatency: 0,
        componentHealth: {}
      };
    }
    
    const entries = this.logBuffer;
    const entriesWithErrors = entries.filter(e => e.errors.length > 0);
    const entriesWithFallback = entries.filter(e => e.fallbackLevel !== 'none');
    const entriesWithExpansion = entries.filter(e => e.expansionTriggered);
    
    const totalLatency = entries.reduce((sum, e) => sum + e.totalTimeMs, 0);
    
    // Component health statistics
    const componentHealth: Record<string, number> = {};
    ['bm25', 'vector', 'expansion', 'reranking'].forEach(component => {
      const healthyCount = entries.filter(e => 
        e.componentStatus[component as keyof typeof e.componentStatus] === 'healthy'
      ).length;
      componentHealth[component] = entries.length > 0 ? healthyCount / entries.length : 0;
    });
    
    return {
      totalEntries: entries.length,
      timeRange: {
        start: entries[0].timestamp,
        end: entries[entries.length - 1].timestamp
      },
      errorRate: entriesWithErrors.length / entries.length,
      fallbackRate: entriesWithFallback.length / entries.length,
      expansionRate: entriesWithExpansion.length / entries.length,
      averageLatency: totalLatency / entries.length,
      componentHealth
    };
  }
  
  // Private helper methods
  
  private addToBuffer(entry: RetrievalLogEntry): void {
    this.logBuffer.push(entry);
    
    // Maintain buffer size limit
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.maxBufferSize);
    }
  }
  
  private logToConsole(entry: RetrievalLogEntry): void {
    const level = entry.errors.length > 0 ? 'error' :
                 entry.warnings.length > 0 ? 'warn' : 'info';
    
    const logMethod = level === 'error' ? console.error :
                     level === 'warn' ? console.warn :
                     console.log;
    
    logMethod('hybrid_retrieval_complete', {
      query: entry.query,
      result_count: entry.resultCount,
      total_time_ms: entry.totalTimeMs,
      methods_used: entry.methodsUsed,
      fallback_level: entry.fallbackLevel,
      expansion_triggered: entry.expansionTriggered,
      reranking_applied: entry.rerankingApplied,
      cache_hit: entry.cacheHit,
      top_score: entry.topScore?.toFixed(3),
      hit_ids: entry.hitIds.slice(0, 3),
      component_status: entry.componentStatus,
      errors: entry.errors,
      warnings: entry.warnings
    });
  }
  
  private logStructured(entry: RetrievalLogEntry): void {
    console.log(JSON.stringify({
      type: 'retrieval_log',
      ...entry
    }));
  }
  
  private hashQuery(query: string): string {
    // Simple hash function for query identification
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
  
  private exportAsCSV(delimiter: string = ','): string {
    if (this.logBuffer.length === 0) {
      return '';
    }
    
    // CSV headers
    const headers = [
      'timestamp', 'query', 'queryHash', 'totalTimeMs', 'resultCount',
      'methodsUsed', 'fallbackLevel', 'expansionTriggered', 'rerankingApplied',
      'cacheHit', 'topScore', 'averageScore', 'errors', 'warnings'
    ];
    
    const rows = this.logBuffer.map(entry => [
      entry.timestamp,
      `"${entry.query.replace(/"/g, '""')}"`, // Escape quotes
      entry.queryHash,
      entry.totalTimeMs,
      entry.resultCount,
      `"${entry.methodsUsed.join(';')}"`,
      entry.fallbackLevel || 'none',
      entry.expansionTriggered,
      entry.rerankingApplied,
      entry.cacheHit,
      entry.topScore || '',
      entry.averageScore || '',
      `"${entry.errors.join(';')}"`,
      `"${entry.warnings.join(';')}"`
    ]);
    
    return [headers.join(delimiter), ...rows.map(row => row.join(delimiter))].join('\n');
  }
}

/**
 * Global retrieval logger instance
 */
export const retrievalLogger = new RetrievalLogger({
  maxBufferSize: parseInt(process.env.RETRIEVAL_LOG_BUFFER_SIZE || '1000'),
  enableConsoleOutput: process.env.RETRIEVAL_LOG_CONSOLE !== 'false',
  enableStructuredLogging: process.env.RETRIEVAL_LOG_STRUCTURED === 'true'
});