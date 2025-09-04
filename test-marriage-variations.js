// Test different marriage-related questions
require('dotenv').config({ path: '.env.local' });

const questions = [
  'have you ever been married?',
  'are you married?',
  'were you married?',
  'tell me about your marriage',
  'who is Tia?',
  'what about your relationship with Tia?'
];

async function testMarriageVariations() {
  console.log('=== Testing Marriage Question Variations ===\n');

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    console.log(`${i + 1}. Testing: "${question}"`);
    
    try {
      const response = await fetch('http://localhost:3000/api/demo-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: question,
          avatar: 'jonathan_braden'
        })
      });

      if (response.ok) {
        const result = await response.json();
        const text = result.text.toLowerCase();
        
        if (text.includes('tia') || text.includes('married') || text.includes('marriage')) {
          console.log('✅ GOOD: Mentions marriage/Tia');
        } else if (text.includes('never') || text.includes('not married') || text.includes('dodged')) {
          console.log('❌ BAD: Says not married');
        } else {
          console.log('🤔 UNCLEAR: Ambiguous response');
        }
        
        console.log(`Response: "${result.text.substring(0, 100)}..."`);
      } else {
        console.log('❌ Request failed');
      }
    } catch (error) {
      console.log('❌ Error:', error.message);
    }
    
    console.log('');
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

testMarriageVariations();