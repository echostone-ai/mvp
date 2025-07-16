import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { MemoryService } from '@/lib/memoryService'

export const runtime = 'edge'

/**
 * GET /api/memories/export - Export user's memory data
 * Query parameters:
 * - format: 'json' | 'csv' (default: 'json')
 * - includeEmbeddings: 'true' | 'false' (default: 'false')
 */
export async function GET(request: NextRequest) {
  try {
    // Initialize Supabase client with cookies for authentication
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to export your memories.' },
        { status: 401 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const format = (searchParams.get('format') as 'json' | 'csv') || 'json'
    const includeEmbeddings = searchParams.get('includeEmbeddings') === 'true'

    // Validate format parameter
    if (!['json', 'csv'].includes(format)) {
      return NextResponse.json(
        { error: 'Format must be either "json" or "csv"' },
        { status: 400 }
      )
    }

    // Get all user memories (no pagination for export)
    const memories = await MemoryService.Retrieval.getUserMemories(user.id, {
      limit: 0, // No limit for export
      orderBy: 'created_at',
      orderDirection: 'asc'
    })

    // Get memory statistics
    const stats = await MemoryService.Retrieval.getMemoryStats(user.id)

    // Prepare export data
    const exportData = {
      exportInfo: {
        userId: user.id,
        exportDate: new Date().toISOString(),
        totalMemories: memories.length,
        format,
        includeEmbeddings
      },
      stats,
      memories: memories.map(memory => {
        const exportMemory: any = {
          id: memory.id,
          fragmentText: memory.fragmentText,
          conversationContext: memory.conversationContext,
          createdAt: memory.createdAt,
          updatedAt: memory.updatedAt
        }

        // Include embeddings if requested
        if (includeEmbeddings && memory.embedding) {
          exportMemory.embedding = memory.embedding
        }

        return exportMemory
      })
    }

    if (format === 'json') {
      // Return JSON format
      const response = NextResponse.json(exportData)
      response.headers.set('Content-Disposition', `attachment; filename="memories-export-${new Date().toISOString().split('T')[0]}.json"`)
      return response
    } else {
      // Return CSV format
      const csvContent = convertToCSV(exportData.memories, includeEmbeddings)
      
      const response = new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="memories-export-${new Date().toISOString().split('T')[0]}.csv"`
        }
      })
      
      return response
    }

  } catch (error) {
    console.error('Error exporting memories:', error)
    return NextResponse.json(
      { error: 'Failed to export memories. Please try again.' },
      { status: 500 }
    )
  }
}

/**
 * Convert memory data to CSV format
 */
function convertToCSV(memories: any[], includeEmbeddings: boolean): string {
  if (memories.length === 0) {
    return 'No memories to export'
  }

  // Define CSV headers
  const headers = [
    'ID',
    'Fragment Text',
    'Created At',
    'Updated At',
    'Conversation Timestamp',
    'Message Context',
    'Emotional Tone'
  ]

  if (includeEmbeddings) {
    headers.push('Embedding (JSON)')
  }

  // Create CSV rows
  const rows = memories.map(memory => {
    const row = [
      memory.id || '',
      `"${(memory.fragmentText || '').replace(/"/g, '""')}"`, // Escape quotes
      memory.createdAt || '',
      memory.updatedAt || '',
      memory.conversationContext?.timestamp || '',
      `"${(memory.conversationContext?.messageContext || '').replace(/"/g, '""')}"`,
      memory.conversationContext?.emotionalTone || ''
    ]

    if (includeEmbeddings) {
      row.push(memory.embedding ? `"${JSON.stringify(memory.embedding).replace(/"/g, '""')}"` : '')
    }

    return row.join(',')
  })

  // Combine headers and rows
  return [headers.join(','), ...rows].join('\n')
}

/**
 * POST /api/memories/export - Bulk delete memories with optional filtering
 * Body: { 
 *   action: 'delete_all' | 'delete_filtered',
 *   filters?: {
 *     dateRange?: { start: string, end: string },
 *     emotionalTone?: string,
 *     textContains?: string
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Initialize Supabase client with cookies for authentication
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to perform bulk operations.' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { action, filters } = body

    // Validate action
    if (!action || !['delete_all', 'delete_filtered'].includes(action)) {
      return NextResponse.json(
        { error: 'Action must be either "delete_all" or "delete_filtered"' },
        { status: 400 }
      )
    }

    if (action === 'delete_all') {
      // Get current memory count for confirmation
      const stats = await MemoryService.Retrieval.getMemoryStats(user.id)
      
      if (stats.totalFragments === 0) {
        return NextResponse.json({
          message: 'No memories to delete',
          deletedCount: 0
        })
      }

      // Delete all user memories
      await MemoryService.Storage.deleteAllUserMemories(user.id)

      return NextResponse.json({
        message: `Successfully deleted all ${stats.totalFragments} memory fragments`,
        deletedCount: stats.totalFragments
      })

    } else if (action === 'delete_filtered') {
      // Validate filters
      if (!filters || typeof filters !== 'object') {
        return NextResponse.json(
          { error: 'Filters are required for filtered deletion' },
          { status: 400 }
        )
      }

      // Get all memories to filter
      const allMemories = await MemoryService.Retrieval.getUserMemories(user.id, {
        limit: 0, // No limit
        orderBy: 'created_at',
        orderDirection: 'asc'
      })

      // Apply filters
      let filteredMemories = allMemories

      // Date range filter
      if (filters.dateRange) {
        const { start, end } = filters.dateRange
        if (start || end) {
          filteredMemories = filteredMemories.filter(memory => {
            const createdAt = new Date(memory.createdAt!)
            const startDate = start ? new Date(start) : new Date(0)
            const endDate = end ? new Date(end) : new Date()
            return createdAt >= startDate && createdAt <= endDate
          })
        }
      }

      // Emotional tone filter
      if (filters.emotionalTone) {
        filteredMemories = filteredMemories.filter(memory => 
          memory.conversationContext?.emotionalTone === filters.emotionalTone
        )
      }

      // Text contains filter
      if (filters.textContains) {
        const searchText = filters.textContains.toLowerCase()
        filteredMemories = filteredMemories.filter(memory =>
          memory.fragmentText.toLowerCase().includes(searchText)
        )
      }

      if (filteredMemories.length === 0) {
        return NextResponse.json({
          message: 'No memories match the specified filters',
          deletedCount: 0
        })
      }

      // Delete filtered memories
      let deletedCount = 0
      for (const memory of filteredMemories) {
        try {
          await MemoryService.Storage.deleteMemoryFragment(memory.id!, user.id)
          deletedCount++
        } catch (error) {
          console.error(`Failed to delete memory ${memory.id}:`, error)
          // Continue with other deletions
        }
      }

      return NextResponse.json({
        message: `Successfully deleted ${deletedCount} of ${filteredMemories.length} filtered memory fragments`,
        deletedCount,
        totalFiltered: filteredMemories.length
      })
    }

  } catch (error) {
    console.error('Error performing bulk operation:', error)
    return NextResponse.json(
      { error: 'Failed to perform bulk operation. Please try again.' },
      { status: 500 }
    )
  }
}