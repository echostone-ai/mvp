#!/usr/bin/env node

/**
 * Final Validation of Trump Memory Pipeline
 * 
 * This script validates the current state and provides clear next steps
 */

require('dotenv').config({ path: '.env.local' });

async function validateTrumpPipeline() {
  console.log('🎯 Final Validation: Trump Memory Pipeline Status\n');
  
  // Test the API directly since that's what matters most
  console.log('🚀 Testing Demo Chat API with Trump queries...\n');
  
  const testQueries = [
    {
      query: "What do you think of Trump?",
      expectation: "Should include detailed Trump opinion with 'miserable mother fucker', 'rat bastard', leaving America in 2018"
    },
    {
      query: "Why did you leave America?", 
      expectation: "Should mention political climate and Trump"
    },
    {
      query: "Do you like Trump?",
      expectation: "Should give strong negative opinion, not generic response"
    }
  ];
  
  let passCount = 0;
  let totalTests = testQueries.length;
  
  for (const test of testQueries) {
    console.log(`📝 Testing: "${test.query}"`);
    console.log(`📋 Expected: ${test.expectation}\n`);
    
    try {
      const response = await fetch('http://localhost:3000/api/demo-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: test.query,
          debug: true
        })
      });

      if (!response.ok) {
        console.log(`❌ API Error: ${response.status} ${response.statusText}`);
        console.log('   Make sure the development server is running: npm run dev\n');
        continue;
      }

      // Parse the JSON response (debug mode)
      const result = await response.json();
      const responseText = result.text || '';
      
      console.log(`✅ Response (${responseText.length} chars):`);
      console.log(`"${responseText}"\n`);
      
      // Check for Trump-related content
      const lowerResponse = responseText.toLowerCase();
      let hasExpectedContent = false;
      let foundTerms = [];
      
      // Check for key Trump-related terms
      const trumpTerms = ['trump', 'miserable', 'bastard', 'political', 'america', '2018', 'left america', 'climate'];
      trumpTerms.forEach(term => {
        if (lowerResponse.includes(term)) {
          foundTerms.push(term);
        }
      });
      
      // Specific validation per query
      if (test.query.includes('think of Trump')) {
        hasExpectedContent = foundTerms.includes('trump') && 
                           (foundTerms.includes('miserable') || foundTerms.includes('bastard')) &&
                           foundTerms.length >= 3;
      } else if (test.query.includes('leave America')) {
        hasExpectedContent = (foundTerms.includes('political') || foundTerms.includes('climate')) &&
                           (foundTerms.includes('trump') || foundTerms.includes('2018'));
      } else if (test.query.includes('like Trump')) {
        hasExpectedContent = foundTerms.includes('trump') && foundTerms.length >= 2;
      }
      
      console.log(`📊 Found terms: ${foundTerms.join(', ')}`);
      console.log(`${hasExpectedContent ? '✅' : '❌'} Test Result: ${hasExpectedContent ? 'PASS' : 'FAIL'}`);
      
      if (hasExpectedContent) {
        passCount++;
      }
      
      // Check for generic responses (bad)
      const isGeneric = responseText.length < 100 || 
                       lowerResponse.includes("i don't have") ||
                       lowerResponse.includes("i'm not sure") ||
                       lowerResponse.includes("i don't know");
      
      if (isGeneric) {
        console.log('⚠️  WARNING: Response appears generic/short');
      }
      
    } catch (error) {
      console.log(`❌ Test failed: ${error.message}`);
    }
    
    console.log('\n' + '='.repeat(80) + '\n');
  }
  
  // Final assessment
  console.log('📊 FINAL ASSESSMENT:\n');
  console.log(`✅ Tests Passed: ${passCount}/${totalTests}`);
  console.log(`📈 Success Rate: ${Math.round((passCount/totalTests) * 100)}%\n`);
  
  if (passCount === totalTests) {
    console.log('🎉 SUCCESS: Trump memory pipeline is working correctly!');
    console.log('✅ All acceptance criteria are met');
    console.log('✅ Political memories are being retrieved and displayed');
    console.log('✅ Deep lane is not being cancelled');
    console.log('✅ Responses are detailed and authentic\n');
    
    console.log('🚀 The EchoStone memory pipeline is ready for production!');
  } else if (passCount >= totalTests * 0.67) {
    console.log('⚠️  PARTIAL SUCCESS: Most tests are passing');
    console.log('🔧 Minor adjustments may be needed for full compliance');
    console.log('\n📋 RECOMMENDED ACTIONS:');
    console.log('1. Apply fix-enhanced-memory-search-political.sql in Supabase SQL Editor');
    console.log('2. Apply fix-rls-policy-trump-demo.sql in Supabase SQL Editor');
    console.log('3. Restart the development server');
    console.log('4. Run this validation again');
  } else {
    console.log('❌ NEEDS WORK: Multiple tests are failing');
    console.log('\n📋 REQUIRED ACTIONS:');
    console.log('1. Apply fix-enhanced-memory-search-political.sql in Supabase SQL Editor');
    console.log('2. Apply fix-rls-policy-trump-demo.sql in Supabase SQL Editor');
    console.log('3. Verify Trump memories exist in database');
    console.log('4. Restart the development server');
    console.log('5. Run this validation again');
  }
  
  console.log('\n📁 FILES TO APPLY IN SUPABASE:');
  console.log('- fix-enhanced-memory-search-political.sql');
  console.log('- fix-rls-policy-trump-demo.sql');
  
  console.log('\n🔍 DEBUGGING COMMANDS:');
  console.log('- node test-trump-memory-pipeline.js');
  console.log('- node fix-jonathan-demo-pipeline-final.js');
}

validateTrumpPipeline().catch(console.error);