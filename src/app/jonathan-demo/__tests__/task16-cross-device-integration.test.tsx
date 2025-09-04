/**
 * Task 16 Integration Tests: Cross-Device Sync in Jonathan Demo
 * Tests cross-device synchronization integration with Jonathan demo page
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { act } from 'react-dom/test-utils'
import CrossDeviceSync from '../../../components/CrossDeviceSync'

// Mock the services
vi.mock('../../../lib/services/crossDeviceSyncService', () => ({
  crossDeviceSyncService: {
    registerDevice: vi.fn(),
    joinConversation: vi.fn(),
    leaveConversation: vi.fn(),
    syncConversationUpdate: vi.fn(),
    onSyncUpdate: vi.fn(),
    getOptimalAudioSettings: vi.fn(),
    cleanup: vi.fn(),
    deviceId: 'test-device-id'
  },
  ConversationSyncState: {},
  DeviceInfo: {}
}))

vi.mock('../../../lib/services/deviceHandoffManager', () => ({
  deviceHandoffManager: {
    initiateHandoff: vi.fn(),
    acceptHandoff: vi.fn(),
    rejectHandoff: vi.fn(),
    onHandoffRequest: vi.fn(),
    getActiveDevices: vi.fn(),
    getPendingHandoffs: vi.fn(),
    cleanup: vi.fn()
  },
  HandoffRequest: {}
}))

// Mock Supabase
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      }))
    }))
  }
}))

// Import after mocking
import { crossDeviceSyncService } from '../../../lib/services/crossDeviceSyncService'
import { deviceHandoffManager } from '../../../lib/services/deviceHandoffManager'

describe('Task 16: Cross-Device Sync Integration', () => {
  const defaultProps = {
    conversationId: 'test-conversation',
    userId: 'test-user',
    onHandoffReceived: vi.fn(),
    onSyncUpdate: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default mock returns
    vi.mocked(crossDeviceSyncService.registerDevice).mockResolvedValue({
      deviceId: 'test-device',
      deviceType: 'desktop',
      userAgent: 'Chrome',
      capabilities: {
        audioFormats: ['mp3'],
        maxBitrate: 128,
        supportsWebRTC: true,
        supportsWebAudio: true
      },
      lastSeen: new Date(),
      isActive: true
    })

    vi.mocked(crossDeviceSyncService.joinConversation).mockResolvedValue({
      conversationId: 'test-conversation',
      userId: 'test-user',
      avatarId: 'test-avatar',
      currentTurn: 0,
      lastMessage: {
        id: '',
        content: '',
        timestamp: new Date(),
        sender: 'user'
      },
      activeDevices: [],
      primaryDevice: 'test-device',
      syncVersion: 1,
      lastSyncTime: new Date()
    })

    vi.mocked(deviceHandoffManager.getPendingHandoffs).mockResolvedValue([])
    vi.mocked(deviceHandoffManager.getActiveDevices).mockResolvedValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Component Initialization', () => {
    it('should initialize cross-device sync on mount', async () => {
      render(<CrossDeviceSync {...defaultProps} />)
      
      await waitFor(() => {
        expect(mockCrossDeviceSyncService.registerDevice).toHaveBeenCalledWith('test-user')
        expect(mockCrossDeviceSyncService.joinConversation).toHaveBeenCalledWith(
          'test-conversation',
          'test-user'
        )
      })
    })

    it('should show connecting status initially', () => {
      render(<CrossDeviceSync {...defaultProps} />)
      
      expect(screen.getByText('Connecting to sync service...')).toBeInTheDocument()
    })

    it('should show connected status after initialization', async () => {
      render(<CrossDeviceSync {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByText(/device.*connected/)).toBeInTheDocument()
      })
    })

    it('should set up sync and handoff listeners', async () => {
      render(<CrossDeviceSync {...defaultProps} />)
      
      await waitFor(() => {
        expect(mockCrossDeviceSyncService.onSyncUpdate).toHaveBeenCalled()
        expect(mockDeviceHandoffManager.onHandoffRequest).toHaveBeenCalled()
      })
    })
  })

  describe('Device List Management', () => {
    it('should display active devices when expanded', async () => {
      const activeDevices = [
        {
          deviceId: 'device-1',
          deviceType: 'desktop',
          userAgent: 'Mozilla/5.0 Chrome/91.0',
          capabilities: { audioFormats: ['mp3'], maxBitrate: 128, supportsWebRTC: true, supportsWebAudio: true },
          lastSeen: new Date(),
          isActive: true
        },
        {
          deviceId: 'device-2',
          deviceType: 'mobile',
          userAgent: 'Mozilla/5.0 Safari/14.0',
          capabilities: { audioFormats: ['mp3'], maxBitrate: 64, supportsWebRTC: false, supportsWebAudio: true },
          lastSeen: new Date(),
          isActive: true
        }
      ]

      mockCrossDeviceSyncService.joinConversation.mockResolvedValue({
        conversationId: 'test-conversation',
        userId: 'test-user',
        avatarId: 'test-avatar',
        currentTurn: 0,
        lastMessage: { id: '', content: '', timestamp: new Date(), sender: 'user' },
        activeDevices,
        primaryDevice: 'device-1',
        syncVersion: 1,
        lastSyncTime: new Date()
      })

      render(<CrossDeviceSync {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('2 devices connected')).toBeInTheDocument()
      })

      // Expand device list
      fireEvent.click(screen.getByText(/Devices/))
      
      await waitFor(() => {
        expect(screen.getByText('Connected Devices')).toBeInTheDocument()
        expect(screen.getByText('Desktop (Chrome)')).toBeInTheDocument()
        expect(screen.getByText('Mobile (Safari)')).toBeInTheDocument()
        expect(screen.getByText('Primary')).toBeInTheDocument()
      })
    })

    it('should show handoff buttons for other devices', async () => {
      const activeDevices = [
        {
          deviceId: 'other-device',
          deviceType: 'mobile',
          userAgent: 'Safari',
          capabilities: { audioFormats: ['mp3'], maxBitrate: 64, supportsWebRTC: false, supportsWebAudio: true },
          lastSeen: new Date(),
          isActive: true
        }
      ]

      mockCrossDeviceSyncService.joinConversation.mockResolvedValue({
        conversationId: 'test-conversation',
        userId: 'test-user',
        avatarId: 'test-avatar',
        currentTurn: 0,
        lastMessage: { id: '', content: '', timestamp: new Date(), sender: 'user' },
        activeDevices,
        primaryDevice: 'test-device',
        syncVersion: 1,
        lastSyncTime: new Date()
      })

      render(<CrossDeviceSync {...defaultProps} />)
      
      // Expand device list
      await waitFor(() => {
        fireEvent.click(screen.getByText(/Devices/))
      })
      
      await waitFor(() => {
        expect(screen.getByText('Switch to this device')).toBeInTheDocument()
      })
    })
  })

  describe('Device Handoff', () => {
    it('should initiate handoff when button clicked', async () => {
      const activeDevices = [
        {
          deviceId: 'target-device',
          deviceType: 'mobile',
          userAgent: 'Safari',
          capabilities: { audioFormats: ['mp3'], maxBitrate: 64, supportsWebRTC: false, supportsWebAudio: true },
          lastSeen: new Date(),
          isActive: true
        }
      ]

      mockCrossDeviceSyncService.joinConversation.mockResolvedValue({
        conversationId: 'test-conversation',
        userId: 'test-user',
        avatarId: 'test-avatar',
        currentTurn: 0,
        lastMessage: { id: '', content: '', timestamp: new Date(), sender: 'user' },
        activeDevices,
        primaryDevice: 'test-device',
        syncVersion: 1,
        lastSyncTime: new Date()
      })

      mockDeviceHandoffManager.initiateHandoff.mockResolvedValue('handoff-123')

      // Mock window.alert
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

      render(<CrossDeviceSync {...defaultProps} />)
      
      // Expand device list and click handoff
      await waitFor(() => {
        fireEvent.click(screen.getByText(/Devices/))
      })
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Switch to this device'))
      })
      
      await waitFor(() => {
        expect(mockDeviceHandoffManager.initiateHandoff).toHaveBeenCalledWith(
          'test-conversation',
          'target-device',
          {}
        )
        expect(alertSpy).toHaveBeenCalledWith(
          expect.stringContaining('Handoff request sent')
        )
      })

      alertSpy.mockRestore()
    })

    it('should display pending handoff notifications', async () => {
      const pendingHandoffs = [
        {
          id: 'handoff-123',
          conversationId: 'test-conversation',
          sourceDeviceId: 'source-device',
          targetDeviceId: 'test-device',
          handoffData: {},
          status: 'pending',
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 30000)
        }
      ]

      mockDeviceHandoffManager.getPendingHandoffs.mockResolvedValue(pendingHandoffs)

      render(<CrossDeviceSync {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('Device wants to continue this conversation')).toBeInTheDocument()
        expect(screen.getByText('Accept')).toBeInTheDocument()
        expect(screen.getByText('Decline')).toBeInTheDocument()
      })
    })

    it('should accept handoff when accept button clicked', async () => {
      const pendingHandoffs = [
        {
          id: 'handoff-123',
          conversationId: 'test-conversation',
          sourceDeviceId: 'source-device',
          targetDeviceId: 'test-device',
          handoffData: {},
          status: 'pending',
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 30000)
        }
      ]

      mockDeviceHandoffManager.getPendingHandoffs.mockResolvedValue(pendingHandoffs)
      mockDeviceHandoffManager.acceptHandoff.mockResolvedValue(true)

      // Mock window.alert
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

      render(<CrossDeviceSync {...defaultProps} />)
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Accept'))
      })
      
      await waitFor(() => {
        expect(mockDeviceHandoffManager.acceptHandoff).toHaveBeenCalledWith('handoff-123')
        expect(alertSpy).toHaveBeenCalledWith('Handoff accepted successfully')
      })

      alertSpy.mockRestore()
    })

    it('should reject handoff when decline button clicked', async () => {
      const pendingHandoffs = [
        {
          id: 'handoff-123',
          conversationId: 'test-conversation',
          sourceDeviceId: 'source-device',
          targetDeviceId: 'test-device',
          handoffData: {},
          status: 'pending',
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 30000)
        }
      ]

      mockDeviceHandoffManager.getPendingHandoffs.mockResolvedValue(pendingHandoffs)

      render(<CrossDeviceSync {...defaultProps} />)
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Decline'))
      })
      
      await waitFor(() => {
        expect(mockDeviceHandoffManager.rejectHandoff).toHaveBeenCalledWith(
          'handoff-123',
          'User declined'
        )
      })
    })
  })

  describe('Sync Update Handling', () => {
    it('should call onSyncUpdate when sync update received', async () => {
      const onSyncUpdate = vi.fn()
      
      render(<CrossDeviceSync {...defaultProps} onSyncUpdate={onSyncUpdate} />)
      
      await waitFor(() => {
        expect(mockCrossDeviceSyncService.onSyncUpdate).toHaveBeenCalled()
      })

      // Simulate sync update
      const syncUpdateCallback = mockCrossDeviceSyncService.onSyncUpdate.mock.calls[0][1]
      const update = {
        type: 'message',
        conversationId: 'test-conversation',
        deviceId: 'other-device',
        data: { content: 'New message' }
      }

      act(() => {
        syncUpdateCallback(update)
      })

      expect(onSyncUpdate).toHaveBeenCalledWith(update)
    })

    it('should update device list on device join/leave', async () => {
      const newDevices = [
        {
          deviceId: 'new-device',
          deviceType: 'tablet',
          userAgent: 'iPad Safari',
          capabilities: { audioFormats: ['mp3'], maxBitrate: 64, supportsWebRTC: false, supportsWebAudio: true },
          lastSeen: new Date(),
          isActive: true
        }
      ]

      mockDeviceHandoffManager.getActiveDevices.mockResolvedValue(newDevices)

      render(<CrossDeviceSync {...defaultProps} />)
      
      await waitFor(() => {
        expect(mockCrossDeviceSyncService.onSyncUpdate).toHaveBeenCalled()
      })

      // Simulate device join update
      const syncUpdateCallback = mockCrossDeviceSyncService.onSyncUpdate.mock.calls[0][1]
      const update = {
        type: 'device_join',
        conversationId: 'test-conversation',
        deviceId: 'new-device',
        data: newDevices[0]
      }

      act(() => {
        syncUpdateCallback(update)
      })

      await waitFor(() => {
        expect(mockDeviceHandoffManager.getActiveDevices).toHaveBeenCalledWith('test-conversation')
      })
    })
  })

  describe('Handoff Event Handling', () => {
    it('should call onHandoffReceived when handoff event dispatched', async () => {
      const onHandoffReceived = vi.fn()
      
      render(<CrossDeviceSync {...defaultProps} onHandoffReceived={onHandoffReceived} />)
      
      // Simulate handoff received event
      const handoffData = {
        conversationState: { currentTurn: 5 },
        memoryContext: 'test context'
      }

      act(() => {
        const event = new CustomEvent('deviceHandoffReceived', { detail: handoffData })
        window.dispatchEvent(event)
      })

      expect(onHandoffReceived).toHaveBeenCalledWith(handoffData)
    })

    it('should handle incoming handoff requests', async () => {
      render(<CrossDeviceSync {...defaultProps} />)
      
      await waitFor(() => {
        expect(mockDeviceHandoffManager.onHandoffRequest).toHaveBeenCalled()
      })

      // Simulate incoming handoff request
      const handoffCallback = mockDeviceHandoffManager.onHandoffRequest.mock.calls[0][0]
      const handoffRequest = {
        id: 'new-handoff',
        conversationId: 'test-conversation',
        sourceDeviceId: 'source-device',
        targetDeviceId: 'test-device',
        handoffData: {},
        status: 'pending',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30000)
      }

      act(() => {
        handoffCallback(handoffRequest)
      })

      await waitFor(() => {
        expect(screen.getByText('Device wants to continue this conversation')).toBeInTheDocument()
      })
    })
  })

  describe('Cleanup and Error Handling', () => {
    it('should cleanup services on unmount', () => {
      const { unmount } = render(<CrossDeviceSync {...defaultProps} />)
      
      unmount()
      
      expect(mockCrossDeviceSyncService.cleanup).toHaveBeenCalled()
      expect(mockDeviceHandoffManager.cleanup).toHaveBeenCalled()
    })

    it('should handle initialization errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      mockCrossDeviceSyncService.registerDevice.mockRejectedValue(new Error('Network error'))

      render(<CrossDeviceSync {...defaultProps} />)
      
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to initialize cross-device sync:',
          expect.any(Error)
        )
      })

      consoleErrorSpy.mockRestore()
    })

    it('should handle handoff errors with user feedback', async () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
      
      mockDeviceHandoffManager.initiateHandoff.mockRejectedValue(new Error('Handoff failed'))

      const activeDevices = [
        {
          deviceId: 'target-device',
          deviceType: 'mobile',
          userAgent: 'Safari',
          capabilities: { audioFormats: ['mp3'], maxBitrate: 64, supportsWebRTC: false, supportsWebAudio: true },
          lastSeen: new Date(),
          isActive: true
        }
      ]

      mockCrossDeviceSyncService.joinConversation.mockResolvedValue({
        conversationId: 'test-conversation',
        userId: 'test-user',
        avatarId: 'test-avatar',
        currentTurn: 0,
        lastMessage: { id: '', content: '', timestamp: new Date(), sender: 'user' },
        activeDevices,
        primaryDevice: 'test-device',
        syncVersion: 1,
        lastSyncTime: new Date()
      })

      render(<CrossDeviceSync {...defaultProps} />)
      
      // Expand device list and click handoff
      await waitFor(() => {
        fireEvent.click(screen.getByText(/Devices/))
      })
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Switch to this device'))
      })
      
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          expect.stringContaining('Failed to initiate handoff')
        )
      })

      alertSpy.mockRestore()
    })
  })
})