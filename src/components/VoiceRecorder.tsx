import React, { useRef, useState } from "react"

const defaultScript = `Hello! My name is [your name]. I’m recording this to help train my digital voice. I’ve lived in [your city or country]. My favorite way to spend a day is with good friends, great music, and a little adventure. The weather can change in an instant, but you’ll always find me with a smile—or maybe a sarcastic joke. Anyway, this is my real voice, and I hope you enjoy it. The quick brown fox jumps over the lazy dog. Thanks for listening!`

const playfulScript = `Hi there! I’m [your name], and this is me in all my glory—awkward pauses, weird jokes, the works. I love to laugh, tell stories, and make the most of life’s little surprises. Seriously, if this digital twin says anything too wild, blame the code, not me. Quick brown fox, lazy dog, and all that jazz. Thanks for listening!`

const accentOptions = [
  "American English",
  "British English",
  "Canadian English",
  "Australian English",
  "Irish English",
  "Indian English",
  "South African English"
]

interface VoiceRecorderProps {
  userName: string
  onVoiceUploaded?: (voiceId: string) => void
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ userName, onVoiceUploaded }) => {
  const [accent, setAccent] = useState(accentOptions[0])
  const [script, setScript] = useState(defaultScript)
  const [recording, setRecording] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // Recording logic
  const startRecording = async () => {
    setStatus(null)
    setRecording(true)
    setAudioUrl(null)
    audioChunksRef.current = []
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mediaRecorder = new window.MediaRecorder(stream)
    mediaRecorderRef.current = mediaRecorder
    mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data)
      }
    }
    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunksRef.current, { type: "audio/webm" })
      setAudioBlob(blob)
      setAudioUrl(URL.createObjectURL(blob))
      setRecording(false)
    }
    mediaRecorder.start()
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  // Upload logic
  const uploadAudio = async (blob: Blob) => {
    setIsUploading(true)
    setStatus(null)
    try {
      console.log('Uploading audio:', {
        blob,
        size: blob.size,
        type: blob.type,
        accent,
        script,
        userName,
      })
      const formData = new FormData()
      formData.append("audio", blob, `${userName || "voice"}.webm`)
      formData.append("name", userName || "Anonymous")
      formData.append("accent", accent)
      formData.append("script", script)
      const res = await fetch("/api/upload-voice", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      console.log('Upload response:', data)
      if (data.success) {
        setStatus("Upload successful!")
        if (onVoiceUploaded && data.voiceId) onVoiceUploaded(data.voiceId)
      } else {
        setStatus(data.error || "Upload failed.")
      }
    } catch (err) {
      setStatus("Upload failed.")
    }
    setIsUploading(false)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setAudioBlob(e.target.files[0])
      setAudioUrl(URL.createObjectURL(e.target.files[0]))
    }
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

      <div className="voice-accent-row">
        <label htmlFor="accent-select" className="voice-accent-label">Accent:</label>
        <select
          id="accent-select"
          value={accent}
          onChange={(e) => setAccent(e.target.value)}
          className="voice-accent-select"
        >
          {accentOptions.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
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

      <label htmlFor="audio-upload" className="voice-upload-btn">
        <span role="img" aria-label="upload">📂</span>
        Choose File
        <input
          id="audio-upload"
          type="file"
          accept="audio/*"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
      </label>

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
        disabled={!audioBlob || isUploading}
        onClick={() => audioBlob && uploadAudio(audioBlob)}
        className="voice-upload-btn"
      >
        {isUploading ? "Uploading..." : "Upload Voice"}
      </button>
      {status && <div className="voice-upload-status">{status}</div>}
    </div>
  )
}

export default VoiceRecorder