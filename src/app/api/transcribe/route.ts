// src/app/api/transcribe/route.ts
import { NextResponse } from 'next/server'
import { OpenAI } from 'openai'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export const runtime = 'nodejs' // Required for file system access

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const audio = formData.get('audio') as File
    if (!audio) return NextResponse.json({ error: 'No audio file uploaded.' }, { status: 400 })

    // Save to temp file
    const buffer = Buffer.from(await audio.arrayBuffer())
    const tempDir = os.tmpdir()
    const tempPath = path.join(tempDir, `upload-${Date.now()}.webm`)
    fs.writeFileSync(tempPath, buffer)

    // Use OpenAI Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: 'whisper-1',
      language: 'en',
    })

    // Delete the temp file
    fs.unlinkSync(tempPath)

    return NextResponse.json({ transcript: transcription.text })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 })
  }
}
