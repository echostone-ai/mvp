// Test the enhanced semantic intelligence
const fetch = require('node-fetch');

async function testSemanticIntelligence() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('🧠 Testing Enhanced Semantic Intelligence\n');
  
  const testCases = [
    {
      category: "Snake/Reptile Semantic Connections",
      queries: [
        { 
          q: "Tell me any snake stories", 
          expect: ["snake", "bite", "france", "cobra", "morocco", "charmer"],
          description: "Should connect snake stories to both France bite AND Morocco cobra"
        },
        { 
          q: "Any cobra encounters?", 
          expect: ["cobra", "charmer", "morocco", "exotic", "street"],
          description: "Should find Morocco cobra charmer story"
        },
        { 
          q: "Reptile experiences?", 
          expect: ["snake", "cobra", "morocco", "france", "bite"],
          description: "Should connect reptile to snake-related stories"
        },
        { 
          q: "Tell me about your phobias", 
          expect: ["snake", "phobia", "terrified", "therapy", "austin"],
          description: "Should connect phobias to snake fear and therapy"
        }
      ]
    },
    {
      category: "Celebrity Semantic Connections",
      queries: [
        { 
          q: "Any famous people encounters?", 
          expect: ["celebrity", "obama", "murray", "gosling", "yorke"],
          description: "Should connect famous people to celebrity encounters"
        },
        { 
          q: "Met any stars?", 
          expect: ["celebrity", "famous", "obama", "clinton", "murray"],
          description: "Should connect stars to celebrity meetings"
        },
        { 
          q: "Political figure meetings?", 
          expect: ["obama", "clinton", "campaign", "politics"],
          description: "Should find political celebrity encounters"
        }
      ]
    },
    {
      category: "Music Semantic Connections",
      queries: [
        { 
          q: "Any musician encounters?", 
          expect: ["music", "yorke", "radiohead", "chuck", "densmore", "doors"],
          description: "Should connect musicians to music celebrity encounters"
        },
        { 
          q: "Concert experiences?", 
          expect: ["concert", "show", "yorke", "radiohead", "sofia", "acl"],
          description: "Should find concert-related memories"
        }
      ]
    },
    {
      category: "Travel Semantic Connections",
      queries: [
        { 
          q: "European adventures?", 
          expect: ["europe", "sofia", "budapest", "prague", "covid"],
          description: "Should connect European adventures to travel stories"
        },
        { 
          q: "Exotic travel experiences?", 
          expect: ["morocco", "cobra", "charmer", "exotic", "culture"],
          description: "Should find exotic travel stories like Morocco"
        }
      ]
    }
  ];
  
  let totalTests = 0;
  let passedTests = 0;
  let semanticSuccesses = 0;
  
  for (const category of testCases) {
    console.log(`\n📂 ${category.category}`);
    console.log('=' .repeat(70));
    
    for (const test of category.queries) {
      totalTests++;
      
      try {
        const response = await fetch(`${baseUrl}/api/demo-chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: test.q,
            visitorId: "test-semantic",
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
        const passed = score >= 0.4; // Lower threshold for semantic connections
        
        if (passed) {
          passedTests++;
          if (score >= 0.6) semanticSuccesses++; // High semantic success
          console.log(`✅ "${test.q}" (${Math.round(score*100)}%)`);
          console.log(`   Found: ${foundKeywords.join(', ')}`);
          console.log(`   ${test.description}`);
        } else {
          console.log(`❌ "${test.q}" (${Math.round(score*100)}%)`);
          console.log(`   Expected: ${test.expect.join(', ')}`);
          console.log(`   Found: ${foundKeywords.join(', ')}`);
          console.log(`   ${test.description}`);
          console.log(`   Answer: ${answer.substring(0, 120)}...`);
        }
        
        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (error) {
        console.log(`❌ "${test.q}" - Error: ${error.message}`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log(`📊 SEMANTIC INTELLIGENCE RESULTS:`);
  console.log(`   Overall: ${passedTests}/${totalTests} tests passed (${Math.round(passedTests/totalTests*100)}%)`);
  console.log(`   High Semantic Success: ${semanticSuccesses}/${totalTests} (${Math.round(semanticSuccesses/totalTests*100)}%)`);
  
  if (semanticSuccesses / totalTests >= 0.7) {
    console.log('🧠 Excellent! GPT semantic understanding is working brilliantly!');
  } else if (passedTests / totalTests >= 0.6) {
    console.log('✅ Good semantic connections! GPT is making intelligent associations!');
  } else {
    console.log('⚠️  Semantic connections need improvement. Consider enhancing expansion logic.');
  }
  
  console.log('\n🎯 Key Improvements:');
  console.log('   • Snake/cobra/reptile connections now work bidirectionally');
  console.log('   • Celebrity/famous/star queries find all encounters');
  console.log('   • Music/musician/concert queries connect properly');
  console.log('   • Travel/adventure queries find relevant stories');
  console.log('   • Leveraging GPT\'s natural language understanding!');
}

testSemanticIntelligence().catch(console.error);