// src/lib/services/resultFuser.ts
// Result fusion component using Reciprocal Rank Fusion algorithm

import { FactbookSnippet } from './factbookService';
import { BM25Result } from './bm25Retriever';
import { VectorResult } from './vectorRetriever';

/**
 * Configuration for result fusion
 */
export interface FusionConfig {
  method: 'reciprocal_rank' | 'weighted_sum' | 'borda_count';
  k: number; // RRF parameter, default 60
  bm25Weight: number; // Default: 0.6
  vectorWeight: number; // Default: 0.4
}

/**
 * Unified result type for fusion
 */
export interface FusedResult {
  snippet: FactbookSnippet;
  score: number;
  source: 'bm25' | 'vector' | 'both';
  metadata: {
    bm25Score?: number;
    vectorSimilarity?: number;
    fusionScore: number;
    rank: number;
    termMatches?: string[];
  };
}

/**
 * Result fusion class that combines BM25 and vector search results
 * Uses Reciprocal Rank Fusion (RRF) algorithm for optimal ranking
 */
export class ResultFuser {
  private config: FusionConfig;

  constructor(config: FusionConfig) {
    this.config = config;
    
    console.log('result_fuser_initialized', {
      method: config.method,
      k: config.k,
      bm25_weight: config.bm25Weight,
      vector_weight: config.vectorWeight
    });
  }

  /**
   * Fuse BM25 and vector search results using configured algorithm
   * Removes duplicates and maintains snippet metadata
   */
  fuse(
    bm25Results: BM25Result[],
    vectorResults: VectorResult[]
  ): FusedResult[] {
    const startTime = Date.now();

    console.log('result_fusion_start', {
      method: this.config.method,
      bm25_count: bm25Results.length,
      vector_count: vectorResults.length
    });

    let fusedResults: FusedResult[];

    switch (this.config.method) {
      case 'reciprocal_rank':
        fusedResults = this.reciprocalRankFusion(bm25Results, vectorResults);
        break;
      case 'weighted_sum':
        fusedResults = this.weightedSumFusion(bm25Results, vectorResults);
        break;
      case 'borda_count':
        fusedResults = this.bordaCountFusion(bm25Results, vectorResults);
        break;
      default:
        throw new Error(`Unsupported fusion method: ${this.config.method}`);
    }

    const elapsedMs = Date.now() - startTime;
    
    console.log('result_fusion_complete', {
      method: this.config.method,
      input_bm25: bm25Results.length,
      input_vector: vectorResults.length,
      output_count: fusedResults.length,
      fusion_time_ms: elapsedMs,
      top_scores: fusedResults.slice(0, 3).map(r => ({
        id: r.snippet.id,
        score: r.score.toFixed(4),
        source: r.source
      }))
    });

    return fusedResults;
  }

  /**
   * Reciprocal Rank Fusion implementation
   * RRF(d) = Σ(1 / (k + rank_i(d))) for all ranking systems i
   */
  private reciprocalRankFusion(
    bm25Results: BM25Result[],
    vectorResults: VectorResult[]
  ): FusedResult[] {
    const k = this.config.k;
    const scoreMap = new Map<string, {
      snippet: FactbookSnippet;
      rrfScore: number;
      bm25Score?: number;
      vectorSimilarity?: number;
      bm25Rank?: number;
      vectorRank?: number;
      termMatches?: string[];
      sources: Set<'bm25' | 'vector'>;
    }>();

    // Process BM25 results
    bm25Results.forEach((result, index) => {
      const rank = index + 1; // 1-based ranking
      const rrfContribution = 1 / (k + rank);
      
      scoreMap.set(result.snippet.id, {
        snippet: result.snippet,
        rrfScore: rrfContribution,
        bm25Score: result.score,
        bm25Rank: rank,
        termMatches: result.termMatches,
        sources: new Set(['bm25'])
      });
    });

    // Process vector results
    vectorResults.forEach((result, index) => {
      const rank = index + 1; // 1-based ranking
      const rrfContribution = 1 / (k + rank);
      const snippetId = result.snippet.id;
      
      if (scoreMap.has(snippetId)) {
        // Combine with existing BM25 result
        const existing = scoreMap.get(snippetId)!;
        existing.rrfScore += rrfContribution;
        existing.vectorSimilarity = result.similarity;
        existing.vectorRank = rank;
        existing.sources.add('vector');
      } else {
        // New result from vector search only
        scoreMap.set(snippetId, {
          snippet: result.snippet,
          rrfScore: rrfContribution,
          vectorSimilarity: result.similarity,
          vectorRank: rank,
          sources: new Set(['vector'])
        });
      }
    });

    // Convert to FusedResult array and sort by RRF score
    const fusedResults: FusedResult[] = Array.from(scoreMap.values())
      .map((item, index) => ({
        snippet: item.snippet,
        score: item.rrfScore,
        source: item.sources.size > 1 ? 'both' as const : 
                item.sources.has('bm25') ? 'bm25' as const : 'vector' as const,
        metadata: {
          bm25Score: item.bm25Score,
          vectorSimilarity: item.vectorSimilarity,
          fusionScore: item.rrfScore,
          rank: index + 1,
          termMatches: item.termMatches
        }
      }))
      .sort((a, b) => {
        // Sort by RRF score (descending)
        if (a.score !== b.score) {
          return b.score - a.score;
        }
        // Tie-breaking: prefer results from both sources
        if (a.source === 'both' && b.source !== 'both') return -1;
        if (b.source === 'both' && a.source !== 'both') return 1;
        // Then prefer shorter text
        if (a.snippet.text.length !== b.snippet.text.length) {
          return a.snippet.text.length - b.snippet.text.length;
        }
        // Finally, lexicographic by ID for deterministic ordering
        return a.snippet.id.localeCompare(b.snippet.id);
      });

    // Update ranks after sorting
    fusedResults.forEach((result, index) => {
      result.metadata.rank = index + 1;
    });

    return fusedResults;
  }

