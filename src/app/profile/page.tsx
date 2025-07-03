// src/app/profile/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import './profile.css'   // your styles from before

const QUESTIONS = [
  { key: 'mem1', text: 'What’s your earliest childhood memory?' },
  { key: 'mem2', text: 'Where did you grow up?' },
  /* …add the rest of your 150 questions here… */
]

export default function ProfilePage() {
  const supabase = createClientComponentClient()
  const router   = useRouter()
  const [step, setStep]         = useState(0)
  const [answers, setAnswers]   = useState<Record<string,string>>({})
  const q = QUESTIONS[step]!

  const handleNext = () =>
    setStep((s) => Math.min(s + 1, QUESTIONS.length - 1))

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAnswers((a) => ({ ...a, [q.key]: e.target.value }))
  }

  const handleSubmit = async () => {
    // 1) get the logged-in user
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      alert('Please log in first')
      return
    }

    // 2) upsert into your `profiles` table, into the JSONB column `profile_data`
    const { error } = await supabase
      .from('profiles')
      .upsert(
        {
          user_id:      user.id,
          profile_data: answers
        },
        {
          onConflict: 'user_id'
        }
      )

    if (error) {
      alert('Failed to save: ' + error.message)
      return
    }

    // 3) on success, redirect back to your chat/ask page
    router.push(`/ask/${user.id}`)
  }

  return (
    <main className="page-container">
      <div className="form-card">
        <h1 className="form-title">
          Question {step + 1} of {QUESTIONS.length}
        </h1>
        <p className="form-question">{q.text}</p>
        <input
          className="form-input"
          type="text"
          value={answers[q.key] || ''}
          onChange={handleChange}
        />

        {step < QUESTIONS.length - 1 ? (
          <button className="form-button" onClick={handleNext}>
            Next →
          </button>
        ) : (
          <button className="form-button" onClick={handleSubmit}>
            Save Profile
          </button>
        )}
      </div>
    </main>
  )
}
