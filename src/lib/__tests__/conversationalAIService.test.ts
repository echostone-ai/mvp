/**
 * Unit tests for ConversationalAIService
 */

import { ConversationalAIService, PersonalityIntegration, WebSocketMessage } from '../conversationalAIService';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(public url: string) {
    // Simulate connection opening
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  send(data: any) {
    // Mock send functionality
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code: 1000, reason: 'Normal closure' }));
    }
  }

  // Helper method to simulate receiving messages
  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }

  // Helper method to simulate errors
  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }
}

// Mock fetch
global.fetch = jest.fn();
global.WebSocket = MockWebSocket as any;

describe('ConversationalAIService', () => {
  let service: ConversationalAIService;
  const mockApiKey = 'test-api-key';

  beforeEach(() => {
    service = new ConversationalAIService(mockApiKey);
    jest.clearAllMocks();
  });

  afterEach(() => {
    service.cleanup();
  });

  describe('createAgent', () => {
    it('should create a new conversational AI agent', async () => {
      const mockResponse = { agent_id: 'test-agent-id' };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const config = {
        agent_id: '',
        voice_id: 'test-voice-id',
        knowledge_base: ['test knowledge'],
        personality_prompt: 'Test personality',
        conversation_config: {
          language: 'en',
          response_format: 'audio' as const,
          max_duration: 300,
          interruption_threshold: 0.5,
          stability: 0.75,
          similarity_boost: 0.85,
          style: 0.2,
          use_speaker_boost: true,
        },
      };

      const agentId = await service.createAgent(config);

      expect(agentId).toBe('test-agent-id');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/convai/agents',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json',
          },
        })
      );
    });

    it('should throw error when API request fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
      });

      const config = {
        agent_id: '',
        voice_id: 'test-voice-id',
        knowledge_base: [],
        personality_prompt: 'Test',
        conversation_config: {
          language: 'en',
          response_format: 'audio' as const,
          max_duration: 300,
          interruption_threshold: 0.5,
          stability: 0.75,
          similarity_boost: 0.85,
          style: 0.2,
          use_speaker_boost: true,
        },
      };

      await expect(service.createAgent(config)).rejects.toThrow('Failed to create agent: Bad Request');
    });
  });

  describe('createPersonalizedAgent', () => {
    it('should create agent with personality integration', async () => {
      const mockResponse = { agent_id: 'personalized-agent-id' };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const personalityIntegration: PersonalityIntegration = {
        profile_data: {
          id: 'user-123',
          name: 'John Doe',
          preferences: {},
          memory_context: ['likes coffee', 'works in tech'],
        },
        conversation_style: {
          formality: 'casual',
          humor_level: 0.8,
          empathy_level: 0.9,
          response_length: 'medium',
        },
        emotional_preferences: {
          default_emotion: 'friendly',
          emotional_range: 0.7,
          context_sensitivity: 0.8,
          adaptation_speed: 0.6,
        },
        knowledge_base_entries: ['User works in technology'],
      };

      const agentId = await service.createPersonalizedAgent('voice-123', personalityIntegration);

      expect(agentId).toBe('personalized-agent-id');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/convai/agents',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('startConversation', () => {
    it('should start a new conversation and return conversation ID', async () => {
      const onMessage = jest.fn();
      const onError = jest.fn();

      const conversationId = await service.startConversation(
        'agent-123',
        'voice-123',
        onMessage,
        onError
      );

      expect(conversationId).toMatch(/^conv_\d+_[a-z0-9]+$/);

      // Wait for WebSocket to connect
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(onMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'connection_established',
          conversation_id: conversationId,
        })
      );
    });

    it('should handle WebSocket messages', async () => {
      const onMessage = jest.fn();
      const onError = jest.fn();

      const conversationId = await service.startConversation(
        'agent-123',
        'voice-123',
        onMessage,
        onError
      );

      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 20));

      // Simulate receiving a message
      const mockWs = service['activeConnections'].get(conversationId) as any;
      mockWs.simulateMessage({
        type: 'text_chunk',
        data: { text: 'Hello world' },
      });

      expect(onMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'text_chunk',
          data: { text: 'Hello world' },
          conversation_id: conversationId,
        })
      );
    });
  });

  describe('startConversationWithReconnect', () => {
    it('should start conversation with reconnection capability', async () => {
      const onMessage = jest.fn();
      const onError = jest.fn();

      const conversationId = await service.startConversationWithReconnect(
        'agent-123',
        'voice-123',
        onMessage,
        onError
      );

      expect(conversationId).toMatch(/^conv_\d+_[a-z0-9]+$/);

      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(onMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'connection_established',
        })
      );
    });
  });

  describe('sendText', () => {
    it('should send text message to active conversation', async () => {
      const onMessage = jest.fn();
      const onError = jest.fn();

      const conversationId = await service.startConversation(
        'agent-123',
        'voice-123',
        onMessage,
        onError
      );

      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 20));

      const mockWs = service['activeConnections'].get(conversationId) as any;
      const sendSpy = jest.spyOn(mockWs, 'send');

      service.sendText(conversationId, 'Hello');

      expect(sendSpy).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'text_input',
          data: { text: 'Hello' },
        })
      );
    });

    it('should throw error when WebSocket is not available', () => {
      expect(() => {
        service.sendText('invalid-conversation-id', 'Hello');
      }).toThrow('WebSocket connection not available');
    });
  });

  describe('sendAudio', () => {
    it('should send audio data to active conversation', async () => {
      const onMessage = jest.fn();
      const onError = jest.fn();

      const conversationId = await service.startConversation(
        'agent-123',
        'voice-123',
        onMessage,
        onError
      );

      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 20));

      const mockWs = service['activeConnections'].get(conversationId) as any;
      const sendSpy = jest.spyOn(mockWs, 'send');

      const audioData = new ArrayBuffer(1024);
      service.sendAudio(conversationId, audioData);

      expect(sendSpy).toHaveBeenCalledWith(audioData);
    });
  });

  describe('updateAgentPersonality', () => {
    it('should update agent personality', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
      });

      const personalityIntegration: PersonalityIntegration = {
        profile_data: {
          id: 'user-123',
          name: 'John Doe',
          preferences: {},
          memory_context: [],
        },
        conversation_style: {
          formality: 'professional',
          humor_level: 0.3,
          empathy_level: 0.8,
          response_length: 'long',
        },
        emotional_preferences: {
          default_emotion: 'neutral',
          emotional_range: 0.5,
          context_sensitivity: 0.7,
          adaptation_speed: 0.5,
        },
        knowledge_base_entries: [],
      };

      await service.updateAgentPersonality('agent-123', personalityIntegration);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/convai/agents/agent-123',
        expect.objectContaining({
          method: 'PATCH',
        })
      );
    });
  });

  describe('getAgent', () => {
    it('should retrieve agent information', async () => {
      const mockAgent = { agent_id: 'agent-123', name: 'Test Agent' };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAgent),
      });

      const agent = await service.getAgent('agent-123');

      expect(agent).toEqual(mockAgent);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/convai/agents/agent-123',
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer test-api-key',
          },
        })
      );
    });
  });

  describe('deleteAgent', () => {
    it('should delete agent', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
      });

      await service.deleteAgent('agent-123');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/convai/agents/agent-123',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('conversation state management', () => {
    it('should track conversation state', async () => {
      const onMessage = jest.fn();
      const onError = jest.fn();

      const conversationId = await service.startConversation(
        'agent-123',
        'voice-123',
        onMessage,
        onError
      );

      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 20));

      const state = service.getConversationState(conversationId);
      expect(state).toMatchObject({
        id: conversationId,
        status: 'idle',
        agent_id: 'agent-123',
        voice_id: 'voice-123',
      });
    });

    it('should return all active conversations', async () => {
      const onMessage = jest.fn();
      const onError = jest.fn();

      const conversationId1 = await service.startConversation(
        'agent-123',
        'voice-123',
        onMessage,
        onError
      );

      const conversationId2 = await service.startConversation(
        'agent-456',
        'voice-456',
        onMessage,
        onError
      );

      // Wait for connections
      await new Promise(resolve => setTimeout(resolve, 20));

      const activeConversations = service.getActiveConversations();
      expect(activeConversations).toHaveLength(2);
      expect(activeConversations.map(c => c.id)).toContain(conversationId1);
      expect(activeConversations.map(c => c.id)).toContain(conversationId2);
    });
  });

  describe('connection health', () => {
    it('should check connection health', async () => {
      const onMessage = jest.fn();
      const onError = jest.fn();

      const conversationId = await service.startConversation(
        'agent-123',
        'voice-123',
        onMessage,
        onError
      );

      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(service.isConnectionHealthy(conversationId)).toBe(true);
      expect(service.isConnectionHealthy('invalid-id')).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should cleanup all connections', async () => {
      const onMessage = jest.fn();
      const onError = jest.fn();

      const conversationId = await service.startConversation(
        'agent-123',
        'voice-123',
        onMessage,
        onError
      );

      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(service.getActiveConversations()).toHaveLength(1);

      service.cleanup();

      expect(service.getActiveConversations()).toHaveLength(0);
    });
  });

  describe('personality prompt building', () => {
    it('should build appropriate personality prompt', () => {
      const personalityIntegration: PersonalityIntegration = {
        profile_data: {
          id: 'user-123',
          name: 'Alice',
          preferences: {},
          memory_context: ['loves hiking', 'vegetarian'],
        },
        conversation_style: {
          formality: 'casual',
          humor_level: 0.9,
          empathy_level: 0.8,
          response_length: 'short',
        },
        emotional_preferences: {
          default_emotion: 'cheerful',
          emotional_range: 0.8,
          context_sensitivity: 0.9,
          adaptation_speed: 0.7,
        },
        knowledge_base_entries: [],
      };

      // Access private method for testing
      const prompt = (service as any).buildPersonalityPrompt(personalityIntegration);

      expect(prompt).toContain('Alice');
      expect(prompt).toContain('casual, friendly manner');
      expect(prompt).toContain('humor and be playful');
      expect(prompt).toContain('high empathy');
      expect(prompt).toContain('concise and to the point');
      expect(prompt).toContain('cheerful');
      expect(prompt).toContain('loves hiking, vegetarian');
    });
  });

  describe('style calculation', () => {
    it('should calculate appropriate style from personality', () => {
      const personalityIntegration: PersonalityIntegration = {
        profile_data: {
          id: 'user-123',
          name: 'Bob',
          preferences: {},
          memory_context: [],
        },
        conversation_style: {
          formality: 'casual',
          humor_level: 0.8,
          empathy_level: 0.7,
          response_length: 'medium',
        },
        emotional_preferences: {
          default_emotion: 'neutral',
          emotional_range: 0.6,
          context_sensitivity: 0.5,
          adaptation_speed: 0.5,
        },
        knowledge_base_entries: [],
      };

      // Access private method for testing
      const style = (service as any).calculateStyleFromPersonality(personalityIntegration);

      expect(style).toBeGreaterThan(0);
      expect(style).toBeLessThanOrEqual(1);
      expect(typeof style).toBe('number');
    });
  });
});