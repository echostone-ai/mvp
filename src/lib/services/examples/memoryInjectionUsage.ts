/**
 * Memory Injection Service Usage Examples
 * 
 * Demonstrates how to use the MemoryInjectionService to format context
 * for GPT-5 processing with various options and configurations.
 */

import { MemoryInjectionService, createMemoryInjectionService } from '../memoryInjectionService';
import { StructuredContext, createContextRetrievalEngine } from '../contextRetrievalEngine';

/**
 * Example 1: Basic template generation
 */
export async function basicTemplateExample() {
  const memoryService = createMemoryInjectionService();
  const contextEngine = createContextRetrievalEngine();
  
  // Retrieve context for an avatar
  const context = await contextEngine.retrieveContext(
    'avatar-123',
    'Tell me about my hobbies',
    { fastMode: false }
  );
  
  // Generate basic structured template
  const template = memoryService.formatContext(context);
  
  console.log('Basic Template:');
  console.log(template);
  
  return template;
}

/**
 * Example 2: GPT-5 optimized template with metadata
 */
export async function gpt5OptimizedExample() {
  const memoryService = createMemoryInjectionService();
  const contextEngine = createContextRetrievalEngine();
  
  const context = await contextEngine.retrieveContext(
    'avatar-456',
    'What do you remember about my family?'
  );
  
  // Generate GPT-5 optimized template with metadata
  const template = memoryService.formatContext(context, {
    modelType: 'gpt-5',
    includeMetadata: true,
    prioritizeCoreIdentity: true,
    maxCharacters: 6000
  });
  
  console.log('GPT-5 Optimized Template with Metadata:');
  console.log(template);
  
  // Validate the template
  const validation = memoryService.validateTemplate(template);
  console.log('Validation Result:', validation);
  
  return { template, validation };
}

/**
 * Example 3: Fast mode template for quick responses
 */
export async function fastModeExample() {
  const memoryService = createMemoryInjectionService();
  const contextEngine = createContextRetrievalEngine();
  
  const context = await contextEngine.retrieveContext(
    'avatar-789',
    'Hi there!',
    { 
      fastMode: true,
      memoryLimit: 5,
      historyLimit: 3
    }
  );
  
  // Generate compact template for fast responses
  const template = memoryService.formatContext(context, {
    modelType: 'gpt-5',
    maxCharacters: 2000,
    conversationHistoryLimit: 3,
    memoryFragmentLimit: 5,
    includeMetadata: false
  });
  
  console.log('Fast Mode Template:');
  console.log(template);
  
  // Get template statistics
  const stats = memoryService.getTemplateStats(template);
  console.log('Template Stats:', stats);
  
  return { template, stats };
}

/**
 * Example 4: Natural language template for Claude
 */
export async function claudeOptimizedExample() {
  const memoryService = createMemoryInjectionService();
  const contextEngine = createContextRetrievalEngine();
  
  const context = await contextEngine.retrieveContext(
    'avatar-101',
    'Let\'s have a conversation about my interests'
  );
  
  // Generate natural language template optimized for Claude
  const template = memoryService.formatContext(context, {
    modelType: 'claude',
    useStructuredFormat: false,
    prioritizeCoreIdentity: true
  });
  
  // Further optimize for Claude
  const optimizedTemplate = memoryService.optimizeForModel(template, 'claude');
  
  console.log('Claude Optimized Natural Language Template:');
  console.log(optimizedTemplate);
  
  return optimizedTemplate;
}

/**
 * Example 5: Template validation and error handling
 */
export function templateValidationExample() {
  const memoryService = createMemoryInjectionService();
  
  // Test various template scenarios
  const testCases = [
    {
      name: 'Empty template',
      template: ''
    },
    {
      name: 'Template with undefined values',
      template: 'name: undefined\nage: null'
    },
    {
      name: 'Very long template',
      template: 'content: ' + 'a'.repeat(10000)
    },
    {
      name: 'Template with long lines',
      template: 'short line\n' + 'b'.repeat(250)
    },
    {
      name: 'Well-formed template',
      template: `=== CORE IDENTITY ===
name: John Doe
age: 30

=== INSTRUCTIONS ===
- Be helpful and accurate`
    }
  ];
  
  console.log('Template Validation Results:');
  testCases.forEach(testCase => {
    const validation = memoryService.validateTemplate(testCase.template);
    console.log(`\n${testCase.name}:`, {
      isValid: validation.isValid,
      errors: validation.errors,
      warnings: validation.warnings,
      characterCount: validation.characterCount
    });
  });
}

/**
 * Example 6: Custom template with specific requirements
 */
