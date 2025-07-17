/**
 * Hybrid Voice Service
 * Combines ElevenLabs Conversational AI with Professional Voice Cloning
 * Provides intelligent fallback mechanisms and personality integration
 */

import { ConversationalAIService, ConversationalAIConfig, WebSocketMessage, PersonalityIntegration as CAIPersonalityIntegration } from './conversationalAIService';

export interface HybridVoiceConfig {
  conversational_ai_enabled: boolean;
  fallback_to_turbo: boolean;
  voice_id: string;
  agent_id?: string;
  personality_integration: PersonalityIntegration;
}

export interface PersonalityIntegration {
  profile_data: UserProfile;
  conversation_style: ConversationStyle;
  emotional_preferences: EmotionalPreferences;
  knowledge_base_entries: string[];
}

export interface UserProfile {
  id: string;
  name: string;
  preferences: Record<string, any>;
  memory_context: string[];
}

export interface ConversationStyle {
  formality: 'casual' | 'professional' | 'mixed';
  humor_level: number;
  empathy_level: number;
  response_length: 'short' | 'medium' | 'long';
}

export interface EmotionalPreferences {
  default_emotion: string;
  emotional_range: number;
  context_sensitivity: number;
  adaptation_speed: number;
}

export interface ProfessionalVoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
  optimize_streaming_latency: number;
  model_id: 'eleven_turbo_v2_5' | 'eleven_multilingual_v2';
}

export interface VoiceGenerationRequest {
  text: string;
  voice_id: string;
  emotional_context?: string;
  conversation_context?: string;
  use_conversational_ai?: boolean;
}

export interface VoiceGenerationResponse {
  audio_url?: string;
  audio_data?: ArrayBuffer;
  text: string;
  generation_method: 'conversational_ai' | 'turbo_v2_5';
  emotional_context?: string;
  duration?: number;
  fallback_used?: boolean;
  quality_score?: number;
}

export interface FallbackConfig {
  enabled: boolean;
  max_retries: number;
  retry_delay: number;
  fallback_voice_settings?: ProfessionalVoiceSettings;
  quality_threshold: number;
}

export interface VoiceCapability {
  conversational_ai: boolean;
  turbo_v2_5: boolean;
  streaming: boolean;
  interruption_handling: boolean;
  emotional_adaptation: boolean;
}

export interface ServiceHealth {
  conversational_ai_status: 'healthy' | 'degraded' | 'unavailable';
  turbo_v2_5_status: 'healthy' | 'degraded' | 'unavailable';
  last_health_check: Date;
  error_rate: number;
  average_response_time: number;
}

export class HybridVoiceService {
  private conversationalAI: ConversationalAIService;
  private apiKey: string;
  private baseUrl: string = 'https://api.elevenlabs.io/v1';
  private activeAgents: Map<string, string> = new Map(); // userId -> agentId
  private fallbackConfig: FallbackConfig;
  private serviceHealth: ServiceHealth;
  private responseTimeHistory: number[] = [];
  private errorCount: number = 0;
  private totalRequests: number = 0;

  constructor(apiKey: string, fallbackConfig?: Partial<FallbackConfig>) {
    this.apiKey = apiKey;
    this.conversationalAI = new ConversationalAIService(apiKey);
    
    // Initialize fallback configuration
    this.fallbackConfig = {
      enabled: true,
      max_retries: 3,
      retry_delay: 1000,
      quality_threshold: 0.7,
      fallback_voice_settings: {
        stability: 0.75,
        similarity_boost: 0.85,
        style: 0.2,
        use_speaker_boost: true,
        optimize_streaming_latency: 3,
        model_id: 'eleven_turbo_v2_5',
      },
      ...fallbackConfig,
    };

    // Initialize service health
    this.serviceHealth = {
      conversational_ai_status: 'healthy',
      turbo_v2_5_status: 'healthy',
      last_health_check: new Date(),
      error_rate: 0,
      average_response_time: 0,
    };

    // Start health monitoring
    this.startHealthMonitoring();
  }

