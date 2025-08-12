/**
 * Test suite for HybridVoiceService
 * Validates fallback mechanisms, personality integration, and service health monitoring
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HybridVoiceService, HybridVoiceConfig, PersonalityIntegration, VoiceGenerationRequest } from '../hybridVoiceService';
import { ConversationalAIService } from '../conversationalAIService';

// Mock the ConversationalAIService
vi.mock('../conversationalAIService');

describe('HybridVoiceService', () => {
  let hybridVoiceService: HybridVoiceService;
  let mockConversationalAI: any;
  const mockApiKey = 'test-api-key';

  const mockPersonalityIntegration: PersonalityIntegration = {
    profile_data: {
      id: 'user-123',
      name: 'Test User',
      preferences: { theme: 'dark' },
      memory_context: ['likes coffee', 'works in tech'],
    },
    conversation_style: {
      formality: 'casual',
      humor_level: 0.8,
      empathy_level: 0.8,
      response_length: 'medium',
    },
    emotional_preferences: {
      default_emotion: 'friendly',
      emotional_range: 0.8,
      context_sensitivity: 0.9,
      adaptation_speed: 0.7,
    },
    knowledge_base_entries: ['user works as a software engineer', 'user enjoys hiking'],
  };

  const mockHybridVoiceConfig: HybridVoiceConfig = {
    conversational_ai_enabled: true,
    fallback_to_turbo: true,
    voice_id: 'test-voice-id',
    agent_id: 'test-agent-id',
    personality_integration: mockPersonalityIntegration,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock fetch globally
    global.fetch = vi.fn();
    
    hybridVoiceService = new HybridVoiceService(mockApiKey);
    mockConversationalAI = hybridVoiceService['conversationalAI'];
  });

  afterEach(() => {
    hybridVoiceService.cleanup();
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default fallback configuration', () => {
      const service = new HybridVoiceService(mockApiKey);
      const fallbackConfig = service['fallbackConfig'];
      
      expect(fallbackConfig.enabled).toBe(true);
      expect(fallbackConfig.max_retries).toBe(3);
      expect(fallbackConfig.retry_delay).toBe(1000);
      expect(fallbackConfig.quality_threshold).toBe(0.7);
    });

    it('should initialize with custom fallback configuration', () => {
      const customConfig = {
        enabled: false,
        max_retries: 5,
        retry_delay: 2000,
      };
      
      const service = new HybridVoiceService(mockApiKey, customConfig);
      const fallbackConfig = service['fallbackConfig'];
      
      expect(fallbackConfig.enabled).toBe(false);
      expect(fallbackConfig.max_retries).toBe(5);
      expect(fallbackConfig.retry_delay).toBe(2000);
    });

    it('should initialize service health monitoring', () => {
      const serviceHealth = hybridVoiceService.getServiceHealth();
      
      expect(serviceHealth.conversational_ai_status).toBe('healthy');
      expect(serviceHealth.turbo_v2_5_status).toBe('healthy');
      expect(serviceHealth.error_rate).toBe(0);
      expect(serviceHealth.average_response_time).toBe(0);
    });
  });

  describe('User Voice Initialization', () => {
    it('should initialize user voice with conversational AI enabled', async () => {
      mockConversationalAI.createAgent.mockResolvedValue('new-agent-id');

      await hybridVoiceService.initializeUserVoice('user-123', mockHybridVoiceConfig);

      expect(mockConversationalAI.createAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          voice_id: 'test-voice-id',
          knowledge_base: mockPersonalityIntegration.knowledge_base_entries,
          personality_prompt: expect.stringContaining('Test User'),
        })
      );
    });

    it('should skip agent creation when conversational AI is disabled', async () => {
      const config = { ...mockHybridVoiceConfig, conversational_ai_enabled: false };

      await hybridVoiceService.initializeUserVoice('user-123', config);

      expect(mockConversationalAI.createAgent).not.toHaveBeenCalled();
    });
  });

  describe('Personality Integration', () => {
    it('should build personality prompt correctly', () => {
      const prompt = hybridVoiceService['buildPersonalityPrompt'](mockPersonalityIntegration);
      
      expect(prompt).toContain('Test User');
      expect(prompt).toContain('casual, friendly manner');
      expect(prompt).toContain('humor and be playful');
      expect(prompt).toContain('empathy and emotional understanding');
      expect(prompt).toContain('likes coffee, works in tech');
    });

    it('should calculate style from personality correctly', () => {
      const style = hybridVoiceService['calculateStyleFromPersonality'](
        mockPersonalityIntegration.conversation_style
      );
      
      // Casual (0.2) + humor > 0.5 (0.2) = 0.6 (with floating point precision)
      expect(style).toBeCloseTo(0.6, 5);
    });

    it('should update personality integration for existing agent', async () => {
      // First initialize user voice
      mockConversationalAI.createAgent.mockResolvedValue('agent-123');
      await hybridVoiceService.initializeUserVoice('user-123', mockHybridVoiceConfig);

      // Mock the fetch for updating agent
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const updatedPersonality = {
        ...mockPersonalityIntegration,
        conversation_style: {
          ...mockPersonalityIntegration.conversation_style,
          formality: 'professional' as const,
        },
      };

      await hybridVoiceService.updatePersonalityIntegration('user-123', updatedPersonality);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/convai/agents/agent-123'),
        expect.objectContaining({
          method: 'PATCH',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockApiKey}`,
          }),
          body: expect.stringContaining('professional'),
        })
      );
    });
  });

  describe('Fallback Mechanisms', () => {
    it('should use fallback when primary method is unavailable', async () => {
      // Set conversational AI as unavailable
      hybridVoiceService['serviceHealth'].conversational_ai_status = 'unavailable';

      const request: VoiceGenerationRequest = {
        text: 'Hello world',
        voice_id: 'test-voice-id',
        use_conversational_ai: true,
      };

      // Mock successful Turbo v2.5 response
      (global.fetch as any).mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(1024),
      });

      const response = await hybridVoiceService.generateVoiceWithFallback(
        'user-123',
        request,
        mockHybridVoiceConfig
      );

      expect(response.generation_method).toBe('turbo_v2_5');
      expect(response.fallback_used).toBe(true);
    });

    it('should retry primary method before falling back', async () => {
      const request: VoiceGenerationRequest = {
        text: 'Hello world',
        voice_id: 'test-voice-id',
        use_conversational_ai: false,
      };

      // Mock first two calls to fail, third to succeed
      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(1024),
        });

      const response = await hybridVoiceService.generateVoiceWithFallback(
        'user-123',
        request,
        mockHybridVoiceConfig
      );

      expect(response.generation_method).toBe('turbo_v2_5');
      expect(response.fallback_used).toBe(false);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should determine fallback usage based on service health', () => {
      // Test healthy service
      expect(hybridVoiceService.shouldUseFallback('conversational_ai')).toBe(false);
      
      // Test unavailable service
      hybridVoiceService['serviceHealth'].conversational_ai_status = 'unavailable';
      expect(hybridVoiceService.shouldUseFallback('conversational_ai')).toBe(true);
      
      // Test degraded service with high error rate
      hybridVoiceService['serviceHealth'].conversational_ai_status = 'degraded';
      hybridVoiceService['serviceHealth'].error_rate = 0.4;
      expect(hybridVoiceService.shouldUseFallback('conversational_ai')).toBe(true);
    });
  });

  describe('Voice Capabilities', () => {
    it('should return correct capabilities for enabled conversational AI', () => {
      const capabilities = hybridVoiceService.getVoiceCapabilities(mockHybridVoiceConfig);
      
      expect(capabilities.conversational_ai).toBe(true);
      expect(capabilities.turbo_v2_5).toBe(true);
      expect(capabilities.streaming).toBe(true);
      expect(capabilities.interruption_handling).toBe(true);
      expect(capabilities.emotional_adaptation).toBe(true);
    });

    it('should return correct capabilities when conversational AI is unavailable', () => {
      hybridVoiceService['serviceHealth'].conversational_ai_status = 'unavailable';
      
      const capabilities = hybridVoiceService.getVoiceCapabilities(mockHybridVoiceConfig);
      
      expect(capabilities.conversational_ai).toBe(false);
      expect(capabilities.streaming).toBe(true); // Still true based on config
      expect(capabilities.interruption_handling).toBe(true); // Still true based on config
    });
  });

  describe('Service Health Monitoring', () => {
    it('should update service health after successful requests', () => {
      hybridVoiceService['recordSuccess'](1000);
      
      const health = hybridVoiceService.getServiceHealth();
      expect(health.average_response_time).toBe(1000);
      expect(health.error_rate).toBe(0);
    });

    it('should update service health after errors', () => {
      hybridVoiceService['totalRequests'] = 10;
      hybridVoiceService['recordError']();
      
      const health = hybridVoiceService.getServiceHealth();
      expect(health.error_rate).toBe(0.1); // 1 error out of 10 requests
    });

    it('should update service status based on error rate', () => {
      // Simulate high error rate
      hybridVoiceService['totalRequests'] = 10;
      hybridVoiceService['errorCount'] = 2; // 20% error rate
      hybridVoiceService['updateServiceHealth']();
      
      const health = hybridVoiceService.getServiceHealth();
      expect(health.conversational_ai_status).toBe('unavailable');
      expect(health.turbo_v2_5_status).toBe('unavailable');
    });
  });

  describe('Conversation Management', () => {
    it('should start conversation session with existing agent', async () => {
      // Setup agent
      mockConversationalAI.createAgent.mockResolvedValue('agent-123');
      await hybridVoiceService.initializeUserVoice('user-123', mockHybridVoiceConfig);

      // Mock conversation start
      mockConversationalAI.startConversation.mockResolvedValue('conversation-123');

      const onMessage = vi.fn();
      const onError = vi.fn();

      const conversationId = await hybridVoiceService.startConversationSession(
        'user-123',
        mockHybridVoiceConfig,
        onMessage,
        onError
      );

      expect(conversationId).toBe('conversation-123');
      expect(mockConversationalAI.startConversation).toHaveBeenCalledWith(
        'agent-123',
        'test-voice-id',
        onMessage,
        onError
      );
    });

    it('should throw error when starting conversation without agent', async () => {
      const onMessage = vi.fn();
      const onError = vi.fn();

      await expect(
        hybridVoiceService.startConversationSession(
          'user-123',
          mockHybridVoiceConfig,
          onMessage,
          onError
        )
      ).rejects.toThrow('No conversational AI agent found for user');
    });
  });

  describe('Agent Management', () => {
    it('should create personalized agent', async () => {
      mockConversationalAI.createPersonalizedAgent.mockResolvedValue('new-agent-id');

      const agentId = await hybridVoiceService.createPersonalizedAgent(
        'user-123',
        'voice-123',
        mockPersonalityIntegration
      );

      expect(agentId).toBe('new-agent-id');
      expect(mockConversationalAI.createPersonalizedAgent).toHaveBeenCalledWith(
        'voice-123',
        expect.objectContaining({
          profile_data: mockPersonalityIntegration.profile_data,
          conversation_style: mockPersonalityIntegration.conversation_style,
        })
      );
    });

    it('should get user agent information', async () => {
      // Setup agent
      mockConversationalAI.createAgent.mockResolvedValue('agent-123');
      await hybridVoiceService.initializeUserVoice('user-123', mockHybridVoiceConfig);

      mockConversationalAI.getAgent.mockResolvedValue({ id: 'agent-123', name: 'Test Agent' });

      const agentInfo = await hybridVoiceService.getUserAgent('user-123');

      expect(agentInfo).toEqual({ id: 'agent-123', name: 'Test Agent' });
      expect(mockConversationalAI.getAgent).toHaveBeenCalledWith('agent-123');
    });

    it('should delete user agent', async () => {
      // Setup agent
      mockConversationalAI.createAgent.mockResolvedValue('agent-123');
      await hybridVoiceService.initializeUserVoice('user-123', mockHybridVoiceConfig);

      await hybridVoiceService.deleteUserAgent('user-123');

      expect(mockConversationalAI.deleteAgent).toHaveBeenCalledWith('agent-123');
    });
  });

  describe('Voice Generation', () => {
    it('should generate voice with Turbo v2.5 when conversational AI is disabled', async () => {
      const config = { ...mockHybridVoiceConfig, conversational_ai_enabled: false };
      const request: VoiceGenerationRequest = {
        text: 'Hello world',
        voice_id: 'test-voice-id',
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(1024),
      });

      const response = await hybridVoiceService.generateVoiceResponse('user-123', request, config);

      expect(response.generation_method).toBe('turbo_v2_5');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/text-to-speech/test-voice-id'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Hello world'),
        })
      );
    });

    it('should adjust voice settings based on emotional context', () => {
      const happySettings = hybridVoiceService['getVoiceSettingsForContext'](
        'happy',
        mockPersonalityIntegration.emotional_preferences
      );

      expect(happySettings.stability).toBe(0.6);
      expect(happySettings.style).toBe(0.4);

      const sadSettings = hybridVoiceService['getVoiceSettingsForContext'](
        'sad',
        mockPersonalityIntegration.emotional_preferences
      );

      expect(sadSettings.stability).toBe(0.85);
      expect(sadSettings.style).toBe(0.1);
    });
  });

  describe('Configuration Management', () => {
    it('should update fallback configuration', () => {
      const newConfig = {
        max_retries: 5,
        retry_delay: 2000,
      };

      hybridVoiceService.updateFallbackConfig(newConfig);

      const fallbackConfig = hybridVoiceService['fallbackConfig'];
      expect(fallbackConfig.max_retries).toBe(5);
      expect(fallbackConfig.retry_delay).toBe(2000);
      expect(fallbackConfig.enabled).toBe(true); // Should preserve existing values
    });
  });

  describe('Cleanup', () => {
    it('should cleanup all resources', () => {
      hybridVoiceService['activeAgents'].set('user-123', 'agent-123');
      hybridVoiceService['responseTimeHistory'] = [1000, 2000];
      hybridVoiceService['errorCount'] = 5;
      hybridVoiceService['totalRequests'] = 10;

      hybridVoiceService.cleanup();

      expect(mockConversationalAI.cleanup).toHaveBeenCalled();
      expect(hybridVoiceService['activeAgents'].size).toBe(0);
      expect(hybridVoiceService['responseTimeHistory']).toEqual([]);
      expect(hybridVoiceService['errorCount']).toBe(0);
      expect(hybridVoiceService['totalRequests']).toBe(0);
    });
  });
});