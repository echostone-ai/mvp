'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect, useRef } from 'react'
import { QUESTIONS } from '@/data/questions'
import { supabase } from '@/components/supabaseClient'

type Progress = { total: number; answered: number; isComplete: boolean }

async function ensureProfileExists(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) {
    const { error: insertError } = await supabase
      .from('profiles')
      .insert([{ user_id: userId }])
    if (insertError) throw insertError
  }
}

async function uploadToElevenLabs(file: Blob, name: string): Promise<string> {
  const form = new FormData()
  form.append('audio', file, name)
  form.append('name', name)
  const res = await fetch('/api/upload-voice', { method: 'POST', body: form })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Upload failed: ${text}`)
  }
  const data = await res.json()
  if (!data.voice_id) throw new Error('Invalid upload response')
  return data.voice_id
}

async function previewVoice(voiceId: string): Promise<string> {
  const res = await fetch('/api/generate-voice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voiceId, text: 'Hello, this is a preview.' }),
  })
  if (!res.ok) throw new Error(await res.text())
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [loadingUser, setLoadingUser] = useState(true)
  const [activeTab, setActiveTab] = useState<'voice'|'personality'>('voice')
  const [progress, setProgress] = useState<Record<string,Progress>>({})
  const [voiceId, setVoiceId] = useState<string|null>(null)
  const [previewUrl, setPreviewUrl] = useState<string|null>(null)
  const [message, setMessage] = useState<string|null>(null)
  const [error, setError] = useState<string|null>(null)
  const [userName, setUserName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder|null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  useEffect(() => {
    let mounted = true
    async function load() {
      setError(null)
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) {
          setError("Failed to get session: " + sessionError.message)
          setLoadingUser(false)
          return
        }
        const me = sessionData.session?.user ?? null
        if (mounted) setUser(me)
        if (me) {
          try {
            await ensureProfileExists(me.id)
          } catch (e: any) {
            setError('Could not ensure profile exists: ' + e.message)
          }
          const { data, error } = await supabase
            .from('profiles')
            .select('profile_data, voice_id')
            .eq('user_id', me.id)
            .maybeSingle()
          if (error) {
            setError("Profile fetch error: " + error.message)
          }
          if (data && mounted) {
            const prog: Record<string,Progress> = {}
            Object.entries(QUESTIONS || {}).forEach(([section, qs]) => {
              const answers = data.profile_data?.[section] || {}
              const cnt = qs.filter(q => answers[q.key]?.trim()).length
              prog[section] = { total: qs.length, answered: cnt, isComplete: cnt === qs.length && qs.length > 0 }
            })
            setProgress(prog)
            setVoiceId(data.voice_id)
          }
        }
        setLoadingUser(false)
      } catch (e: any) {
        setError("Unexpected error: " + (e?.message || e))
        setLoadingUser(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0] || !userName.trim() || !user) return
    setError(null); setMessage(null); setUploading(true)
    const file = e.target.files[0]
    const name = `${userName.trim()}-${Date.now()}`
    try {
      const id = await uploadToElevenLabs(file, name)
      setVoiceId(id)
      await supabase.from('profiles').update({ voice_id: id }).eq('user_id', user.id)
      setMessage('Upload successful!')
    } catch(err:any) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function startRecording() {
    setError(null); setMessage(null); audioChunksRef.current = []
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      recorder.ondataavailable = (evt) => {
        audioChunksRef.current.push(evt.data)
      }
      recorder.onstop = async () => {
        setRecording(false); setUploading(true)
        const blob = new Blob(audioChunksRef.current,{ type:'audio/webm' })
        const name = `${userName.trim()}-${Date.now()}`
        try {
          const id = await uploadToElevenLabs(blob, name)
          setVoiceId(id)
          await supabase.from('profiles').update({ voice_id: id }).eq('user_id', user.id)
          setMessage('Upload successful!')
        } catch(err:any) {
          setError(err.message)
        } finally {
          setUploading(false)
        }
      }
      recorder.start(); setRecording(true)
    } catch(err:any) {
      setError(err.message); setRecording(false)
    }
  }
  function stopRecording() { mediaRecorderRef.current?.stop() }

  // Responsive, styled!
  return (
    <main className="profile-main">
      <div className="profile-header">
        <Image className="profile-logo" src="/echostone_logo.png" width={160} height={160} alt="EchoStone Logo" />
        <h1 className="profile-title">Your Profile</h1>
        <div className="profile-tabs">
          <button
            className={`profile-tab ${activeTab==='voice' ? 'active' : ''}`}
            onClick={() => setActiveTab('voice')}
          >Voice</button>
          <button
            className={`profile-tab ${activeTab==='personality' ? 'active' : ''}`}
            onClick={() => setActiveTab('personality')}
          >Personality</button>
        </div>
      </div>

      <div className="profile-content">
        {error && <div className="profile-error">{error}</div>}

        {activeTab === 'voice' && (
          <aside className="profile-voice-panel">
            <label htmlFor="userName" className="profile-label">
              Your Name *
            </label>
            <input
              id="userName" type="text" value={userName}
              onChange={e=>setUserName(e.currentTarget.value)}
              placeholder="Enter your name"
              className="profile-input"
            />

            <div>
              <input
                id="voiceFileInput" type="file" accept="audio/*"
                onChange={handleFileChange}
                disabled={uploading || recording || !userName.trim()}
                style={{ display:'none' }}
              />
              <label
                htmlFor="voiceFileInput"
                className={`profile-btn ${uploading||recording||!userName.trim() ? 'disabled' : ''}`}
                style={{ marginBottom: 16 }}
              >
                Choose File…
              </label>
            </div>
            <div className="profile-or">or</div>
            {!recording ? (
              <button
                className="profile-btn"
                onClick={startRecording}
                disabled={uploading || !userName.trim()}
                style={{ width: '100%', marginBottom: 16 }}
              >
                🎤 Record In Browser
              </button>
            ) : (
              <button
                className="profile-btn danger"
                onClick={stopRecording}
                style={{ width: '100%', marginBottom: 16 }}
              >
                ⏹️ Stop Recording
              </button>
            )}
            <div className="profile-preview-row">
              <button
                className="profile-btn secondary"
                onClick={async ()=>{
                  setError(null); setMessage('Generating preview…')
                  try{ const url = await previewVoice(voiceId!); setPreviewUrl(url) }
                  catch(err:any){ setError(err.message) }
                  finally{ setMessage(null) }
                }}
                disabled={!voiceId}
                style={{ opacity: !voiceId ? 0.5 : 1 }}
              >
                🔊 Preview
              </button>
              {previewUrl && <audio controls src={previewUrl} style={{ maxWidth: 200 }} />}
            </div>
            {voiceId && (
              <button
                className="profile-btn danger"
                onClick={async ()=>{
                  if (!confirm('Delete your voice clone?')) return
                  await supabase.from('profiles').update({ voice_id: null }).eq('user_id', user.id)
                  setVoiceId(null); setPreviewUrl(null); setMessage(null)
                }}
                style={{ marginTop: 16, width: '100%' }}
              >
                Delete Voice ❌
              </button>
            )}
            {uploading && <p className="profile-status uploading">Uploading…</p>}
            {message && <p className="profile-status success">{message}</p>}
          </aside>
        )}

        {activeTab === 'personality' && (
          <div className="profile-sections">
            {Object.entries(QUESTIONS || {}).map(([section, qs]) => {
              const prog = progress[section] || { total: qs.length, answered: 0, isComplete: false }
              return (
                <Link key={section} href={`/profile/edit/${section}`} className="profile-section-link">
                  <div className={`profile-section-card${prog.isComplete ? ' complete' : ''}`}>
                    <h2>{section.replace(/_/g,' ')}</h2>
                    <p>{prog.answered} of {prog.total} answered</p>
                    {prog.isComplete && <span className="profile-section-check">✓</span>}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}