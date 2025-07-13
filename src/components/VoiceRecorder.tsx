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
    <div
      style={{
        maxWidth: 420,
        margin: "0 auto",
        padding: 24,
        border: "1px solid #ede2fa",
        borderRadius: 14,
        background: "rgba(255,255,255,0.03)",
        boxShadow: "0 6px 20px #ede2fa22",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        alignItems: "stretch",
      }}
    >
      <h3 style={{
        marginBottom: 4,
        fontWeight: 700,
        fontSize: "1.3rem",
        color: "#8864fa",
        letterSpacing: "0.01em",
      }}>Voice Training</h3>

      <div
        style={{
          color: '#fff',
          textShadow: '0 2px 8px rgba(0,0,0,0.45), 0 1px 0 #232946',
          filter: 'brightness(1.18)',
          marginBottom: 8,
          fontSize: "0.98rem"
        }}
      >
        <strong>Recording tips:</strong>
        <ul style={{ margin: "4px 0 4px 16px" }}>
          <li>Quiet room, no background noise</li>
          <li>Speak naturally (don’t rush)</li>
          <li>Add your personality—laugh, pause, be real</li>
        </ul>
      </div>

      <div style={{ display: "flex", alignItems: "center", marginBottom: 6, gap: 8 }}>
        <label htmlFor="accent-select" style={{
          fontWeight: 600,
          fontSize: "1rem",
          color: "#291954",
          marginRight: 4,
        }}>Accent:</label>
        <select
          id="accent-select"
          value={accent}
          onChange={(e) => setAccent(e.target.value)}
          style={{
            fontSize: "1rem",
            padding: "0.4rem 1rem",
            borderRadius: "7px",
            border: "1.5px solid #8864fa",
            outline: "none",
            background: "#f8f7ff",
            color: "#291954",
            fontWeight: 600,
            minWidth: 155,
          }}
        >
          {accentOptions.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>

      <div style={{ margin: "10px 0" }}>
        <label>
          <strong style={{ fontSize: "1rem" }}>Please read this aloud for best results:</strong>
          <textarea
            value={script}
            readOnly
            rows={5}
            style={{
              width: "100%",
              fontFamily: "inherit",
              background: "#f5f5f5",
              marginTop: 6,
              border: "1px solid #ede2fa",
              borderRadius: 6,
              padding: "8px 10px",
              fontSize: "1rem",
              color: "#291954",
              resize: "none"
            }}
          />
        </label>
        <div style={{ marginTop: 3, display: "flex", gap: 8 }}>
          <button
            type="button"
            disabled={script === defaultScript}
            onClick={() => setScript(defaultScript)}
            style={{
              background: script === defaultScript ? "#e2e2f6" : "#8864fa",
              color: script === defaultScript ? "#888" : "#fff",
              border: "none",
              padding: "0.38rem 1.2rem",
              borderRadius: 6,
              fontWeight: 600,
              fontSize: "0.99rem",
              cursor: script === defaultScript ? "not-allowed" : "pointer",
              transition: "background 0.15s",
            }}
          >Default Script</button>
          <button
            type="button"
            disabled={script === playfulScript}
            onClick={() => setScript(playfulScript)}
            style={{
              background: script === playfulScript ? "#e2e2f6" : "#48dfb5",
              color: script === playfulScript ? "#888" : "#1b383a",
              border: "none",
              padding: "0.38rem 1.2rem",
              borderRadius: 6,
              fontWeight: 600,
              fontSize: "0.99rem",
              cursor: script === playfulScript ? "not-allowed" : "pointer",
              transition: "background 0.15s",
            }}
          >Playful Script</button>
        </div>
      </div>

      <label htmlFor="audio-upload" style={{
        display: "flex",
        alignItems: "center",
        background: "#8864fa",
        color: "#fff",
        padding: "0.55rem 0",
        borderRadius: "7px",
        fontWeight: 700,
        fontSize: "1rem",
        justifyContent: "center",
        boxShadow: "0 1.5px 8px #ede2fa",
        cursor: "pointer",
        margin: "4px 0 0 0",
        width: "100%",
        gap: 8,
      }}>
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

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button
          type="button"
          onClick={startRecording}
          disabled={recording}
          style={{
            flex: 1,
            background: "#48dfb5",
            color: "#1b383a",
            padding: "0.5rem 0",
            borderRadius: "7px",
            border: "none",
            fontWeight: 700,
            fontSize: "1rem",
            cursor: recording ? "not-allowed" : "pointer",
            boxShadow: "0 1px 4px #e2e6f6",
            transition: "background 0.16s",
          }}
        >Record</button>
        <button
          type="button"
          onClick={stopRecording}
          disabled={!recording}
          style={{
            flex: 1,
            background: "#48dfb5",
            color: !recording ? "#b8b8b8" : "#1b383a",
            padding: "0.5rem 0",
            borderRadius: "7px",
            border: "none",
            fontWeight: 700,
            fontSize: "1rem",
            cursor: !recording ? "not-allowed" : "pointer",
            opacity: recording ? 1 : 0.5,
            boxShadow: "0 1px 4px #e2e6f6",
            transition: "background 0.16s",
          }}
        >Stop Recording</button>
      </div>

      {audioUrl && (
        <div style={{ margin: "8px 0" }}>
          <audio controls src={audioUrl} style={{ width: "100%" }} />
        </div>
      )}

      <button
        type="button"
        disabled={!audioBlob || isUploading}
        onClick={() => audioBlob && uploadAudio(audioBlob)}
        style={{
          background: "#8864fa",
          color: "#fff",
          padding: "0.55rem 0",
          borderRadius: "7px",
          border: "none",
          fontWeight: 700,
          fontSize: "1.07rem",
          width: "100%",
          cursor: (!audioBlob || isUploading) ? "not-allowed" : "pointer",
          marginTop: 8,
          marginBottom: 2,
          boxShadow: "0 2px 6px #ede2fa",
          transition: "background 0.16s",
        }}
      >
        {isUploading ? "Uploading..." : "Upload Voice"}
      </button>
      {status && <div style={{ marginTop: 10, color: "#291954" }}>{status}</div>}
    </div>
  )
}

export default VoiceRecorder