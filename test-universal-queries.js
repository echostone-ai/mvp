// Test various types of queries to ensure the intelligent memory retriever works universally
require('dotenv').config({ path: '.env.local' });

const testQueries = [
  "have you ever been married?",
  "tell me about your dog",
  "where did you grow up?",
  "what's your favorite hobby?",
  "do you have any siblings?",
  "what do you do for work?",
  "have you traveled anywhere interesting?"
];

async function testUniversalQueries() {
  console.log('=== Testing Universal Query Handling ===\n');

  const demoUrl = 'http://localhost:3000/api/demo-chat';

  for (const query of testQueries) {
    console.log(`\n--- Testing: "${query}" ---`);
    
    try {
      const response = await fetch(demoUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: query,
          avatar: 'jonathan_braden',
          debug: true
        })
      });

      if (!response.ok) {
        console.error(`❌ HTTP Error: ${response.status}`);
        continue;
      }

      const result = await response.json();
      
      console.log(`Response: ${result.text.substring(0, 150)}...`);
      console.log(`Memories found: ${result.metadata?.memories_count || 0}`);
      console.log(`Processing time: ${result.metadata?.processing_time_ms || 'N/A'}ms`);
      
      // Check if response seems relevant
      const queryLower = query.toLowerCase();
      const responseLower = result.text.toLowerCase();
      
      let relevanceCheck = '🤔 UNCLEAR';
      if (queryLower.includes('married') && (responseLower.includes('married') || responseLower.includes('tia'))) {
        relevanceCheck = '✅ RELEVANT';
      } else if (queryLower.includes('dog') && (responseLower.includes('dog') || responseLower.includes('romeo'))) {
        relevanceCheck = '✅ RELEVANT';
      } else if (queryLower.includes('work') && (responseLower.includes('work') || responseLower.includes('writer') || responseLower.includes('writing'))) {
        relevanceCheck = '✅ RELEVANT';
      } else if (queryLower.includes('sibling') && (responseLower.includes('brother') || responseLower.includes('sister') || responseLower.includes('family'))) {
        relevanceCheck = '✅ RELEVANT';
      } else if (result.text.length > 20) {
        relevanceCheck = '✅ RESPONDED';
      }
      
      console.log(`Relevance: ${relevanceCheck}`);
      
    } catch (error) {
      console.error(`❌ Request failed: ${error.message}`);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

testUniversalQueries();