  /**
   * Weighted sum fusion implementation
   * Normalizes scores and combines with configured weights
   */
  private weightedSumFusion(
    bm25Results: BM25Result[],
    vectorResults: VectorResult[]
  ): FusedResult[] {
    const scoreMap = new Map<string, {
      snippet: FactbookSnippet;
      normalizedBM25?: number;
      normalizedVector?: number;
      termMatches?: string[];
      sources: Set<'bm25' | 'vector'>;
    }>();

    // Normalize BM25 scores
    const normalizedBM25 = this.normalizeScores(bm25Results.map(r => r.score));
    bm25Results.forEach((result, index) => {
      scoreMap.set(result.snippet.id, {
        snippet: result.snippet,
        normalizedBM25: normalizedBM25[index],
        termMatches: result.termMatches,
        sources: new Set(['bm25'])
      });
    });

    // Normalize vector scores (similarities are already 0-1)
    vectorResults.forEach((result) => {
      const snippetId = result.snippet.id;
      
      if (scoreMap.has(snippetId)) {
        const existing = scoreMap.get(snippetId)!;
        existing.normalizedVector = result.similarity;
        existing.sources.add('vector');
      } else {
        scoreMap.set(snippetId, {
          snippet: result.snippet,
          normalizedVector: result.similarity,
          sources: new Set(['vector'])
        });
      }
    });

    // Calculate weighted scores
    const fusedResults: FusedResult[] = Array.from(scoreMap.values())
      .map((item) => {
        const bm25Score = item.normalizedBM25 || 0;
        const vectorScore = item.normalizedVector || 0;
        const weightedScore = (bm25Score * this.config.bm25Weight) + 
                             (vectorScore * this.config.vectorWeight);

        return {
          snippet: item.snippet,
          score: weightedScore,
          source: item.sources.size > 1 ? 'both' as const :
                  item.sources.has('bm25') ? 'bm25' as const : 'vector' as const,
          metadata: {
            bm25Score: item.normalizedBM25,
            vectorSimilarity: item.normalizedVector,
            fusionScore: weightedScore,
            rank: 0, // Will be set after sorting
            termMatches: item.termMatches
          }
        };
      })
      .sort((a, b) => {
        if (a.score !== b.score) {
          return b.score - a.score;
        }
        // Same tie-breaking as RRF
        if (a.source === 'both' && b.source !== 'both') return -1;
        if (b.source === 'both' && a.source !== 'both') return 1;
        if (a.snippet.text.length !== b.snippet.text.length) {
          return a.snippet.text.length - b.snippet.text.length;
        }
        return a.snippet.id.localeCompare(b.snippet.id);
      });

    // Update ranks
    fusedResults.forEach((result, index) => {
      result.metadata.rank = index + 1;
    });

    return fusedResults;
  }

