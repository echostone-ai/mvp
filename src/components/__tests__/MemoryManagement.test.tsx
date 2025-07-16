import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import MemoryManagement from '../MemoryManagement'
import { MemoryFragment } from '@/lib/memoryService'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock window.confirm
const mockConfirm = vi.fn()
global.confirm = mockConfirm

// Mock URL.createObjectURL and related methods
const mockCreateObjectURL = vi.fn()
const mockRevokeObjectURL = vi.fn()
global.URL.createObjectURL = mockCreateObjectURL
global.URL.revokeObjectURL = mockRevokeObjectURL

// Mock document methods
const mockClick = vi.fn()
const mockAppendChild = vi.fn()
const mockRemoveChild = vi.fn()
const mockCreateElement = vi.fn(() => ({
  click: mockClick,
  href: '',
  download: ''
}))

Object.defineProperty(document, 'createElement', {
  value: mockCreateElement
})
Object.defineProperty(document.body, 'appendChild', {
  value: mockAppendChild
})
Object.defineProperty(document.body, 'removeChild', {
  value: mockRemoveChild
})

const mockMemories: MemoryFragment[] = [
  {
    id: 'memory-1',
    userId: 'user-1',
    fragmentText: 'User loves hiking in the mountains',
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
    conversationContext: {
      timestamp: '2024-01-15T10:00:00Z',
      messageContext: 'Discussing outdoor activities',
      emotionalTone: 'excited'
    }
  },
  {
    id: 'memory-2',
    userId: 'user-1',
    fragmentText: 'User has a dog named Max',
    createdAt: new Date('2024-01-16T14:30:00Z'),
    updatedAt: new Date('2024-01-16T14:30:00Z'),
    conversationContext: {
      timestamp: '2024-01-16T14:30:00Z',
      messageContext: 'Talking about pets'
    }
  }
]

const mockStats = {
  totalFragments: 2,
  oldestMemory: new Date('2024-01-15T10:00:00Z'),
  newestMemory: new Date('2024-01-16T14:30:00Z')
}

