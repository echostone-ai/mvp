/**
 * Metrics Collector - Centralized metrics collection and storage
 * 
 * Collects chat metrics, factbook health, memory usage, and performance data
 * for the monitoring dashboard.
 */

export interface ChatMetrics {
  trace_id: string;
  timestamp: number;
  t_hook_ms: number;
  t_deep_first_ms?: number;
  t_deep_done_ms?: number;
  snippets_selected: string[];
  keyword_extraction_ms?: number;
  index_query_ms?: number;
  jaccard_similarity?: number;
  overlap_percentage?: number;
  should_regenerate?: boolean;
  intent?: string;
  deep_merge?: boolean;
  pinned_count?: number;
  voice_warming_ms?: number;
  error?: string;
}

export interface FactbookHealthMetrics {
  timestamp: number;
  is_loaded: boolean;
  snippet_count: number;
  index_size_bytes: number;
  last_reload_ms?: number;
  validation_errors: string[];
  memory_usage_mb: number;
  corruption_detected: boolean;
}

export interface SystemMetrics {
  timestamp: number;
  memory_usage_mb: number;
  heap_used_mb: number;
  heap_total_mb: number;
  uptime_seconds: number;
  active_connections: number;
}

class MetricsCollector {
  private static instance: MetricsCollector;
  private chatMetrics: ChatMetrics[] = [];
  private factbookHealth: FactbookHealthMetrics | null = null;
  private systemMetrics: SystemMetrics | null = null;
  
  // Keep last 100 chat metrics in memory for dashboard
  private readonly MAX_CHAT_METRICS = 100;
  
  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }
  
  /**
   * Record chat metrics for a conversation turn
   */
  recordChatMetrics(metrics: ChatMetrics): void {
    this.chatMetrics.push({
      ...metrics,
      timestamp: Date.now()
    });
    
    // Keep only last MAX_CHAT_METRICS entries
    if (this.chatMetrics.length > this.MAX_CHAT_METRICS) {
      this.chatMetrics = this.chatMetrics.slice(-this.MAX_CHAT_METRICS);
    }
    
    // Log single-line chat_metrics as specified in requirements
    console.log('chat_metrics', {
      trace_id: metrics.trace_id,
      hook_ms: metrics.t_hook_ms,
      deep_first_ms: metrics.t_deep_first_ms || 0,
      deep_done_ms: metrics.t_deep_done_ms || 0,
      snippets: metrics.snippets_selected.length,
      overlap: metrics.overlap_percentage || 0
    });
  }
  
  /**
   * Update factbook health metrics
   */
  updateFactbookHealth(health: Omit<FactbookHealthMetrics, 'timestamp'>): void {
    this.factbookHealth = {
      ...health,
      timestamp: Date.now()
    };
  }
  
  /**
   * Update system metrics
   */
  updateSystemMetrics(): void {
    const memUsage = process.memoryUsage();
    this.systemMetrics = {
      timestamp: Date.now(),
      memory_usage_mb: Math.round(memUsage.rss / 1024 / 1024),
      heap_used_mb: Math.round(memUsage.heapUsed / 1024 / 1024),
      heap_total_mb: Math.round(memUsage.heapTotal / 1024 / 1024),
      uptime_seconds: Math.round(process.uptime()),
      active_connections: 0 // TODO: Track active connections if needed
    };
  }
  
  /**
   * Get last N chat metrics for dashboard
   */
  getRecentChatMetrics(count: number = 20): ChatMetrics[] {
    return this.chatMetrics.slice(-count);
  }
  
  /**
   * Get current factbook health
   */
  getFactbookHealth(): FactbookHealthMetrics | null {
    return this.factbookHealth;
  }
  
  /**
   * Get current system metrics
   */
  getSystemMetrics(): SystemMetrics | null {
    this.updateSystemMetrics();
    return this.systemMetrics;
  }
  
  /**
   * Get SLA compliance metrics
   */
  getSLAMetrics(): {
    hook_sla_compliance: number;
    deep_sla_compliance: number;
    avg_hook_ms: number;
    avg_deep_ms: number;
    total_requests: number;
  } {
    const recentMetrics = this.getRecentChatMetrics(50);
    
    if (recentMetrics.length === 0) {
      return {
        hook_sla_compliance: 100,
        deep_sla_compliance: 100,
        avg_hook_ms: 0,
        avg_deep_ms: 0,
        total_requests: 0
      };
    }
    
    const hookCompliant = recentMetrics.filter(m => m.t_hook_ms <= 300).length;
    const deepCompliant = recentMetrics.filter(m => !m.t_deep_done_ms || m.t_deep_done_ms <= 1000).length;
    
    const avgHook = recentMetrics.reduce((sum, m) => sum + m.t_hook_ms, 0) / recentMetrics.length;
    const deepMetrics = recentMetrics.filter(m => m.t_deep_done_ms);
    const avgDeep = deepMetrics.length > 0 
      ? deepMetrics.reduce((sum, m) => sum + (m.t_deep_done_ms || 0), 0) / deepMetrics.length 
      : 0;
    
    return {
      hook_sla_compliance: Math.round((hookCompliant / recentMetrics.length) * 100),
      deep_sla_compliance: Math.round((deepCompliant / recentMetrics.length) * 100),
      avg_hook_ms: Math.round(avgHook),
      avg_deep_ms: Math.round(avgDeep),
      total_requests: recentMetrics.length
    };
  }
  
  /**
   * Clear all metrics (for testing)
   */
  clear(): void {
    this.chatMetrics = [];
    this.factbookHealth = null;
    this.systemMetrics = null;
  }
}

export const metricsCollector = MetricsCollector.getInstance();