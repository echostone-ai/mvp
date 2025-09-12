/**
 * Graceful Degradation Service
 * Manages fallback strategies when services fail
 */

export enum ServiceType {
  VOICE_SYNTHESIS = 'voice_synthesis',
  MEMORY_SERVICE = 'memory_service',
  EXPRESSION_SYSTEM = 'expression_system',
  STREAMING_AUDIO = 'streaming_audio'
}

export enum DegradationLevel {
  NORMAL = 'normal',
  REDUCED = 'reduced',
  MINIMAL = 'minimal',
  OFFLINE = 'offline'
}

export interface DegradationState {
  level: DegradationLevel;
  affectedServices: ServiceType[];
  fallbackStrategies: string[];
  userMessage?: string;
  timestamp: number;
}

export interface FallbackStrategy {
  service: ServiceType;
  strategy: string;
  description: string;
  userMessage: string;
}

export class GracefulDegradationService {
  private currentState: DegradationState = {
    level: DegradationLevel.NORMAL,
    affectedServices: [],
    fallbackStrategies: [],
    timestamp: Date.now()
  };

  private fallbackStrategies: Map<ServiceType, FallbackStrategy[]> = new Map([
    [ServiceType.VOICE_SYNTHESIS, [
      {
        service: ServiceType.VOICE_SYNTHESIS,
        strategy: 'lower_quality',
        description: 'Reduce audio quality to maintain streaming',
        userMessage: 'Audio quality temporarily reduced'
      },
      {
        service: ServiceType.VOICE_SYNTHESIS,
        strategy: 'buffered_fallback',
        description: 'Switch to buffered audio generation',
        userMessage: 'Switching to backup audio system'
      },
      {
        service: ServiceType.VOICE_SYNTHESIS,
        strategy: 'text_only',
        description: 'Display text responses only',
        userMessage: 'Audio temporarily unavailable - showing text responses'
      }
    ]],
    [ServiceType.MEMORY_SERVICE, [
      {
        service: ServiceType.MEMORY_SERVICE,
        strategy: 'session_memory_only',
        description: 'Use only current session memory',
        userMessage: 'Memory temporarily unavailable - using session only'
      },
      {
        service: ServiceType.MEMORY_SERVICE,
        strategy: 'no_memory_context',
        description: 'Continue without memory context',
        userMessage: 'Memory temporarily unavailable'
      }
    ]],
    [ServiceType.EXPRESSION_SYSTEM, [
      {
        service: ServiceType.EXPRESSION_SYSTEM,
        strategy: 'disable_overlays',
        description: 'Disable expression overlays',
        userMessage: 'Voice expressions temporarily disabled'
      }
    ]],
    [ServiceType.STREAMING_AUDIO, [
      {
        service: ServiceType.STREAMING_AUDIO,
        strategy: 'buffered_audio',
        description: 'Switch to buffered audio playback',
        userMessage: 'Using backup audio playback'
      }
    ]]
  ]);

  private listeners: ((state: DegradationState) => void)[] = [];

  degradeService(service: ServiceType, error?: Error): DegradationState {
    const strategies = this.fallbackStrategies.get(service) || [];
    
    if (strategies.length === 0) {
      return this.currentState;
    }

    // Select appropriate fallback strategy based on error and current state
    const strategy = this.selectFallbackStrategy(service, error);
    
    if (!this.currentState.affectedServices.includes(service)) {
      this.currentState.affectedServices.push(service);
    }
    
    if (!this.currentState.fallbackStrategies.includes(strategy.strategy)) {
      this.currentState.fallbackStrategies.push(strategy.strategy);
    }

    // Update degradation level
    this.currentState.level = this.calculateDegradationLevel();
    this.currentState.userMessage = strategy.userMessage;
    this.currentState.timestamp = Date.now();

    // Notify listeners
    this.notifyListeners();

    return this.currentState;
  }

  restoreService(service: ServiceType): DegradationState {
    // Remove service from affected list
    this.currentState.affectedServices = this.currentState.affectedServices.filter(s => s !== service);
    
    // Remove related fallback strategies
    const serviceStrategies = this.fallbackStrategies.get(service) || [];
    this.currentState.fallbackStrategies = this.currentState.fallbackStrategies.filter(
      strategy => !serviceStrategies.some(s => s.strategy === strategy)
    );

    // Recalculate degradation level
    this.currentState.level = this.calculateDegradationLevel();
    this.currentState.timestamp = Date.now();

    if (this.currentState.level === DegradationLevel.NORMAL) {
      this.currentState.userMessage = undefined;
    }

    // Notify listeners
    this.notifyListeners();

    return this.currentState;
  }

  private selectFallbackStrategy(service: ServiceType, error?: Error): FallbackStrategy {
    const strategies = this.fallbackStrategies.get(service) || [];
    
    if (strategies.length === 0) {
      throw new Error(`No fallback strategies defined for service: ${service}`);
    }

    // For now, select the first strategy. Could be enhanced with error-specific logic
    return strategies[0];
  }

  private calculateDegradationLevel(): DegradationLevel {
    const affectedCount = this.currentState.affectedServices.length;
    
    if (affectedCount === 0) {
      return DegradationLevel.NORMAL;
    } else if (affectedCount === 1) {
      return DegradationLevel.REDUCED;
    } else if (affectedCount === 2) {
      return DegradationLevel.MINIMAL;
    } else {
      return DegradationLevel.OFFLINE;
    }
  }

  getCurrentState(): DegradationState {
    return { ...this.currentState };
  }

  isServiceDegraded(service: ServiceType): boolean {
    return this.currentState.affectedServices.includes(service);
  }

  onStateChange(listener: (state: DegradationState) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.currentState);
      } catch (error) {
        console.error('Error in degradation state listener:', error);
      }
    });
  }

  reset(): void {
    this.currentState = {
      level: DegradationLevel.NORMAL,
      affectedServices: [],
      fallbackStrategies: [],
      timestamp: Date.now()
    };
    this.notifyListeners();
  }
}

// Global degradation service instance
export const gracefulDegradationService = new GracefulDegradationService();