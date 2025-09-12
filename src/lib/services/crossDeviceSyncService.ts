/**
 * Cross-Device Conversation Synchronization Service
 * Handles real-time conversation state sync across multiple devices
 */

import { createClient } from '@supabase/supabase-js';
import { supabase } from '../supabase';

export interface DeviceInfo {
  deviceId: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  userAgent: string;
  capabilities: {
    audioFormats: string[];
    maxBitrate: number;
    supportsWebRTC: boolean;
    supportsWebAudio: boolean;
  };
  lastSeen: Date;
  isActive: boolean;
}

export interface ConversationSyncState {
  conversationId: string;
  userId: string;
  avatarId: string;
  currentTurn: number;
  lastMessage: {
    id: string;
    content: string;
    timestamp: Date;
    sender: 'user' | 'assistant';
  };
  activeDevices: DeviceInfo[];
  primaryDevice: string;
  syncVersion: number;
  lastSyncTime: Date;
}

export interface ConversationUpdate {
  type: 'message' | 'turn_complete' | 'device_join' | 'device_leave' | 'handoff';
  conversationId: string;
  deviceId: string;
  timestamp: Date;
  data: any;
  syncVersion: number;
}

export class CrossDeviceSyncService {
  private deviceId: string;
  private syncChannel: any;
  private conflictResolver: ConflictResolver;
  private deviceOptimizer: DeviceOptimizer;
  private syncCallbacks: Map<string, (update: ConversationUpdate) => void> = new Map();

  constructor() {
    this.deviceId = this.generateDeviceId();
    this.conflictResolver = new ConflictResolver();
    this.deviceOptimizer = new DeviceOptimizer();
    this.initializeRealtimeSync();
  }

  private generateDeviceId(): string {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      // Server-side: generate a temporary ID
      return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    const stored = localStorage.getItem('echostone_device_id');
    if (stored) return stored;
    
    const newId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('echostone_device_id', newId);
    return newId;
  }

