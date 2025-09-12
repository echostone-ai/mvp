import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import StoryUploader from '../StoryUploader'

// Mock the story types module
vi.mock('@/lib/types/stories', () => ({
  STORY_CONSTRAINTS: {
    MAX_FILE_SIZE_MB: 10,
    MAX_TITLE_LENGTH: 255,
    MAX_TRIGGERS: 20,
    MAX_TRANSCRIPT_LENGTH: 10000,
  },
  validateStoryFile: vi.fn((file: File) => ({ valid: true })),
  validateStoryMetadata: vi.fn(() => ({ valid: true, errors: [] })),
}))

// Mock fetch
global.fetch = vi.fn()

describe('StoryUploader', () => {
  const mockProps = {
    userId: 'test-user-id',
    avatarId: 'test-avatar-id',
    onUploadSuccess: vi.fn(),
    onUploadError: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the upload form correctly', () => {
    render(<StoryUploader {...mockProps} />)
    
    expect(screen.getByText('Upload Story')).toBeInTheDocument()
    expect(screen.getByText('Share authentic voice stories that will play when triggered by conversation topics')).toBeInTheDocument()
    expect(screen.getByLabelText('Story Title *')).toBeInTheDocument()
    expect(screen.getByLabelText('Category *')).toBeInTheDocument()
    expect(screen.getByLabelText(/Trigger Keywords/)).toBeInTheDocument()
    expect(screen.getByLabelText('Transcript (Optional)')).toBeInTheDocument()
  })

  it('shows validation error for empty title', async () => {
    const { validateStoryMetadata } = require('@/lib/types/stories')
    validateStoryMetadata.mockReturnValue({
      valid: false,
      errors: ['Title is required']
    })

    render(<StoryUploader {...mockProps} />)
    
    const uploadButton = screen.getByText('Upload Story')
    fireEvent.click(uploadButton)
    
    await waitFor(() => {
      expect(screen.getByText('Please select an audio file to upload')).toBeInTheDocument()
    })
  })

  it('updates trigger count when triggers are entered', () => {
    render(<StoryUploader {...mockProps} />)
    
    const triggerInput = screen.getByPlaceholderText('e.g., college, university, first day, nervous')
    fireEvent.change(triggerInput, { target: { value: 'test, trigger, keywords' } })
    
    expect(screen.getByText(/\(3\/20\)/)).toBeInTheDocument()
    expect(screen.getByText('test')).toBeInTheDocument()
    expect(screen.getByText('trigger')).toBeInTheDocument()
    expect(screen.getByText('keywords')).toBeInTheDocument()
  })

  it('disables upload button when form is invalid', () => {
    render(<StoryUploader {...mockProps} />)
    
    const uploadButton = screen.getByText('Upload Story')
    expect(uploadButton).toBeDisabled()
  })

  it('shows file information when file is selected', () => {
    render(<StoryUploader {...mockProps} />)
    
    const fileInput = screen.getByRole('textbox', { hidden: true })
    const file = new File(['test'], 'test-story.mp3', { type: 'audio/mp3' })
    
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    })
    
    fireEvent.change(fileInput)
    
    expect(screen.getByText('test-story.mp3')).toBeInTheDocument()
  })

  it('shows category options', () => {
    render(<StoryUploader {...mockProps} />)
    
    const categorySelect = screen.getByDisplayValue(/💭 Memory/)
    expect(categorySelect).toBeInTheDocument()
    
    fireEvent.click(categorySelect)
    expect(screen.getByText(/🌟 Experience/)).toBeInTheDocument()
    expect(screen.getByText(/💡 Advice/)).toBeInTheDocument()
    expect(screen.getByText(/📖 Anecdote/)).toBeInTheDocument()
  })

  it('handles successful upload', async () => {
    const mockFetch = global.fetch as any
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { id: 'story-123', title: 'Test Story' }
      })
    } as Response)

    render(<StoryUploader {...mockProps} />)
    
    // Fill out the form
    const titleInput = screen.getByLabelText('Story Title *')
    const triggerInput = screen.getByPlaceholderText('e.g., college, university, first day, nervous')
    
    fireEvent.change(titleInput, { target: { value: 'Test Story' } })
    fireEvent.change(triggerInput, { target: { value: 'test, story' } })
    
    // Mock file selection
    const fileInput = screen.getByRole('textbox', { hidden: true })
    const file = new File(['test'], 'test-story.mp3', { type: 'audio/mp3' })
    
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    })
    
    fireEvent.change(fileInput)
    
    // Click upload
    const uploadButton = screen.getByText('Upload Story')
    fireEvent.click(uploadButton)
    
    await waitFor(() => {
      expect(mockProps.onUploadSuccess).toHaveBeenCalledWith({
        id: 'story-123',
        title: 'Test Story'
      })
    })
  })

  it('handles upload error', async () => {
    const mockFetch = global.fetch as any
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: 'Upload failed'
      })
    } as Response)

    render(<StoryUploader {...mockProps} />)
    
    // Fill out the form
    const titleInput = screen.getByLabelText('Story Title *')
    const triggerInput = screen.getByPlaceholderText('e.g., college, university, first day, nervous')
    
    fireEvent.change(titleInput, { target: { value: 'Test Story' } })
    fireEvent.change(triggerInput, { target: { value: 'test, story' } })
    
    // Mock file selection
    const fileInput = screen.getByRole('textbox', { hidden: true })
    const file = new File(['test'], 'test-story.mp3', { type: 'audio/mp3' })
    
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    })
    
    fireEvent.change(fileInput)
    
    // Click upload
    const uploadButton = screen.getByText('Upload Story')
    fireEvent.click(uploadButton)
    
    await waitFor(() => {
      expect(screen.getByText('Upload failed')).toBeInTheDocument()
    })
  })
})