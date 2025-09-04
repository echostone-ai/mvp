// Test the marriage pattern matching
const query = 'have you ever been married?';

console.log('Testing marriage pattern matching...');
console.log(`Query: "${query}"`);

// Test the pattern from the code
const marriageQueryPattern = /\b(have you|did you|were you|are you).*\b(married|marry|marriage|wife|husband|partner|relationship|dating|together)\b/i;

const matches = marriageQueryPattern.test(query);
console.log(`Pattern matches: ${matches}`);

if (matches) {
  console.log('✅ Pattern should match and add relationship terms');
} else {
  console.log('❌ Pattern does not match - this is the issue!');
}

// Test individual parts
const part1 = /\b(have you|did you|were you|are you)/i.test(query);
const part2 = /\b(married|marry|marriage|wife|husband|partner|relationship|dating|together)\b/i.test(query);

console.log(`Part 1 (have you|did you|were you|are you): ${part1}`);
console.log(`Part 2 (married|marry|marriage|wife|husband|partner|relationship|dating|together): ${part2}`);

// Test the full pattern step by step
const fullMatch = query.match(marriageQueryPattern);
console.log(`Full match result:`, fullMatch);

// Test a simpler pattern
const simplePattern = /(have you|did you|were you|are you).*(married|marry|marriage|wife|husband|partner|relationship|dating|together)/i;
const simpleMatches = simplePattern.test(query);
console.log(`Simple pattern matches: ${simpleMatches}`);