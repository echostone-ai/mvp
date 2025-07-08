'use client'

import Link from 'next/link'
import Image from 'next/image'
import LogoHeader from '@/components/LogoHeader'
import { useState, useEffect } from 'react'
import { QUESTIONS } from '@/data/questions'

type Progress = {
  total: number
  answered: number
  isComplete: boolean
}

export default function ProfilePage() {
  const [progress, setProgress] = useState<Record<string, Progress>>({})

  useEffect(() => {
    const prog: Record<string, Progress> = {}
    for (const section of Object.keys(QUESTIONS)) {
      const saved = localStorage.getItem(`echostone_profile_${section}`)
      let answered = 0
      let total = QUESTIONS[section].length
      let isComplete = false

      if (saved) {
        try {
          const answers = JSON.parse(saved)
          answered = QUESTIONS[section].filter(q => answers[q.key]?.trim()).length
          isComplete = answered === total && total > 0
        } catch {
          answered = 0
        }
      }
      prog[section] = { total, answered, isComplete }
    }
    setProgress(prog)
  }, [])

  return (
    <main
      style={{
        minHeight: '100vh',
        width: '100vw',
        background: 'radial-gradient(circle, #8b5cf6 0%, #4c1d95 40%, #000 100%)',
        color: '#f0eaff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '40px 20px',
        fontFamily: 'Inter, Arial, sans-serif',
      }}
    >
      <div style={{ marginBottom: '32px' }}>
        <Image
          src="/echostone_logo.png"
          width={100}
          height={100}
          alt="EchoStone Logo"
          priority
        />
      </div>
      <h1
        style={{
          fontSize: '2rem',
          marginBottom: '24px',
          color: '#fff',
          textShadow: '0 2px 12px #0006',
        }}
      >
        Your Profile
      </h1>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))',
          gap: '16px',
          width: '100%',
          maxWidth: 960,
        }}
      >
        {Object.entries(QUESTIONS).map(([section, qs]) => {
          const prog = progress[section] || { answered: 0, total: qs.length, isComplete: false }
          return (
            <Link
              key={section}
              href={`/profile/edit/${section}`}
              style={{ textDecoration: 'none' }}
            >
              <div
                style={{
                  padding: '1.2em',
                  borderRadius: '16px',
                  background: prog.isComplete
                    ? 'rgba(30,10,60,0.96)'
                    : 'rgba(30,10,60,0.7)',
                  boxShadow: '0 2px 12px #0006',
                  opacity: prog.isComplete ? 1 : 0.8,
                  transition: 'background 0.3s, opacity 0.3s',
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: '1.2rem',
                    color: '#fff',
                    textTransform: 'capitalize',
                  }}
                >
                  {section.replace(/_/g, ' ')}
                </h2>
                <p
                  style={{
                    margin: '0.5em 0',
                    fontSize: '0.9rem',
                    color: '#c2b8e0',
                  }}
                >
                  {prog.answered} of {prog.total} answered
                </p>
                {prog.isComplete && (
                  <span style={{ color: '#7fffab', fontSize: '1.5rem' }}>
                    ✓
                  </span>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </main>
  )
}