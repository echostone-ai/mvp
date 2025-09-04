/**
 * A/B Testing Framework for Voice Settings and Expression Timing
 * Enables controlled experiments to optimize conversation quality
 */

export interface ABTestConfig {
  id: string;
  name: string;
  description: string;
  type: 'voice_settings' | 'expression_timing' | 'memory_settings' | 'conversation_flow';
  status: 'draft' | 'active' | 'completed' | 'paused';
  startDate: Date;
  endDate?: Date;
  targetSampleSize: number;
  currentSampleSize: number;
  variants: ABTestVariant[];
  successMetrics: string[];
  createdBy: string;
}

export interface ABTestVariant {
  id: string;
  name: string;
  description: string;
  weight: number; // 0-1, sum of all variants should equal 1
  configuration: any; // Variant-specific configuration
  sampleSize: number;
  metrics: ABTestMetrics;
}

export interface ABTestMetrics {
  averageResponseTime: number;
  averageAudioLatency: number;
  userEngagementScore: number;
  conversationCompletionRate: number;
  expressionEffectivenessScore: number;
  userSatisfactionScore: number;
  technicalErrorRate: number;
  memoryRetrievalSuccessRate: number;
}

export interface ABTestAssignment {
  userId: string;
  testId: string;
  variantId: string;
  assignedAt: Date;
  sessionId?: string;
}

export interface ABTestResult {
  testId: string;
  variant: ABTestVariant;
  metrics: ABTestMetrics;
  sampleSize: number;
  confidenceLevel: number;
  statisticalSignificance: boolean;
  recommendedAction: 'adopt' | 'reject' | 'continue_testing';
}

export interface VoiceSettingsVariant {
  sampleRate: number;
  bitrate: number;
  latencyMode: number;
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
}

export interface ExpressionTimingVariant {
  maxOverlaysPerWindow: number;
  windowSizeMs: number;
  minSpacingMs: number;
  duckingAmount: number;
  fadeDurationMs: number;
  keywordSensitivity: number;
  cadenceBasedFallback: boolean;
}

export class ABTestingFramework {
  private static instance: ABTestingFramework;
  private activeTests: Map<string, ABTestConfig> = new Map();
  private userAssignments: Map<string, ABTestAssignment[]> = new Map();
  private testResults: Map<string, ABTestResult[]> = new Map();

  static getInstance(): ABTestingFramework {
    if (!ABTestingFramework.instance) {
      ABTestingFramework.instance = new ABTestingFramework();
    }
    return ABTestingFramework.instance;
  }

  /**
   * Create a new A/B test
   */
  createTest(config: Omit<ABTestConfig, 'id' | 'currentSampleSize' | 'status'>): string {
    const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const test: ABTestConfig = {
      ...config,
      id: testId,
      status: 'draft',
      currentSampleSize: 0,
      variants: config.variants.map(variant => ({
        ...variant,
        sampleSize: 0,
        metrics: this.getEmptyMetrics()
      }))
    };

    this.activeTests.set(testId, test);
    return testId;
  }

  /**
   * Start an A/B test
   */
  startTest(testId: string): boolean {
    const test = this.activeTests.get(testId);
    if (!test || test.status !== 'draft') {
      return false;
    }

    // Validate test configuration
    if (!this.validateTestConfig(test)) {
      return false;
    }

    test.status = 'active';
    test.startDate = new Date();
    return true;
  }

  /**
   * Assign user to test variant
   */
  assignUserToTest(userId: string, testId: string, sessionId?: string): ABTestAssignment | null {
    const test = this.activeTests.get(testId);
    if (!test || test.status !== 'active') {
      return null;
    }

    // Check if user already assigned to this test
    const existingAssignments = this.userAssignments.get(userId) || [];
    const existingAssignment = existingAssignments.find(a => a.testId === testId);
    if (existingAssignment) {
      return existingAssignment;
    }

    // Assign to variant based on weights
    const variant = this.selectVariantByWeight(test.variants);
    if (!variant) {
      return null;
    }

    const assignment: ABTestAssignment = {
      userId,
      testId,
      variantId: variant.id,
      assignedAt: new Date(),
      sessionId
    };

    // Store assignment
    if (!this.userAssignments.has(userId)) {
      this.userAssignments.set(userId, []);
    }
    this.userAssignments.get(userId)!.push(assignment);

    // Update variant sample size
    variant.sampleSize++;
    test.currentSampleSize++;

    return assignment;
  }

  /**
   * Get user's test assignment
   */
  getUserTestAssignment(userId: string, testId: string): ABTestAssignment | null {
    const assignments = this.userAssignments.get(userId) || [];
    return assignments.find(a => a.testId === testId) || null;
  }

