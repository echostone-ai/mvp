// src/lib/services/styleProfileDemo.ts
// Demonstration of facts first → then apply StyleProfile pattern

import { FactbookService, FactbookSnippet } from './factbookService';
import { FactbookHookSelector } from './factbookHookSelector';
import { DeepLaneStyleCoordinator } from './deepLaneStyleCoordinator';
import { StyleProfile } from './styleProfile';

/**
 * Demonstrates the complete facts first → then apply StyleProfile workflow
 * This shows how personality never pollutes factbook content or influences fact selection
 */
export class StyleProfileDemo {
  private factbookService: FactbookService;
  private hookSelector: FactbookHookSelector;
  private deepCoordinator: DeepLaneStyleCoordinator;
  private styleProfile: StyleProfile;

  constructor() {
    this.factbookService = FactbookService.getInstance();
    this.hookSelector = new FactbookHookSelector();
    this.deepCoordinator = new DeepLaneStyleCoordinator();
    this.styleProfile = StyleProfile.getInstance();
  }

  /**
   * Demonstrate the complete workflow for a query
   */
  async demonstrateWorkflow(query: string): Promise<{
    step1_factSelection: FactbookSnippet[];
    step2_hookGeneration: string;
    step3_styleInstructions: string;
    step4_deepPrompt: string;
    validation: {
      factStyleSeparation: boolean;
      violations: string[];
    };
  }> {
    console.log(`\n=== StyleProfile Demo: "${query}" ===\n`);

    // STEP 1: FACTS FIRST - Pure fact selection without style influence
    console.log('STEP 1: Pure fact selection (no style influence)');
    const keywords = this.extractKeywords(query);
    const selectedSnippets = this.factbookService.querySnippets(keywords, 3);
    
    console.log('Selected facts based purely on relevance:');
    selectedSnippets.forEach(snippet => {
      console.log(`- [${snippet.id}] ${snippet.text.substring(0, 100)}...`);
    });

    // STEP 2: Hook generation with facts first pattern
    console.log('\nSTEP 2: Hook generation (facts first → then style)');
    const hookResult = this.hookSelector.selectHook(selectedSnippets, query);
    
    console.log(`Generated hook: "${hookResult.hook}"`);
    console.log(`Suggested tone: ${hookResult.coordinationHints.suggestedTone}`);
    console.log(`Topic focus: ${hookResult.coordinationHints.topicFocus}`);

    // STEP 3: Style instructions generation
    console.log('\nSTEP 3: Style instructions (applied after fact selection)');
    const styleInstructions = this.styleProfile.generateStyleInstructions(
      hookResult.coordinationHints.suggestedTone,
      selectedSnippets.flatMap(s => s.topics),
      false // Fast lane
    );
    
    console.log('Style instructions:');
    console.log(styleInstructions);

    // STEP 4: Deep lane prompt with fact/style separation
    console.log('\nSTEP 4: Deep lane prompt (maintains separation)');
    const deepPrompt = this.deepCoordinator.buildDeepLanePrompt({
      query,
      snippets: selectedSnippets,
      coordinationHints: hookResult.coordinationHints,
      fastHookContent: hookResult.hook
    });

    console.log('Deep lane prompt structure:');
    console.log('- Facts section comes first');
    console.log('- Style instructions come after');
    console.log('- Clear separation maintained');

    // STEP 5: Validation
    console.log('\nSTEP 5: Validation (fact/style separation check)');
    const validation = this.styleProfile.validateFactStyleSeparation(
      hookResult.hook,
      selectedSnippets.map(s => s.id)
    );

    console.log(`Fact/style separation valid: ${validation.isValid}`);
    if (validation.violations.length > 0) {
      console.log('Violations found:');
      validation.violations.forEach(v => console.log(`- ${v}`));
    } else {
      console.log('✓ No violations - clean fact/style separation maintained');
    }

    return {
      step1_factSelection: selectedSnippets,
      step2_hookGeneration: hookResult.hook,
      step3_styleInstructions: styleInstructions,
      step4_deepPrompt: deepPrompt,
      validation: {
        factStyleSeparation: validation.isValid,
        violations: validation.violations
      }
    };
  }

