/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import ExpressionList from '../ExpressionList'
import { ExpressionClip } from '@/lib/types/expressions'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock AudioContext
const mockAudioContext = {
  createBufferSource: vi.fn(() => ({
    buffer: null,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null
  })),
  decodeAudioData: vi.fn(() => Promise.resolve({})),
  destination: {},
  state: 'running',
  resume: vi.fn(() => Promise.resolve()),
  close: vi.fn(() => Promise.resolve())
}

// Mock window.AudioContext
Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: vi.fn(() => mockAudioContext)
})

Object.defineProperty(window, 'webkitAudioContext', {
  writable: true,
  value: vi.fn(() => mockAudioContext)
})

const mockExpressions: ExpressionClip[] = [
  {
    id: '1',
    owner_type: 'user',
    owner_key: 'user123',
    filename: 'laugh.mp3',
    type: 'laugh',
    tone: 'happy',
    placement_hints: ['after_joke'],
    duration_ms: 1500,
    cdn_url: 'https://example.com/laugh.mp3',
    priority: 0,
    status: 'active',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: '2',
    owner_type: 'user',
    owner_key: 'user123',
    filename: 'sigh.mp3',
    type: 'sigh',
    tone: 'sad',
    placement_hints: [],
    duration_ms: 800,
    cdn_url: 'https://example.com/sigh.mp3',
    priority: 0,
    status: 'inactive',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z'
  }
]

describe('ExpressionList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock successful API responses by default
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        expressions: mockExpressions,
        total: mockExpressions.length,
        limit: 20,
        offset: 0
      })
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    cleanup()
  })

  it('should render loading state initially', () => {
    render(<ExpressionList userId="user123" />)
    
    expect(screen.getByText('Loading your expressions...')).toBeInTheDocument()
  })

  it('should load and display expressions', async () => {
    render(<ExpressionList userId="user123" />)
    
    await waitFor(() => {
      expect(screen.getByText('Your Expressions')).toBeInTheDocument()
    })

    expect(screen.getByText('😄 Laugh')).toBeInTheDocument()
    expect(screen.getByText('😔 Sigh')).toBeInTheDocument()
    expect(screen.getByText('laugh.mp3')).toBeInTheDocument()
    expect(screen.getByText('sigh.mp3')).toBeInTheDocument()
  })

  it('should show empty state when no expressions exist', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        expressions: [],
        total: 0,
        limit: 20,
        offset: 0
      })
    })

    render(<ExpressionList userId="user123" />)
    
    await waitFor(() => {
      expect(screen.getByText('No expressions found')).toBeInTheDocument()
    })

    expect(screen.getByText(/Upload your first expression/)).toBeInTheDocument()
  })

  it('should handle API errors gracefully', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      statusText: 'Internal Server Error'
    })

    render(<ExpressionList userId="user123" />)
    
    await waitFor(() => {
      expect(screen.getByText(/Failed to load expressions/)).toBeInTheDocument()
    })
  })

  it('should call correct API endpoint with user parameters', async () => {
    render(<ExpressionList userId="user123" />)
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/expressions?owner_type=user&owner_key=user123')
      )
    })
  })

  it('should call correct API endpoint with avatar parameters', async () => {
    render(<ExpressionList userId="user123" avatarId="avatar456" />)
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/expressions?owner_type=avatar&owner_key=avatar456')
      )
    })
  })

  it('should handle expression status toggle', async () => {
    render(<ExpressionList userId="user123" />)
    
    await waitFor(() => {
      expect(screen.getByText('😄 Laugh')).toBeInTheDocument()
    })

    // Mock the PATCH request
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        expression: { ...mockExpressions[0], status: 'inactive' }
      })
    })

    // Find and click the toggle button for the active expression
    const toggleButtons = screen.getAllByTitle(/activate|deactivate/i)
    const activeToggle = toggleButtons.find(btn => btn.textContent === '✅')
    
    if (activeToggle) {
      fireEvent.click(activeToggle)
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/expressions/1',
          expect.objectContaining({
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'inactive' })
          })
        )
      })
    }
  })

  it('should handle expression deletion with confirmation', async () => {
    // Mock window.confirm
    const mockConfirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    
    render(<ExpressionList userId="user123" />)
    
    await waitFor(() => {
      expect(screen.getByText('😄 Laugh')).toBeInTheDocument()
    })

    // Mock the DELETE request
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        message: 'Expression deleted successfully'
      })
    })

    // Find and click the delete button
    const deleteButtons = screen.getAllByTitle('Delete expression')
    fireEvent.click(deleteButtons[0])
    
    expect(mockConfirm).toHaveBeenCalledWith(
      expect.stringContaining('Are you sure you want to delete "laugh.mp3"?')
    )

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/expressions/1',
        expect.objectContaining({
          method: 'DELETE'
        })
      )
    })

    mockConfirm.mockRestore()
  })

  it('should not delete when confirmation is cancelled', async () => {
    // Mock window.confirm to return false
    const mockConfirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    
    render(<ExpressionList userId="user123" />)
    
    await waitFor(() => {
      expect(screen.getByText('😄 Laugh')).toBeInTheDocument()
    })

    // Find and click the delete button
    const deleteButtons = screen.getAllByTitle('Delete expression')
    fireEvent.click(deleteButtons[0])
    
    expect(mockConfirm).toHaveBeenCalled()
    
    // Should not make DELETE request
    expect(mockFetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/expressions/1'),
      expect.objectContaining({ method: 'DELETE' })
    )

    mockConfirm.mockRestore()
  })

  it('should display expression metadata correctly', async () => {
    render(<ExpressionList userId="user123" />)
    
    await waitFor(() => {
      expect(screen.getByText('😄 Laugh')).toBeInTheDocument()
    })

    // Check duration formatting
    expect(screen.getByText('1.5s')).toBeInTheDocument()
    expect(screen.getByText('0.8s')).toBeInTheDocument()

    // Check tone display
    expect(screen.getByText('Tone: happy')).toBeInTheDocument()
    expect(screen.getByText('Tone: sad')).toBeInTheDocument()

    // Check placement hints
    expect(screen.getByText('Hints: after_joke')).toBeInTheDocument()
  })

  it('should handle refresh button click', async () => {
    render(<ExpressionList userId="user123" />)
    
    await waitFor(() => {
      expect(screen.getByText('Your Expressions')).toBeInTheDocument()
    })

    // Clear previous calls
    mockFetch.mockClear()

    // Click refresh button
    const refreshButton = screen.getByTitle('Refresh expressions')
    fireEvent.click(refreshButton)

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/expressions?owner_type=user&owner_key=user123')
    )
  })
})