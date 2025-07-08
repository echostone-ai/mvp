'use client'

import { useRouter } from 'next/navigation'
import { QUESTIONS } from '@/data/questions'  // <-- FIXED

export default function ProfilePage() {
  const router = useRouter()
  return (
    <main
      style={{
        minHeight: '100vh',
        width: '100vw',
        background: 'radial-gradient(ellipse at 50% 15%, #201744 0%, #18122e 80%, #0a001a 100%)',
        color: '#e0d4f7',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, Arial, sans-serif',
        padding: '2em'
      }}
    >
      <div
        style={{
          backdropFilter: 'blur(24px)',
          background: 'rgba(34, 24, 56, 0.85)',
          borderRadius: '2.3em',
          padding: '3em 2.4em 2.6em 2.4em',
          boxShadow: '0 8px 44px #6a00ff33, 0 0 0 1.5px #5a008855',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: 430,
          width: '90vw',
          marginBottom: '2em'
        }}
      >
        <h1
          style={{
            fontSize: '2.45rem',
            fontWeight: 700,
            marginBottom: '0.35em',
            letterSpacing: '0.01em',
            color: '#fff',
            textShadow: '0 2px 18px #6a00ff33',
            textAlign: 'center'
          }}
        >
          Your EchoStone Profile
        </h1>
        <p
          style={{
            maxWidth: 380,
            textAlign: 'center',
            fontSize: '1.13rem',
            margin: '0 0 2.4em 0',
            color: '#b7b0d8',
            lineHeight: 1.5
          }}
        >
          Welcome to your private portal.<br />
          Here you can update your digital echo, manage your story, and explore your AI companion’s abilities.
        </p>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1.5em',
          maxWidth: 900,
          width: '90vw'
        }}
      >
        {QUESTIONS.map(({ id, title }) => (
          <button
            key={id}
            onClick={() => router.push(`/profile/edit/${id}`)}
            style={{
              background: 'rgba(34, 24, 56, 0.85)',
              borderRadius: '1.7em',
              padding: '1.6em 1.2em',
              border: '1.5px solid #5a008855',
              boxShadow: '0 4px 24px #6a00ff33',
              color: '#e0d4f7',
              fontWeight: 600,
              fontSize: '1rem',
              cursor: 'pointer',
              textAlign: 'center',
              textShadow: '0 1px 6px #6a00ff33',
              transition: 'background 0.3s, box-shadow 0.3s, transform 0.18s'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'linear-gradient(90deg, #6a00ff 65%, #9147ff 100%)'
              e.currentTarget.style.boxShadow = '0 6px 28px #6a00ff77'
              e.currentTarget.style.transform = 'scale(1.05)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(34, 24, 56, 0.85)'
              e.currentTarget.style.boxShadow = '0 4px 24px #6a00ff33'
              e.currentTarget.style.transform = 'scale(1)'
            }}
            aria-label={`Edit section: ${title}`}
          >
            {title}
          </button>
        ))}
      </div>
    </main>
  )
}