export async function customTemplateExample() {
  const memoryService = createMemoryInjectionService();
  
  // Create custom context for demonstration
  const customContext: StructuredContext = {
    quickFacts: [
      {
        id: '1',
        avatarId: 'custom-avatar',
        key: 'name',
        value: 'Sarah Johnson',
        confidence: 1.0,
        priority: 1,
        source: 'manual',
        category: 'name',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      },
      {
        id: '2',
        avatarId: 'custom-avatar',
        key: 'profession',
        value: 'marine biologist',
        confidence: 0.95,
        priority: 2,
        source: 'extraction',
        category: 'occupation',
        dateContext: { year: 2024, month: 1 },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      },
      {
        id: '3',
        avatarId: 'custom-avatar',
        key: 'research_focus',
        value: 'coral reef conservation',
        confidence: 0.8,
        priority: 4,
        source: 'llm',
        category: 'interest',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }
    ],
    memoryFragments: [
      {
        id: 'mem-1',
        avatarId: 'custom-avatar',
        fragmentText: 'Sarah shared her excitement about discovering a new coral species during her recent dive expedition.',
        conversationContext: {
          source: 'conversation',
          type: 'user',
          conversationId: 'conv-1',
          tags: ['research', 'discovery', 'coral'],
          people: ['Sarah']
        },
        similarity: 0.92,
        createdAt: '2024-01-15T14:30:00Z',
        updatedAt: '2024-01-15T14:30:00Z'
      }
    ],
    conversationHistory: [
      {
        role: 'user',
        content: 'Tell me about your latest research project.',
        timestamp: '2024-01-20T10:00:00Z'
      },
      {
        role: 'assistant',
        content: 'I\'ve been working on coral reef conservation, focusing on the impact of climate change.',
        timestamp: '2024-01-20T10:01:00Z'
      }
    ],
    retrievalMetadata: {
      totalQuickFacts: 3,
      totalMemoryFragments: 1,
      totalConversationTurns: 2,
      retrievalTimeMs: 120,
      confidenceThreshold: 0.35,
      queryOptimizations: ['parallel_queries', 'cache_quick_facts'],
      cacheHits: ['quick_facts']
    }
  };
  
  // Generate template with custom options
  const template = memoryService.formatContext(customContext, {
    modelType: 'gpt-5',
    includeMetadata: true,
    prioritizeCoreIdentity: true,
    maxCharacters: 4000,
    conversationHistoryLimit: 5,
    memoryFragmentLimit: 10
  });
  
  console.log('Custom Template with Date Context and Tags:');
  console.log(template);
  
  // Validate and get stats
  const validation = memoryService.validateTemplate(template);
  const stats = memoryService.getTemplateStats(template);
  
  console.log('\nValidation:', validation);
  console.log('Stats:', stats);
  
  return { template, validation, stats };
}

/**
 * Example 7: Performance comparison between template formats
 */
export async function performanceComparisonExample() {
  const memoryService = createMemoryInjectionService();
  const contextEngine = createContextRetrievalEngine();
  
  const context = await contextEngine.retrieveContext(
    'perf-test-avatar',
    'Complex query with lots of context'
  );
  
  console.log('Performance Comparison:');
  
  // Structured format
  const startStructured = Date.now();
  const structuredTemplate = memoryService.formatContext(context, {
    useStructuredFormat: true,
    includeMetadata: true
  });
  const structuredTime = Date.now() - startStructured;
  
  // Natural format
  const startNatural = Date.now();
  const naturalTemplate = memoryService.formatContext(context, {
    useStructuredFormat: false,
    includeMetadata: false
  });
  const naturalTime = Date.now() - startNatural;
  
  console.log(`Structured format: ${structuredTime}ms, ${structuredTemplate.length} chars`);
  console.log(`Natural format: ${naturalTime}ms, ${naturalTemplate.length} chars`);
  
  return {
    structured: { template: structuredTemplate, time: structuredTime },
    natural: { template: naturalTemplate, time: naturalTime }
  };
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  console.log('=== Memory Injection Service Examples ===\n');
  
  try {
    console.log('1. Basic Template Example:');
    await basicTemplateExample();
    
    console.log('\n2. GPT-5 Optimized Example:');
    await gpt5OptimizedExample();
    
    console.log('\n3. Fast Mode Example:');
    await fastModeExample();
    
    console.log('\n4. Claude Optimized Example:');
    await claudeOptimizedExample();
    
    console.log('\n5. Template Validation Example:');
    templateValidationExample();
    
    console.log('\n6. Custom Template Example:');
    await customTemplateExample();
    
    console.log('\n7. Performance Comparison Example:');
    await performanceComparisonExample();
    
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Export individual functions for testing
export {
  MemoryInjectionService,
  createMemoryInjectionService
};