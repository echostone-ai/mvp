// Simple intent detection test
const IntentPatterns = {
  people: /\b(tyler|friend|friends|family|mom|dad|mother|father|brother|sister|girlfriend|boyfriend|partner|spouse|wife|husband|where does|how is|tell me about [A-Z][a-z]+)\b/i,
  pets: /\b(dog|dogs|pet|pets|cat|cats|animal|animals|romeo|bucky|george|olive|poodle)\b/i,
  opinion: /\b(think|opinion|feel|believe|view|trump|biden|political|politics|america|emigration|immigration)\b/i
};

function detectIntent(query) {
  const queryLower = query.toLowerCase();
  
  for (const [intent, pattern] of Object.entries(IntentPatterns)) {
    if (pattern.test(queryLower)) {
      return intent;
    }
  }
  
  return null;
}

const queries = [
  'Where does your friend Tyler live?',
  'Tell me about Olive.',
  'What do you think of Trump?'
];

console.log('🧪 Testing Intent Detection');
console.log('=' .repeat(40));

queries.forEach(query => {
  const intent = detectIntent(query);
  console.log(`"${query}" -> ${intent || 'none'}`);
});