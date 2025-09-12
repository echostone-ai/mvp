# Production Monitoring System for Hybrid Retrieval

This document describes the comprehensive production monitoring system built for the hybrid retrieval feature. The system provides real-time monitoring, alerting, health checks, and deployment validation.

## Overview

The monitoring system consists of four main components:

1. **Production Monitoring Dashboard** - Real-time metrics collection and visualization
2. **Alerting System** - Intelligent alerting with multiple channels and escalation
3. **System Health Monitor** - Resource monitoring and component health tracking
4. **Deployment Validator** - Automated validation of system functionality after deployments

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                Production Monitoring Integration             │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   Dashboard     │  │  Alerting       │  │ Health       │ │
│  │   - Metrics     │  │  - Channels     │  │ Monitor      │ │
│  │   - History     │  │  - Escalation   │  │ - Resources  │ │
│  │   - Reports     │  │  - Notifications│  │ - Components │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Deployment Validator                       │ │
│  │  - Functionality Tests  - Performance Tests             │ │
│  │  - Semantic Tests      - Integration Tests              │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. Production Monitoring Dashboard

**File**: `productionMonitoringDashboard.ts`

Provides real-time monitoring of hybrid retrieval performance with:

- **Metrics Collection**: Latency, throughput, error rates, cache efficiency
- **Historical Data**: Time-series storage with configurable retention
- **Alert Rules**: Configurable thresholds with cooldown periods
- **Performance Reports**: Automated trend analysis and recommendations
- **Prometheus Export**: Standard metrics format for external monitoring

#### Key Metrics

```typescript
interface DashboardMetrics {
  // Performance
  currentP95Latency: number;
  currentP99Latency: number;
  currentThroughput: number;
  errorRate: number;
  
  // Feature Usage
  hybridUsagePercent: number;
  expansionTriggerRate: number;
  rerankingUsagePercent: number;
  
  // System Health
  embeddingCacheSize: number;
  vectorIndexSize: number;
  memoryUsageMB: number;
  cacheEfficiency: number;
}
```

#### Usage

```typescript
const dashboard = new ProductionMonitoringDashboard({
  maxHistorySize: 1000,
  updateIntervalMs: 30000
});

dashboard.start();

// Update metrics from your application
dashboard.updateMetricsFromSource({
  currentP95Latency: 250,
  errorRate: 1.5,
  cacheEfficiency: 85
});

// Generate reports
const report = dashboard.generatePerformanceReport(
  Date.now() - 3600000, // 1 hour ago
  Date.now()
);
```

### 2. Alerting System

**File**: `alertingSystem.ts`

Intelligent alerting with multiple notification channels:

- **Multiple Channels**: Console, Slack, Webhook, Email support
- **Escalation Rules**: Automatic escalation for unacknowledged alerts
- **Cooldown Periods**: Prevent alert spam
- **Acknowledgment**: Manual alert acknowledgment system

#### Supported Channels

- **Console**: Local logging (always available)
- **Slack**: Webhook integration with rich formatting
- **Webhook**: Generic HTTP webhook for custom integrations
- **Email**: SMTP integration (placeholder implementation)

#### Usage

```typescript
const alerting = new AlertingSystem({
  maxRetries: 3,
  retryDelayMs: 60000,
  defaultChannels: ['console', 'slack']
});

// Add Slack channel
alerting.addChannel({
  id: 'slack',
  name: 'Slack Notifications',
  type: 'slack',
  config: {
    webhookUrl: process.env.SLACK_WEBHOOK_URL,
    channel: '#alerts'
  },
  enabled: true
});

// Process alerts from dashboard
dashboard.on('alert:triggered', (alertEvent) => {
  alerting.processAlert(alertEvent);
});
```

### 3. System Health Monitor

**File**: `systemHealthMonitor.ts`

Monitors system resources and component health:

