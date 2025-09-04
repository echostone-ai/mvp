'use client'

import { useState } from 'react'

type Step1 = { avatarName: string; nickname?: string; tone?: string; style?: string; voice?: string }
type Step2 = { birthplace?: string; birth_date?: string; life_events?: string[] }
type Step3 = { profileJson?: any }

export default function OnboardingWizardPage() {
  const [step, setStep] = useState(1)
  const [s1, setS1] = useState<Step1>({ avatarName: '' })
  const [s2, setS2] = useState<Step2>({})
  const [s3, setS3] = useState<Step3>({})
  const [preview, setPreview] = useState<string>('')
  const [avatarId, setAvatarId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const canNext = step === 1 ? !!s1.avatarName : step === 2 ? true : true

  const handleUploadJson = async (file: File) => {
    const text = await file.text()
    try { setS3({ profileJson: JSON.parse(text) }) } catch { alert('Invalid JSON') }
  }

  const buildPreview = async () => {
    setLoading(true)
    try {
      const resp = await fetch('/api/onboarding/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'demo',
          ...s1,
          ...s2,
          profileJson: s3.profileJson || undefined,
          debug: true
        })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Failed')
      setAvatarId(data.avatarId)
      setPreview(data.story || '')
      setStep(4)
    } catch (e: any) {
      alert(e?.message || 'Failed to generate preview')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 20 }}>
      <h1>Create Your Avatar</h1>
      <div style={{ color: '#666', marginBottom: 16 }}>Step {step} of 4</div>

      {step === 1 && (
        <section style={{ display: 'grid', gap: 12 }}>
          <label>
            <div>Avatar Name</div>
            <input value={s1.avatarName} onChange={e=>setS1({ ...s1, avatarName: e.target.value })} placeholder="e.g., Sarah" />
          </label>
          <label>
            <div>Nickname</div>
            <input value={s1.nickname||''} onChange={e=>setS1({ ...s1, nickname: e.target.value })} />
          </label>
          <label>
            <div>Tone</div>
            <input value={s1.tone||''} onChange={e=>setS1({ ...s1, tone: e.target.value })} />
          </label>
          <label>
            <div>Style</div>
            <input value={s1.style||''} onChange={e=>setS1({ ...s1, style: e.target.value })} />
          </label>
          <label>
            <div>Voice</div>
            <input value={s1.voice||''} onChange={e=>setS1({ ...s1, voice: e.target.value })} />
          </label>
        </section>
      )}

      {step === 2 && (
        <section style={{ display: 'grid', gap: 12 }}>
          <label>
            <div>Birthplace</div>
            <input value={s2.birthplace||''} onChange={e=>setS2({ ...s2, birthplace: e.target.value })} />
          </label>
          <label>
            <div>Birth date</div>
            <input type="date" value={s2.birth_date||''} onChange={e=>setS2({ ...s2, birth_date: e.target.value })} />
          </label>
          <label>
            <div>Notable life events (comma separated)</div>
            <input value={(s2.life_events||[]).join(', ')} onChange={e=>setS2({ ...s2, life_events: e.target.value.split(',').map(s=>s.trim()).filter(Boolean) })} />
          </label>
        </section>
      )}

      {step === 3 && (
        <section style={{ display: 'grid', gap: 12 }}>
          <div>Optional: Upload profile JSON to auto-fill facts</div>
          <input type="file" accept="application/json" onChange={e=>{ const f=e.target.files?.[0]; if (f) handleUploadJson(f) }} />
          {s3.profileJson && (
            <pre style={{ background: '#f8f8f8', padding: 10, borderRadius: 6, maxHeight: 200, overflow: 'auto' }}>{JSON.stringify(s3.profileJson, null, 2)}</pre>
          )}
        </section>
      )}

      {step === 4 && (
        <section>
          <div style={{ marginBottom: 12 }}>Preview: your avatar greets you in their own words</div>
          <div style={{ whiteSpace: 'pre-wrap', border: '1px solid #eee', borderRadius: 8, padding: 12, marginBottom: 12 }}>{preview || (loading ? 'Generating…' : '')}</div>
          <div style={{ fontSize: 12, color: '#666' }}>You can start chatting now.</div>
        </section>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        {step > 1 && step < 4 && <button onClick={() => setStep(step-1)}>Back</button>}
        {step < 3 && <button onClick={() => canNext && setStep(step+1)} disabled={!canNext}>Next</button>}
        {step === 3 && <button onClick={buildPreview} disabled={loading || !s1.avatarName}>{loading ? 'Seeding…' : 'Generate Preview'}</button>}
      </div>
    </div>
  )
}


