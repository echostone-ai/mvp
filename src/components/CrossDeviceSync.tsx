/**
 * Cross-Device Synchronization Component
 * Provides UI for managing conversation sync across devices
 */

import React, { useState, useEffect, useCallback } from 'react';
import { crossDeviceSyncService, ConversationSyncState, DeviceInfo } from '../lib/services/crossDeviceSyncService';
import { deviceHandoffManager, HandoffRequest } from '../lib/services/deviceHandoffManager';

interface CrossDeviceSyncProps {
  conversationId: string;
  userId: string;
  onHandoffReceived?: (handoffData: any) => void;
  onSyncUpdate?: (update: any) => void;
}

export const CrossDeviceSync: React.FC<CrossDeviceSyncProps> = ({
  conversationId,
  userId,
  onHandoffReceived,
  onSyncUpdate
}) => {
  const [syncState, setSyncState] = useState<ConversationSyncState | null>(null);
  const [activeDevices, setActiveDevices] = useState<DeviceInfo[]>([]);
  const [pendingHandoffs, setPendingHandoffs] = useState<HandoffRequest[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [showDeviceList, setShowDeviceList] = useState(false);

  useEffect(() => {
    initializeSync();
    return () => {
      crossDeviceSyncService.cleanup();
      deviceHandoffManager.cleanup();
    };
  }, [conversationId, userId]);

  const initializeSync = async () => {
    try {
      // Register this device
      await crossDeviceSyncService.registerDevice(userId);
      
      // Join conversation
      const state = await crossDeviceSyncService.joinConversation(conversationId, userId);
      setSyncState(state);
      setActiveDevices(state.activeDevices);
      setIsConnected(true);

      // Set up sync update listener
      crossDeviceSyncService.onSyncUpdate(conversationId, handleSyncUpdate);

      // Set up handoff listeners
      deviceHandoffManager.onHandoffRequest(handleIncomingHandoff);

      // Check for pending handoffs
      const pending = await deviceHandoffManager.getPendingHandoffs();
      setPendingHandoffs(pending);

      // Listen for handoff events
      window.addEventListener('deviceHandoffReceived', handleHandoffReceived);
    } catch (error) {
      console.error('Failed to initialize cross-device sync:', error);
    }
  };

  const handleSyncUpdate = useCallback((update: any) => {
    if (update.type === 'device_join' || update.type === 'device_leave') {
      // Update active devices list
      deviceHandoffManager.getActiveDevices(conversationId).then(setActiveDevices);
    }
    
    if (onSyncUpdate) {
      onSyncUpdate(update);
    }
  }, [conversationId, onSyncUpdate]);

  const handleIncomingHandoff = useCallback((request: HandoffRequest) => {
    setPendingHandoffs(prev => [...prev, request]);
  }, []);

  const handleHandoffReceived = useCallback((event: CustomEvent) => {
    if (onHandoffReceived) {
      onHandoffReceived(event.detail);
    }
  }, [onHandoffReceived]);

  const initiateHandoff = async (targetDeviceId: string) => {
    try {
      const handoffId = await deviceHandoffManager.initiateHandoff(
        conversationId,
        targetDeviceId,
        {} // Current state would be passed from parent component
      );
      
      // Show confirmation
      alert(`Handoff request sent to device. Request ID: ${handoffId}`);
    } catch (error) {
      console.error('Failed to initiate handoff:', error);
      alert(`Failed to initiate handoff: ${error.message}`);
    }
  };

  const acceptHandoff = async (handoffId: string) => {
    try {
      await deviceHandoffManager.acceptHandoff(handoffId);
      setPendingHandoffs(prev => prev.filter(h => h.id !== handoffId));
      alert('Handoff accepted successfully');
    } catch (error) {
      console.error('Failed to accept handoff:', error);
      alert(`Failed to accept handoff: ${error.message}`);
    }
  };

  const rejectHandoff = async (handoffId: string) => {
    try {
      await deviceHandoffManager.rejectHandoff(handoffId, 'User declined');
      setPendingHandoffs(prev => prev.filter(h => h.id !== handoffId));
    } catch (error) {
      console.error('Failed to reject handoff:', error);
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile': return '📱';
      case 'tablet': return '📱';
      case 'desktop': return '💻';
      default: return '📱';
    }
  };

  const formatDeviceName = (device: DeviceInfo) => {
    const type = device.deviceType.charAt(0).toUpperCase() + device.deviceType.slice(1);
    const browser = device.userAgent.includes('Chrome') ? 'Chrome' : 
                   device.userAgent.includes('Firefox') ? 'Firefox' : 
                   device.userAgent.includes('Safari') ? 'Safari' : 'Browser';
    return `${type} (${browser})`;
  };

  if (!isConnected) {
    return (
      <div className="cross-device-sync connecting">
        <div className="sync-status">
          <span className="status-indicator connecting"></span>
          Connecting to sync service...
        </div>
      </div>
    );
  }

  return (
    <div className="cross-device-sync">
      {/* Sync Status Indicator */}
      <div className="sync-status">
        <span className="status-indicator connected"></span>
        <span className="device-count">
          {activeDevices.length} device{activeDevices.length !== 1 ? 's' : ''} connected
        </span>
        <button 
          className="toggle-devices"
          onClick={() => setShowDeviceList(!showDeviceList)}
        >
          {showDeviceList ? '▼' : '▶'} Devices
        </button>
      </div>

      {/* Pending Handoff Notifications */}
      {pendingHandoffs.map(handoff => (
        <div key={handoff.id} className="handoff-notification">
          <div className="handoff-message">
            Device wants to continue this conversation
          </div>
          <div className="handoff-actions">
            <button 
              className="accept-handoff"
              onClick={() => acceptHandoff(handoff.id)}
            >
              Accept
            </button>
            <button 
              className="reject-handoff"
              onClick={() => rejectHandoff(handoff.id)}
            >
              Decline
            </button>
          </div>
        </div>
      ))}

      {/* Device List */}
      {showDeviceList && (
        <div className="device-list">
          <h4>Connected Devices</h4>
          {activeDevices.map(device => (
            <div key={device.deviceId} className="device-item">
              <div className="device-info">
                <span className="device-icon">{getDeviceIcon(device.deviceType)}</span>
                <span className="device-name">{formatDeviceName(device)}</span>
                {syncState?.primaryDevice === device.deviceId && (
                  <span className="primary-badge">Primary</span>
                )}
              </div>
              {device.deviceId !== crossDeviceSyncService['deviceId'] && (
                <button 
                  className="handoff-button"
                  onClick={() => initiateHandoff(device.deviceId)}
                >
                  Switch to this device
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .cross-device-sync {
          position: fixed;
          top: 20px;
          right: 20px;
          background: rgba(0, 0, 0, 0.8);
          color: white;
          border-radius: 8px;
          padding: 12px;
          font-size: 14px;
          z-index: 1000;
          max-width: 300px;
        }

        .sync-status {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .status-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
        }

        .status-indicator.connected {
          background: #4ade80;
        }

        .status-indicator.connecting {
          background: #fbbf24;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .toggle-devices {
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          font-size: 12px;
        }

        .handoff-notification {
          margin-top: 12px;
          padding: 12px;
          background: rgba(59, 130, 246, 0.2);
          border-radius: 6px;
          border-left: 3px solid #3b82f6;
        }

        .handoff-message {
          margin-bottom: 8px;
          font-size: 13px;
        }

        .handoff-actions {
          display: flex;
          gap: 8px;
        }

        .accept-handoff, .reject-handoff {
          padding: 4px 12px;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
        }

        .accept-handoff {
          background: #10b981;
          color: white;
        }

        .reject-handoff {
          background: #6b7280;
          color: white;
        }

        .device-list {
          margin-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.2);
          padding-top: 12px;
        }

        .device-list h4 {
          margin: 0 0 8px 0;
          font-size: 13px;
          font-weight: 600;
        }

        .device-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .device-item:last-child {
          border-bottom: none;
        }

        .device-info {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .device-icon {
          font-size: 16px;
        }

        .device-name {
          font-size: 12px;
        }

        .primary-badge {
          background: #3b82f6;
          color: white;
          padding: 2px 6px;
          border-radius: 10px;
          font-size: 10px;
          font-weight: 600;
        }

        .handoff-button {
          background: #3b82f6;
          color: white;
          border: none;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
        }

        .handoff-button:hover {
          background: #2563eb;
        }
      `}</style>
    </div>
  );
};

export default CrossDeviceSync;