- **System Resources**: CPU, memory, disk usage
- **Component Health**: Individual component status tracking
- **Performance Tracking**: Response times and error rates
- **Health Checks**: Automated health validation with thresholds

#### Health Checks

- CPU usage monitoring with warning/critical thresholds
- Memory usage tracking
- Response time validation
- Error rate monitoring
- Cache efficiency checks
- Component status validation

#### Usage

```typescript
const healthMonitor = new SystemHealthMonitor({
  thresholds: {
    cpuUsageWarning: 70,
    memoryUsageWarning: 80,
    responseTimeWarning: 500,
    errorRateWarning: 5
  }
});

healthMonitor.start(30000); // Check every 30 seconds

// Record performance data
healthMonitor.recordPerformance(responseTime, errorOccurred);

// Update component health
healthMonitor.updateComponentHealth('vectorRetriever', 'degraded');
```

### 4. Deployment Validator

**File**: `deploymentValidator.ts`

Automated validation of system functionality after deployments:

- **Functionality Tests**: Basic retrieval, BM25, vector search, fusion
- **Semantic Tests**: Validate semantic connections (snake→cobra, SXSW→concerts)
- **Performance Tests**: Latency and throughput validation
- **Integration Tests**: Factbook integration, caching validation

#### Test Categories

1. **Critical Tests**: Must pass for deployment success
   - Basic retrieval functionality
   - BM25 and vector search
   - Hybrid fusion
   - Core semantic connections

2. **Performance Tests**: Validate system performance
   - P95 latency under 1000ms
   - Minimum throughput requirements
   - Cache efficiency validation

3. **Integration Tests**: Validate external dependencies
   - Factbook service integration
   - Cache system functionality
   - Component health checks

#### Usage

```typescript
const validator = new DeploymentValidator(hybridRetriever, factbookService);

// Run full validation
const report = await validator.runValidation({
  environment: 'production',
  version: '1.2.0',
  timeout: 30000,
  skipNonCritical: false,
  enablePerformanceTests: true,
  enableSemanticTests: true
});

console.log(`Validation: ${report.overallStatus}`);
console.log(`Passed: ${report.summary.passed}/${report.summary.total}`);
```

## Integration

### Production Monitoring Integration

**File**: `productionMonitoringIntegration.ts`

Unified interface that orchestrates all monitoring components:

```typescript
const monitoring = new ProductionMonitoringIntegration(
  hybridRetriever,
  factbookService,
  {
    dashboard: { enabled: true, updateIntervalMs: 30000 },
    alerting: { enabled: true, defaultChannels: ['slack'] },
    healthMonitoring: { enabled: true, intervalMs: 30000 },
    validation: { enabled: true, runOnStartup: true }
  }
);

// Start all monitoring
await monitoring.start();

// Record performance data
monitoring.recordRetrievalPerformance(responseTime, resultCount, errorOccurred);

// Update cache metrics
monitoring.updateCacheMetrics({
  embeddingCacheHitRate: 85,
  queryCacheHitRate: 90
});

// Run validation
const report = await monitoring.runValidation();
```

## Deployment Validation Script

**File**: `scripts/validate-deployment.mjs`

Command-line script for deployment validation:

```bash
# Basic validation
node scripts/validate-deployment.mjs

# Production validation with custom settings
node scripts/validate-deployment.mjs \
  --environment production \
  --timeout 60000 \
  --output html \
  --output-file validation-report.html

# Skip non-critical tests for faster validation
node scripts/validate-deployment.mjs --skip-non-critical

# Generate JSON report
node scripts/validate-deployment.mjs \
  --output json \
  --output-file validation-report.json
```

### Environment Variables

```bash
NODE_ENV=production
VALIDATION_TIMEOUT=30000
SKIP_NON_CRITICAL=false
ENABLE_PERFORMANCE_TESTS=true
ENABLE_SEMANTIC_TESTS=true
OUTPUT_FORMAT=console
OUTPUT_FILE=validation-report.html
DEBUG=false

# Alert channels
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
ALERT_WEBHOOK_URL=https://your-webhook.com/alerts
```

