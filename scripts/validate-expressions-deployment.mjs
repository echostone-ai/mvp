#!/usr/bin/env node

/**
 * Deployment Validation Script for Authentic Expressions Pipeline
 * 
 * This script validates the complete deployment of the expressions system
 * across different environments and confirms all requirements are met.
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const COLORS = {
  GREEN: '\x1b[32m',
  RED: '\x1b[31m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  RESET: '\x1b[0m'
};

class DeploymentValidator {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      tests: []
    };
  }

  log(message, color = COLORS.RESET) {
    console.log(`${color}${message}${COLORS.RESET}`);
  }

  async runTest(name, testFn) {
    try {
      this.log(`\n🧪 Testing: ${name}`, COLORS.BLUE);
      const result = await testFn();
      
      if (result.success) {
        this.log(`✅ PASS: ${name}`, COLORS.GREEN);
        this.results.passed++;
      } else {
        this.log(`❌ FAIL: ${name} - ${result.error}`, COLORS.RED);
        this.results.failed++;
      }
      
      this.results.tests.push({ name, ...result });
      return result;
    } catch (error) {
      this.log(`❌ ERROR: ${name} - ${error.message}`, COLORS.RED);
      this.results.failed++;
      this.results.tests.push({ name, success: false, error: error.message });
      return { success: false, error: error.message };
    }
  }

  async validateDatabaseSchema() {
    return this.runTest('Database Schema Validation', async () => {
      // Check if expression_clips table exists and has correct structure
      const migrationFile = 'supabase/migrations/017_create_expression_clips.sql';
      
      if (!existsSync(migrationFile)) {
        return { success: false, error: 'Expression clips migration file not found' };
      }

      const migrationContent = readFileSync(migrationFile, 'utf8');
      const requiredColumns = [
        'id', 'owner_type', 'owner_key', 'filename', 'type', 
        'tone', 'placement_hints', 'duration_ms', 'cdn_url', 
        'priority', 'status', 'created_at'
      ];

      const missingColumns = requiredColumns.filter(col => 
        !migrationContent.includes(col)
      );

      if (missingColumns.length > 0) {
        return { 
          success: false, 
          error: `Missing columns: ${missingColumns.join(', ')}` 
        };
      }

      return { success: true, message: 'Database schema is valid' };
    });
  }

  async validateAPIEndpoints() {
    return this.runTest('API Endpoints Validation', async () => {
      const requiredEndpoints = [
        'src/app/api/expressions/upload/route.ts',
        'src/app/api/expressions/route.ts',
        'src/app/api/expressions/[id]/route.ts',
        'src/app/api/expressions/admin/upload/route.ts',
        'src/app/api/expressions/admin/bulk-upload/route.ts'
      ];

      const missingEndpoints = requiredEndpoints.filter(endpoint => 
        !existsSync(endpoint)
      );

      if (missingEndpoints.length > 0) {
        return { 
          success: false, 
          error: `Missing API endpoints: ${missingEndpoints.join(', ')}` 
        };
      }

      // Check for feature flag gating in API endpoints
      const uploadRoute = readFileSync('src/app/api/expressions/upload/route.ts', 'utf8');
      if (!uploadRoute.includes('FEATURE_VOICE_OVERLAYS')) {
        return { 
          success: false, 
          error: 'Upload API missing feature flag gating' 
        };
      }

      return { success: true, message: 'All API endpoints are present and properly gated' };
    });
  }

  async validateUIComponents() {
    return this.runTest('UI Components Validation', async () => {
      const requiredComponents = [
        'src/components/ExpressionUploader.tsx',
        'src/components/ExpressionList.tsx',
        'src/components/AdminExpressionUploader.tsx',
        'src/components/AdminBulkExpressionUploader.tsx',
        'src/components/ExpressionPrivacySettings.tsx'
      ];

      const missingComponents = requiredComponents.filter(component => 
        !existsSync(component)
      );

      if (missingComponents.length > 0) {
        return { 
          success: false, 
          error: `Missing UI components: ${missingComponents.join(', ')}` 
        };
      }

      // Check for feature flag gating in main expression page
      const expressionPage = readFileSync('src/app/voice-expressions/page.tsx', 'utf8');
      if (!expressionPage.includes('FEATURE_VOICE_OVERLAYS')) {
        return { 
          success: false, 
          error: 'Expression page missing feature flag gating' 
        };
      }

      return { success: true, message: 'All UI components are present and properly gated' };
    });
  }

  async validateCoreLibraries() {
    return this.runTest('Core Libraries Validation', async () => {
      const requiredLibraries = [
        'src/lib/hooks/useExpressionPack.ts',
        'src/lib/expressionScheduler.ts',
        'src/lib/expressionAudioMixer.ts',
        'src/lib/audioProcessor.ts',
        'src/lib/expressionErrorHandler.ts',
        'src/lib/expressionPerformanceMonitor.ts'
      ];

      const missingLibraries = requiredLibraries.filter(lib => 
        !existsSync(lib)
      );

      if (missingLibraries.length > 0) {
        return { 
          success: false, 
          error: `Missing core libraries: ${missingLibraries.join(', ')}` 
        };
      }

      return { success: true, message: 'All core libraries are present' };
    });
  }

  async validateJonathanDemoExpressions() {
    return this.runTest('Jonathan-Demo Expressions Validation', async () => {
      // Check for jonathan-demo manifest file
      const manifestFile = 'public/examples/jonathan-demo-expressions-manifest.json';
      
      if (!existsSync(manifestFile)) {
        return { 
          success: false, 
          error: 'Jonathan-demo expressions manifest not found' 
        };
      }

      const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
      
      if (!manifest.expressions || manifest.expressions.length === 0) {
        return { 
          success: false, 
          error: 'Jonathan-demo manifest has no expressions' 
        };
      }

      // Validate expression structure
      const requiredFields = ['filename', 'type', 'tone', 'priority'];
      const invalidExpressions = manifest.expressions.filter(expr => 
        requiredFields.some(field => !(field in expr))
      );

      if (invalidExpressions.length > 0) {
        return { 
          success: false, 
          error: `Invalid expression entries in manifest: ${invalidExpressions.length}` 
        };
      }

      // Check for admin management page
      const adminPage = 'src/app/admin/expressions/jonathan-demo/page.tsx';
      if (!existsSync(adminPage)) {
        return { 
          success: false, 
          error: 'Jonathan-demo admin page not found' 
        };
      }

      return { 
        success: true, 
        message: `Jonathan-demo has ${manifest.expressions.length} expressions configured` 
      };
    });
  }

  async validateFeatureFlagIntegration() {
    return this.runTest('Feature Flag Integration Validation', async () => {
      const filesToCheck = [
        'src/app/voice-expressions/page.tsx',
        'src/app/api/expressions/upload/route.ts',
        'src/lib/hooks/useExpressionPack.ts',
        'src/lib/expressionScheduler.ts'
      ];

      const filesWithoutFlags = filesToCheck.filter(file => {
        if (!existsSync(file)) return true;
        const content = readFileSync(file, 'utf8');
        return !content.includes('FEATURE_VOICE_OVERLAYS');
      });

      if (filesWithoutFlags.length > 0) {
        return { 
          success: false, 
          error: `Files missing feature flag integration: ${filesWithoutFlags.join(', ')}` 
        };
      }

      return { success: true, message: 'Feature flag integration is complete' };
    });
  }

  async validateTestSuite() {
    return this.runTest('Test Suite Validation', async () => {
      try {
        // Run the comprehensive test suite
        this.log('Running expression test suite...', COLORS.YELLOW);
        
        const testCommand = 'npm run test -- src/lib/__tests__/e2e-validation.test.ts --run';
        const testOutput = execSync(testCommand, { 
          encoding: 'utf8',
          timeout: 30000 // 30 second timeout
        });

        if (testOutput.includes('FAIL') || testOutput.includes('Error')) {
          return { 
            success: false, 
            error: 'Test suite has failing tests' 
          };
        }

        return { success: true, message: 'All tests pass' };
      } catch (error) {
        return { 
          success: false, 
          error: `Test execution failed: ${error.message}` 
        };
      }
    });
  }

  async validatePerformanceBaseline() {
    return this.runTest('TTS Performance Baseline Validation', async () => {
      // Check if performance monitoring is integrated
      const performanceMonitor = 'src/lib/expressionPerformanceMonitor.ts';
      
      if (!existsSync(performanceMonitor)) {
        return { 
          success: false, 
          error: 'Performance monitor not found' 
        };
      }

      const monitorContent = readFileSync(performanceMonitor, 'utf8');
      const requiredMetrics = [
        'first_audio_ms',
        'tts_total_ms',
        'overlays_count',
        'expression_overhead_ms'
      ];

      const missingMetrics = requiredMetrics.filter(metric => 
        !monitorContent.includes(metric)
      );

      if (missingMetrics.length > 0) {
        return { 
          success: false, 
          error: `Missing performance metrics: ${missingMetrics.join(', ')}` 
        };
      }

      return { success: true, message: 'Performance monitoring is properly configured' };
    });
  }

  async validateEnvironmentConfiguration() {
    return this.runTest('Environment Configuration Validation', async () => {
      // Check for environment variable documentation
      const envExample = '.env.example';
      
      if (!existsSync(envExample)) {
        return { 
          success: false, 
          error: '.env.example file not found' 
        };
      }

      const envContent = readFileSync(envExample, 'utf8');
      
      if (!envContent.includes('FEATURE_VOICE_OVERLAYS')) {
        return { 
          success: false, 
          error: 'FEATURE_VOICE_OVERLAYS not documented in .env.example' 
        };
      }

      // Check current environment
      const currentFeatureFlag = process.env.FEATURE_VOICE_OVERLAYS;
      
      return { 
        success: true, 
        message: `Feature flag currently: ${currentFeatureFlag || 'undefined'}` 
      };
    });
  }

  async runAllValidations() {
    this.log('\n🚀 Starting Authentic Expressions Pipeline Deployment Validation\n', COLORS.BLUE);

    // Run all validation tests
    await this.validateDatabaseSchema();
    await this.validateAPIEndpoints();
    await this.validateUIComponents();
    await this.validateCoreLibraries();
    await this.validateJonathanDemoExpressions();
    await this.validateFeatureFlagIntegration();
    await this.validateTestSuite();
    await this.validatePerformanceBaseline();
    await this.validateEnvironmentConfiguration();

    // Print summary
    this.printSummary();
  }

  printSummary() {
    this.log('\n📊 VALIDATION SUMMARY', COLORS.BLUE);
    this.log('='.repeat(50), COLORS.BLUE);
    
    this.log(`✅ Passed: ${this.results.passed}`, COLORS.GREEN);
    this.log(`❌ Failed: ${this.results.failed}`, COLORS.RED);
    
    if (this.results.warnings > 0) {
      this.log(`⚠️  Warnings: ${this.results.warnings}`, COLORS.YELLOW);
    }

    const totalTests = this.results.passed + this.results.failed;
    const successRate = ((this.results.passed / totalTests) * 100).toFixed(1);
    
    this.log(`\n📈 Success Rate: ${successRate}%`, 
      successRate >= 90 ? COLORS.GREEN : successRate >= 70 ? COLORS.YELLOW : COLORS.RED
    );

    if (this.results.failed === 0) {
      this.log('\n🎉 All validations passed! The Authentic Expressions Pipeline is ready for deployment.', COLORS.GREEN);
    } else {
      this.log('\n⚠️  Some validations failed. Please address the issues before deployment.', COLORS.RED);
      
      // List failed tests
      const failedTests = this.results.tests.filter(test => !test.success);
      if (failedTests.length > 0) {
        this.log('\nFailed Tests:', COLORS.RED);
        failedTests.forEach(test => {
          this.log(`  • ${test.name}: ${test.error}`, COLORS.RED);
        });
      }
    }

    // Exit with appropriate code
    process.exit(this.results.failed === 0 ? 0 : 1);
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new DeploymentValidator();
  validator.runAllValidations().catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}

export { DeploymentValidator };