/**
 * Admin Expression Upload API - Single file uploads for avatars
 * POST /api/expressions/admin/upload
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureFlag } from '../../../../../lib/featureFlags';
import { AudioProcessor } from '../../../../../lib/audioProcessor';
import { ExpressionStorageService, ExpressionType } from '../../../../../lib/services/expressionStorageService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Configure for file uploads
export const config = {
  api: {
    bodyParser: false,
    responseLimit: '10mb',
  },
};

/**
 * POST /api/expressions/admin/upload - Upload single expression for avatar
 * Body: FormData with file, avatarId, type, tone, placementHints, priority
 */
async function handlePOST(request: NextRequest) {
  try {
    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const avatarId = formData.get('avatarId') as string;
    const type = formData.get('type') as ExpressionType;
    const tone = formData.get('tone') as string | null;
    const placementHintsStr = formData.get('placementHints') as string | null;
    const priorityStr = formData.get('priority') as string | null;

    // Validate required fields
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!avatarId) {
      return NextResponse.json(
        { success: false, error: 'Avatar ID is required for admin uploads' },
        { status: 400 }
      );
    }

    if (!type) {
      return NextResponse.json(
        { success: false, error: 'Expression type is required' },
        { status: 400 }
      );
    }

    // Validate expression type
    const validTypes: ExpressionType[] = [
      'laugh', 'sigh', 'breath', 'affirmation', 
      'greeting', 'catchphrase', 'filler'
    ];
    
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: `Invalid expression type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Parse placement hints if provided
    let placementHints: string[] | undefined;
    if (placementHintsStr) {
      try {
        placementHints = JSON.parse(placementHintsStr);
        if (!Array.isArray(placementHints)) {
          throw new Error('Placement hints must be an array');
        }
      } catch (error) {
        return NextResponse.json(
          { success: false, error: 'Invalid placement hints format. Must be a JSON array of strings.' },
          { status: 400 }
        );
      }
    }

    // Parse priority (admin expressions get higher default priority)
    let priority = 50; // Default admin priority
    if (priorityStr) {
      const parsedPriority = parseInt(priorityStr);
      if (isNaN(parsedPriority) || parsedPriority < 0 || parsedPriority > 100) {
        return NextResponse.json(
          { success: false, error: 'Priority must be a number between 0 and 100' },
          { status: 400 }
        );
      }
      priority = parsedPriority;
    }

    console.log(`[ADMIN UPLOAD] Processing file: ${file.name}, type: ${type}, avatar: ${avatarId}, priority: ${priority}`);

    // Process the audio file
    const processedAudio = await AudioProcessor.processAudioFile(file, {
      maxDurationMs: 5000, // 5 seconds max
      targetSampleRate: 22050,
      fadeInMs: 15,
      fadeOutMs: 20
    });

    // Generate safe filename with avatar prefix
    const safeFilename = AudioProcessor.generateSafeFilename(file.name, avatarId);

    // Prepare metadata for avatar expression
    const metadata = {
      ownerId: avatarId,
      ownerType: 'avatar' as const,
      filename: safeFilename,
      type,
      tone: tone || undefined,
      placementHints,
      durationMs: processedAudio.durationMs,
      priority,
      status: 'active' as const
    };

    // Upload to storage and save metadata
    const storedExpression = await ExpressionStorageService.uploadExpression(
      processedAudio,
      metadata
    );

    console.log(`[ADMIN UPLOAD] Successfully uploaded expression: ${storedExpression.id} for avatar: ${avatarId}`);

    // Return success response
    return NextResponse.json({
      success: true,
      data: {
        id: storedExpression.id,
        filename: storedExpression.filename,
        type: storedExpression.type,
        tone: storedExpression.tone,
        placementHints: storedExpression.placementHints,
        durationMs: storedExpression.durationMs,
        cdnUrl: storedExpression.cdnUrl,
        priority: storedExpression.priority,
        status: storedExpression.status,
        avatarId: avatarId,
        createdAt: storedExpression.createdAt
      }
    });

  } catch (error: any) {
    console.error('[ADMIN UPLOAD] Error:', error);
    
    // Return appropriate error response
    const statusCode = error.message?.includes('exceeds maximum') ? 413 :
                      error.message?.includes('Unsupported') ? 415 :
                      error.message?.includes('Storage upload failed') ? 503 :
                      error.message?.includes('Database') ? 500 : 400;

    return NextResponse.json({
      success: false,
      error: error.message || 'An unexpected error occurred during upload'
    }, { status: statusCode });
  }
}

// Apply feature flag middleware
export const POST = requireFeatureFlag('VOICE_OVERLAYS')(handlePOST);