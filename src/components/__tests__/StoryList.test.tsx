import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import StoryList from '../StoryList'
import { UserStory } from '@/lib/types/stories'

// Mock fetch
global.fetch = vi.fn()

// Mock AudioContext
const mockAudioContext = {
  createBufferSource: vi.fn(() => ({
    buffer: null,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null,
  })),
  decodeAudioData: vi.fn(() => Promise.resolve({})),
  destination: {},
  state: 'running',
  resume: vi.fn(() => Promise.resolve()),
  close: vi.fn(),
}

Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: vi.fn(() => mockAudioContext),
})

Object.defineProperty(window, 'webkitAudioContext', {
  writable: true,
  value: vi.fn(() => mockAudioContext),
})

describe('StoryList', () => {
  const mockProps = {
    userId: 'test-user-id',
    avatarId: 'test-avatar-id',
    onStoryUpdate: vi.fn(),
  }

  const mockStories: UserStory[] = [
    {
      id: 'story-1',
      owner_id: 'test-avatar-id',
      owner_type: 'avatar',
      title: 'My College Story',
      category: 'memory',
      triggers: 'college, university, first day',
      audio_url: 'https://example.com/story1.mp3',
      duration_ms: 120000,
      transcript: 'This is a story about my first day at college...',
      priority: 75,
      status: 'active',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'story-2',
      owner_id: 'test-avatar-id',
      owner_type: 'avatar',
      title: 'Travel Adventure',
      category: 'experience',
      triggers: 'travel, adventure, backpacking',
      audio_url: 'https://example.com/story2.mp3',
      duration_ms: 180000,
      transcript: undefined,
      priority: 50,
      status: 'inactive',
      created_at: '2024-01-02T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state initially', () => {
    const mockFetch = global.fetch as any
    mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

    render(<StoryList {...mockProps} />)
    
    expect(screen.getByText('Loading your stories...')).toBeInTheDocument()
  })

  it('renders stories list when loaded', async () => {
    const mockFetch = global.fetch as any
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        stories: mockStories,
        count: 2,
      })
    } as Response)

    render(<StoryList {...mockProps} />)
    
    await waitFor(() => {
      expect(screen.getByText('Your Stories')).toBeInTheDocument()
      expect(screen.getByText('2 of 5 stories uploaded')).toBeInTheDocument()
      expect(screen.getByText('My College Story')).toBeInTheDocument()
      expect(screen.getByText('Travel Adventure')).toBeInTheDocument()
    })
  })

  it('shows empty state when no stories', async () => {
    const mockFetch = global.fetch as any
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        stories: [],
        count: 0,
      })
    } as Response)

    render(<StoryList {...mockProps} />)
    
    await waitFor(() => {
      expect(screen.getByText('No stories found')).toBeInTheDocument()
      expect(screen.getByText(/Upload your first authentic voice story/)).toBeInTheDocument()
    })
  })

  it('displays story details correctly', async () => {
    const mockFetch = global.fetch as any
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        stories: mockStories,
        count: 2,
      })
    } as Response)

    render(<StoryList {...mockProps} />)
    
    await waitFor(() => {
      // Check story categories
      expect(screen.getByText('💭 Memory')).toBeInTheDocument()
      expect(screen.getByText('🌟 Experience')).toBeInTheDocument()
      
      // Check durations
      expect(screen.getByText('2:00')).toBeInTheDocument() // 120000ms = 2:00
      expect(screen.getByText('3:00')).toBeInTheDocument() // 180000ms = 3:00
      
      // Check triggers
      expect(screen.getByText('college')).toBeInTheDocument()
      expect(screen.getByText('university')).toBeInTheDocument()
      expect(screen.getByText('travel')).toBeInTheDocument()
      
      // Check status
      expect(screen.getByText('• active')).toBeInTheDocument()
      expect(screen.getByText('• inactive')).toBeInTheDocument()
      
      // Check priority
      expect(screen.getByText('Priority: 75/100')).toBeInTheDocument()
      expect(screen.getByText('Priority: 50/100')).toBeInTheDocument()
    })
  })

  it('shows transcript when available', async () => {
    const mockFetch = global.fetch as any
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        stories: mockStories,
        count: 2,
      })
    } as Response)

    render(<StoryList {...mockProps} />)
    
    await waitFor(() => {
      expect(screen.getByText('This is a story about my first day at college...')).toBeInTheDocument()
    })
  })

  it('handles story deletion', async () => {
    const mockFetch = global.fetch as any
    
    // Mock initial load
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        stories: mockStories,
        count: 2,
      })
    } as Response)

    // Mock delete request
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    } as Response)

    // Mock window.confirm
    window.confirm = vi.fn(() => true)

    render(<StoryList {...mockProps} />)
    
    await waitFor(() => {
      expect(screen.getByText('My College Story')).toBeInTheDocument()
    })

    // Click delete button for first story
    const deleteButtons = screen.getAllByTitle('Delete story')
    fireEvent.click(deleteButtons[0])
    
    await waitFor(() => {
      expect(mockProps.onStoryUpdate).toHaveBeenCalled()
    })
  })

  it('handles preview playback', async () => {
    const mockFetch = global.fetch as any
    
    // Mock initial load
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        stories: mockStories,
        count: 2,
      })
    } as Response)

    // Mock audio fetch
    mockFetch.mockResolvedValueOnce({
      arrayBuffer: async () => new ArrayBuffer(8)
    } as Response)

    render(<StoryList {...mockProps} />)
    
    await waitFor(() => {
      expect(screen.getByText('My College Story')).toBeInTheDocument()
    })

    // Click play button for first story
    const playButtons = screen.getAllByTitle('Play preview')
    fireEvent.click(playButtons[0])
    
    await waitFor(() => {
      expect(mockAudioContext.decodeAudioData).toHaveBeenCalled()
    })
  })

  it('handles API errors gracefully', async () => {
    const mockFetch = global.fetch as any
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Internal Server Error'
    } as Response)

    render(<StoryList {...mockProps} />)
    
    await waitFor(() => {
      expect(screen.getByText(/Failed to load stories/)).toBeInTheDocument()
    })
  })

  it('refreshes stories when refresh button is clicked', async () => {
    const mockFetch = global.fetch as any
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        stories: mockStories,
        count: 2,
      })
    } as Response)

    render(<StoryList {...mockProps} />)
    
    await waitFor(() => {
      expect(screen.getByText('Your Stories')).toBeInTheDocument()
    })

    const refreshButton = screen.getByTitle('Refresh stories')
    fireEvent.click(refreshButton)
    
    // Should make another API call
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})