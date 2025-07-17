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
          setStatus("Error processing recording. Please try again.")
          setRecording(false)
        }
      }
      mediaRecorder.onerror = (event) => {
        setStatus("Recording error occurred. Please try again.")
        setRecording(false)
      }
      mediaRecorder.start()
    } catch (error) {
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
      uploadedFiles.forEach((file, index) => {
        formData.append(`audio_${index}`, file)
      })
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
      if (response.ok && data.voice_id) {
        setStatus(`🎉 Success! Your voice has been trained.`)
        if (onVoiceUploaded) onVoiceUploaded(data.voice_id)
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
      }
    } catch (error) {
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

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="voice-recorder-apple flex flex-col items-center w-full max-w-2xl mx-auto p-6 bg-gradient-to-br from-purple-900/70 to-blue-900/60 rounded-3xl shadow-2xl border border-purple-500/20">
      <h2 className="text-3xl font-bold text-white mb-2 text-center">Train Your Digital Voice</h2>
      <p className="text-lg text-purple-200 mb-6 text-center max-w-xl">Record or upload your voice, then preview and save. Your voice is private and secure.</p>

      {/* Step 1: Script Selection */}
      <div className="w-full mb-6">
        <h4 className="text-xl font-semibold text-white mb-2">1. Choose a Script</h4>
        <div className="flex gap-3 mb-2">
          <button
            type="button"
            disabled={script === defaultScript}
            onClick={() => setScript(defaultScript)}
            className={`voice-script-btn px-4 py-2 rounded-lg font-medium transition-all ${script === defaultScript ? 'bg-blue-600 text-white' : 'bg-purple-800 text-purple-100 hover:bg-purple-700'}`}
          >Default</button>
          <button
            type="button"
            disabled={script === playfulScript}
            onClick={() => setScript(playfulScript)}
            className={`voice-script-btn px-4 py-2 rounded-lg font-medium transition-all ${script === playfulScript ? 'bg-blue-600 text-white' : 'bg-purple-800 text-purple-100 hover:bg-purple-700'}`}
          >Playful</button>
        </div>
        <textarea
          value={script}
          readOnly
          rows={4}
          className="w-full p-3 rounded-xl border-2 border-purple-400 bg-purple-950/60 text-white text-lg font-mono mb-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {/* Step 2: Record or Upload */}
      <div className="w-full mb-6 flex flex-col md:flex-row gap-6">
        {/* Record */}
        <div className="flex-1 bg-purple-900/60 rounded-2xl p-5 flex flex-col items-center shadow-md">
          <h5 className="text-lg font-semibold text-white mb-2">🎤 Record</h5>
          <div className="flex gap-3 mb-3">
            <button
              type="button"
              onClick={startRecording}
              disabled={recording}
              className={`px-5 py-2 rounded-lg font-bold transition-all ${recording ? 'bg-red-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            >{recording ? '● Recording...' : 'Start Recording'}</button>
            <button
              type="button"
              onClick={stopRecording}
              disabled={!recording}
              className="px-5 py-2 rounded-lg font-bold bg-gray-700 text-white hover:bg-gray-800 transition-all"
            >⏹️ Stop</button>
          </div>
          <div className="text-xs text-purple-200 mb-2">Tip: Use a quiet room and speak naturally.</div>
          {audioUrl && (
            <audio controls src={audioUrl} className="w-full mt-2 rounded-lg shadow" />
          )}
        </div>
        {/* Upload */}
        <div className="flex-1 bg-purple-900/60 rounded-2xl p-5 flex flex-col items-center shadow-md">
          <h5 className="text-lg font-semibold text-white mb-2">📁 Upload</h5>
          <input
            type="file"
            accept="audio/*,.opus,.ogg,.m4a,.aac,.amr,.3gp,.caf"
            multiple
            onChange={handleFileChange}
            className="mb-2"
          />
          <div className="text-xs text-purple-200 mb-2">Upload voice memos, recordings, or audio files.</div>
          {uploadedFiles.length > 0 && (
            <ul className="w-full mt-2 space-y-1">
              {uploadedFiles.map((file, idx) => (
                <li key={idx} className="flex items-center justify-between bg-purple-950/40 px-3 py-2 rounded-lg text-white text-sm">
                  {file.name} <span className="ml-2 text-purple-300">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                  <button onClick={() => removeFile(idx)} className="ml-3 text-red-400 hover:text-red-600 text-lg" title="Remove">×</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Step 3: Save/Train */}
      <div className="w-full flex flex-col items-center mb-2">
        <button
          type="button"
          onClick={uploadAllAudio}
          disabled={isUploading || (!audioBlob && uploadedFiles.length === 0)}
          className="px-8 py-3 rounded-2xl font-bold text-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xl hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isUploading ? 'Training Voice...' : 'Save & Train Voice'}
        </button>
        {status && (
          <div className={`mt-3 text-center text-base font-medium ${status.startsWith('🎉') ? 'text-green-400' : status.startsWith('❌') ? 'text-red-400' : 'text-purple-200'}`}>{status}</div>
        )}
      </div>
    </div>
  )
}

export default VoiceRecorder