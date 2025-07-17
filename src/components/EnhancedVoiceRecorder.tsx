  qmnimport React, { useRef, useState } from "react"

const defaultScript = `Hello! My name is [your name]. I'm recording this to help train my digital voice. I've lived in [your city or country]. My favorite way to spend a day is with good friends, great music, and a little adventure. The weather can change in an instant, but you'll always find me with a smile—or maybe a sarcastic joke. Anyway, this is my real voice, and I hope you enjoy it. The quick brown fox jumps over the lazy dog. Thanks for listening!`

const playfulScript = `Hi there! I'm [your name], and this is me in all my glory—awkward pauses, weird jokes, the works. I love to laugh, tell stories, and make the most of life's little surprises. Seriously, if this digital twin says anything too wild, blame the code, not me. Quick brown fox, lazy dog, and all that jazz. Thanks for listening!`

const professionalScript = `Good day. My name is [your name], and I'm creating this voice sample for professional use. I have experience in various fields and enjoy clear, articulate communication. Whether discussing business matters or casual conversation, I aim to maintain a balanced and approachable tone. The quick brown fox jumps over the lazy dog. Thank you for your attention.`

// Voice quality settings for ElevenLabs
const VOICE_SETTINGS = {
  stability: 0.75,
  similarity_boost: 0.85,
  style: 0.2,
  use_speaker_boost: true
}

interface VoiceRecorderProps {
  userName: string
  onVoiceUploaded?: (voiceId: string) => void
}

