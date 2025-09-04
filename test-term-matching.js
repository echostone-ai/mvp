// Test term matching for Tia memory
const tiaText = "I married my first girlfriend Tia - the first girl I kissed. We were together ten years and had a nice relationship, but eventually outgrew it. After the breakup, I felt lost, but this led me to move to Austin.";

console.log('Testing term matching for Tia memory...');
console.log(`Text: "${tiaText}"`);
console.log(`Lowercase: "${tiaText.toLowerCase()}"`);

const searchTerms = ['have', 'you', 'ever', 'married', 'marriage', 'wife', 'husband', 'partner', 'relationship', 'dating', 'together', 'girlfriend', 'boyfriend'];

searchTerms.forEach(term => {
  const matches = tiaText.toLowerCase().includes(term);
  console.log(`Term "${term}": ${matches ? '✅ MATCHES' : '❌ no match'}`);
  
  if (term === 'married' && matches) {
    const index = tiaText.toLowerCase().indexOf(term);
    console.log(`  Found "${term}" at position ${index}: "${tiaText.substring(index, index + 20)}"`);
  }
});