/**
 * Enhanced Voice System
 * Main orchestrator for ElevenLabs Conversational AI infrastructure
 */

import { HybridVoiceService, HybridVoiceConfig, VoiceGenerationRequest, VoiceGenerationResponse } from './hybridVoiceService';
import { ConversationalAIService, WebSocketMessage } from './conversationalAIService';
import { WebSocketManager, ConnectionState } from './websocketManager';

export interface EnhancedVoiceSystemConfig {
  apiKey: string;
  userId: string;
  voiceConfig: HybridVoiceConfig;
}

export interface VoiceSystemState {
  initialized: boolean;
  conversationActive: boolean;
  currentConversationId?: string;
  connectionState?: ConnectionState;
  lastError?: Error;
}

export class EnhancedVoiceSystem {
  private hybridVoiceService: HybridVoiceService;
  private websocketManager: WebSocketManager;
  private config: EnhancedVoiceSystemConfig;
  private state: VoiceSystemState;
  private messageHandlers: Set<(message: WebSocketMessage) => void> = new Set();
  private errorHandlers: Set<(error: Error) => void> = new Set();
  private stateChangeHandlers: Set<(state: VoiceSystemState) => void> = new Set();

  constructor(config: EnhancedVoiceSystemConfig) {
    this.config = config;
    this.hybridVoiceService = new HybridVoiceService(config.apiKey);
    this.websocketManager = new WebSocketManager();
    this.state = {
      initialized: false,
      conversationActive: false,
    };
  }

  /**
   * Initialize the enhanced voice system
   */
  async initialize(): Promise<void> {
    try {
      console.log(`Initializing Enhanced Voice System for user ${this.config.userId}`);
      
      await this.hybridVoiceService.initializeUserVoice(
        this.config.userId,
        this.config.voiceConfig
      );

      this.state.initialized = true;
      this.notifyStateChange();
      
      console.log('Enhanced Voice System initialized successfully');
    } catch (error) {
      console.error('Error initializing Enhanced Voice System:', error);
      this.state.lastError = error as Error;
      this.notifyStateChange();
      throw error;
    }
  }

  /**
   * Start a real-time conversation session
   */
  async startConversation(): Promise<string> {
    if (!this.state.initialized) {
      throw new Error('Voice system not initialized');
    }

    try {
      const conversationId = await this.hybridVoiceService.startConversationSession(
        this.config.userId,
        this.config.voiceConfig,
        (message) => this.handleWebSocketMessage(message),
        (error) => this.handleWebSocketError(error)
      );

      this.state.conversationActive = true;
      this.state.currentConversationId = conversationId;
      this.notifyStateChange();

      console.log(`Started conversation session: ${conversationId}`);
      return conversationId;
    } catch (error) {
      console.error('Error starting conversation:', error);
      this.state.lastError = error as Error;
      this.notifyStateChange();
      throw error;
    }
  }

  /**
   * Send audio data to active conversation
   */
  sendAudio(audioData: ArrayBuffer): void {
    if (!this.state.conversationActive || !this.state.currentConversationId) {
      throw new Error('No active conversation');
    }

    try {
      this.hybridVoiceService.sendAudioToConversation(
        this.state.currentConversationId,
        audioData
      );
    } catch (error) {
      console.error('Error sending audio:', error);
      this.state.lastError = error as Error;
      this.notifyStateChange();
      throw error;
    }
  }

  /**
   * Send text message to active conversation
   */
  sendText(text: string): void {
    if (!this.state.conversationActive || !this.state.currentConversationId) {
      throw new Error('No active conversation');
    }

    try {
      this.hybridVoiceService.sendTextToConversation(
        this.state.currentConversationId,
        text
      );
    } catch (error) {
      console.error('Error sending text:', error);
      this.state.lastError = error as Error;
      this.notifyStateChange();
      throw error;
    }
  }

  /**
   * Generate voice response (non-real-time)
   */
  async generateVoiceResponse(request: VoiceGenerationRequest): Promise<VoiceGenerationResponse> {
    if (!this.state.initialized) {
      throw new Error('Voice system not initialized');
    }

    try {
      return await this.hybridVoiceService.generateVoiceResponse(
        this.config.userId,
        request,
        this.config.voiceConfig
      );
    } catch (error) {
      console.error('Error generating voice response:', error);
      this.state.lastError = error as Error;
      this.notifyStateChange();
      throw error;
    }
  }

