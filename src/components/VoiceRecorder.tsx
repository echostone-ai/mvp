import React, { useRef, useState } from "react"

const defaultScript = `Hello! My name is [your name]. I'm recording this to help train my digital voice. I've lived in [your city or country]. My favorite way to spend a day is with good friends, great music, and a little adventure. The weather can change in an instant, but you'll always find me with a smile—or maybe a sarcastic joke. Anyway, this is my real voice, and I hope you enjoy it. The quick brown fox jumps over the lazy dog. Thanks for listening!`

const playfulScript = `Hi there! I'm [your name], and this is me in all my glory—awkward pauses, weird jokes, the works. I love to laugh, tell stories, and make the most of life's little surprises. Seriously, if this digital twin says anything too wild, blame the code, not me. Quick brown fox, lazy dog, and all that jazz. Thanks for listening!`

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
    if (!audioBlob && uploadedFiles.length === 0) {
      setStatus("Please record or upload audio first")
      return
    }

    setIsUploading(true)
    setStatus("Training your voice...")

    try {
      const formData = new FormData()
      
      // Add all uploaded files
      uploadedFiles.forEach((file, index) => {
        formData.append(`audio_${index}`, file)
      })
      
      // Add recorded audio if available
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
        setStatus(`🎉 Success! Your American English voice has been trained with ID: ${data.voice_id}`)
        if (onVoiceUploaded) onVoiceUploaded(data.voice_id)
        // Clear uploaded files after successful upload
        setUploadedFiles([])
        setAudioBlob(null)
        setAudioUrl(null)
      } else {
        let errorMessage = 'Unknown error occurred'
        
        if (data.error) {
          if (typeof data.error === 'string') {
            errorMessage = data.error
          } else if (typeof data.error === 'object') {
            if (data.error.detail && data.error.detail.message) {
              errorMessage = data.error.detail.message
            } else if (data.error.message) {
              errorMessage = data.error.message
            } else {
              errorMessage = JSON.stringify(data.error)
            }
          }
        }
        
        setStatus(`❌ Error: ${errorMessage}`)
        console.error('Upload error:', data)
      }
    } catch (error) {
      console.error('Error uploading voice:', error)
      setStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
    
    setStatus(`✅ ${newFiles.length} file(s) added. Total: ${uploadedFiles.length + newFiles.length} files ready for training.`)
  }

  return (
    <div className="voice-recorder-panel">
      <div className="voice-header">
        <h3 className="voice-recorder-title">Voice Training</h3>
        <div className="voice-accent-notice">
          🇺🇸 Your voice will be trained for American English pronunciation
        </div>
      </div>

      {/* Script Section */}
      <div className="voice-script-section">
        <h4 className="section-title">📝 Training Script</h4>
        <p className="section-description">Choose a script to read aloud for optimal voice training</p>
        
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

        <textarea
          value={script}
          readOnly
          rows={4}
          className="voice-script-textarea"
        />
      </div>

      {/* Recording Section */}
      <div className="voice-method-section">
        <h4 className="section-title">🎤 Record New Audio</h4>
        <div className="voice-recorder-tips">
          <div className="tips-grid">
            <div className="tip-item">🔇 Quiet room, no background noise</div>
            <div className="tip-item">🗣️ Speak naturally (don't rush)</div>
            <div className="tip-item">😊 Add your personality—laugh, pause, be real</div>
          </div>
        </div>

        <div className="voice-record-controls">
          <button
            type="button"
            onClick={startRecording}
            disabled={recording}
            className={`voice-record-btn ${recording ? 'recording' : ''}`}
          >
            {recording ? '🔴 Recording...' : '🎤 Start Recording'}
          </button>
          <button
            type="button"
            onClick={stopRecording}
            disabled={!recording}
            className="voice-record-btn stop"
          >
            ⏹️ Stop Recording
          </button>
        </div>

        {audioUrl && (
          <div className="voice-audio-container">
            <div className="audio-preview-label">Your Recording:</div>
            <audio controls src={audioUrl} className="voice-audio-player" />
          </div>
        )}
      </div>

      {/* Upload Section */}
      <div className="voice-method-section">
        <h4 className="section-title">📂 Upload Existing Audio</h4>
        <p className="section-description">Upload voice messages, recordings, or audio files you already have</p>
        
        <label htmlFor="audio-upload" className="voice-upload-btn">
          <span className="upload-icon">📁</span>
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

        <div className="upload-formats">
          <div className="format-grid">
            <div className="format-item">📱 WhatsApp (.opus, .ogg)</div>
            <div className="format-item">💬 iMessage (.m4a, .caf)</div>
            <div className="format-item">🎵 Standard (.mp3, .wav)</div>
            <div className="format-item">📞 Voice memos (.amr, .3gp)</div>
          </div>
          <div className="upload-tip">
            💡 <strong>Pro tip:</strong> Export voice messages from WhatsApp or iMessage for best results!
          </div>
        </div>

        {/* Display uploaded files */}
        {uploadedFiles.length > 0 && (
          <div className="uploaded-files-container">
            <h5 className="uploaded-files-title">Uploaded Files ({uploadedFiles.length})</h5>
            <div className="uploaded-files-list">
              {uploadedFiles.map((file, index) => (
                <div key={index} className="uploaded-file">
                  <div className="file-info">
                    <span className="file-icon">🎵</span>
                    <div className="file-details">
                      <span className="file-name">{file.name}</span>
                      <span className="file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
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
      </div>

      {/* Final Upload Section */}
      <div className="voice-final-section">
        <button
          type="button"
          disabled={(!audioBlob && uploadedFiles.length === 0) || isUploading}
          onClick={uploadAllAudio}
          className="voice-final-upload-btn"
        >
          {isUploading ? (
            <>
              <span className="loading-spinner"></span>
              Training Voice...
            </>
          ) : (
            <>
              🚀 Train My Voice
              {(uploadedFiles.length > 0 || audioBlob) && (
                <span className="file-count">
                  ({(uploadedFiles.length + (audioBlob ? 1 : 0))} files)
                </span>
              )}
            </>
          )}
        </button>
        
        {status && (
          <div className={`voice-upload-status ${status.includes('Success') || status.includes('🎉') ? 'success' : status.includes('Error') || status.includes('❌') ? 'error' : ''}`}>
            {status}
          </div>
        )}
      </div>
    </div>
  )
}

export default VoiceRecorder