import OpenAI from 'openai';
import { QuickFact, Memory, ConversationTurn } from './promptBuilder';
import { pickModel } from '@/lib/modelRouter';

export interface StructuredContext {
  quickFacts: QuickFact[];
  memoryFragments: Memory[];
  conversationHistory: ConversationTurn[];
  retrievalMetadata: RetrievalMetadata;
}

export interface RetrievalMetadata {
  avatarId: string;
  query: string;
  retrievalTime: number;
  factsCount: number;
  memoriesCount: number;
  historyCount: number;
  fastMode?: boolean;
}

export interface GPT5Response {
  text: string;
  confidence: number;
  extractedFacts: ExtractedFact[];
  modelUsed: string;
  processingTime: number;
  tokenUsage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ExtractedFact {
  key: string;
  value: string;
  confidence: number;
  priority: number;
  source: string;
  sourceReference: string;
}

export interface GPT5ServiceConfig {
  primaryModel: string;
  fallbackModel: string;
  maxTokens: number;
  temperature: number;
  timeout: number;
  maxRetries: number;
  confidenceThreshold: number;
}

/**
 * GPT-5 Integration Service with structured context handling
 * Provides intelligent conversation processing with automatic fallback to GPT-4
 */
export class GPT5Service {
  private config: GPT5ServiceConfig;
  private openai: OpenAI;

