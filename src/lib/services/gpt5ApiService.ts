import { StructuredContext, GPT5Response, ExtractedFact } from './types';
import { ErrorHandlingService } from './errorHandlingService';

export interface GPT5Config {
  apiKey: string;
  baseUrl?: string;
  model: string;
  fallbackModel: string;
  maxTokens: number;
  temperature: number;
  timeout: number;
}

export interface APIResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

export class GPT5ApiService {
  private config: GPT5Config;
  private errorHandler: ErrorHandlingService;

  constructor(config: Partial<GPT5Config>, errorHandler: ErrorHandlingService) {
    this.config = {
      apiKey: process.env.OPENAI_API_KEY || '',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-5-turbo', // Placeholder - actual model name TBD
      fallbackModel: 'gpt-4-turbo-preview',
      maxTokens: 2000,
      temperature: 0.7,
      timeout: 30000,
      ...config
    };
    this.errorHandler = errorHandler;
  }

  /**
   * Generate response using GPT-5 with fallback to GPT-4
   */
  async generateResponse(
    context: StructuredContext,
    userInput: string,
    systemPrompt?: string
  ): Promise<GPT5Response> {
    const startTime = Date.now();

    try {
      // Try GPT-5 first
      const response = await this.errorHandler.executeWithRetry(
        () => this.callAPI(this.config.model, context, userInput, systemPrompt),
        'gpt5_api_call'
      );

      return {
        text: response.choices[0].message.content,
        confidence: this.calculateConfidence(response),
        extractedFacts: this.extractFactsFromResponse(response.choices[0].message.content),
        modelUsed: response.model,
        processingTime: Date.now() - startTime
      };

    } catch (gpt5Error) {
      console.warn('GPT-5 failed, falling back to GPT-4:', gpt5Error);

      try {
        // Fallback to GPT-4
        const fallbackResponse = await this.errorHandler.executeWithRetry(
          () => this.callAPI(this.config.fallbackModel, context, userInput, systemPrompt),
          'gpt4_fallback_call',
          2 // Fewer retries for fallback
        );

        return {
          text: fallbackResponse.choices[0].message.content,
          confidence: this.calculateConfidence(fallbackResponse) * 0.9, // Slightly lower confidence for fallback
          extractedFacts: this.extractFactsFromResponse(fallbackResponse.choices[0].message.content),
          modelUsed: `${fallbackResponse.model} (fallback)`,
          processingTime: Date.now() - startTime
        };

      } catch (fallbackError) {
        console.error('Both GPT-5 and GPT-4 failed:', { gpt5Error, fallbackError });
        
        // Return emergency response
        return {
          text: "I'm experiencing some technical difficulties right now. Could you please try again in a moment?",
          confidence: 0.1,
          extractedFacts: [],
          modelUsed: 'emergency_fallback',
          processingTime: Date.now() - startTime
        };
      }
    }
  }

  /**
   * Validate response quality and content
   */
  validateResponse(response: GPT5Response, context: StructuredContext): {
    isValid: boolean;
    issues: string[];
    quality: 'high' | 'medium' | 'low';
  } {
    const issues: string[] = [];
    let quality: 'high' | 'medium' | 'low' = 'high';

    // Check response length
    if (response.text.length < 10) {
      issues.push('Response too short');
      quality = 'low';
    } else if (response.text.length > 2000) {
      issues.push('Response too long');
      if (quality === 'high') quality = 'medium';
    }

    // Check confidence
    if (response.confidence < 0.3) {
      issues.push('Low confidence response');
      quality = 'low';
    } else if (response.confidence < 0.7) {
      issues.push('Medium confidence response');
      if (quality === 'high') quality = 'medium';
    }

    // Check for hallucination indicators
    if (this.detectPotentialHallucination(response.text, context)) {
      issues.push('Potential hallucination detected');
      quality = 'low';
    }

    // Check processing time
    if (response.processingTime > 10000) {
      issues.push('Slow response time');
      if (quality === 'high') quality = 'medium';
    }

    return {
      isValid: issues.length === 0 || quality !== 'low',
      issues,
      quality
    };
  }

