// /src/pages/api/upload-voice.ts (or /src/app/api/upload-voice/route.ts if using app router)

import { NextApiRequest, NextApiResponse } from 'next'
import formidable from 'formidable'
import fs from 'fs'

// Disable Next.js default body parser so we can handle file uploads
export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const form = new formidable.IncomingForm()

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: 'Error parsing files' })

    const file = files.file
    const userId = fields.userId as string

    if (!file || Array.isArray(file) || !userId) {
      return res.status(400).json({ error: 'Missing file or userId' })
    }

    try {
      // Read the uploaded file from temp path
      const fileData = fs.readFileSync(file.filepath)

      // Construct unique file name
      const timestamp = Date.now()
      const ext = file.originalFilename?.split('.').pop() || 'webm'
      const fileName = `voice-${userId}-${timestamp}.${ext}`

      // Send audio to ElevenLabs for voice cloning
      const formData = new FormData()
      formData.append('file', new Blob([fileData]), fileName)
      formData.append('name', fileName)
      formData.append('description', 'EchoStone voice clone')

      const apiKey = process.env.ELEVENLABS_API_KEY
      if (!apiKey) {
        return res.status(500).json({ error: 'Missing ELEVENLABS_API_KEY environment variable' })
      }

      const elevenRes = await fetch('https://api.elevenlabs.io/v1/voices/add', {
        method: 'POST',
        headers: { 'xi-api-key': apiKey },
        body: formData,
      })

      if (!elevenRes.ok) {
        const clone = elevenRes.clone()
        let errorBody
        try {
          errorBody = await clone.json()
        } catch {
          errorBody = await clone.text()
        }
        return res.status(elevenRes.status).json({ error: errorBody })
      }

      const data = await elevenRes.json()
      return res.status(200).json(data)

    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Upload failed' })
    }
  })
}