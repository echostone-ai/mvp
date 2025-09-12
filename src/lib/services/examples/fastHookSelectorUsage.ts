// src/lib/services/examples/fastHookSelectorUsage.ts
// Example usage of the fast hook selector for response coordination

import { lightAnalyze } from '../memoryAnalysisHelper';
import { selectFastHook } from '../fastHookSelector';

/**
 * Example of how to integrate fast hook selection into the chat API
 */
export function demonstrateFastHookSelection() {
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

  console.log('=== Fast Hook Selection Example ===');
  
  // Step 1: Analyze memories
  const analyses = lightAnalyze(exampleMemories);
  
  // Step 2: Select fast hook for different query types
  const queries = [
    { text: 'What do you think about Trump?', intent: 'opinion' },
    { text: 'Tell me about Austin', intent: 'travel' },
    { text: 'Where are you from?', intent: 'bio' },
    { text: 'What\'s your favorite city?', intent: 'general' }
  ];

  queries.forEach((query, index) => {
    console.log(`\n--- Query ${index + 1}: "${query.text}" (${query.intent}) ---`);
    
    const hookSelection = selectFastHook(exampleMemories, analyses, query.text, query.intent);
    
    console.log(`Fast Hook: "${hookSelection.selectedContent}"`);
    console.log(`Content Type: ${hookSelection.contentType}`);
    console.log(`Character Count: ${hookSelection.selectedContent.length}/180`);
    console.log(`Deep Lane Hints:`);
    console.log(`  - Expand On: ${hookSelection.deepLaneHints.expandOn.join(', ')}`);
    console.log(`  - Avoid Repeating: ${hookSelection.deepLaneHints.avoidRepeating.slice(0, 3).join(', ')}...`);
    console.log(`  - Suggested Tone: ${hookSelection.deepLaneHints.suggestedTone}`);
    console.log(`  - Related Memories: ${hookSelection.deepLaneHints.relatedMemories.join(', ')}`);
  });
  
  return { analyses, queries };
}

/**
 * Example of integration with existing fast lane logic
 */
export function integrateWithExistingFastLane(pinnedMemories: any[], userQuery: string, intent?: string) {
  console.log('\n=== Integration with Existing Fast Lane ===');
  
  // Step 1: Analyze memories (replaces current memory processing)
  const analyses = lightAnalyze(pinnedMemories);
  
  // Step 2: Select hook (replaces current memory selection logic)
  const hookSelection = selectFastHook(pinnedMemories, analyses, userQuery, intent);
  
  console.log('Current Logic Replacement:');
  console.log('OLD: Manual memory filtering and truncation');
  console.log('NEW: Intelligent hook selection with coordination hints');
  console.log('');
  console.log(`Selected Fast Response: "${hookSelection.selectedContent}"`);
  console.log(`Length: ${hookSelection.selectedContent.length} chars (target: ~180)`);
  
  // Step 3: Return data for deep lane coordination
  return {
    fastResponse: hookSelection.selectedContent,
    deepLaneHints: hookSelection.deepLaneHints,
    contentType: hookSelection.contentType
  };
}

/**
 * Performance comparison with current approach
 */
export function performanceComparison() {
  console.log('\n=== Performance Comparison ===');
  
  // Generate test memories
  const testMemories = Array.from({ length: 20 }, (_, i) => ({
    id: `test-${i}`,
    fragment_text: `Test memory fragment ${i} with various content about topics like Austin, politics, music, and personal experiences. This memory contains enough text to test the selection performance.`,
    conversation_context: { type: i % 4 === 0 ? 'opinion' : i % 4 === 1 ? 'memory' : i % 4 === 2 ? 'bio' : 'user' }
  }));
  
  // Test current approach (simulation)
  const currentStart = Date.now();
  // Simulate current logic: filter + truncate
  const substantiveMemories = testMemories.filter(m => !['user', 'assistant'].includes(m.conversation_context.type));
  const currentResult = substantiveMemories.length > 0 ? 
    substantiveMemories[0].fragment_text.substring(0, 150) + '...' : 
    "I'm thinking about that...";
  const currentTime = Date.now() - currentStart;
  
  // Test new approach
  const newStart = Date.now();
  const analyses = lightAnalyze(testMemories);
  const hookSelection = selectFastHook(testMemories, analyses, 'test query');
  const newTime = Date.now() - newStart;
  
  console.log('Current Approach:');
  console.log(`  Time: ${currentTime}ms`);
  console.log(`  Result: "${currentResult.substring(0, 100)}..."`);
  console.log(`  Coordination: None`);
  console.log('');
  console.log('New Approach:');
  console.log(`  Time: ${newTime}ms`);
  console.log(`  Result: "${hookSelection.selectedContent}"`);
  console.log(`  Coordination: Full deep lane hints`);
  console.log(`  Performance Impact: ${newTime - currentTime}ms additional`);
  
  return {
    currentTime,
    newTime,
    performanceImpact: newTime - currentTime,
    hookSelection
  };
}

/**
 * Example of different hook types
 */
export function demonstrateHookTypes() {
  console.log('\n=== Hook Type Examples ===');
  
  const hookExamples = [
    {
      name: 'Enthusiasm Hook (Austin)',
      memory: {
        id: 'austin-1',
        fragment_text: 'I lived in Austin from 2009 to 2018 and had amazing experiences',
        conversation_context: { type: 'memory' }
      },
      expectedType: 'enthusiasm'
    },
    {
      name: 'Opinion Hook (Politics)',
      memory: {
        id: 'trump-1',
        fragment_text: 'I absolutely hate Trump and think he should never be president',
        conversation_context: { type: 'opinion' }
      },
      expectedType: 'opinion'
    },
    {
      name: 'Story Teaser (Travel)',
      memory: {
        id: 'spain-1',
        fragment_text: 'When I moved to Valencia, Spain, it was such a culture shock but I fell in love with the Mediterranean lifestyle',
        conversation_context: { type: 'memory' }
      },
      expectedType: 'teaser'
    },
    {
      name: 'Bio Hook (Background)',
      memory: {
        id: 'bio-1',
        fragment_text: 'Born in California, studied computer science',
        conversation_context: { type: 'bio' }
      },
      expectedType: 'hook'
    }
  ];
  
  hookExamples.forEach(example => {
    const analyses = lightAnalyze([example.memory]);
    const hookSelection = selectFastHook([example.memory], analyses, 'test query');
    
    console.log(`${example.name}:`);
    console.log(`  Expected Type: ${example.expectedType}`);
    console.log(`  Actual Type: ${hookSelection.contentType}`);
    console.log(`  Hook: "${hookSelection.selectedContent}"`);
    console.log(`  Tone: ${hookSelection.deepLaneHints.suggestedTone}`);
    console.log('');
  });
}

// Run examples if this file is executed directly
if (require.main === module) {
  demonstrateFastHookSelection();
  integrateWithExistingFastLane([], 'test query');
  performanceComparison();
  demonstrateHookTypes();
}