> {
  const [script, setScript] = useState(defaultScript)
  const [recording, setRecording] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string |
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [status, setStatus] = useState<string | null>(n)
  const [voicePreview, setVoicePreview] = useState<string |
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false)
  const [voiceSettings, setVoiceSettings] = useState(VOICE_SETTINGS)
  const [analysisResults, setAnalysisResults] = useState<any>(null)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // Recording logic (enhanced with better quality settings)
  const startRecording = async () => {
 {
      setStatus(null)
      setRecording(true)
      set
      audioChunksRef.
      
      const stream = awa({ 
        audio: {
       44100,
          channelCount: 1,
          echoCa
          noiseSuppression: 
          autoGainControl:true
        }
      })
      
      // e cloning
      le
       {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4'
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm'
        }
      }
      
      coneam, { 
       meType,
      ality
      })
      mediaRecord
      
      me
        if (event.data.size > 0) {
      data)
        }
      }
      
      med {
       y {
      pe })
          setAudioBlob(blob)
          con
          setAudioUrl(url)
          setRecording(false
          setStatus("Recording completed succes🎉")
          
          // Auto-analyze theality
          analyzeAudioQuality(blob)
        } ) {
          console.error('Error creating audio b)
          setStatus("Error processi
          setRecording(false)
        }
      }
      
      med) => {
       
      
        setRecording(false)
      }
      
      mediaRecorder.start()
    } c
      rror)
      setStatus("Could not .")
      setRecording(fae)
    }
  }

  con () => {
   stop()
lse)
  }

  // Audio quality analis
  c {
{
      const formData = new FormD
      formData.append('audio', audioBlob, 'sample.webm')
      
      const response = await fetch('/ce', {
        method: 'POST',
      ata,
      })
      
      if (response.ok) {
        ()
      analysis)
      }
    } catch (error) {
      console.log('Audio analysis no)
    }
  }

  // ew
  c () => {
) {
      setStatus("Please record or upload audio firs
      return
    }

    setIsGen(true)
    s")

    try {
      const formData = new FormData()

      if oBlob) {
        formData.append('audio', audioBlob, 'preview.webm')
      }
      uploadedFiles.forEach((file, index) => {
        formData.append(`audiole)
      })
      
      formData.append('text', "He)
      form

', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const )
        const url = URL.createObjectURL(blo
        setVoicePreview(url)
       🎧")
      } else {
        const error = await response.json()
        setStatus(`Preview error: ${error.message || 'Unknown error'}`)
      }
    } catch (error) {
     )
   }`)
{
      setIsGeneratingPreview(false)
    }
  }

  // Enhancetings
  connc () => {
 {
      setStatus("Please record o
      return
 }

    setIsUploading(true)
    se)

    try {
      c
      
      uploadedFiles.forEach((file, index) => {
        e)
      })
      
      if (audioBlob && !uploadedFiles.includes(audioBlob as File)) {
m`)
      }
      
      formData.append('')
      fot)
)
      formData.append('sgs))
      formData.append('enhanced', 'true') 

      const response = awaite', {
        method: 'POST',
        body: ta,
      })

      cn()

      if (response.ok && data.voice_id) {
        setStatus(`🎉 Voice clone created successfully!`)
        if (onV
        setUploadedFiles([])
     b(null)
   Url(null)

        let errorMessage = 'Unknown errored'
        if (data.error) {
          if (typeof data.error === 'string') {
            errorMessage = data.error
          } 
     
ge
            } else if (de) {
              errorMessage = data.error.message
e {
         rror)
            }
      
        }
        setStatus(`Error: ${errorMessage}`)
      }
    } 
      console.error('Error uploading voice:', error)
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } f{
      )
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElemen
    if (!e.target.files || e.target.files.length === 0) return
    
    setStatus("Processing audio files...")
    const newFiles = Aret.files)
    setUploadedFiles(pres])
    
1]
    setAudioBlob(lastFile)
File))
    
    setStatus(`${newFiles.length} file(s) added. Total: $)
  }

  return (
    <div className="voice
      <h3 clas

      <div className="voi>
        <strong>🎯 Pro Recording Tips:</strong>
        <ul>
          <li>🔇 Quiet room, no background noise</li>
          <li>🎙️ Speak naturally (don't rush)</li>
          <li>😊 Add your personality—laugh, pause, bel</li>
          <li>⏱️ Aim for 1-5 minutes of clea/li>
          <li>📱 WhatsApp voice messages work g
        </ul>
      </div>

      {/* S
      <div>
        <label>
       
          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            rows={5}
            className="voicrea"
     />
   

          <button
            type="button"
    
            onClick={() => setScript(defauScript)}
            className={`voice-script-btn${scrip''}`}
          >Default Script</button>
    on
            type="button"
            disabled={scri
            onClick={() => setScript(playfulSc}
    '}`}
          >Playful Script</button>
   
"
          
            onClick={() => setScript(profe
            className={`voice-script-btn${script === professional ''}`}

        </div>
      </div>

      {/* File Upload Section */}
      <div className="upload-section">
        <label htmlFor="audio-upload" className="voice-upload-btn">
          <spa>
          Choose 
          <input
            id="audio-upload"
            type="file"
           
            accept="audio/*,.opus,.ogg,.m4a,.aac,.amr,.3gp,.caf"
            onChang}
            style={{ display: "non}}
          />
        </label>
        <div className="upload-notes">
          <p classp>
          <u
            <l</li>
        /li>

            <li>📞 <strong>Voice memos)</li>
          </ul>
        </div>
      </div>

      {/* Uploaded Files Display */}
      {uploadedFiles.length > 0 && (
        <div className="uploaded-files-container">
          <h4 className="uploaded-files-title">📁 Uploaded Fi
          <div cl">
            {upl => (
">
                <div className="fi
               span>
                  <
                  <span className="file-size">({(file.size / 1024 / 1024).toFixed(2)/span>
                </div>
                <button 
                  onClick={() => {
                    setU))
                    if (uploadedFiles.length === 1) {
                l)
                    
                    }
                  }}
                  className="n"
                  title="Remove file"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recording Crols */}
      <div className="voice-frow">
        <button
          type="button"
          onClick={startRecording}
          disabled={recording}
          classNam"
        >
ng"}
        </button>
        <button
          type="button"
          onClick={stopRecording}
          disabled={!recording}
          className=btn"
        >
          ⏹️ Stop Recording
        </button>
      </div>

      {/* Audio Playback */}
      {audioUrl 
        <div classNa>
          <audio controls src={audioUrl} cyer" />
          {analysisResults && (
            <div className="audio-analysis">
              <h5>📊 Audio Quality Analysis:</h5>
              <div className="analysis-results">
                <span className={`quality-badge ${analysisResults.quality}`}>
                  {analysisResults.quality === 'good' ? '✅ Good Quali
                   ity'}
                </span>
                & (
">
                    {analysisResults.sug => (
                      <li key={i}>{sugge>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Voice Preview */}
      {(audioBlob || uploade (
        <div className="voice-preview-
          <button
            onClick={generatePreview}
            disabled={isGeneratingPreview}
            className="voice-preview-btn"
          >
            {isGeneratin}
          </button>
          {voicePreview && (
            <div clas">
              <h5>🎧 Vo/h5>
              <audio controlsr" />
            </div>
          )}
        </div>
      )}

gs */}
      <div className="voice-settings
        <h4>⚙️ Voice Settings</h4>
        <div classN>
          <div className="s
            <label>Stability: {voiceSe
            <input
              type="range"
             
              max="1"
              step="0.1"
              value}
              onChange={(e)})}
              className="setting-slider"
            />
          </div>
          <di-item">
            <label>Similarity: label>
            <input
              ty
"0"
              max="1"
              step="0.1"
              value={voiceSettings.similarity_boost}
              onChange={(e) => setVoiceSettings({...voiceSettings, similarity_)})}
              className="setting-slr"
            />
          </div>
          <div className="setting-item">
            <label>Style: {voiceSettings.style}</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={voiceSettings.style}
              onChange={(e) => setVoiceSettings({...voi)})}
              className="se
            />
          </div>
          <div className-item">
            <label>
              <input
                ty
            }
)}
              />
              Speaker Boost
            </label>
          </div>
        </div>
      </div>

      {/* Uploa
      <button
        type="button"
        disabled={(!audioBlob &&
        onClick={uploadAllAudio}
        className="voice-upload-btn enhanced"
      >
        {isUploading ?`}
      </button>

      {/* Stlay */}
 && (
        <div className={`voi
          {status}
        </div>
      )}
    </div>
  )
}

export default EnhancrderecoedVoiceR