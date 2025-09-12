'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import styles from './onboarding.module.css'

type Clarifier = { question: string; reason?: string }

export default function OnboardingPage() {
  const { slug } = useParams() as { slug: string }
  const router = useRouter()
  const [story, setStory] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [readback, setReadback] = useState<{ summary: string; facts: Array<{ key: string; value: string }> } | null>(null)
  const [avatarId, setAvatarId] = useState<string | null>(null)
  const [clarifiers, setClarifiers] = useState<Clarifier[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [toast, setToast] = useState<string>('')

  const userId = 'demo' // replace with auth session on real page

  function fakeProgress() {
    setProgress(0)
    const start = Date.now()
    const timer = setInterval(() => {
      const elapsed = Date.now() - start
      const target = Math.min(98, Math.floor(30 + (elapsed / 1500) * 70))
      setProgress(target)
    }, 120)
    return () => clearInterval(timer)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!story.trim()) return
    setLoading(true)
    const stop = fakeProgress()
    try {
      const res = await fetch('/api/onboarding/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, avatarSlug: slug, story })
      })
      const data = await res.json()
      setAvatarId(data.avatarId || null)
      setProgress(100)
      const facts = (data.readback_facts || []) as Array<{ key: string; value: string }>
      const name = facts.find(f => f.key === 'full_name')?.value || slug
      const hometown = facts.find(f => f.key === 'birthplace')?.value
      const birth = facts.find(f => f.key === 'birth_date' || f.key === 'birth_year')?.value
      const notable = facts.find(f => ['pet_name','service_context','current_job','hobbies'].includes(f.key))?.value
      const s1 = `${name}${hometown ? `, from ${hometown}` : ''}${birth ? `, born ${birth}` : ''}.`
      const s2 = notable ? ` ${typeof notable === 'string' ? notable : String(notable)}.` : ''
      const s3 = hometown ? ' Thanks for sharing—this helps me answer personally.' : ''
      const summary = `${s1}${s2}${s3}`
      setReadback({ summary, facts })
    } finally {
      stop()
      setLoading(false)
    }
  }

  async function loadClarifiers() {
    const res = await fetch(`/api/onboarding/clarifiers?avatar=${encodeURIComponent(slug)}`)
    const data = await res.json()
    setClarifiers((data.clarifiers || []).slice(0, 2))
  }

  async function submitAnswer(q: Clarifier) {
    const val = answers[q.question]
    if (!val?.trim()) return
    // Post as fragment with source: 'clarifier'
    await fetch(`/api/avatars/${encodeURIComponent(slug)}/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fragments: [val],
        user_id: userId,
        context: { source: 'clarifier', metadata: { question: q.question } }
      })
    })
    setToast('Saved · will reflect in next reply')
    setTimeout(() => setToast(''), 1500)
  }

  function goChat() {
    if (avatarId) {
      router.push(`/avatars/${encodeURIComponent(avatarId)}`)
    } else {
      router.push(`/avatars`)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Tell me your story…</h1>
        <form onSubmit={handleSubmit}>
          <textarea
            className={styles.textarea}
            placeholder="Write for 60–120 seconds about yourself—highlights, places, people."
            value={story}
            onChange={e => setStory(e.target.value)}
            rows={8}
          />
          <div className={styles.actions}>
            <button className={styles.primary} type="submit" disabled={loading}>Save</button>
          </div>
          {loading && (
            <div className={styles.progressBar}>
              <div className={styles.progress} style={{ width: `${progress}%` }} />
            </div>
          )}
        </form>

        {readback && (
          <div className={styles.readback}>
            <p>{readback.summary}</p>
            <button className={styles.link} onClick={loadClarifiers}>Improve this</button>
          </div>
        )}

        {clarifiers.length > 0 && (
          <div className={styles.chips}>
            {clarifiers.map((c) => (
              <div key={c.question} className={styles.chip}>
                <span>{c.question}</span>
                <input
                  className={styles.input}
                  placeholder="Answer"
                  value={answers[c.question] || ''}
                  onChange={(e) => setAnswers({ ...answers, [c.question]: e.target.value })}
                />
                <button className={styles.secondary} onClick={() => submitAnswer(c)}>Add</button>
              </div>
            ))}
          </div>
        )}

        <div className={styles.footer}>
          <button className={styles.ghost} onClick={goChat}>Done → Chat now</button>
        </div>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  )
}


