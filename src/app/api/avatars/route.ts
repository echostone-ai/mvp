import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAvatars } from '@/lib/services/avatarService';
import { createClient } from '@supabase/supabase-js';
import { FactExtractionEngine } from '@/lib/services/factExtractionEngine';
import { PatternExtractor } from '@/lib/services/patternExtractor';
import { LLMExtractor } from '@/lib/services/llmExtractor';
import { MemoryService } from '@/lib/memoryService';

// Initialize Supabase client with service role for database operations
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

// Validation schema for avatar creation
const createAvatarSchema = z.object({
  slug: z.string().min(1, 'Avatar slug is required'),
  display_name: z.string().optional(),
  seed_text: z.string().optional(),
  user_id: z.string().optional().default('demo'),
  // Optional hints for onboarding capture context
  media: z.enum(['voice', 'text']).optional(),
  is_voice: z.boolean().optional().default(false)
});

/**
 * API endpoint for listing avatars
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    
    // Call the service function with the userId parameter
    return getAvatars({ userId: userId || undefined }, request);
  } catch (error) {
    console.error('Error in avatars API:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}

/**
 * Enhanced avatar creation endpoint with fact extraction
 * Requirements: 3.1, 3.2, 3.3, 3.4, 6.1, 6.4
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    console.log('[POST /api/avatars] Creating avatar with data:', { 
      slug: body.slug, 
      display_name: body.display_name,
      has_seed_text: !!body.seed_text,
      seed_text_length: body.seed_text?.length || 0
    });

    // Validate request body
    const validationResult = createAvatarSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({
        error: 'Invalid request data',
        details: validationResult.error.errors
      }, { status: 400 });
    }

    const { slug, display_name, seed_text, user_id, media, is_voice } = validationResult.data;

    // Check if avatar with this slug already exists
    const { data: existingAvatar } = await supabase
      .from('avatar_profiles')
      .select('id')
      .eq('name', slug)
      .single();

    if (existingAvatar) {
      return NextResponse.json({
        error: 'Avatar with this slug already exists'
      }, { status: 409 });
    }

    // Create avatar profile
    const { data: avatarData, error: avatarError } = await supabase
      .from('avatar_profiles')
      .insert({
        name: slug,
        description: display_name || `Avatar ${slug}`,
        profile_data: {
          display_name: display_name || slug,
          created_via_api: true,
          creation_timestamp: new Date().toISOString()
        }
      })
      .select('id, name, description, profile_data, created_at')
      .single();

    if (avatarError) {
      console.error('[POST /api/avatars] Failed to create avatar profile:', avatarError);
      return NextResponse.json({
        error: 'Failed to create avatar profile',
        details: avatarError.message
      }, { status: 500 });
    }

    const avatarId = avatarData.id;
    let onboardingFragmentId: string | null = null;
    let factExtractionResult = null;
    let memoryFragmentsResult = null;
    let extractionErrors: string[] = [];
    let seededFactsCount = 0;
    let seedingStart = Date.now();

    // Process seed text if provided
    if (seed_text && seed_text.trim().length > 0) {
      // 1) Insert a single onboarding memory_fragment row capturing the full story
      try {
        const context: any = { source: 'onboarding', type: 'story', raw: seed_text };
        const isVoiceBased = media === 'voice' || is_voice === true;
        if (isVoiceBased) context.media = 'voice';
        const { data: mf, error: mfErr } = await supabase
          .from('memory_fragments')
          .insert({
            user_id,
            avatar_id: avatarId,
            fragment_text: seed_text,
            conversation_context: context
          })
          .select('id')
          .single();
        if (!mfErr && mf?.id) {
          onboardingFragmentId = mf.id as string;
        } else if (mfErr) {
          console.warn('[POST /api/avatars] Failed to insert onboarding memory_fragment:', mfErr.message);
        }
      } catch (e: any) {
        console.warn('[POST /api/avatars] Onboarding memory_fragment insert error:', e?.message || String(e));
      }
      try {
        console.log('[POST /api/avatars] Processing seed text for fact extraction...');
        // Quick inline seeding: Pattern + single LLM call under ~1.5s total
        try {
          const extractor = new PatternExtractor();
          const patternRes = extractor.extractFacts(seed_text);
          const llm = new LLMExtractor({ temperature: 0, timeout_ms: 1200, max_tokens: 500 });
          const llmRes = await llm.refineExtraction(seed_text, patternRes.facts);
          const combined = [...patternRes.facts, ...llmRes.facts];
          // Deduplicate by key+value
          const seen = new Set<string>();
          const deduped = combined.filter(f => {
            const k = `${f.key}|${f.value}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          }).slice(0, 12);
          if (deduped.length > 0) {
            const rows = deduped.map(fact => ({
              avatar_id: avatarId,
              key: fact.key,
              value: fact.value,
              confidence: Math.min(0.95, Math.max(0.5, fact.confidence || 0.7)),
              priority: fact.key.includes('name') || fact.key.includes('birth') ? 1 : 
                       fact.key.includes('current') || fact.key.includes('family') || fact.key === 'pet' || fact.key === 'hometown' || fact.key === 'settled_location' ? 2 : 3,
              source: fact.extraction_method,
              source_reference: 'Avatar creation seed text [inline]'
            }));
            const { error: seedInsErr } = await supabase.from('quick_facts').insert(rows);
            if (!seedInsErr) {
              seededFactsCount = rows.length;
            } else {
              console.warn('[POST /api/avatars] Inline seeding insert error:', seedInsErr.message);
            }
          }
          // Enqueue original text for background refinement
          try {
            await (supabase as any).from('fact_promotion_queue').insert({
              avatar_id: avatarId,
              fragment_id: onboardingFragmentId,
              payload: { seed_text },
              status: 'pending'
            });
          } catch {}
        } catch (seedErr) {
          console.warn('[POST /api/avatars] Inline seeding failed:', seedErr);
        }

        // Initialize fact extraction engine
        const factExtractor = new FactExtractionEngine({
          enableLLMRefinement: true,
          maxProcessingTimeMs: 25000, // 25 seconds to stay under 30s limit
          minConfidenceThreshold: 0.6
        });

        // Extract facts from seed text
        factExtractionResult = await factExtractor.extractFactsWithTimeout(seed_text, 20000);
        
        console.log('[POST /api/avatars] Fact extraction completed:', {
          facts_count: factExtractionResult.facts.length,
          processing_time: factExtractionResult.processing_time_ms,
          errors_count: factExtractionResult.errors.length
        });

        // Store extracted facts in quick_facts table
        if (factExtractionResult.facts.length > 0) {
          const factsToInsert = factExtractionResult.facts.map(fact => ({
            avatar_id: avatarId,
            key: fact.key,
            value: fact.value,
            confidence: fact.confidence,
            priority: fact.key.includes('name') || fact.key.includes('birth') ? 1 : 
                     fact.key.includes('current') || fact.key.includes('family') ? 2 : 3,
            source: fact.extraction_method,
            source_reference: 'Avatar creation seed text',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }));

          const { error: factsError } = await supabase
            .from('quick_facts')
            .insert(factsToInsert);

          if (factsError) {
            console.error('[POST /api/avatars] Failed to store extracted facts:', factsError);
            extractionErrors.push(`Failed to store facts: ${factsError.message}`);
          } else {
            console.log('[POST /api/avatars] Successfully stored', factsToInsert.length, 'facts');
          }
        }

        // Split seed text into memory fragments and store them
        console.log('[POST /api/avatars] Creating memory fragments from seed text...');
        
        // Split seed text into sentences (1-3 sentence fragments as per requirements)
        const sentences = seed_text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const fragments: string[] = [];
        
        // Group sentences into 1-3 sentence fragments
        for (let i = 0; i < sentences.length; i += 2) {
          const fragment = sentences.slice(i, i + 2).join('. ').trim();
          if (fragment.length > 0) {
            fragments.push(fragment + (fragment.endsWith('.') ? '' : '.'));
          }
        }

        if (fragments.length > 0) {
          // Store memory fragments using the memory service
          const memoryFragments = await Promise.all(
            fragments.map(fragmentText => 
              MemoryService.storeSimpleMemory(user_id, fragmentText, avatarId)
            )
          );

          memoryFragmentsResult = {
            fragments_created: memoryFragments.length,
            fragment_ids: memoryFragments
          };

          console.log('[POST /api/avatars] Created', memoryFragments.length, 'memory fragments');
        }

      } catch (extractionError) {
        console.error('[POST /api/avatars] Fact extraction failed:', extractionError);
        extractionErrors.push(`Fact extraction failed: ${extractionError instanceof Error ? extractionError.message : 'Unknown error'}`);
        
        // Continue with avatar creation even if extraction fails (graceful degradation)
        factExtractionResult = {
          facts: [],
          processing_time_ms: Date.now() - startTime,
          errors: [extractionError instanceof Error ? extractionError.message : 'Unknown extraction error'],
          stage_results: { pattern: null, llm: null },
          performance_metrics: {
            pattern_facts_count: 0,
            llm_facts_count: 0,
            total_facts_count: 0,
            deduplication_removed: 0,
            confidence_filtered: 0
          }
        };
      }
    }

    const totalProcessingTime = Date.now() - startTime;
    const seedingTime = Date.now() - seedingStart;

    // Return successful response with extraction results
    const response = {
      avatar: {
        id: avatarData.id,
        slug: avatarData.name,
        display_name: avatarData.description,
        created_at: avatarData.created_at,
        profile_data: avatarData.profile_data
      },
      fragment_id: onboardingFragmentId,
      extraction_results: {
        seeded_facts_count: seededFactsCount,
        quick_facts_count: factExtractionResult?.facts.length || 0,
        fragments_count: memoryFragmentsResult?.fragments_created || 0,
        processing_time_ms: totalProcessingTime,
        seeding_time_ms: seedingTime,
        fact_extraction: factExtractionResult ? {
          facts_extracted: factExtractionResult.facts.length,
          processing_time_ms: factExtractionResult.processing_time_ms,
          stage_results: {
            pattern_facts: factExtractionResult.stage_results.pattern?.facts.length || 0,
            llm_facts: factExtractionResult.stage_results.llm?.facts.length || 0
          },
          performance_metrics: factExtractionResult.performance_metrics
        } : null,
        memory_fragments: memoryFragmentsResult,
        errors: extractionErrors
      }
    };

    console.log('[POST /api/avatars] Avatar creation completed:', {
      avatar_id: avatarData.id,
      facts_extracted: factExtractionResult?.facts.length || 0,
      fragments_created: memoryFragmentsResult?.fragments_created || 0,
      total_time_ms: totalProcessingTime,
      has_errors: extractionErrors.length > 0
    });

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('[POST /api/avatars] Avatar creation failed:', error);
    
    return NextResponse.json({
      error: 'Failed to create avatar',
      details: error instanceof Error ? error.message : 'Unknown error',
      processing_time_ms: Date.now() - startTime
    }, { status: 500 });
  }
}