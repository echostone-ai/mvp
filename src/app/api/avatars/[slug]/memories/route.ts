/**
 * Avatar-specific Memory Management API
 * 
 * Enhanced memory addition endpoint with fact extraction integration
 * Requirements: 3.2, 3.5, 6.2, 9.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { MemoryService } from '@/lib/memoryService';
import { ensureServicesInitialized } from '@/lib/startup';

export const runtime = 'nodejs';

// Initialize Supabase client with service role
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Validation schema for memory addition
const addMemoriesSchema = z.object({
  fragments: z.array(z.string().min(1, 'Fragment text cannot be empty')).min(1, 'At least one fragment is required'),
  user_id: z.string().optional().default('demo'),
  context: z.object({
    source: z.string().optional(),
    timestamp: z.string().optional(),
    metadata: z.record(z.any()).optional()
  }).optional()
});

/**
 * Add memories to a specific avatar with fact promotion integration
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const startTime = Date.now();
  
  try {
    // Ensure background services are initialized for fact promotion
    await ensureServicesInitialized();

    const { slug } = params;
    const body = await request.json();

    console.log('[POST /api/avatars/:slug/memories] Adding memories to avatar:', slug, {
      fragments_count: body.fragments?.length || 0,
      user_id: body.user_id || 'demo'
    });

    // Validate request body
    const validationResult = addMemoriesSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({
        error: 'Invalid request data',
        details: validationResult.error.errors
      }, { status: 400 });
    }

    const { fragments, user_id, context } = validationResult.data;

    // Find avatar by slug
    const { data: avatarData, error: avatarError } = await supabase
      .from('avatar_profiles')
      .select('id, name')
      .eq('name', slug)
      .single();

    if (avatarError || !avatarData) {
      console.error('[POST /api/avatars/:slug/memories] Avatar not found:', slug, avatarError);
      return NextResponse.json({
        error: 'Avatar not found',
        details: `No avatar found with slug: ${slug}`
      }, { status: 404 });
    }

    const avatarId = avatarData.id;
    const results = {
      fragments_added: 0,
      facts_extracted: 0,
      facts_updated: 0,
      processing_statistics: {
        successful_fragments: 0,
        failed_fragments: 0,
        total_processing_time_ms: 0,
        average_processing_time_per_fragment: 0
      },
      errors: [] as string[]
    };

    // Process each fragment
    console.log('[POST /api/avatars/:slug/memories] Processing', fragments.length, 'fragments...');
    
    const fragmentPromises = fragments.map(async (fragmentText, index) => {
      const fragmentStartTime = Date.now();
      
      try {
        // Create conversation context for the fragment
        const conversationContext = {
          source: context?.source || 'manual',
          timestamp: new Date().toISOString(),
          messageContext: context?.source || 'Memory addition via API',
          emotionalTone: 'neutral',
          avatarId: avatarId,
          fragmentIndex: index,
          ...context?.metadata
        };

        // Store the memory fragment using MemoryService
        // This will automatically trigger fact promotion via database trigger
        const memoryFragments = await MemoryService.processAndStoreMemories(
          fragmentText,
          user_id,
          conversationContext,
          0.5, // Lower threshold for more comprehensive extraction
          avatarId
        );

        const fragmentProcessingTime = Date.now() - fragmentStartTime;

        if (memoryFragments.length > 0) {
          results.fragments_added += memoryFragments.length;
          results.processing_statistics.successful_fragments++;
          
          console.log(`[POST /api/avatars/:slug/memories] Fragment ${index + 1} processed successfully:`, {
            original_fragment: fragmentText.substring(0, 50) + '...',
            extracted_fragments: memoryFragments.length,
            processing_time_ms: fragmentProcessingTime
          });
        } else {
          results.processing_statistics.failed_fragments++;
          results.errors.push(`Fragment ${index + 1}: No memory fragments extracted`);
        }

        results.processing_statistics.total_processing_time_ms += fragmentProcessingTime;

        return {
          success: true,
          fragments_created: memoryFragments.length,
          processing_time_ms: fragmentProcessingTime
        };

      } catch (fragmentError) {
        const fragmentProcessingTime = Date.now() - fragmentStartTime;
        results.processing_statistics.failed_fragments++;
        results.processing_statistics.total_processing_time_ms += fragmentProcessingTime;
        
        const errorMessage = `Fragment ${index + 1} failed: ${fragmentError instanceof Error ? fragmentError.message : 'Unknown error'}`;
        results.errors.push(errorMessage);
        
        console.error('[POST /api/avatars/:slug/memories] Fragment processing failed:', {
          fragment_index: index,
          fragment_text: fragmentText.substring(0, 50) + '...',
          error: errorMessage,
          processing_time_ms: fragmentProcessingTime
        });

        return {
          success: false,
          fragments_created: 0,
          processing_time_ms: fragmentProcessingTime,
          error: errorMessage
        };
      }
    });

    // Wait for all fragments to be processed
    const fragmentResults = await Promise.allSettled(fragmentPromises);
    
    // Calculate processing statistics
    const totalProcessingTime = Date.now() - startTime;
    results.processing_statistics.average_processing_time_per_fragment = 
      results.processing_statistics.successful_fragments > 0 
        ? results.processing_statistics.total_processing_time_ms / results.processing_statistics.successful_fragments
        : 0;

    // Note: Fact promotion happens asynchronously via database triggers
    // We don't wait for it here to maintain API responsiveness
    // The background processor will handle fact extraction and promotion

    console.log('[POST /api/avatars/:slug/memories] Memory addition completed:', {
      avatar_slug: slug,
      avatar_id: avatarId,
      fragments_requested: fragments.length,
      fragments_added: results.fragments_added,
      successful_fragments: results.processing_statistics.successful_fragments,
      failed_fragments: results.processing_statistics.failed_fragments,
      total_processing_time_ms: totalProcessingTime,
      errors_count: results.errors.length
    });

    // Return processing results
    const response = {
      avatar: {
        id: avatarId,
        slug: slug
      },
      processing_results: {
        fragments_added: results.fragments_added,
        facts_extracted: 0, // Will be processed asynchronously by background service
        facts_updated: 0,   // Will be processed asynchronously by background service
        processing_time_ms: totalProcessingTime,
        processing_statistics: results.processing_statistics,
        errors: results.errors,
        notes: [
          'Fact extraction and promotion will be processed asynchronously',
          'Check fact promotion status via /api/fact-promotion?action=status',
          'Facts will be available in quick_facts table within 200ms of processing'
        ]
      }
    };

    // Return appropriate status code based on results
    const hasErrors = results.errors.length > 0;
    const hasSuccesses = results.processing_statistics.successful_fragments > 0;
    
    if (hasSuccesses && !hasErrors) {
      return NextResponse.json(response, { status: 201 });
    } else if (hasSuccesses && hasErrors) {
      return NextResponse.json(response, { status: 207 }); // Partial success
    } else {
      return NextResponse.json({
        ...response,
        error: 'All fragments failed to process'
      }, { status: 400 });
    }

  } catch (error) {
    const totalProcessingTime = Date.now() - startTime;
    console.error('[POST /api/avatars/:slug/memories] Memory addition failed:', error);
    
    return NextResponse.json({
      error: 'Failed to add memories',
      details: error instanceof Error ? error.message : 'Unknown error',
      processing_time_ms: totalProcessingTime
    }, { status: 500 });
  }
}

/**
 * Get memories for a specific avatar
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId') || 'demo';
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    console.log('[GET /api/avatars/:slug/memories] Fetching memories for avatar:', slug, {
      userId,
      limit,
      offset
    });

    // Find avatar by slug
    const { data: avatarData, error: avatarError } = await supabase
      .from('avatar_profiles')
      .select('id, name')
      .eq('name', slug)
      .single();

    if (avatarError || !avatarData) {
      return NextResponse.json({
        error: 'Avatar not found',
        details: `No avatar found with slug: ${slug}`
      }, { status: 404 });
    }

    // Get memories for this avatar
    const memories = await MemoryService.Retrieval.getUserMemories(userId, {
      limit,
      offset,
      orderBy: 'created_at',
      orderDirection: 'desc',
      avatarId: avatarData.id
    });

    // Get memory statistics
    const stats = await MemoryService.Retrieval.getMemoryStats(userId, avatarData.id);

    console.log('[GET /api/avatars/:slug/memories] Retrieved memories:', {
      avatar_slug: slug,
      memories_count: memories.length,
      total_fragments: stats.totalFragments
    });

    return NextResponse.json({
      avatar: {
        id: avatarData.id,
        slug: avatarData.name
      },
      memories: memories.map(memory => ({
        id: memory.id,
        fragment_text: memory.fragmentText,
        conversation_context: memory.conversationContext,
        created_at: memory.createdAt,
        updated_at: memory.updatedAt
      })),
      pagination: {
        limit,
        offset,
        total: stats.totalFragments
      },
      statistics: stats
    });

  } catch (error) {
    console.error('[GET /api/avatars/:slug/memories] Failed to fetch memories:', error);
    
    return NextResponse.json({
      error: 'Failed to fetch memories',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}