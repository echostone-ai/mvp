/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SimpleExpressionManager from '../SimpleExpressionManager'
import { expect } from 'vitest'
import { it } from 'vitest'
import { describe } from 'vitest'
import { expect } from 'vitest'
import { it } from 'vitest'
import { expect } from 'vitest'
import { expect } from 'vitest'
import { expect } from 'vitest'
import { it } from 'vitest'
import { describe } from 'vitest'
import { expect } from 'vitest'
import { it } from 'vitest'
import { expect } from 'vitest'
import { expect } from 'vitest'
import { it } from 'vitest'
import { describe } from 'vitest'
import { expect } from 'vitest'
import { expect } from 'vitest'
import { expect } from 'vitest'
import { it } from 'vitest'
import { expect } from 'vitest'
import { expect } from 'vitest'
import { it } from 'vitest'
import { expect } from 'vitest'
import { expect } from 'vitest'
import { it } from 'vitest'
import { expect } from 'vitest'
import { it } from 'vitest'
import { expect } from 'vitest'
import { expect } from 'vitest'
import { expect } from 'vitest'
import { expect } from 'vitest'
import { it } from 'vitest'
import { beforeEach } from 'vitest'
import { describe } from 'vitest'
import { expect } from 'vitest'
import { it } from 'vitest'
import { expect } from 'vitest'
import { expect } from 'vitest'
import { it } from 'vitest'
import { expect } from 'vitest'
import { expect } from 'vitest'
import { expect } from 'vitest'
import { it } from 'vitest'
import { describe } from 'vitest'
import { expect } from 'vitest'
import { expect } from 'vitest'
import { expect } from 'vitest'
import { it } from 'vitest'
import { expect } from 'vitest'
import { it } from 'vitest'
import { expect } from 'vitest'
import { it } from 'vitest'
import { expect } from 'vitest'
import { expect } from 'vitest'
import { it } from 'vitest'
import { describe } from 'vitest'
import { expect } from 'vitest'
import { expect } from 'vitest'
import { it } from 'vitest'
import { expect } from 'vitest'
import { expect } from 'vitest'
import { expect } from 'vitest'
import { expect } from 'vitest'
import { expect } from 'vitest'
import { it } from 'vitest'
import { expect } from 'vitest'
import { expect } from 'vitest'
import { expect } from 'vitest'
import { expect } from 'vitest'
import { expect } from 'vitest'
import { it } from 'vitest'
import { describe } from 'vitest'
import { afterEach } from 'vitest'
import { beforeEach } from 'vitest'
import { describe } from 'vitest'

// Mock fetch globally
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

Object.defineProperty(window, 'webkitAudioContext', {
  writable: true,
  value: jest.fn(() => mockAudioContext)
})

// Mock URL.createObjectURL
Object.defineProperty(URL, 'createObjectURL', {
  writable: true,
  value: jest.fn(() => 'mock-url')
})

