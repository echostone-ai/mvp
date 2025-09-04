# EchoStone Performance Monitoring Stack

This directory contains the complete monitoring and observability stack for EchoStone's streaming audio enhancement system.

## Overview

The monitoring stack implements OpenTelemetry + OTLP → Grafana/Tempo/Loki for comprehensive performance monitoring, metrics collection, and SLA tracking as specified in Task 11.

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   EchoStone     │───▶│ OpenTelemetry    │───▶│   Prometheus    │
│   Application   │    │   Collector      │    │   (Metrics)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │      Tempo       │    │    Grafana      │
                       │    (Traces)      │◀───│  (Dashboard)    │
                       └──────────────────┘    └─────────────────┘
                                │                        ▲
                                ▼                        │
                       ┌──────────────────┐              │
                       │      Loki        │──────────────┘
                       │     (Logs)       │
                       └──────────────────┘
```

## Components

### 1. OpenTelemetry Collector
- **File**: `otel-collector-config.yaml`
- **Purpose**: Receives OTLP data from the application and routes to appropriate backends
- **Ports**: 
  - 4317 (OTLP gRPC)
  - 4318 (OTLP HTTP)
  - 8889 (Prometheus metrics export)

### 2. Prometheus
- **File**: `prometheus.yml`
- **Purpose**: Metrics storage and querying
- **Port**: 9090
- **Scrapes**: OpenTelemetry Collector metrics

### 3. Grafana
- **Purpose**: Visualization and dashboards
- **Port**: 3000
- **Credentials**: admin/admin
- **Dashboard**: Pre-configured EchoStone performance dashboard

### 4. Tempo
- **File**: `tempo.yaml`
- **Purpose**: Distributed tracing storage
- **Port**: 3200

### 5. Loki
- **Purpose**: Log aggregation
- **Port**: 3100

## Quick Start

### 1. Start the Monitoring Stack

```bash
cd monitoring
docker-compose up -d
```

### 2. Verify Services

```bash
# Check all services are running
docker-compose ps

# Check OpenTelemetry Collector logs
docker-compose logs otel-collector

# Check Grafana is accessible
curl http://localhost:3000
```

### 3. Access Dashboards

- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Tempo**: http://localhost:3200

### 4. Configure Application

Set environment variables in your EchoStone application:

```bash
export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces
export OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://localhost:4318/v1/metrics
export NODE_ENV=production
```

## Metrics Tracked

### Core Performance Metrics
- `tts_first_byte_ms` - Time to first byte for TTS responses
- `memory_fetch_ms` - Memory retrieval duration
- `expression_timing_ms` - Expression overlay scheduling timing
- `conversation_duration_ms` - Total conversation duration

### Usage Metrics
- `overlay_injections_count` - Number of expression overlays injected
- `overlay_dropped_count` - Number of overlays dropped due to constraints
- `stream_interrupts` - Audio stream interruption count
- `error_count` - Error count by type and component

### Quality Metrics
- `audio_quality_score` - Current audio quality score (0-1)
- `sla_compliance_percentage` - SLA compliance percentage

## SLA Thresholds

| Metric | Threshold | Description |
|--------|-----------|-------------|
| TTS First Byte | < 1000ms | Time to first audio byte |
| Memory Fetch | < 200ms | Memory retrieval time |
| Expression Timing | < 50ms | Expression scheduling time |
| Audio Quality | > 0.8 | Quality score minimum |
| Uptime | > 99.5% | System availability |

## Dashboard Features

### Performance Overview
- Real-time SLA compliance status
- Performance trend indicators
- System health indicators

### Detailed Metrics
- TTS latency distribution (P50, P95, P99)
- Memory fetch performance
- Expression overlay usage patterns
- Error rates by component

### Alerting
- SLA violation alerts
- Performance degradation warnings
- System health status changes

## API Endpoints

### Dashboard API
- `GET /api/metrics/dashboard` - Real-time dashboard metrics
- `POST /api/metrics/dashboard` - Submit metrics data

### Export API
- `GET /api/metrics/export?format=json` - Export metrics as JSON
- `GET /api/metrics/export?format=csv` - Export metrics as CSV

### Prometheus API
- `GET /api/metrics/prometheus` - Prometheus format metrics

## Integration

### Application Integration

```typescript
import { metricsService, metricsRecorder } from '@/lib/services/metricsService';