## Configuration

### Dashboard Configuration

```typescript
{
  dashboard: {
    enabled: true,
    updateIntervalMs: 30000,    // Update frequency
    maxHistorySize: 1000        // Historical data points
  }
}
```

### Alerting Configuration

```typescript
{
  alerting: {
    enabled: true,
    maxRetries: 3,              // Retry failed notifications
    retryDelayMs: 60000,        // Delay between retries
    defaultChannels: ['console', 'slack']
  }
}
```

### Health Monitoring Configuration

```typescript
{
  healthMonitoring: {
    enabled: true,
    intervalMs: 30000,          // Check frequency
    thresholds: {
      cpuWarning: 70,           // CPU usage warning %
      memoryWarning: 80,        // Memory usage warning %
      latencyWarning: 500,      // Response time warning ms
      errorRateWarning: 5       // Error rate warning %
    }
  }
}
```

## Alert Rules

### Default Alert Rules

1. **High Latency**: P95 > 1000ms (Warning), P95 > 2000ms (Critical)
2. **High Error Rate**: >5% (Warning), >15% (Critical)
3. **Low Cache Efficiency**: <50% (Warning)
4. **High Memory Usage**: >1000MB (Warning)

### Custom Alert Rules

```typescript
dashboard.addAlertRule({
  id: 'custom_rule',
  name: 'Custom Performance Rule',
  condition: (metrics) => metrics.currentThroughput < 10,
  severity: 'warning',
  cooldownMs: 300000
});
```

## Monitoring Best Practices

### 1. Gradual Rollout

- Start with console alerts only
- Add Slack integration after testing
- Enable escalation rules in production

### 2. Threshold Tuning

- Monitor baseline performance for 1-2 weeks
- Set warning thresholds at 80% of acceptable limits
- Set critical thresholds at 95% of acceptable limits

### 3. Alert Fatigue Prevention

- Use appropriate cooldown periods (5-15 minutes)
- Implement escalation rules for critical alerts
- Regular review and tuning of alert thresholds

### 4. Validation Strategy

- Run validation on every deployment
- Use performance tests in staging environment
- Skip non-critical tests for hotfixes

## Troubleshooting

### Common Issues

1. **High Alert Volume**
   - Increase cooldown periods
   - Review and adjust thresholds
   - Check for system resource constraints

2. **Validation Failures**
   - Check external service dependencies
   - Verify factbook data integrity
   - Review system resource availability

3. **Missing Metrics**
   - Verify monitoring integration is started
   - Check event handler registration
   - Validate metric update calls

### Debug Mode

Enable debug logging:

```bash
DEBUG=true node scripts/validate-deployment.mjs
```

## Performance Impact

The monitoring system is designed to have minimal performance impact:

- **Dashboard**: ~1-2ms overhead per request
- **Health Monitor**: Background checks every 30 seconds
- **Alerting**: Asynchronous processing
- **Validation**: On-demand execution only

## Future Enhancements

1. **Advanced Analytics**: Machine learning-based anomaly detection
2. **Custom Dashboards**: Web-based dashboard interface
3. **Integration**: PagerDuty, DataDog, New Relic integrations
4. **Automated Remediation**: Self-healing capabilities
5. **Distributed Tracing**: Request tracing across components

## Testing

Run the monitoring system tests:

```bash
# Unit tests
npm test -- --testPathPattern=monitoring

# Integration tests
npm test -- --testPathPattern=productionMonitoringIntegration

# Deployment validation tests
npm test -- --testPathPattern=deploymentValidator
```

## Support

For issues or questions about the monitoring system:

1. Check the troubleshooting section above
2. Review test files for usage examples
3. Enable debug logging for detailed information
4. Check system resource availability and external service health