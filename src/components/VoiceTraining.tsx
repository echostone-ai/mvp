'use client'

import React, { useState, useRef } from 'react'
import { supabase } from '@/components/supabaseClient'

interface VoiceTrainingProps {
  avatarName: string
  avatarId?: string
  onVoiceUploaded?: (voiceId: string) => void
}

const SAMPLE_SCRIPTS = {
  professional: {
    title: "Professional",
    description: "Clear, confident tone for business contexts",
    text: `Hello, I'm ${'{avatarName}'}. I'm here to help you with your questions and provide assistance. I have experience in various topics and I'm committed to giving you accurate, helpful information. Whether you need quick answers or detailed explanations, I'm ready to support you. How can I help you today?`
  },
  conversational: {
    title: "Conversational", 
    description: "Natural, friendly tone for everyday interactions",
    text: `Hi there! I'm ${'{avatarName}'}, and I'm really excited to chat with you. I love having conversations about all sorts of things - from everyday topics to deep discussions. I try to be helpful while keeping things relaxed and genuine. What's on your mind today? I'm all ears!`
  },
  storytelling: {
    title: "Storytelling",
    description: "Expressive, engaging tone for narratives",
    text: `Once upon a time... just kidding! But seriously, I'm ${'{avatarName}'}, and I love sharing stories and experiences. There's something magical about how we connect through narratives, isn't there? Whether it's a funny anecdote, a life lesson, or just sharing what happened during the day, I believe every story matters. What story would you like to share with me?`
  }
}

