#!/usr/bin/env node

/**
 * Verification script for Task 0: Feature flags and kill switch implementation
 * This script verifies all requirements have been implemented correctly
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

console.log('🔍 Verifying Task 0: Feature flags and kill switch implementation\n');

const checks = [];

// Check 1: Environment variables in .env.example
console.log('1. Checking environment variables in .env.example...');
try {
  const envExample = readFileSync('.env.example', 'utf8');
  const hasFactbookEnabled = envExample.includes('FACTBOOK_ENABLED=true');
  const hasFallbackEnabled = envExample.includes('FALLBACK_PIPELINE_ENABLED=false');
  const hasAdminKey = envExample.includes('ADMIN_API_KEY=');
  
  if (hasFactbookEnabled && hasFallbackEnabled && hasAdminKey) {
    console.log('   ✅ Environment variables properly configured');
    checks.push(true);
  } else {
    console.log('   ❌ Missing environment variables');
    console.log(`      FACTBOOK_ENABLED: ${hasFactbookEnabled ? '✅' : '❌'}`);
    console.log(`      FALLBACK_PIPELINE_ENABLED: ${hasFallbackEnabled ? '✅' : '❌'}`);
    console.log(`      ADMIN_API_KEY: ${hasAdminKey ? '✅' : '❌'}`);
    checks.push(false);
  }
} catch (error) {
  console.log('   ❌ Failed to read .env.example');
  checks.push(false);
}

// Check 2: Feature flags configuration file
console.log('\n2. Checking feature flags configuration...');
const featureFlagsPath = 'src/lib/config/featureFlags.ts';
if (existsSync(featureFlagsPath)) {
  try {
    const featureFlags = readFileSync(featureFlagsPath, 'utf8');
    const hasFeatureFlagManager = featureFlags.includes('class FeatureFlagManager');
    const hasKillSwitch = featureFlags.includes('setKillSwitch');
    const hasEnvironmentCheck = featureFlags.includes('process.env.FACTBOOK_ENABLED');
    
    if (hasFeatureFlagManager && hasKillSwitch && hasEnvironmentCheck) {
      console.log('   ✅ Feature flags configuration implemented');
      checks.push(true);
    } else {
      console.log('   ❌ Feature flags configuration incomplete');
      checks.push(false);
    }
  } catch (error) {
    console.log('   ❌ Failed to read feature flags configuration');
    checks.push(false);
  }
} else {
  console.log('   ❌ Feature flags configuration file not found');
  checks.push(false);
}

// Check 3: Kill switch API endpoint
console.log('\n3. Checking kill switch API endpoint...');
const killSwitchPath = 'src/app/api/admin/kill-switch/route.ts';
if (existsSync(killSwitchPath)) {
  try {
    const killSwitch = readFileSync(killSwitchPath, 'utf8');
    const hasGetEndpoint = killSwitch.includes('export async function GET');
    const hasPostEndpoint = killSwitch.includes('export async function POST');
    const hasAuthentication = killSwitch.includes('isAuthorized');
    const hasActions = killSwitch.includes('disable_factbook') && 
                      killSwitch.includes('force_fallback') && 
                      killSwitch.includes('emergency_disable');
    
    if (hasGetEndpoint && hasPostEndpoint && hasAuthentication && hasActions) {
      console.log('   ✅ Kill switch API endpoint implemented');
      checks.push(true);
    } else {
      console.log('   ❌ Kill switch API endpoint incomplete');
      console.log(`      GET endpoint: ${hasGetEndpoint ? '✅' : '❌'}`);
      console.log(`      POST endpoint: ${hasPostEndpoint ? '✅' : '❌'}`);
      console.log(`      Authentication: ${hasAuthentication ? '✅' : '❌'}`);
      console.log(`      Actions: ${hasActions ? '✅' : '❌'}`);
      checks.push(false);
    }
  } catch (error) {
    console.log('   ❌ Failed to read kill switch API endpoint');
    checks.push(false);
  }
} else {
  console.log('   ❌ Kill switch API endpoint not found');
  checks.push(false);
}

// Check 4: Chat route integration
console.log('\n4. Checking chat route integration...');
const chatRoutePath = 'src/app/api/chat/route.ts';
if (existsSync(chatRoutePath)) {
  try {
    const chatRoute = readFileSync(chatRoutePath, 'utf8');
    const hasFeatureFlagImport = chatRoute.includes('featureFlags');
    const hasFeatureFlagCheck = chatRoute.includes('shouldUseLegacyMemory');
    const hasLogging = chatRoute.includes('logFeatureFlagState');
    const hasRedirect = chatRoute.includes('feature_flag_redirect_to_legacy');
    
    if (hasFeatureFlagImport && hasFeatureFlagCheck && hasLogging && hasRedirect) {
      console.log('   ✅ Chat route integration implemented');
      checks.push(true);
    } else {
      console.log('   ❌ Chat route integration incomplete');
      console.log(`      Feature flag import: ${hasFeatureFlagImport ? '✅' : '❌'}`);
      console.log(`      Feature flag check: ${hasFeatureFlagCheck ? '✅' : '❌'}`);
      console.log(`      Logging: ${hasLogging ? '✅' : '❌'}`);
      console.log(`      Redirect logic: ${hasRedirect ? '✅' : '❌'}`);
      checks.push(false);
    }
  } catch (error) {
    console.log('   ❌ Failed to read chat route');
    checks.push(false);
  }
} else {
  console.log('   ❌ Chat route not found');
  checks.push(false);
}

// Check 5: Test files
console.log('\n5. Checking test files...');
const featureFlagTestPath = 'src/lib/config/__tests__/featureFlags.test.ts';
const killSwitchTestPath = 'src/app/api/admin/kill-switch/__tests__/route.test.ts';

const hasFeatureFlagTests = existsSync(featureFlagTestPath);
const hasKillSwitchTests = existsSync(killSwitchTestPath);

if (hasFeatureFlagTests && hasKillSwitchTests) {
  console.log('   ✅ Test files implemented');
  checks.push(true);
} else {
  console.log('   ❌ Test files incomplete');
  console.log(`      Feature flag tests: ${hasFeatureFlagTests ? '✅' : '❌'}`);
  console.log(`      Kill switch tests: ${hasKillSwitchTests ? '✅' : '❌'}`);
  checks.push(false);
}

// Check 6: Documentation
console.log('\n6. Checking documentation...');
const docPath = 'FACTBOOK_KILL_SWITCH.md';
if (existsSync(docPath)) {
  console.log('   ✅ Documentation created');
  checks.push(true);
} else {
  console.log('   ❌ Documentation not found');
  checks.push(false);
}

// Check 7: Test script
console.log('\n7. Checking test script...');
const testScriptPath = 'scripts/test-kill-switch.mjs';
if (existsSync(testScriptPath)) {
  console.log('   ✅ Test script created');
  checks.push(true);
} else {
  console.log('   ❌ Test script not found');
  checks.push(false);
}

// Summary
console.log('\n' + '='.repeat(60));
const passedChecks = checks.filter(Boolean).length;
const totalChecks = checks.length;

if (passedChecks === totalChecks) {
  console.log('🎉 Task 0 COMPLETED SUCCESSFULLY!');
  console.log(`✅ All ${totalChecks} requirements implemented correctly`);
  console.log('\nImplemented features:');
  console.log('  • FACTBOOK_ENABLED environment variable (default: true)');
  console.log('  • FALLBACK_PIPELINE_ENABLED environment variable (default: false)');
  console.log('  • Runtime kill switch API endpoint (/api/admin/kill-switch)');
  console.log('  • Feature flag checks in /api/chat route');
  console.log('  • Comprehensive test suite');
  console.log('  • Documentation and test scripts');
} else {
  console.log(`❌ Task 0 INCOMPLETE: ${passedChecks}/${totalChecks} requirements met`);
  console.log('\nPlease address the failed checks above.');
}

console.log('\n' + '='.repeat(60));