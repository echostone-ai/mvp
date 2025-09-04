/**
 * Device Handoff Manager
 * Handles seamless conversation transfers between devices
 */

import { supabase } from '../supabase';
import { crossDeviceSyncService, ConversationSyncState, DeviceInfo } from './crossDeviceSyncService';

export interface HandoffRequest {
  id: string;
  conversationId: string;
  sourceDeviceId: string;
  targetDeviceId: string;
  handoffData: {
    conversationState: ConversationSyncState;
    audioState?: {
      currentPosition: number;
      isPlaying: boolean;
      queuedAudio: any[];
    };
    expressionState?: {
      activeExpressions: any[];
      scheduledExpressions: any[];
    };
    memoryContext: string;
  };
  status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'failed';
  createdAt: Date;
  expiresAt: Date;
}

export interface HandoffCapabilities {
  canReceiveAudio: boolean;
  canReceiveExpressions: boolean;
  canReceiveMemory: boolean;
  audioFormats: string[];
  maxBitrate: number;
}

export class DeviceHandoffManager {
  private activeHandoffs: Map<string, HandoffRequest> = new Map();
  private handoffCallbacks: Map<string, (request: HandoffRequest) => void> = new Map();

  constructor() {
    this.initializeHandoffListener();
  }

  private initializeHandoffListener(): void {
    // Listen for handoff requests via Supabase realtime
    supabase
      .channel('device_handoffs')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'device_handoffs'
      }, (payload) => {
        this.handleIncomingHandoffRequest(payload.new);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'device_handoffs'
      }, (payload) => {
        this.handleHandoffStatusUpdate(payload.new);
      })
      .subscribe();
  }

  async initiateHandoff(
    conversationId: string,
    targetDeviceId: string,
    currentState: any
  ): Promise<string> {
    const sourceDeviceId = crossDeviceSyncService['deviceId'];
    
    // Validate target device is available
    const targetDevice = await this.getDeviceInfo(targetDeviceId);
    if (!targetDevice || !targetDevice.isActive) {
      throw new Error('Target device is not available');
    }

    // Check handoff capabilities
    const capabilities = await this.checkHandoffCapabilities(targetDeviceId);
    if (!capabilities.canReceiveAudio) {
      throw new Error('Target device cannot receive audio handoff');
    }

    // Prepare handoff data
    const handoffData = await this.prepareHandoffData(conversationId, currentState);
    
    // Create handoff request
    const { data: handoffRequest, error } = await supabase
      .from('device_handoffs')
      .insert({
        conversation_id: conversationId,
        source_device_id: sourceDeviceId,
        target_device_id: targetDeviceId,
        handoff_data: handoffData,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create handoff request: ${error.message}`);
    }

    // Set expiration timer (30 seconds)
    setTimeout(() => {
      this.expireHandoffRequest(handoffRequest.id);
    }, 30000);

    return handoffRequest.id;
  }

  async acceptHandoff(handoffId: string): Promise<boolean> {
    const { data: handoff, error } = await supabase
      .from('device_handoffs')
      .select('*')
      .eq('id', handoffId)
      .single();

    if (error || !handoff) {
      throw new Error('Handoff request not found');
    }

    // Validate this device can accept the handoff
    const currentDeviceId = crossDeviceSyncService['deviceId'];
    if (handoff.target_device_id !== currentDeviceId) {
      throw new Error('Handoff not intended for this device');
    }

    try {
      // Update handoff status to accepted
      await supabase
        .from('device_handoffs')
        .update({ status: 'accepted' })
        .eq('id', handoffId);

      // Apply handoff data to current device
      await this.applyHandoffData(handoff.handoff_data);

      // Update conversation sync state to make this device primary
      await crossDeviceSyncService.syncConversationUpdate(handoff.conversation_id, {
        type: 'handoff',
        data: {
          sourceDevice: handoff.source_device_id,
          targetDevice: currentDeviceId,
          handoffId: handoffId
        }
      });

      // Mark handoff as completed
      await supabase
        .from('device_handoffs')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', handoffId);

      return true;
    } catch (error) {
      // Mark handoff as failed
      await supabase
        .from('device_handoffs')
        .update({ status: 'failed' })
        .eq('id', handoffId);
      
      throw error;
    }
  }

  async rejectHandoff(handoffId: string, reason?: string): Promise<void> {
    await supabase
      .from('device_handoffs')
      .update({ 
        status: 'rejected',
        handoff_data: { rejection_reason: reason }
      })
      .eq('id', handoffId);
  }

  private async prepareHandoffData(
    conversationId: string,
    currentState: any
  ): Promise<any> {
    // Get current conversation sync state
    const { data: syncState } = await supabase
      .from('conversation_sync_state')
      .select('*')
      .eq('conversation_id', conversationId)
      .single();

    // Prepare audio state if available
    const audioState = currentState.audioManager ? {
      currentPosition: currentState.audioManager.getCurrentPosition(),
      isPlaying: currentState.audioManager.isPlaying(),
      queuedAudio: currentState.audioManager.getQueuedAudio()
    } : undefined;

    // Prepare expression state if available
    const expressionState = currentState.expressionManager ? {
      activeExpressions: currentState.expressionManager.getActiveExpressions(),
      scheduledExpressions: currentState.expressionManager.getScheduledExpressions()
    } : undefined;

    // Get memory context
    const memoryContext = currentState.memoryContext || '';

    return {
      conversationState: syncState?.sync_state,
      audioState,
      expressionState,
      memoryContext,
      timestamp: new Date().toISOString(),
      deviceCapabilities: await crossDeviceSyncService.getOptimalAudioSettings()
    };
  }

  private async applyHandoffData(handoffData: any): Promise<void> {
    // This would be implemented by the receiving component
    // For now, we'll emit an event that components can listen to
    const event = new CustomEvent('deviceHandoffReceived', {
      detail: handoffData
    });
    window.dispatchEvent(event);
  }

  private async getDeviceInfo(deviceId: string): Promise<DeviceInfo | null> {
    const { data: device } = await supabase
      .from('user_devices')
      .select('device_info')
      .eq('device_id', deviceId)
      .single();

    return device?.device_info || null;
  }

  private async checkHandoffCapabilities(deviceId: string): Promise<HandoffCapabilities> {
    const deviceInfo = await this.getDeviceInfo(deviceId);
    
    if (!deviceInfo) {
      return {
        canReceiveAudio: false,
        canReceiveExpressions: false,
        canReceiveMemory: false,
        audioFormats: [],
        maxBitrate: 0
      };
    }

    return {
      canReceiveAudio: deviceInfo.capabilities.supportsWebAudio,
      canReceiveExpressions: deviceInfo.capabilities.supportsWebAudio,
      canReceiveMemory: true, // Memory is always transferable
      audioFormats: deviceInfo.capabilities.audioFormats,
      maxBitrate: deviceInfo.capabilities.maxBitrate
    };
  }

  private handleIncomingHandoffRequest(handoffData: any): void {
    const currentDeviceId = crossDeviceSyncService['deviceId'];
    
    if (handoffData.target_device_id === currentDeviceId) {
      const callback = this.handoffCallbacks.get('incoming');
      if (callback) {
        callback(handoffData);
      }
    }
  }

  private handleHandoffStatusUpdate(handoffData: any): void {
    const callback = this.handoffCallbacks.get(handoffData.id);
    if (callback) {
      callback(handoffData);
    }
  }

  private async expireHandoffRequest(handoffId: string): Promise<void> {
    await supabase
      .from('device_handoffs')
      .update({ status: 'failed' })
      .eq('id', handoffId)
      .eq('status', 'pending'); // Only expire if still pending
  }

  onHandoffRequest(callback: (request: HandoffRequest) => void): void {
    this.handoffCallbacks.set('incoming', callback);
  }

  onHandoffStatusUpdate(handoffId: string, callback: (request: HandoffRequest) => void): void {
    this.handoffCallbacks.set(handoffId, callback);
  }

  async getActiveDevices(conversationId: string): Promise<DeviceInfo[]> {
    const { data: syncState } = await supabase
      .from('conversation_sync_state')
      .select('sync_state')
      .eq('conversation_id', conversationId)
      .single();

    if (syncState?.sync_state) {
      const state = syncState.sync_state as ConversationSyncState;
      return state.activeDevices.filter(d => d.isActive);
    }

    return [];
  }

  async getPendingHandoffs(): Promise<HandoffRequest[]> {
    const currentDeviceId = crossDeviceSyncService['deviceId'];
    
    const { data: handoffs } = await supabase
      .from('device_handoffs')
      .select('*')
      .eq('target_device_id', currentDeviceId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    return handoffs || [];
  }

  cleanup(): void {
    this.handoffCallbacks.clear();
    this.activeHandoffs.clear();
  }
}

export const deviceHandoffManager = new DeviceHandoffManager();