  /**
   * Make API call to OpenAI
   */
  private async callAPI(
    model: string,
    context: StructuredContext,
    userInput: string,
    systemPrompt?: string
  ): Promise<APIResponse> {
    const messages = [
      {
        role: 'system',
        content: systemPrompt || this.buildSystemPrompt(context)
      },
      ...context.conversationHistory.map(turn => ({
        role: turn.role,
        content: turn.content
      })),
      {
        role: 'user',
        content: userInput
      }
    ];

    const requestBody = {
      model,
      messages,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      stream: false
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API call failed: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
      }

      return await response.json();

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`API call timed out after ${this.config.timeout}ms`);
      }
      
      throw error;
    }
  }

  /**
   * Build system prompt from structured context
   */
  private buildSystemPrompt(context: StructuredContext): string {
    let prompt = "You are a personal avatar assistant. ";

    // Add identity facts
    const identityFacts = context.quickFacts.filter(fact => 
      fact.priority && fact.priority <= 3
    );
    if (identityFacts.length > 0) {
      prompt += "Here's what you know about yourself and the user:\n";
      identityFacts.forEach(fact => {
        prompt += `- ${fact.key}: ${fact.value}\n`;
      });
    }

    // Add other relevant facts
    const otherFacts = context.quickFacts.filter(fact => 
      !fact.priority || fact.priority > 3
    );
    if (otherFacts.length > 0) {
      prompt += "\nAdditional context:\n";
      otherFacts.forEach(fact => {
        prompt += `- ${fact.key}: ${fact.value}\n`;
      });
    }

    // Add memory fragments
    if (context.memoryFragments.length > 0) {
      prompt += "\nRelevant memories:\n";
      context.memoryFragments.slice(0, 5).forEach(memory => {
        prompt += `- ${memory.fragmentText}\n`;
      });
    }

    prompt += "\nRespond naturally and personally, referencing the context above when relevant. ";
    prompt += "Never contradict established facts unless the user explicitly corrects them.";

    return prompt;
  }

  /**
   * Calculate response confidence based on API response
   */
  private calculateConfidence(response: APIResponse): number {
    let confidence = 0.8; // Base confidence

    // Adjust based on finish reason
    if (response.choices[0].finish_reason === 'stop') {
      confidence += 0.1;
    } else if (response.choices[0].finish_reason === 'length') {
      confidence -= 0.2;
    }

    // Adjust based on token usage
    const tokenRatio = response.usage.completion_tokens / response.usage.prompt_tokens;
    if (tokenRatio > 0.1 && tokenRatio < 2.0) {
      confidence += 0.1;
    } else {
      confidence -= 0.1;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Extract facts from response text (simplified implementation)
   */
  private extractFactsFromResponse(text: string): ExtractedFact[] {
    // This is a simplified implementation
    // In practice, this would use more sophisticated NLP
    const facts: ExtractedFact[] = [];
    
    // Look for patterns like "My name is X" or "I am X"
    const namePattern = /(?:my name is|i am|i'm called)\s+([a-zA-Z\s]+)/gi;
    let match;
    
    while ((match = namePattern.exec(text)) !== null) {
      facts.push({
        key: 'name',
        value: match[1].trim(),
        confidence: 0.7,
        priority: 1,
        source: 'extraction',
        sourceReference: 'response_text'
      });
    }

    return facts;
  }

  /**
   * Detect potential hallucination in response
   */
  private detectPotentialHallucination(text: string, context: StructuredContext): boolean {
    // Check for contradictions with known facts
    const knownFacts = context.quickFacts.filter(fact => fact.confidence && fact.confidence > 0.8);
    
    for (const fact of knownFacts) {
      // Simple contradiction detection
      if (fact.key === 'name' && text.toLowerCase().includes('my name is')) {
        const nameInResponse = text.match(/my name is\s+([a-zA-Z\s]+)/i);
        if (nameInResponse && nameInResponse[1].trim().toLowerCase() !== fact.value.toLowerCase()) {
          return true;
        }
      }
    }

    // Check for impossible claims
    const impossiblePatterns = [
      /i can see you/i,
      /i am looking at/i,
      /i can physically/i,
      /i remember when we met in person/i
    ];

    return impossiblePatterns.some(pattern => pattern.test(text));
  }
}