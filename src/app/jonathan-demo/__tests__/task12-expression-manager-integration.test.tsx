/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import JonathanDemoPage from '../page'

// Mock all the dependencies
jest.mock('@/data/jonathan_profile.json', () => ({
  full_name: 'Jonathan Test',
  voice_id: 'test-voice-id'
}))

jest.mock('@/components/ProfileContext', () => {
  return function MockProfileProvider({ children }: { children: React.ReactNode }) {
    return <div data-testid="profile-provider">{children}</div>
  }
})

jest.mock('@/components/PageShell', () => {
  return function MockPageShell({ children }: { children: React.ReactNode }) {
    return <div data-testid="page-shell">{children}</div>
  }
})

jest.mock('@/components/ToastNotifications', () => {
  return function MockToastNotifications() {
    return <div data-testid="toast-notifications" />
  }
})

jest.mock('@/components/SimpleExpressionManager', () => {
  return function MockSimpleExpressionManager({ 
    userId, 
    avatarId, 
    onExpressionUpdate 
  }: { 
    userId: string
    avatarId: string
    onExpressionUpdate: () => void 
  }) {
    return (
      <div data-testid="simple-expression-manager">
        <div data-testid="user-id">{userId}</div>
        <div data-testid="avatar-id">{avatarId}</div>
        <button 
          data-testid="trigger-update" 
          onClick={onExpressionUpdate}
        >
          Trigger Update
        </button>
      </div>
    )
  }
})

// Mock all the audio and streaming services
jest.mock('@/lib/globalAudioManager', () => ({
  globalAudioManager: {
    stopAll: jest.fn()
  }
}))

jest.mock('@/lib/streamingUtils', () => ({
  stopAllAudio: jest.fn(),
  createStreamingAudioManager: jest.fn(() => ({
    addSentence: jest.fn(),
    isPlaying: jest.fn(() => false),
    stop: jest.fn()
  })),
  splitIntoSentences: jest.fn((text) => [text])
}))

jest.mock('@/lib/enhancedVoiceConfig', () => ({
  getEnhancedVoiceConfig: jest.fn(() => ({
    voice_settings: {
      stability: 0.70,
      similarity_boost: 0.85
    }
  }))
}))

jest.mock('@/lib/services/expressionPackService', () => ({
  ExpressionPackService: {
    loadExpressionPack: jest.fn(() => Promise.resolve({
      expressions: [],
      preloaded_buffers: new Map(),
      is_loaded: true
    }))
  }
}))

jest.mock('@/lib/jonathanDemoMemoryService', () => ({
  JonathanDemoMemoryService: {
    retrieveRelevantMemories: jest.fn(() => Promise.resolve('')),
    storeConversationTurnAsync: jest.fn()
  }
}))

jest.mock('@/lib/services/jonathanDemoConversationState', () => ({
  jonathanConversationState: {
    createConversation: jest.fn(() => Promise.resolve({
      id: 'test-conversation-id',
      userId: 'test-user',
      avatarId: 'jonathan-demo'
    })),
    addConversationTurn: jest.fn()
  }
}))

jest.mock('@/lib/mobileAudioContextManager', () => ({
  mobileAudioContextManager: {
    initialize: jest.fn(),
    ensureAudioContext: jest.fn()
  },
  isMobileSafari: false
}))

jest.mock('@/lib/services/enhancedErrorHandler', () => ({
  enhancedErrorHandler: {
    handleVoiceSynthesis: jest.fn((fn) => fn())
  }
}))

// Mock fetch
global.fetch = jest.fn()

// Mock AudioContext
const mockAudioContext = {
  createBufferSource: jest.fn(() => ({
    buffer: null,
    connect: jest.fn(),
    start: jest.fn(),
    onended: null
  })),
  decodeAudioData: jest.fn(() => Promise.resolve({
    length: 44100,
    sampleRate: 44100
  })),
  destination: {},
  close: jest.fn(),
  resume: jest.fn(() => Promise.resolve()),
  state: 'running'
}

Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: jest.fn(() => mockAudioContext)
})

