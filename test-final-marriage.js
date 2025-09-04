// Final test of marriage fix with debug mode
require('dotenv').config({ path: '.env.local' });

async function testFinalMarriage() {
  console.log('=== Final Marriage Fix Test ===\n');

  const questions = [
    'have you ever been married?',
    'are you married?', 
    'who is Tia?'
  ];

  for (const question of questions) {
    console.log(`Testing: "${question}"`);
    
    try {
      const response = await fetch('http://localhost:3000/api/demo-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: question,
          avatar: 'jonathan_braden',
          debug: true // Get JSON response
        })
      });

      if (response.ok) {
        const result = await response.json();
        const text = result.text.toLowerCase();
        
        console.log(`Memories found: ${result.metadata?.memories_count || 0}`);
        
        if (text.includes('tia') || (text.includes('married') && !text.includes('never'))) {
          console.log('✅ CORRECT: Mentions marriage/Tia appropriately');
        } else if (text.includes('never') || text.includes('not married') || text.includes('dodged')) {
          console.log('❌ INCORRECT: Says not married');
        } else {
          console.log('🤔 UNCLEAR: Ambiguous response');
        }
        
        console.log(`Response: "${result.text}"`);
      } else {
        console.log('❌ Request failed');
      }
    } catch (error) {
      console.log('❌ Error:', error.message);
    }
    
    console.log('');
  }
}

testFinalMarriage();