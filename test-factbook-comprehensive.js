// Comprehensive test of the enriched factbook
const fetch = require('node-fetch');

async function testEnrichedFactbookIntegration() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('🧪 Testing Enriched Factbook Integration\n');
  
  const testCases = [
    {
      category: "Friends & Relationships",
      queries: [
        { q: "Who is Tyler?", expect: ["tyler", "mccoy", "austin", "yoga"] },
        { q: "Tell me about Eric", expect: ["eric", "new york", "actor", "clown"] },
        { q: "Who is Carter?", expect: ["carter", "austin", "musician", "wheatsville"] },
        { q: "Tell me about Matheus", expect: ["matheus", "brazil", "dubai", "crypto"] }
      ]
    },
    {
      category: "Pets & Animals", 
      queries: [
        { q: "Tell me about Romeo", expect: ["romeo", "poodle", "valentine", "2024"] },
        { q: "Who was Bucky?", expect: ["bucky", "poodle", "childhood", "leash"] },
        { q: "Tell me about Olive", expect: ["olive", "puerto rican", "smartest", "2015"] },
        { q: "Who are Gus and Una?", expect: ["gus", "una", "france", "parents"] }
      ]
    },
    {
      category: "Places & Timeline",
      queries: [
        { q: "Where did you live in 2008?", expect: ["austin", "texas", "2008", "2018"] },
        { q: "Tell me about your time in Maine", expect: ["maine", "1994", "2008", "tia"] },
        { q: "Where in Europe have you lived?", expect: ["europe", "sofia", "valencia", "prague"] },
        { q: "Tell me about Sofia", expect: ["sofia", "bulgaria", "vitosha", "mountain"] }
      ]
    },
    {
      category: "Projects & Interests",
      queries: [
        { q: "What is Echostone?", expect: ["echostone", "ai", "platform", "memorials"] },
        { q: "Tell me about your museum", expect: ["museum", "curiosities", "hindenburg", "artifacts"] },
        { q: "What music do you like?", expect: ["music", "beatles", "hendrix", "doors"] },
        { q: "What are your hobbies?", expect: ["hobbies", "guitar", "cooking", "hiking"] }
      ]
    },
    {
      category: "Opinions & Politics",
      queries: [
        { q: "What do you think about Trump?", expect: ["trump", "politics", "america", "protest"] },
        { q: "What's your opinion on Putin?", expect: ["putin", "ukraine", "russia"] },
        { q: "What do you think about female leadership?", expect: ["female", "leadership", "women"] },
        { q: "What's your view on society?", expect: ["society", "phones", "influencers"] }
      ]
    },
    {
      category: "Memories & Experiences",
      queries: [
        { q: "Tell me about ACL", expect: ["acl", "red hot", "chili peppers", "celebrities"] },
        { q: "Have you met any celebrities?", expect: ["celebrities", "ryan gosling", "thom yorke"] },
        { q: "Tell me about your boat parties", expect: ["boat", "parties", "electric", "aquatic"] },
        { q: "What about your snake bite?", expect: ["snake", "bite", "adventure"] }
      ]
    }
  ];
  
  let totalTests = 0;
  let passedTests = 0;
  
  for (const category of testCases) {
    console.log(`\n📂 ${category.category}`);
    console.log('=' .repeat(50));
    
    for (const test of category.queries) {
      totalTests++;
      
      try {
        const response = await fetch(`${baseUrl}/api/demo-chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: test.q,
            visitorId: "test-comprehensive",
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
          console.log(`   Found: ${foundKeywords.join(', ')}`);
        } else {
          console.log(`❌ "${test.q}"`);
          console.log(`   Expected: ${test.expect.join(', ')}`);
          console.log(`   Found: ${foundKeywords.join(', ')}`);
          console.log(`   Answer: ${answer.substring(0, 100)}...`);
        }
        
        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.log(`❌ "${test.q}" - Error: ${error.message}`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`📊 RESULTS: ${passedTests}/${totalTests} tests passed (${Math.round(passedTests/totalTests*100)}%)`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Enriched factbook is working perfectly!');
  } else if (passedTests / totalTests >= 0.8) {
    console.log('✅ Most tests passed! Enriched factbook is working well!');
  } else {
    console.log('⚠️  Some tests failed. Factbook may need further refinement.');
  }
}

testEnrichedFactbookIntegration().catch(console.error);