describe('MemoryManagement', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    mockConfirm.mockClear()
    mockCreateObjectURL.mockClear()
    mockRevokeObjectURL.mockClear()
    mockClick.mockClear()
    mockAppendChild.mockClear()
    mockRemoveChild.mockClear()
    mockCreateElement.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => { })) // Never resolves

    render(<MemoryManagement userId="user-1" />)

    expect(screen.getByText('Loading your memories...')).toBeDefined()
  })

  it('displays the component title and subtitle', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        memories: [],
        stats: { totalFragments: 0 },
        pagination: { limit: 20, offset: 0, total: 0 }
      })
    })

    render(<MemoryManagement userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('Your Conversation Memories')).toBeDefined()
      expect(screen.getByText(/Manage the personal details and experiences/)).toBeDefined()
    })
  })

  it('displays empty state when no memories exist', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        memories: [],
        stats: { totalFragments: 0 },
        pagination: { limit: 20, offset: 0, total: 0 }
      })
    })

    render(<MemoryManagement userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('No memories found')).toBeDefined()
      expect(screen.getByText(/Start chatting with your avatar/)).toBeDefined()
    })
  })

  it('displays memory fragments correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        memories: mockMemories,
        stats: mockStats,
        pagination: { limit: 20, offset: 0, total: 2 }
      })
    })

    render(<MemoryManagement userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('User loves hiking in the mountains')).toBeDefined()
      expect(screen.getByText('User has a dog named Max')).toBeDefined()
      expect(screen.getByText('2')).toBeDefined() // Total fragments stat
    })
  })

  it('displays memory stats correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        memories: mockMemories,
        stats: mockStats,
        pagination: { limit: 20, offset: 0, total: 2 }
      })
    })

    render(<MemoryManagement userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('Total Memories')).toBeDefined()
      expect(screen.getByText('First Memory')).toBeDefined()
      expect(screen.getByText('Latest Memory')).toBeDefined()
    })
  })

  it('handles search functionality', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        memories: mockMemories,
        stats: mockStats,
        pagination: { limit: 20, offset: 0, total: 2 }
      })
    })

    render(<MemoryManagement userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search your memories...')).toBeDefined()
    })

    const searchInput = screen.getByPlaceholderText('Search your memories...')
    fireEvent.change(searchInput, { target: { value: 'hiking' } })

    // Wait for debounced search
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('search=hiking')
      )
    })
  })

  it('enters edit mode when edit button is clicked', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        memories: mockMemories,
        stats: mockStats,
        pagination: { limit: 20, offset: 0, total: 2 }
      })
    })

    render(<MemoryManagement userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('User loves hiking in the mountains')).toBeDefined()
    })

    const editButtons = screen.getAllByText('Edit')
    fireEvent.click(editButtons[0])

    await waitFor(() => {
      expect(screen.getByDisplayValue('User loves hiking in the mountains')).toBeDefined()
      expect(screen.getByText('Save')).toBeDefined()
      expect(screen.getByText('Cancel')).toBeDefined()
    })
  })

  it('saves edited memory successfully', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          memories: mockMemories,
          stats: mockStats,
          pagination: { limit: 20, offset: 0, total: 2 }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      })

    render(<MemoryManagement userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('User loves hiking in the mountains')).toBeDefined()
    })

    const editButtons = screen.getAllByText('Edit')
    fireEvent.click(editButtons[0])

    await waitFor(() => {
      const textarea = screen.getByDisplayValue('User loves hiking in the mountains')
      fireEvent.change(textarea, { target: { value: 'User loves hiking and rock climbing' } })

      const saveButton = screen.getByText('Save')
      fireEvent.click(saveButton)
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/memories/memory-1',
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fragmentText: 'User loves hiking and rock climbing' })
        })
      )
    })
  })

  it('cancels edit mode when cancel button is clicked', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        memories: mockMemories,
        stats: mockStats,
        pagination: { limit: 20, offset: 0, total: 2 }
      })
    })

    render(<MemoryManagement userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('User loves hiking in the mountains')).toBeDefined()
    })

    const editButtons = screen.getAllByText('Edit')
    fireEvent.click(editButtons[0])

    await waitFor(() => {
      expect(screen.getByDisplayValue('User loves hiking in the mountains')).toBeDefined()
    })

    const cancelButton = screen.getByText('Cancel')
    fireEvent.click(cancelButton)

    await waitFor(() => {
      expect(screen.queryByDisplayValue('User loves hiking in the mountains')).toBeNull()
      expect(screen.getByText('User loves hiking in the mountains')).toBeDefined()
    })
  })

  it('deletes memory after confirmation', async () => {
    mockConfirm.mockReturnValue(true)

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          memories: mockMemories,
          stats: mockStats,
          pagination: { limit: 20, offset: 0, total: 2 }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      })

    render(<MemoryManagement userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('User loves hiking in the mountains')).toBeDefined()
    })

    const deleteButtons = screen.getAllByText('Delete')
    fireEvent.click(deleteButtons[0])

    expect(mockConfirm).toHaveBeenCalledWith(
      'Are you sure you want to delete this memory? This action cannot be undone.'
    )

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/memories/memory-1',
        expect.objectContaining({ method: 'DELETE' })
      )
    })
  })

  it('does not delete memory when confirmation is cancelled', async () => {
    mockConfirm.mockReturnValue(false)

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        memories: mockMemories,
        stats: mockStats,
        pagination: { limit: 20, offset: 0, total: 2 }
      })
    })

    render(<MemoryManagement userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('User loves hiking in the mountains')).toBeDefined()
    })

    const deleteButtons = screen.getAllByText('Delete')
    fireEvent.click(deleteButtons[0])

    expect(mockConfirm).toHaveBeenCalled()
    expect(mockFetch).toHaveBeenCalledTimes(1) // Only the initial load
  })

  it('exports memories successfully', async () => {
    const mockBlob = new Blob(['test data'], { type: 'application/json' })

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          memories: mockMemories,
          stats: mockStats,
          pagination: { limit: 20, offset: 0, total: 2 }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => mockBlob
      })

    mockCreateObjectURL.mockReturnValue('blob:mock-url')

    render(<MemoryManagement userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('Export All')).toBeDefined()
    })

    const exportButton = screen.getByText('Export All')
    fireEvent.click(exportButton)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/memories/export')
      expect(mockCreateObjectURL).toHaveBeenCalledWith(mockBlob)
      expect(mockClick).toHaveBeenCalled()
    })
  })

  it('deletes all memories after confirmation', async () => {
    mockConfirm.mockReturnValue(true)

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          memories: mockMemories,
          stats: mockStats,
          pagination: { limit: 20, offset: 0, total: 2 }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      })

    render(<MemoryManagement userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('Delete All')).toBeDefined()
    })

    const deleteAllButton = screen.getByText('Delete All')
    fireEvent.click(deleteAllButton)

    expect(mockConfirm).toHaveBeenCalledWith(
      'Are you sure you want to delete all 2 memories? This action cannot be undone.'
    )

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/memories',
        expect.objectContaining({ method: 'DELETE' })
      )
    })
  })

  it('handles pagination correctly', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        memories: mockMemories,
        stats: { ...mockStats, totalFragments: 25 },
        pagination: { limit: 20, offset: 0, total: 25 }
      })
    })

    render(<MemoryManagement userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 2')).toBeDefined()
    })

    const nextButton = screen.getByText('Next')
    fireEvent.click(nextButton)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('offset=20')
      )
    })
  })

  it('displays error messages correctly', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    render(<MemoryManagement userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeDefined()
    })
  })

  it('shows conversation context when available', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        memories: mockMemories,
        stats: mockStats,
        pagination: { limit: 20, offset: 0, total: 2 }
      })
    })

    render(<MemoryManagement userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('Context:')).toBeDefined()
      expect(screen.getByText('Discussing outdoor activities')).toBeDefined()
      expect(screen.getByText('Tone:')).toBeDefined()
      expect(screen.getByText('excited')).toBeDefined()
    })
  })

  it('validates empty memory text during save', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        memories: mockMemories,
        stats: mockStats,
        pagination: { limit: 20, offset: 0, total: 2 }
      })
    })

    render(<MemoryManagement userId="user-1" />)

    await waitFor(() => {
      expect(screen.getByText('User loves hiking in the mountains')).toBeDefined()
    })

    const editButtons = screen.getAllByText('Edit')
    fireEvent.click(editButtons[0])

    await waitFor(() => {
      const textarea = screen.getByDisplayValue('User loves hiking in the mountains')
      fireEvent.change(textarea, { target: { value: '' } })

      const saveButton = screen.getByText('Save')
      fireEvent.click(saveButton)
    })

    await waitFor(() => {
      expect(screen.getByText('Memory text cannot be empty')).toBeDefined()
    })
  })
})