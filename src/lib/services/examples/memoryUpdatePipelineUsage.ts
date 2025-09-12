/**
 * Example usage of MemoryUpdatePipeline
 * 
 * Demonstrates how to use the automatic memory update pipeline for
 * extracting facts from conversations and managing memory fragments.
 */

import { MemoryUpdatePipeline, ConversationContext } from '../memoryUpdatePipeline';

// Example 1: Basic conversation processing
async function basicConversationProcessing() {
  console.log('=== Basic Conversation Processing ===');
  
  const pipeline = new MemoryUpdatePipeline();
  
  const context: ConversationContext = {
    conversationId: 'conv-123',
    visitorId: 'visitor-456',
    sessionId: 'session-789',
    userInput: 'Hi, my name is Sarah and I work as a data scientist at Google. I have two cats named Whiskers and Shadow.',
    assistantResponse: 'Nice to meet you, Sarah! Data science is such an exciting field. Tell me more about Whiskers and Shadow - they sound adorable!',
    timestamp: new Date().toISOString(),
    metadata: {
      conversationType: 'introduction'
    }
  };

  try {
    const result = await pipeline.processConversationTurn('avatar-sarah-123', context);
    
    console.log('Processing Result:');
    console.log(`- Facts extracted: ${result.factsExtracted}`);
    console.log(`- Facts updated: ${result.factsUpdated}`);
    console.log(`- Memories created: ${result.memoriesCreated}`);
    console.log(`- Conflicts resolved: ${result.conflicts.length}`);
    console.log(`- Processing time: ${result.processingTimeMs}ms`);
    
    if (result.conflicts.length > 0) {
      console.log('\nConflicts resolved:');
      result.conflicts.forEach((conflict, index) => {
        console.log(`  ${index + 1}. ${conflict.key}: ${conflict.resolution} - ${conflict.reason}`);
      });
    }
    
    if (result.errors.length > 0) {
      console.log('\nErrors encountered:');
      result.errors.forEach(error => console.log(`  - ${error}`));
    }
  } catch (error) {
    console.error('Failed to process conversation:', error);
  }
}

// Example 2: Custom configuration
async function customConfigurationExample() {
  console.log('\n=== Custom Configuration Example ===');
  
  const pipeline = new MemoryUpdatePipeline({
    enableFactExtraction: true,
    enableMemoryFragments: true,
    confidenceThreshold: 0.7, // Higher threshold for more reliable facts
    priorityThreshold: 5, // Only store high to medium priority facts
    maxFactsPerUpdate: 10, // Limit facts per conversation turn
    ignoreSessionMemory: false
  });

  const context: ConversationContext = {
    conversationId: 'conv-456',
    visitorId: 'visitor-789',
    userInput: 'I think I mentioned before that I might like pizza, but I\'m not really sure. Actually, I definitely love sushi and I eat it every Friday.',
    assistantResponse: 'I understand the uncertainty about pizza, but it sounds like sushi is definitely a favorite! Having a weekly sushi tradition on Fridays sounds wonderful.',
    timestamp: new Date().toISOString()
  };

  const result = await pipeline.processConversationTurn('avatar-foodie-456', context);
  
  console.log('Custom Config Result:');
  console.log(`- Facts extracted: ${result.factsExtracted}`);
  console.log(`- Facts updated: ${result.factsUpdated}`);
  console.log('- Only high-confidence facts (>0.7) were processed');
}

// Example 3: Conflict resolution demonstration
async function conflictResolutionExample() {
  console.log('\n=== Conflict Resolution Example ===');
  
  const pipeline = new MemoryUpdatePipeline();

  // Simulate existing fact in database (this would normally be fetched from DB)
  const existingFact = {
    id: 'fact-123',
    avatar_id: 'avatar-john-789',
    key: 'occupation',
    value: 'software engineer',
    confidence: 0.8,
    priority: 2,
    source: 'extraction',
    source_reference: 'Previous conversation',
    created_at: '2024-01-14T10:00:00Z',
    updated_at: '2024-01-14T10:00:00Z'
  };

  const newFact = {
    key: 'occupation',
    value: 'senior software engineer',
    confidence: 0.95,
    source_text: 'I got promoted to senior software engineer last month',
    extraction_method: 'pattern' as const
  };

  // Demonstrate conflict resolution logic
  const resolution = pipeline.resolveConflicts(existingFact, newFact);
  
  console.log('Conflict Resolution:');
  console.log(`- Key: ${resolution.key}`);
  console.log(`- Existing: "${resolution.existingFact.value}" (confidence: ${resolution.existingFact.confidence})`);
  console.log(`- New: "${resolution.newFact.value}" (confidence: ${resolution.newFact.confidence})`);
  console.log(`- Resolution: ${resolution.resolution}`);
  console.log(`- Reason: ${resolution.reason}`);
}