  /**
   * End active conversation
   */
  endConversation(): void {
    if (this.state.currentConversationId) {
      try {
        this.hybridVoiceService.endConversationSession(this.state.currentConversationId);
        
        this.state.conversationActive = false;
        this.state.currentConversationId = undefined;
        this.state.connectionState = undefined;
        this.notifyStateChange();
        
        console.log('Conversation ended');
      } catch (error) {
        console.error('Error ending conversation:', error);
        this.state.lastError = error as Error;
        this.notifyStateChange();
      }
    }
  }

  /**
   * Update voice configuration
   */
  async updateVoiceConfig(newConfig: Partial<HybridVoiceConfig>): Promise<void> {
    try {
      this.config.voiceConfig = { ...this.config.voiceConfig, ...newConfig };
      
      if (newConfig.personality_integration) {
        await this.hybridVoiceService.updatePersonalityIntegration(
          this.config.userId,
          newConfig.personality_integration
        );
      }

      this.notifyStateChange();
      console.log('Voice configuration updated');
    } catch (error) {
      console.error('Error updating voice configuration:', error);
      this.state.lastError = error as Error;
      this.notifyStateChange();
      throw error;
    }
  }

  /**
   * Get current system state
   */
  getState(): VoiceSystemState {
    return { ...this.state };
  }

  /**
   * Add message handler
   */
  onMessage(handler: (message: WebSocketMessage) => void): void {
    this.messageHandlers.add(handler);
  }

  /**
   * Remove message handler
   */
  offMessage(handler: (message: WebSocketMessage) => void): void {
    this.messageHandlers.delete(handler);
  }

  /**
   * Add error handler
   */
  onError(handler: (error: Error) => void): void {
    this.errorHandlers.add(handler);
  }

  /**
   * Remove error handler
   */
  offError(handler: (error: Error) => void): void {
    this.errorHandlers.delete(handler);
  }

  /**
   * Add state change handler
   */
  onStateChange(handler: (state: VoiceSystemState) => void): void {
    this.stateChangeHandlers.add(handler);
  }

  /**
   * Remove state change handler
   */
  offStateChange(handler: (state: VoiceSystemState) => void): void {
    this.stateChangeHandlers.delete(handler);
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.endConversation();
    this.websocketManager.disconnectAll();
    this.messageHandlers.clear();
    this.errorHandlers.clear();
    this.stateChangeHandlers.clear();
    
    this.state = {
      initialized: false,
      conversationActive: false,
    };
    
    console.log('Enhanced Voice System cleaned up');
  }

  private handleWebSocketMessage(message: WebSocketMessage): void {
    console.log('Received WebSocket message:', message.type);
    
    // Update connection state if needed
    if (message.type === 'connection_established') {
      this.state.connectionState = {
        id: message.conversation_id,
        status: 'connected',
        lastActivity: new Date(),
        reconnectAttempts: 0,
        maxReconnectAttempts: 3,
      };
      this.notifyStateChange();
    }

    // Notify all message handlers
    this.messageHandlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('Error in message handler:', error);
      }
    });
  }

  private handleWebSocketError(error: Error): void {
    console.error('WebSocket error:', error);
    
    this.state.lastError = error;
    if (this.state.connectionState) {
      this.state.connectionState.status = 'error';
    }
    this.notifyStateChange();

    // Notify all error handlers
    this.errorHandlers.forEach(handler => {
      try {
        handler(error);
      } catch (handlerError) {
        console.error('Error in error handler:', handlerError);
      }
    });
  }

  private notifyStateChange(): void {
    this.stateChangeHandlers.forEach(handler => {
      try {
        handler(this.getState());
      } catch (error) {
        console.error('Error in state change handler:', error);
      }
    });
  }
}

// Export factory function for easy instantiation
export function createEnhancedVoiceSystem(config: EnhancedVoiceSystemConfig): EnhancedVoiceSystem {
  return new EnhancedVoiceSystem(config);
}