// src/lib/services/examples/abTestingExample.ts
// Example demonstrating A/B testing and feature flag management

import { FeatureFlagManager } from '../featureFlagManager';
import { ABTestingService } from '../abTestingService';
import { ConfigurationManager } from '../configurationManager';

/**
 * Example: Basic A/B Testing Setup
 */
export async function basicABTestingExample() {
  console.log('=== Basic A/B Testing Example ===');
  
  // Initialize feature flag manager with A/B testing enabled
  process.env.AB_TEST_ENABLED = 'true';
  process.env.AB_TEST_TRAFFIC_SPLIT = '0.5';
  process.env.TRACK_USAGE_METRICS = 'true';
  
  const featureFlagManager = new FeatureFlagManager();
  const abTestingService = new ABTestingService(featureFlagManager);
  
  // Simulate users getting different configurations
  const users = ['user_1', 'user_2', 'user_3', 'user_4', 'user_5'];
  
  console.log('\n--- User Variant Assignments ---');
  for (const userId of users) {
    const config = featureFlagManager.getConfigForUser(userId);
    const variant = (!config.enableEmbeddings && config.enableExpansion === 'off' && !config.enableReranking) 
      ? 'control' : 'treatment';
    
    console.log(`${userId}: ${variant} (embeddings: ${config.enableEmbeddings}, expansion: ${config.enableExpansion})`);
  }
  
  // Run some A/B test experiments
  console.log('\n--- Running A/B Test Experiments ---');
  const testId = 'example_test';
  const queries = ['snake story', 'SXSW concert', 'Tyler partner'];
  
  for (const userId of users) {
    for (const query of queries) {
      try {
        const result = await abTestingService.performABTestRetrieval(userId, query, testId);
        console.log(`${userId} (${result.variant}): "${query}" -> ${result.results.length} results in ${result.metrics.totalTimeMs}ms`);
      } catch (error) {
        console.log(`${userId}: "${query}" -> Error: ${error instanceof Error ? error.message : error}`);
      }
    }
  }
  
  // Get test results
  console.log('\n--- A/B Test Results ---');
  const comparisonMetrics = abTestingService.getComparisonMetrics(testId);
  if (comparisonMetrics) {
    console.log(`Control: ${comparisonMetrics.controlMetrics.sampleSize} samples, avg latency: ${comparisonMetrics.controlMetrics.averageLatencyMs.toFixed(1)}ms`);
    console.log(`Treatment: ${comparisonMetrics.treatmentMetrics.sampleSize} samples, avg latency: ${comparisonMetrics.treatmentMetrics.averageLatencyMs.toFixed(1)}ms`);
    console.log(`Latency improvement: ${comparisonMetrics.comparison.latencyImprovementPercent.toFixed(1)}%`);
    console.log(`Statistical significance: ${comparisonMetrics.comparison.statisticalSignificance.isSignificant}`);
  }
  
  // Generate test report
  const report = abTestingService.generateTestReport(testId);
  console.log('\n--- Test Report Summary ---');
  console.log(`Total experiments: ${report.summary.totalExperiments}`);
  console.log(`Control experiments: ${report.summary.controlExperiments}`);
  console.log(`Treatment experiments: ${report.summary.treatmentExperiments}`);
  console.log(`Recommendations: ${report.recommendations.length}`);
  report.recommendations.forEach((rec, i) => {
    console.log(`  ${i + 1}. ${rec}`);
  });
}

/**
 * Example: Runtime Feature Flag Switching
 */