  private initializeRealtimeSync(): void {
    // Subscribe to conversation updates via Supabase realtime
    this.syncChannel = supabase
      .channel('conversation_sync')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversation_sync_state'
      }, (payload) => {
        this.handleRealtimeUpdate(payload);
      })
      .subscribe();
  }

  async registerDevice(userId: string): Promise<DeviceInfo> {
    const deviceInfo: DeviceInfo = {
      deviceId: this.deviceId,
      deviceType: this.detectDeviceType(),
      userAgent: navigator.userAgent,
      capabilities: await this.deviceOptimizer.detectCapabilities(),
      lastSeen: new Date(),
      isActive: true
    };

    // Store device info in database
    await supabase
      .from('user_devices')
      .upsert({
        user_id: userId,
        device_id: this.deviceId,
        device_info: deviceInfo,
        last_seen: new Date().toISOString()
      });

    return deviceInfo;
  }

  async joinConversation(conversationId: string, userId: string): Promise<ConversationSyncState> {
    // Get current conversation state
    const { data: syncState } = await supabase
      .from('conversation_sync_state')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .single();

    if (!syncState) {
      // Create new sync state
      const newState: ConversationSyncState = {
        conversationId,
        userId,
        avatarId: '', // Will be set by caller
        currentTurn: 0,
        lastMessage: {
          id: '',
          content: '',
          timestamp: new Date(),
          sender: 'user'
        },
        activeDevices: [],
        primaryDevice: this.deviceId,
        syncVersion: 1,
        lastSyncTime: new Date()
      };

      await supabase
        .from('conversation_sync_state')
        .insert({
          conversation_id: conversationId,
          user_id: userId,
          sync_state: newState,
          sync_version: 1,
          updated_at: new Date().toISOString()
        });

      return newState;
    }

    // Add this device to active devices
    const currentState = syncState.sync_state as ConversationSyncState;
    const deviceInfo = await this.registerDevice(userId);
    
    if (!currentState.activeDevices.find(d => d.deviceId === this.deviceId)) {
      currentState.activeDevices.push(deviceInfo);
      await this.updateSyncState(currentState);
    }

    return currentState;
  }

  async leaveConversation(conversationId: string): Promise<void> {
    const { data: syncState } = await supabase
      .from('conversation_sync_state')
      .select('*')
      .eq('conversation_id', conversationId)
      .single();

    if (syncState) {
      const currentState = syncState.sync_state as ConversationSyncState;
      currentState.activeDevices = currentState.activeDevices.filter(
        d => d.deviceId !== this.deviceId
      );

      // If this was the primary device, elect a new one
      if (currentState.primaryDevice === this.deviceId && currentState.activeDevices.length > 0) {
        currentState.primaryDevice = currentState.activeDevices[0].deviceId;
      }

      await this.updateSyncState(currentState);
    }
  }

  async syncConversationUpdate(
    conversationId: string,
    update: Partial<ConversationUpdate>
  ): Promise<void> {
    const fullUpdate: ConversationUpdate = {
      type: 'message',
      conversationId,
      deviceId: this.deviceId,
      timestamp: new Date(),
      syncVersion: 0,
      ...update
    };

    // Get current state and increment version
    const { data: syncState } = await supabase
      .from('conversation_sync_state')
      .select('*')
      .eq('conversation_id', conversationId)
      .single();

    if (syncState) {
      const currentState = syncState.sync_state as ConversationSyncState;
      fullUpdate.syncVersion = currentState.syncVersion + 1;

      // Check for conflicts
      const hasConflict = await this.conflictResolver.detectConflict(
        currentState,
        fullUpdate
      );

      if (hasConflict) {
        const resolvedUpdate = await this.conflictResolver.resolveConflict(
          currentState,
          fullUpdate
        );
        await this.applySyncUpdate(resolvedUpdate);
      } else {
        await this.applySyncUpdate(fullUpdate);
      }
    }
  }

  async requestHandoff(
    conversationId: string,
    targetDeviceId: string
  ): Promise<boolean> {
    const handoffUpdate: ConversationUpdate = {
      type: 'handoff',
      conversationId,
      deviceId: this.deviceId,
      timestamp: new Date(),
      data: {
        targetDevice: targetDeviceId,
        sourceDevice: this.deviceId
      },
      syncVersion: 0
    };

    await this.syncConversationUpdate(conversationId, handoffUpdate);
    return true;
  }

  private async applySyncUpdate(update: ConversationUpdate): Promise<void> {
    // Update conversation sync state
    const { data: syncState } = await supabase
      .from('conversation_sync_state')
      .select('*')
      .eq('conversation_id', update.conversationId)
      .single();

    if (syncState) {
      const currentState = syncState.sync_state as ConversationSyncState;
      
      // Apply update based on type
      switch (update.type) {
        case 'message':
          currentState.lastMessage = update.data;
          currentState.currentTurn += 1;
          break;
        case 'handoff':
          currentState.primaryDevice = update.data.targetDevice;
          break;
        case 'device_join':
          if (!currentState.activeDevices.find(d => d.deviceId === update.deviceId)) {
            currentState.activeDevices.push(update.data);
          }
          break;
        case 'device_leave':
          currentState.activeDevices = currentState.activeDevices.filter(
            d => d.deviceId !== update.deviceId
          );
          break;
      }

      currentState.syncVersion = update.syncVersion;
      currentState.lastSyncTime = update.timestamp;

      await this.updateSyncState(currentState);
    }

    // Broadcast to other devices
    await supabase
      .from('conversation_updates')
      .insert({
        conversation_id: update.conversationId,
        update_data: update,
        created_at: new Date().toISOString()
      });
  }

  private async updateSyncState(state: ConversationSyncState): Promise<void> {
    await supabase
      .from('conversation_sync_state')
      .update({
        sync_state: state,
        sync_version: state.syncVersion,
        updated_at: new Date().toISOString()
      })
      .eq('conversation_id', state.conversationId);
  }

  private handleRealtimeUpdate(payload: any): void {
    const update = payload.new?.update_data as ConversationUpdate;
    if (update && update.deviceId !== this.deviceId) {
      // Notify registered callbacks
      const callback = this.syncCallbacks.get(update.conversationId);
      if (callback) {
        callback(update);
      }
    }
  }

  onSyncUpdate(conversationId: string, callback: (update: ConversationUpdate) => void): void {
    this.syncCallbacks.set(conversationId, callback);
  }

  private detectDeviceType(): 'desktop' | 'mobile' | 'tablet' {
    const userAgent = navigator.userAgent.toLowerCase();
    if (/mobile|android|iphone/.test(userAgent)) return 'mobile';
    if (/tablet|ipad/.test(userAgent)) return 'tablet';
    return 'desktop';
  }

  async getOptimalAudioSettings(deviceId?: string): Promise<any> {
    const targetDevice = deviceId || this.deviceId;
    return this.deviceOptimizer.getOptimalSettings(targetDevice);
  }

  async cleanup(): void {
    if (this.syncChannel) {
      await supabase.removeChannel(this.syncChannel);
    }
    this.syncCallbacks.clear();
  }
}

