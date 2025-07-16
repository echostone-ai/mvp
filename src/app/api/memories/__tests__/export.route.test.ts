import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '../export/route'
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
      getUserMemories: vi.fn(),
      getMemoryStats: vi.fn()
    },
    Storage: {
      deleteAllUserMemories: vi.fn(),
      deleteMemoryFragment: vi.fn()
    }
  }
}))

const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com'
}

const mockMemories = [
  {
    id: 'memory-1',
    userId: 'test-user-id',
    fragmentText: 'First memory fragment',
    conversationContext: {
      timestamp: '2024-01-01T00:00:00.000Z',
      messageContext: 'First context',
      emotionalTone: 'positive'
    },
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    embedding: [0.1, 0.2, 0.3]
  },
  {
    id: 'memory-2',
    userId: 'test-user-id',
    fragmentText: 'Second memory fragment',
    conversationContext: {
      timestamp: '2024-01-02T00:00:00.000Z',
      messageContext: 'Second context',
      emotionalTone: 'neutral'
    },
    createdAt: '2024-01-02T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
    embedding: [0.4, 0.5, 0.6]
  }
]

const mockStats = {
  totalFragments: 2,
  oldestMemory: '2024-01-01T00:00:00.000Z',
  newestMemory: '2024-01-02T00:00:00.000Z'
}

