/**
 * Test specifically for "it's your brother!" detection
 */

// Mock the relationship data with updated info
const knownPeople = new Map([
  ['geoff', {
    name: 'Geoff Braden',
    nickname: 'Boris',
    relationship: 'family',
    personalDetails: [
      'older brother, 3 years older',
      'pilot living outside Denver, Colorado',
      'partner Georgette',
      'two sons Jason and Justin (Jonathan\'s nephews)',
      'French bulldog named Harley'
    ],
    greetingStyle: 'intimate',
    specificQuestions: [
      'How are Jason and Justin doing?',
      'How\'s Georgette?',
      'How\'s the flying going?',
      'How\'s Harley?',
      'Remember our farm days in Saanichton?'
    ]
  }]
]);

function detectKnownPerson(userMessage) {
  const messageLower = userMessage.toLowerCase();

  // Check for self-identification patterns FIRST
  if (messageLower.includes("it's your brother") || messageLower.includes("i'm your brother")) {
    return knownPeople.get('geoff');
  }

  // Then check for direct name mentions
  for (const [key, person] of knownPeople) {
    if (messageLower.includes(key)) {
      return person;
    }
  }

  return null;
}

function generatePersonalizedGreeting(person, userMessage) {
  const messageLower = userMessage.toLowerCase();
  
  // Handle specific greeting patterns
  if (messageLower.includes("it's your brother") || messageLower.includes("i'm your brother")) {
    return `Hey Boris! ${person.specificQuestions[0]}`;
  }

  if (messageLower.includes("hey") || messageLower.includes("hi")) {
    if (person.nickname) {
      return `Hey ${person.nickname}!`;
    }
    return `Hey ${person.name.split(' ')[0]}!`;
  }

  if (messageLower.includes("it's me") || messageLower.includes("it's")) {
    const nickname = person.nickname || person.name.split(' ')[0];
    const question = person.specificQuestions[Math.floor(Math.random() * person.specificQuestions.length)];
    return `${nickname}! ${question}`;
  }

  const nickname = person.nickname || person.name.split(' ')[0];
  return `${nickname}!`;
}

// Test the exact cases
const testCases = [
  "Hey! It's your brother!",
  "It's your brother!",
  "I'm your brother",
  "Hey Boris",
  "geoff here"
];

console.log('🎯 Testing Brother Detection Specifically\n');

testCases.forEach(message => {
  console.log(`📝 Testing: "${message}"`);
  
  const detectedPerson = detectKnownPerson(message);
  
  if (detectedPerson) {
    const greeting = generatePersonalizedGreeting(detectedPerson, message);
    console.log(`✅ Detected: ${detectedPerson.name} (${detectedPerson.nickname})`);
    console.log(`✅ Greeting: "${greeting}"`);
  } else {
    console.log(`❌ No detection`);
  }
  
  console.log('');
});

console.log('✨ Brother detection test completed!');