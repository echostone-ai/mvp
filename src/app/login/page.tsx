'use client'

import { useRouter } from 'next/navigation'
import './profile.css'

export default function ProfilePage() {
  const router = useRouter()

  return (
    <main className="profile-hub" style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at center, #1e0033, #000000)',
      color: '#e0d4f7',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '"Garamond", serif'
    }}>
      <h1 style={{
        fontSize: '3rem',
        marginBottom: '0.5em',
        textShadow: '0 0 10px #6a00ff'
      }}>
        Your EchoStone Profile
      </h1>
      <p style={{
        maxWidth: '600px',
        textAlign: 'center',
        fontSize: '1.3rem',
        opacity: 0.85
      }}>
        This is your personal sanctum within EchoStone. Here your experiences, preferences, and echoes are woven together.
      </p>
      <button
        onClick={() => router.push('/profile/form')}
        style={{
          marginTop: '2em',
          background: '#6a00ff',
          border: 'none',
          padding: '1em 2em',
          fontSize: '1.2rem',
          borderRadius: '8px',
          color: '#fff',
          cursor: 'pointer',
          boxShadow: '0 0 15px #6a00ff',
          transition: 'transform 0.2s'
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        Reveal Your Echo
      </button>
    </main>
  )
}