  constructor(config?: Partial<GPT5ServiceConfig>, openaiClient?: OpenAI) {
    this.config = {
      primaryModel: pickModel(),
      fallbackModel: process.env.MODEL_FALLBACK || 'gpt-4o',
      maxTokens: 500,
      temperature: 0.7,
      timeout: 10000,
      maxRetries: 3,
      confidenceThreshold: 0.7,
      ...config
    };

    this.openai = openaiClient || new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Generate response using GPT-5 with structured context
   * Implements requirements 3.1, 3.2, 3.3, 3.4, 3.5
   */
  async generateResponse(
    context: StructuredContext,
    userInput: string,
    systemPrompt?: string
  ): Promise<GPT5Response> {
    const startTime = Date.now();
    let modelUsed = this.config.primaryModel;
    let attempt = 0;

    while (attempt < this.config.maxRetries) {
      try {
        // Format context for GPT-5 consumption
        const formattedPrompt = systemPrompt || this.formatContextForGPT5(context);
        
        // Create completion with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const completion = await this.openai.chat.completions.create({
          model: modelUsed,
          messages: [
            { role: 'system', content: formattedPrompt },
            { role: 'user', content: userInput }
          ],
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          stream: false
        }, {
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!completion.choices || !completion.choices[0] || !completion.choices[0].message) {
          throw new Error('Invalid API response format');
        }

        const responseText = completion.choices[0].message.content || '';
        const processingTime = Date.now() - startTime;

        // Validate response quality
        const confidence = this.calculateResponseConfidence(responseText, context);
        
        if (confidence < this.config.confidenceThreshold && attempt === 0 && modelUsed === this.config.primaryModel) {
          // Try fallback model if confidence is low
          modelUsed = this.config.fallbackModel;
          attempt++;
          continue;
        }

        // Extract facts from response
        const extractedFacts = await this.extractFactsFromResponse(responseText, userInput, context);

        return {
          text: responseText,
          confidence,
          extractedFacts,
          modelUsed,
          processingTime,
          tokenUsage: completion.usage ? {
            prompt_tokens: completion.usage.prompt_tokens,
            completion_tokens: completion.usage.completion_tokens,
            total_tokens: completion.usage.total_tokens
          } : undefined
        };

      } catch (error) {
        attempt++;
        
        // Handle specific error types
        if (this.isRateLimitError(error)) {
          // Wait before retry for rate limits
          await this.delay(Math.pow(2, attempt) * 1000);
        } else if (this.isTimeoutError(error)) {
          // Reduce timeout for next attempt
          this.config.timeout = Math.max(5000, this.config.timeout * 0.8);
        }

        // Try fallback model on first failure
        if (attempt === 1 && modelUsed === this.config.primaryModel) {
          modelUsed = this.config.fallbackModel;
        }

        // If all retries exhausted, throw error
        if (attempt >= this.config.maxRetries) {
          throw new Error(`GPT-5 service failed after ${attempt} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }

    throw new Error('Unexpected error in GPT-5 service');
  }

  /**
   * Validate response quality and content
   * Implements requirement 3.5 for hallucination reduction
   */
  validateResponse(response: string, context: StructuredContext): boolean {
    if (!response || response.trim().length === 0) {
      return false;
    }

    // Check for common hallucination patterns
    const hallucination_patterns = [
      /I don't have access to/i,
      /I cannot access/i,
      /I don't know/i,
      /I'm not sure/i,
      /I cannot remember/i
    ];

    // Response should not contain denial patterns when context has relevant facts
    const hasRelevantFacts = context.quickFacts.length > 0 || context.memoryFragments.length > 0;
    if (hasRelevantFacts) {
      for (const pattern of hallucination_patterns) {
        if (pattern.test(response)) {
          return false;
        }
      }
    }

    // Check for factual consistency with stored data
    return this.checkFactualConsistency(response, context);
  }

  /**
   * Format structured context for GPT-5 consumption
   * Implements requirement 3.2 for structured memory injection
   */
  private formatContextForGPT5(context: StructuredContext): string {
    const sections: string[] = [];

    // Core identity section
    const identityFacts = context.quickFacts.filter(f => 
      f.category === 'identity' || f.priority <= 2
    );
    if (identityFacts.length > 0) {
      sections.push('## Core Identity');
      identityFacts.forEach(fact => {
        sections.push(`- ${fact.key}: ${fact.value} (confidence: ${fact.confidence})`);
      });
    }

    // Contextual facts section
    const contextualFacts = context.quickFacts.filter(f => 
      f.category !== 'identity' && f.priority > 2
    );
    if (contextualFacts.length > 0) {
      sections.push('## Personal Facts');
      contextualFacts.forEach(fact => {
        sections.push(`- ${fact.key}: ${fact.value}`);
      });
    }

    // Relevant memories section
    if (context.memoryFragments.length > 0) {
      sections.push('## Relevant Memories');
      context.memoryFragments.forEach((memory, index) => {
        sections.push(`${index + 1}. ${memory.fragment_text}`);
        if (memory.title) {
          sections.push(`   Title: ${memory.title}`);
        }
      });
    }

    // Recent conversation history
    if (context.conversationHistory.length > 0) {
      sections.push('## Recent Conversation');
      context.conversationHistory.slice(-6).forEach(turn => {
        sections.push(`${turn.role}: ${turn.content}`);
      });
    }

    // Instructions for GPT-5
    sections.push('## Instructions');
    sections.push('- Respond as this person based on the provided facts and memories');
    sections.push('- Never contradict established facts unless explicitly corrected');
    sections.push('- Reference memories naturally when relevant');
    sections.push('- Maintain consistent personality and speaking style');
    sections.push('- If uncertain about a fact, acknowledge the uncertainty gracefully');

    return sections.join('\n');
  }

  /**
   * Calculate response confidence based on context alignment
   */
  private calculateResponseConfidence(response: string, context: StructuredContext): number {
    let confidence = 0.5; // Base confidence

    // Boost confidence if response references known facts
    const referencedFacts = context.quickFacts.filter(fact => 
      response.toLowerCase().includes(fact.value.toLowerCase())
    );
    confidence += Math.min(0.3, referencedFacts.length * 0.1);

    // Boost confidence if response references memories
    const referencedMemories = context.memoryFragments.filter(memory =>
      this.hasSemanticOverlap(response, memory.fragment_text)
    );
    confidence += Math.min(0.2, referencedMemories.length * 0.05);

    // Reduce confidence for generic responses
    if (response.length < 50) {
      confidence -= 0.2;
    }

    // Reduce confidence for denial patterns when context exists
    const hasContext = context.quickFacts.length > 0 || context.memoryFragments.length > 0;
    if (hasContext && /I don't|I can't|I'm not sure/i.test(response)) {
      confidence -= 0.3;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Extract new facts from the generated response
   */
  private async extractFactsFromResponse(
    response: string,
    userInput: string,
    context: StructuredContext
  ): Promise<ExtractedFact[]> {
    try {
      const extractionPrompt = `
Extract any new factual information from this conversation that should be remembered:

User: ${userInput}
Assistant: ${response}

Return a JSON array of facts in this format:
[{"key": "fact_key", "value": "fact_value", "confidence": 0.8, "priority": 5}]

Only extract clear, factual information. Do not extract opinions or temporary states.
`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // Use smaller model for extraction
        messages: [{ role: 'user', content: extractionPrompt }],
        max_tokens: 300,
        temperature: 0.1
      });

      const extractionResponse = completion.choices[0]?.message?.content || '';
      const jsonMatch = extractionResponse.match(/\[[\s\S]*\]/);
      
      if (!jsonMatch) {
        return [];
      }

      const extractedData = JSON.parse(jsonMatch[0]);
      return extractedData.map((fact: any) => ({
        key: fact.key,
        value: fact.value,
        confidence: fact.confidence || 0.7,
        priority: fact.priority || 5,
        source: 'llm',
        sourceReference: `conversation_${Date.now()}`
      }));

    } catch (error) {
      console.warn('Failed to extract facts from response:', error);
      return [];
    }
  }

  /**
   * Check factual consistency with stored data
   */
  private checkFactualConsistency(response: string, context: StructuredContext): boolean {
    // Check if response contradicts any high-confidence facts
    const highConfidenceFacts = context.quickFacts.filter(f => f.confidence > 0.8);
    
    for (const fact of highConfidenceFacts) {
      // Simple contradiction detection - can be enhanced with NLP
      if (this.detectContradiction(response, fact)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Detect if response contradicts a known fact
   */
  private detectContradiction(response: string, fact: QuickFact): boolean {
    const responseLower = response.toLowerCase();
    const factValue = fact.value.toLowerCase();

    // Simple patterns for contradiction detection
    // This can be enhanced with more sophisticated NLP
    if (fact.key === 'pet_name' && responseLower.includes('no pet') && responseLower.includes(factValue)) {
      return true;
    }

    if (fact.key === 'birth_place' && responseLower.includes('born in') && !responseLower.includes(factValue)) {
      return true;
    }

    return false;
  }

  /**
   * Check for semantic overlap between texts
   */
  private hasSemanticOverlap(text1: string, text2: string): boolean {
    const words1 = text1.toLowerCase().split(/\W+/).filter(w => w.length > 3);
    const words2 = text2.toLowerCase().split(/\W+/).filter(w => w.length > 3);
    
    const overlap = words1.filter(word => words2.includes(word));
    return overlap.length >= 2;
  }

  /**
   * Check if error is a rate limit error
   */
  private isRateLimitError(error: any): boolean {
    return error?.status === 429 || error?.message?.includes('rate limit');
  }

  /**
   * Check if error is a timeout error
   */
  private isTimeoutError(error: any): boolean {
    return error?.name === 'AbortError' || error?.message?.includes('timeout');
  }

  /**
   * Delay utility for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const gpt5Service = new GPT5Service();