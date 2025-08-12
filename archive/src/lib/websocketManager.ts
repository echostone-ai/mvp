/**
 * WebSocket Connection Manager
 * Handles real-time streaming connections for Conversational AI
 */

export interface WebSocketConfig {
  url: string;
  protocols?: string[];
  reconnectAttempts?: number;
  reconnectDelay?: number;
  heartbeatInterval?: number;
}

export interface ConnectionState {
  id: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting';
  lastActivity: Date;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
}

export type MessageHandler = (data: any) => void;
export type ErrorHandler = (error: Error) => void;
export type StateChangeHandler = (state: ConnectionState) => void;

export class WebSocketManager {
  private connections: Map<string, WebSocket> = new Map();
  private connectionStates: Map<string, ConnectionState> = new Map();
  private messageHandlers: Map<string, MessageHandler> = new Map();
  private errorHandlers: Map<string, ErrorHandler> = new Map();
  private stateChangeHandlers: Map<string, StateChangeHandler> = new Map();
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Create a new WebSocket connection
   */
  async connect(
    connectionId: string,
    config: WebSocketConfig,
    onMessage: MessageHandler,
    onError: ErrorHandler,
    onStateChange?: StateChangeHandler
  ): Promise<void> {
    try {
      // Clean up existing connection if any
      this.disconnect(connectionId);

      const ws = new WebSocket(config.url, config.protocols);
      const state: ConnectionState = {
        id: connectionId,
        status: 'connecting',
        lastActivity: new Date(),
        reconnectAttempts: 0,
        maxReconnectAttempts: config.reconnectAttempts || 3,
      };

      this.connections.set(connectionId, ws);
      this.connectionStates.set(connectionId, state);
      this.messageHandlers.set(connectionId, onMessage);
      this.errorHandlers.set(connectionId, onError);
      
      if (onStateChange) {
        this.stateChangeHandlers.set(connectionId, onStateChange);
      }

      ws.onopen = () => {
        console.log(`WebSocket connection ${connectionId} established`);
        this.updateConnectionState(connectionId, 'connected');
        this.startHeartbeat(connectionId, config.heartbeatInterval || 30000);
      };

      ws.onmessage = (event) => {
        this.updateLastActivity(connectionId);
        
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          onMessage(data);
        } catch (error) {
          console.error(`Error parsing message for connection ${connectionId}:`, error);
          onError(new Error('Failed to parse WebSocket message'));
        }
      };

      ws.onerror = (error) => {
        console.error(`WebSocket error for connection ${connectionId}:`, error);
        this.updateConnectionState(connectionId, 'error');
        onError(new Error('WebSocket connection error'));
      };

      ws.onclose = (event) => {
        console.log(`WebSocket connection ${connectionId} closed:`, event.code, event.reason);
        this.stopHeartbeat(connectionId);
        
        if (event.code !== 1000 && event.code !== 1001) {
          // Unexpected close, attempt reconnection
          this.attemptReconnection(connectionId, config, onMessage, onError, onStateChange);
        } else {
          this.updateConnectionState(connectionId, 'disconnected');
          this.cleanup(connectionId);
        }
      };

    } catch (error) {
      console.error(`Error creating WebSocket connection ${connectionId}:`, error);
      throw error;
    }
  }

  /**
   * Send data through WebSocket connection
   */
  send(connectionId: string, data: any): void {
    const ws = this.connections.get(connectionId);
    const state = this.connectionStates.get(connectionId);

    if (!ws || !state) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    if (ws.readyState !== WebSocket.OPEN) {
      throw new Error(`Connection ${connectionId} is not open`);
    }

    try {
      if (typeof data === 'string' || data instanceof ArrayBuffer) {
        ws.send(data);
      } else {
        ws.send(JSON.stringify(data));
      }
      
      this.updateLastActivity(connectionId);
    } catch (error) {
      console.error(`Error sending data through connection ${connectionId}:`, error);
      throw error;
    }
  }

  /**
   * Disconnect WebSocket connection
   */
  disconnect(connectionId: string): void {
    const ws = this.connections.get(connectionId);
    
    if (ws) {
      ws.close(1000, 'Normal closure');
    }
    
    this.cleanup(connectionId);
  }

  /**
   * Get connection state
   */
  getConnectionState(connectionId: string): ConnectionState | null {
    return this.connectionStates.get(connectionId) || null;
  }

  /**
   * Get all active connections
   */
  getActiveConnections(): string[] {
    return Array.from(this.connections.keys()).filter(id => {
      const ws = this.connections.get(id);
      return ws && ws.readyState === WebSocket.OPEN;
    });
  }

  /**
   * Check if connection is active
   */
  isConnected(connectionId: string): boolean {
    const ws = this.connections.get(connectionId);
    return ws ? ws.readyState === WebSocket.OPEN : false;
  }

  /**
   * Disconnect all connections
   */
  disconnectAll(): void {
    for (const connectionId of this.connections.keys()) {
      this.disconnect(connectionId);
    }
  }

  private async attemptReconnection(
    connectionId: string,
    config: WebSocketConfig,
    onMessage: MessageHandler,
    onError: ErrorHandler,
    onStateChange?: StateChangeHandler
  ): Promise<void> {
    const state = this.connectionStates.get(connectionId);
    
    if (!state || state.reconnectAttempts >= state.maxReconnectAttempts) {
      console.log(`Max reconnection attempts reached for connection ${connectionId}`);
      this.updateConnectionState(connectionId, 'error');
      this.cleanup(connectionId);
      return;
    }

    state.reconnectAttempts++;
    this.updateConnectionState(connectionId, 'reconnecting');

    const delay = (config.reconnectDelay || 1000) * Math.pow(2, state.reconnectAttempts - 1);
    
    console.log(`Attempting to reconnect ${connectionId} in ${delay}ms (attempt ${state.reconnectAttempts})`);
    
    setTimeout(async () => {
      try {
        await this.connect(connectionId, config, onMessage, onError, onStateChange);
      } catch (error) {
        console.error(`Reconnection attempt ${state.reconnectAttempts} failed for ${connectionId}:`, error);
        this.attemptReconnection(connectionId, config, onMessage, onError, onStateChange);
      }
    }, delay);
  }

  private updateConnectionState(connectionId: string, status: ConnectionState['status']): void {
    const state = this.connectionStates.get(connectionId);
    
    if (state) {
      state.status = status;
      state.lastActivity = new Date();
      
      const stateChangeHandler = this.stateChangeHandlers.get(connectionId);
      if (stateChangeHandler) {
        stateChangeHandler(state);
      }
    }
  }

  private updateLastActivity(connectionId: string): void {
    const state = this.connectionStates.get(connectionId);
    if (state) {
      state.lastActivity = new Date();
    }
  }

  private startHeartbeat(connectionId: string, interval: number): void {
    const heartbeatInterval = setInterval(() => {
      const ws = this.connections.get(connectionId);
      
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        } catch (error) {
          console.error(`Heartbeat failed for connection ${connectionId}:`, error);
          this.stopHeartbeat(connectionId);
        }
      } else {
        this.stopHeartbeat(connectionId);
      }
    }, interval);

    this.heartbeatIntervals.set(connectionId, heartbeatInterval);
  }

  private stopHeartbeat(connectionId: string): void {
    const interval = this.heartbeatIntervals.get(connectionId);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(connectionId);
    }
  }

  private cleanup(connectionId: string): void {
    this.connections.delete(connectionId);
    this.connectionStates.delete(connectionId);
    this.messageHandlers.delete(connectionId);
    this.errorHandlers.delete(connectionId);
    this.stateChangeHandlers.delete(connectionId);
    this.stopHeartbeat(connectionId);
  }
}