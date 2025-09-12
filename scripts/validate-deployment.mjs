#!/usr/bin/env node

/**
 * Deployment Validation Script
 * 
 * Runs comprehensive validation tests for the hybrid retrieval system
 * to verify functionality after deployments.
 */

import { HybridRetriever } from '../src/lib/services/hybridRetrieval.js';
import { FactbookService } from '../src/lib/services/factbookService.js';
import { DeploymentValidator } from '../src/lib/services/deploymentValidator.js';
import { ProductionMonitoringIntegration } from '../src/lib/services/productionMonitoringIntegration.js';

// Configuration
const config = {
  environment: process.env.NODE_ENV || 'production',
  version: process.env.npm_package_version || 'unknown',
  timeout: parseInt(process.env.VALIDATION_TIMEOUT) || 30000,
  skipNonCritical: process.env.SKIP_NON_CRITICAL === 'true',
  enablePerformanceTests: process.env.ENABLE_PERFORMANCE_TESTS !== 'false',
  enableSemanticTests: process.env.ENABLE_SEMANTIC_TESTS !== 'false',
  outputFormat: process.env.OUTPUT_FORMAT || 'console', // console, json, html
  outputFile: process.env.OUTPUT_FILE
};

async function main() {
  console.log('🚀 Starting deployment validation...');
  console.log(`Environment: ${config.environment}`);
  console.log(`Version: ${config.version}`);
  console.log(`Timeout: ${config.timeout}ms`);
  console.log('');

  try {
    // Initialize services
    console.log('📋 Initializing services...');
    const factbookService = new FactbookService();
    await factbookService.initialize();

    const hybridRetriever = new HybridRetriever({
      enableEmbeddings: true,
      enableExpansion: 'auto',
      enableReranking: false,
      expansionThreshold: 0.3,
      maxResults: 10,
      fusionK: 60,
      timeoutMs: config.timeout
    });

    await hybridRetriever.warmup();

    // Create validator
    const validator = new DeploymentValidator(hybridRetriever, factbookService);

    // Run quick health check first
    console.log('🏥 Running health check...');
    const healthCheck = await validator.runHealthCheck();
    
    if (!healthCheck.healthy) {
      console.error('❌ Health check failed:', healthCheck.message);
      process.exit(1);
    }
    
    console.log('✅ Health check passed:', healthCheck.message);
    console.log('');

    // Run full validation
    console.log('🧪 Running validation tests...');
    const startTime = Date.now();
    
    const report = await validator.runValidation(config);
    
    const duration = Date.now() - startTime;
    console.log(`⏱️  Validation completed in ${duration}ms`);
    console.log('');

    // Output results
    await outputResults(report, config);

    // Exit with appropriate code
    if (report.overallStatus === 'fail') {
      console.error('❌ Validation failed - deployment should be reviewed');
      process.exit(1);
    } else if (report.overallStatus === 'partial') {
      console.warn('⚠️  Validation passed with warnings');
      process.exit(0);
    } else {
      console.log('✅ Validation passed successfully');
      process.exit(0);
    }

  } catch (error) {
    console.error('💥 Validation error:', error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

async function outputResults(report, config) {
  // Console output
  if (config.outputFormat === 'console' || !config.outputFile) {
    outputConsoleResults(report);
  }

  // JSON output
  if (config.outputFormat === 'json' && config.outputFile) {
    await outputJsonResults(report, config.outputFile);
  }

  // HTML output
  if (config.outputFormat === 'html' && config.outputFile) {
    await outputHtmlResults(report, config.outputFile);
  }
}

function outputConsoleResults(report) {
  console.log('📊 VALIDATION RESULTS');
  console.log('='.repeat(50));
  console.log(`Overall Status: ${getStatusEmoji(report.overallStatus)} ${report.overallStatus.toUpperCase()}`);
  console.log(`Environment: ${report.environment}`);
  console.log(`Version: ${report.version}`);
  console.log(`Timestamp: ${new Date(report.timestamp).toISOString()}`);
  console.log('');

  console.log('📈 SUMMARY');
  console.log('-'.repeat(30));
  console.log(`Total Tests: ${report.summary.total}`);
  console.log(`✅ Passed: ${report.summary.passed}`);
  console.log(`❌ Failed: ${report.summary.failed}`);
  console.log(`⏭️  Skipped: ${report.summary.skipped}`);
  console.log(`⏰ Timeouts: ${report.summary.timeouts}`);
  console.log('');

  if (report.criticalFailures.length > 0) {
    console.log('🚨 CRITICAL FAILURES');
    console.log('-'.repeat(30));
    report.criticalFailures.forEach(failure => {
      console.log(`❌ ${failure.testName}`);
      console.log(`   ${failure.message}`);
      if (failure.error && process.env.DEBUG) {
        console.log(`   Error: ${failure.error}`);
      }
    });
    console.log('');
  }

  // Show failed tests (non-critical)
  const nonCriticalFailures = report.results.filter(r => 
    r.status === 'fail' && !report.criticalFailures.some(cf => cf.testId === r.testId)
  );
  
  if (nonCriticalFailures.length > 0) {
    console.log('⚠️  NON-CRITICAL FAILURES');
    console.log('-'.repeat(30));
    nonCriticalFailures.forEach(failure => {
      console.log(`⚠️  ${failure.testName}`);
      console.log(`   ${failure.message}`);
    });
    console.log('');
  }

  // Show timeouts
  const timeouts = report.results.filter(r => r.status === 'timeout');
  if (timeouts.length > 0) {
    console.log('⏰ TIMEOUTS');
    console.log('-'.repeat(30));
    timeouts.forEach(timeout => {
      console.log(`⏰ ${timeout.testName} (${timeout.duration}ms)`);
    });
    console.log('');
  }

  // Show recommendations
  if (report.recommendations.length > 0) {
    console.log('💡 RECOMMENDATIONS');
    console.log('-'.repeat(30));
    report.recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });
    console.log('');
  }

  // Performance summary
  const performanceTests = report.results.filter(r => r.testId.includes('performance'));
  if (performanceTests.length > 0) {
    console.log('⚡ PERFORMANCE SUMMARY');
    console.log('-'.repeat(30));
    performanceTests.forEach(test => {
      const status = getStatusEmoji(test.status);
      console.log(`${status} ${test.testName}: ${test.duration}ms`);
      if (test.details && test.details.p95Latency) {
        console.log(`   P95 Latency: ${test.details.p95Latency}ms`);
      }
      if (test.details && test.details.throughput) {
        console.log(`   Throughput: ${test.details.throughput.toFixed(2)} req/s`);
      }
    });
    console.log('');
  }

  // Semantic tests summary
  const semanticTests = report.results.filter(r => r.testId.includes('semantic'));
  if (semanticTests.length > 0) {
    console.log('🧠 SEMANTIC TESTS SUMMARY');
    console.log('-'.repeat(30));
    semanticTests.forEach(test => {
      const status = getStatusEmoji(test.status);
      console.log(`${status} ${test.testName}`);
      if (test.details && test.details.foundTerms) {
        console.log(`   Found terms: ${test.details.foundTerms.join(', ')}`);
      }
    });
    console.log('');
  }
}

async function outputJsonResults(report, filename) {
  const fs = await import('fs/promises');
  await fs.writeFile(filename, JSON.stringify(report, null, 2));
  console.log(`📄 JSON report saved to: ${filename}`);
}

async function outputHtmlResults(report, filename) {
  const fs = await import('fs/promises');
  
  const html = generateHtmlReport(report);
  await fs.writeFile(filename, html);
  console.log(`🌐 HTML report saved to: ${filename}`);
}

function generateHtmlReport(report) {
  const statusColor = {
    pass: '#28a745',
    fail: '#dc3545',
    partial: '#ffc107',
    skip: '#6c757d',
    timeout: '#fd7e14'
  };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Deployment Validation Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
        .status { font-size: 24px; font-weight: bold; color: ${statusColor[report.overallStatus]}; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; margin: 30px 0; }
        .metric { background: white; border: 1px solid #dee2e6; padding: 15px; border-radius: 8px; text-align: center; }
        .metric-value { font-size: 32px; font-weight: bold; color: #495057; }
        .metric-label { color: #6c757d; font-size: 14px; }
        .test-results { margin: 30px 0; }
        .test { padding: 15px; border-left: 4px solid #dee2e6; margin: 10px 0; background: #f8f9fa; }
        .test.pass { border-left-color: #28a745; }
        .test.fail { border-left-color: #dc3545; }
        .test.timeout { border-left-color: #fd7e14; }
        .test.skip { border-left-color: #6c757d; }
        .test-name { font-weight: bold; margin-bottom: 5px; }
        .test-message { color: #6c757d; font-size: 14px; }
        .recommendations { background: #e7f3ff; padding: 20px; border-radius: 8px; margin: 30px 0; }
        .recommendations h3 { margin-top: 0; color: #0056b3; }
        .recommendations ul { margin: 0; }
        .timestamp { color: #6c757d; font-size: 14px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Deployment Validation Report</h1>
        <div class="status">${report.overallStatus.toUpperCase()}</div>
        <div class="timestamp">
            Environment: ${report.environment} | 
            Version: ${report.version} | 
            ${new Date(report.timestamp).toLocaleString()}
        </div>
    </div>

    <div class="summary">
        <div class="metric">
            <div class="metric-value">${report.summary.total}</div>
            <div class="metric-label">Total Tests</div>
        </div>
        <div class="metric">
            <div class="metric-value" style="color: #28a745">${report.summary.passed}</div>
            <div class="metric-label">Passed</div>
        </div>
        <div class="metric">
            <div class="metric-value" style="color: #dc3545">${report.summary.failed}</div>
            <div class="metric-label">Failed</div>
        </div>
        <div class="metric">
            <div class="metric-value" style="color: #6c757d">${report.summary.skipped}</div>
            <div class="metric-label">Skipped</div>
        </div>
        <div class="metric">
            <div class="metric-value" style="color: #fd7e14">${report.summary.timeouts}</div>
            <div class="metric-label">Timeouts</div>
        </div>
    </div>

    ${report.criticalFailures.length > 0 ? `
    <div class="critical-failures">
        <h2 style="color: #dc3545;">🚨 Critical Failures</h2>
        ${report.criticalFailures.map(failure => `
            <div class="test fail">
                <div class="test-name">${failure.testName}</div>
                <div class="test-message">${failure.message}</div>
                <div class="test-message">Duration: ${failure.duration}ms</div>
            </div>
        `).join('')}
    </div>
    ` : ''}

    <div class="test-results">
        <h2>Test Results</h2>
        ${report.results.map(result => `
            <div class="test ${result.status}">
                <div class="test-name">${result.testName}</div>
                <div class="test-message">${result.message}</div>
                <div class="test-message">Duration: ${result.duration}ms | Status: ${result.status}</div>
            </div>
        `).join('')}
    </div>

    ${report.recommendations.length > 0 ? `
    <div class="recommendations">
        <h3>💡 Recommendations</h3>
        <ul>
            ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
    </div>
    ` : ''}

    <div class="timestamp">
        Generated at ${new Date().toLocaleString()}
    </div>
</body>
</html>
  `.trim();
}

function getStatusEmoji(status) {
  const emojis = {
    pass: '✅',
    fail: '❌',
    partial: '⚠️',
    skip: '⏭️',
    timeout: '⏰'
  };
  return emojis[status] || '❓';
}

// Handle CLI arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Deployment Validation Script

Usage: node scripts/validate-deployment.mjs [options]

Options:
  --help, -h              Show this help message
  --environment ENV       Set environment (default: production)
  --version VERSION       Set version (default: from package.json)
  --timeout MS            Set timeout in milliseconds (default: 30000)
  --skip-non-critical     Skip non-critical tests
  --no-performance        Disable performance tests
  --no-semantic           Disable semantic tests
  --output FORMAT         Output format: console, json, html (default: console)
  --output-file FILE      Output file for json/html formats

Environment Variables:
  NODE_ENV                Environment name
  VALIDATION_TIMEOUT      Timeout in milliseconds
  SKIP_NON_CRITICAL       Skip non-critical tests (true/false)
  ENABLE_PERFORMANCE_TESTS Enable performance tests (true/false)
  ENABLE_SEMANTIC_TESTS   Enable semantic tests (true/false)
  OUTPUT_FORMAT           Output format (console/json/html)
  OUTPUT_FILE             Output file path
  DEBUG                   Enable debug output

Examples:
  node scripts/validate-deployment.mjs
  node scripts/validate-deployment.mjs --environment staging --timeout 60000
  node scripts/validate-deployment.mjs --output json --output-file validation-report.json
  node scripts/validate-deployment.mjs --skip-non-critical --no-performance
  `);
  process.exit(0);
}

// Parse CLI arguments
args.forEach((arg, index) => {
  switch (arg) {
    case '--environment':
      config.environment = args[index + 1];
      break;
    case '--version':
      config.version = args[index + 1];
      break;
    case '--timeout':
      config.timeout = parseInt(args[index + 1]);
      break;
    case '--skip-non-critical':
      config.skipNonCritical = true;
      break;
    case '--no-performance':
      config.enablePerformanceTests = false;
      break;
    case '--no-semantic':
      config.enableSemanticTests = false;
      break;
    case '--output':
      config.outputFormat = args[index + 1];
      break;
    case '--output-file':
      config.outputFile = args[index + 1];
      break;
  }
});

// Run the validation
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});