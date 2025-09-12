import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveAvatarId, AvatarIdentifier } from '@/lib/services/identity';
import { extractBasics } from '@/lib/onboarding/extractBasics';
import { normalizeQuickFacts, QuickFacts, QUICK_FACT_KEYS } from '@/lib/onboarding/starterPack';
import { quickFactsDao } from '@/lib/data/quickFactsDao';

const service = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

interface SeedRequest {
  avatarSlug?: string;
  profileName?: string;
  formBasics: Partial<QuickFacts>;
  freeText?: string;
}

interface SeedResponse {
  avatar_id: string;
  facts_upserted: number;
  summary_id: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: SeedRequest = await req.json();
    const { avatarSlug, profileName, formBasics, freeText } = body;

    // Validate input
    if (!avatarSlug && !profileName) {
      return NextResponse.json(
        { error: 'Either avatarSlug or profileName must be provided' },
        { status: 400 }
      );
    }

    if (!formBasics || typeof formBasics !== 'object') {
      return NextResponse.json(
        { error: 'formBasics is required and must be an object' },
        { status: 400 }
      );
    }

    // Step 1: Resolve avatar ID
    const identifier: AvatarIdentifier = { profileName, avatarSlug };
    const avatar_id = await resolveAvatarId(identifier, service);

    // Step 2: Extract facts from free text if provided
    let extractedFacts: Partial<QuickFacts> = {};
    if (freeText && freeText.trim().length > 0) {
      extractedFacts = await extractBasics(freeText);
    }

    // Step 3: Merge and normalize facts (form basics take precedence)
    const mergedFacts = { ...extractedFacts, ...formBasics };
    const normalizedFacts = normalizeQuickFacts(mergedFacts);

    // Step 4: Bulk upsert quick_facts using compatibility layer
    const factsToUpsert: Record<string, string> = {};
    Object.entries(normalizedFacts).forEach(([key, value]) => {
      factsToUpsert[key] = Array.isArray(value) ? value.join(', ') : String(value);
    });

    let facts_upserted = 0;
    if (Object.keys(factsToUpsert).length > 0) {
      const upsertResult = await quickFactsDao.bulkUpsertQuickFacts(avatar_id, factsToUpsert, service);
      
      if (!upsertResult.success) {
        throw new Error(`Failed to upsert quick_facts: ${upsertResult.error}`);
      }
      facts_upserted = upsertResult.count;
    }

    // Step 5: Insert conversation_summaries record (optional - skip if table doesn't exist)
    let summary_id = 'skipped';
    try {
      const { data: summaryData, error: summaryError } = await service
        .from('conversation_summaries')
        .insert({
          avatar_id,
          type: 'onboarding',
          summary: `Onboarding completed with ${facts_upserted} facts extracted`,
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (summaryError) {
        console.warn('Conversation summary insertion failed (table may not exist):', summaryError.message);
        summary_id = 'failed';
      } else {
        summary_id = summaryData.id;
      }
    } catch (error: any) {
      console.warn('Conversation summary table not available:', error.message);
      summary_id = 'unavailable';
    }

    // Step 6: Optional memory_fragments for onboarding story
    if (freeText && freeText.trim().length > 0) {
      const { error: memoryError } = await service
        .from('memory_fragments')
        .insert({
          avatar_id,
          type: 'onboarding_story',
          text: freeText.trim(),
          created_at: new Date().toISOString()
        });

      if (memoryError) {
        console.warn('[api/onboarding/seed] Failed to insert memory fragment:', memoryError);
        // Don't fail the entire operation for this optional step
      }
    }

    // Step 7: Log telemetry with schema shape
    console.log(`JD_SEED ${JSON.stringify({ avatar_id, facts_count: facts_upserted, schema_shape: 'KEYVALUE' })}`);

    // Return success response
    const response: SeedResponse = {
      avatar_id,
      facts_upserted,
      summary_id
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('[api/onboarding/seed] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to seed onboarding' },
      { status: 500 }
    );
  }
}


