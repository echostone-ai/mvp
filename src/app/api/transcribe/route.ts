// src/app/api/transcribe/route.ts
import { NextResponse } from 'next/server'
import { OpenAI } from 'openai'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY,
})

export const runtime = 'nodejs' // Required for file system access

export async function POST(req: Request) {
  let tempPath = '';
  try {
    const formData = await req.formData()
    const audio = formData.get('audio') as File
    if (!audio) return NextResponse.json({ error: 'No audio file uploaded.' }, { status: 400 })

    console.log('Received audio file:', audio.name, audio.type, audio.size);
    
    if (audio.size === 0) {
      return NextResponse.json({ error: 'Audio file is empty.' }, { status: 400 });
    }

    // Save to temp file
    const buffer = Buffer.from(await audio.arrayBuffer())
    const tempDir = os.tmpdir()
    tempPath = path.join(tempDir, `upload-${Date.now()}.webm`)
    fs.writeFileSync(tempPath, buffer)
    
    console.log('Saved audio to temp file:', tempPath, 'Size:', buffer.length);

    // Check if OpenAI API key is available
    if (!openai.apiKey) {
      console.log('OpenAI API key not configured, returning mock response');
      // Delete the temp file
      try {
        if (tempPath) await fs.unlink(tempPath).catch(() => {});
      } catch (e) {
        console.error('Failed to delete temp file:', e);
      }
      
      // Return a mock response for development purposes
      return NextResponse.json({ 
        transcript: "I heard you speaking. What would you like to know?" 
      });
    }

    // Use OpenAI Whisper
    console.log('Calling OpenAI Whisper API...');
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: 'whisper-1',
      language: 'en',
    })
    
    console.log('Transcription received:', transcription.text);

    // Delete the temp file
    try {
      await fs.unlink(tempPath);
      console.log('Temp file deleted');
    } catch (e) {
      console.error('Failed to delete temp file:', e);
    }

    return NextResponse.json({ transcript: transcription.text })
  } catch (e: any) {
    console.error('Transcription error:', e);
    
    // Clean up temp file if it exists
    try {
      if (tempPath) await fs.unlink(tempPath).catch(() => {});
    } catch (cleanupError) {
      console.error('Failed to delete temp file during error handling:', cleanupError);
    }
    
    // Return a more user-friendly error message
    return NextResponse.json({ 
      transcript: "I couldn't understand what you said. Could you please try again?",
      error: e.message || 'Transcription failed' 
    });
  }
}