// Example 4: Batch processing multiple conversation turns
async function batchProcessingExample() {
  console.log('\n=== Batch Processing Example ===');
  
  const pipeline = new MemoryUpdatePipeline();
  const avatarId = 'avatar-batch-test';

  const conversationTurns: ConversationContext[] = [
    {
      conversationId: 'conv-batch-1',
      visitorId: 'visitor-batch',
      userInput: 'I live in San Francisco and work in tech.',
      assistantResponse: 'San Francisco is a great city for tech workers!',
      timestamp: new Date(Date.now() - 3000).toISOString()
    },
    {
      conversationId: 'conv-batch-1',
      visitorId: 'visitor-batch',
      userInput: 'I have a dog named Max who loves to play fetch in Golden Gate Park.',
      assistantResponse: 'Max sounds like a wonderful companion! Golden Gate Park is perfect for dogs.',
      timestamp: new Date(Date.now() - 2000).toISOString()
    },
    {
      conversationId: 'conv-batch-1',
      visitorId: 'visitor-batch',
      userInput: 'Actually, I just moved to Seattle last week for a new job at Microsoft.',
      assistantResponse: 'Congratulations on the new job! Seattle is a beautiful city too.',
      timestamp: new Date().toISOString()
    }
  ];

  let totalFacts = 0;
  let totalMemories = 0;
  let totalConflicts = 0;

  for (const [index, context] of conversationTurns.entries()) {
    console.log(`\nProcessing turn ${index + 1}:`);
    const result = await pipeline.processConversationTurn(avatarId, context);
    
    totalFacts += result.factsExtracted;
    totalMemories += result.memoriesCreated;
    totalConflicts += result.conflicts.length;
    
    console.log(`  - Facts: ${result.factsExtracted}, Memories: ${result.memoriesCreated}, Conflicts: ${result.conflicts.length}`);
    
    if (result.conflicts.length > 0) {
      result.conflicts.forEach(conflict => {
        console.log(`    Conflict: ${conflict.key} - ${conflict.resolution}`);
      });
    }
  }

  console.log(`\nBatch Summary:`);
  console.log(`- Total facts extracted: ${totalFacts}`);
  console.log(`- Total memories created: ${totalMemories}`);
  console.log(`- Total conflicts resolved: ${totalConflicts}`);
}

// Example 5: Configuration management
async function configurationManagementExample() {
  console.log('\n=== Configuration Management Example ===');
  
  const pipeline = new MemoryUpdatePipeline();
  
  console.log('Default configuration:');
  console.log(JSON.stringify(pipeline.getConfig(), null, 2));
  
  // Update configuration for specific use case
  pipeline.updateConfig({
    confidenceThreshold: 0.6,
    maxFactsPerUpdate: 5,
    enableMemoryFragments: false // Disable memory fragments for this session
  });
  
  console.log('\nUpdated configuration:');
  console.log(JSON.stringify(pipeline.getConfig(), null, 2));
  
  // Process a conversation with the new config
  const context: ConversationContext = {
    conversationId: 'conv-config-test',
    visitorId: 'visitor-config',
    userInput: 'I enjoy reading science fiction novels and playing chess.',
    assistantResponse: 'Great hobbies! Do you have a favorite sci-fi author?',
    timestamp: new Date().toISOString()
  };

  const result = await pipeline.processConversationTurn('avatar-config-test', context);
  console.log(`\nWith updated config - Memories created: ${result.memoriesCreated} (should be 0 since disabled)`);
}

// Example 6: Error handling and graceful degradation
async function errorHandlingExample() {
  console.log('\n=== Error Handling Example ===');
  
  const pipeline = new MemoryUpdatePipeline();
  
  // Simulate a conversation that might cause extraction errors
  const problematicContext: ConversationContext = {
    conversationId: 'conv-error-test',
    visitorId: 'visitor-error',
    userInput: '', // Empty input that might cause issues
    assistantResponse: 'I understand.',
    timestamp: new Date().toISOString()
  };

  const result = await pipeline.processConversationTurn('avatar-error-test', problematicContext);
  
  console.log('Error handling result:');
  console.log(`- Facts extracted: ${result.factsExtracted}`);
  console.log(`- Errors: ${result.errors.length}`);
  
  if (result.errors.length > 0) {
    console.log('Errors encountered:');
    result.errors.forEach(error => console.log(`  - ${error}`));
  }
  
  console.log('- Pipeline continued gracefully despite errors');
}

// Run all examples
async function runAllExamples() {
  console.log('MemoryUpdatePipeline Usage Examples');
  console.log('===================================');
  
  try {
    await basicConversationProcessing();
    await customConfigurationExample();
    await conflictResolutionExample();
    await batchProcessingExample();
    await configurationManagementExample();
    await errorHandlingExample();
    
    console.log('\n✅ All examples completed successfully!');
  } catch (error) {
    console.error('❌ Example execution failed:', error);
  }
}

// Export for use in other files
export {
  basicConversationProcessing,
  customConfigurationExample,
  conflictResolutionExample,
  batchProcessingExample,
  configurationManagementExample,
  errorHandlingExample,
  runAllExamples
};

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples();
}