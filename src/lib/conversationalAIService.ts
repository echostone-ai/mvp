/**
 * ElevenLabs Conversational AI Service
 * Handles real-time streaming conversations with personalized voice integration
 */

export interface ConversationalAIConfig {
  agent_id: string;
  voice_id: string;
  knowledge_base: string[];
  personality_prompt: string;
  conversation_config: ConversationConfig;
}

export interface PersonalityIntegration {
  profile_data: {
    id: string;
    name: string;
    preferences: Record<string, any>;
    memory_context: string[];
  };
  conversation_style: {
    formality: 'casual' | 'professional' | 'mixed';
    humor_level: number;
    empathy_level: number;
    response_length: 'short' | 'medium' | 'long';
  };
  emotional_preferences: {
    default_emotion: string;
    emotional_range: number;
    context_sensitivity: number;
    adaptation_speed: number;
  };
  knowledge_base_entries: string[];
}

export interface ConversationConfig {
  language: string;
  response_format: 'audio' | 'text' | 'both';
  max_duration: number;
  interruption_threshold: number;
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
}

export interface ConversationalAIResponse {
  audio_url?: string;
  text: string;
  conversation_id: string;
  user_input_duration: number;
  response_duration: number;
}

export interface WebSocketMessage {
  type: 'audio_chunk' | 'text_chunk' | 'conversation_end' | 'error' | 'connection_established';
  data: any;
  conversation_id: string;
  timestamp?: number;
}

export interface ConversationState {
  id: string;
  status: 'idle' | 'listening' | 'processing' | 'speaking' | 'error';
  agent_id: string;
  voice_id: string;
  created_at: Date;
  last_activity: Date;
}

