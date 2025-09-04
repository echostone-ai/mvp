#!/usr/bin/env tsx

/**
 * Schema Compatibility Verification Script
 * 
 * This script performs automated schema verification during deployment
 * to catch and resolve any legacy table/column references before they
 * break context retrieval in the GPT-5 Avatar Memory Upgrade system.
 */

import { SchemaCompatibilityLayer } from '../lib/services/schemaCompatibilityLayer';

interface VerificationReport {
  timestamp: string;
  overallStatus: 'PASS' | 'FAIL' | 'WARNING';
  schemaCompatibility: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
  criticalIssues: string[];
  recommendations: string[];
}

/**
 * Main verification function
 */
async function verifySchemaCompatibility(): Promise<VerificationReport> {
  console.log('🔍 Starting Schema Compatibility Verification...\n');
  
  const schemaLayer = SchemaCompatibilityLayer.getInstance();
  const report: VerificationReport = {
    timestamp: new Date().toISOString(),
    overallStatus: 'PASS',
    schemaCompatibility: {
      isValid: true,
      errors: [],
      warnings: []
    },
    criticalIssues: [],
    recommendations: []
  };

  try {
    // Perform comprehensive schema verification
    console.log('📋 Checking schema compatibility...');
    const schemaResult = await schemaLayer.verifySchemaCompatibility();
    
    report.schemaCompatibility = schemaResult;
    
    // Analyze results and determine overall status
    if (!schemaResult.isValid) {
      report.overallStatus = 'FAIL';
      report.criticalIssues.push(...schemaResult.errors);
    } else if (schemaResult.warnings.length > 0) {
      report.overallStatus = 'WARNING';
    }

    // Test specific table mappings
    console.log('🔄 Testing table name mappings...');
    const tableMappings = schemaLayer.getTableMappings();
    for (const mapping of tableMappings) {
      console.log(`  ✓ ${mapping.legacyName} → ${mapping.currentName}`);
    }

    // Test critical column validations
    console.log('📊 Validating critical columns...');
    const criticalColumns = [
      { table: 'avatar_profiles', column: 'id' },
      { table: 'avatar_profiles', column: 'name' },
      { table: 'memory_fragments', column: 'avatar_id' },
      { table: 'memory_fragments', column: 'fragment_text' },
      { table: 'quick_facts', column: 'key' },
      { table: 'quick_facts', column: 'value' },
      { table: 'fact_history', column: 'change_source' }
    ];

    for (const { table, column } of criticalColumns) {
      const exists = await schemaLayer.validateColumnExists(table, column);
      if (!exists) {
        report.criticalIssues.push(`Critical column ${table}.${column} is missing`);
        report.overallStatus = 'FAIL';
      } else {
        console.log(`  ✓ ${table}.${column}`);
      }
    }

    // Test constraint validations
    console.log('🔒 Testing constraint validations...');
    const constraintTests = [
      { table: 'fact_history', data: { change_source: 'manual' }, shouldPass: true },
      { table: 'fact_history', data: { change_source: 'invalid' }, shouldPass: false },
      { table: 'quick_facts', data: { source: 'extraction' }, shouldPass: true },
      { table: 'quick_facts', data: { source: 'invalid' }, shouldPass: false }
    ];

    for (const test of constraintTests) {
      const result = schemaLayer.validateConstraints(test.table, test.data);
      if (result.isValid !== test.shouldPass) {
        report.criticalIssues.push(
          `Constraint validation failed for ${test.table}: expected ${test.shouldPass}, got ${result.isValid}`
        );
        report.overallStatus = 'FAIL';
      } else {
        console.log(`  ✓ ${test.table} constraint validation`);
      }
    }

    // Test query transformations
    console.log('🔧 Testing query transformations...');
    const queryTests = [
      {
        name: 'Legacy table reference',
        input: 'SELECT * FROM avatars WHERE id = $1',
        expectedContains: 'avatar_profiles'
      },
      {
        name: 'Join qualification',
        input: 'SELECT id FROM memory_fragments mf JOIN avatars a ON mf.avatar_id = a.id',
        expectedContains: 'a.id'
      }
    ];

    for (const test of queryTests) {
      const result = await schemaLayer.validateAndTransformQuery(test.input);
      if (!result.transformedQuery.includes(test.expectedContains)) {
        report.criticalIssues.push(
          `Query transformation failed for ${test.name}: expected to contain "${test.expectedContains}"`
        );
        report.overallStatus = 'FAIL';
      } else {
        console.log(`  ✓ ${test.name}`);
      }
    }

    // Generate recommendations
    if (report.schemaCompatibility.warnings.length > 0) {
      report.recommendations.push(
        'Consider migrating legacy table references to current schema',
        'Review and update any hardcoded table names in application code',
        'Add explicit table prefixes to all join queries'
      );
    }

    if (report.criticalIssues.length === 0) {
      report.recommendations.push(
        'Schema compatibility verification passed successfully',
        'All critical tables and columns are present',
        'Query transformations are working correctly'
      );
    }

  } catch (error) {
    console.error('❌ Verification failed with error:', error);
    report.overallStatus = 'FAIL';
    report.criticalIssues.push(`Verification script error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return report;
}

/**
 * Print verification report
 */
function printReport(report: VerificationReport): void {
  console.log('\n' + '='.repeat(60));
  console.log('📊 SCHEMA COMPATIBILITY VERIFICATION REPORT');
  console.log('='.repeat(60));
  
  console.log(`🕐 Timestamp: ${report.timestamp}`);
  
  // Overall status
  const statusIcon = report.overallStatus === 'PASS' ? '✅' : 
                     report.overallStatus === 'WARNING' ? '⚠️' : '❌';
  console.log(`${statusIcon} Overall Status: ${report.overallStatus}`);
  
  // Schema compatibility details
  console.log('\n📋 Schema Compatibility:');
  console.log(`  Valid: ${report.schemaCompatibility.isValid ? '✅' : '❌'}`);
  
  if (report.schemaCompatibility.errors.length > 0) {
    console.log('  Errors:');
    report.schemaCompatibility.errors.forEach(error => {
      console.log(`    ❌ ${error}`);
    });
  }
  
  if (report.schemaCompatibility.warnings.length > 0) {
    console.log('  Warnings:');
    report.schemaCompatibility.warnings.forEach(warning => {
      console.log(`    ⚠️  ${warning}`);
    });
  }
  
  // Critical issues
  if (report.criticalIssues.length > 0) {
    console.log('\n🚨 Critical Issues:');
    report.criticalIssues.forEach(issue => {
      console.log(`  ❌ ${issue}`);
    });
  }
  
  // Recommendations
  if (report.recommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    report.recommendations.forEach(rec => {
      console.log(`  • ${rec}`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Exit with appropriate code
  if (report.overallStatus === 'FAIL') {
    console.log('❌ Verification FAILED - Deployment should be blocked');
    process.exit(1);
  } else if (report.overallStatus === 'WARNING') {
    console.log('⚠️  Verification completed with WARNINGS - Review recommended');
    process.exit(0);
  } else {
    console.log('✅ Verification PASSED - Safe to deploy');
    process.exit(0);
  }
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  try {
    const report = await verifySchemaCompatibility();
    printReport(report);
  } catch (error) {
    console.error('💥 Fatal error during verification:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}

export { verifySchemaCompatibility, VerificationReport };