describe('/api/memories/export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET /api/memories/export', () => {
    it('should export memories in JSON format', async () => {
      // Mock authentication
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      // Mock memory service
      vi.mocked(MemoryService.Retrieval.getUserMemories).mockResolvedValue(mockMemories)
      vi.mocked(MemoryService.Retrieval.getMemoryStats).mockResolvedValue(mockStats)

      const request = new NextRequest('http://localhost:3000/api/memories/export')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.exportInfo.userId).toBe('test-user-id')
      expect(data.exportInfo.totalMemories).toBe(2)
      expect(data.exportInfo.format).toBe('json')
      expect(data.exportInfo.includeEmbeddings).toBe(false)
      expect(data.stats).toEqual(mockStats)
      expect(data.memories).toHaveLength(2)
      expect(data.memories[0].embedding).toBeUndefined() // Should not include embeddings by default
      expect(response.headers.get('Content-Disposition')).toContain('attachment')
    })

    it('should export memories in JSON format with embeddings', async () => {
      // Mock authentication
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      // Mock memory service
      vi.mocked(MemoryService.Retrieval.getUserMemories).mockResolvedValue(mockMemories)
      vi.mocked(MemoryService.Retrieval.getMemoryStats).mockResolvedValue(mockStats)

      const request = new NextRequest('http://localhost:3000/api/memories/export?includeEmbeddings=true')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.exportInfo.includeEmbeddings).toBe(true)
      expect(data.memories[0].embedding).toEqual([0.1, 0.2, 0.3])
      expect(data.memories[1].embedding).toEqual([0.4, 0.5, 0.6])
    })

    it('should export memories in CSV format', async () => {
      // Mock authentication
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      // Mock memory service
      vi.mocked(MemoryService.Retrieval.getUserMemories).mockResolvedValue(mockMemories)
      vi.mocked(MemoryService.Retrieval.getMemoryStats).mockResolvedValue(mockStats)

      const request = new NextRequest('http://localhost:3000/api/memories/export?format=csv')
      const response = await GET(request)
      const csvContent = await response.text()

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('text/csv')
      expect(response.headers.get('Content-Disposition')).toContain('attachment')
      expect(response.headers.get('Content-Disposition')).toContain('.csv')
      expect(csvContent).toContain('ID,Fragment Text,Created At')
      expect(csvContent).toContain('memory-1,"First memory fragment"')
      expect(csvContent).toContain('memory-2,"Second memory fragment"')
    })

    it('should export memories in CSV format with embeddings', async () => {
      // Mock authentication
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      // Mock memory service
      vi.mocked(MemoryService.Retrieval.getUserMemories).mockResolvedValue(mockMemories)
      vi.mocked(MemoryService.Retrieval.getMemoryStats).mockResolvedValue(mockStats)

      const request = new NextRequest('http://localhost:3000/api/memories/export?format=csv&includeEmbeddings=true')
      const response = await GET(request)
      const csvContent = await response.text()

      expect(response.status).toBe(200)
      expect(csvContent).toContain('Embedding (JSON)')
      expect(csvContent).toContain('[0.1,0.2,0.3]')
      expect(csvContent).toContain('[0.4,0.5,0.6]')
    })

    it('should return 401 for unauthenticated user', async () => {
      // Mock authentication failure
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated')
      })

      const request = new NextRequest('http://localhost:3000/api/memories/export')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized. Please log in to export your memories.')
    })

    it('should validate format parameter', async () => {
      // Mock authentication
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/memories/export?format=xml')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Format must be either "json" or "csv"')
    })

    it('should handle empty memories list', async () => {
      // Mock authentication
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      // Mock empty memories
      vi.mocked(MemoryService.Retrieval.getUserMemories).mockResolvedValue([])
      vi.mocked(MemoryService.Retrieval.getMemoryStats).mockResolvedValue({
        totalFragments: 0
      })

      const request = new NextRequest('http://localhost:3000/api/memories/export')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.exportInfo.totalMemories).toBe(0)
      expect(data.memories).toEqual([])
    })

    it('should handle service errors gracefully', async () => {
      // Mock authentication
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      // Mock service error
      vi.mocked(MemoryService.Retrieval.getUserMemories).mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/memories/export')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to export memories. Please try again.')
    })
  })

  describe('POST /api/memories/export', () => {
    it('should delete all memories', async () => {
      // Mock authentication
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      // Mock memory service
      vi.mocked(MemoryService.Retrieval.getMemoryStats).mockResolvedValue(mockStats)
      vi.mocked(MemoryService.Storage.deleteAllUserMemories).mockResolvedValue()

      const requestBody = { action: 'delete_all' }
      const request = new NextRequest('http://localhost:3000/api/memories/export', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('Successfully deleted all 2 memory fragments')
      expect(data.deletedCount).toBe(2)
      expect(MemoryService.Storage.deleteAllUserMemories).toHaveBeenCalledWith('test-user-id')
    })

    it('should handle case when no memories exist for delete_all', async () => {
      // Mock authentication
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      // Mock empty stats
      vi.mocked(MemoryService.Retrieval.getMemoryStats).mockResolvedValue({
        totalFragments: 0
      })

      const requestBody = { action: 'delete_all' }
      const request = new NextRequest('http://localhost:3000/api/memories/export', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('No memories to delete')
      expect(data.deletedCount).toBe(0)
    })

    it('should delete filtered memories by emotional tone', async () => {
      // Mock authentication
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      // Mock memory service
      vi.mocked(MemoryService.Retrieval.getUserMemories).mockResolvedValue(mockMemories)
      vi.mocked(MemoryService.Storage.deleteMemoryFragment).mockResolvedValue()

      const requestBody = {
        action: 'delete_filtered',
        filters: {
          emotionalTone: 'positive'
        }
      }
      const request = new NextRequest('http://localhost:3000/api/memories/export', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('Successfully deleted 1 of 1 filtered memory fragments')
      expect(data.deletedCount).toBe(1)
      expect(data.totalFiltered).toBe(1)
      expect(MemoryService.Storage.deleteMemoryFragment).toHaveBeenCalledWith('memory-1', 'test-user-id')
    })

    it('should delete filtered memories by date range', async () => {
      // Mock authentication
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      // Mock memory service
      vi.mocked(MemoryService.Retrieval.getUserMemories).mockResolvedValue(mockMemories)
      vi.mocked(MemoryService.Storage.deleteMemoryFragment).mockResolvedValue()

      const requestBody = {
        action: 'delete_filtered',
        filters: {
          dateRange: {
            start: '2024-01-01T00:00:00.000Z',
            end: '2024-01-01T23:59:59.999Z'
          }
        }
      }
      const request = new NextRequest('http://localhost:3000/api/memories/export', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.deletedCount).toBe(1)
      expect(MemoryService.Storage.deleteMemoryFragment).toHaveBeenCalledWith('memory-1', 'test-user-id')
    })

    it('should delete filtered memories by text content', async () => {
      // Mock authentication
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      // Mock memory service
      vi.mocked(MemoryService.Retrieval.getUserMemories).mockResolvedValue(mockMemories)
      vi.mocked(MemoryService.Storage.deleteMemoryFragment).mockResolvedValue()

      const requestBody = {
        action: 'delete_filtered',
        filters: {
          textContains: 'First'
        }
      }
      const request = new NextRequest('http://localhost:3000/api/memories/export', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.deletedCount).toBe(1)
      expect(MemoryService.Storage.deleteMemoryFragment).toHaveBeenCalledWith('memory-1', 'test-user-id')
    })

    it('should return 401 for unauthenticated user', async () => {
      // Mock authentication failure
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated')
      })

      const requestBody = { action: 'delete_all' }
      const request = new NextRequest('http://localhost:3000/api/memories/export', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized. Please log in to perform bulk operations.')
    })

    it('should validate action parameter', async () => {
      // Mock authentication
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      const requestBody = { action: 'invalid_action' }
      const request = new NextRequest('http://localhost:3000/api/memories/export', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Action must be either "delete_all" or "delete_filtered"')
    })

    it('should validate filters for delete_filtered', async () => {
      // Mock authentication
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      const requestBody = { action: 'delete_filtered' }
      const request = new NextRequest('http://localhost:3000/api/memories/export', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Filters are required for filtered deletion')
    })

    it('should handle case when no memories match filters', async () => {
      // Mock authentication
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      // Mock memory service
      vi.mocked(MemoryService.Retrieval.getUserMemories).mockResolvedValue(mockMemories)

      const requestBody = {
        action: 'delete_filtered',
        filters: {
          emotionalTone: 'nonexistent'
        }
      }
      const request = new NextRequest('http://localhost:3000/api/memories/export', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('No memories match the specified filters')
      expect(data.deletedCount).toBe(0)
    })

    it('should handle partial deletion failures gracefully', async () => {
      // Mock authentication
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      // Mock memory service
      vi.mocked(MemoryService.Retrieval.getUserMemories).mockResolvedValue(mockMemories)
      vi.mocked(MemoryService.Storage.deleteMemoryFragment)
        .mockResolvedValueOnce() // First deletion succeeds
        .mockRejectedValueOnce(new Error('Delete failed')) // Second deletion fails

      const requestBody = {
        action: 'delete_filtered',
        filters: {
          textContains: 'memory'
        }
      }
      const request = new NextRequest('http://localhost:3000/api/memories/export', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('Successfully deleted 1 of 2 filtered memory fragments')
      expect(data.deletedCount).toBe(1)
      expect(data.totalFiltered).toBe(2)
    })

    it('should handle service errors gracefully', async () => {
      // Mock authentication
      vi.mocked(mockSupabaseClient.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      // Mock service error
      vi.mocked(MemoryService.Retrieval.getMemoryStats).mockRejectedValue(new Error('Database error'))

      const requestBody = { action: 'delete_all' }
      const request = new NextRequest('http://localhost:3000/api/memories/export', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to perform bulk operation. Please try again.')
    })
  })
})