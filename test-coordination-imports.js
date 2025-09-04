// Test script to verify coordination imports work correctly
async function testImports() {
  console.log('Testing coordination service imports...');
  
  try {
    // Test memory analysis helper import
    const { lightAnalyze } = await import('./src/lib/services/memoryAnalysisHelper.js');
    console.log('✓ Memory analysis helper imported successfully');
    
    // Test fast hook selector import
    const { selectFastHook } = await import('./src/lib/services/fastHookSelector.js');
    console.log('✓ Fast hook selector imported successfully');
    
    // Test with sample data
    const sampleMemories = [
      {
        id: 'test-1',
        fragment_text: 'I absolutely love Austin! It was such an incredible chapter of my life from 2009-2018.',
        conversation_context: { type: 'memory' }
      }
    ];
    
    console.log('Testing memory analysis...');
    const analyses = lightAnalyze(sampleMemories);
    console.log('Analysis result:', analyses[0]);
    
    console.log('Testing hook selection...');
    const hookSelection = selectFastHook(sampleMemories, analyses, 'What do you think about Austin?', 'travel');
    console.log('Hook selection result:', {
      content: hookSelection.selectedContent,
      type: hookSelection.contentType,
      hints: {
        expandOn: hookSelection.deepLaneHints.expandOn.length,
        avoidRepeating: hookSelection.deepLaneHints.avoidRepeating.length,
        tone: hookSelection.deepLaneHints.suggestedTone
      }
    });
    
    console.log('✓ All coordination services working correctly!');
    
  } catch (error) {
    console.error('Import test failed:', error.message);
    console.error(error.stack);
  }
}

testImports();