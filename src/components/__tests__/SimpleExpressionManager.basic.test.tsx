/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import SimpleExpressionManager from '../SimpleExpressionManager'

import { vi } from 'vitest'

// Mock fetch globally
global.fetch = vi.fn()

// Mock AudioContext
const mockAudioContext = {
  createBufferSource: vi.fn(() => ({
    buffer: null,
    connect: vi.fn(),
    start: vi.fn(),
    onended: null
  })),
  decodeAudioData: vi.fn(() => Promise.resolve({
    length: 44100,
    sampleRate: 44100
  })),
  destination: {},
  close: vi.fn(),
  resume: vi.fn(() => Promise.resolve()),
  state: 'running'
}

Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: vi.fn(() => mockAudioContext)
})

describe('SimpleExpressionManager - Basic Tests', () => {
  const mockProps = {
    userId: 'test-user-123',
    avatarId: 'test-avatar-456',
    onExpressionUpdate: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        expressions: [],
        total: 0
      })
    })
  })

  it('renders the expression manager interface', () => {
    render(<SimpleExpressionManager {...mockProps} />)
    
    expect(screen.getByText('Expression Manager')).toBeInTheDocument()
    expect(screen.getByText('Upload New Expression')).toBeInTheDocument()
    expect(screen.getByText('Drop audio file here')).toBeInTheDocument()
  })

  it('renders all expression type options', () => {
    render(<SimpleExpressionManager {...mockProps} />)
    
    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()
    
    // Check for key expression types
    expect(screen.getByText(/😄 Laugh/)).toBeInTheDocument()
    expect(screen.getByText(/😔 Sigh/)).toBeInTheDocument()
    expect(screen.getByText(/💨 Breath/)).toBeInTheDocument()
  })

  it('handles file selection', () => {
    render(<SimpleExpressionManager {...mockProps} />)
    
    const file = new File(['audio content'], 'test.mp3', { type: 'audio/mpeg' })
    const input = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement
    
    fireEvent.change(input, { target: { files: [file] } })
    
    expect(screen.getByText('test.mp3')).toBeInTheDocument()
  })

  it('shows upload button', () => {
    render(<SimpleExpressionManager {...mockProps} />)
    
    const uploadButton = screen.getByRole('button', { name: /upload expression/i })
    expect(uploadButton).toBeInTheDocument()
    expect(uploadButton).toBeDisabled() // Should be disabled without file
  })

  it('loads expressions on mount', async () => {
    render(<SimpleExpressionManager {...mockProps} />)
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/expressions'),
        undefined
      )
    })
  })

  it('shows empty state when no expressions exist', async () => {
    render(<SimpleExpressionManager {...mockProps} />)
    
    await waitFor(() => {
      expect(screen.getByText('No expressions yet')).toBeInTheDocument()
    })
  })

  it('displays expression count', async () => {
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        expressions: [
          {
            id: 'expr-1',
            filename: 'test.mp3',
            type: 'laugh',
            duration_ms: 2000,
            cdn_url: 'https://example.com/test.mp3',
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ],
        total: 1
      })
    })

    render(<SimpleExpressionManager {...mockProps} />)
    
    await waitFor(() => {
      expect(screen.getByText('Your Expressions (1)')).toBeInTheDocument()
    })
  })
})