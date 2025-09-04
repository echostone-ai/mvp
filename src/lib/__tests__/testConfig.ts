export interface TestConfiguration {
  audioQuality: AudioQualityConfig;
  performance: PerformanceConfig;
  userAcceptance: UserAcceptanceConfig;
  loadTesting: LoadTestingConfig;
  integration: IntegrationConfig;
  security: SecurityConfig;
}

export interface AudioQualityConfig {
  sampleRateTargets: number[];
  bitrateTargets: number[];
  lufsTarget: number;
  maxPeakDbTP: number;
  minSNRDb: number;
  testSampleCount: number;
}

export interface PerformanceConfig {
  latencyThresholds: {
    ttsFirstByte: number;
    memoryRetrieval: number;
    expressionScheduling: number;
    audioBufferCreation: number;
    conversationTurnComplete: number;
  };
  memoryLimits: {
    audioBufferSizeMB: number;
    memoryCacheSizeMB: number;
    expressionBufferSizeMB: number;
    totalHeapSizeMB: number;
  };
  regressionTolerances: {
    latency: number; // percentage
    memory: number; // percentage
  };
}

export interface UserAcceptanceConfig {
  conversationNaturalness: {
    minScore: number;
    testConversationCount: number;
    expressionTimingAccuracy: number;
  };
  userExperience: {
    minSeamlessnessScore: number;
    minMobileCompatibilityScore: number;
    minErrorRecoveryScore: number;
  };
  acceptanceCriteria: {
    maxFirstAudioByteLatency: number;
    maxMemoryRetrievalOverhead: number;
    minExpressionTimingAccuracy: number;
    minAudioQualityScore: number;
    minConversationNaturalness: number;
    minMobileCompatibility: number;
    minErrorRecoveryScore: number;
  };
}

export interface LoadTestingConfig {
  concurrentUsers: {
    baseline: number;
    target: number;
    maximum: number;
  };
  testDuration: number;
  rampUpTime: number;
  messagesPerMinute: number;
  resourceLimits: {
    maxMemoryUsageMB: number;
    maxCpuUsage: number;
    maxNetworkBandwidthMBPerMin: number;
  };
  scalabilityTargets: {
    linearScalabilityUpTo: number;
    acceptableDegradationBeyond: number;
  };
}

export interface IntegrationConfig {
  endToEnd: {
    testScenarios: string[];
    maxInitializationTime: number;
    minSuccessRate: number;
  };
  crossBrowser: {
    supportedBrowsers: string[];
    minCompatibilityScore: number;
  };
  mobile: {
    supportedPlatforms: string[];
    minPerformanceScore: number;
  };
}

export interface SecurityConfig {
  privacy: {
    encryptionRequired: boolean;
    dataIsolationRequired: boolean;
    gdprComplianceRequired: boolean;
  };
  security: {
    inputValidationRequired: boolean;
    rateLimitingRequired: boolean;
    vulnerabilityScanningRequired: boolean;
  };
}

