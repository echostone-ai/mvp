// Test the actual demo chat flow for marriage question
require('dotenv').config({ path: '.env.local' });

async function testMarriageDemo() {
  console.log('=== Testing Marriage Demo Flow ===\n');

  const demoUrl = 'http://localhost:3000/api/demo-chat';
  const marriageQuestion = 'have you ever been married?';

  console.log(`Testing question: "${marriageQuestion}"`);
  console.log(`Demo URL: ${demoUrl}`);

  try {
    const response = await fetch(demoUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: marriageQuestion,
        avatar: 'jonathan_braden',
        debug: true // Enable debug mode to see what's happening
      })
    });

    if (!response.ok) {
      console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return;
    }

    const result = await response.json();
    
    console.log('\n=== RESPONSE ===');
    console.log('Text:', result.text);
    
    if (result.debug) {
      console.log('\n=== DEBUG INFO ===');
      console.log('Memories found:', result.debug.memories_found || 'Not provided');
      console.log('Facts found:', result.debug.facts_found || 'Not provided');
      console.log('Model used:', result.debug.model_used);
      console.log('Prompt preview:', result.debug.promptPreview?.substring(0, 500) + '...');
      
      if (result.debug.memory_retrieval) {
        console.log('\nMemory retrieval details:');
        console.log(JSON.stringify(result.debug.memory_retrieval, null, 2));
      }
    }

    if (result.metadata) {
      console.log('\n=== METADATA ===');
      console.log(JSON.stringify(result.metadata, null, 2));
    }

    // Check if the response mentions being married or dodging bullets
    const responseText = result.text.toLowerCase();
    if (responseText.includes('dodged that bullet') || responseText.includes('never been married')) {
      console.log('\n❌ ISSUE CONFIRMED: Response incorrectly says not married');
    } else if (responseText.includes('married') || responseText.includes('tia')) {
      console.log('\n✅ GOOD: Response mentions marriage or Tia');
    } else {
      console.log('\n🤔 UNCLEAR: Response doesn\'t clearly address marriage');
    }

  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

testMarriageDemo();