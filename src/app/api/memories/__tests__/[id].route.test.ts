import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, PUT, DELETE } from '../[id]/route'
import { MemoryService } from '@/lib/memoryService'

// Mock the dependencies
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn()
  }
}

vi.mock('@supabase/auth-helpers-nextjs', () => ({
  createRouteHandlerClient: vi.fn(() => mockSupabaseClient)
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({}))
}))

vi.mock('@/lib/memoryService', () => ({
  MemoryService: {
    Retrieval: {
      getMemoryFragment: vi.fn()
    },
    Storage: {
      updateMemoryFragment: vi.fn(),
      deleteMemoryFragment: vi.fn()
    }
  }
}))

const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com'
}

const mockMemoryFragment = {
  id: 'test-memory-id',
  userId: 'test-user-id',
  fragmentText: 'Test memory fragment',
  conversationContext: {
    timestamp: '2024-01-01T00:00:00.000Z',
    messageContext: 'Test context',
    emotionalTone: 'neutral'
  },
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z')
}

const validUUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
const invalidUUID = 'invalid-uuid'

describe('/api/memories/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET /api/memories/[id]', () => {
    it('should return memory for authenticated user', async () => {
      // Mock authentication
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      // Mock memory service
      vi.mocked(MemoryService.Retrieval.getMemoryFragment).mockResolvedValue(mockMemoryFragment)

      const request = new NextRequest(`http://localhost:3000/api/memories/${validUUID}`)
      const response = await GET(request, { params: { id: validUUID } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.memory).toEqual({
        ...mockMemoryFragment,
        createdAt: mockMemoryFragment.createdAt.toISOString(),
        updatedAt: mockMemoryFragment.updatedAt.toISOString()
      })
      expect(MemoryService.Retrieval.getMemoryFragment).toHaveBeenCalledWith(validUUID, 'test-user-id')
    })

    it('should return 401 for unauthenticated user', async () => {
      // Mock authentication failure
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated')
      })

      const request = new NextRequest(`http://localhost:3000/api/memories/${validUUID}`)
      const response = await GET(request, { params: { id: validUUID } })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized. Please log in to access your memories.')
    })

    it('should return 400 for invalid UUID format', async () => {
      // Mock authentication
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      const request = new NextRequest(`http://localhost:3000/api/memories/${invalidUUID}`)
      const response = await GET(request, { params: { id: invalidUUID } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid memory ID format')
    })

    it('should return 404 for non-existent memory', async () => {
      // Mock authentication
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      // Mock memory not found
      vi.mocked(MemoryService.Retrieval.getMemoryFragment).mockResolvedValue(null)

      const request = new NextRequest(`http://localhost:3000/api/memories/${validUUID}`)
      const response = await GET(request, { params: { id: validUUID } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Memory fragment not found')
    })

    it('should handle service errors gracefully', async () => {
      // Mock authentication
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      // Mock service error
      vi.mocked(MemoryService.Retrieval.getMemoryFragment).mockRejectedValue(new Error('Database error'))

      const request = new NextRequest(`http://localhost:3000/api/memories/${validUUID}`)
      const response = await GET(request, { params: { id: validUUID } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to retrieve memory. Please try again.')
    })
  })

  describe('PUT /api/memories/[id]', () => {
    it('should update memory for authenticated user', async () => {
      // Mock authentication
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      // Mock memory service
      vi.mocked(MemoryService.Retrieval.getMemoryFragment)
        .mockResolvedValueOnce(mockMemoryFragment) // For existence check
        .mockResolvedValueOnce({ // For updated memory
          ...mockMemoryFragment,
          fragmentText: 'Updated memory fragment',
          updatedAt: new Date('2024-01-02T00:00:00.000Z')
        })
      vi.mocked(MemoryService.Storage.updateMemoryFragment).mockResolvedValue()

      const requestBody = {
        fragmentText: 'Updated memory fragment'
      }

      const request = new NextRequest(`http://localhost:3000/api/memories/${validUUID}`, {
        method: 'PUT',
        body: JSON.stringify(requestBody)
      })

      const response = await PUT(request, { params: { id: validUUID } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.memory.fragmentText).toBe('Updated memory fragment')
      expect(data.message).toBe('Memory fragment updated successfully')
      expect(MemoryService.Storage.updateMemoryFragment).toHaveBeenCalledWith(
        validUUID,
        'test-user-id',
        { fragmentText: 'Updated memory fragment' }
      )
    })

    it('should return 401 for unauthenticated user', async () => {
      // Mock authentication failure
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated')
      })

      const requestBody = { fragmentText: 'Updated memory' }
      const request = new NextRequest(`http://localhost:3000/api/memories/${validUUID}`, {
        method: 'PUT',
        body: JSON.stringify(requestBody)
      })

      const response = await PUT(request, { params: { id: validUUID } })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized. Please log in to update your memories.')
    })

    it('should return 400 for invalid UUID format', async () => {
      // Mock authentication
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      const requestBody = { fragmentText: 'Updated memory' }
      const request = new NextRequest(`http://localhost:3000/api/memories/${invalidUUID}`, {
        method: 'PUT',
        body: JSON.stringify(requestBody)
      })

      const response = await PUT(request, { params: { id: invalidUUID } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid memory ID format')
    })

    it('should return 400 when no fields provided', async () => {
      // Mock authentication
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      const request = new NextRequest(`http://localhost:3000/api/memories/${validUUID}`, {
        method: 'PUT',
        body: JSON.stringify({})
      })

      const response = await PUT(request, { params: { id: validUUID } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('At least one field (fragmentText or conversationContext) must be provided')
    })

    it('should validate fragmentText type', async () => {
      // Mock authentication
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      const request = new NextRequest(`http://localhost:3000/api/memories/${validUUID}`, {
        method: 'PUT',
        body: JSON.stringify({ fragmentText: 123 })
      })

      const response = await PUT(request, { params: { id: validUUID } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('fragmentText must be a string')
    })

    it('should validate fragmentText is not empty', async () => {
      // Mock authentication
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      const request = new NextRequest(`http://localhost:3000/api/memories/${validUUID}`, {
        method: 'PUT',
        body: JSON.stringify({ fragmentText: '   ' })
      })

      const response = await PUT(request, { params: { id: validUUID } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('fragmentText cannot be empty')
    })

    it('should validate fragmentText length', async () => {
      // Mock authentication
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      const longText = 'a'.repeat(2001)
      const request = new NextRequest(`http://localhost:3000/api/memories/${validUUID}`, {
        method: 'PUT',
        body: JSON.stringify({ fragmentText: longText })
      })

      const response = await PUT(request, { params: { id: validUUID } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('fragmentText cannot exceed 2000 characters')
    })

    it('should validate conversationContext type', async () => {
      // Mock authentication
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      const request = new NextRequest(`http://localhost:3000/api/memories/${validUUID}`, {
        method: 'PUT',
        body: JSON.stringify({ conversationContext: 'invalid' })
      })

      const response = await PUT(request, { params: { id: validUUID } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('conversationContext must be an object')
    })

    it('should return 404 for non-existent memory', async () => {
      // Mock authentication
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      // Mock memory not found
      vi.mocked(MemoryService.Retrieval.getMemoryFragment).mockResolvedValue(null)

      const request = new NextRequest(`http://localhost:3000/api/memories/${validUUID}`, {
        method: 'PUT',
        body: JSON.stringify({ fragmentText: 'Updated memory' })
      })

      const response = await PUT(request, { params: { id: validUUID } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Memory fragment not found')
    })

    it('should handle service errors gracefully', async () => {
      // Mock authentication
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      // Mock service error
      vi.mocked(MemoryService.Retrieval.getMemoryFragment).mockRejectedValue(new Error('Database error'))

      const request = new NextRequest(`http://localhost:3000/api/memories/${validUUID}`, {
        method: 'PUT',
        body: JSON.stringify({ fragmentText: 'Updated memory' })
      })

      const response = await PUT(request, { params: { id: validUUID } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to update memory. Please try again.')
    })
  })

  describe('DELETE /api/memories/[id]', () => {
    it('should delete memory for authenticated user', async () => {
      // Mock authentication
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      // Mock memory service
      vi.mocked(MemoryService.Retrieval.getMemoryFragment).mockResolvedValue(mockMemoryFragment)
      vi.mocked(MemoryService.Storage.deleteMemoryFragment).mockResolvedValue()

      const request = new NextRequest(`http://localhost:3000/api/memories/${validUUID}`, {
        method: 'DELETE'
      })

      const response = await DELETE(request, { params: { id: validUUID } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('Memory fragment deleted successfully')
      expect(data.deletedMemory.id).toBe('test-memory-id')
      expect(data.deletedMemory.fragmentText).toBe('Test memory fragment')
      expect(MemoryService.Storage.deleteMemoryFragment).toHaveBeenCalledWith(validUUID, 'test-user-id')
    })

    it('should return 401 for unauthenticated user', async () => {
      // Mock authentication failure
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated')
      })

      const request = new NextRequest(`http://localhost:3000/api/memories/${validUUID}`, {
        method: 'DELETE'
      })

      const response = await DELETE(request, { params: { id: validUUID } })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized. Please log in to delete your memories.')
    })

    it('should return 400 for invalid UUID format', async () => {
      // Mock authentication
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      const request = new NextRequest(`http://localhost:3000/api/memories/${invalidUUID}`, {
        method: 'DELETE'
      })

      const response = await DELETE(request, { params: { id: invalidUUID } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid memory ID format')
    })

    it('should return 404 for non-existent memory', async () => {
      // Mock authentication
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      // Mock memory not found
      vi.mocked(MemoryService.Retrieval.getMemoryFragment).mockResolvedValue(null)

      const request = new NextRequest(`http://localhost:3000/api/memories/${validUUID}`, {
        method: 'DELETE'
      })

      const response = await DELETE(request, { params: { id: validUUID } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Memory fragment not found')
    })

    it('should handle service errors gracefully', async () => {
      // Mock authentication
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      // Mock service error
      vi.mocked(MemoryService.Retrieval.getMemoryFragment).mockRejectedValue(new Error('Database error'))

      const request = new NextRequest(`http://localhost:3000/api/memories/${validUUID}`, {
        method: 'DELETE'
      })

      const response = await DELETE(request, { params: { id: validUUID } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to delete memory. Please try again.')
    })
  })
})