  /**
   * Borda count fusion implementation
   * Assigns points based on ranking position
   */
  private bordaCountFusion(
    bm25Results: BM25Result[],
    vectorResults: VectorResult[]
  ): FusedResult[] {
    const scoreMap = new Map<string, {
      snippet: FactbookSnippet;
      bordaScore: number;
      bm25Score?: number;
      vectorSimilarity?: number;
      termMatches?: string[];
      sources: Set<'bm25' | 'vector'>;
    }>();

    const maxBM25Points = bm25Results.length;
    const maxVectorPoints = vectorResults.length;

    // Process BM25 results (higher rank = more points)
    bm25Results.forEach((result, index) => {
      const points = maxBM25Points - index; // First place gets max points
      
      scoreMap.set(result.snippet.id, {
        snippet: result.snippet,
        bordaScore: points,
        bm25Score: result.score,
        termMatches: result.termMatches,
        sources: new Set(['bm25'])
      });
    });

    // Process vector results
    vectorResults.forEach((result, index) => {
      const points = maxVectorPoints - index;
      const snippetId = result.snippet.id;
      
      if (scoreMap.has(snippetId)) {
        const existing = scoreMap.get(snippetId)!;
        existing.bordaScore += points;
        existing.vectorSimilarity = result.similarity;
        existing.sources.add('vector');
      } else {
        scoreMap.set(snippetId, {
          snippet: result.snippet,
          bordaScore: points,
          vectorSimilarity: result.similarity,
          sources: new Set(['vector'])
        });
      }
    });

    // Convert to results and sort
    const fusedResults: FusedResult[] = Array.from(scoreMap.values())
      .map((item) => ({
        snippet: item.snippet,
        score: item.bordaScore,
        source: item.sources.size > 1 ? 'both' as const :
                item.sources.has('bm25') ? 'bm25' as const : 'vector' as const,
        metadata: {
          bm25Score: item.bm25Score,
          vectorSimilarity: item.vectorSimilarity,
          fusionScore: item.bordaScore,
          rank: 0,
          termMatches: item.termMatches
        }
      }))
      .sort((a, b) => {
        if (a.score !== b.score) {
          return b.score - a.score;
        }
        // Same tie-breaking logic
        if (a.source === 'both' && b.source !== 'both') return -1;
        if (b.source === 'both' && a.source !== 'both') return 1;
        if (a.snippet.text.length !== b.snippet.text.length) {
          return a.snippet.text.length - b.snippet.text.length;
        }
        return a.snippet.id.localeCompare(b.snippet.id);
      });

    // Update ranks
    fusedResults.forEach((result, index) => {
      result.metadata.rank = index + 1;
    });

    return fusedResults;
  }

  /**
   * Normalize scores to 0-1 range using min-max normalization
   */
  private normalizeScores(scores: number[]): number[] {
    if (scores.length === 0) {
      return [];
    }

    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    
    // Handle case where all scores are the same
    if (minScore === maxScore) {
      return scores.map(() => 1.0);
    }

    const range = maxScore - minScore;
    return scores.map(score => (score - minScore) / range);
  }

  /**
   * Get default fusion configuration
   */
  static getDefaultConfig(): FusionConfig {
    return {
      method: 'reciprocal_rank',
      k: 60,
      bm25Weight: 0.6,
      vectorWeight: 0.4
    };
  }

  /**
   * Create fusion config from environment variables
   */
  static fromEnvironment(): FusionConfig {
    return {
      method: (process.env.RETRIEVAL_FUSION_METHOD as any) || 'reciprocal_rank',
      k: parseInt(process.env.RETRIEVAL_FUSION_K || '60'),
      bm25Weight: parseFloat(process.env.RETRIEVAL_BM25_WEIGHT || '0.6'),
      vectorWeight: parseFloat(process.env.RETRIEVAL_VECTOR_WEIGHT || '0.4')
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): FusionConfig {
    return { ...this.config };
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(newConfig: Partial<FusionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    console.log('result_fuser_config_updated', {
      new_config: newConfig,
      full_config: this.config
    });
  }

  /**
   * Validate fusion weights sum to reasonable value
   */
  validateWeights(): boolean {
    const sum = this.config.bm25Weight + this.config.vectorWeight;
    const isValid = sum > 0.8 && sum <= 1.2; // Allow some flexibility
    
    if (!isValid) {
      console.warn('result_fuser_invalid_weights', {
        bm25_weight: this.config.bm25Weight,
        vector_weight: this.config.vectorWeight,
        sum: sum
      });
    }
    
    return isValid;
  }
}