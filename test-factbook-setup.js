#!/usr/bin/env node

/**
 * Quick test to verify factbook setup
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Testing factbook setup...');

// Test 1: Check if factbook file exists at correct path
const factbookPath = path.join(process.cwd(), 'data/jonathan_profile_factbook.json');
console.log(`📁 Checking factbook path: ${factbookPath}`);

if (fs.existsSync(factbookPath)) {
  console.log('✅ Factbook file exists');
  
  try {
    const content = fs.readFileSync(factbookPath, 'utf-8');
    const data = JSON.parse(content);
    
    // Count snippets
    let snippetCount = 0;
    for (const section of Object.values(data)) {
      if (typeof section === 'object' && section !== null) {
        for (const item of Object.values(section)) {
          if (typeof item === 'object' && item !== null && 'id' in item) {
            snippetCount++;
          }
        }
      }
    }
    
    console.log(`✅ Factbook loaded successfully: ${snippetCount} snippets`);
  } catch (error) {
    console.log(`❌ Factbook parse error: ${error.message}`);
  }
} else {
  console.log('❌ Factbook file not found');
}

// Test 2: Check environment variable
const factbookOnly = process.env.ECHOSTONE_FACTBOOK_ONLY;
console.log(`🔧 ECHOSTONE_FACTBOOK_ONLY: ${factbookOnly || 'not set'}`);

console.log('\n🎯 Setup verification complete');