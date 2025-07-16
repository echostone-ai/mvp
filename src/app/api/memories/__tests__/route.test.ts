// src/app/api/memories/__tests__/route.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GET, POST, DELETE } from '../route'
import { NextRequest } from 'next/server'

// Mock the memory service
const mockMemoryService = {
  Retrieval: {
    getUserMemories: vi.fn(),
    getMemoryStats: vi.fn()
  },
  Storage: {
    deleteAllUserMemories: vi.fn()
  }
}

vi.mock('../../../lib/memoryService', () => ({
  MemoryService: mockMemoryService
}))

// Mock Supabase
const mockSupabase = {
  auth: {
    getUser: vi.fn()
  }
}

vi.mock('../../../lib/supabase', () => ({
  supabase: mockSupabase
}))

describe('Memory Management API Integration Tests', () => {
  const testUserId = 'test-user-123'
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Default auth mock
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: testUserId } },
      error: null
    })
  })

  describe('GET /api/memories - Retrieve User Memories', () => {
    it('should retrieve user memories with default pagination', async () => {
      const mockMemories = [
        {
          id: 'mem-1',
          userId: testUserId,
          fragmentText: 'User loves hiking',
          conversationContext: {
            timestamp: '2024-01-15T10:00:00Z',
            emotionalTone: 'positive'
          },
          createdAt: new Date('2024-01-15T10:00:00Z'),
          updatedAt: new Date('2024-01-15T10:00:00Z')
        },
        {
          id: 'mem-2',
          userId: testUserId,
          fragmentText: 'User has a dog named Max',
          conversationContext: {
            timestamp: '2024-01-16T14:30:00Z',
            emotionalTone: 'positive'
          },
          createdAt: new Date('2024-01-16T14:30:00Z'),
          updatedAt: new Date('2024-01-16T14:30:00Z')
        }
      ]
      
      mockMemoryService.Retrieval.getUserMemories.mockResolvedValueOnce(mockMemories)
      mockMemoryService.Retrieval.getMemoryStats.mockResolvedValueOnce({
        totalFragments: 2,
        oldestMemory: new Date('2024-01-15T10:00:00Z'),
        newestMemory: new Date('2024-01-16T14:30:00Z')
      })
      
      const request = new NextRequest('http://localhost:3000/api/memories', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-token'
        }
      })
      
      const response = await GET(request)
      const responseData = await response.json()
      
      expect(response.status).toBe(200)
      expect(responseData.memories).toHaveLength(2)
      expect(responseData.memories[0].fragmentText).toBe('User loves hiking')
      expect(responseData.stats.totalFragments).toBe(2)
      
      // Verify service was called with default parameters
      expect(mockMemoryService.Retrieval.getUserMemories).toHaveBeenCalledWith(
        testUserId,
        {
          limit: 100,
          offset: 0,
          orderBy: 'created_at',
          orderDirection: 'desc'
        }
      )
    })

    it('should handle pagination parameters correctly', async () => {
      const mockMemories = [
        {
          id: 'mem-3',
          userId: testUserId,
          fragmentText: 'User enjoys photography',
          createdAt: new Date('2024-01-17T09:00:00Z'),
          updatedAt: new Date('2024-01-17T09:00:00Z')
        }
      ]
      
      mockMemoryService.Retrieval.getUserMemories.mockResolvedValueOnce(mockMemories)
      mockMemoryService.Retrieval.getMemoryStats.mockResolvedValueOnce({
        totalFragments: 1,
        oldestMemory: new Date('2024-01-17T09:00:00Z'),
        newestMemory: new Date('2024-01-17T09:00:00Z')
      })
      
      const request = new NextRequest('http://localhost:3000/api/memories?limit=50&offset=10&orderBy=updated_at&orderDirection=asc', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-token'
        }
      })
      
      const response = await GET(request)
      const responseData = await response.json()
      
      expect(response.status).toBe(200)
      expect(responseData.memories).toHaveLength(1)
      
      // Verify service was called with custom parameters
      expect(mockMemoryService.Retrieval.getUserMemories).toHaveBeenCalledWith(
        testUserId,
        {
          limit: 50,
          offset: 10,
          orderBy: 'updated_at',
          orderDirection: 'asc'
        }
      )
    })

    it('should handle authentication errors', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Invalid token' }
      })
      
      const request = new NextRequest('http://localhost:3000/api/memories', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      })
      
      const response = await GET(request)
      const responseData = await response.json()
      
      expect(response.status).toBe(401)
      expect(responseData.error).toBe('Unauthorized')
    })

    it('should handle memory service errors gracefully', async () => {
      mockMemoryService.Retrieval.getUserMemories.mockRejectedValueOnce(
        new Error('Database connection failed')
      )
      
      const request = new NextRequest('http://localhost:3000/api/memories', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-token'
        }
      })
      
      const response = await GET(request)
      const responseData = await response.json()
      
      expect(response.status).toBe(500)
      expect(responseData.error).toBe('Failed to retrieve memories')
    })
  })

  describe('POST /api/memories - Export User Memories', () => {
    it('should export user memories in JSON format', async () => {
      const mockMemories = [
        {
          id: 'export-1',
          userId: testUserId,
          fragmentText: 'User loves traveling',
          conversationContext: {
            timestamp: '2024-01-18T12:00:00Z',
            emotionalTone: 'positive'
          },
          createdAt: new Date('2024-01-18T12:00:00Z'),
          updatedAt: new Date('2024-01-18T12:00:00Z')
        }
      ]
      
      mockMemoryService.Retrieval.getUserMemories.mockResolvedValueOnce(mockMemories)
      
      const request = new NextRequest('http://localhost:3000/api/memories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          action: 'export',
          format: 'json'
        })
      })
      
      const response = await POST(request)
      const responseData = await response.json()
      
      expect(response.status).toBe(200)
      expect(responseData.format).toBe('json')
      expect(responseData.data).toHaveLength(1)
      expect(responseData.data[0].fragmentText).toBe('User loves traveling')
      expect(responseData.exportedAt).toBeDefined()
      expect(responseData.totalMemories).toBe(1)
    })

    it('should export user memories in CSV format', async () => {
      const mockMemories = [
        {
          id: 'csv-1',
          userId: testUserId,
          fragmentText: 'User enjoys cooking',
          conversationContext: {
            timestamp: '2024-01-19T15:30:00Z',
            emotionalTone: 'positive'
          },
          createdAt: new Date('2024-01-19T15:30:00Z'),
          updatedAt: new Date('2024-01-19T15:30:00Z')
        },
        {
          id: 'csv-2',
          userId: testUserId,
          fragmentText: 'User has Italian heritage',
          conversationContext: {
            timestamp: '2024-01-19T16:00:00Z',
            emotionalTone: 'neutral'
          },
          createdAt: new Date('2024-01-19T16:00:00Z'),
          updatedAt: new Date('2024-01-19T16:00:00Z')
        }
      ]
      
      mockMemoryService.Retrieval.getUserMemories.mockResolvedValueOnce(mockMemories)
      
      const request = new NextRequest('http://localhost:3000/api/memories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          action: 'export',
          format: 'csv'
        })
      })
      
      const response = await POST(request)
      const responseText = await response.text()
      
      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('text/csv')
      expect(response.headers.get('Content-Disposition')).toContain('attachment')
      
      // Verify CSV format
      const lines = responseText.split('\n')
      expect(lines[0]).toBe('ID,Fragment Text,Created At,Updated At,Emotional Tone')
      expect(lines[1]).toContain('User enjoys cooking')
      expect(lines[2]).toContain('User has Italian heritage')
    })

    it('should handle invalid export format', async () => {
      const request = new NextRequest('http://localhost:3000/api/memories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          action: 'export',
          format: 'xml' // Invalid format
        })
      })
      
      const response = await POST(request)
      const responseData = await response.json()
      
      expect(response.status).toBe(400)
      expect(responseData.error).toBe('Invalid export format. Supported formats: json, csv')
    })
  })

  describe('DELETE /api/memories - Clear All User Memories', () => {
    it('should clear all user memories successfully', async () => {
      mockMemoryService.Storage.deleteAllUserMemories.mockResolvedValueOnce(undefined)
      
      const request = new NextRequest('http://localhost:3000/api/memories', {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer test-token'
        }
      })
      
      const response = await DELETE(request)
      const responseData = await response.json()
      
      expect(response.status).toBe(200)
      expect(responseData.message).toBe('All memories cleared successfully')
      expect(responseData.clearedAt).toBeDefined()
      
      // Verify service was called
      expect(mockMemoryService.Storage.deleteAllUserMemories).toHaveBeenCalledWith(testUserId)
    })

    it('should handle deletion errors', async () => {
      mockMemoryService.Storage.deleteAllUserMemories.mockRejectedValueOnce(
        new Error('Database deletion failed')
      )
      
      const request = new NextRequest('http://localhost:3000/api/memories', {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer test-token'
        }
      })
      
      const response = await DELETE(request)
      const responseData = await response.json()
      
      expect(response.status).toBe(500)
      expect(responseData.error).toBe('Failed to clear memories')
    })

    it('should require authentication for deletion', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'No token provided' }
      })
      
      const request = new NextRequest('http://localhost:3000/api/memories', {
        method: 'DELETE'
      })
      
      const response = await DELETE(request)
      const responseData = await response.json()
      
      expect(response.status).toBe(401)
      expect(responseData.error).toBe('Unauthorized')
    })
  })

  describe('Memory Privacy and Security', () => {
    it('should prevent cross-user memory access', async () => {
      const otherUserId = 'other-user-456'
      
      // Mock memories for different user
      const otherUserMemories = [
        {
          id: 'other-mem-1',
          userId: otherUserId,
          fragmentText: 'Other user private information',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
      
      // Ensure service only returns memories for authenticated user
      mockMemoryService.Retrieval.getUserMemories.mockImplementation((userId) => {
        if (userId === testUserId) {
          return Promise.resolve([])
        }
        return Promise.resolve(otherUserMemories)
      })
      
      const request = new NextRequest('http://localhost:3000/api/memories', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-token'
        }
      })
      
      const response = await GET(request)
      const responseData = await response.json()
      
      expect(response.status).toBe(200)
      expect(responseData.memories).toHaveLength(0)
      
      // Verify service was called with correct user ID
      expect(mockMemoryService.Retrieval.getUserMemories).toHaveBeenCalledWith(
        testUserId,
        expect.any(Object)
      )
    })

    it('should validate user ownership for memory operations', async () => {
      // Test that all operations use the authenticated user's ID
      const operations = [
        { method: 'GET', endpoint: '/api/memories' },
        { method: 'DELETE', endpoint: '/api/memories' }
      ]
      
      for (const op of operations) {
        vi.clearAllMocks()
        
        const request = new NextRequest(`http://localhost:3000${op.endpoint}`, {
          method: op.method,
          headers: {
            'Authorization': 'Bearer test-token'
          }
        })
        
        if (op.method === 'GET') {
          mockMemoryService.Retrieval.getUserMemories.mockResolvedValueOnce([])
          mockMemoryService.Retrieval.getMemoryStats.mockResolvedValueOnce({
            totalFragments: 0
          })
          await GET(request)
          expect(mockMemoryService.Retrieval.getUserMemories).toHaveBeenCalledWith(
            testUserId,
            expect.any(Object)
          )
        } else if (op.method === 'DELETE') {
          mockMemoryService.Storage.deleteAllUserMemories.mockResolvedValueOnce(undefined)
          await DELETE(request)
          expect(mockMemoryService.Storage.deleteAllUserMemories).toHaveBeenCalledWith(testUserId)
        }
      }
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle large memory collections efficiently', async () => {
      // Generate large number of mock memories
      const largeMemorySet = Array.from({ length: 1000 }, (_, i) => ({
        id: `large-mem-${i}`,
        userId: testUserId,
        fragmentText: `Memory fragment ${i}`,
        createdAt: new Date(Date.now() - i * 1000),
        updatedAt: new Date(Date.now() - i * 1000)
      }))
      
      mockMemoryService.Retrieval.getUserMemories.mockResolvedValueOnce(largeMemorySet)
      mockMemoryService.Retrieval.getMemoryStats.mockResolvedValueOnce({
        totalFragments: 1000,
        oldestMemory: new Date(Date.now() - 999000),
        newestMemory: new Date()
      })
      
      const startTime = Date.now()
      
      const request = new NextRequest('http://localhost:3000/api/memories?limit=1000', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-token'
        }
      })
      
      const response = await GET(request)
      const responseData = await response.json()
      const duration = Date.now() - startTime
      
      expect(response.status).toBe(200)
      expect(responseData.memories).toHaveLength(1000)
      expect(responseData.stats.totalFragments).toBe(1000)
      
      // Should complete within reasonable time (5 seconds)
      expect(duration).toBeLessThan(5000)
    })

    it('should handle concurrent memory operations', async () => {
      const concurrentRequests = 10
      const requests = Array.from({ length: concurrentRequests }, (_, i) => {
        mockMemoryService.Retrieval.getUserMemories.mockResolvedValue([
          {
            id: `concurrent-${i}`,
            userId: testUserId,
            fragmentText: `Concurrent memory ${i}`,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ])
        mockMemoryService.Retrieval.getMemoryStats.mockResolvedValue({
          totalFragments: 1
        })
        
        return new NextRequest('http://localhost:3000/api/memories', {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer test-token'
          }
        })
      })
      
      const startTime = Date.now()
      const responses = await Promise.all(requests.map(req => GET(req)))
      const duration = Date.now() - startTime
      
      // All requests should succeed
      expect(responses.every(res => res.status === 200)).toBe(true)
      
      // Should handle concurrent requests efficiently
      expect(duration).toBeLessThan(10000) // 10 seconds for 10 concurrent requests
    })
  })
})