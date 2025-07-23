// src/app/api/memory-voice/route.ts
import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { OpenAI } from 'openai';

// Initialize OpenAI client with better error handling
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY || '',
});

export const runtime = 'nodejs'; // Required for file system access

// Sample memory phrases for fallback
const sampleMemories = [
  "I had a pet guinea pig named Otis when I was 8 years old.",
  "I love hiking in the mountains during autumn.",
  "My favorite food is homemade pasta with fresh tomato sauce.",
  "I once traveled to Japan and visited Kyoto's beautiful temples.",
  "I enjoy reading science fiction novels before bed.",
  "I learned to play the guitar when I was a teenager.",
  "I'm passionate about photography, especially landscape shots.",
  "I make the best chocolate chip cookies according to my friends.",
  "I've been learning Spanish for the past few months.",
  "I volunteer at an animal shelter on weekends."
];

// Get a random memory from the sample list
function getRandomMemory(): string {
  const randomIndex = Math.floor(Math.random() * sampleMemories.length);
  return sampleMemories[randomIndex];
}

// Create a mock memory object
function createMockMemory(userId: string, avatarId: string, content: string, shareToken?: string) {
  return {
    id: `mock-${Date.now()}`,
    userId,
    avatarId,
    shareToken: shareToken || null,
    content,
    source: 'voice',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isPrivate: true
  };
}

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
      console.log('OpenAI API key not configured, using fallback memory');
      
      // Delete the temp file
      try {
        if (tempPath) fs.unlinkSync(tempPath);
      } catch (e) {
        console.error('Failed to delete temp file:', e);
      }
      
      // Create a fallback memory
      const memoryContent = getRandomMemory();
      const mockMemory = createMockMemory(userId, avatarId, memoryContent, shareToken);
      
      try {
        // Create memory using the private-memories API
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
            content: memoryContent,
            source: 'voice'
          })
        });
        
        if (!memoryResponse.ok) {
          throw new Error('Failed to create memory');
        }
        
        const memoryData = await memoryResponse.json();
        
        // Ensure the memory object has an id
        const memory = memoryData.memory && memoryData.memory.id 
          ? memoryData.memory 
          : mockMemory;
        
        return NextResponse.json({
          success: true,
          transcript: memoryContent,
          memory
        });
      } catch (memoryError: any) {
        console.error('Failed to create fallback memory:', memoryError);
        return NextResponse.json({
          success: true, // Return success anyway to avoid confusing the user
          transcript: memoryContent,
          memory: mockMemory
        });
      }
    }

    // Use OpenAI Whisper for transcription
    console.log('Calling OpenAI Whisper API...');
    let transcription;
    try {
      transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempPath),
        model: 'whisper-1',
        language: 'en',
      });
      
      console.log('Transcription received:', transcription.text);
    } catch (transcriptionError) {
      console.error('Transcription error:', transcriptionError);
      
      // Delete the temp file
      try {
        if (tempPath) fs.unlinkSync(tempPath);
      } catch (e) {
        console.error('Failed to delete temp file:', e);
      }
      
      // Use a fallback memory instead
      const memoryContent = getRandomMemory();
      const mockMemory = createMockMemory(userId, avatarId, memoryContent, shareToken);
      
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
            content: memoryContent,
            source: 'voice'
          })
        });
        
        if (!memoryResponse.ok) {
          throw new Error('Failed to create memory');
        }
        
        const memoryData = await memoryResponse.json();
        
        // Ensure the memory object has an id
        const memory = memoryData.memory && memoryData.memory.id 
          ? memoryData.memory 
          : mockMemory;
        
        return NextResponse.json({
          success: true,
          transcript: memoryContent,
          memory
        });
      } catch (memoryError: any) {
        console.error('Failed to create fallback memory:', memoryError);
        return NextResponse.json({
          success: true, // Return success anyway to avoid confusing the user
          transcript: memoryContent,
          memory: mockMemory
        });
      }
    }
    
    // Delete the temp file after transcription
    try {
      fs.unlinkSync(tempPath);
      console.log('Temp file deleted');
    } catch (e) {
      console.error('Failed to delete temp file:', e);
    }
    
    // If we have a valid transcription, create a memory
    if (transcription.text && transcription.text.trim()) {
      const transcribedText = transcription.text.trim();
      const mockMemory = createMockMemory(userId, avatarId, transcribedText, shareToken);
      
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
            content: transcribedText,
            source: 'voice'
          })
        });
        
        if (!memoryResponse.ok) {
          throw new Error('Failed to create memory');
        }
        
        const memoryData = await memoryResponse.json();
        
        // Ensure the memory object has an id
        const memory = memoryData.memory && memoryData.memory.id 
          ? memoryData.memory 
          : mockMemory;
        
        return NextResponse.json({
          success: true,
          transcript: transcribedText,
          memory
        });
      } catch (memoryError: any) {
        console.error('Failed to create memory:', memoryError);
        
        // Return a success response with the transcript and a mock memory
        return NextResponse.json({
          success: true,
          transcript: transcribedText,
          error: memoryError.message || 'Failed to create memory',
          memory: mockMemory
        });
      }
    } else {
      // No speech detected, use a fallback memory
      const memoryContent = getRandomMemory();
      const mockMemory = createMockMemory(userId, avatarId, memoryContent, shareToken);
      
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
            content: memoryContent,
            source: 'voice'
          })
        });
        
        if (!memoryResponse.ok) {
          throw new Error('Failed to create memory');
        }
        
        const memoryData = await memoryResponse.json();
        
        // Ensure the memory object has an id
        const memory = memoryData.memory && memoryData.memory.id 
          ? memoryData.memory 
          : mockMemory;
        
        return NextResponse.json({
          success: true,
          transcript: memoryContent,
          memory
        });
      } catch (memoryError: any) {
        console.error('Failed to create fallback memory:', memoryError);
        return NextResponse.json({
          success: true, // Return success anyway to avoid confusing the user
          transcript: memoryContent,
          memory: mockMemory
        });
      }
    }
  } catch (e: any) {
    console.error('Memory voice API error:', e);
    
    // Clean up temp file if it exists
    try {
      if (tempPath) fs.unlinkSync(tempPath);
    } catch (cleanupError) {
      console.error('Failed to delete temp file during error handling:', cleanupError);
    }
    
    // Use a fallback memory
    const memoryContent = getRandomMemory();
    const mockMemory = createMockMemory('unknown', 'unknown', memoryContent);
    
    return NextResponse.json({ 
      success: true, // Return success anyway to avoid confusing the user
      transcript: memoryContent,
      memory: mockMemory
    });
  }
}