export function runtimeSwitchingExample() {
  console.log('\n=== Runtime Feature Flag Switching Example ===');
  
  const featureFlagManager = new FeatureFlagManager();
  
  console.log('\n--- Initial Configuration ---');
  const initialConfig = featureFlagManager.getConfig();
  console.log(`Embeddings: ${initialConfig.enableEmbeddings}`);
  console.log(`Expansion: ${initialConfig.enableExpansion}`);
  console.log(`Reranking: ${initialConfig.enableReranking}`);
  console.log(`A/B Test Traffic Split: ${initialConfig.abTestTrafficSplit}`);
  
  // Update configuration at runtime
  console.log('\n--- Updating Configuration ---');
  const updateResult = featureFlagManager.updateConfig({
    enableEmbeddings: false,
    enableExpansion: 'off',
    abTestTrafficSplit: 0.3
  }, 'example_update');
  
  if (updateResult.isValid) {
    console.log('Configuration updated successfully');
    
    const updatedConfig = featureFlagManager.getConfig();
    console.log(`New Embeddings: ${updatedConfig.enableEmbeddings}`);
    console.log(`New Expansion: ${updatedConfig.enableExpansion}`);
    console.log(`New Traffic Split: ${updatedConfig.abTestTrafficSplit}`);
  } else {
    console.log('Configuration update failed:');
    updateResult.errors.forEach(error => console.log(`  - ${error}`));
  }
  
  // Show configuration history
  console.log('\n--- Configuration History ---');
  const history = featureFlagManager.getConfigHistory();
  history.slice(0, 3).forEach((entry, i) => {
    const date = new Date(entry.timestamp).toISOString();
    console.log(`${i + 1}. ${date}: ${entry.reason}`);
  });
  
  // Rollback example
  if (history.length > 0) {
    console.log('\n--- Rolling Back Configuration ---');
    const targetTimestamp = history[0].timestamp;
    const rollbackSuccess = featureFlagManager.rollbackConfig(targetTimestamp, 'example_rollback');
    
    if (rollbackSuccess) {
      console.log('Configuration rolled back successfully');
      const rolledBackConfig = featureFlagManager.getConfig();
      console.log(`Rolled back Embeddings: ${rolledBackConfig.enableEmbeddings}`);
    } else {
      console.log('Rollback failed');
    }
  }
}

/**
 * Example: Configuration Management and Deployment
 */
export async function configurationManagementExample() {
  console.log('\n=== Configuration Management Example ===');
  
  const featureFlagManager = new FeatureFlagManager();
  const configurationManager = new ConfigurationManager(featureFlagManager, './example-config');
  
  // Create a configuration package
  console.log('\n--- Creating Configuration Package ---');
  const configPackage = await configurationManager.createConfigurationPackage(
    'Example Hybrid Retrieval Config',
    'Configuration package for enabling hybrid retrieval features',
    'development',
    'example_user',
    {
      featureFlags: {
        enableEmbeddings: true,
        enableExpansion: 'auto',
        enableReranking: false,
        abTestEnabled: true,
        abTestTrafficSplit: 0.4
      },
      deploymentStrategy: 'immediate',
      healthChecks: ['feature_flag_health', 'hybrid_retrieval_health']
    }
  );
  
  console.log(`Package created: ${configPackage.packageId}`);
  console.log(`Validation passed: ${configPackage.validationResults.isValid}`);
  if (configPackage.validationResults.warnings.length > 0) {
    console.log('Warnings:');
    configPackage.validationResults.warnings.forEach(warning => {
      console.log(`  - ${warning}`);
    });
  }
  
  // Deploy configuration (dry run)
  console.log('\n--- Deploying Configuration (Dry Run) ---');
  const deployResult = await configurationManager.deployConfiguration(
    configPackage.packageId,
    'example_deployer',
    { dryRun: true, skipHealthChecks: true }
  );
  
  console.log(`Deployment success: ${deployResult.success}`);
  console.log(`Deployment ID: ${deployResult.deploymentId}`);
  if (deployResult.errors.length > 0) {
    console.log('Errors:');
    deployResult.errors.forEach(error => console.log(`  - ${error}`));
  }
  if (deployResult.warnings.length > 0) {
    console.log('Warnings:');
    deployResult.warnings.forEach(warning => console.log(`  - ${warning}`));
  }
  
  // List available packages
  console.log('\n--- Available Configuration Packages ---');
  const packages = await configurationManager.listConfigurationPackages();
  packages.slice(0, 3).forEach((pkg, i) => {
    const date = new Date(pkg.createdAt).toISOString().split('T')[0];
    console.log(`${i + 1}. ${pkg.name} (${pkg.version}) - ${date} by ${pkg.createdBy}`);
  });
  
  // Show deployment history
  console.log('\n--- Deployment History ---');
  const deploymentHistory = configurationManager.getDeploymentHistory();
  deploymentHistory.slice(0, 3).forEach((deployment, i) => {
    const date = new Date(deployment.startTime).toISOString().split('T')[0];
    console.log(`${i + 1}. ${deployment.deploymentId} - ${deployment.status} (${date})`);
  });
}

/**
 * Example: Batch A/B Test Comparison
 */