  /**
   * Record test metrics for a user session
   */
  recordTestMetrics(userId: string, testId: string, metrics: Partial<ABTestMetrics>): void {
    const assignment = this.getUserTestAssignment(userId, testId);
    if (!assignment) {
      return;
    }

    const test = this.activeTests.get(testId);
    if (!test) {
      return;
    }

    const variant = test.variants.find(v => v.id === assignment.variantId);
    if (!variant) {
      return;
    }

    // Update variant metrics (running average)
    this.updateVariantMetrics(variant, metrics);
  }

  /**
   * Get test configuration for user
   */
  getTestConfiguration(userId: string, testId: string): any {
    const assignment = this.getUserTestAssignment(userId, testId);
    if (!assignment) {
      return null;
    }

    const test = this.activeTests.get(testId);
    if (!test) {
      return null;
    }

    const variant = test.variants.find(v => v.id === assignment.variantId);
    return variant?.configuration || null;
  }

  /**
   * Analyze test results
   */
  analyzeTestResults(testId: string): ABTestResult[] {
    const test = this.activeTests.get(testId);
    if (!test) {
      return [];
    }

    const results: ABTestResult[] = [];
    const controlVariant = test.variants[0]; // Assume first variant is control

    for (const variant of test.variants) {
      const result: ABTestResult = {
        testId,
        variant,
        metrics: variant.metrics,
        sampleSize: variant.sampleSize,
        confidenceLevel: this.calculateConfidenceLevel(variant, controlVariant),
        statisticalSignificance: this.isStatisticallySignificant(variant, controlVariant),
        recommendedAction: this.getRecommendedAction(variant, controlVariant, test)
      };
      results.push(result);
    }

    this.testResults.set(testId, results);
    return results;
  }

  /**
   * Create predefined voice settings tests
   */
  createVoiceSettingsTest(): string {
    const variants: ABTestVariant[] = [
      {
        id: 'control',
        name: 'Current Settings',
        description: 'Existing voice configuration',
        weight: 0.5,
        configuration: {
          sampleRate: 22050,
          bitrate: 32,
          latencyMode: 2,
          stability: 0.75,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true
        } as VoiceSettingsVariant,
        sampleSize: 0,
        metrics: this.getEmptyMetrics()
      },
      {
        id: 'enhanced',
        name: 'Enhanced Quality',
        description: 'High-quality voice settings',
        weight: 0.5,
        configuration: {
          sampleRate: 44100,
          bitrate: 128,
          latencyMode: 3,
          stability: 0.70,
          similarity_boost: 0.85,
          style: 0.0,
          use_speaker_boost: false
        } as VoiceSettingsVariant,
        sampleSize: 0,
        metrics: this.getEmptyMetrics()
      }
    ];

    return this.createTest({
      name: 'Voice Quality Enhancement Test',
      description: 'Compare current voice settings with enhanced quality configuration',
      type: 'voice_settings',
      startDate: new Date(),
      targetSampleSize: 100,
      variants,
      successMetrics: ['userSatisfactionScore', 'averageAudioLatency', 'technicalErrorRate'],
      createdBy: 'system'
    });
  }

  /**
   * Create predefined expression timing test
   */
  createExpressionTimingTest(): string {
    const variants: ABTestVariant[] = [
      {
        id: 'conservative',
        name: 'Conservative Expressions',
        description: 'Lower frequency, careful timing',
        weight: 0.33,
        configuration: {
          maxOverlaysPerWindow: 1,
          windowSizeMs: 15000,
          minSpacingMs: 6000,
          duckingAmount: 0.3,
          fadeDurationMs: 100,
          keywordSensitivity: 0.8,
          cadenceBasedFallback: false
        } as ExpressionTimingVariant,
        sampleSize: 0,
        metrics: this.getEmptyMetrics()
      },
      {
        id: 'balanced',
        name: 'Balanced Expressions',
        description: 'Current expression timing',
        weight: 0.34,
        configuration: {
          maxOverlaysPerWindow: 2,
          windowSizeMs: 10000,
          minSpacingMs: 4000,
          duckingAmount: 0.4,
          fadeDurationMs: 50,
          keywordSensitivity: 0.7,
          cadenceBasedFallback: true
        } as ExpressionTimingVariant,
        sampleSize: 0,
        metrics: this.getEmptyMetrics()
      },
      {
        id: 'expressive',
        name: 'Highly Expressive',
        description: 'More frequent, dynamic expressions',
        weight: 0.33,
        configuration: {
          maxOverlaysPerWindow: 3,
          windowSizeMs: 8000,
          minSpacingMs: 2000,
          duckingAmount: 0.5,
          fadeDurationMs: 30,
          keywordSensitivity: 0.6,
          cadenceBasedFallback: true
        } as ExpressionTimingVariant,
        sampleSize: 0,
        metrics: this.getEmptyMetrics()
      }
    ];

    return this.createTest({
      name: 'Expression Timing Optimization',
      description: 'Test different expression timing strategies for naturalness',
      type: 'expression_timing',
      startDate: new Date(),
      targetSampleSize: 150,
      variants,
      successMetrics: ['expressionEffectivenessScore', 'userEngagementScore', 'conversationCompletionRate'],
      createdBy: 'system'
    });
  }

