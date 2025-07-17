import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { MemoryService } from '@/lib/memoryService'

// Temporarily disable edge runtime to fix auth issues
// export const runtime = 'edge'

/**
 * GET /api/memories - Retrieve user's memory fragments
 * Query parameters:
 * - limit: number of memories to return (default: 100)
 * - offset: pagination offset (default: 0)
 * - orderBy: 'created_at' | 'updated_at' (default: 'created_at')
 * - orderDirection: 'asc' | 'desc' (default: 'desc')
 * - search: text search query (optional)
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
        { error: 'Unauthorized. Please log in to access your memories.' },
        { status: 401 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')
    const orderBy = (searchParams.get('orderBy') as 'created_at' | 'updated_at') || 'created_at'
    const orderDirection = (searchParams.get('orderDirection') as 'asc' | 'desc') || 'desc'
    const searchQuery = searchParams.get('search')

    // Validate parameters
    if (limit < 1 || limit > 1000) {
      return NextResponse.json(
        { error: 'Limit must be between 1 and 1000' },
        { status: 400 }
      )
    }

    if (offset < 0) {
      return NextResponse.json(
        { error: 'Offset must be non-negative' },
        { status: 400 }
      )
    }

    let memories
    
    if (searchQuery) {
      // Use text search if search query provided
      memories = await MemoryService.Retrieval.searchMemoriesByText(
        searchQuery,
        user.id,
        limit
      )
    } else {
      // Get user memories with pagination
      memories = await MemoryService.Retrieval.getUserMemories(user.id, {
        limit,
        offset,
        orderBy,
        orderDirection
      })
    }

    // Get memory statistics
    const stats = await MemoryService.Retrieval.getMemoryStats(user.id)

    return NextResponse.json({
      memories,
      stats,
      pagination: {
        limit,
        offset,
        total: stats.totalFragments
      }
    })

  } catch (error) {
    console.error('Error retrieving memories:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve memories. Please try again.' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/memories - Create a new memory fragment
 * Body: { fragmentText: string, conversationContext?: object }
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
        { error: 'Unauthorized. Please log in to create memories.' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { fragmentText, conversationContext } = body

    // Validate input
    if (!fragmentText || typeof fragmentText !== 'string') {
      return NextResponse.json(
        { error: 'fragmentText is required and must be a string' },
        { status: 400 }
      )
    }

    if (fragmentText.trim().length === 0) {
      return NextResponse.json(
        { error: 'fragmentText cannot be empty' },
        { status: 400 }
      )
    }

    if (fragmentText.length > 2000) {
      return NextResponse.json(
        { error: 'fragmentText cannot exceed 2000 characters' },
        { status: 400 }
      )
    }

    // Validate conversationContext if provided
    if (conversationContext && typeof conversationContext !== 'object') {
      return NextResponse.json(
        { error: 'conversationContext must be an object' },
        { status: 400 }
      )
    }

    // Create memory fragment
    const memoryFragment = {
      userId: user.id,
      fragmentText: fragmentText.trim(),
      conversationContext: conversationContext || {
        timestamp: new Date().toISOString(),
        messageContext: 'Manual entry',
        emotionalTone: 'neutral'
      }
    }

    // Store the memory fragment
    const fragmentId = await MemoryService.Storage.storeMemoryFragment(memoryFragment)

    // Return the created fragment with its ID
    const createdFragment = {
      ...memoryFragment,
      id: fragmentId,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    return NextResponse.json({
      memory: createdFragment,
      message: 'Memory fragment created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating memory:', error)
    return NextResponse.json(
      { error: 'Failed to create memory. Please try again.' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/memories - Delete all user memories
 */
export async function DELETE(request: NextRequest) {
  try {
    // Initialize Supabase client with cookies for authentication
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to delete memories.' },
        { status: 401 }
      )
    }

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

  } catch (error) {
    console.error('Error deleting all memories:', error)
    return NextResponse.json(
      { error: 'Failed to delete memories. Please try again.' },
      { status: 500 }
    )
  }
}