export async function batchComparisonExample() {
  console.log('\n=== Batch A/B Test Comparison Example ===');
  
  const featureFlagManager = new FeatureFlagManager();
  const abTestingService = new ABTestingService(featureFlagManager);
  
  // Define test queries
  const testQueries = [
    'snake story',
    'SXSW concert',
    'Tyler partner',
    'Olive pet',
    'George dog'
  ];
  
  console.log('\n--- Running Batch Comparison ---');
  console.log(`Testing ${testQueries.length} queries...`);
  
  try {
    const batchResult = await abTestingService.runBatchComparison(
      testQueries,
      'batch_test_user',
      'batch_comparison_example'
    );
    
    console.log('\n--- Batch Results ---');
    console.log(`Control results: ${batchResult.controlResults.length}`);
    console.log(`Treatment results: ${batchResult.treatmentResults.length}`);
    
    // Show sample results
    console.log('\n--- Sample Control Results ---');
    batchResult.controlResults.slice(0, 3).forEach((result, i) => {
      console.log(`${i + 1}. "${result.query}": ${result.results.length} results, ${result.metrics.totalTimeMs}ms, methods: [${result.metrics.methodsUsed.join(', ')}]`);
    });
    
    console.log('\n--- Sample Treatment Results ---');
    batchResult.treatmentResults.slice(0, 3).forEach((result, i) => {
      console.log(`${i + 1}. "${result.query}": ${result.results.length} results, ${result.metrics.totalTimeMs}ms, methods: [${result.metrics.methodsUsed.join(', ')}]`);
    });
    
    // Show comparison metrics
    const comparison = batchResult.comparison;
    console.log('\n--- Comparison Metrics ---');
    console.log(`Control avg latency: ${comparison.controlMetrics.averageLatencyMs.toFixed(1)}ms`);
    console.log(`Treatment avg latency: ${comparison.treatmentMetrics.averageLatencyMs.toFixed(1)}ms`);
    console.log(`Latency improvement: ${comparison.comparison.latencyImprovementPercent.toFixed(1)}%`);
    console.log(`Relevance improvement: ${comparison.comparison.relevanceImprovementPercent.toFixed(1)}%`);
    console.log(`Statistical significance: ${comparison.comparison.statisticalSignificance.isSignificant}`);
    
  } catch (error) {
    console.error('Batch comparison failed:', error instanceof Error ? error.message : error);
  }
}

/**
 * Example: Feature Flag Validation
 */
export function validationExample() {
  console.log('\n=== Feature Flag Validation Example ===');
  
  const featureFlagManager = new FeatureFlagManager();
  
  // Test valid configuration
  console.log('\n--- Valid Configuration ---');
  const validConfig = {
    ...featureFlagManager.getConfig(),
    abTestEnabled: true,
    abTestTrafficSplit: 0.6,
    enableEmbeddings: true,
    enableExpansion: 'auto' as const
  };
  
  const validResult = featureFlagManager.validateConfig(validConfig);
  console.log(`Valid: ${validResult.isValid}`);
  console.log(`Errors: ${validResult.errors.length}`);
  console.log(`Warnings: ${validResult.warnings.length}`);
  
  // Test invalid configuration
  console.log('\n--- Invalid Configuration ---');
  const invalidConfig = {
    ...featureFlagManager.getConfig(),
    abTestTrafficSplit: 1.5, // Invalid: > 1.0
    enableBM25Only: true,
    enableEmbeddings: true // Conflicting with BM25-only
  };
  
  const invalidResult = featureFlagManager.validateConfig(invalidConfig);
  console.log(`Valid: ${invalidResult.isValid}`);
  console.log(`Errors: ${invalidResult.errors.length}`);
  invalidResult.errors.forEach(error => console.log(`  - ${error}`));
  console.log(`Warnings: ${invalidResult.warnings.length}`);
  invalidResult.warnings.forEach(warning => console.log(`  - ${warning}`));
  
  // Show safe defaults
  if (Object.keys(invalidResult.safeDefaults).length > 0) {
    console.log('Safe defaults:');
    Object.entries(invalidResult.safeDefaults).forEach(([key, value]) => {
      console.log(`  - ${key}: ${value}`);
    });
  }
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  try {
    await basicABTestingExample();
    runtimeSwitchingExample();
    await configurationManagementExample();
    await batchComparisonExample();
    validationExample();
    
    console.log('\n=== All Examples Completed Successfully ===');
  } catch (error) {
    console.error('Example execution failed:', error instanceof Error ? error.message : error);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}