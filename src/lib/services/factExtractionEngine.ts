/**
 * Fact Extraction Engine - Orchestrator for Hot Facts Pipeline
 * 
 * Coordinates pattern heuristics and LLM extraction stages with error handling,
 * graceful degradation, and performance monitoring.
 */

import { PatternExtractor, ExtractedFact, PatternExtractionResult } from './patternExtractor';
import { LLMExtractor, LLMExtractionResult } from './llmExtractor';
import { 
  ExtractionErrorHandler, 
  ExtractionError, 
  ExtractionErrorType
} from './extractionErrorHandler';
import { ExtractionPerformanceMonitor, recordMetric } from './extractionPerformanceMonitor';

export interface FactExtractionConfig {
  enableLLMRefinement: boolean;
  llmFallbackOnPatternFailure: boolean;
  maxProcessingTimeMs: number;
  minConfidenceThreshold: number;
}

export interface FactExtractionResult {
  facts: ExtractedFact[];
  processing_time_ms: number;
  errors: string[];
  stage_results: {
    pattern: PatternExtractionResult | null;
    llm: LLMExtractionResult | null;
  };
  performance_metrics: {
    pattern_facts_count: number;
    llm_facts_count: number;
    total_facts_count: number;
    deduplication_removed: number;
    confidence_filtered: number;
  };
}

export interface ExtractionMetrics {
  total_extractions: number;
  successful_extractions: number;
  pattern_failures: number;
  llm_failures: number;
  average_processing_time_ms: number;
  facts_extracted_per_extraction: number;
}

export class FactExtractionEngine {
  private patternExtractor: PatternExtractor;
  private llmExtractor: LLMExtractor;
  private config: FactExtractionConfig;
  private metrics: ExtractionMetrics;
  private performanceMonitor: ExtractionPerformanceMonitor;

  constructor(config?: Partial<FactExtractionConfig>) {
    this.patternExtractor = new PatternExtractor();
    this.llmExtractor = new LLMExtractor();
    this.performanceMonitor = ExtractionPerformanceMonitor.getInstance();
    
    this.config = {
      enableLLMRefinement: true,
      llmFallbackOnPatternFailure: true,
      maxProcessingTimeMs: 30000, // 30 seconds max
      minConfidenceThreshold: 0.5,
      ...config
    };

    this.metrics = {
      total_extractions: 0,
      successful_extractions: 0,
      pattern_failures: 0,
      llm_failures: 0,
      average_processing_time_ms: 0,
      facts_extracted_per_extraction: 0
    };
  }

  /**
   * Extract facts from text using coordinated pattern and LLM extraction
   */
  async extractFacts(text: string, avatarId?: string): Promise<FactExtractionResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let patternResult: PatternExtractionResult | null = null;
    let llmResult: LLMExtractionResult | null = null;

    this.metrics.total_extractions++;

    // Validate input
    if (!text || text.trim().length === 0) {
      return this.createEmptyResult(startTime, ['Empty or invalid input text']);
    }

