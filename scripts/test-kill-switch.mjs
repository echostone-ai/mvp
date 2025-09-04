#!/usr/bin/env node

/**
 * Test script for factbook kill switch functionality
 * Usage: node scripts/test-kill-switch.mjs [action] [reason]
 * Actions: status, disable_factbook, force_fallback, emergency_disable, clear
 */

import { config } from 'dotenv';
config();

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

if (!ADMIN_API_KEY) {
  console.error('❌ ADMIN_API_KEY not found in environment variables');
  process.exit(1);
}

const action = process.argv[2] || 'status';
const reason = process.argv[3] || 'Test from CLI script';

async function testKillSwitch() {
  try {
    console.log(`🔧 Testing kill switch: ${action}`);
    console.log(`📍 Base URL: ${BASE_URL}`);
    
    let response;
    
    if (action === 'status') {
      // GET request to check status
      response = await fetch(`${BASE_URL}/api/admin/kill-switch`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${ADMIN_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });
    } else {
      // POST request to execute action
      response = await fetch(`${BASE_URL}/api/admin/kill-switch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ADMIN_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          reason,
        }),
      });
    }

    if (!response.ok) {
      console.error(`❌ HTTP ${response.status}: ${response.statusText}`);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      return;
    }

    const result = await response.json();
    
    console.log('✅ Kill switch response:');
    console.log(JSON.stringify(result, null, 2));
    
    // Test the feature flag state
    console.log('\n📊 Feature Flag Summary:');
    console.log(`  Factbook Enabled: ${result.current_flags?.factbookEnabled || result.updated_flags?.factbookEnabled}`);
    console.log(`  Fallback Pipeline Enabled: ${result.current_flags?.fallbackPipelineEnabled || result.updated_flags?.fallbackPipelineEnabled}`);
    console.log(`  Should Use Factbook: ${result.should_use_factbook}`);
    console.log(`  Should Use Legacy: ${result.should_use_legacy}`);
    
    if (result.kill_switch_status) {
      console.log('\n🚨 Kill Switch Active:');
      console.log(`  Factbook Disabled: ${result.kill_switch_status.factbookDisabled}`);
      console.log(`  Force Fallback: ${result.kill_switch_status.forceFallback}`);
      console.log(`  Reason: ${result.kill_switch_status.reason}`);
      console.log(`  Timestamp: ${new Date(result.kill_switch_status.timestamp).toISOString()}`);
    } else {
      console.log('\n✅ No kill switch active');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Show usage if invalid action
const validActions = ['status', 'disable_factbook', 'force_fallback', 'emergency_disable', 'clear'];
if (!validActions.includes(action)) {
  console.log('Usage: node scripts/test-kill-switch.mjs [action] [reason]');
  console.log('Actions:');
  console.log('  status           - Get current kill switch status');
  console.log('  disable_factbook - Disable factbook system');
  console.log('  force_fallback   - Force fallback to legacy system');
  console.log('  emergency_disable- Emergency disable (both flags)');
  console.log('  clear           - Clear kill switch');
  console.log('\nExample: node scripts/test-kill-switch.mjs disable_factbook "Testing rollback"');
  process.exit(1);
}

testKillSwitch();