import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { checkHubAccess } from '@/lib/hubAccess';
import { createRateLimiter } from '@/lib/rateLimiter';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import crypto from 'crypto';

// Create a rate limiter for file uploads (10 uploads per hour)
const uploadLimiter = createRateLimiter({
  interval: 60 * 60 * 1000, // 1 hour
  maxRequests: 10
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = session.user.id;
    
    // Apply rate limiting
    const rateLimitResult = uploadLimiter.check(`upload_${userId}`);
    if (!rateLimitResult.success) {
      return NextResponse.json({ 
        error: 'Rate limit exceeded. Please try again later.',
        resetAt: new Date(rateLimitResult.resetAt).toISOString()
      }, { status: 429 });
    }
    
    // Parse the form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const hubId = formData.get('hubId') as string;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    if (!hubId) {
      return NextResponse.json({ error: 'Hub ID is required' }, { status: 400 });
    }
    
    // Check if user has access to the hub
    const access = await checkHubAccess(hubId, userId);
    if (!access.hasAccess) {
      return NextResponse.json({ error: access.message }, { status: access.status });
    }
    
    // Validate file type
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/webm', 'audio/ogg'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }
    
    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 });
    }
    
    // Generate a unique filename
    const fileExtension = file.name.split('.').pop();
    const fileName = `${crypto.randomBytes(16).toString('hex')}.${fileExtension}`;
    
    // Determine the file type category
    const isImage = file.type.startsWith('image/');
    const fileCategory = isImage ? 'images' : 'audio';
    
    // Create the upload directory if it doesn't exist
    const uploadDir = join(process.cwd(), 'public', 'uploads', hubId, fileCategory);
    await createDirectoryIfNotExists(uploadDir);
    
    // Save the file
    const filePath = join(uploadDir, fileName);
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, fileBuffer);
    
    // Generate the public URL
    const publicUrl = `/uploads/${hubId}/${fileCategory}/${fileName}`;
    
    return NextResponse.json({ 
      success: true, 
      url: publicUrl,
      fileName,
      fileType: file.type,
      fileSize: file.size
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}

// Helper function to create a directory if it doesn't exist
async function createDirectoryIfNotExists(dir: string) {
  try {
    await writeFile(dir, '', { flag: 'wx' });
  } catch (error: any) {
    if (error.code === 'EISDIR') {
      // Directory already exists
      return;
    }
    
    if (error.code === 'ENOENT') {
      // Parent directory doesn't exist, create it recursively
      const parentDir = join(dir, '..');
      await createDirectoryIfNotExists(parentDir);
      await writeFile(dir, '', { flag: 'wx' });
      return;
    }
    
    throw error;
  }
}