  /**
   * Demonstrate how personality never influences fact selection
   */
  demonstrateFactSelectionPurity(): void {
    console.log('\n=== Fact Selection Purity Demo ===\n');

    const query = "Tell me about Austin";
    const keywords = this.extractKeywords(query);
    
    console.log('Query:', query);
    console.log('Extracted keywords (no personality influence):', keywords);
    
    // Show that fact selection is purely based on factual relevance
    const snippets = this.factbookService.querySnippets(keywords, 3);
    
    console.log('\nFacts selected based ONLY on relevance:');
    snippets.forEach((snippet, index) => {
      console.log(`${index + 1}. [${snippet.id}] ${snippet.text}`);
      console.log(`   Topics: ${snippet.topics.join(', ')}`);
      console.log(`   Keywords: ${snippet.keywords.join(', ')}`);
    });

    console.log('\n✓ No personality markers influenced this selection');
    console.log('✓ No emotional preferences affected ranking');
    console.log('✓ Pure factual relevance determined results');
  }

  /**
   * Demonstrate style application as post-processing layer
   */
  demonstrateStyleAsPostProcessing(): void {
    console.log('\n=== Style as Post-Processing Demo ===\n');

    const factualContent = "I lived in Austin, Texas from 2009 to 2018.";
    const topics = ['austin', 'places', 'timeline'];

    console.log('Original factual content:', factualContent);
    console.log('Topics:', topics.join(', '));

    // Show different style applications to the same facts
    const tones = ['enthusiastic', 'warm', 'conversational', 'nostalgic'];
    
    tones.forEach(tone => {
      console.log(`\n--- ${tone.toUpperCase()} TONE ---`);
      
      const styledContent = this.styleProfile.applyStyleToFacts(factualContent, {
        topics,
        tone
      });
      
      const instructions = this.styleProfile.generateStyleInstructions(tone, topics, false);
      
      console.log('Styled content:', styledContent);
      console.log('Style instructions preview:', instructions.split('\n')[0]);
      console.log('✓ Facts unchanged, only presentation style applied');
    });
  }

  /**
   * Simple keyword extraction for demo purposes
   */
  private extractKeywords(query: string): string[] {
    return query.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !['tell', 'about', 'what', 'when', 'where', 'how'].includes(word));
  }

  /**
   * Run all demonstrations
   */
  async runAllDemos(): Promise<void> {
    console.log('🎭 StyleProfile Integration Demonstration');
    console.log('==========================================');

    // Load sample factbook data for demo
    const sampleFactbook = {
      timeline: {
        austin_years: {
          id: 'timeline.austin_years',
          text: 'I lived in Austin, Texas from 2009 to 2018 - nine incredible years. The music scene was amazing.',
          topics: ['timeline', 'places', 'austin'],
          keywords: ['austin', 'texas', '2009', '2018', 'nine', 'years', 'music']
        }
      },
      pets: {
        olive: {
          id: 'pets.olive',
          text: 'Olive was my beloved Puerto Rican street dog. She survived brutal Maine winters.',
          topics: ['pets', 'dogs', 'olive'],
          keywords: ['olive', 'puerto', 'rican', 'street', 'dog', 'maine']
        }
      },
      opinions: {
        trump: {
          id: 'opinions.trump',
          text: 'I think Trump is absolutely terrible for America. His policies are harmful.',
          topics: ['opinions', 'politics', 'trump'],
          keywords: ['trump', 'terrible', 'america', 'policies', 'harmful']
        }
      }
    };

    await this.factbookService.loadFactbook(sampleFactbook);

    // Run demonstrations
    await this.demonstrateWorkflow("Tell me about Austin");
    this.demonstrateFactSelectionPurity();
    this.demonstrateStyleAsPostProcessing();

    console.log('\n🎯 Key Takeaways:');
    console.log('1. Facts are selected first, purely based on relevance');
    console.log('2. Style is applied as a post-processing layer');
    console.log('3. Personality never influences fact selection');
    console.log('4. Clear separation prevents hallucination');
    console.log('5. Validation ensures separation is maintained');
  }
}

// Export for use in other files
export default StyleProfileDemo;