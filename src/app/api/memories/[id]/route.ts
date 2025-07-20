import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { MemoryService } from '@/lib/memoryService'

export const runtime = 'edge'

/**
 * GET /api/memories/[id] - Get a specific memory fragment by ID
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
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

    const { id } = await params

    // Validate ID format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid memory ID format' },
        { status: 400 }
      )
    }

    // Get the memory fragment
    const memory = await MemoryService.Retrieval.getMemoryFragment(id, user.id)

    if (!memory) {
      return NextResponse.json(
        { error: 'Memory fragment not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ memory })

  } catch (error) {
    console.error('Error retrieving memory:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve memory. Please try again.' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/memories/[id] - Update a specific memory fragment
 * Body: { fragmentText?: string, conversationContext?: object }
 */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Initialize Supabase client with cookies for authentication
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to update your memories.' },
        { status: 401 }
      )
    }

    const { id } = await params

    // Validate ID format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid memory ID format' },
        { status: 400 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { fragmentText, conversationContext } = body

    // Validate that at least one field is being updated
    if (!fragmentText && !conversationContext) {
      return NextResponse.json(
        { error: 'At least one field (fragmentText or conversationContext) must be provided' },
        { status: 400 }
      )
    }

    // Validate fragmentText if provided
    if (fragmentText !== undefined) {
      if (typeof fragmentText !== 'string') {
        return NextResponse.json(
          { error: 'fragmentText must be a string' },
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
    }

    // Validate conversationContext if provided
    if (conversationContext !== undefined && typeof conversationContext !== 'object') {
      return NextResponse.json(
        { error: 'conversationContext must be an object' },
        { status: 400 }
      )
    }

    // Check if memory exists and belongs to user
    const existingMemory = await MemoryService.Retrieval.getMemoryFragment(id, user.id)
    if (!existingMemory) {
      return NextResponse.json(
        { error: 'Memory fragment not found' },
        { status: 404 }
      )
    }

    // Prepare updates
    const updates: any = {}
    if (fragmentText !== undefined) {
      updates.fragmentText = fragmentText.trim()
    }
    if (conversationContext !== undefined) {
      updates.conversationContext = conversationContext
    }

    // Update the memory fragment
    await MemoryService.Storage.updateMemoryFragment(id, user.id, updates)

    // Get the updated memory fragment
    const updatedMemory = await MemoryService.Retrieval.getMemoryFragment(id, user.id)

    return NextResponse.json({
      memory: updatedMemory,
      message: 'Memory fragment updated successfully'
    })

  } catch (error) {
    console.error('Error updating memory:', error)
    return NextResponse.json(
      { error: 'Failed to update memory. Please try again.' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/memories/[id] - Delete a specific memory fragment
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Initialize Supabase client with cookies for authentication
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to delete your memories.' },
        { status: 401 }
      )
    }

    const { id } = await params

    // Validate ID format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid memory ID format' },
        { status: 400 }
      )
    }

    // Check if memory exists and belongs to user
    const existingMemory = await MemoryService.Retrieval.getMemoryFragment(id, user.id)
    if (!existingMemory) {
      return NextResponse.json(
        { error: 'Memory fragment not found' },
        { status: 404 }
      )
    }

    // Delete the memory fragment
    await MemoryService.Storage.deleteMemoryFragment(id, user.id)

    return NextResponse.json({
      message: 'Memory fragment deleted successfully',
      deletedMemory: {
        id: existingMemory.id,
        fragmentText: existingMemory.fragmentText
      }
    })

  } catch (error) {
    console.error('Error deleting memory:', error)
    return NextResponse.json(
      { error: 'Failed to delete memory. Please try again.' },
      { status: 500 }
    )
  }
}