export const defaultTestConfiguration: TestConfiguration = {
  audioQuality: {
    sampleRateTargets: [44100, 48000],
    bitrateTargets: [64, 128, 192],
    lufsTarget: -14,
    maxPeakDbTP: -1,
    minSNRDb: 20,
    testSampleCount: 100
  },
  performance: {
    latencyThresholds: {
      ttsFirstByte: 500,
      memoryRetrieval: 200,
      expressionScheduling: 50,
      audioBufferCreation: 100,
      conversationTurnComplete: 2000
    },
    memoryLimits: {
      audioBufferSizeMB: 10,
      memoryCacheSizeMB: 5,
      expressionBufferSizeMB: 15,
      totalHeapSizeMB: 50
    },
    regressionTolerances: {
      latency: 20, // 20% regression tolerance
      memory: 30   // 30% memory growth tolerance
    }
  },
  userAcceptance: {
    conversationNaturalness: {
      minScore: 0.8,
      testConversationCount: 50,
      expressionTimingAccuracy: 0.9
    },
    userExperience: {
      minSeamlessnessScore: 0.85,
      minMobileCompatibilityScore: 0.85,
      minErrorRecoveryScore: 0.8
    },
    acceptanceCriteria: {
      maxFirstAudioByteLatency: 500,
      maxMemoryRetrievalOverhead: 200,
      minExpressionTimingAccuracy: 0.9,
      minAudioQualityScore: 0.8,
      minConversationNaturalness: 0.8,
      minMobileCompatibility: 0.85,
      minErrorRecoveryScore: 0.8
    }
  },
  loadTesting: {
    concurrentUsers: {
      baseline: 10,
      target: 25,
      maximum: 50
    },
    testDuration: 60000, // 1 minute
    rampUpTime: 10000,   // 10 seconds
    messagesPerMinute: 4,
    resourceLimits: {
      maxMemoryUsageMB: 500,
      maxCpuUsage: 0.8,
      maxNetworkBandwidthMBPerMin: 100
    },
    scalabilityTargets: {
      linearScalabilityUpTo: 25,
      acceptableDegradationBeyond: 35
    }
  },
  integration: {
    endToEnd: {
      testScenarios: [
        'basic_conversation',
        'memory_integration',
        'expression_overlays',
        'error_recovery',
        'mobile_safari'
      ],
      maxInitializationTime: 1000,
      minSuccessRate: 0.95
    },
    crossBrowser: {
      supportedBrowsers: ['chrome', 'firefox', 'safari', 'edge'],
      minCompatibilityScore: 0.9
    },
    mobile: {
      supportedPlatforms: ['ios', 'android'],
      minPerformanceScore: 0.8
    }
  },
  security: {
    privacy: {
      encryptionRequired: true,
      dataIsolationRequired: true,
      gdprComplianceRequired: true
    },
    security: {
      inputValidationRequired: true,
      rateLimitingRequired: true,
      vulnerabilityScanningRequired: true
    }
  }
};

export class TestConfigurationManager {
  private config: TestConfiguration;

  constructor(config: TestConfiguration = defaultTestConfiguration) {
    this.config = config;
  }

  getAudioQualityConfig(): AudioQualityConfig {
    return this.config.audioQuality;
  }

  getPerformanceConfig(): PerformanceConfig {
    return this.config.performance;
  }

  getUserAcceptanceConfig(): UserAcceptanceConfig {
    return this.config.userAcceptance;
  }

  getLoadTestingConfig(): LoadTestingConfig {
    return this.config.loadTesting;
  }

  getIntegrationConfig(): IntegrationConfig {
    return this.config.integration;
  }

  getSecurityConfig(): SecurityConfig {
    return this.config.security;
  }

  updateConfig(partialConfig: Partial<TestConfiguration>): void {
    this.config = { ...this.config, ...partialConfig };
  }

  validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate audio quality config
    if (this.config.audioQuality.lufsTarget > -6 || this.config.audioQuality.lufsTarget < -30) {
      errors.push('LUFS target should be between -30 and -6 dB');
    }

    if (this.config.audioQuality.maxPeakDbTP > 0) {
      errors.push('Peak level should be negative (below 0 dBTP)');
    }

    // Validate performance config
    if (this.config.performance.latencyThresholds.ttsFirstByte < 100) {
      errors.push('TTS first byte threshold too aggressive (minimum 100ms)');
    }

    if (this.config.performance.memoryLimits.totalHeapSizeMB < 20) {
      errors.push('Total heap size limit too restrictive (minimum 20MB)');
    }

    // Validate load testing config
    if (this.config.loadTesting.concurrentUsers.target > this.config.loadTesting.concurrentUsers.maximum) {
      errors.push('Target concurrent users cannot exceed maximum');
    }

    if (this.config.loadTesting.rampUpTime > this.config.loadTesting.testDuration) {
      errors.push('Ramp up time cannot exceed test duration');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  exportConfiguration(): string {
    return JSON.stringify(this.config, null, 2);
  }

  importConfiguration(configJson: string): void {
    try {
      const importedConfig = JSON.parse(configJson);
      this.config = { ...defaultTestConfiguration, ...importedConfig };
    } catch (error) {
      throw new Error(`Invalid configuration JSON: ${error}`);
    }
  }
}