describe('SimpleExpressionManager', () => {
  const mockProps = {
    userId: 'test-user-123',
    avatarId: 'test-avatar-456',
    onExpressionUpdate: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
    // Reset fetch mock
    ;(global.fetch as jest.Mock).mockClear()
  })

  afterEach(() => {
    jest.clearAllTimers()
  })

  describe('Component Rendering', () => {
    it('renders the expression manager with all sections', () => {
      render(<SimpleExpressionManager {...mockProps} />)
      
      expect(screen.getByText('Expression Manager')).toBeInTheDocument()
      expect(screen.getByText('Upload and manage voice expressions to make conversations more natural')).toBeInTheDocument()
      expect(screen.getByText('Upload New Expression')).toBeInTheDocument()
      expect(screen.getByText('Drop audio file here')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /upload expression/i })).toBeInTheDocument()
    })

    it('renders expression type selector with all options', () => {
      render(<SimpleExpressionManager {...mockProps} />)
      
      const select = screen.getByRole('combobox')
      expect(select).toBeInTheDocument()
      
      // Check that all expression types are available
      const options = screen.getAllByRole('option')
      expect(options).toHaveLength(7) // 7 expression types
      expect(screen.getByRole('option', { name: /😄 Laugh/ })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /😔 Sigh/ })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /💨 Breath/ })).toBeInTheDocument()
    })

    it('renders form inputs for tone and keywords', () => {
      render(<SimpleExpressionManager {...mockProps} />)
      
      expect(screen.getByPlaceholderText('e.g., cheerful, sarcastic, tired')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('e.g., funny, joke, agreement')).toBeInTheDocument()
    })
  })

  describe('File Upload', () => {
    it('handles file selection via input', async () => {
      render(<SimpleExpressionManager {...mockProps} />)
      
      const file = new File(['audio content'], 'test.mp3', { type: 'audio/mpeg' })
      const input = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement
      
      fireEvent.change(input, { target: { files: [file] } })
      
      expect(screen.getByText('test.mp3')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /remove file/i })).toBeInTheDocument()
    })

    it('validates file size and shows error for large files', async () => {
      render(<SimpleExpressionManager {...mockProps} />)
      
      // Create a file larger than 5MB
      const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.mp3', { type: 'audio/mpeg' })
      const input = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement
      
      fireEvent.change(input, { target: { files: [largeFile] } })
      
      expect(screen.getByText(/File size.*exceeds maximum 5MB/)).toBeInTheDocument()
    })

    it('validates file type and shows error for unsupported formats', async () => {
      const user = userEvent.setup()
      render(<SimpleExpressionManager {...mockProps} />)
      
      const invalidFile = new File(['content'], 'test.txt', { type: 'text/plain' })
      const input = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement
      
      await user.upload(input, invalidFile)
      
      expect(screen.getByText(/Unsupported audio format/)).toBeInTheDocument()
    })

    it('clears selected file when clear button is clicked', async () => {
      const user = userEvent.setup()
      render(<SimpleExpressionManager {...mockProps} />)
      
      const file = new File(['audio content'], 'test.mp3', { type: 'audio/mpeg' })
      const input = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement
      
      await user.upload(input, file)
      expect(screen.getByText('test.mp3')).toBeInTheDocument()
      
      const clearButton = screen.getByRole('button', { name: /remove file/i })
      await user.click(clearButton)
      
      expect(screen.queryByText('test.mp3')).not.toBeInTheDocument()
      expect(screen.getByText('Drop audio file here')).toBeInTheDocument()
    })
  })

  describe('Expression Upload Process', () => {
    it('uploads expression with all metadata', async () => {
      const user = userEvent.setup()
      
      // Mock successful upload response
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            id: 'expr-123',
            filename: 'test.mp3',
            type: 'laugh',
            tone: 'cheerful',
            placementHints: ['funny', 'joke'],
            durationMs: 2000,
            cdnUrl: 'https://example.com/test.mp3',
            status: 'active',
            createdAt: new Date().toISOString()
          }
        })
      })

      // Mock expressions list response
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          expressions: [],
          total: 0
        })
      })

      render(<SimpleExpressionManager {...mockProps} />)
      
      // Select file
      const file = new File(['audio content'], 'test.mp3', { type: 'audio/mpeg' })
      const input = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement
      await user.upload(input, file)
      
      // Fill in metadata
      const toneInput = screen.getByPlaceholderText('e.g., cheerful, sarcastic, tired')
      await user.type(toneInput, 'cheerful')
      
      const keywordsInput = screen.getByPlaceholderText('e.g., funny, joke, agreement')
      await user.type(keywordsInput, 'funny, joke')
      
      // Submit upload
      const uploadButton = screen.getByRole('button', { name: /upload expression/i })
      await user.click(uploadButton)
      
      // Verify API call
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/expressions/upload', {
          method: 'POST',
          body: expect.any(FormData)
        })
      })
      
      // Check success message
      await waitFor(() => {
        expect(screen.getByText(/Successfully uploaded "test.mp3" as laugh/)).toBeInTheDocument()
      })
    })

    it('shows progress during upload', async () => {
      const user = userEvent.setup()
      
      // Mock slow upload response
      ;(global.fetch as jest.Mock).mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, data: {} })
          }), 100)
        )
      )

      render(<SimpleExpressionManager {...mockProps} />)
      
      const file = new File(['audio content'], 'test.mp3', { type: 'audio/mpeg' })
      const input = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement
      await user.upload(input, file)
      
      const uploadButton = screen.getByRole('button', { name: /upload expression/i })
      await user.click(uploadButton)
      
      // Check progress indicators
      expect(screen.getByText('Processing...')).toBeInTheDocument()
      expect(screen.getByText(/Preparing upload/)).toBeInTheDocument()
    })

    it('handles upload errors gracefully', async () => {
      const user = userEvent.setup()
      
      // Mock failed upload response
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({
          success: false,
          error: 'Server error'
        })
      })

      render(<SimpleExpressionManager {...mockProps} />)
      
      const file = new File(['audio content'], 'test.mp3', { type: 'audio/mpeg' })
      const input = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement
      await user.upload(input, file)
      
      const uploadButton = screen.getByRole('button', { name: /upload expression/i })
      await user.click(uploadButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Server error/)).toBeInTheDocument()
      })
    })
  })

  describe('Expression Management', () => {
    const mockExpressions = [
      {
        id: 'expr-1',
        owner_type: 'avatar',
        owner_key: 'test-avatar-456',
        filename: 'laugh1.mp3',
        type: 'laugh',
        tone: 'cheerful',
        placement_hints: ['funny', 'joke'],
        duration_ms: 2000,
        cdn_url: 'https://example.com/laugh1.mp3',
        priority: 0,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'expr-2',
        owner_type: 'avatar',
        owner_key: 'test-avatar-456',
        filename: 'sigh1.mp3',
        type: 'sigh',
        tone: 'tired',
        placement_hints: ['contemplative'],
        duration_ms: 1500,
        cdn_url: 'https://example.com/sigh1.mp3',
        priority: 0,
        status: 'inactive',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ]

    beforeEach(() => {
      // Mock expressions list response
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          expressions: mockExpressions,
          total: mockExpressions.length
        })
      })
    })

    it('loads and displays expressions', async () => {
      render(<SimpleExpressionManager {...mockProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('😄 Laugh')).toBeInTheDocument()
        expect(screen.getByText('😔 Sigh')).toBeInTheDocument()
        expect(screen.getByText('laugh1.mp3')).toBeInTheDocument()
        expect(screen.getByText('sigh1.mp3')).toBeInTheDocument()
      })
    })

    it('shows expression count in header', async () => {
      render(<SimpleExpressionManager {...mockProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('Your Expressions (2)')).toBeInTheDocument()
      })
    })

    it('handles preview playback', async () => {
      const user = userEvent.setup()
      render(<SimpleExpressionManager {...mockProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('laugh1.mp3')).toBeInTheDocument()
      })
      
      // Mock fetch for audio file
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
      })
      
      const playButtons = screen.getAllByRole('button', { name: /play/i })
      await user.click(playButtons[0])
      
      expect(mockAudioContext.decodeAudioData).toHaveBeenCalled()
    })

    it('toggles expression status', async () => {
      const user = userEvent.setup()
      
      // Mock update response
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ expressions: mockExpressions, total: 2 })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            expression: { ...mockExpressions[1], status: 'active' }
          })
        })

      render(<SimpleExpressionManager {...mockProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('sigh1.mp3')).toBeInTheDocument()
      })
      
      const enableButtons = screen.getAllByRole('button', { name: /enable/i })
      await user.click(enableButtons[0])
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/expressions/expr-2', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'active' })
        })
      })
    })

    it('deletes expressions with confirmation', async () => {
      const user = userEvent.setup()
      
      // Mock window.confirm
      const mockConfirm = jest.spyOn(window, 'confirm').mockReturnValue(true)
      
      // Mock delete response
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ expressions: mockExpressions, total: 2 })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true })
        })

      render(<SimpleExpressionManager {...mockProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('laugh1.mp3')).toBeInTheDocument()
      })
      
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
      await user.click(deleteButtons[0])
      
      expect(mockConfirm).toHaveBeenCalledWith('Delete "laugh1.mp3"? This cannot be undone.')
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/expressions/expr-1', {
          method: 'DELETE'
        })
      })
      
      mockConfirm.mockRestore()
    })
  })

  describe('Empty States', () => {
    it('shows empty state when no expressions exist', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          expressions: [],
          total: 0
        })
      })

      render(<SimpleExpressionManager {...mockProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('No expressions yet')).toBeInTheDocument()
        expect(screen.getByText('Upload your first expression above to get started!')).toBeInTheDocument()
      })
    })

    it('shows loading state initially', () => {
      ;(global.fetch as jest.Mock).mockImplementation(() => 
        new Promise(() => {}) // Never resolves
      )

      render(<SimpleExpressionManager {...mockProps} />)
      
      expect(screen.getByText('Loading expressions...')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      render(<SimpleExpressionManager {...mockProps} />)
      
      expect(screen.getByRole('combobox')).toHaveAccessibleName(/expression type/i)
      expect(screen.getByRole('button', { name: /upload expression/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()
    })

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<SimpleExpressionManager {...mockProps} />)
      
      const uploadButton = screen.getByRole('button', { name: /upload expression/i })
      
      // Tab to upload button
      await user.tab()
      await user.tab()
      await user.tab()
      await user.tab()
      
      expect(uploadButton).toHaveFocus()
    })
  })

  describe('Integration with jonathan-demo', () => {
    it('calls onExpressionUpdate when expressions change', async () => {
      const mockOnUpdate = jest.fn()
      const user = userEvent.setup()
      
      // Mock successful upload
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ expressions: [], total: 0 })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { id: 'new-expr', filename: 'test.mp3' }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ expressions: [], total: 0 })
        })

      render(<SimpleExpressionManager {...mockProps} onExpressionUpdate={mockOnUpdate} />)
      
      const file = new File(['audio'], 'test.mp3', { type: 'audio/mpeg' })
      const input = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement
      await user.upload(input, file)
      
      const uploadButton = screen.getByRole('button', { name: /upload expression/i })
      await user.click(uploadButton)
      
      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalled()
      })
    })
  })
})