  /**
   * Initialize hybrid voice system for a user
   */
  async initializeUserVoice(userId: string, config: HybridVoiceConfig): Promise<void> {
    try {
      if (config.conversational_ai_enabled) {
        // Create or update conversational AI agent
        const agentConfig: ConversationalAIConfig = {
          agent_id: config.agent_id || '',
          voice_id: config.voice_id,
          knowledge_base: config.personality_integration.knowledge_base_entries,
          personality_prompt: this.buildPersonalityPrompt(config.personality_integration),
          conversation_config: {
            language: 'en',
            response_format: 'both',
            max_duration: 30,
            interruption_threshold: 0.5,
            stability: 0.75,
            similarity_boost: 0.85,
            style: this.calculateStyleFromPersonality(config.personality_integration.conversation_style),
            use_speaker_boost: true,
          },
        };

        const agentId = await this.conversationalAI.createAgent(agentConfig);
        this.activeAgents.set(userId, agentId);
        
        console.log(`Initialized conversational AI agent ${agentId} for user ${userId}`);
      }
    } catch (error) {
      console.error('Error initializing hybrid voice system:', error);
      throw error;
    }
  }

  /**
   * Generate voice response using hybrid approach
   */
  async generateVoiceResponse(
    userId: string,
    request: VoiceGenerationRequest,
    config: HybridVoiceConfig
  ): Promise<VoiceGenerationResponse> {
    try {
      // Determine generation method based on config and context
      const useConversationalAI = this.shouldUseConversationalAI(request, config);

      if (useConversationalAI && config.conversational_ai_enabled) {
        return await this.generateWithConversationalAI(userId, request, config);
      } else {
        return await this.generateWithTurboV25(request, config);
      }
    } catch (error) {
      console.error('Error generating voice response:', error);
      
      // Fallback to Turbo v2.5 if conversational AI fails
      if (config.fallback_to_turbo) {
        console.log('Falling back to Turbo v2.5 generation');
        return await this.generateWithTurboV25(request, config);
      }
      
      throw error;
    }
  }

  /**
   * Start real-time conversation session
   */
  async startConversationSession(
    userId: string,
    config: HybridVoiceConfig,
    onMessage: (message: WebSocketMessage) => void,
    onError: (error: Error) => void
  ): Promise<string> {
    const agentId = this.activeAgents.get(userId);
    if (!agentId) {
      throw new Error('No conversational AI agent found for user');
    }

    return await this.conversationalAI.startConversation(
      agentId,
      config.voice_id,
      onMessage,
      onError
    );
  }

  /**
   * Send audio to active conversation
   */
  sendAudioToConversation(conversationId: string, audioData: ArrayBuffer): void {
    this.conversationalAI.sendAudio(conversationId, audioData);
  }

  /**
   * Send text to active conversation
   */
  sendTextToConversation(conversationId: string, text: string): void {
    this.conversationalAI.sendText(conversationId, text);
  }

  /**
   * End conversation session
   */
  endConversationSession(conversationId: string): void {
    this.conversationalAI.endConversation(conversationId);
  }

  /**
   * Update user's personality integration
   */
  async updatePersonalityIntegration(
    userId: string,
    personalityIntegration: PersonalityIntegration
  ): Promise<void> {
    const agentId = this.activeAgents.get(userId);
    if (agentId) {
      // Update existing agent with new personality
      const updatedPrompt = this.buildPersonalityPrompt(personalityIntegration);
      await this.updateAgentPersonality(agentId, updatedPrompt, personalityIntegration.knowledge_base_entries);
    }
  }

  /**
   * Get voice capabilities for current configuration
   */
  getVoiceCapabilities(config: HybridVoiceConfig): VoiceCapability {
    return {
      conversational_ai: config.conversational_ai_enabled && this.serviceHealth.conversational_ai_status !== 'unavailable',
      turbo_v2_5: this.serviceHealth.turbo_v2_5_status !== 'unavailable',
      streaming: config.conversational_ai_enabled,
      interruption_handling: config.conversational_ai_enabled,
      emotional_adaptation: true,
    };
  }

  /**
   * Get current service health status
   */
  getServiceHealth(): ServiceHealth {
    return { ...this.serviceHealth };
  }

  /**
   * Check if fallback should be used based on service health
   */
  shouldUseFallback(preferredMethod: 'conversational_ai' | 'turbo_v2_5'): boolean {
    if (!this.fallbackConfig.enabled) {
      return false;
    }

    if (preferredMethod === 'conversational_ai') {
      return this.serviceHealth.conversational_ai_status === 'unavailable' ||
             (this.serviceHealth.conversational_ai_status === 'degraded' && this.serviceHealth.error_rate > 0.3);
    } else {
      return this.serviceHealth.turbo_v2_5_status === 'unavailable' ||
             (this.serviceHealth.turbo_v2_5_status === 'degraded' && this.serviceHealth.error_rate > 0.3);
    }
  }

