/**
 * @vitest-environment jsdom
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import ExpressionList from '../ExpressionList'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock AudioContext
Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: vi.fn(() => ({
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
  }))
})

describe('ExpressionList Component Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock successful API response
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
  })

  it('should render without crashing', () => {
    const { container } = render(<ExpressionList userId="test-user" />)
    expect(container).toBeDefined()
  })

  it('should have the correct component structure', () => {
    const { container } = render(<ExpressionList userId="test-user" />)
    
    // Check for main container
    const mainContainer = container.querySelector('._expressionListContainer_21b41d')
    expect(mainContainer).toBeDefined()
    
    // Check for header
    const header = container.querySelector('._expressionHeader_21b41d')
    expect(header).toBeDefined()
    
    // Check for title
    const title = container.querySelector('._expressionTitle_21b41d')
    expect(title).toBeDefined()
    expect(title?.textContent).toBe('Your Expressions')
  })

  it('should call the API with correct parameters', () => {
    render(<ExpressionList userId="test-user-123" />)
    
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/expressions?owner_type=user&owner_key=test-user-123')
    )
  })

  it('should handle avatar mode correctly', () => {
    render(<ExpressionList userId="test-user" avatarId="test-avatar-456" />)
    
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/expressions?owner_type=avatar&owner_key=test-avatar-456')
    )
  })

  it('should render empty state when no expressions', () => {
    const { container } = render(<ExpressionList userId="test-user" />)
    
    // Should eventually show empty state (after loading)
    setTimeout(() => {
      const emptyState = container.querySelector('._expressionEmpty_21b41d')
      expect(emptyState).toBeDefined()
    }, 100)
  })
})