export default function VoiceTraining({ avatarName, avatarId, onVoiceUploaded }: VoiceTrainingProps) {
  const [step, setStep] = useState<'method' | 'script' | 'record' | 'upload' | 'preview'>('method')
  const [method, setMethod] = useState<'record' | 'upload' | null>(null)
  const [selectedScript, setSelectedScript] = useState<keyof typeof SAMPLE_SCRIPTS>('conversational')
  const [customScript, setCustomScript] = useState('')
  const [useCustomScript, setUseCustomScript] = useState(false)
  const [recording, setRecording] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info' | null, message: string }>({ type: null, message: '' })
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getCurrentScript = () => {
    if (useCustomScript) return customScript
    return SAMPLE_SCRIPTS[selectedScript].text.replace('{avatarName}', avatarName)
  }

  const startRecording = async () => {
    try {
      setStatus({ type: null, message: '' })
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      let mimeType = 'audio/webm'
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/ogg'
      }
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        setStep('preview')
        stream.getTracks().forEach(track => track.stop())
      }
      
      mediaRecorder.start()
      setRecording(true)
    } catch (error) {
      setStatus({ type: 'error', message: 'Could not access microphone. Please check permissions.' })
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop()
      setRecording(false)
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return
    
    const newFiles = Array.from(files)
    setUploadedFiles(prev => [...prev, ...newFiles])
    
    // Preview the first file
    const firstFile = newFiles[0]
    setAudioBlob(firstFile)
    setAudioUrl(URL.createObjectURL(firstFile))
    setStep('preview')
  }

  const processVoice = async () => {
    if (!audioBlob && uploadedFiles.length === 0) return
    
    setIsProcessing(true)
    setStatus({ type: 'info', message: 'Training your voice... This may take a few minutes.' })
    
    try {
      const formData = new FormData()
      
      if (audioBlob) {
        formData.append('audio', audioBlob, 'recording.webm')
      }
      
      uploadedFiles.forEach((file, index) => {
        formData.append('audio', file, `upload_${index}.${file.name.split('.').pop()}`)
      })
      
      formData.append('name', avatarName)
      formData.append('script', getCurrentScript())
      if (avatarId) {
        formData.append('avatarId', avatarId)
      }
      
      // Get the current session for authorization
      const { data: { session } } = await supabase.auth.getSession()
      const authHeader = session?.access_token ? `Bearer ${session.access_token}` : ''
      
      const response = await fetch('/api/train-voice', {
        method: 'POST',
        headers: {
          'Authorization': authHeader
        },
        body: formData
      })
      
      const data = await response.json()
      
      if (data.success && data.voice_id) {
        setStatus({ type: 'success', message: `🎉 Success! ${avatarName}'s voice has been trained.` })
        if (onVoiceUploaded) {
          onVoiceUploaded(data.voice_id)
        }
        // Reset form
        setTimeout(() => {
          resetForm()
        }, 3000)
      } else {
        setStatus({ type: 'error', message: data.error || 'Failed to train voice. Please try again.' })
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'Network error. Please check your connection and try again.' })
    } finally {
      setIsProcessing(false)
    }
  }

  const resetForm = () => {
    setStep('method')
    setMethod(null)
    setAudioUrl(null)
    setAudioBlob(null)
    setUploadedFiles([])
    setStatus({ type: null, message: '' })
    setRecording(false)
  }

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="voice-training-container">
      {/* Header */}
      <div className="voice-training-header">
        <h2 className="voice-training-title">Train {avatarName}'s Voice</h2>
        <p className="voice-training-subtitle">
          Create a unique digital voice that sounds like you. Choose your preferred method below.
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="voice-training-progress">
        <div className={`progress-step ${step === 'method' ? 'active' : ['script', 'record', 'upload', 'preview'].includes(step) ? 'completed' : ''}`}>
          <div className="progress-step-number">1</div>
          <span>Choose Method</span>
        </div>
        <div className={`progress-step ${step === 'script' ? 'active' : ['record', 'upload', 'preview'].includes(step) ? 'completed' : ''} ${method === 'upload' ? 'hidden' : ''}`}>
          <div className="progress-step-number">2</div>
          <span>Select Script</span>
        </div>
        <div className={`progress-step ${['record', 'upload'].includes(step) ? 'active' : step === 'preview' ? 'completed' : ''}`}>
          <div className="progress-step-number">3</div>
          <span>{method === 'record' ? 'Record' : 'Upload'}</span>
        </div>
        <div className={`progress-step ${step === 'preview' ? 'active' : ''}`}>
          <div className="progress-step-number">4</div>
          <span>Review & Train</span>
        </div>
      </div>

      {/* Step Content */}
      <div className="voice-training-content">
        {step === 'method' && (
          <div className="method-selection">
            <h3>How would you like to create your voice?</h3>
            <div className="method-options">
              <button
                className={`method-option ${method === 'record' ? 'selected' : ''}`}
                onClick={() => {
                  setMethod('record')
                  setStep('script')
                }}
              >
                <div className="method-icon">🎤</div>
                <div className="method-info">
                  <h4>Record Now</h4>
                  <p>Use your microphone to record directly in your browser</p>
                  <div className="method-pros">
                    <span className="pro">✓ Quick and easy</span>
                    <span className="pro">✓ No file management</span>
                    <span className="pro">✓ Instant preview</span>
                  </div>
                </div>
              </button>
              
              <button
                className={`method-option ${method === 'upload' ? 'selected' : ''}`}
                onClick={() => {
                  setMethod('upload')
                  setStep('upload')
                }}
              >
                <div className="method-icon">📁</div>
                <div className="method-info">
                  <h4>Upload Files</h4>
                  <p>Upload pre-recorded audio files from your device</p>
                  <div className="method-pros">
                    <span className="pro">✓ Higher quality recordings</span>
                    <span className="pro">✓ Multiple files supported</span>
                    <span className="pro">✓ Professional equipment</span>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {step === 'script' && (
          <div className="script-selection">
            <h3>Choose a script to read</h3>
            <p className="script-description">
              Select a pre-written script or write your own. This helps train the AI to understand your speaking style.
            </p>
            
            <div className="script-options">
              {Object.entries(SAMPLE_SCRIPTS).map(([key, script]) => (
                <button
                  key={key}
                  className={`script-option ${selectedScript === key && !useCustomScript ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedScript(key as keyof typeof SAMPLE_SCRIPTS)
                    setUseCustomScript(false)
                  }}
                >
                  <h4>{script.title}</h4>
                  <p>{script.description}</p>
                </button>
              ))}
              
              <button
                className={`script-option ${useCustomScript ? 'selected' : ''}`}
                onClick={() => setUseCustomScript(true)}
              >
                <h4>Custom Script</h4>
                <p>Write your own text to read</p>
              </button>
            </div>

            <div className="script-preview">
              <h4>Script Preview:</h4>
              {useCustomScript ? (
                <textarea
                  value={customScript}
                  onChange={(e) => setCustomScript(e.target.value)}
                  placeholder="Write your custom script here... (minimum 50 words recommended)"
                  className="custom-script-input"
                  rows={6}
                />
              ) : (
                <div className="script-text">
                  {getCurrentScript()}
                </div>
              )}
            </div>

            <div className="script-actions">
              <button className="btn-secondary" onClick={() => setStep('method')}>
                Back
              </button>
              <button 
                className="btn-primary" 
                onClick={() => setStep(method === 'upload' ? 'upload' : 'record')}
                disabled={useCustomScript && customScript.trim().length < 50}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 'record' && (
          <div className="recording-section">
            <h3>Record Your Voice</h3>
            <div className="recording-setup">
              <div className="recording-tips">
                <h4>For best results:</h4>
                <ul>
                  <li>🔇 Find a quiet room with minimal background noise</li>
                  <li>🎤 Speak clearly and at a natural pace</li>
                  <li>😊 Let your personality shine through</li>
                  <li>📱 Keep your device close but not too close to avoid distortion</li>
                </ul>
              </div>
              
              <div className="script-display">
                <h4>Read this script:</h4>
                <div className="script-text-large">
                  {getCurrentScript()}
                </div>
              </div>
            </div>

            <div className="recording-controls">
              {!recording && !audioUrl && (
                <button className="record-btn" onClick={startRecording}>
                  <span className="record-icon">🎤</span>
                  Start Recording
                </button>
              )}
              
              {recording && (
                <button className="record-btn recording" onClick={stopRecording}>
                  <span className="record-icon pulse">⏺️</span>
                  Stop Recording
                </button>
              )}
              
              {audioUrl && (
                <div className="recording-preview">
                  <audio controls src={audioUrl} className="audio-player" />
                  <div className="recording-actions">
                    <button className="btn-secondary" onClick={() => {
                      setAudioUrl(null)
                      setAudioBlob(null)
                    }}>
                      Record Again
                    </button>
                    <button className="btn-primary" onClick={() => setStep('preview')}>
                      Continue
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="step-navigation">
              <button className="btn-secondary" onClick={() => setStep('script')}>
                Back
              </button>
            </div>
          </div>
        )}

        {step === 'upload' && (
          <div className="upload-section">
            <h3>Upload Audio Files</h3>
            
            <div className="upload-area" onClick={() => fileInputRef.current?.click()}>
              <div className="upload-icon">📁</div>
              <h4>Click to select audio files</h4>
              <p>Supports MP3, WAV, M4A, and other common audio formats</p>
              <p className="upload-note">Multiple files can be selected for better training</p>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              multiple
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />

            {uploadedFiles.length > 0 && (
              <div className="uploaded-files">
                <h4>Uploaded Files ({uploadedFiles.length})</h4>
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="uploaded-file">
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                    <button onClick={() => removeFile(index)} className="remove-file">×</button>
                  </div>
                ))}
              </div>
            )}

            <div className="upload-tips">
              <h4>Tips for better results:</h4>
              <ul>
                <li>📊 Upload 2-5 minutes of clear audio total</li>
                <li>🎯 Include varied speech patterns and emotions</li>
                <li>🔊 Ensure good audio quality (no distortion or clipping)</li>
                <li>📝 Reading the provided script is recommended but not required</li>
              </ul>
            </div>

            <div className="step-navigation">
              <button className="btn-secondary" onClick={() => setStep('method')}>
                Back
              </button>
              {uploadedFiles.length > 0 && (
                <button className="btn-primary" onClick={() => setStep('preview')}>
                  Continue
                </button>
              )}
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="preview-section">
            <h3>Review & Train Voice</h3>
            
            <div className="preview-content">
              <div className="preview-info">
                <h4>Ready to train {avatarName}'s voice</h4>
                <div className="preview-details">
                  <div className="detail-item">
                    <span className="detail-label">Method:</span>
                    <span className="detail-value">{method === 'record' ? 'Microphone Recording' : 'File Upload'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Script:</span>
                    <span className="detail-value">
                      {useCustomScript ? 'Custom Script' : SAMPLE_SCRIPTS[selectedScript].title}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Audio:</span>
                    <span className="detail-value">
                      {method === 'record' ? '1 recording' : `${uploadedFiles.length} file(s)`}
                    </span>
                  </div>
                </div>
              </div>

              {audioUrl && (
                <div className="audio-preview">
                  <h4>Audio Preview:</h4>
                  <audio controls src={audioUrl} className="audio-player" />
                </div>
              )}
            </div>

            {status.message && (
              <div className={`status-message ${status.type}`}>
                {status.message}
              </div>
            )}

            <div className="preview-actions">
              <button 
                className="btn-secondary" 
                onClick={() => setStep(method === 'upload' ? 'upload' : 'record')}
                disabled={isProcessing}
              >
                Back
              </button>
              <button 
                className="btn-primary train-btn" 
                onClick={processVoice}
                disabled={isProcessing || (!audioBlob && uploadedFiles.length === 0)}
              >
                {isProcessing ? (
                  <>
                    <span className="spinner"></span>
                    Training Voice...
                  </>
                ) : (
                  <>
                    🎯 Train {avatarName}'s Voice
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}