  /**
   * Generate voice with intelligent fallback
   */
  async generateVoiceWithFallback(
    userId: string,
    request: VoiceGenerationRequest,
    config: HybridVoiceConfig
  ): Promise<VoiceGenerationResponse> {
    const startTime = Date.now();
    let lastError: Error | null = null;
    let fallbackUsed = false;

    try {
      // Determine primary generation method
      const useConversationalAI = this.shouldUseConversationalAI(request, config);
      const primaryMethod = useConversationalAI ? 'conversational_ai' : 'turbo_v2_5';

      // Check if we should use fallback immediately
      if (this.shouldUseFallback(primaryMethod)) {
        fallbackUsed = true;
        const fallbackMethod = primaryMethod === 'conversational_ai' ? 'turbo_v2_5' : 'conversational_ai';
        return await this.generateWithMethod(userId, request, config, fallbackMethod, true);
      }

      // Try primary method with retries
      for (let attempt = 0; attempt < this.fallbackConfig.max_retries; attempt++) {
        try {
          const response = await this.generateWithMethod(userId, request, config, primaryMethod, false);
          this.recordSuccess(Date.now() - startTime);
          return response;
        } catch (error) {
          lastError = error as Error;
          this.recordError();
          
          if (attempt < this.fallbackConfig.max_retries - 1) {
            await this.delay(this.fallbackConfig.retry_delay * Math.pow(2, attempt));
          }
        }
      }

      // Primary method failed, try fallback if enabled
      if (this.fallbackConfig.enabled && config.fallback_to_turbo) {
        console.log(`Primary method failed, using fallback after ${this.fallbackConfig.max_retries} attempts`);
        fallbackUsed = true;
        const fallbackMethod = primaryMethod === 'conversational_ai' ? 'turbo_v2_5' : 'conversational_ai';
        const response = await this.generateWithMethod(userId, request, config, fallbackMethod, true);
        this.recordSuccess(Date.now() - startTime);
        return response;
      }

      throw lastError || new Error('Voice generation failed');
    } catch (error) {
      this.recordError();
      throw error;
    }
  }

  /**
   * Create personalized agent with enhanced personality integration
   */
  async createPersonalizedAgent(
    userId: string,
    voiceId: string,
    personalityIntegration: PersonalityIntegration
  ): Promise<string> {
    try {
      // Convert to ConversationalAI PersonalityIntegration format
      const caiPersonalityIntegration: CAIPersonalityIntegration = {
        profile_data: personalityIntegration.profile_data,
        conversation_style: personalityIntegration.conversation_style,
        emotional_preferences: personalityIntegration.emotional_preferences,
        knowledge_base_entries: personalityIntegration.knowledge_base_entries,
      };

      const agentId = await this.conversationalAI.createPersonalizedAgent(
        voiceId,
        caiPersonalityIntegration
      );

      this.activeAgents.set(userId, agentId);
      console.log(`Created personalized agent ${agentId} for user ${userId}`);
      
      return agentId;
    } catch (error) {
      console.error('Error creating personalized agent:', error);
      throw error;
    }
  }

  /**
   * Update fallback configuration
   */
  updateFallbackConfig(newConfig: Partial<FallbackConfig>): void {
    this.fallbackConfig = { ...this.fallbackConfig, ...newConfig };
    console.log('Fallback configuration updated:', this.fallbackConfig);
  }

  /**
   * Get agent information for user
   */
  async getUserAgent(userId: string): Promise<any> {
    const agentId = this.activeAgents.get(userId);
    if (!agentId) {
      throw new Error('No agent found for user');
    }

    return await this.conversationalAI.getAgent(agentId);
  }

  /**
   * Delete user's agent
   */
  async deleteUserAgent(userId: string): Promise<void> {
    const agentId = this.activeAgents.get(userId);
    if (agentId) {
      await this.conversationalAI.deleteAgent(agentId);
      this.activeAgents.delete(userId);
      console.log(`Deleted agent ${agentId} for user ${userId}`);
    }
  }

  /**
   * Check connection health for user
   */
  isUserConnectionHealthy(userId: string, conversationId: string): boolean {
    return this.conversationalAI.isConnectionHealthy(conversationId);
  }

  /**
   * Cleanup all resources
   */
  cleanup(): void {
    this.conversationalAI.cleanup();
    this.activeAgents.clear();
    this.responseTimeHistory = [];
    this.errorCount = 0;
    this.totalRequests = 0;
    console.log('Hybrid Voice Service cleaned up');
  }

