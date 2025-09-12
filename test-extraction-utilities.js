// Test the extraction utilities
const fs = require('fs');
const path = require('path');

// Import the utilities (we'll simulate them since they're TypeScript)
function extractKeywords(text, existingKeywords = []) {
  const STOP_WORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he', 
    'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'will', 'with'
  ]);
  
  const normalize = (text) => text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = normalize(text).split(' ').filter(Boolean);
  const keywords = new Set(existingKeywords.map(k => k.toLowerCase()));
  
  for (const word of words) {
    if (word.length >= 2 && !STOP_WORDS.has(word) && !/^\d+$/.test(word)) {
      keywords.add(word);
    }
  }
  
  return Array.from(keywords).sort();
}

function extractTopics(fact) {
  const existingTopics = fact.topics || [];
  const topics = new Set(existingTopics.map(t => t.toLowerCase()));
  
  // Extract primary topic from ID
  const idParts = fact.id.split('.');
  if (idParts.length >= 2) {
    topics.add(idParts[0]);
  }
  
  // Content analysis
  const text = fact.text.toLowerCase();
  
  if (text.includes('lived') || text.includes('moved') || text.includes('city')) topics.add('places');
  if (text.includes('born') || text.includes('year') || text.includes('age')) topics.add('timeline');
  if (text.includes('friend') || text.includes('partner') || text.includes('married')) topics.add('relationships');
  if (text.includes('dog') || text.includes('poodle') || text.includes('pet')) topics.add('pets');
  if (text.includes('music') || text.includes('guitar') || text.includes('band')) topics.add('music');
  if (text.includes('opinion') || text.includes('think') || text.includes('believe')) topics.add('opinions');
  
  return Array.from(topics).sort();
}

function testExtractionUtilities() {
  console.log('🔧 Testing Extraction Utilities\n');
  
  // Load the factbook
  const factbookPath = path.join(__dirname, 'data/jonathan_profile_factbook.json');
  const factbook = JSON.parse(fs.readFileSync(factbookPath, 'utf-8'));
  
  // Test cases
  const testCases = [
    {
      id: "test.sample",
      text: "Tyler McCoy is a yoga instructor from Austin who loves technology and travel.",
      expectedKeywords: ["tyler", "mccoy", "yoga", "instructor", "austin", "technology", "travel"],
      expectedTopics: ["test", "relationships", "places"]
    },
    {
      id: "pets.example", 
      text: "Romeo is a toy poodle born on Valentine's Day 2024.",
      expectedKeywords: ["romeo", "toy", "poodle", "born", "valentine", "day", "2024"],
      expectedTopics: ["pets", "timeline"]
    },
    {
      id: "opinions.sample",
      text: "I think modern society is obsessed with social media and influencers.",
      expectedKeywords: ["think", "modern", "society", "obsessed", "social", "media", "influencers"],
      expectedTopics: ["opinions"]
    }
  ];
  
  console.log('Testing keyword extraction:');
  console.log('=' .repeat(40));
  
  for (const test of testCases) {
    const extracted = extractKeywords(test.text);
    const found = test.expectedKeywords.filter(k => extracted.includes(k.toLowerCase()));
    const score = found.length / test.expectedKeywords.length;
    
    console.log(`\nText: "${test.text}"`);
    console.log(`Expected: ${test.expectedKeywords.join(', ')}`);
    console.log(`Extracted: ${extracted.join(', ')}`);
    console.log(`Found: ${found.join(', ')} (${Math.round(score * 100)}%)`);
    console.log(score >= 0.7 ? '✅ PASS' : '❌ FAIL');
  }
  
  console.log('\n\nTesting topic extraction:');
  console.log('=' .repeat(40));
  
  for (const test of testCases) {
    const extracted = extractTopics(test);
    const found = test.expectedTopics.filter(t => extracted.includes(t.toLowerCase()));
    const score = found.length / test.expectedTopics.length;
    
    console.log(`\nID: ${test.id}`);
    console.log(`Text: "${test.text}"`);
    console.log(`Expected: ${test.expectedTopics.join(', ')}`);
    console.log(`Extracted: ${extracted.join(', ')}`);
    console.log(`Found: ${found.join(', ')} (${Math.round(score * 100)}%)`);
    console.log(score >= 0.7 ? '✅ PASS' : '❌ FAIL');
  }
  
  console.log('\n\nValidating factbook schema:');
  console.log('=' .repeat(40));
  
  let totalFacts = 0;
  let validFacts = 0;
  
  for (const [section, facts] of Object.entries(factbook)) {
    for (const [factName, fact] of Object.entries(facts)) {
      totalFacts++;
      
      // Check required fields
      const hasId = fact.id && typeof fact.id === 'string';
      const hasText = fact.text && typeof fact.text === 'string';
      const hasTopics = Array.isArray(fact.topics);
      const hasKeywords = Array.isArray(fact.keywords);
      const correctId = fact.id === `${section}.${factName}`;
      
      if (hasId && hasText && hasTopics && hasKeywords && correctId) {
        validFacts++;
      } else {
        console.log(`❌ Invalid fact: ${section}.${factName}`);
        if (!hasId) console.log('  - Missing or invalid ID');
        if (!hasText) console.log('  - Missing or invalid text');
        if (!hasTopics) console.log('  - Missing or invalid topics array');
        if (!hasKeywords) console.log('  - Missing or invalid keywords array');
        if (!correctId) console.log(`  - ID mismatch: expected ${section}.${factName}, got ${fact.id}`);
      }
    }
  }
  
  console.log(`\nSchema validation: ${validFacts}/${totalFacts} facts valid (${Math.round(validFacts/totalFacts*100)}%)`);
  
  if (validFacts === totalFacts) {
    console.log('✅ All facts have valid schema!');
  } else {
    console.log('❌ Some facts have schema issues');
  }
  
  console.log('\n🎯 Extraction utilities test complete!');
}

testExtractionUtilities();