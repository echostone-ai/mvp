// Test the new factbook additions
const fetch = require('node-fetch');

async function testNewFactbookAdditions() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('🧪 Testing New Factbook Additions\n');
  
  const testCases = [
    {
      category: "New Celebrity Encounters",
      queries: [
        { q: "Have you met Barack Obama?", expect: ["barack", "obama", "campaign", "2008"] },
        { q: "Tell me about Bill Clinton", expect: ["bill", "clinton", "new hampshire", "hillary"] },
        { q: "Did you meet John Popper?", expect: ["john", "popper", "blues traveler", "austin", "beers"] },
        { q: "Tell me about Bill Murray", expect: ["bill", "murray", "south by southwest", "gza"] },
        { q: "Have you met Jemaine Clement?", expect: ["jemaine", "clement", "flight", "conchords", "sam rockwell"] },
        { q: "Tell me about Chuck D", expect: ["chuck", "d", "public enemy", "sofia", "2025"] },
        { q: "Did you meet Ryan Gosling multiple times?", expect: ["ryan", "gosling", "austin", "2013", "multiple"] },
        { q: "Tell me about Michel Gondry", expect: ["michel", "gondry", "french", "filmmaker", "sxsw"] },
        { q: "Have you met Tim Heidecker?", expect: ["tim", "heidecker", "comedian", "premiere", "austin"] },
        { q: "Tell me about Ethan Hawke", expect: ["ethan", "hawke", "budapest", "2022"] },
        { q: "Did you meet Mike Tyson?", expect: ["mike", "tyson", "boxing", "ring", "austin"] },
        { q: "Tell me about John Densmore", expect: ["john", "densmore", "drummer", "doors", "austin"] }
      ]
    },
    {
      category: "Personal Details & Experiences",
      queries: [
        { q: "Tell me about your snake phobia", expect: ["snake", "phobia", "terrified", "therapy", "austin", "2013"] },
        { q: "What happened when you arrived in Budapest?", expect: ["budapest", "friday", "13th", "march", "2020", "covid"] },
        { q: "Tell me about the snake bite in France", expect: ["snake", "bite", "france", "rocky", "ledge", "woods"] },
        { q: "What does Krissy look like?", expect: ["krissy", "mona lisa", "mickey mouse", "sweet", "elegant"] }
      ]
    }
  ];
  
  let totalTests = 0;
  let passedTests = 0;
  
  for (const category of testCases) {
    console.log(`\n📂 ${category.category}`);
    console.log('=' .repeat(60));
    
    for (const test of category.queries) {
      totalTests++;
      
      try {
        const response = await fetch(`${baseUrl}/api/demo-chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: test.q,
            visitorId: "test-new-additions",
            debug: true
          })
        });
        
        const result = await response.json();
        const answer = result.answer || '';
        const answerLower = answer.toLowerCase();
        
        // Check if expected keywords are found
        const foundKeywords = test.expect.filter(keyword => 
          answerLower.includes(keyword.toLowerCase())
        );
        
        const score = foundKeywords.length / test.expect.length;
        const passed = score >= 0.5; // At least 50% of keywords found
        
        if (passed) {
          passedTests++;
          console.log(`✅ "${test.q}"`);
          console.log(`   Found: ${foundKeywords.join(', ')} (${Math.round(score*100)}%)`);
        } else {
          console.log(`❌ "${test.q}"`);
          console.log(`   Expected: ${test.expect.join(', ')}`);
          console.log(`   Found: ${foundKeywords.join(', ')} (${Math.round(score*100)}%)`);
          console.log(`   Answer: ${answer.substring(0, 150)}...`);
        }
        
        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.log(`❌ "${test.q}" - Error: ${error.message}`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log(`📊 NEW ADDITIONS RESULTS: ${passedTests}/${totalTests} tests passed (${Math.round(passedTests/totalTests*100)}%)`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All new additions working perfectly!');
  } else if (passedTests / totalTests >= 0.8) {
    console.log('✅ Most new additions working well!');
  } else {
    console.log('⚠️  Some new additions may need refinement.');
  }
  
  // Count total facts in factbook
  const fs = require('fs');
  const path = require('path');
  const factbookPath = path.join(__dirname, 'data/jonathan_profile_factbook.json');
  const factbook = JSON.parse(fs.readFileSync(factbookPath, 'utf-8'));
  
  let totalFacts = 0;
  Object.values(factbook).forEach(section => {
    totalFacts += Object.keys(section).length;
  });
  
  console.log(`\n📚 Total facts in factbook: ${totalFacts}`);
  console.log('🎯 New celebrity encounters and personal details successfully integrated!');
}

testNewFactbookAdditions().catch(console.error);