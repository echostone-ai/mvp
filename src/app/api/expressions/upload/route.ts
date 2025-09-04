/**
 * Expression Upload API - Handles file uploads for expression clips
 * POST /api/expressions/upload
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureFlag } from '../../../../lib/featureFlags';
import { AudioProcessor } from '../../../../lib/audioProcessor';
import { ExpressionStorageService, ExpressionType } from '../../../../lib/services/expressionStorageService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Configure for file uploads
export const config = {
  api: {
    bodyParser: false,
    responseLimit: '10mb',
  },
};

interface UploadRequest {
  file: File;
  type: ExpressionType;
  tone?: string;
  placementHints?: string[];
  avatarId?: string; // For admin uploads
}

/**
 * POST /api/expressions/upload - Upload expression file
 * Body: FormData with file and metadata
 */
async function handlePOST(request: NextRequest) {
  try {
    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as ExpressionType;
    const tone = formData.get('tone') as string | null;
    const placementHintsStr = formData.get('placementHints') as string | null;
    const avatarId = formData.get('avatarId') as string | null;

    // Validate required fields
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
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

    // For MVP, we'll use a mock user ID
    // In production, this would come from authentication
    const userId = 'user_' + Date.now(); // TODO: Get from auth session
    const ownerType = avatarId ? 'avatar' : 'user';
    const ownerId = avatarId || userId;

    console.log(`[EXPRESSION UPLOAD] Processing file: ${file.name}, type: ${type}, owner: ${ownerType}:${ownerId}`);

    // Process the audio file
    const processedAudio = await AudioProcessor.processAudioFile(file, {
      maxDurationMs: 5000, // 5 seconds max
      targetSampleRate: 22050,
      fadeInMs: 15,
      fadeOutMs: 20
    });

    // Generate safe filename
    const safeFilename = AudioProcessor.generateSafeFilename(file.name, ownerId);

    // Prepare metadata
    const metadata = {
      ownerId,
      ownerType,
      filename: safeFilename,
      type,
      tone: tone || undefined,
      placementHints,
      durationMs: processedAudio.durationMs,
      priority: 0,
      status: 'active' as const
    };

    // Upload to storage and save metadata
    const storedExpression = await ExpressionStorageService.uploadExpression(
      processedAudio,
      metadata
    );

    console.log(`[EXPRESSION UPLOAD] Successfully uploaded expression: ${storedExpression.id}`);

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
        status: storedExpression.status,
        createdAt: storedExpression.createdAt
      }
    });

  } catch (error: any) {
    console.error('[EXPRESSION UPLOAD] Error:', error);
    
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