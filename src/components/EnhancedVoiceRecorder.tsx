import React, { useRef, useState } from "react"

interface VoiceRecorderProps {
  userName: string
  onVoiceUploaded?: (voiceId: string) => void
}

const defaultScript = `Hello! My name is [your name]. I'm recording this to help train my digital voice. I've lived in [your city or country]. My favorite way to spend a day is with good friends, great music, and a little adventure. The weather can change in an instant, but you'll always find me with a smile—or maybe a sarcastic joke. Anyway, this is my real voice, and I hope you enjoy it. The quick brown fox jumps over the lazy dog. Thanks for listening!`

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ userName, onVoiceUploaded }) => {
  const [script, setScript] = useState(defaultScript)
  const [recording, setRecording] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [status, setStatus] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // Start recording
  const startRecording = async () => {
    setStatus(null)
    setRecording(true)
    audioChunksRef.current = []
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new window.MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        setRecording(false)
        setStatus('Recording completed!')
      }
      mediaRecorder.start()
    } catch (error) {
      setStatus('Could not start recording.')
      setRecording(false)
    }
  }

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
    }
  }

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const newFiles = Array.from(e.target.files)
    setUploadedFiles((prev) => [...prev, ...newFiles])
    setStatus(`${newFiles.length} file(s) added. Total: ${uploadedFiles.length + newFiles.length}`)
  }

  // Remove uploaded file
  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="voice-recorder">
      <h3>Record or Upload Your Voice</h3>
      <textarea
        value={script}
        onChange={(e) => setScript(e.target.value)}
        rows={5}
        className="voice-script"
      />
      <div style={{ margin: '1em 0' }}>
        <button type="button" onClick={startRecording} disabled={recording}>
          🎤 Start Recording
        </button>
        <button type="button" onClick={stopRecording} disabled={!recording}>
          ⏹️ Stop Recording
        </button>
      </div>
      {audioUrl && (
        <div>
          <audio controls src={audioUrl} />
        </div>
      )}
      <div style={{ margin: '1em 0' }}>
        <label>
          <span>Upload Audio File(s): </span>
          <input
            type="file"
            accept="audio/*,.opus,.ogg,.m4a,.aac,.amr,.3gp,.caf"
            multiple
            onChange={handleFileChange}
          />
        </label>
      </div>
      {uploadedFiles.length > 0 && (
        <div>
          <h4>Uploaded Files</h4>
          <ul>
            {uploadedFiles.map((file, idx) => (
              <li key={idx}>
                {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                <button onClick={() => removeFile(idx)} style={{ marginLeft: 8 }}>Remove</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {status && <div style={{ marginTop: '1em', color: 'purple' }}>{status}</div>}
    </div>
  )
}

export default VoiceRecorder