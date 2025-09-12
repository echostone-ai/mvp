// Test the enriched factbook with key queries
const fs = require('fs');
const path = require('path');

function testEnrichedFactbook() {
  console.log('Testing enriched factbook...\n');
  
  // Load the factbook
  const factbookPath = path.join(__dirname, 'src/data/jonathan_profile_factbook.json');
  const factbook = JSON.parse(fs.readFileSync(factbookPath, 'utf-8'));
  
  // Count facts
  let totalFacts = 0;
  const sections = Object.keys(factbook);
  
  sections.forEach(section => {
    const sectionFacts = Object.keys(factbook[section]).length;
    totalFacts += sectionFacts;
    console.log(`${section}: ${sectionFacts} facts`);
  });
  
  console.log(`\nTotal facts: ${totalFacts}`);
  console.log(`Sections: ${sections.join(', ')}\n`);
  
  // Test key queries
  const testQueries = [
    { query: "Who is Tyler?", expectedSection: "relationships", expectedKeywords: ["tyler"] },
    { query: "Where did you live in 2008?", expectedSection: "timeline", expectedKeywords: ["2008", "austin"] },
    { query: "Tell me about Olive", expectedSection: "pets", expectedKeywords: ["olive"] },
    { query: "What's your opinion on Trump?", expectedSection: "opinions", expectedKeywords: ["trump"] },
    { query: "Tell me about Romeo", expectedSection: "pets", expectedKeywords: ["romeo"] },
    { query: "What's Echostone?", expectedSection: "projects", expectedKeywords: ["echostone"] }
  ];
  
  console.log('Testing key queries:\n');
  
  testQueries.forEach(test => {
    console.log(`Query: "${test.query}"`);
    
    // Simple search through all facts
    const matches = [];
    
    sections.forEach(section => {
      Object.entries(factbook[section]).forEach(([factName, fact]) => {
        const hasKeywordMatch = test.expectedKeywords.some(keyword => 
          fact.keywords.some(k => k.toLowerCase().includes(keyword.toLowerCase())) ||
          fact.text.toLowerCase().includes(keyword.toLowerCase())
        );
        
        if (hasKeywordMatch) {
          matches.push({
            section,
            factName,
            id: fact.id,
            text: fact.text,
            relevance: fact.keywords.filter(k => 
              test.expectedKeywords.some(ek => k.toLowerCase().includes(ek.toLowerCase()))
            ).length
          });
        }
      });
    });
    
    // Sort by relevance
    matches.sort((a, b) => b.relevance - a.relevance);
    
    if (matches.length > 0) {
      console.log(`✅ Found ${matches.length} matches:`);
      matches.slice(0, 3).forEach(match => {
        console.log(`  - ${match.id}: ${match.text.substring(0, 100)}...`);
      });
    } else {
      console.log(`❌ No matches found`);
    }
    console.log('');
  });
  
  // Validate schema
  console.log('Validating schema...\n');
  let schemaValid = true;
  
  sections.forEach(section => {
    Object.entries(factbook[section]).forEach(([factName, fact]) => {
      // Check required fields
      if (!fact.id || !fact.text || !fact.topics || !fact.keywords) {
        console.log(`❌ Missing required fields in ${section}.${factName}`);
        schemaValid = false;
      }
      
      // Check ID format
      if (fact.id !== `${section}.${factName}`) {
        console.log(`❌ ID mismatch in ${section}.${factName}: expected ${section}.${factName}, got ${fact.id}`);
        schemaValid = false;
      }
      
      // Check arrays
      if (!Array.isArray(fact.topics) || !Array.isArray(fact.keywords)) {
        console.log(`❌ Topics or keywords not arrays in ${fact.id}`);
        schemaValid = false;
      }
    });
  });
  
  if (schemaValid) {
    console.log('✅ Schema validation passed');
  } else {
    console.log('❌ Schema validation failed');
  }
  
  console.log('\nEnriched factbook test complete!');
}

testEnrichedFactbook();