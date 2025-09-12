// test-vector-retriever.mjs
// Simple test script for VectorRetriever

import { demonstrateVectorRetrieverMock } from './src/lib/services/examples/vectorRetrieverExample.ts';

console.log('Testing VectorRetriever mock example...\n');

try {
  demonstrateVectorRetrieverMock();
  console.log('\n✅ Mock example completed successfully!');
} catch (error) {
  console.error('❌ Mock example failed:', error);
}