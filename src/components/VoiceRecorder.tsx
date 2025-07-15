import React, { useRef, useState } from "react"

const defaultScript = `Hello! My name is [your name]. I’m recording this to help train my digital voice. I’ve lived in [your city or country]. My favorite way to spend a day is with good friends, great music, and a little adventure. The weather can change in an instant, but you’ll always find me with a smile—or maybe a sarcastic joke. Anyway, this is my real voice, and I hope you enjoy it. The quick brown fox jumps over the lazy dog. Thanks for listening!`

const playfulScript = `Hi there! I’m [your name], and this is me in all my glory—awkward pauses, weird jokes, the works. I love to laugh, tell stories, and make the most of life’s little surprises. Seriously, if this digital twin says anything too wild, blame the code, not me. Quick brown fox, lazy dog, and all that jazz. Thanks for listening!`

// Removed accent options to preserve natural voice

interface VoiceRecorderProps {
  userName: string
  onVoiceUploaded?: (voiceId: string) => void
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ userName, onVoiceUploaded }) => {
  const [script, setScript] = useState(defaultScript)
  const [recording, setRecording] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // Recording logic
  const startRecording = async () => {
    try {
      setStatus(null)
      setRecording(true)
      setAudioUrl(null)
      audioChunksRef.current = []
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // Try different MIME types for better browser compatibility
      let mimeType = 'audio/webm'
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4'
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg'
        }
      }
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder
      
      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }
      
      mediaRecorder.onstop = () => {
        try {
          const blob = new Blob(audioChunksRef.current, { type: mimeType })
          setAudioBlob(blob)
          const url = URL.createObjectURL(blob)
          setAudioUrl(url)
          setRecording(false)
          setStatus("Recording completed successfully!")
        } catch (error) {
          console.error('Error creating audio blob:', error)
          setStatus("Error processing recording. Please try again.")
          setRecording(false)
        }
      }
      
      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event)
        setStatus("Recording error occurred. Please try again.")
        setRecording(false)
      }
      
      mediaRecorder.start()
    } catch (error) {
      console.error('Error starting recording:', error)
      setStatus("Could not access microphone. Please check permissions.")
      setRecording(false)
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  // Upload logic for multiple files
  const uploadAllAudio = async () => {
    // Check if we have either recorded audio or uploaded files
    if (!audioBlob && uploadedFiles.length === 0) {
      setStatus("Please record or upload audio first")
      return
    }

    setIsUploading(true)
    setStatus("Uploading...")

    try {
      const formData = new FormData()
      
      // Add all uploaded files
      uploadedFiles.forEach((file, index) => {
        formData.append(`audio_${index}`, file)
      })
      
      // Add recorded audio if available and not already in uploaded files
      if (audioBlob && !uploadedFiles.includes(audioBlob as File)) {
        formData.append('recorded_audio', audioBlob, `${userName || "voice"}_recorded.webm`)
      }
      
      formData.append('name', userName || 'Anonymous')
      formData.append('script', script)
      formData.append('file_count', uploadedFiles.length.toString())

      const response = await fetch('/api/upload-voice', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      console.log('Upload response:', data)

      if (response.ok && data.voice_id) {
        setStatus(`Success! Voice ID: ${data.voice_id}`)
        if (onVoiceUploaded) onVoiceUploaded(data.voice_id)
        // Clear uploaded files after successful upload
        setUploadedFiles([])
        setAudioBlob(null)
        setAudioUrl(null)
      } else {
        // Handle different error formats
        let errorMessage = 'Unknown error occurred'
        
        if (data.error) {
          if (typeof data.error === 'string') {
            errorMessage = data.error
          } else if (typeof data.error === 'object') {
            // Handle ElevenLabs API error objects
            if (data.error.detail && data.error.detail.message) {
              errorMessage = data.error.detail.message
            } else if (data.error.message) {
              errorMessage = data.error.message
            } else {
              errorMessage = JSON.stringify(data.error)
            }
          }
        }
        
        setStatus(`Error: ${errorMessage}`)
        console.error('Upload error:', data)
      }
    } catch (error) {
      console.error('Error uploading voice:', error)
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    
    setStatus("Processing audio files...")
    const newFiles = Array.from(e.target.files)
    setUploadedFiles(prev => [...prev, ...newFiles])
    
    // Set the last file as the preview
    const lastFile = newFiles[newFiles.length - 1]
    setAudioBlob(lastFile)
    setAudioUrl(URL.createObjectURL(lastFile))
    
    setStatus(`${newFiles.length} file(s) added. Total: ${uploadedFiles.length + newFiles.length} files ready for upload.`)
  }

  // UI
  return (
    <div className="voice-recorder-panel">
      <h3 className="voice-recorder-title">Voice Training</h3>

      <div className="voice-recorder-tips">
        <strong>Recording tips:</strong>
        <ul>
          <li>Quiet room, no background noise</li>
          <li>Speak naturally (don’t rush)</li>
          <li>Add your personality—laugh, pause, be real</li>
        </ul>
      </div>



      <div>
        <label>
          <strong className="voice-script-label">Please read this aloud for best results:</strong>
          <textarea
            value={script}
            readOnly
            rows={5}
            className="voice-script-textarea"
          />
        </label>
        <div className="voice-script-toggle-row">
          <button
            type="button"
            disabled={script === defaultScript}
            onClick={() => setScript(defaultScript)}
            className={`voice-script-btn${script === defaultScript ? ' active' : ''}`}
          >Default Script</button>
          <button
            type="button"
            disabled={script === playfulScript}
            onClick={() => setScript(playfulScript)}
            className={`voice-script-btn${script === playfulScript ? ' active' : ''}`}
          >Playful Script</button>
        </div>
      </div>

      <div className="upload-section">
        <label htmlFor="audio-upload" className="voice-upload-btn">
          <span role="img" aria-label="upload">📂</span>
          Choose Audio Files
          <input
            id="audio-upload"
            type="file"
            multiple
            accept="audio/*,.opus,.ogg,.m4a,.aac,.amr,.3gp,.caf"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
        </label>
        <div className="upload-notes">
          <p className="upload-note-title">💡 Supported formats:</p>
          <ul className="upload-note-list">
            <li>📱 <strong>WhatsApp voice messages</strong> (.opus, .ogg)</li>
            <li>💬 <strong>iMessage audio</strong> (.m4a, .caf)</li>
            <li>🎵 <strong>Standard audio</strong> (.mp3, .wav, .aac)</li>
            <li>📞 <strong>Voice memos</strong> (.amr, .3gp)</li>
          </ul>
          <p className="upload-tip">
            <strong>Tip:</strong> Export voice messages from WhatsApp or iMessage for best results!
          </p>
        </div>
      </div>

      {/* Display uploaded files */}
      {uploadedFiles.length > 0 && (
        <div className="uploaded-files-container">
          <h4 className="uploaded-files-title">Uploaded Files ({uploadedFiles.length})</h4>
          <div className="uploaded-files-list">
            {uploadedFiles.map((file, index) => (
              <div key={index} className="uploaded-file">
                <div className="file-info">
                  <span className="file-icon">🎵</span>
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                </div>
                <button 
                  onClick={() => {
                    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index))
                    if (uploadedFiles.length === 1) {
                      setAudioBlob(null)
                      setAudioUrl(null)
                    }
                  }}
                  className="remove-file-btn"
                  title="Remove file"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="voice-file-row">
        <button
          type="button"
          onClick={startRecording}
          disabled={recording}
          className="voice-record-btn"
        >Record</button>
        <button
          type="button"
          onClick={stopRecording}
          disabled={!recording}
          className="voice-record-btn"
        >Stop Recording</button>
      </div>

      {audioUrl && (
        <div className="voice-audio-container">
          <audio controls src={audioUrl} className="voice-audio-player" />
        </div>
      )}

      <button
        type="button"
        disabled={(!audioBlob && uploadedFiles.length === 0) || isUploading}
        onClick={uploadAllAudio}
        className="voice-upload-btn"
      >
        {isUploading ? "Uploading..." : `Upload Voice${uploadedFiles.length > 0 || audioBlob ? ` (${(uploadedFiles.length + (audioBlob ? 1 : 0))} files)` : ""}`}
      </button>
      {status && <div className="voice-upload-status">{status}</div>}
    </div>
  )
}

export default VoiceRecorder