export class ConversationalAIService {
  private apiKey: string;
  private baseUrl: string = 'https://api.elevenlabs.io/v1';
  private wsUrl: string = 'wss://api.elevenlabs.io/v1/convai/conversation';
  private activeConnections: Map<string, WebSocket> = new Map();
  private conversationStates: Map<string, ConversationState> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private maxReconnectAttempts: number = 3;
  private reconnectDelay: number = 1000;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Create a new conversational AI agent
   */
  async createAgent(config: ConversationalAIConfig): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/convai/agents`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'EchoStone Personal Agent',
          voice_id: config.voice_id,
          prompt: config.personality_prompt,
          language: config.conversation_config.language,
          knowledge_base: config.knowledge_base,
          conversation_config: {
            turn_detection: {
              type: 'server_vad',
              threshold: config.conversation_config.interruption_threshold,
            },
            agent_config: {
              stability: config.conversation_config.stability,
              similarity_boost: config.conversation_config.similarity_boost,
              style: config.conversation_config.style,
              use_speaker_boost: config.conversation_config.use_speaker_boost,
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create agent: ${response.statusText}`);
      }

      const data = await response.json();
      return data.agent_id;
    } catch (error) {
      console.error('Error creating conversational AI agent:', error);
      throw error;
    }
  }

  /**
   * Start a new conversation session
   */
  async startConversation(
    agentId: string,
    voiceId: string,
    onMessage: (message: WebSocketMessage) => void,
    onError: (error: Error) => void
  ): Promise<string> {
    const conversationId = this.generateConversationId();
    
    try {
      const ws = new WebSocket(`${this.wsUrl}?agent_id=${agentId}`);
      
      ws.onopen = () => {
        console.log('Conversational AI WebSocket connected');
        const state: ConversationState = {
          id: conversationId,
          status: 'idle',
          agent_id: agentId,
          voice_id: voiceId,
          created_at: new Date(),
          last_activity: new Date(),
        };
        
        this.conversationStates.set(conversationId, state);
        this.activeConnections.set(conversationId, ws);
        
        onMessage({
          type: 'connection_established',
          data: { conversation_id: conversationId },
          conversation_id: conversationId,
          timestamp: Date.now(),
        });
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.updateConversationActivity(conversationId);
          
          const wsMessage: WebSocketMessage = {
            type: message.type,
            data: message.data,
            conversation_id: conversationId,
            timestamp: Date.now(),
          };
          
          onMessage(wsMessage);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          onError(new Error('Failed to parse WebSocket message'));
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.updateConversationStatus(conversationId, 'error');
        onError(new Error('WebSocket connection error'));
      };

      ws.onclose = () => {
        console.log('WebSocket connection closed');
        this.cleanupConnection(conversationId);
      };

      return conversationId;
    } catch (error) {
      console.error('Error starting conversation:', error);
      throw error;
    }
  }

  /**
   * Send audio data to the conversation
   */
  sendAudio(conversationId: string, audioData: ArrayBuffer): void {
    const ws = this.activeConnections.get(conversationId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket connection not available');
    }

    this.updateConversationStatus(conversationId, 'processing');
    ws.send(audioData);
  }

  /**
   * Send text message to the conversation
   */
  sendText(conversationId: string, text: string): void {
    const ws = this.activeConnections.get(conversationId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket connection not available');
    }

    this.updateConversationStatus(conversationId, 'processing');
    ws.send(JSON.stringify({
      type: 'text_input',
      data: { text },
    }));
  }

  /**
   * End a conversation
   */
  endConversation(conversationId: string): void {
    const ws = this.activeConnections.get(conversationId);
    if (ws) {
      ws.close();
    }
    this.cleanupConnection(conversationId);
  }

  /**
   * Get conversation state
   */
  getConversationState(conversationId: string): ConversationState | null {
    return this.conversationStates.get(conversationId) || null;
  }

  /**
   * Get all active conversations
   */
  getActiveConversations(): ConversationState[] {
    return Array.from(this.conversationStates.values());
  }

  /**
   * Create agent with personality integration
   */
  async createPersonalizedAgent(
    voiceId: string,
    personalityIntegration: PersonalityIntegration
  ): Promise<string> {
    const personalityPrompt = this.buildPersonalityPrompt(personalityIntegration);
    
    const config: ConversationalAIConfig = {
      agent_id: '',
      voice_id: voiceId,
      knowledge_base: personalityIntegration.knowledge_base_entries,
      personality_prompt: personalityPrompt,
      conversation_config: {
        language: 'en',
        response_format: 'audio',
        max_duration: 300,
        interruption_threshold: 0.5,
        stability: 0.75,
        similarity_boost: 0.85,
        style: this.calculateStyleFromPersonality(personalityIntegration),
        use_speaker_boost: true,
      },
    };

    return await this.createAgent(config);
  }

  /**
   * Update agent personality
   */
  async updateAgentPersonality(
    agentId: string,
    personalityIntegration: PersonalityIntegration
  ): Promise<void> {
    try {
      const personalityPrompt = this.buildPersonalityPrompt(personalityIntegration);
      
      const response = await fetch(`${this.baseUrl}/convai/agents/${agentId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: personalityPrompt,
          knowledge_base: personalityIntegration.knowledge_base_entries,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update agent: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error updating agent personality:', error);
      throw error;
    }
  }

  /**
   * Start conversation with automatic reconnection
   */
  async startConversationWithReconnect(
    agentId: string,
    voiceId: string,
    onMessage: (message: WebSocketMessage) => void,
    onError: (error: Error) => void
  ): Promise<string> {
    const conversationId = this.generateConversationId();
    this.reconnectAttempts.set(conversationId, 0);
    
    await this.connectWebSocket(conversationId, agentId, voiceId, onMessage, onError);
    return conversationId;
  }

  /**
   * Get agent information
   */
  async getAgent(agentId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/convai/agents/${agentId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get agent: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting agent:', error);
      throw error;
    }
  }

  /**
   * Delete agent
   */
  async deleteAgent(agentId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/convai/agents/${agentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete agent: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error deleting agent:', error);
      throw error;
    }
  }

  /**
   * Check connection health
   */
  isConnectionHealthy(conversationId: string): boolean {
    const ws = this.activeConnections.get(conversationId);
    return ws ? ws.readyState === WebSocket.OPEN : false;
  }

  /**
   * Cleanup all connections
   */
  cleanup(): void {
    for (const [conversationId, ws] of this.activeConnections) {
      ws.close();
      this.cleanupConnection(conversationId);
    }
    this.reconnectAttempts.clear();
  }

  private generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateConversationStatus(conversationId: string, status: ConversationState['status']): void {
    const state = this.conversationStates.get(conversationId);
    if (state) {
      state.status = status;
      state.last_activity = new Date();
    }
  }

  private updateConversationActivity(conversationId: string): void {
    const state = this.conversationStates.get(conversationId);
    if (state) {
      state.last_activity = new Date();
    }
  }

  private cleanupConnection(conversationId: string): void {
    this.activeConnections.delete(conversationId);
    this.conversationStates.delete(conversationId);
    this.reconnectAttempts.delete(conversationId);
  }

  /**
   * Build personality prompt from integration data
   */
  private buildPersonalityPrompt(personalityIntegration: PersonalityIntegration): string {
    const { profile_data, conversation_style, emotional_preferences } = personalityIntegration;
    
    let prompt = `You are an AI assistant representing ${profile_data.name}. `;
    
    // Add conversation style
    switch (conversation_style.formality) {
      case 'casual':
        prompt += 'Speak in a casual, friendly manner. ';
        break;
      case 'professional':
        prompt += 'Maintain a professional and polished tone. ';
        break;
      case 'mixed':
        prompt += 'Adapt your formality based on the conversation context. ';
        break;
    }
    
    // Add humor and empathy levels
    if (conversation_style.humor_level > 0.7) {
      prompt += 'Feel free to use humor and be playful in your responses. ';
    } else if (conversation_style.humor_level < 0.3) {
      prompt += 'Keep responses serious and focused. ';
    }
    
    if (conversation_style.empathy_level > 0.7) {
      prompt += 'Show high empathy and emotional understanding. ';
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
        prompt += 'Provide balanced, medium-length responses. ';
    }
    
    // Add emotional preferences
    prompt += `Your default emotional tone should be ${emotional_preferences.default_emotion}. `;
    prompt += `Adapt your emotional responses based on context with ${Math.round(emotional_preferences.context_sensitivity * 100)}% sensitivity. `;
    
    // Add memory context if available
    if (profile_data.memory_context.length > 0) {
      prompt += 'Remember these important details about the user: ';
      prompt += profile_data.memory_context.slice(0, 3).join(', ') + '. ';
    }
    
    return prompt;
  }

  /**
   * Calculate voice style parameter from personality
   */
  private calculateStyleFromPersonality(personalityIntegration: PersonalityIntegration): number {
    const { conversation_style, emotional_preferences } = personalityIntegration;
    
    let style = 0.2; // Base style
    
    // Adjust based on formality
    if (conversation_style.formality === 'casual') {
      style += 0.2;
    } else if (conversation_style.formality === 'professional') {
      style -= 0.1;
    }
    
    // Adjust based on humor level
    style += conversation_style.humor_level * 0.3;
    
    // Adjust based on emotional range
    style += emotional_preferences.emotional_range * 0.2;
    
    // Clamp between 0 and 1
    return Math.max(0, Math.min(1, style));
  }

  /**
   * Connect WebSocket with reconnection logic
   */
  private async connectWebSocket(
    conversationId: string,
    agentId: string,
    voiceId: string,
    onMessage: (message: WebSocketMessage) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    try {
      const ws = new WebSocket(`${this.wsUrl}?agent_id=${agentId}`);
      
      ws.onopen = () => {
        console.log('Conversational AI WebSocket connected');
        this.reconnectAttempts.set(conversationId, 0);
        
        const state: ConversationState = {
          id: conversationId,
          status: 'idle',
          agent_id: agentId,
          voice_id: voiceId,
          created_at: new Date(),
          last_activity: new Date(),
        };
        
        this.conversationStates.set(conversationId, state);
        this.activeConnections.set(conversationId, ws);
        
        onMessage({
          type: 'connection_established',
          data: { conversation_id: conversationId },
          conversation_id: conversationId,
          timestamp: Date.now(),
        });
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.updateConversationActivity(conversationId);
          
          const wsMessage: WebSocketMessage = {
            type: message.type,
            data: message.data,
            conversation_id: conversationId,
            timestamp: Date.now(),
          };
          
          onMessage(wsMessage);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          onError(new Error('Failed to parse WebSocket message'));
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.updateConversationStatus(conversationId, 'error');
        this.handleReconnection(conversationId, agentId, voiceId, onMessage, onError);
      };

      ws.onclose = (event) => {
        console.log('WebSocket connection closed', event.code, event.reason);
        if (event.code !== 1000) { // Not a normal closure
          this.handleReconnection(conversationId, agentId, voiceId, onMessage, onError);
        } else {
          this.cleanupConnection(conversationId);
        }
      };

    } catch (error) {
      console.error('Error connecting WebSocket:', error);
      this.handleReconnection(conversationId, agentId, voiceId, onMessage, onError);
    }
  }

  /**
   * Handle WebSocket reconnection
   */
  private async handleReconnection(
    conversationId: string,
    agentId: string,
    voiceId: string,
    onMessage: (message: WebSocketMessage) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    const attempts = this.reconnectAttempts.get(conversationId) || 0;
    
    if (attempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      onError(new Error('Connection failed after maximum retry attempts'));
      this.cleanupConnection(conversationId);
      return;
    }
    
    this.reconnectAttempts.set(conversationId, attempts + 1);
    
    // Exponential backoff
    const delay = this.reconnectDelay * Math.pow(2, attempts);
    
    console.log(`Attempting reconnection ${attempts + 1}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      this.connectWebSocket(conversationId, agentId, voiceId, onMessage, onError);
    }, delay);
  }
}