// Initialize metrics (done automatically)
await metricsService.initialize();

// Record TTS timing
metricsService.recordTTSFirstByte(750, { voice_id: 'jonathan' });

// Record expression overlay
metricsRecorder.recordOverlayInjection('laughter');

// Measure operations
const result = await metricsService.measureOperation('tts_synthesis', async () => {
  return await synthesizeSpeech(text);
});
```

### Component Integration

```typescript
import { MetricsHelpers } from '@/lib/services/metricsIntegration';

// Measure TTS operations
const audioBlob = await MetricsHelpers.measureTTSOperation(
  () => elevenLabsAPI.synthesize(text),
  { voice_id: 'jonathan', text_length: text.length }
);

// Batch metrics recording
MetricsHelpers.recordBatchMetrics({
  tts_first_byte_ms: 750,
  memory_fetch_ms: 120,
  overlay_injections_count: 3
});
```

## Configuration

### Environment Variables

```bash
# OpenTelemetry Configuration
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces
OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://localhost:4318/v1/metrics
OTEL_SERVICE_NAME=echostone-streaming-audio
OTEL_SERVICE_VERSION=1.0.0

# Grafana Configuration
NEXT_PUBLIC_GRAFANA_URL=http://localhost:3000

# Environment
NODE_ENV=production
ENVIRONMENT=production
```

### Custom Dashboards

To add custom dashboards:

1. Create dashboard JSON in `grafana-dashboard.json`
2. Add to `grafana-dashboards.yml` provisioning
3. Restart Grafana service

### Custom Metrics

To add new metrics:

1. Define in `metricsService.ts`
2. Add to OpenTelemetry configuration
3. Update Grafana dashboard queries
4. Add to Prometheus scraping config

## Troubleshooting

### Common Issues

1. **Metrics not appearing in Grafana**
   - Check OpenTelemetry Collector logs
   - Verify Prometheus is scraping collector
   - Check network connectivity between services

2. **High memory usage**
   - Adjust metric retention periods
   - Reduce scraping frequency
   - Check for metric cardinality issues

3. **Dashboard not loading**
   - Verify Grafana datasource configuration
   - Check Prometheus connectivity
   - Validate dashboard JSON syntax

### Debug Commands

```bash
# Check OpenTelemetry Collector health
curl http://localhost:8888/metrics

# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Check application metrics endpoint
curl http://localhost:3000/api/metrics/prometheus

# View collector configuration
docker-compose exec otel-collector cat /etc/otel-collector-config.yaml
```

## Performance Considerations

### Resource Requirements
- **CPU**: 2+ cores recommended
- **Memory**: 4GB+ RAM for full stack
- **Storage**: 10GB+ for metrics retention
- **Network**: Low latency between components

### Scaling
- Use external Prometheus for production
- Configure proper retention policies
- Consider metric sampling for high-volume metrics
- Use Grafana clustering for high availability

## Security

### Access Control
- Change default Grafana credentials
- Configure authentication for Prometheus
- Use TLS for production deployments
- Implement network segmentation

### Data Privacy
- Avoid logging sensitive user data
- Configure metric label sanitization
- Implement data retention policies
- Use secure communication channels

## Maintenance

### Regular Tasks
- Monitor disk usage for metrics storage
- Update dashboard configurations
- Review and optimize metric cardinality
- Backup Grafana dashboards and configuration

### Updates
- Keep OpenTelemetry Collector updated
- Update Grafana and Prometheus versions
- Review and update alerting rules
- Optimize query performance

## Support

For issues with the monitoring stack:

1. Check service logs: `docker-compose logs <service>`
2. Verify configuration files
3. Test network connectivity
4. Review resource usage
5. Consult OpenTelemetry documentation

## References

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Tempo Documentation](https://grafana.com/docs/tempo/)
- [Loki Documentation](https://grafana.com/docs/loki/)