    // Check processing time limit
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Processing timeout exceeded')), this.config.maxProcessingTimeMs);
    });

    try {
      // Stage A: Pattern Heuristics Extraction
      try {
        patternResult = await ExtractionErrorHandler.withGracefulDegradation(
          () => this.executePatternExtraction(text, avatarId),
          () => Promise.resolve({ facts: [], processing_time_ms: 0, errors: [] }),
          'pattern',
          { text: text.substring(0, 100) }
        );
      } catch (patternError) {
        this.metrics.pattern_failures++;
        const extractionError = patternError instanceof ExtractionError ? patternError : 
          ExtractionErrorHandler.categorizeExtractionError(patternError, 'pattern');
        errors.push(`Pattern extraction failed: ${extractionError.message}`);
        patternResult = null;
      }

      // Stage B: LLM Refinement (if enabled and pattern extraction succeeded or failed gracefully)
      if (this.config.enableLLMRefinement) {
        try {
          llmResult = await ExtractionErrorHandler.withGracefulDegradation(
            () => this.executeLLMExtraction(text, patternResult?.facts || [], avatarId),
            () => Promise.resolve({ facts: [], processing_time_ms: 0, errors: [] }),
            'llm',
            { text: text.substring(0, 100), heuristicFactsCount: patternResult?.facts?.length || 0 }
          );
          if (llmResult?.errors && llmResult.errors.length > 0) {
            errors.push(...llmResult.errors.map(e => `LLM extraction failed: ${e}`));
          }
        } catch (llmError) {
          this.metrics.llm_failures++;
          const extractionError = llmError instanceof ExtractionError ? llmError : 
            ExtractionErrorHandler.categorizeExtractionError(llmError, 'llm');
          errors.push(`LLM extraction failed: ${extractionError.message}`);
          
          // Continue with pattern results only
          if (!patternResult || patternResult.facts.length === 0) {
            // If both pattern and LLM failed, try LLM fallback if enabled
            if (this.config.llmFallbackOnPatternFailure) {
              try {
                llmResult = await ExtractionErrorHandler.withGracefulDegradation(
                  () => this.executeLLMFallback(text, avatarId),
                  () => Promise.resolve({ facts: [], processing_time_ms: 0, errors: [] }),
                  'llm',
                  { text: text.substring(0, 100), fallbackMode: true }
                );
                if (llmResult?.errors && llmResult.errors.length > 0) {
                  errors.push(...llmResult.errors.map(e => `LLM fallback failed: ${e}`));
                }
              } catch (fallbackError) {
                const fallbackExtractionError = fallbackError instanceof ExtractionError ? fallbackError : 
                  ExtractionErrorHandler.categorizeExtractionError(fallbackError, 'llm');
                errors.push(`LLM fallback failed: ${fallbackExtractionError.message}`);
              }
            }
          }
        }
      }

      // Combine and deduplicate results
      const combinedFacts = this.combineResults(patternResult, llmResult);
      const deduplicatedFacts = this.deduplicateFacts(combinedFacts);
      const filteredFacts = this.filterByConfidence(deduplicatedFacts);

      const processing_time_ms = Date.now() - startTime;
      
      // Update metrics
      this.updateMetrics(processing_time_ms, filteredFacts.length, errors.length === 0);
      ExtractionErrorHandler.updateExtractionMetrics(processing_time_ms, filteredFacts.length, errors.length === 0);
      
      // Record end-to-end performance
      this.performanceMonitor.recordExtractionPerformance(
        'end_to_end',
        processing_time_ms,
        errors.length === 0,
        {
          textLength: text.length,
          facts_count: filteredFacts.length,
          pattern_facts: patternResult?.facts.length || 0,
          llm_facts: llmResult?.facts.length || 0,
          deduplication_removed: combinedFacts.length - deduplicatedFacts.length,
          confidence_filtered: deduplicatedFacts.length - filteredFacts.length
        }
      );

      const result: FactExtractionResult = {
        facts: filteredFacts,
        processing_time_ms,
        errors,
        stage_results: {
          pattern: patternResult,
          llm: llmResult
        },
        performance_metrics: {
          pattern_facts_count: patternResult?.facts.length || 0,
          llm_facts_count: llmResult?.facts.length || 0,
          total_facts_count: combinedFacts.length,
          deduplication_removed: combinedFacts.length - deduplicatedFacts.length,
          confidence_filtered: deduplicatedFacts.length - filteredFacts.length
        }
      };

      return result;

    } catch (error) {
      const processing_time_ms = Date.now() - startTime;
      const extractionError = error instanceof ExtractionError ? error : 
        ExtractionErrorHandler.categorizeExtractionError(error, 'orchestration');
      errors.push(`Extraction engine error: ${extractionError.message}`);
      
      this.updateMetrics(processing_time_ms, 0, false);
      ExtractionErrorHandler.updateExtractionMetrics(processing_time_ms, 0, false);
      
      return {
        facts: [],
        processing_time_ms,
        errors,
        stage_results: {
          pattern: patternResult,
          llm: llmResult
        },
        performance_metrics: {
          pattern_facts_count: 0,
          llm_facts_count: 0,
          total_facts_count: 0,
          deduplication_removed: 0,
          confidence_filtered: 0
        }
      };
    }
  }

  /**
   * Execute pattern extraction with error handling
   */
  private async executePatternExtraction(text: string, avatarId?: string): Promise<PatternExtractionResult> {
    const startTime = Date.now();
    
    try {
      const result = await ExtractionErrorHandler.withExtractionRetry(
        () => Promise.resolve(this.patternExtractor.extractFacts(text)),
        'pattern',
        { text: text.substring(0, 100), textLength: text.length }
      );
      
      // Record successful pattern extraction performance
      this.performanceMonitor.recordExtractionPerformance(
        'pattern',
        Date.now() - startTime,
        true,
        { 
          textLength: text.length,
          factsExtracted: result.facts.length,
          processingTime: result.processing_time_ms
        }
      );
      recordMetric(avatarId, 'pattern', true, Date.now() - startTime);
      
      return result;
    } catch (error) {
      // Record failed pattern extraction performance
      this.performanceMonitor.recordExtractionPerformance(
        'pattern',
        Date.now() - startTime,
        false,
        { 
          textLength: text.length,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      );
      recordMetric(avatarId, 'pattern', false, Date.now() - startTime, { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  /**
   * Execute LLM extraction with error handling
   */
  private async executeLLMExtraction(text: string, heuristicFacts: ExtractedFact[], avatarId?: string): Promise<LLMExtractionResult> {
    const startTime = Date.now();
    
    try {
      // Custom retry: initial + 2 retries with 250ms then 750ms backoff
      const delays = [0, 250, 750];
      let lastError: any = null;
      for (let i = 0; i < delays.length; i++) {
        if (delays[i] > 0) {
          await new Promise(res => setTimeout(res, delays[i]));
        }
        try {
          const result = await this.llmExtractor.refineExtraction(text, heuristicFacts);
          // Record successful LLM extraction performance
          this.performanceMonitor.recordExtractionPerformance(
            'llm',
            Date.now() - startTime,
            true,
            { 
              textLength: text.length,
              heuristicFactsCount: heuristicFacts.length,
              factsExtracted: result.facts.length,
              processingTime: result.processing_time_ms,
              input_tokens: (result as any).input_tokens || 0,
              output_tokens: (result as any).output_tokens || 0,
              cost_estimate: (result as any).cost_estimate || 0
            }
          );
          recordMetric(avatarId, 'llm', true, Date.now() - startTime);
          return result;
        } catch (err) {
          lastError = err;
        }
      }
      // After retries, return failure result (do not throw) to allow partial results
      const msg = lastError instanceof Error ? lastError.message : 'Unknown error';
      this.performanceMonitor.recordExtractionPerformance(
        'llm',
        Date.now() - startTime,
        false,
        { 
          textLength: text.length,
          heuristicFactsCount: heuristicFacts.length,
          error: msg
        }
      );
      recordMetric(avatarId, 'llm', false, Date.now() - startTime, { error: msg });
      return { facts: [], processing_time_ms: Date.now() - startTime, errors: [msg], llm_confidence: 0 };
      
    } catch (error) {
      // Record failed LLM extraction performance
      this.performanceMonitor.recordExtractionPerformance(
        'llm',
        Date.now() - startTime,
        false,
        { 
          textLength: text.length,
          heuristicFactsCount: heuristicFacts.length,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      );
      recordMetric(avatarId, 'llm', false, Date.now() - startTime, { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  /**
   * Execute LLM fallback when pattern extraction fails
   */
  private async executeLLMFallback(text: string, avatarId?: string): Promise<LLMExtractionResult> {
    const startTime = Date.now();
    try {
      // Same retry policy for fallback
      const delays = [0, 250, 750];
      let lastError: any = null;
      for (let i = 0; i < delays.length; i++) {
        if (delays[i] > 0) {
          await new Promise(res => setTimeout(res, delays[i]));
        }
        try {
          const result = await this.llmExtractor.extractFacts(text);
          recordMetric(avatarId, 'llm', true, Date.now() - startTime);
          return result;
        } catch (err) {
          lastError = err;
        }
      }
      const msg = lastError instanceof Error ? lastError.message : 'Unknown error';
      recordMetric(avatarId, 'llm', false, Date.now() - startTime, { error: msg });
      return { facts: [], processing_time_ms: Date.now() - startTime, errors: [msg], llm_confidence: 0 };
    } catch (error) {
      recordMetric(avatarId, 'llm', false, Date.now() - startTime, { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  /**
   * Combine results from pattern and LLM extraction
   */
  private combineResults(
    patternResult: PatternExtractionResult | null,
    llmResult: LLMExtractionResult | null
  ): ExtractedFact[] {
    const facts: ExtractedFact[] = [];

    // Add pattern facts
    if (patternResult?.facts) {
      facts.push(...patternResult.facts);
    }

    // Add LLM facts
    if (llmResult?.facts) {
      facts.push(...llmResult.facts);
    }

    return facts;
  }

  /**
   * Remove duplicate facts, preferring higher confidence scores
   */
  private deduplicateFacts(facts: ExtractedFact[]): ExtractedFact[] {
    const factMap = new Map<string, ExtractedFact>();

    for (const fact of facts) {
      const existing = factMap.get(fact.key);
      
      if (!existing) {
        factMap.set(fact.key, fact);
      } else {
        // Keep the fact with higher confidence
        if (fact.confidence > existing.confidence) {
          factMap.set(fact.key, fact);
        } else if (fact.confidence === existing.confidence) {
          // If confidence is equal, prefer pattern extraction (more reliable)
          if (fact.extraction_method === 'pattern' && existing.extraction_method === 'llm') {
            factMap.set(fact.key, fact);
          }
        }
      }
    }

    return Array.from(factMap.values());
  }

  /**
   * Filter facts by minimum confidence threshold
   */
  private filterByConfidence(facts: ExtractedFact[]): ExtractedFact[] {
    return facts.filter(fact => fact.confidence >= this.config.minConfidenceThreshold);
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(processingTime: number, factsCount: number, success: boolean): void {
    if (success) {
      this.metrics.successful_extractions++;
    }

    // Update running average for processing time
    const totalTime = this.metrics.average_processing_time_ms * (this.metrics.total_extractions - 1) + processingTime;
    this.metrics.average_processing_time_ms = totalTime / this.metrics.total_extractions;

    // Update running average for facts per extraction
    const totalFacts = this.metrics.facts_extracted_per_extraction * (this.metrics.total_extractions - 1) + factsCount;
    this.metrics.facts_extracted_per_extraction = totalFacts / this.metrics.total_extractions;
  }

  /**
   * Create empty result for error cases
   */
  private createEmptyResult(startTime: number, errors: string[]): FactExtractionResult {
    return {
      facts: [],
      processing_time_ms: Date.now() - startTime,
      errors,
      stage_results: {
        pattern: null,
        llm: null
      },
      performance_metrics: {
        pattern_facts_count: 0,
        llm_facts_count: 0,
        total_facts_count: 0,
        deduplication_removed: 0,
        confidence_filtered: 0
      }
    };
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): ExtractionMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset performance metrics
   */
  resetMetrics(): void {
    this.metrics = {
      total_extractions: 0,
      successful_extractions: 0,
      pattern_failures: 0,
      llm_failures: 0,
      average_processing_time_ms: 0,
      facts_extracted_per_extraction: 0
    };
  }

  /**
   * Get success rate as percentage
   */
  getSuccessRate(): number {
    if (this.metrics.total_extractions === 0) {
      return 0;
    }
    return (this.metrics.successful_extractions / this.metrics.total_extractions) * 100;
  }

  /**
   * Check if extraction engine is healthy based on recent performance
   */
  isHealthy(): boolean {
    const successRate = this.getSuccessRate();
    const avgProcessingTime = this.metrics.average_processing_time_ms;
    
    return successRate >= 80 && avgProcessingTime < 15000; // 80% success rate, under 15s avg
  }

  /**
   * Extract facts with timeout and graceful degradation
   */
  async extractFactsWithTimeout(text: string, timeoutMs?: number, avatarId?: string): Promise<FactExtractionResult> {
    const timeout = timeoutMs || this.config.maxProcessingTimeMs;
    const startTime = Date.now();
    
    try {
      return await ExtractionErrorHandler.withExtractionTimeout(
        () => this.extractFacts(text, avatarId),
        timeout,
        'orchestration',
        { text: text.substring(0, 100), timeoutMs: timeout }
      );
    } catch (error) {
      // Return graceful degradation result
      const extractionError = error instanceof ExtractionError ? error : 
        ExtractionErrorHandler.categorizeExtractionError(error, 'orchestration');
      
      return this.createEmptyResult(startTime, [
        `Extraction failed: ${extractionError.message}`
      ]);
    }
  }

  /**
   * Get comprehensive extraction health status
   */
  getExtractionHealthStatus(): {
    engine: {
      isHealthy: boolean;
      successRate: number;
      avgProcessingTime: number;
    };
    pipeline: {
      isHealthy: boolean;
      successRate: number;
      failuresByStage: any;
      recommendations: string[];
    };
  } {
    const engineHealthy = this.isHealthy();
    const engineSuccessRate = this.getSuccessRate();
    const pipelineHealth = ExtractionErrorHandler.getExtractionHealthReport();
    
    return {
      engine: {
        isHealthy: engineHealthy,
        successRate: engineSuccessRate,
        avgProcessingTime: this.metrics.average_processing_time_ms
      },
      pipeline: {
        isHealthy: pipelineHealth.isHealthy,
        successRate: pipelineHealth.successRate,
        failuresByStage: pipelineHealth.failuresByStage,
        recommendations: pipelineHealth.recommendations
      }
    };
  }
}