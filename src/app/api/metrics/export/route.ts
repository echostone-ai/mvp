import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';
    const timeRange = searchParams.get('timeRange') || '1h';
    
    // In production, this would query your metrics backend
    // For demo purposes, we'll generate sample export data
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (timeRange === '1h' ? 3600000 : 86400000));
    
    const exportData = {
      metadata: {
        exportTime: endTime.toISOString(),
        timeRange: {
          start: startTime.toISOString(),
          end: endTime.toISOString(),
        },
        format,
        version: '1.0.0',
      },
      metrics: {
        tts_performance: {
          avg_first_byte_ms: 650,
          p50_first_byte_ms: 580,
          p95_first_byte_ms: 1200,
          p99_first_byte_ms: 2100,
          sla_violations: 12,
          total_requests: 1450,
        },
        memory_performance: {
          avg_fetch_ms: 85,
          p50_fetch_ms: 75,
          p95_fetch_ms: 180,
          p99_fetch_ms: 320,
          sla_violations: 8,
          total_fetches: 890,
        },
        expression_system: {
          total_injections: 234,
          total_dropped: 15,
          avg_timing_ms: 28,
          success_rate: 93.6,
          overlay_types: {
            laughter: 89,
            agreement: 67,
            thinking: 45,
            surprise: 33,
          },
        },
        streaming_audio: {
          total_streams: 1450,
          interrupts: 23,
          avg_duration_ms: 12500,
          quality_score: 0.87,
        },
        errors: {
          total_count: 45,
          by_type: {
            network_timeout: 18,
            voice_synthesis_failure: 12,
            memory_fetch_error: 8,
            expression_load_failure: 7,
          },
          by_component: {
            tts_service: 20,
            memory_service: 12,
            expression_system: 8,
            streaming_manager: 5,
          },
        },
        sla_compliance: {
          overall_percentage: 96.8,
          by_metric: {
            tts_latency: 97.2,
            memory_fetch: 98.1,
            expression_timing: 95.5,
            uptime: 99.2,
          },
        },
      },
      raw_data_sample: [
        {
          timestamp: '2024-01-15T10:30:00Z',
          tts_first_byte_ms: 580,
          memory_fetch_ms: 75,
          expression_timing_ms: 25,
          overlay_injections: 3,
          stream_interrupts: 0,
        },
        {
          timestamp: '2024-01-15T10:31:00Z',
          tts_first_byte_ms: 720,
          memory_fetch_ms: 92,
          expression_timing_ms: 31,
          overlay_injections: 2,
          stream_interrupts: 0,
        },
        // More sample data would be here in production
      ],
    };

    if (format === 'csv') {
      // Convert to CSV format
      const csvHeaders = [
        'timestamp',
        'tts_first_byte_ms',
        'memory_fetch_ms',
        'expression_timing_ms',
        'overlay_injections',
        'stream_interrupts'
      ];
      
      const csvRows = exportData.raw_data_sample.map(row => 
        csvHeaders.map(header => row[header as keyof typeof row] || '').join(',')
      );
      
      const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');
      
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="echostone-metrics-${timeRange}.csv"`,
        },
      });
    }

    // Return JSON format
    return NextResponse.json(exportData, {
      headers: {
        'Content-Disposition': `attachment; filename="echostone-metrics-${timeRange}.json"`,
      },
    });

  } catch (error) {
    console.error('Metrics export error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to export metrics',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}