/**
 * Admin Bulk Expression Upload API
 * POST /api/expressions/admin/bulk-upload
 * Handles bulk uploads of expression packs for avatars
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureFlag } from '../../../../../lib/featureFlags';
import { AudioProcessor } from '../../../../../lib/audioProcessor';
import { ExpressionStorageService, ExpressionType } from '../../../../../lib/services/expressionStorageService';
import JSZip from 'jszip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Configure for large file uploads
export const config = {
  api: {
    bodyParser: false,
    responseLimit: '50mb',
  },
};

interface ManifestEntry {
  filename: string;
  type: ExpressionType;
  tone?: string;
  placementHints?: string[];
  priority?: number;
}

interface BulkUploadManifest {
  packName: string;
  version: string;
  avatarId: string;
  expressions: ManifestEntry[];
}

/**
 * POST /api/expressions/admin/bulk-upload - Upload expression pack for avatar
 * Body: FormData with zipFile, avatarId, packName, version
 */
async function handlePOST(request: NextRequest) {
  try {
    // Parse form data
    const formData = await request.formData();
    const zipFile = formData.get('zipFile') as File;
    const avatarId = formData.get('avatarId') as string;
    const packName = formData.get('packName') as string;
    const version = formData.get('version') as string;

    // Validate required fields
    if (!zipFile) {
      return NextResponse.json(
        { success: false, error: 'No zip file provided' },
        { status: 400 }
      );
    }

    if (!avatarId) {
      return NextResponse.json(
        { success: false, error: 'Avatar ID is required' },
        { status: 400 }
      );
    }

    if (!packName) {
      return NextResponse.json(
        { success: false, error: 'Pack name is required' },
        { status: 400 }
      );
    }

    // Validate file size (50MB max for bulk uploads)
    const maxSize = 50 * 1024 * 1024;
    if (zipFile.size > maxSize) {
      return NextResponse.json(
        { success: false, error: `Zip file size ${(zipFile.size / 1024 / 1024).toFixed(1)}MB exceeds maximum 50MB` },
        { status: 413 }
      );
    }

    console.log(`[ADMIN BULK UPLOAD] Processing pack: ${packName} v${version} for avatar: ${avatarId}`);

    // Load and parse zip file
    const zipBuffer = await zipFile.arrayBuffer();
    const zip = new JSZip();
    const zipContents = await zip.loadAsync(zipBuffer);

    // Look for manifest.json
    const manifestFile = zipContents.file('manifest.json');
    if (!manifestFile) {
      return NextResponse.json(
        { success: false, error: 'manifest.json not found in zip file' },
        { status: 400 }
      );
    }

    const manifestContent = await manifestFile.async('text');
    let manifest: BulkUploadManifest;
    
    try {
      manifest = JSON.parse(manifestContent);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid manifest.json format' },
        { status: 400 }
      );
    }

    // Validate manifest structure
    if (!manifest.expressions || !Array.isArray(manifest.expressions)) {
      return NextResponse.json(
        { success: false, error: 'Manifest must contain expressions array' },
        { status: 400 }
      );
    }

    // Override manifest values with form data
    manifest.avatarId = avatarId;
    manifest.packName = packName;
    manifest.version = version || manifest.version || '1.0.0';

    const results = [];
    const errors = [];

    // Process each expression in the manifest
    for (const entry of manifest.expressions) {
      try {
        // Find the audio file in the zip
        const audioFile = zipContents.file(entry.filename);
        if (!audioFile) {
          errors.push(`Audio file not found: ${entry.filename}`);
          continue;
        }

        // Get audio data as buffer
        const audioBuffer = await audioFile.async('arraybuffer');
        const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
        
        // Create a File object for processing
        const file = new File([audioBlob], entry.filename, { type: 'audio/mpeg' });

        // Validate expression type
        const validTypes: ExpressionType[] = [
          'laugh', 'sigh', 'breath', 'affirmation', 
          'greeting', 'catchphrase', 'filler'
        ];
        
        if (!validTypes.includes(entry.type)) {
          errors.push(`Invalid expression type for ${entry.filename}: ${entry.type}`);
          continue;
        }

        console.log(`[ADMIN BULK UPLOAD] Processing: ${entry.filename} (${entry.type})`);

        // Process the audio file
        const processedAudio = await AudioProcessor.processAudioFile(file, {
          maxDurationMs: 5000, // 5 seconds max
          targetSampleRate: 22050,
          fadeInMs: 15,
          fadeOutMs: 20
        });

        // Generate safe filename with avatar prefix
        const safeFilename = AudioProcessor.generateSafeFilename(entry.filename, avatarId);

        // Prepare metadata with admin priority
        const metadata = {
          ownerId: avatarId,
          ownerType: 'avatar' as const,
          filename: safeFilename,
          type: entry.type,
          tone: entry.tone,
          placementHints: entry.placementHints || [],
          durationMs: processedAudio.durationMs,
          priority: entry.priority || 50, // Admin expressions get higher default priority
          status: 'active' as const
        };

        // Upload to storage and save metadata
        const storedExpression = await ExpressionStorageService.uploadExpression(
          processedAudio,
          metadata
        );

        results.push({
          filename: entry.filename,
          id: storedExpression.id,
          type: entry.type,
          durationMs: storedExpression.durationMs,
          cdnUrl: storedExpression.cdnUrl,
          priority: storedExpression.priority
        });

        console.log(`[ADMIN BULK UPLOAD] Successfully uploaded: ${entry.filename} -> ${storedExpression.id}`);

      } catch (error: any) {
        console.error(`[ADMIN BULK UPLOAD] Error processing ${entry.filename}:`, error);
        errors.push(`Failed to process ${entry.filename}: ${error.message}`);
      }
    }

    // Return results
    const response = {
      success: true,
      packName: manifest.packName,
      version: manifest.version,
      avatarId: manifest.avatarId,
      processed: results.length,
      total: manifest.expressions.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log(`[ADMIN BULK UPLOAD] Completed: ${results.length}/${manifest.expressions.length} expressions uploaded for ${avatarId}`);

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('[ADMIN BULK UPLOAD] Error:', error);
    
    // Return appropriate error response
    const statusCode = error.message?.includes('exceeds maximum') ? 413 :
                      error.message?.includes('Invalid') ? 400 :
                      error.message?.includes('not found') ? 404 : 500;

    return NextResponse.json({
      success: false,
      error: error.message || 'An unexpected error occurred during bulk upload'
    }, { status: statusCode });
  }
}

// Apply feature flag middleware
export const POST = requireFeatureFlag('VOICE_OVERLAYS')(handlePOST);