// Mock SpeechRecognition
Object.defineProperty(window, 'SpeechRecognition', {
  writable: true,
  value: jest.fn(() => ({
    continuous: false,
    interimResults: false,
    start: jest.fn(),
    stop: jest.fn(),
    onresult: null,
    onerror: null,
    onend: null
  }))
})

describe('Jonathan Demo - Expression Manager Integration (Task 12)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock voice resolution
    ;(global.fetch as jest.Mock).mockImplementation((url) => {
      if (url.includes('/api/voice/resolve')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ voiceId: 'test-voice-id' })
        })
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      })
    })
  })

  describe('Expression Manager Toggle', () => {
    it('renders expression manager toggle button', async () => {
      render(<JonathanDemoPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Manage Voice Expressions')).toBeInTheDocument()
      })
      
      expect(screen.getByText('Upload and customize Jonathan\'s vocal expressions')).toBeInTheDocument()
    })

    it('shows collapsed state initially', async () => {
      render(<JonathanDemoPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Manage Voice Expressions')).toBeInTheDocument()
      })
      
      // Should show right arrow (collapsed)
      expect(screen.getByText('▶')).toBeInTheDocument()
      
      // Expression manager should not be visible
      expect(screen.queryByTestId('simple-expression-manager')).not.toBeInTheDocument()
    })

    it('expands expression manager when toggle is clicked', async () => {
      const user = userEvent.setup()
      render(<JonathanDemoPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Manage Voice Expressions')).toBeInTheDocument()
      })
      
      const toggleButton = screen.getByRole('button', { name: /manage voice expressions/i })
      await user.click(toggleButton)
      
      // Should show down arrow (expanded)
      expect(screen.getByText('▼')).toBeInTheDocument()
      
      // Expression manager should be visible
      expect(screen.getByTestId('simple-expression-manager')).toBeInTheDocument()
    })

    it('collapses expression manager when toggle is clicked again', async () => {
      const user = userEvent.setup()
      render(<JonathanDemoPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Manage Voice Expressions')).toBeInTheDocument()
      })
      
      const toggleButton = screen.getByRole('button', { name: /manage voice expressions/i })
      
      // Expand
      await user.click(toggleButton)
      expect(screen.getByTestId('simple-expression-manager')).toBeInTheDocument()
      
      // Collapse
      await user.click(toggleButton)
      expect(screen.queryByTestId('simple-expression-manager')).not.toBeInTheDocument()
      expect(screen.getByText('▶')).toBeInTheDocument()
    })
  })

  describe('Expression Manager Props', () => {
    it('passes correct props to SimpleExpressionManager', async () => {
      const user = userEvent.setup()
      render(<JonathanDemoPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Manage Voice Expressions')).toBeInTheDocument()
      })
      
      const toggleButton = screen.getByRole('button', { name: /manage voice expressions/i })
      await user.click(toggleButton)
      
      // Check that correct props are passed
      expect(screen.getByTestId('avatar-id')).toHaveTextContent('jonathan-demo')
      expect(screen.getByTestId('user-id')).toMatch(/jonathan-demo-user-\d+/)
    })

    it('handles expression updates and reloads expression pack', async () => {
      const user = userEvent.setup()
      const mockLoadExpressionPack = require('@/lib/services/expressionPackService').ExpressionPackService.loadExpressionPack
      
      render(<JonathanDemoPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Manage Voice Expressions')).toBeInTheDocument()
      })
      
      const toggleButton = screen.getByRole('button', { name: /manage voice expressions/i })
      await user.click(toggleButton)
      
      // Trigger expression update
      const updateButton = screen.getByTestId('trigger-update')
      await user.click(updateButton)
      
      // Should reload expression pack
      await waitFor(() => {
        expect(mockLoadExpressionPack).toHaveBeenCalledWith('jonathan-demo', 'avatar')
      })
    })
  })

  describe('Integration with Main Chat Interface', () => {
    it('renders expression manager alongside main chat interface', async () => {
      render(<JonathanDemoPage />)
      
      await waitFor(() => {
        // Main chat interface elements
        expect(screen.getByText('Chat with Jonathan')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('Ask me anything…')).toBeInTheDocument()
        expect(screen.getByText('🎤 Speak')).toBeInTheDocument()
        
        // Expression manager toggle
        expect(screen.getByText('Manage Voice Expressions')).toBeInTheDocument()
      })
    })

    it('maintains chat functionality when expression manager is open', async () => {
      const user = userEvent.setup()
      
      // Mock chat response
      ;(global.fetch as jest.Mock).mockImplementation((url) => {
        if (url.includes('/api/voice/resolve')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ voiceId: 'test-voice-id' })
          })
        }
        if (url.includes('/api/demo-chat')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ answer: 'Test response' })
          })
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({})
        })
      })
      
      render(<JonathanDemoPage />)
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Ask me anything…')).toBeInTheDocument()
      })
      
      // Open expression manager
      const toggleButton = screen.getByRole('button', { name: /manage voice expressions/i })
      await user.click(toggleButton)
      
      // Chat should still work
      const input = screen.getByPlaceholderText('Ask me anything…')
      await user.type(input, 'Hello Jonathan')
      
      const submitButton = screen.getByRole('button', { name: '→' })
      await user.click(submitButton)
      
      // Should make chat request
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/demo-chat'),
          expect.any(Object)
        )
      })
    })
  })

  describe('Responsive Design', () => {
    it('renders properly on mobile viewport', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      })
      
      render(<JonathanDemoPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Manage Voice Expressions')).toBeInTheDocument()
      })
      
      // Expression manager should still be accessible
      const toggleButton = screen.getByRole('button', { name: /manage voice expressions/i })
      expect(toggleButton).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('handles expression pack loading errors gracefully', async () => {
      const user = userEvent.setup()
      const mockLoadExpressionPack = require('@/lib/services/expressionPackService').ExpressionPackService.loadExpressionPack
      
      // Mock expression pack loading failure
      mockLoadExpressionPack.mockRejectedValueOnce(new Error('Failed to load'))
      
      // Mock console.warn to avoid test output noise
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      
      render(<JonathanDemoPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Manage Voice Expressions')).toBeInTheDocument()
      })
      
      const toggleButton = screen.getByRole('button', { name: /manage voice expressions/i })
      await user.click(toggleButton)
      
      // Trigger expression update
      const updateButton = screen.getByTestId('trigger-update')
      await user.click(updateButton)
      
      // Should handle error gracefully
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to reload expression pack:', expect.any(Error))
      })
      
      consoleSpy.mockRestore()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA attributes for expression manager toggle', async () => {
      render(<JonathanDemoPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Manage Voice Expressions')).toBeInTheDocument()
      })
      
      const toggleButton = screen.getByRole('button', { name: /manage voice expressions/i })
      expect(toggleButton).toBeInTheDocument()
      expect(toggleButton).toHaveAttribute('type', 'button')
    })

    it('supports keyboard navigation to expression manager', async () => {
      const user = userEvent.setup()
      render(<JonathanDemoPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Manage Voice Expressions')).toBeInTheDocument()
      })
      
      // Tab through interface to reach expression manager toggle
      const toggleButton = screen.getByRole('button', { name: /manage voice expressions/i })
      
      // Focus and activate with keyboard
      toggleButton.focus()
      expect(toggleButton).toHaveFocus()
      
      await user.keyboard('{Enter}')
      expect(screen.getByTestId('simple-expression-manager')).toBeInTheDocument()
    })
  })

  describe('Performance', () => {
    it('does not render SimpleExpressionManager until expanded', async () => {
      render(<JonathanDemoPage />)
      
      await waitFor(() => {
        expect(screen.getByText('Manage Voice Expressions')).toBeInTheDocument()
      })
      
      // Should not render the component initially
      expect(screen.queryByTestId('simple-expression-manager')).not.toBeInTheDocument()
      
      // Only renders after expansion
      const user = userEvent.setup()
      const toggleButton = screen.getByRole('button', { name: /manage voice expressions/i })
      await user.click(toggleButton)
      
      expect(screen.getByTestId('simple-expression-manager')).toBeInTheDocument()
    })
  })
})