  private shouldUseConversationalAI(
    request: VoiceGenerationRequest,
    config: HybridVoiceConfig
  ): boolean {
    // Use conversational AI for real-time conversations
    if (request.use_conversational_ai !== undefined) {
      return request.use_conversational_ai;
    }

    // Use conversational AI if enabled and context suggests real-time conversation
    return config.conversational_ai_enabled && 
           (request.conversation_context === 'real-time' || 
            request.conversation_context === 'interactive');
  }

  private async generateWithConversationalAI(
    userId: string,
    request: VoiceGenerationRequest,
    config: HybridVoiceConfig
  ): Promise<VoiceGenerationResponse> {
    // For conversational AI, we typically use WebSocket streaming
    // This method would be used for non-streaming requests
    return {
      text: request.text,
      generation_method: 'conversational_ai',
      emotional_context: request.emotional_context,
    };
  }

  private async generateWithTurboV25(
    request: VoiceGenerationRequest,
    config: HybridVoiceConfig
  ): Promise<VoiceGenerationResponse> {
    try {
      const voiceSettings = this.getVoiceSettingsForContext(
        request.emotional_context,
        config.personality_integration.emotional_preferences
      );

      const response = await fetch(`${this.baseUrl}/text-to-speech/${request.voice_id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: request.text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: voiceSettings,
        }),
      });

      if (!response.ok) {
        throw new Error(`Voice generation failed: ${response.statusText}`);
      }

      const audioData = await response.arrayBuffer();

      return {
        audio_data: audioData,
        text: request.text,
        generation_method: 'turbo_v2_5',
        emotional_context: request.emotional_context,
      };
    } catch (error) {
      console.error('Error generating voice with Turbo v2.5:', error);
      throw error;
    }
  }

  private buildPersonalityPrompt(personalityIntegration: PersonalityIntegration): string {
    const { profile_data, conversation_style, emotional_preferences } = personalityIntegration;
    
    let prompt = `You are a personalized AI assistant for ${profile_data.name}. `;
    
    // Add conversation style
    switch (conversation_style.formality) {
      case 'casual':
        prompt += 'Speak in a casual, friendly manner. ';
        break;
      case 'professional':
        prompt += 'Maintain a professional and respectful tone. ';
        break;
      case 'mixed':
        prompt += 'Adapt your formality based on the conversation context. ';
        break;
    }

    // Add emotional characteristics
    if (conversation_style.humor_level > 0.7) {
      prompt += 'Feel free to use humor and be playful when appropriate. ';
    }
    
    if (conversation_style.empathy_level > 0.7) {
      prompt += 'Show empathy and emotional understanding in your responses. ';
    }

    // Add response length preference
    switch (conversation_style.response_length) {
      case 'short':
        prompt += 'Keep responses concise and to the point. ';
        break;
      case 'long':
        prompt += 'Provide detailed and comprehensive responses. ';
        break;
      default:
        prompt += 'Provide balanced responses that are neither too brief nor too lengthy. ';
    }

    // Add user context if available
    if (profile_data.memory_context.length > 0) {
      prompt += `Remember these key details about the user: ${profile_data.memory_context.join(', ')}. `;
    }

    return prompt;
  }

  private calculateStyleFromPersonality(conversationStyle: ConversationStyle): number {
    // Calculate style parameter (0-1) based on personality traits
    let style = 0.2; // Default neutral style
    
    if (conversationStyle.formality === 'casual') {
      style += 0.2;
    }
    
    if (conversationStyle.humor_level > 0.5) {
      style += 0.2;
    }
    
    return Math.min(1.0, Math.max(0.0, style));
  }

  private getVoiceSettingsForContext(
    emotionalContext: string | undefined,
    emotionalPreferences: EmotionalPreferences
  ): ProfessionalVoiceSettings {
    const baseSettings: ProfessionalVoiceSettings = {
      stability: 0.75,
      similarity_boost: 0.85,
      style: 0.2,
      use_speaker_boost: true,
      optimize_streaming_latency: 3,
      model_id: 'eleven_turbo_v2_5',
    };

    if (!emotionalContext) {
      return baseSettings;
    }

    // Adjust settings based on emotional context
    switch (emotionalContext.toLowerCase()) {
      case 'happy':
      case 'excited':
        return {
          ...baseSettings,
          stability: 0.6,
          style: 0.4,
        };
      case 'sad':
      case 'serious':
        return {
          ...baseSettings,
          stability: 0.85,
          style: 0.1,
        };
      case 'calm':
        return {
          ...baseSettings,
          stability: 0.9,
          style: 0.1,
        };
      default:
        return baseSettings;
    }
  }

  private async updateAgentPersonality(
    agentId: string,
    personalityPrompt: string,
    knowledgeBase: string[]
  ): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/convai/agents/${agentId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: personalityPrompt,
          knowledge_base: knowledgeBase,
        }),
      });
    } catch (error) {
      console.error('Error updating agent personality:', error);
      throw error;
    }
  }

  /**
   * Generate voice using specified method
   */
  private async generateWithMethod(
    userId: string,
    request: VoiceGenerationRequest,
    config: HybridVoiceConfig,
    method: 'conversational_ai' | 'turbo_v2_5',
    isFallback: boolean
  ): Promise<VoiceGenerationResponse> {
    this.totalRequests++;
    
    try {
      let response: VoiceGenerationResponse;
      
      if (method === 'conversational_ai') {
        response = await this.generateWithConversationalAI(userId, request, config);
      } else {
        response = await this.generateWithTurboV25(request, config);
      }
      
      response.fallback_used = isFallback;
      return response;
    } catch (error) {
      console.error(`Error generating voice with ${method}:`, error);
      throw error;
    }
  }

  /**
   * Record successful request for health monitoring
   */
  private recordSuccess(responseTime: number): void {
    this.responseTimeHistory.push(responseTime);
    
    // Keep only last 100 response times
    if (this.responseTimeHistory.length > 100) {
      this.responseTimeHistory.shift();
    }
    
    this.updateServiceHealth();
  }

  /**
   * Record error for health monitoring
   */
  private recordError(): void {
    this.errorCount++;
    this.updateServiceHealth();
  }

  /**
   * Update service health metrics
   */
  private updateServiceHealth(): void {
    // Calculate error rate
    this.serviceHealth.error_rate = this.totalRequests > 0 ? this.errorCount / this.totalRequests : 0;
    
    // Calculate average response time
    if (this.responseTimeHistory.length > 0) {
      this.serviceHealth.average_response_time = 
        this.responseTimeHistory.reduce((sum, time) => sum + time, 0) / this.responseTimeHistory.length;
    }
    
    // Update service status based on metrics
    this.updateServiceStatus();
    
    this.serviceHealth.last_health_check = new Date();
  }

  /**
   * Update service status based on current metrics
   */
  private updateServiceStatus(): void {
    const errorThreshold = 0.1; // 10% error rate threshold
    const degradedThreshold = 0.05; // 5% error rate threshold
    const responseTimeThreshold = 5000; // 5 second response time threshold
    
    // Update Conversational AI status
    if (this.serviceHealth.error_rate > errorThreshold) {
      this.serviceHealth.conversational_ai_status = 'unavailable';
    } else if (this.serviceHealth.error_rate > degradedThreshold || 
               this.serviceHealth.average_response_time > responseTimeThreshold) {
      this.serviceHealth.conversational_ai_status = 'degraded';
    } else {
      this.serviceHealth.conversational_ai_status = 'healthy';
    }
    
    // Update Turbo v2.5 status (similar logic)
    if (this.serviceHealth.error_rate > errorThreshold) {
      this.serviceHealth.turbo_v2_5_status = 'unavailable';
    } else if (this.serviceHealth.error_rate > degradedThreshold || 
               this.serviceHealth.average_response_time > responseTimeThreshold) {
      this.serviceHealth.turbo_v2_5_status = 'degraded';
    } else {
      this.serviceHealth.turbo_v2_5_status = 'healthy';
    }
  }

  /**
   * Start health monitoring interval
   */
  private startHealthMonitoring(): void {
    // Check health every 30 seconds
    setInterval(() => {
      this.performHealthCheck();
    }, 30000);
  }

  /**
   * Perform periodic health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      // Test Turbo v2.5 endpoint
      const testResponse = await fetch(`${this.baseUrl}/voices`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });
      
      if (testResponse.ok) {
        // If we had errors before, reset some metrics
        if (this.serviceHealth.turbo_v2_5_status !== 'healthy') {
          this.errorCount = Math.max(0, this.errorCount - 1);
        }
      }
    } catch (error) {
      console.error('Health check failed:', error);
      this.recordError();
    }
    
    this.updateServiceHealth();
  }

  /**
   * Delay utility for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}