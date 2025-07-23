'use client'

import React, { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import AudioVisualizer from './AudioVisualizer'
import '@/styles/voice-training.css'

interface VoiceTrainingProps {
  avatarName: string
  avatarId?: string
  onVoiceUploaded?: (voiceId: string) => void
}

const ACCENT_OPTIONS = {
  american: {
    title: "American English",
    description: "Standard American accent",
    flag: "🇺🇸"
  },
  british: {
    title: "British English",
    description: "Standard British accent",
    flag: "🇬🇧"
  },
  australian: {
    title: "Australian English",
    description: "Standard Australian accent",
    flag: "🇦🇺"
  },
  canadian: {
    title: "Canadian English",
    description: "Standard Canadian accent",
    flag: "🇨🇦"
  }
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
  const [selectedAccent, setSelectedAccent] = useState<string>('american')
  const [recording, setRecording] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info' | null, message: string }>({ type: null, message: '' })
  const [recordingTime, setRecordingTime] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const getCurrentScript = () => {
    if (useCustomScript) return customScript
    return SAMPLE_SCRIPTS[selectedScript].text.replace('{avatarName}', avatarName)
  }

  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const startRecording = async () => {
    try {
      setStatus({ type: null, message: '' })
      setRecordingTime(0)

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      })
      setAudioStream(stream);

      let mimeType = 'audio/webm;codecs=opus'
      if (!MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' :
          MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/ogg'
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000
      })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)

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
        setAudioStream(null);

        // Clear timer
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
      }

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event)
        setStatus({ type: 'error', message: 'Recording failed. Please try again.' })
        setRecording(false)
        stream.getTracks().forEach(track => track.stop())
        setAudioStream(null)

        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
      }

      mediaRecorder.start(1000) // Collect data every second
      setRecording(true)
    } catch (error: any) {
      console.error('Recording error:', error)
      let errorMessage = 'Could not access microphone. '

      if (error.name === 'NotAllowedError') {
        errorMessage += 'Please allow microphone access and try again.'
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No microphone found. Please connect a microphone.'
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'Microphone is being used by another application.'
      } else {
        errorMessage += 'Please check your microphone settings.'
      }

      setStatus({ type: 'error', message: errorMessage })
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop()
      setRecording(false)

      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const validFiles: File[] = []
    const errors: string[] = []

    Array.from(files).forEach(file => {
      // Check file type
      if (!file.type.startsWith('audio/')) {
        errors.push(`${file.name}: Not an audio file`)
        return
      }

      // Check file size (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        errors.push(`${file.name}: File too large (max 50MB)`)
        return
      }

      // Check for duplicates
      const isDuplicate = uploadedFiles.some(existing =>
        existing.name === file.name && existing.size === file.size
      )

      if (isDuplicate) {
        errors.push(`${file.name}: File already uploaded`)
        return
      }

      validFiles.push(file)
    })

    if (errors.length > 0) {
      setStatus({
        type: 'error',
        message: `Upload errors:\n${errors.join('\n')}`
      })
    }

    if (validFiles.length > 0) {
      setUploadedFiles(prev => [...prev, ...validFiles])

      // If this is the first file, set it for preview
      if (uploadedFiles.length === 0 && validFiles.length > 0) {
        const firstFile = validFiles[0]
        setAudioBlob(firstFile)
        setAudioUrl(URL.createObjectURL(firstFile))
      }

      setStatus({
        type: 'success',
        message: `${validFiles.length} file(s) uploaded successfully`
      })

      // Clear the status after 3 seconds
      setTimeout(() => {
        setStatus({ type: null, message: '' })
      }, 3000)
    }

    // Reset the input
    event.target.value = ''
  }

  const processVoice = async () => {
    if (!audioBlob && uploadedFiles.length === 0) {
      setStatus({ type: 'error', message: 'Please record audio or upload files before training.' })
      return
    }

    // Validate audio length for recorded audio
    if (audioBlob && recordingTime < 10) {
      setStatus({ type: 'error', message: 'Recording too short. Please record at least 10 seconds of audio.' })
      return
    }

    setIsProcessing(true)
    setStatus({ type: 'info', message: '🔄 Preparing audio files...' })

    try {
      const formData = new FormData()

      const timestamp = Date.now();
      const randomSuffix = Math.floor(Math.random() * 100000);
      const sessionId = Math.random().toString(36).substring(2, 10);
      const cloneName = `${avatarName}_${timestamp}_${randomSuffix}_${sessionId}`;

      formData.append('name', cloneName);

      let totalFiles = 0;

      if (audioBlob) {
        setStatus({ type: 'info', message: '📤 Uploading recorded audio...' })
        const ext = audioBlob.type.split('/')[1] || 'webm';
        const uniqueId = Math.random().toString(36).substring(2, 8);
        const blobFile = new File(
          [audioBlob],
          `voice_${timestamp}_${randomSuffix}_${uniqueId}.${ext}`,
          {
            type: audioBlob.type,
            lastModified: Date.now()
          }
        );
        formData.append('audio', blobFile, blobFile.name);
        totalFiles++;
      }

      if (uploadedFiles.length > 0) {
        setStatus({ type: 'info', message: `📤 Uploading ${uploadedFiles.length} file(s)...` })
        uploadedFiles.forEach((file, i) => {
          const ext = file.name.split('.').pop() || 'webm';
          const uniqueId = Math.random().toString(36).substring(2, 8);
          const fileCopy = new File(
            [file],
            `upload_${timestamp}_${i}_${randomSuffix}_${uniqueId}.${ext}`,
            {
              type: file.type,
              lastModified: Date.now() + i
            }
          );
          formData.append('audio', fileCopy, fileCopy.name);
          totalFiles++;
        });
      }

      console.log(`[VOICE TRAINING] Processing ${totalFiles} audio file(s) for ${cloneName}`);

      formData.append('script', getCurrentScript())
      formData.append('accent', selectedAccent)
      if (avatarId) {
        formData.append('avatarId', avatarId)
      }

      setStatus({ type: 'info', message: '🤖 Training AI voice model... This may take 2-5 minutes.' })

      // Get the current session for authorization
      let authHeader = '';
      try {
        const { data } = await supabase.auth.getSession();
        authHeader = data?.session?.access_token ? `Bearer ${data.session.access_token}` : '';
      } catch (authError) {
        console.error('Auth error:', authError);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout

      try {
        const response = await fetch('/api/train-voice', {
          method: 'POST',
          headers: authHeader ? {
            'Authorization': authHeader
          } : {},
          body: formData,
          signal: controller.signal
        })

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage = 'Training failed. ';

          if (response.status === 413) {
            errorMessage += 'Audio files too large. Please use smaller files.';
          } else if (response.status === 429) {
            errorMessage += 'Too many requests. Please wait and try again.';
          } else if (response.status >= 500) {
            errorMessage += 'Server error. Please try again later.';
          } else {
            try {
              const errorData = JSON.parse(errorText);
              errorMessage += errorData.error || `HTTP ${response.status}`;
            } catch {
              errorMessage += `HTTP ${response.status}`;
            }
          }

          setStatus({ type: 'error', message: errorMessage });
          return;
        }

        const data = await response.json()

        if (data.success && data.voice_id) {
          setStatus({
            type: 'success',
            message: `🎉 Success! ${avatarName}'s voice has been trained and is ready to use.`
          })

          if (onVoiceUploaded) {
            onVoiceUploaded(data.voice_id)
          }

          // Reset form after delay
          setTimeout(() => {
            resetForm()
          }, 4000)
        } else {
          setStatus({
            type: 'error',
            message: data.error || 'Training completed but no voice ID was returned. Please try again.'
          })
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);

        if (fetchError.name === 'AbortError') {
          setStatus({ type: 'error', message: 'Training timed out. Please try with shorter audio files.' })
        } else {
          setStatus({ type: 'error', message: 'Network error. Please check your connection and try again.' })
        }
      }
    } catch (error: any) {
      console.error('Voice training error:', error);
      setStatus({
        type: 'error',
        message: `Unexpected error: ${error.message || 'Please try again.'}`
      })
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
    setRecordingTime(0)

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop())
      setAudioStream(null)
    }
  }

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }

  // Cleanup effect
  useEffect(() => {
    return () => {
      // Clean up timer
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }

      // Clean up audio stream
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop())
      }

      // Clean up audio URLs
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [audioStream, audioUrl])

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

            {/* Accent Selection */}
            <div className="accent-selection">
              <h4>Select Your Accent</h4>
              <p className="accent-description">
                Choose the accent that matches your natural speaking voice for the best results.
              </p>
              <div className="accent-options">
                {Object.entries(ACCENT_OPTIONS).map(([key, accent]) => (
                  <button
                    key={key}
                    className={`accent-option ${selectedAccent === key ? 'selected' : ''}`}
                    onClick={() => setSelectedAccent(key)}
                  >
                    <span className="accent-flag">{accent.flag}</span>
                    <div className="accent-info">
                      <h5>{accent.title}</h5>
                      <p>{accent.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

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
                <>
                  <div className="recording-visualizer">
                    <AudioVisualizer stream={audioStream} isRecording={recording} />
                    <div className="recording-timer">
                      <div className="recording-status">🔴 Recording</div>
                      <div className="recording-time">{formatTime(recordingTime)}</div>
                      {recordingTime >= 30 && (
                        <div className="recording-hint">✓ Good length for training</div>
                      )}
                      {recordingTime >= 120 && (
                        <div className="recording-hint">⚠️ Consider stopping soon</div>
                      )}
                    </div>
                  </div>
                  <button className="record-btn recording" onClick={stopRecording}>
                    <span className="record-icon pulse">⏹️</span>
                    Stop Recording ({formatTime(recordingTime)})
                  </button>
                </>
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
              <p>Supports MP3, WAV, M4A, FLAC, and other audio formats</p>
              <p className="upload-note">Multiple files can be selected for better training</p>
              <div className="upload-requirements">
                <span>• Max file size: 50MB each</span>
                <span>• Recommended: 2-5 minutes total audio</span>
                <span>• Clear speech, minimal background noise</span>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.flac,.ogg,.webm"
              multiple
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />

            {uploadedFiles.length > 0 && (
              <div className="uploaded-files">
                <h4>Uploaded Files ({uploadedFiles.length})</h4>
                <div className="files-summary">
                  Total size: {(uploadedFiles.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024).toFixed(2)} MB
                </div>
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="uploaded-file">
                    <div className="file-info">
                      <div className="file-icon">🎵</div>
                      <div className="file-details">
                        <span className="file-name">{file.name}</span>
                        <div className="file-meta">
                          <span className="file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                          <span className="file-type">{file.type || 'Unknown format'}</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => removeFile(index)} className="remove-file" title="Remove file">
                      ×
                    </button>
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