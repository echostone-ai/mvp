// src/app/api/memory-voice/route.ts
import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

export const runtime = 'nodejs'; // Required for file system access

export async function POST(req: Request) {
  let tempPath = '';
  try {
    const formData = await req.formData();
    const audio = formData.get('audio') as File;
    const avatarId = formData.get('avatarId') as string;
    const userId = formData.get('userId') as string;
    const shareToken = formData.get('shareToken') as string;
    
    console.log('Memory voice API request:', { 
      audioSize: audio?.size, 
      avatarId, 
      userId,
      hasShareToken: !!shareToken
    });
    
    if (!audio) {
      return NextResponse.json({ error: 'No audio file uploaded.' }, { status: 400 });
    }
    
    if (!userId || !avatarId) {
      return NextResponse.json({ error: 'User ID and Avatar ID are required.' }, { status: 400 });
    }

    // Save to temp file
    const buffer = Buffer.from(await audio.arrayBuffer());
    const tempDir = os.tmpdir();
    tempPath = path.join(tempDir, `memory-voice-${Date.now()}.webm`);
    fs.writeFileSync(tempPath, buffer);
    
    console.log('Saved audio to temp file:', tempPath, 'Size:', buffer.length);

    // Check if OpenAI API key is available
    if (!openai.apiKey) {
      console.log('OpenAI API key not configured, returning mock response');
      
      // Delete the temp file
      try {
        if (tempPath) fs.unlinkSync(tempPath);
      } catch (e) {
        console.error('Failed to delete temp file:', e);
      }
      
      // Return a mock response for development purposes
      return NextResponse.json({ 
        success: true,
        transcript: "I heard you speaking. What would you like to remember about me?",
        memoryContent: "This is a sample memory. In production, this would be generated from your speech."
      });
    }

    // Use OpenAI Whisper for transcription
    console.log('Calling OpenAI Whisper API...');
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: 'whisper-1',
      language: 'en',
    });
    
    console.log('Transcription received:', transcription.text);
    
    // Delete the temp file after transcription
    try {
      fs.unlinkSync(tempPath);
      console.log('Temp file deleted');
    } catch (e) {
      console.error('Failed to delete temp file:', e);
    }
    
    // If we have a valid transcription, create a memory
    if (transcription.text && transcription.text.trim()) {
      // Create memory using the private-memories API
      try {
        const memoryResponse = await fetch(new URL('/api/private-memories', req.url).toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'create',
            userId,
            avatarId,
            shareToken: shareToken || undefined,
            content: transcription.text.trim(),
            source: 'voice'
          })
        });
        
        if (!memoryResponse.ok) {
          throw new Error('Failed to create memory');
        }
        
        const memoryData = await memoryResponse.json();
        
        return NextResponse.json({
          success: true,
          transcript: transcription.text,
          memory: memoryData.memory
        });
      } catch (memoryError: any) {
        console.error('Failed to create memory:', memoryError);
        return NextResponse.json({
          success: false,
          transcript: transcription.text,
          error: memoryError.message || 'Failed to create memory'
        });
      }
    } else {
      return NextResponse.json({
        success: false,
        error: 'No speech detected'
      });
    }
  } catch (e: any) {
    console.error('Memory voice API error:', e);
    
    // Clean up temp file if it exists
    try {
      if (tempPath) fs.unlinkSync(tempPath);
    } catch (cleanupError) {
      console.error('Failed to delete temp file during error handling:', cleanupError);
    }
    
    return NextResponse.json({ 
      success: false,
      error: e.message || 'Failed to process voice input'
    });
  }
}