class ConflictResolver {
  async detectConflict(
    currentState: ConversationSyncState,
    incomingUpdate: ConversationUpdate
  ): Promise<boolean> {
    // Check if update is out of order
    if (incomingUpdate.syncVersion <= currentState.syncVersion) {
      return true;
    }

    // Check for concurrent message updates
    if (incomingUpdate.type === 'message') {
      const timeDiff = Math.abs(
        incomingUpdate.timestamp.getTime() - currentState.lastSyncTime.getTime()
      );
      return timeDiff < 1000; // Conflict if within 1 second
    }

    return false;
  }

  async resolveConflict(
    currentState: ConversationSyncState,
    conflictingUpdate: ConversationUpdate
  ): Promise<ConversationUpdate> {
    // Use timestamp-based resolution (last writer wins)
    const resolvedUpdate = { ...conflictingUpdate };
    resolvedUpdate.syncVersion = currentState.syncVersion + 1;
    resolvedUpdate.timestamp = new Date();
    
    return resolvedUpdate;
  }
}

class DeviceOptimizer {
  async detectCapabilities(): Promise<DeviceInfo['capabilities']> {
    const capabilities = {
      audioFormats: this.getSupportedAudioFormats(),
      maxBitrate: this.getMaxBitrate(),
      supportsWebRTC: this.checkWebRTCSupport(),
      supportsWebAudio: this.checkWebAudioSupport()
    };

    return capabilities;
  }

  private getSupportedAudioFormats(): string[] {
    const audio = document.createElement('audio');
    const formats = [];

    if (audio.canPlayType('audio/mpeg')) formats.push('mp3');
    if (audio.canPlayType('audio/wav')) formats.push('wav');
    if (audio.canPlayType('audio/ogg')) formats.push('ogg');
    if (audio.canPlayType('audio/mp4')) formats.push('m4a');

    return formats;
  }

  private getMaxBitrate(): number {
    // Estimate based on device type and connection
    const connection = (navigator as any).connection;
    if (connection) {
      switch (connection.effectiveType) {
        case '4g': return 128;
        case '3g': return 64;
        case '2g': return 32;
        default: return 128;
      }
    }
    return 128; // Default to high quality
  }

  private checkWebRTCSupport(): boolean {
    return !!(window as any).RTCPeerConnection;
  }

  private checkWebAudioSupport(): boolean {
    return !!(window as any).AudioContext || !!(window as any).webkitAudioContext;
  }

  async getOptimalSettings(deviceId: string): Promise<any> {
    // Get device capabilities from database
    const { data: device } = await supabase
      .from('user_devices')
      .select('device_info')
      .eq('device_id', deviceId)
      .single();

    if (!device) {
      return this.getDefaultSettings();
    }

    const capabilities = device.device_info.capabilities;
    
    return {
      audioFormat: this.selectBestFormat(capabilities.audioFormats),
      bitrate: Math.min(capabilities.maxBitrate, 128),
      sampleRate: capabilities.maxBitrate >= 64 ? 44100 : 22050,
      bufferSize: capabilities.supportsWebAudio ? 4096 : 8192
    };
  }

  private selectBestFormat(supportedFormats: string[]): string {
    const preferenceOrder = ['mp3', 'wav', 'm4a', 'ogg'];
    for (const format of preferenceOrder) {
      if (supportedFormats.includes(format)) {
        return format;
      }
    }
    return 'mp3'; // Fallback
  }

  private getDefaultSettings(): any {
    return {
      audioFormat: 'mp3',
      bitrate: 64,
      sampleRate: 22050,
      bufferSize: 8192
    };
  }
}

export const crossDeviceSyncService = new CrossDeviceSyncService();