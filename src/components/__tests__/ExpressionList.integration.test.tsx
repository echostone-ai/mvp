/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import ExpressionList from '../ExpressionList'

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

Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: vi.fn(() => mockAudioContext)
})

describe('ExpressionList Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('should handle complete expression management workflow', async () => {
    // Mock initial load
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        expressions: [
          {
            id: '1',
            owner_type: 'user',
            owner_key: 'user123',
            filename: 'test-laugh.mp3',
            type: 'laugh',
            tone: 'happy',
            placement_hints: ['after_joke'],
            duration_ms: 1200,
            cdn_url: 'https://example.com/test-laugh.mp3',
            priority: 0,
            status: 'active',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
          }
        ],
        total: 1,
        limit: 20,
        offset: 0
      })
    })

    render(<ExpressionList userId="user123" />)

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Your Expressions')).toBeInTheDocument()
    })

    // Verify expression is displayed
    expect(screen.getByText('😄 Laugh')).toBeInTheDocument()
    expect(screen.getByText('test-laugh.mp3')).toBeInTheDocument()
    expect(screen.getByText('1.2s')).toBeInTheDocument()

    // Test status toggle
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        expression: {
          id: '1',
          owner_type: 'user',
          owner_key: 'user123',
          filename: 'test-laugh.mp3',
          type: 'laugh',
          tone: 'happy',
          placement_hints: ['after_joke'],
          duration_ms: 1200,
          cdn_url: 'https://example.com/test-laugh.mp3',
          priority: 0,
          status: 'inactive',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      })
    })

    // Click deactivate button
    const deactivateButton = screen.getByTitle('Deactivate expression')
    fireEvent.click(deactivateButton)

    // Verify API call
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

    // Verify UI updates
    await waitFor(() => {
      expect(screen.getByTitle('Activate expression')).toBeInTheDocument()
    })
  })

  it('should handle API errors gracefully', async () => {
    // Mock API error
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Internal Server Error'
    })

    render(<ExpressionList userId="user123" />)

    await waitFor(() => {
      expect(screen.getByText(/Failed to load expressions/)).toBeInTheDocument()
    })

    // Verify error is displayed but component doesn't crash
    expect(screen.getByText('Your Expressions')).toBeInTheDocument()
  })

  it('should handle network failures during operations', async () => {
    // Mock successful initial load
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        expressions: [
          {
            id: '1',
            owner_type: 'user',
            owner_key: 'user123',
            filename: 'test.mp3',
            type: 'laugh',
            duration_ms: 1000,
            cdn_url: 'https://example.com/test.mp3',
            priority: 0,
            status: 'active',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
          }
        ],
        total: 1,
        limit: 20,
        offset: 0
      })
    })

    render(<ExpressionList userId="user123" />)

    await waitFor(() => {
      expect(screen.getByText('test.mp3')).toBeInTheDocument()
    })

    // Mock network failure for update
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Network Error'
    })

    // Try to toggle status
    const toggleButton = screen.getByTitle('Deactivate expression')
    fireEvent.click(toggleButton)

    // Verify error handling
    await waitFor(() => {
      expect(screen.getByText(/Failed to update expression/)).toBeInTheDocument()
    })

    // Verify original state is maintained
    expect(screen.getByTitle('Deactivate expression')).toBeInTheDocument()
  })

  it('should handle audio preview functionality', async () => {
    // Mock successful load
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        expressions: [
          {
            id: '1',
            owner_type: 'user',
            owner_key: 'user123',
            filename: 'test.mp3',
            type: 'laugh',
            duration_ms: 1000,
            cdn_url: 'https://example.com/test.mp3',
            priority: 0,
            status: 'active',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
          }
        ],
        total: 1,
        limit: 20,
        offset: 0
      })
    })

    render(<ExpressionList userId="user123" />)

    await waitFor(() => {
      expect(screen.getByText('test.mp3')).toBeInTheDocument()
    })

    // Mock audio fetch for preview
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1000))
    })

    // Click preview button
    const previewButton = screen.getByTitle('Play preview')
    fireEvent.click(previewButton)

    // Verify audio context methods are called
    await waitFor(() => {
      expect(mockAudioContext.decodeAudioData).toHaveBeenCalled()
    })
  })
})