  /**
   * Get all active tests
   */
  getActiveTests(): ABTestConfig[] {
    return Array.from(this.activeTests.values()).filter(test => test.status === 'active');
  }

  /**
   * Complete a test
   */
  completeTest(testId: string): ABTestResult[] {
    const test = this.activeTests.get(testId);
    if (!test) {
      return [];
    }

    test.status = 'completed';
    test.endDate = new Date();

    return this.analyzeTestResults(testId);
  }

  /**
   * Private helper methods
   */
  private validateTestConfig(test: ABTestConfig): boolean {
    // Check variant weights sum to 1
    const totalWeight = test.variants.reduce((sum, variant) => sum + variant.weight, 0);
    if (Math.abs(totalWeight - 1) > 0.01) {
      return false;
    }

    // Check minimum variants
    if (test.variants.length < 2) {
      return false;
    }

    return true;
  }

  private selectVariantByWeight(variants: ABTestVariant[]): ABTestVariant | null {
    const random = Math.random();
    let cumulativeWeight = 0;

    for (const variant of variants) {
      cumulativeWeight += variant.weight;
      if (random <= cumulativeWeight) {
        return variant;
      }
    }

    return variants[variants.length - 1]; // Fallback to last variant
  }

  private updateVariantMetrics(variant: ABTestVariant, newMetrics: Partial<ABTestMetrics>): void {
    const current = variant.metrics;
    const sampleSize = variant.sampleSize;

    // Running average calculation
    Object.keys(newMetrics).forEach(key => {
      const metricKey = key as keyof ABTestMetrics;
      const newValue = newMetrics[metricKey];
      if (typeof newValue === 'number') {
        current[metricKey] = ((current[metricKey] * (sampleSize - 1)) + newValue) / sampleSize;
      }
    });
  }

  private calculateConfidenceLevel(variant: ABTestVariant, control: ABTestVariant): number {
    // Simplified confidence calculation
    const minSampleSize = Math.min(variant.sampleSize, control.sampleSize);
    if (minSampleSize < 30) return 0;
    if (minSampleSize < 100) return 0.8;
    if (minSampleSize < 500) return 0.9;
    return 0.95;
  }

  private isStatisticallySignificant(variant: ABTestVariant, control: ABTestVariant): boolean {
    // Simplified significance test
    const minSampleSize = Math.min(variant.sampleSize, control.sampleSize);
    if (minSampleSize < 30) return false;

    // Check if improvement is substantial (>5% for key metrics)
    const engagementImprovement = Math.abs(variant.metrics.userEngagementScore - control.metrics.userEngagementScore);
    const latencyImprovement = Math.abs(variant.metrics.averageAudioLatency - control.metrics.averageAudioLatency);
    
    return engagementImprovement > 0.05 || latencyImprovement > 100;
  }

  private getRecommendedAction(
    variant: ABTestVariant, 
    control: ABTestVariant, 
    test: ABTestConfig
  ): 'adopt' | 'reject' | 'continue_testing' {
    if (variant.sampleSize < test.targetSampleSize * 0.8) {
      return 'continue_testing';
    }

    if (!this.isStatisticallySignificant(variant, control)) {
      return 'reject';
    }

    // Check if variant performs better on key metrics
    const betterEngagement = variant.metrics.userEngagementScore > control.metrics.userEngagementScore;
    const betterLatency = variant.metrics.averageAudioLatency < control.metrics.averageAudioLatency;
    const betterSatisfaction = variant.metrics.userSatisfactionScore > control.metrics.userSatisfactionScore;

    const improvements = [betterEngagement, betterLatency, betterSatisfaction].filter(Boolean).length;
    
    return improvements >= 2 ? 'adopt' : 'reject';
  }

  private getEmptyMetrics(): ABTestMetrics {
    return {
      averageResponseTime: 0,
      averageAudioLatency: 0,
      userEngagementScore: 0,
      conversationCompletionRate: 0,
      expressionEffectivenessScore: 0,
      userSatisfactionScore: 0,
      technicalErrorRate: 0,
      memoryRetrievalSuccessRate: 0
    };
  }
}