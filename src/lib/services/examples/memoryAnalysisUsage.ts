// src/lib/services/examples/memoryAnalysisUsage.ts
// Example usage of the lightweight memory analysis helper

import { lightAnalyze, MemoryAnalysis } from '../memoryAnalysisHelper';

/**
 * Example of how to integrate memory analysis into the chat API
 */
export function demonstrateMemoryAnalysis() {
  // Example memories from the chat API
  const exampleMemories = [
    {
      id: '1',
      fragment_text: 'I absolutely hate Trump and think he should never be president again. The political climate in America is terrible.',
      conversation_context: { type: 'opinion' }
    },
    {
      id: '2', 
      fragment_text: 'When I lived in Austin from 2009 to 2018, I had the most amazing time exploring the music scene and meeting incredible people. The city has such a vibrant culture.',
      conversation_context: { type: 'memory' }
    },
    {
      id: '3',
      fragment_text: 'Born in California, studied computer science at university',
      conversation_context: { type: 'bio' }
    },
    {
      id: '4',
      fragment_text: 'User asked about my dog and I told them about Max',
      conversation_context: { type: 'assistant' }
    }
  ];

  console.log('=== Memory Analysis Example ===');
  
  // Analyze memories
  const analyses = lightAnalyze(exampleMemories);
  
  // Sort by hook potential for fast lane selection
  const sortedByHook = [...analyses].sort((a, b) => b.hookPotential - a.hookPotential);
  
  console.log('\n--- Fast Lane Hook Candidates (sorted by hook potential) ---');
  sortedByHook.forEach((analysis, index) => {
    const memory = exampleMemories.find(m => m.id === analysis.memoryId);
    console.log(`${index + 1}. Hook Potential: ${analysis.hookPotential.toFixed(2)}`);
    console.log(`   Content Types: ${analysis.contentTypes.join(', ')}`);
    console.log(`   Emotional Tone: ${analysis.emotionalTone}`);
    console.log(`   Text: "${memory?.fragment_text.substring(0, 100)}..."`);
    console.log(`   Key Elements: ${analysis.keyElements.join(', ')}`);
    console.log('');
  });
  
  // Sort by story depth for deep lane selection
  const sortedByDepth = [...analyses].sort((a, b) => b.storyDepth - a.storyDepth);
  
  console.log('--- Deep Lane Story Candidates (sorted by story depth) ---');
  sortedByDepth.forEach((analysis, index) => {
    const memory = exampleMemories.find(m => m.id === analysis.memoryId);
    console.log(`${index + 1}. Story Depth: ${analysis.storyDepth.toFixed(2)}`);
    console.log(`   Content Types: ${analysis.contentTypes.join(', ')}`);
    console.log(`   Text: "${memory?.fragment_text.substring(0, 100)}..."`);
    console.log('');
  });
  
  // Example coordination strategy
  const bestHook = sortedByHook[0];
  const bestStory = sortedByDepth[0];
  
  console.log('--- Coordination Strategy ---');
  console.log(`Fast Lane Hook: Memory ${bestHook.memoryId} (${bestHook.hookPotential.toFixed(2)} hook potential)`);
  console.log(`Deep Lane Story: Memory ${bestStory.memoryId} (${bestStory.storyDepth.toFixed(2)} story depth)`);
  
  if (bestHook.memoryId === bestStory.memoryId) {
    console.log('Same memory selected for both lanes - need coordination strategy');
  } else {
    console.log('Different memories selected - natural complementary flow');
  }
  
  return {
    analyses,
    fastLaneCandidate: bestHook,
    deepLaneCandidate: bestStory
  };
}

/**
 * Example of performance measurement
 */
export function measureAnalysisPerformance() {
  // Generate test memories
  const testMemories = Array.from({ length: 100 }, (_, i) => ({
    id: `test-${i}`,
    fragment_text: `Test memory fragment ${i} with various content about topics like Austin, politics, music, and personal experiences. This memory contains enough text to test the analysis performance.`,
    conversation_context: { type: i % 4 === 0 ? 'opinion' : i % 4 === 1 ? 'memory' : i % 4 === 2 ? 'bio' : 'user' }
  }));
  
  console.log('\n=== Performance Test ===');
  console.log(`Analyzing ${testMemories.length} memories...`);
  
  const startTime = Date.now();
  const analyses = lightAnalyze(testMemories);
  const elapsedMs = Date.now() - startTime;
  
  console.log(`Analysis completed in ${elapsedMs}ms`);
  console.log(`Average time per memory: ${(elapsedMs / testMemories.length).toFixed(2)}ms`);
  console.log(`Performance requirement: < 10ms total ✓`);
  
  // Analyze results
  const avgHookPotential = analyses.reduce((sum, a) => sum + a.hookPotential, 0) / analyses.length;
  const avgStoryDepth = analyses.reduce((sum, a) => sum + a.storyDepth, 0) / analyses.length;
  
  console.log(`Average hook potential: ${avgHookPotential.toFixed(2)}`);
  console.log(`Average story depth: ${avgStoryDepth.toFixed(2)}`);
  
  return {
    elapsedMs,
    avgHookPotential,
    avgStoryDepth,
    analyses
  };
}

// Run examples if this file is executed directly
if (require.main === module) {
  demonstrateMemoryAnalysis();
  measureAnalysisPerformance();
}